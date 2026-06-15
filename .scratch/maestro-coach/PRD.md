# Maestro Coach — Product PRD (staged for `/to-issues`)

> **Canonical copy:** [`docs/maestro/maestro-coach-prd.md`](../../docs/maestro/maestro-coach-prd.md).
> This `.scratch/` entry is a **thin pointer** so the Maestro coach PRD lives alongside the other feature PRDs (e.g. `.scratch/current-app-baseline/PRD.md`) and can be sliced into issues with `/to-issues`. **Edit the canonical copy in `docs/maestro/`, not this file** — keeping content here would drift.

## What this is

The forward-looking **Maestro / MusicCoach** coach: the evolution of the song Q&A analyst into a compounding guitar-learning coach. The current-app baseline (`.scratch/current-app-baseline/PRD.md`, story 55) deferred Maestro to "a later PRD." **This is that later PRD** — read it in full at [`docs/maestro/maestro-coach-prd.md`](../../docs/maestro/maestro-coach-prd.md).

## Companion design docs (read before slicing)

- [`docs/maestro/maestro-agent-architecture.md`](../../docs/maestro/maestro-agent-architecture.md) — how the coach works and how to think when building (the load-bearing alignment).
- [`docs/maestro/maestro-build-flow.md`](../../docs/maestro/maestro-build-flow.md) — the non-agentic prep (Prep A data foundation, Prep B agent UI + `isMaestroEnabled()`) that must precede the agentic slices, grounded against this codebase.

## When ready to slice

The prep work (Prep A / Prep B in the build-flow doc) is sequenced **before** the S1–S5 capability slices. Slice from the canonical PRD's capability stages + the architecture doc's vertical-slice roadmap; respect the build-flow's "Prep A is the hard dependency for everything."
