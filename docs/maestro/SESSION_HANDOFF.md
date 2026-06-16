# Maestro — Session Handoff (START HERE when resuming)

> **Living pointer, maintained every working step.** Read this first, then the linked plan doc. It is the always-current overlay; the detailed progress log lives in the execution doc below.
>
> **Last updated:** 2026-06-16 · **Branch:** `maestro/agent-buildout` (off `main`)

---

## TL;DR — where we are right now

- **Working on:** Maestro **base-agent comprehension = Slice 0** — making the fact pack/agent actually *consume* the per-stem substrate Prep A landed. It's the bridge from Prep A → Slice 1 (Section × Role briefing).
- **Why:** the base agent didn't use stem info (dropped the precise identity Prep A wrote) and over/under-pulled context. Slice 1's graph is a *deterministic rollup of the fact pack*, so the fact pack must carry the role axis truthfully first.
- **Done & committed:** pre-req substrate (`04d4f79`); baseline A+B+C agent (`9659032`).
- **Done, UNCOMMITTED:** Slice 0 **data-core** — 0.1 stem identity · 0.2 per-stem detail + `get_stem` · 0.4 section activity + `get_section_activity` · `get_stems` roster. **14/14 pytest green.**
- **▶ NEXT ACTION:** **0.2b (proposed, awaiting go)** — live test surfaced that a stem with MIDI but no per-stem analysis (the bass) can't be compared to the progression because the fact pack drops note events. Fix: add **dominant pitch classes per section** (12-bin PC histogram in `note_activity_by_window`) to `activity_by_section` + `get_stem`. Then continue: **0.3 trim → 0.5 overview (cache-friendly) → 0.6 prompt + parts specialist → 0.8 next-step CTAs.**
- **Waiting on the user:** (1) go on 0.2b; (2) whether to commit the data-core as a checkpoint.

## Read in this order (the thread)

1. **[../execution_docs/2026-06-16_maestro_slice0_fact_pack_comprehension.md](../execution_docs/2026-06-16_maestro_slice0_fact_pack_comprehension.md)** — THE Slice 0 plan: diagnosis, sub-slices 0.1–0.8, stage-wise try-it prompts, decisions, progress log.
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

## Files changed in the current (uncommitted) data-core batch

- `maestro/maestro_agent/werecode_data.py` — `_stem_info` (getStemInfo port) + `list_stems` surfaces id/label/role/tags.
- `maestro/maestro_agent/fact_pack.py` — per-stem chords/sections, `activity_by_section`, `get_stems`/`get_stem`/`get_section_activity`, `FACT_PACK_VERSION`→3.
- `maestro/maestro_agent/midi.py` — `note_activity_by_window` (merge_tracks onset bucketing).
- `maestro/maestro_agent/agent.py` — registered the 3 new tools (10 total).
- `maestro/tests/test_slice0_comprehension.py` — Seam A/B tests.

## Boundaries to respect (from CLAUDE.md + the plan)

- Track 1 (0.1–0.7) stays inside `maestro/` (no schema/Next changes). Only **0.8** touches Next/TS.
- Workflow: **Ask → Explain → Approve → Implement.** Don't implement without explicit user approval.
- Commits: no Claude attribution; one holistic message naming the *why*. Commit only when the user asks.
- Runtime stays local Python; Modal promotion is a deferred transport swap.
