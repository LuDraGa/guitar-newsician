# Maestro — Session Handoff (START HERE when resuming)

> **Living pointer, maintained every working step.** Read this first, then the linked plan doc. It is the always-current overlay; the detailed progress log lives in the execution doc below.
>
> **Last updated:** 2026-06-16 (session handoff point) · **Branch:** `maestro/agent-buildout` (off `main`)

---

## TL;DR — where we are right now

- **Working on:** Maestro **base-agent comprehension = Slice 0** — making the fact pack/agent actually *consume* the per-stem substrate Prep A landed. It's the bridge from Prep A → Slice 1 (Section × Role briefing).
- **Why:** the base agent didn't use stem info (dropped the precise identity Prep A wrote) and over/under-pulled context. Slice 1's graph is a *deterministic rollup of the fact pack*, so the fact pack must carry the role axis truthfully first.
- **Done & committed:** pre-req substrate (`04d4f79`); baseline A+B+C agent (`9659032`).
- **Done & committed (`d57c69f`):** Slice 0 **data-core** — 0.1 stem identity · 0.2 per-stem detail + `get_stem` · 0.4 section activity + `get_section_activity` · `get_stems` roster. (Tree clean; build from here.)
- **Done, NOT yet committed (working tree):**
  - **0.2b** — per-section 12-bin **pitch-class histogram** + dominant PCs in `note_activity_by_window`, surfaced on `get_section_activity` parts + a stem-level `pitch_class_profile` on `get_stem`; `FACT_PACK_VERSION`→4. So a stem with MIDI but no per-stem analysis (the bass) is comparable to the mix's chord roots.
  - **Fact Pack Freshness** (new sub-slice, built before 0.3) — the pack stores a `dependency_fingerprint` (assets + analysis-row identities); a cheap read-only `status()` + `GET …/status` route detects when a re-analysis made the pack stale (the live finding: re-analysis didn't trigger a rebuild). Chat UI: always-on **stale banner (Update)** + **blocking send confirm (Update & send / Skip)**. `FACT_PACK_VERSION`→**5**. See [../execution_docs/2026-06-16_maestro_fact_pack_freshness.md](../execution_docs/2026-06-16_maestro_fact_pack_freshness.md).
  - **Gate:** **31/31 pytest · `pnpm typecheck` · `pnpm lint` all green.** **Live try-it ✅** — Freshness banner verified in the UI (v4→v5 on first load; real reasons "mix re-run · Stem S03 re-analyzed" after re-analysis; stem id read live, not hardcoded). 0.2b verified earlier (bass chords reachable via `get_stem`).
- **▶ NEXT ACTION:** **0.3 — retrieval discipline.** Trim default-dumping: `get_song_slice` / `get_midi_tracks` stop embedding every per-stem summary by default (reference the roster, drill via `get_stem`); smaller payloads on stem-agnostic questions. Seam B tests. Then **0.5 overview (cache-friendly, surface `cached_tokens`) → 0.6 prompt + parts specialist → 0.8 next-step CTAs.** All via Ask→Explain→Approve→Implement.
- **Watch-item (Freshness, low priority):** a single-stem re-analysis also surfaced "mix analysis re-run" — confirm the pipeline intends to refresh a current mix `analysis_json` row on stem analysis (expected) before treating it as over-reporting.
- **Flagged for 0.6 (approved framing):** prompt should steer the agent to *trust pitch-class content over chord labels for bass/monophonic parts* (compare bass dominant PCs to mix chord roots; reconcile teaching-vs-detected key first) and to *name* the new pitch-class fields in the tool descriptions. Data is in the tool JSON now; the explicit nudge lands with 0.6.
- **Waiting on the user:** live try-it verdict (Freshness + 0.2b), then go-ahead on 0.3.

## Read in this order (the thread)

1. **[../execution_docs/2026-06-16_maestro_slice0_fact_pack_comprehension.md](../execution_docs/2026-06-16_maestro_slice0_fact_pack_comprehension.md)** — THE Slice 0 plan: diagnosis, sub-slices 0.1–0.8, stage-wise try-it prompts, decisions, progress log.
   - **[../execution_docs/2026-06-16_maestro_fact_pack_freshness.md](../execution_docs/2026-06-16_maestro_fact_pack_freshness.md)** — Fact Pack Freshness sub-slice (staleness signal + chat UX), inserted before 0.3.
2. [maestro-coach-prd.md](maestro-coach-prd.md) — product ladder: Baseline → S1 brief → S2 sequence → S3 drill → S4 adapt → S5 arrange.
3. [maestro-agent-architecture.md](maestro-agent-architecture.md) — compounding contract, the 3 stores, the S1–S5 roadmap, testing seams.
4. [maestro-build-flow.md](maestro-build-flow.md) — Prep A/B grounding in the `werecode` schema.
5. [../execution_docs/2026-06-14_maestro-baseline-build.md](../execution_docs/2026-06-14_maestro-baseline-build.md) — how the working baseline (A+B+C) was built.

## How to resume / run

- ⚠️ **Restart the local agent after ANY `maestro/` code change** — a running `:8000` process holds stale code:
  ```bash
  cd maestro && uv run uvicorn maestro_agent.app:app --port 8000
  ```
  (If the POC "Maestro Debug Agent" is on `:8000`, stop it — `MAESTRO_AGENT_URL` defaults there.)
- **Next app:** the **user runs `pnpm dev`** (Node 22 via nvm). Do **not** launch it or a preview server.
- **Tests (Tier 1 gate, no live LLM):** `cd maestro && uv run pytest`
- **Surface:** `/app/maestro` behind `isMaestroEnabled()` (on in dev). Seeded test song: **BabySlakh Track00001**, id `efcbb636-b1e0-44f0-838a-0f868ba9366b`.
- After a `FACT_PACK_VERSION` bump, **rebuild the song's fact pack** (ensure_current auto-rebuilds on next query).

## Verification preferences (locked by the user)

- **Live try-it only**, inspection-based — **no try-it script**; the user also validates against a real guitar.
- `pytest` (Seam A/B/C) is the deterministic gate; **never call a live LLM in tests**.
- **Prompt caching matters:** OpenAI auto-caches the static prefix. Keep it stable — the 0.5 overview goes in the system prefix (not per-turn), the agent cache key gains the fact-pack version, and the usage observer must surface **`cached_tokens`** so the trace proves cache hits.

## Files changed in the data-core batch (committed `d57c69f`)

- `maestro/maestro_agent/werecode_data.py` — `_stem_info` (getStemInfo port) + `list_stems` surfaces id/label/role/tags.
- `maestro/maestro_agent/fact_pack.py` — per-stem chords/sections, `activity_by_section`, `get_stems`/`get_stem`/`get_section_activity`, `FACT_PACK_VERSION`→3.
- `maestro/maestro_agent/midi.py` — `note_activity_by_window` (merge_tracks onset bucketing).
- `maestro/maestro_agent/agent.py` — registered the 3 new tools (10 total).
- `maestro/tests/test_slice0_comprehension.py` — Seam A/B tests.

## Files changed in the 0.2b batch (working tree, NOT committed)

- `maestro/maestro_agent/midi.py` — `PITCH_CLASS_NAMES` + `dominant_pitch_classes()` helper; `note_activity_by_window` accumulates a per-window 12-bin PC histogram and emits `pitch_class_histogram` + `dominant_pitch_classes`.
- `maestro/maestro_agent/fact_pack.py` — `_stem_pitch_class_profile()` (sums section histograms); `_stem_summary` stores `pitch_class_profile`; `get_section_activity` parts carry `dominant_pitch_classes`; `_stem_detail` (get_stem) surfaces `pitch_class_profile`; `FACT_PACK_VERSION`→**4**.
- `maestro/tests/test_slice0_comprehension.py` — +6 Seam A/B tests (20/20 total).
- *(no `agent.py` change — 0.2b adds no tools, only enriches existing tool output.)*

## Files changed in the Fact Pack Freshness batch (working tree, NOT committed)

- `maestro/maestro_agent/werecode_data.py` — `analysis_signatures` + `dependency_signature` (assets + current analysis-row identities).
- `maestro/maestro_agent/fact_pack.py` — pack stores `dependency_fingerprint`; `status()` (read-only freshness check); pure `_fingerprint_reasons` + helpers; `FACT_PACK_VERSION`→**5**.
- `maestro/maestro_agent/app.py` — `GET /fact-pack/{song_id}/status`.
- `maestro/tests/test_fact_pack_freshness.py` — 11 Seam A/B tests (31/31 total).
- `src/lib/maestro/client.ts` — `getFactPackStatus` + `MaestroFactPackStatus` (server) + snake→camel mapping.
- `src/types/werecode-client.ts` — client-safe `MaestroFactPackStatus`.
- `src/app/api/maestro/fact-pack/[songId]/status/route.ts` — gated + owned status route (new).
- `src/features/maestro/MaestroClient.tsx` — stale banner + blocking send confirm + status fetching/ack.

## Boundaries to respect (from CLAUDE.md + the plan)

- Track 1 (0.1–0.7) stays inside `maestro/` (no schema/Next changes). Only **0.8** touches Next/TS.
- Workflow: **Ask → Explain → Approve → Implement.** Don't implement without explicit user approval.
- Commits: no Claude attribution; one holistic message naming the *why*. Commit only when the user asks.
- Runtime stays local Python; Modal promotion is a deferred transport swap.
