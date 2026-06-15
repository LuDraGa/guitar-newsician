# Maestro — Working Base Agent milestone (DB + UI + ported baseline)

| | |
|---|---|
| **Date** | 2026-06-14 |
| **Status** | 🟢 A+B+C complete — `/app/maestro` is wired end-to-end to the local baseline agent (Next `/api/maestro/*` → `MAESTRO_AGENT_URL`): pick a song, build/load its fact pack, chat with evidence + an inspectable trace. C4 tests deferred by decision (2026-06-15). Typecheck + lint clean; agent-service contract smoke-tested. **Committing the working base.** |
| **Milestone** | Get the POC's baseline Q&A agent **working on real WereCode data** and **committed** — then scope the coaching vertical slices against the PRD. |
| **Scope** | Phase A (DB migration + trusted intake) · Phase B (`/app/maestro` UI) · Phase C (port the baseline agent, run locally). **Phase D (Slices 1–5) is deliberately deferred** to post-commit scoping. |
| **Grounds on** | [maestro-coach-prd.md](../maestro/maestro-coach-prd.md) · [maestro-agent-architecture.md](../maestro/maestro-agent-architecture.md) · [maestro-build-flow.md](../maestro/maestro-build-flow.md) · POC `~/code/personal/modal_apis/Maestro` |
| **Follows** | [2026-06-14_maestro-docs-port-and-grounding.md](2026-06-14_maestro-docs-port-and-grounding.md) (docs ported; this is the build that follows) |

---

## Locked decisions (the `⟳ decide-at-build` items, resolved 2026-06-14)

1. **Runtime — local now, Modal later.** The ported agent runs as a **local Python service** (uv/uvicorn, as the POC does today). Next `/api/maestro/*` calls it over HTTP via a new `MAESTRO_AGENT_URL` env (default `http://127.0.0.1:8000`). The seam is identical to the eventual Modal path (`modalFetch` to `src/lib/modal/client.ts`), so promoting to Modal later is a transport swap with **no route changes**. The agent service is **separate from `backend/`** (which stays YouTube-download-only per `CLAUDE.md`).
2. **Per-stem modeling — pure new asset kinds (build-flow §1, option a).** Add a per-stem analysis asset kind + `stem_midi_*` asset kinds to the `werecode.assets` enum, plus per-stem `analyze` / `midi_transcribe` job targeting. Chosen for query symmetry with the existing per-stem *audio* kinds.
3. **Milestone shape — A+B+C, commit, then scope slices.** UI + base-agent port are high-reuse retrofit work; the real design effort is the coaching slices, which we scope **after** the baseline is committed and working.

---

## Phase A — DB migration + trusted per-stem intake (backend)

**Goal:** give the agent an *accurate, complete, per-(song, stem)* substrate to read — the role axis (`time-level × role`, architecture §4) has no substrate without per-stem analysis + MIDI.

Grounded in [the schema](../../supabase/sql/2026-05-25_werecode_schema.sql): per-stem *audio* is already first-class (`stem_vocals/drums/bass/other/guitar/piano` + `stems_manifest`); `analysis_json` is full-mix and `midi`/`note_events` are full-track — those are the gaps.

### A1 — Schema migration (new SQL file under `supabase/sql/`)
- Extend `werecode.assets.kind` enum: add **`stem_midi_vocals/drums/bass/other/guitar/piano`** (per-stem MIDI) and a **per-stem analysis kind** (e.g. `stem_analysis_json`).
- Allow per-stem **jobs**: per-stem `analyze` / `midi_transcribe` targeting a specific stem asset (parameterize the job, or add stem-scoped job rows — decide in A1).
- Confirm RLS + the 3 buckets (`werecode-sources` / `werecode-artifacts` / `werecode-previews`) cover the new kinds (owner-scoped via `auth.uid()`, no new policy shape expected).
- `checksum_sha256` already exists on assets → free source-hash for fact-pack invalidation downstream.

### A2 — Trusted-upload intake (provenance-aware)
- Upload + intake API that writes **user-provided, human-verified** per-stem audio + per-stem MIDI + full MIDI + analysis as `werecode.assets`, marking **provenance**: uploaded-source (trusted, → `werecode-sources`) vs machine-derived (→ `werecode-artifacts`). `source_kind` (`audio_upload/midi_upload/musicxml_upload`) and `song_versions.version_kind` (`stem/transcription/analysis`) already exist — this is intake + provenance, not a row-type rebuild.
- Upload contract (build-flow §1): full audio · name · artist/group · lyrics *(stored only; lyrics coaching out of scope)* · stems (per-instrument audio) · MIDI full · MIDI stems · per-stem analysis. Set song readiness flags (`has_stems/has_midi/has_analysis`).

### A0 — Dev seed (optional accelerator) ⟳ confirm
- A dev-only script that writes **one** trusted per-stem song (e.g. a BabySlakh-style bundle) directly into `werecode` assets + `analysis_results`, so Phase C can be exercised **before** A2's upload UX is polished. Lets the agent reach "working" fastest; A2 then hardens the real path.

**DoD:** a song is queryable per `(song, stem)` with trusted per-stem **audio + MIDI + analysis**, owner-scoped — the substrate the ported fact pack expects.

---

## Phase B — `/app/maestro` surface + `isMaestroEnabled()` (UI)

**Goal:** a fenced developer surface to drive + inspect the agent, shipping nothing to prod. High reuse — mirror Pipeline exactly.

Template (confirmed in code): `isPipelineEnabled()` in [src/lib/flags.ts](../../src/lib/flags.ts) · route guard in [src/app/app/pipeline/page.tsx](../../src/app/app/pipeline/page.tsx) · nav gating in `src/components/shell/AppShell.tsx` · `src/features/pipeline/PipelineClient`.

- **`isMaestroEnabled()`** in `src/lib/flags.ts` (`NEXT_PUBLIC_ENABLE_MAESTRO === 'true' || NODE_ENV === 'development'`).
- Nav item in `AppShell.tsx` (gated) + route guard in new **`src/app/app/maestro/page.tsx`** (redirect to `/app/library` when off) + **`src/features/maestro/MaestroClient`**.
- Chat panel (song picker → ask → answer) + **dev inspection**: fact-pack viewer + agent **trace** (PRD stories 27–28). The trace renders the ported `_agent_trace` payload.
- **Not** a retrofit of the static studio `AICoachDock`, nor the scripted marketing `MaestroChat`/`Concierge` — its own surface. (POC HTML templates are *not* reused; this is the new chat UI.)

**DoD:** at `/app/maestro` behind the flag, a developer can pick an uploaded song, talk to the agent, and inspect its fact pack + reasoning trace. Hidden on Vercel preview + prod.

---

## Phase C — Port the baseline Q&A agent (run local)

**Goal:** reproduce the POC's **"Baseline (today) — _answer_"** rung (PRD capability table) on WereCode's real substrate. **No teaching yet** — that's Phase D.

### Ports nearly as-is (the brains — high reuse)
- **`SongFactPackService`** (`fact_pack.py`): `build`/`ensure_current`/`query`/`_save`, source-hash invalidation, latest + history. The store template all future stores mirror (architecture §8).
- **The 7 bounded tools** (`agent.py` `_make_tools`): `get_sections / get_bar_grid / get_chords / get_key / get_midi_tracks / get_song_slice / transpose_song`.
- **The 4 specialists + DeepAgents wiring** (`_make_subagents`, `_register_maestro_profile`): structure/harmony/rhythm/midi; excluded file tools, general-purpose subagent disabled, `task` override.
- **`_agent_trace`** (observability → feeds the Phase B inspection view) and **`_build_agent_messages`** (last-16 / 6k-char history — the Learner-Model stand-in until Slice 4).
- **Confidence model**: `_resolve_teaching_key`, `key_conflict`, chord-fit candidate scoring.

### Rewritten for WereCode (the plumbing — genuine work)
- **Data-access layer.** The POC's `dataset.py` (`BabySlakhIndex`) + `analysis.py` (`AnalysisStore` reading local JSON) are BabySlakh-specific → **replace** with a WereCode adapter that reads per-(song, stem) **assets + `analysis_results`** (via Supabase signed URLs minted by the Next route, or service-key reads). `fact_pack.py`'s `_source_paths/_source_hashes/_source_artifacts` re-point from local paths to werecode assets (`checksum_sha256` → source-hash).
- **Fact-pack persistence.** POC writes JSON beside the track → **store the fact pack as an artifact** in `werecode-artifacts` (the `_save` analog; a fact-pack asset kind or a dedicated row — decide at C-start).
- **HTTP seam.** Next route handlers `POST /api/maestro/fact-pack` (build), `GET /api/maestro/fact-pack/:songId` (read), `POST /api/maestro/chat` (mirror the POC's `/api/fact-pack/*` + `/api/agent/chat` in `app.py`) → call the local agent via `MAESTRO_AGENT_URL`. (Built as RESTful `POST /fact-pack` rather than `/fact-pack/build` because the repo `.gitignore` ignores any `build/` dir — see C2/C3 sub-decision.)
- **Where the ported code lives** ⟳ confirm: proposed new top-level `maestro/` Python package in this repo (uv project), run locally; **not** `backend/`.

**DoD:** at `/app/maestro`, pick an uploaded song → build its fact pack → ask "what key? / what are the sections? / transpose to G" → **evidence-backed answers + inspectable trace**, reading real `werecode` data. The POC baseline, reproduced on the real substrate. **Commit here.**

### Testing seams (architecture §9 — no live LLM)
- **Seam A** — fact-pack service: port `tests/test_fact_pack.py` (build/ensure_current/query, persistence + invalidation) against the WereCode adapter with a fake-analysis fixture.
- **Seam B** — agent wiring: monkeypatch `deepagents.create_deep_agent`, assert which tools/subagents/prompt register + deterministic node-selection / message-assembly / trace.
- **Seam C** — HTTP: Next `/api/maestro/*` route handler + a mocked `MAESTRO_AGENT_URL` agent.

---

## Phase D — The coach (Slices 1–5) — DEFERRED, scope post-commit

Not scoped here by decision. After the base agent is committed, scope the vertical slices against the PRD + architecture §6: S1 Section briefing (introduces the 3 stores as `werecode` tables) → S2 sequence → S3 drills → S4 adapt → S5 arrange (capstone). Deferrals stay deferred (no performance listening, no cross-student judge, no eval harness, no lyrics).

---

## Sequencing

```
A1 schema migration ─┐
A2 trusted intake    │ (A0 dev-seed can unblock C before A2 is polished)
                     ├─▶ C port baseline agent (local) ──▶ COMMIT ──▶ scope Slices
B  /app/maestro UI  ─┘   (B runs parallel to A; needed to exercise C)
```

- **A is the hard dependency** — no per-stem data ⇒ nothing for the agent to comprehend.
- **B runs parallel to A.**
- **C needs A's data + B's surface**; A0 dev-seed is the fast path to exercising C.

---

## Status tracker

| Item | Status | Notes |
|---|---|---|
| Decisions locked | ✅ | runtime=local-now-Modal-later · per-stem=new kinds · milestone=A+B+C then scope |
| A1 — schema migration | 🟢 File written · apply pending | `2026-06-14_werecode_maestro_per_stem_kinds.sql`: +6 `stem_midi_*`, +`stem_analysis_json`; per-stem jobs reuse `job_type` + `request_payload` (no DDL) |
| A2 — trusted intake UX | ⬜ Deferred | A0 seed substitutes for the milestone; the polished provenance-aware upload hardens after the agent is proven |
| A0 — dev seed | ✅ Done · seeded + verified | `scripts/seed-maestro-babyslakh.mjs`; song `efcbb636-b1e0-44f0-838a-0f868ba9366b` = BabySlakh Track00001: source_audio + source_midi + 10 role-mapped stems (audio+MIDI) + analysis_json + analysis_results. Queryable per (song, stem). |
| B — `isMaestroEnabled()` + `/app/maestro` shell | ✅ Done · typecheck + lint clean | flag in `flags.ts`; dynamic nav in `AppShell`; route guard `app/app/maestro/page.tsx` + `features/maestro/MaestroClient` shell. Song picker / chat / inspector deferred to C. Gotcha: a new flagged route needs `next typegen` (typed routes) before `tsc` passes. |
| C1 — fact pack + data adapter (local) | ✅ Done · proven | `maestro/` uv package; reads `werecode` via service-role adapter; fact pack persists as an `analysis_results` row (`maestro_song_fact_pack`). Built from the seeded song: Ab/Bb teaching-vs-detected key conflict, 110 bpm, 10 sections, 10 stems. |
| C1 — agent + LiteLLM client | ✅ Done · proven | DeepAgents + `ChatLiteLLM` (`llm.py`): 7 bounded tools, 4 specialists, trace + per-call token/cost. Answers key/sections with honest confidence (~$0.05, ~8s/query). |
| C2 — `/api/maestro/*` + `MAESTRO_AGENT_URL` | ✅ Done | `src/lib/maestro/client.ts` = the single transport seam (`maestroFetch`, mirrors `modalFetch`; `MaestroAgentError` carries upstream status; camelCase↔snake_case here). 3 routes under `src/app/api/maestro/`: `POST fact-pack` (build), `GET fact-pack/[songId]` (read), `POST chat` — each `isMaestroEnabled()`-gated (404 off), auth + `requireOwnedSong`, then proxy. Modal later = swap `maestroFetch` for `modalFetch`, no route changes. |
| C3 — MaestroClient wiring | ✅ Done | `MaestroClient` is the live workbench: song picker (library filtered to `has_analysis`, readiness chips) · fact-pack build/load + summary (teaching vs detected key + conflict, tempo, sections, stems, confidence) · chat (react-markdown + remark-gfm, 3 DoD prompts pre-wired) · per-answer trace inspector (tokens/cost/elapsed) + raw fact-pack JSON. |
| C4 — tests (Seams A/B/C) | ⬜ Deferred by decision (2026-06-15) | User chose "commit the working vertical now; tests follow." Repo has no JS test runner (tests = typecheck+lint); the `maestro/` uv package has pytest for the eventual Python Seams A/B. |
| **COMMIT working base agent** | 🟢 Committing | typecheck + lint clean; agent `/health` + `/fact-pack/{seed}` smoke-tested (Ab/Bb conflict, 110bpm, 10 sections, 10 stems) |
| D — scope Slices 1–5 | ⬜ Deferred | after commit, vs PRD |

## Sub-decisions
- **A1 — RESOLVED:** per-stem `analyze`/`midi_transcribe` reuse existing `job_type` and target a stem via `request_payload` (no jobs DDL). Per-stem analysis blob = `stem_analysis_json` asset; structured per-stem rows may also use `analysis_results.asset_id` → stem asset (FK already exists).
- **A0 — RESOLVED:** dev-seed accelerator is in (fastest path to a talking agent; A2 hardens the real upload in parallel).
- **C — substrate ready:** the seed wrote song `efcbb636…366b` with mix analysis in `analysis_results.data` (analyzer `maestro_mix_analysis`, full POC JSON) + per-stem MIDI/audio assets keyed by `metadata.stem_id` + `role`. Phase C's data adapter reads from here.
- **C — resolved:** code lives in the `maestro/` uv package; the local agent reads `werecode` directly via the **service-role** adapter (the Modal path can switch to Next-minted signed URLs later); fact-pack persistence = an **`analysis_results` row** (`maestro_song_fact_pack`), no new asset kind; provider = **OpenAI via LiteLLM** (`MAESTRO_AGENT_MODEL`, key from the POC `.env`).
- **C — polish (not blocking):** exclude DeepAgents' default file tools + general-purpose subagent (string-keyed harness profile) to cut the ~13.5k-token prompt and per-query cost; refine per-model temperature policy in `llm.py`.
- **C2/C3 — RESOLVED (2026-06-15):** the build endpoint is **`POST /api/maestro/fact-pack`** (not `/fact-pack/build`) — the repo `.gitignore` ignores any dir named `build/` (Python build hygiene), which silently dropped a `fact-pack/build/route.ts` from git; RESTful POST-to-collection sidesteps it without weakening the ignore. The seam still calls the agent's own `/fact-pack/build` path. Chat renders via **react-markdown + remark-gfm** (the agent emits Markdown tables/code). ESLint now ignores `maestro/**` (separate uv project; its `.venv` ships vendored JS) and `.claude/**` — neither is Next source; this is what makes `pnpm lint` reflect app code. Build tooling needs **Node 22** (nvm), not the default 18. `MAESTRO_AGENT_URL` is optional (defaults to `http://127.0.0.1:8000`); when the agent is down the seam returns **503** with a "start the local service" message rather than a 500.
