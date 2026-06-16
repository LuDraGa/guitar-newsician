# Maestro — Session Handoff (START HERE when resuming)

> **Living pointer, maintained every working step.** Read this first, then the linked plan doc. It is the always-current overlay; the detailed progress log lives in the execution doc below.
>
> **Last updated:** 2026-06-17 (0.5 seeded overview committed + live-verified; tool-role audit folded into 0.6 scope) · **Branch:** `maestro/agent-buildout` (off `main`)

---

## The whole ladder — where Slice 0 sits (don't lose the thread)

> Maestro's capability ladder is **Baseline → S1 brief → S2 sequence → S3 drill → S4 adapt → S5 arrange** (PRD / architecture §6). We are **still on the Baseline rung**, finishing **Slice 0** — making the agent truly *comprehend* the per-stem substrate so Slice 1's `Section × Role` graph is a clean rollup. **The real, durable coaching verbs (brief / sequence / drill / adapt / arrange) only start at Slice 1.** So: finish Slice 0's last sub-slices, then get back into the PRD slices proper.

| Rung | What it adds | Status |
|---|---|---|
| Baseline (A+B+C) | answer Q&A over the fact pack | ✅ committed |
| **Slice 0** (this work) | fact-pack **comprehension** — per-part truth + retrieval discipline | 🟢 **in progress** — 0.1 · 0.2 · 0.2b · 0.4 · 0.3 + Freshness + **0.5** committed & verified; **0.6 → (0.7 opt) → 0.8 remain** |
| Slice 1 | `Section × Role` **brief** verb + the Comprehension Graph store | ⬜ **next program milestone** (lifts 0.4's rollup into a store) |
| S2 | learning-path **sequencer** (+ Phrase/Bar) | ⬜ |
| S3 | drill **generator** (+ Concept Cards) | ⬜ |
| S4 | adaptive **personalization** (Learner Model online) | ⬜ |
| S5 | solo-guitar **arrangement** capstone (+ Event×Role) | ⬜ |
| (S6) | cross-student meta | ⬜ deferred (seam only) |

**Remaining to close Slice 0:** ~~`0.5` overview~~ (done) → `0.6` prompt + parts specialist → (`0.7` basic_stats, optional) → `0.8` next-step CTAs. **Then Slice 1 begins** — back into the PRD coaching slices proper (brief → sequence → drill → adapt → arrange). Detail + per-sub-slice status live in the Slice 0 execution doc (linked below).

---

## TL;DR — where we are right now

- **Working on:** Maestro **base-agent comprehension = Slice 0** — making the fact pack/agent actually *consume* the per-stem substrate Prep A landed. It's the bridge from Prep A → Slice 1 (Section × Role briefing).
- **Why:** the base agent didn't use stem info (dropped the precise identity Prep A wrote) and over/under-pulled context. Slice 1's graph is a *deterministic rollup of the fact pack*, so the fact pack must carry the role axis truthfully first.
- **Done & committed:** pre-req substrate (`04d4f79`); baseline A+B+C agent (`9659032`); Slice 0 **data-core** (`d57c69f`) — 0.1 stem identity · 0.2 per-stem detail + `get_stem` · 0.4 section activity + `get_section_activity` · `get_stems` roster.
- **Done & committed (`e3b9647`):**
  - **0.2b** — per-section 12-bin **pitch-class histogram** + dominant PCs in `note_activity_by_window`, surfaced on `get_section_activity` parts + a stem-level `pitch_class_profile` on `get_stem`; `FACT_PACK_VERSION`→4. So a stem with MIDI but no per-stem analysis (the bass) is comparable to the mix's chord roots.
  - **Fact Pack Freshness** — the pack stores a `dependency_fingerprint` (assets + analysis-row identities); a cheap read-only `status()` + `GET …/status` route detects when a re-analysis made the pack stale (the live finding: re-analysis didn't trigger a rebuild). Chat UI: always-on **stale banner (Update)** + **blocking send confirm (Update & send / Skip)**. `FACT_PACK_VERSION`→**5**. See [../execution_docs/2026-06-16_maestro_fact_pack_freshness.md](../execution_docs/2026-06-16_maestro_fact_pack_freshness.md). Verified live in the UI.
- **Done & committed (this session) — 0.3 retrieval discipline:** `get_midi_tracks` keeps `all_src` (mix MIDI) but swaps its per-stem dump for a `stems` **roster** + drill `hint`; `get_song_slice` swaps its `midi_tracks` full dump for a `parts` roster (**all** parts, `has_midi` visible) + `hint`. Shared `_stem_roster_entry` helper; dead `_stem_tool_summary` removed; two tool docstrings updated. **No `FACT_PACK_VERSION` bump** (query-shape change only — stored pack unchanged, no rebuild).
  - **Gate:** **34/34 pytest green.** No `pnpm` checks (Track 1, `maestro/` Python only). **Live try-it ✅** — "what key… separate for diff instruments" → trace = `get_key` + `get_stems` (roster), **no 10-stem dump**; honest "one global key, can drill a stem" answer. *Caveat:* the agent **gestured at** per-stem harmony but did **not** drill `get_stem` for the 0.2b pitch-class content unprompted → the **0.6 nudge is confirmed needed** (see below).
- **Done & committed (this session) — 0.5 seeded overview:** pure `build_song_overview`/`render_song_overview` ([fact_pack.py](../../maestro/maestro_agent/fact_pack.py)) fold a compact overview (duration · tempo+conf · key teaching/detected+conflict · section count · **parts roster** reusing `_stem_roster_entry` · available analyses · overall confidence) into the **stable `system_prompt`** at agent creation ([agent.py](../../maestro/maestro_agent/agent.py)) — rides the prompt cache, not re-sent per turn. `_agent_cache` keyed by **(song, model, pack version + created_at)** so a rebuild busts the stale baked-in overview (chose version+created_at over the literal "version only" so a *same-version re-analysis* also busts it — user-approved). `cached_tokens` (`prompt_tokens_details.cached_tokens`) now in the usage observer record + `summarize` ([llm.py](../../maestro/maestro_agent/llm.py)) so the trace proves cache hits. **No `FACT_PACK_VERSION` bump** (derived live view; no stored-pack fields). **Gate: 43/43 pytest green. Live try-it ✅** — first-message "What do you know about this song?" returned the overview verbatim (duration/tempo+conf/sections/key conflict/10-stem roster) with **~0 tool calls**; `cached_tokens > 0` to eyeball on a 2nd turn.
- **▶ NEXT ACTION (new session):** **0.6 — prompt + parts specialist.** Teach **stem-first discipline** (the roster + key headline are *already in the seeded overview* — don't re-fetch `get_stems`/`get_key` just to restate them); add a **`parts_agent`** (arrangement/role) on `get_stems`/`get_stem`/`get_section_activity` and repoint **`midi_agent`** off `get_midi_tracks` toward `get_stem`/`get_section_activity`; **demote `get_stems`** (now largely redundant post-0.5 — see the tool-role audit below); **name the pitch-class fields** (`dominant_pitch_classes`, `pitch_class_profile`) in the `get_stem`/`get_section_activity` descriptions and instruct: for per-part/monophonic key questions, drill the stem and compare its dominant PCs to the mix chord roots, reconciling teaching-vs-detected first; optional DeepAgents static-prompt trim. Then (0.7 basic_stats, optional) → 0.8 CTAs. All via Ask→Explain→Approve→Implement.
  - **Carry-over (tiny):** eyeball **`cached_tokens` > 0** on a 2nd turn to confirm the prefix caches (0.5 behavior is verified; only this cache-hit number is unconfirmed).
- **Watch-item (Freshness, low priority):** a single-stem re-analysis also surfaced "mix analysis re-run" — confirm the pipeline intends to refresh a current mix `analysis_json` row on stem analysis (expected) before treating it as over-reporting.
- **Flagged for 0.6 (approved framing):** prompt should steer the agent to *trust pitch-class content over chord labels for bass/monophonic parts* (compare bass dominant PCs to mix chord roots; reconcile teaching-vs-detected key first) and to *name* the new pitch-class fields in the tool descriptions. Data is in the tool JSON now; the explicit nudge lands with 0.6. (0.6 also owns the system-prompt + `midi_agent` stem-first rework deferred from 0.3.)
- **Tool-role audit (post-0.5, user-reviewed — input to 0.6):** the seeded overview is an *index* — it absorbed the whole-song scalars + the **roster** + the key **headline**, so three tool roles shift. **`get_stems` is now largely redundant** (the overview reproduces its output in-context every turn; residual = `tags`/`is_drum` which the prefix table doesn't render + the `nopack` fallback) → **demote** (repoint docstring; decide tags rendering) or drop; *demote recommended*. **`get_key` sharpens** to the evidence/candidates/confidence drill (headline now in the prefix). **`get_midi_tracks` narrows** to the mix-level `all_src` MIDI (its roster is duplicated) — folds into the `midi_agent` repoint. All depth tools (`get_chords`/`get_sections`/`get_bar_grid`/`get_stem`/`get_section_activity`/`get_song_slice`/`transpose_song`) are untouched and complementary.
- **Waiting on the user:** nothing blocking — **0.5 committed + verified**; the next session opens **0.6 — prompt + parts specialist**. Resume via Ask→Explain→Approve→Implement.

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

## Files changed in the 0.2b batch (committed `e3b9647`)

- `maestro/maestro_agent/midi.py` — `PITCH_CLASS_NAMES` + `dominant_pitch_classes()` helper; `note_activity_by_window` accumulates a per-window 12-bin PC histogram and emits `pitch_class_histogram` + `dominant_pitch_classes`.
- `maestro/maestro_agent/fact_pack.py` — `_stem_pitch_class_profile()` (sums section histograms); `_stem_summary` stores `pitch_class_profile`; `get_section_activity` parts carry `dominant_pitch_classes`; `_stem_detail` (get_stem) surfaces `pitch_class_profile`; `FACT_PACK_VERSION`→**4**.
- `maestro/tests/test_slice0_comprehension.py` — +6 Seam A/B tests (20/20 total).
- *(no `agent.py` change — 0.2b adds no tools, only enriches existing tool output.)*

## Files changed in the Fact Pack Freshness batch (committed `e3b9647`)

- `maestro/maestro_agent/werecode_data.py` — `analysis_signatures` + `dependency_signature` (assets + current analysis-row identities).
- `maestro/maestro_agent/fact_pack.py` — pack stores `dependency_fingerprint`; `status()` (read-only freshness check); pure `_fingerprint_reasons` + helpers; `FACT_PACK_VERSION`→**5**.
- `maestro/maestro_agent/app.py` — `GET /fact-pack/{song_id}/status`.
- `maestro/tests/test_fact_pack_freshness.py` — 11 Seam A/B tests (31/31 total).
- `src/lib/maestro/client.ts` — `getFactPackStatus` + `MaestroFactPackStatus` (server) + snake→camel mapping.
- `src/types/werecode-client.ts` — client-safe `MaestroFactPackStatus`.
- `src/app/api/maestro/fact-pack/[songId]/status/route.ts` — gated + owned status route (new).
- `src/features/maestro/MaestroClient.tsx` — stale banner + blocking send confirm + status fetching/ack.

## Files changed in the 0.3 batch (committed this session)

- `maestro/maestro_agent/fact_pack.py` — shared `_stem_roster_entry`; `get_midi_tracks` → `all_src` + `stems` roster + `hint`; `get_song_slice` → `parts` roster (all parts) + `hint`; `get_stems` refactored onto the helper; dead `_stem_tool_summary` removed.
- `maestro/maestro_agent/agent.py` — `get_midi_tracks` + `get_song_slice` tool docstrings describe roster-and-drill (no tool count change; still 10).
- `maestro/tests/test_slice0_comprehension.py` — +3 Seam B tests (roster shape, `parts` roster, shared-shape check); **34/34**.

## Files changed in the 0.5 batch (committed this session)

- `maestro/maestro_agent/fact_pack.py` — `build_song_overview(pack)` (pure compact view, parts roster reuses `_stem_roster_entry`) + `render_song_overview(overview)` (deterministic Markdown block) + helpers `_render_key_line`/`_fmt_seconds`/`_fmt_num`. No new tool; no `FACT_PACK_VERSION` bump.
- `maestro/maestro_agent/agent.py` — `{overview_block}` slot in `SYSTEM_PROMPT_TEMPLATE`; `create_agent_runner(..., pack=)` folds the overview into the static prefix via `_overview_block` (best-effort); `invoke_agent` fetches the pack once (`_safe_overview_pack`) and keys `_agent_cache` via `_agent_cache_key(song, model, pack)` = `song|model|v{version}|{created_at}` (or `…|nopack`).
- `maestro/maestro_agent/llm.py` — `MaestroUsageObserver` reads `prompt_tokens_details.cached_tokens` into each record + totals it in `summarize`.
- `maestro/tests/test_slice0_comprehension.py` — +5 Seam B (overview assembly/render variants/cache-key identity). `maestro/tests/test_usage_observer.py` — new, +4 (cached_tokens dict/object/absent + summarize). **43/43.**

## Boundaries to respect (from CLAUDE.md + the plan)

- Track 1 (0.1–0.7) stays inside `maestro/` (no schema/Next changes). Only **0.8** touches Next/TS.
- Workflow: **Ask → Explain → Approve → Implement.** Don't implement without explicit user approval.
- Commits: no Claude attribution; one holistic message naming the *why*. Commit only when the user asks.
- Runtime stays local Python; Modal promotion is a deferred transport swap.
