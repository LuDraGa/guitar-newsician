# Maestro (MusicCoach) — Design Docs

Design alignment for evolving Maestro from a single-track song **Q&A analyst** into a compounding **guitar-learning coach**. This folder is the **canonical home** for the Maestro design — ported from the `modal_apis/Maestro` POC where it was worked out, and **grounded against this WereCode codebase** (the `werecode` schema, the feature-flag pattern, the Next/Supabase/Modal runtime split).

This is the forward-looking coach that the current-app baseline ([`.scratch/current-app-baseline/PRD.md`](../../.scratch/current-app-baseline/PRD.md), story 55) deferred to "a later PRD."

**Read in this order:**

1. **[maestro-coach-prd.md](maestro-coach-prd.md)** — *Product.* What Maestro is and why it matters to a guitar learner: problem, solution, capabilities, user stories, scope.
2. **[maestro-agent-architecture.md](maestro-agent-architecture.md)** — *Dev / architecture.* How it works and how to think when building: the compounding thesis, the hybrid artifact-first/live mechanism, the three stores, the typed comprehension graph, the agentic-primitive map, the S1–S5 vertical-slice roadmap, the POC→WereCode mapping, and test seams. **Start here when implementing.**
3. **[maestro-domain-model.md](maestro-domain-model.md)** — *Dev / concepts.* The behind-the-scenes conceptual model and terminology: the active/passive × generic/specific classification (HOW/WHAT/WITH-WHAT), the Task/Model/Harness trichotomy, the four growth axes, capabilities-as-formulas, curated vs emergent workflows, the proactive cue, and the grounding/citation/abstention/scope invariants. **Read this to keep the vocabulary straight.**
   - **[maestro-query-playbook.md](maestro-query-playbook.md)** — *applied (outside view).* Representative queries as the **learner experiences** them: workflow surfacing, tools/activity, answers, and flag-gated **citations**.
   - **[maestro-task-resolution.md](maestro-task-resolution.md)** — *applied (inside view).* The **same queries** traced step-by-step in domain terms (capabilities · workflows · tools · stores · invariants) — for expectation alignment. Read beside the playbook.
4. **[maestro-build-flow.md](maestro-build-flow.md)** — *Flow.* The non-agentic prep that unblocks the slices — trusted custom upload + per-stem analysis/MIDI storage, and the `/app/maestro` dev surface behind `isMaestroEnabled()` — grounded against WereCode in §§0–3, plus sequencing and a status tracker.

**One-line thesis:** the *agent* compounds into a better coach along three axes (music comprehension / pedagogy / personalization); stable song understanding persists as inspectable artifacts, adaptive teaching stays live, and each vertical slice ships a visibly better coach.

**Related in this repo:**
- The **Harness Ledger** — [agent-stack-capabilities.md](agent-stack-capabilities.md) — audits the agent stack (what we use / underuse / overuse / haven't touched).
- **Architecture decisions** — [`docs/adr/`](../adr/). [ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md): Maestro may compose emergent effectful workflows behind mandatory HITL + instrumentation.
- The product PRD is also staged at [`.scratch/maestro-coach/PRD.md`](../../.scratch/maestro-coach/PRD.md) (a thin pointer to the copy here) so it can be sliced into issues with `/to-issues`.
- The current-app baseline this builds on: [`.scratch/current-app-baseline/PRD.md`](../../.scratch/current-app-baseline/PRD.md).
- The grounding study + port record: [`docs/execution_docs/2026-06-14_maestro-docs-port-and-grounding.md`](../execution_docs/2026-06-14_maestro-docs-port-and-grounding.md).
