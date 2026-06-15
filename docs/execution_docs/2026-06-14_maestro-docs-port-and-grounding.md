# Maestro docs — port into WereCode + ground the build-flow against the codebase

| | |
|---|---|
| **Date** | 2026-06-14 |
| **Status** | ✅ Done — docs ported + build-flow grounded; prep work not yet started |
| **Scope** | Docs only (no product code changed). Sets up the Maestro coach build that follows. |

## Why

The Maestro / MusicCoach coach was designed in a throwaway POC (`modal_apis/Maestro`). Its three alignment docs (product PRD, agent architecture, build-flow/prep) needed to **move into WereCode** — the real build target — and the build-flow's first two sections (Data Foundation, Agent UI + dev flags) needed **grounding against WereCode's actual schema, feature flags, and runtime split** instead of assumptions carried from the POC.

## What was studied (read-only, 2026-06-14)

- `.scratch/current-app-baseline/PRD.md` — the current capability-honest product baseline.
- `supabase/sql/2026-05-25_werecode_schema.sql` — the `werecode` schema: `songs` / `song_versions` / `assets` (the `kind` enum) / `jobs` / `analysis_results` / `lyrics` / `midi_edit_sessions`, the 3 private buckets, RLS.
- `src/lib/flags.ts`, `src/components/shell/AppShell.tsx`, `src/app/app/pipeline/page.tsx` — the fenced developer-surface (Pipeline) pattern.
- `src/features/` (studio `AICoachDock`; marketing `MaestroChat` / `Concierge`), `src/lib/modal/client.ts` (`modalFetch`).

## Findings that changed the docs

1. **No agent backend exists.** `langgraph` / `langchain` / `openai` / `anthropic` / `deepagents` appear **nowhere** in `src/` or `backend/`. The "coach" is a scripted marketing chat (`MaestroChat.tsx`) + a keyword-scored concierge (`Concierge.tsx`, Octavia) + a static studio dock (`AICoachDock`). → The agent is **greenfield**; reuse POC *patterns*, not WereCode agent code. (Corrected build-flow §0/§3 + a note in architecture §5/§8 — earlier docs wrongly assumed a "base LangGraph QA agent.")
2. **The per-stem gap is precise.** Per-stem *audio* is first-class (`stem_vocals/drums/bass/other/guitar/piano` + `stems_manifest`); per-stem *analysis* and per-stem *MIDI* are **not** (`analysis_json` is full-mix; `midi`/`note_events` full-track). And stems/MIDI arrive only as **derived** artifacts of the `separate`/`midi_transcribe` jobs — there is no path to **upload trusted** stems/MIDI as sources. → Prep A scope sharpened (build-flow §1).
3. **Pipeline is the dev-surface template.** `isPipelineEnabled()` (`src/lib/flags.ts`) gates both nav (`AppShell.tsx`) and route (`src/app/app/pipeline/page.tsx`). → Mirror as `isMaestroEnabled()` + `/app/maestro`; Prep B grounded (build-flow §2).
4. **Runtime fit.** Modal owns heavy compute behind `modalFetch`; the POC is Python/DeepAgents → the agent most naturally runs as a **Modal service via `modalFetch`**, orchestrated by a Next `/api/maestro/*` route. Flagged as the open runtime decision (build-flow §0).

## What was created / changed

- **`docs/maestro/`** (canonical home) — `maestro-coach-prd.md`, `maestro-agent-architecture.md`, `maestro-build-flow.md`, `README.md`.
- **`maestro-build-flow.md`** — §§0–3, 5–6 grounded against the code above (real `werecode` schema, flags, routes, `modalFetch`).
- **`maestro-agent-architecture.md`** — §3/§4/§5/§8 given short WereCode-substrate grounding + the greenfield-agent correction.
- **`.scratch/maestro-coach/PRD.md`** — thin pointer to the canonical PRD (for `/to-issues`; no content, to avoid drift).
- **`docs/README.md`** — index pointer to `docs/maestro/`.

## Status / next

| Item | Status |
|---|---|
| WereCode study (read-only) | ✅ |
| Docs ported to `docs/maestro/` | ✅ |
| Build-flow grounded (§§0–3) | ✅ |
| `.scratch/maestro-coach/` pointer + docs index | ✅ |
| **Prep A** — trusted stem/MIDI upload + per-stem analysis/MIDI storage | ⬜ next |
| **Prep B** — `/app/maestro` surface + `isMaestroEnabled()` | ⬜ next |

**Next:** the prep work — Prep A data model (per-stem analysis/MIDI + trusted upload) and Prep B agent UI surface — per `docs/maestro/maestro-build-flow.md`.
