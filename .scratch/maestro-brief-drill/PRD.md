# Maestro — Section Briefing (`brief`) + `drill`, on the Comprehension Graph

**Status:** ready-for-agent
**Feature slug:** `maestro-brief-drill`
**Branch:** `maestro/agent-buildout`
**Source:** grilling session (capability-first roadmap) + `docs/maestro/maestro-domain-model.md` + `docs/maestro/maestro-agent-architecture.md` (§4, §6, §9) + ADR-0001.

> Reconciliations with the load-bearing architecture doc are recorded explicitly in **Implementation Decisions** (lazy-vs-eager population; `drill` before the S2 sequencer with a light drill). If implementation reveals a contradiction with `maestro-agent-architecture.md` principles, stop and reconcile.

## Problem Statement

Today Maestro is a single-song, read-only, reactive Q&A loop. When a guitarist asks "walk me through the chorus," the agent decides live — differently each time — which fact-pack tools to call and how deep to drill, then answers in disposable prose. Three problems follow:

- **It's unreliable.** The retrieval path is emergent, so it sometimes silently drops a part (it has "gestured at per-stem harmony but never drilled the stem") and gives uneven depth on repeat asks.
- **It doesn't remember.** Every answer is recomputed from raw facts and thrown away, so nothing the coach understands about a song accumulates.
- **It can't build on itself.** Because understanding isn't persisted as structured, grounded knowledge, no higher coaching behavior (drills, sequencing, arrangement) can stand on a lower one.

The learner experiences a chatbot that *reads analysis*, not a coach that *understands a song* and gets better at coaching it.

## Solution

Introduce the coach's first real capability, **`brief`**, and its durable substrate, the **Comprehension Graph**; then prove the substrate compounds by adding a second capability, **`drill`**, that *composes on* `brief`.

- **`brief`** answers "brief the chorus for a guitarist" by running a *deterministic Section×Role rollup* over the fact pack (**the formula**) plus exactly **one** LLM *interpretation* pass (**the judgment**), producing a structured, grounded **Section×Role node** (`data + evidence + confidence + interpretation`) — not disposable prose.
- The node is written to the **Comprehension Graph**, a per-song durable store mirroring the existing fact-pack service. Re-asking recalls it; a fact-pack rebuild invalidates it. The graph **densifies as the learner explores**.
- **`drill`** ("give me an exercise for this bridge") reads the *same* Comprehension Graph — filling a cold region by calling `brief`'s formula — and adds drill-specific judgment. This makes compounding real: enrich the shared substrate once and **both** verbs level up.

From the learner's seat: the chorus brief is the same complete, grounded, inspectable thing every time; the coach remembers it; and asking for a drill produces an exercise built on that understanding.

## User Stories

1. As a guitarist learner, I want to ask "brief the chorus for a guitarist" and get a per-section breakdown of what each part plays and what I should focus on, so that I know what to practice without parsing raw analysis.
2. As a guitarist learner, I want the brief to cover every active part in the section (and flag parts it can't analyze), so that nothing important is silently dropped.
3. As a guitarist learner, I want each claim in the brief to show its evidence and confidence, so that I can trust it and know when the coach is unsure.
4. As a guitarist learner, I want the brief to separate "what the full mix does" from "what I should play on guitar," so that I'm not misled by parts I'm not playing.
5. As a guitarist learner, I want re-asking about the chorus to give the same answer (and instantly), so that the coach feels consistent and reliable.
6. As a guitarist learner, I want to ask for a practice drill for a hard section and get an exercise grounded in what's actually happening there, so that my practice targets the real difficulty.
7. As a guitarist learner, I want the coach to remember its understanding of a song across my session, so that it builds on prior context instead of restarting.
8. As a guitarist learner, when a part is generically labeled (e.g. three "Guitar" stems), I want the coach to hedge honestly rather than invent a lead/rhythm distinction, so that I'm not misinformed.
9. As a guitarist learner, when the coach genuinely can't determine something (e.g. exact fingering), I want it to say so and point me where to look, rather than fabricate.
10. As a developer in the sandbox, I want to select a song and see the brief rendered as a structured object (per-role rows with evidence/confidence), not just prose, so that I can verify the capability's output shape.
11. As a developer, I want the brief's deterministic rollup to be a pure, tested function, so that I can trust it independent of the model.
12. As a developer, I want the LLM interpretation step to be the only non-deterministic part, isolated behind a stub in tests, so that the suite never calls a live model.
13. As a developer, I want the Comprehension Graph persisted, versioned, and invalidated on fact-pack rebuild (reusing the fact-pack pattern), so that stored understanding never goes stale silently.
14. As a developer, I want to see in the trace whether a brief was computed fresh or served from the graph, so that I can confirm caching/compounding.
15. As a developer, I want `drill` to read the shared Comprehension Graph (never a parallel siloed rollup), so that enriching the substrate later lifts both verbs.
16. As a developer, I want asking `drill` on a never-briefed region to transparently populate the brief node first (via `brief`'s formula), so that drill always has grounded comprehension to stand on.
17. As a developer, I want `brief` and `drill` to plug in as tools the existing DeepAgents loop calls, so that no new orchestration machinery is introduced before it's needed.
18. As a developer, I want a thin scope/role guardrail, so that out-of-scope asks get an honest in-role redirect.
19. As a future capability author, I want `drill` composing on `brief` to demonstrate the composition seam, so that later capabilities (sequence, arrange) and emergent/authored workflows have a proven pattern to follow.
20. As a developer, I want the brief surface gated behind `isMaestroEnabled()`, so that it stays a dev/testing surface until app integration.

## Implementation Decisions

- **Capability-first, harness-emergent.** Build coaching capabilities directly on the existing substrate (DeepAgents loop, LiteLLM binding, usage observer, `_agent_trace`). Do **not** build a generic harness/IR/registry/promotion layer up front; extract harness seams only when a second capability makes a shared need concrete (Issue 05).
- **`brief` = formula + judgment.** The *formula* is a deterministic Section×Role rollup over the fact pack (reusing `get_section_activity` + the per-stem fields Slice 0 built). The *judgment* is exactly **one** LLM interpretation pass over the assembled, grounded skeleton. **Never a list of natural-language sub-queries** — that would reintroduce the flaky emergent retrieval Slice 0 removed.
- **Node schema.** Each node carries `data + evidence + confidence + interpretation` (architecture §4). Only the *stable* interpretation is baked in; context-dependent views stay live.
- **`brief` plugs in as a tool** (`brief_region`), not a turn-owning capability. The loop decides when to call it and narrates the result; the **durable artifact is the stored node**, which the surface renders directly (the loop's prose is not relied on to carry structure). A **router is deferred** until loop mis-routing is observed (Issue 05).
- **Lazy, cached population — reconciliation vs architecture §2/§6.** The architecture leans toward eager build-time graph population. This PRD populates nodes **lazily per explored region** and caches them, keyed by `(song, region, fact-pack version)`, reusing the `_agent_cache_key` bust-on-rebuild pattern. *Same node schema, same store, same rollup+interpret mechanism — only the trigger differs.* Eager full precompute is a **deferred optimization** (Out of Scope), revisited only when a downstream capability reads cold nodes and latency is felt.
- **Comprehension Graph store** = a new `ComprehensionGraphService` mirroring `SongFactPackService` (`build / ensure_current / query / status`, persisted + versioned + source-hash invalidated). Lands as a table in the Supabase `werecode` schema, written by the Python service via the existing data adapter. This is the **first persistence layer** and the only piece that crosses out of `maestro/`-only into the schema.
- **`drill` composes on the shared graph — reconciliation vs architecture §6 ladder.** We sequence `drill` as the **second** capability, *before* the architecture's S2 sequencer, and build the **light** drill (reads Section×Role nodes + tempo; adds drill judgment) — not the full S3 orchestrator-workers drill-template generator. `drill` reads/fills the **same** Comprehension Graph via `brief`'s formula — **never a parallel siloed rollup**. Rationale: widening to a second capability is what makes composition and the *earned* harness real, and delivers a visceral coaching win.
- **Earned harness (Issue 05).** Once `brief` + `drill` share grounding and a routing need, extract: (a) **structural grounding** — provenance auto-tagged at tool dispatch so every claim carries its source by construction, not author discipline; (b) a **router** to choose brief / drill / freeform; (c) an **evaluator stub** that flags an ungrounded or low-confidence brief. Built from observed duplication, not speculated.
- **Runtime.** Stays the local Python `:8000` service, invoked via existing `/api/maestro/*` + `MAESTRO_AGENT_URL`. Modal promotion is a deferred transport swap (unchanged from Slice 0).
- **Three memories kept distinct.** Comprehension Graph = durable *song* knowledge. Learner Model = durable *learner* knowledge (not built here). Run/task state (messages, checkpoints) = harness run-state, already provided by LangGraph. **The Comprehension Graph holds *what's true about the song*, never *what the agents are doing about it*.**

## Testing Decisions

- **What makes a good test:** assert *external behavior* at a seam, never model-internal wiring. **Never call a live LLM** — stub the interpretation step. Prior art: `maestro/tests/test_slice0_comprehension.py`, `test_fact_pack_freshness.py` (Seam A/B organization with `# --- Seam X` headers).
- **Seam A — artifact service (primary).** `ComprehensionGraphService` mirrors `SongFactPackService`. Fixture pattern: fake analysis JSON → build/populate a Section×Role node → assert node shape (`data+evidence+confidence+interpretation`), persistence, and invalidation on fact-pack rebuild. The brief **formula** (deterministic rollup, node-selection) is tested here as a **pure function**. No LLM.
- **Seam B — capability wiring.** Mirror `create_agent_runner` / `_make_tools`: monkeypatch a fake `deepagents.create_deep_agent`; assert `brief_region` / `drill_region` are registered with the correct docstrings, that `drill` reads the shared graph (and triggers `brief`'s formula on a cold region rather than a parallel rollup), and the trace shape. Message-assembly and node-selection are pure functions. No LLM.
- **Seam C — HTTP/surface.** Existing `/api/maestro/*` route handler + the `MAESTRO_AGENT_URL` chokepoint; the brief surface renders behind `isMaestroEnabled()`. Route-gating tested like the freshness status route.
- **Interpretation quality is judged by inspection, not unit tests** (architecture §9 deferral): live try-it in the sandbox + the user's real-guitar check, against the **six acceptance tests**:
  1. **Consistency** — same complete coverage on repeat.
  2. **No silent drop** — every active part appears or is flagged.
  3. **Claim-level grounding** — evidence + confidence; interpretation labeled.
  4. **Structure survives to the surface** — rendered as an object, not prose.
  5. **Compounds/cached** — recall + bust-on-rebuild.
  6. **Guitar-true under the ear** — and hedges on the seed's generic guitars.

## Out of Scope

- The **S2 learning-path sequencer** and the **full S3 drill-template generator** (orchestrator-workers, Concept Cards, Drill Templates). `drill` here is the light, compose-on-brief version.
- **Phrase / Bar / Event** graph depth (the "deepen" step). Brief and drill operate at **Section×Role only**. Deepening is the next, separate slice and is expected to lift both verbs *through the shared substrate*.
- **Eager full precompute** of all sections at song-select — deferred optimization.
- **Learner Model / personalization** (S4), proactive cues, and any learner-activity ingestion.
- **Operator tools / effectful actions** and emergent×operator workflows (ADR-0001 territory).
- **Citation UI surface** beyond the dev-flag inspection of evidence/confidence.
- **Modal promotion**, **lyrics**, **cross-song / "lifts like Song B,"** and the formal **LLM-judge eval harness**.

## Further Notes

- **Vertical tracer-bullet slices in a dependency chain:** 01 (ephemeral brief, end-to-end) → 02 (durable store) → { 03 (surface), 04 (drill) } → 05 (harden). Each is self-contained given this PRD.
- **Track 1 boundary:** 01, 04, 05 stay in `maestro/` (Python); 02 adds one `werecode` schema table; 03 is Next/TS. No Python product CRUD reintroduced (CLAUDE.md backend boundary).
- **Verification preference (locked):** live try-it only, inspection-based; `pytest` is the deterministic gate; never a live LLM in tests; keep the static prompt prefix stable for caching.
- **Restart discipline:** restart the local `:8000` agent after any `maestro/` change; bump `FACT_PACK_VERSION` only when a stored field changes (the Comprehension Graph gets its own version constant).
