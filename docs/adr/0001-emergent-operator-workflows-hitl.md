---
status: accepted
---

# Maestro may compose emergent effectful workflows, gated by mandatory HITL + instrumentation

**Context.** Maestro's reliable core is a library of *curated* workflows — pre-authored, versioned, tested capabilities (brief, sequence, drill, arrange, operate…). But not everything can be pre-provided: learners ask things no curated path covers. To serve that long tail, Maestro is allowed to compose *emergent* workflows at runtime from harness primitives (chaining, routing, parallelization, orchestration, aggregation, evaluator-optimizer, subagents, sync/async, blocking/non-blocking) over existing capabilities and tools. Emergent composition over **retrieval** (read-only) tools is low-risk — the worst case is a bad answer, caught by a runtime evaluator. Emergent composition over **operator** (effectful) tools is the hard case: Maestro improvising a novel, irreversible action on the learner's project (loop/speed/solo/re-analyze/edit tab·sheet·MIDI).

**Decision.** Allow it — **(b)**. Maestro may compose and run emergent workflows that include operator tools, **gated by mandatory Human-in-the-Loop (HITL) confirmation on every effectful step**, a crisp proposal the learner approves/modifies/rejects before any effect, and **detailed logging + instrumentation** so any failure, misinformation, or bad action is traceable after the fact.

We deliberately do **not** cap this to read-only emergent workflows. The reasoning is the inverse of the usual one: *the guardrail is what makes the intelligence safe enough to allow.* HITL + instrumentation is the enabler, not the limit — without it we'd be forced to forbid effectful emergence, and that would cap Maestro's ceiling. Some unplanned use case may unlock a meaningful step forward for Maestro as a music agent; we keep that door open behind a gate rather than nailing it shut.

## Considered options

- **(a) Read-only emergent only** — emergent composition may touch retrieval tools only; *all* effectful actions must route through a curated, tested, gated operator capability. Safe, but caps the long tail at "answers only" and forecloses runtime discovery of new effectful coaching patterns. **Rejected** — it limits intelligence for a safety property HITL already provides.
- **(b) Emergent + operator behind mandatory HITL + instrumentation** — **chosen.**

## Consequences

- **Per effectful step, the harness must log:** the proposed action, the rationale, the inputs, the **sources/provenance** it was grounded in, the HITL decision (approved / modified / rejected), the outcome, and an **undo/reversal handle**. This instrumentation is a *precondition* — effectful emergent workflows must not be enabled before the logging exists.
- **Every emergent workflow carries a runtime evaluator** (generator-evaluator / evaluator-optimizer), because it skipped the pre-testing a curated capability gets.
- **Promotion path:** an emergent workflow that proves recurrent + valuable is promoted to a curated, versioned capability — the library grows from real usage, not only from planning.
- **Cost:** HITL friction on effectful actions (acceptable — these are the learner's project), plus the instrumentation burden carried up front.
- This is the safety spine for the **agency** and **initiative** axes in [maestro-domain-model.md](../maestro/maestro-domain-model.md); the proactive corner (initiative × agency — "I noticed you struggle → want me to set up a loop?") inherits the same HITL gate.
