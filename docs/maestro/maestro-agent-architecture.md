# Maestro (MusicCoach) — Agent Architecture & Build Alignment

| | |
|---|---|
| **Status** | Aligned on design · pre-implementation |
| **Date** | 2026-06-14 |
| **Origin** | Design-alignment session over the Maestro POC (`modal_apis/Maestro`) |
| **Home** | WereCode (this repo) — `docs/maestro/` |
| **Framing** | **DEV / ARCHITECTURE** — *how* the coach works and *how to think about it when building*. The product view is in [maestro-coach-prd.md](maestro-coach-prd.md); the prep/build flow is in [maestro-build-flow.md](maestro-build-flow.md). |

> **Read this first when implementing.** This is the load-bearing alignment. If a coding decision contradicts a principle here, stop and reconcile before proceeding.

---

## 1. The Compounding Thesis

Maestro is not a fixed agent with a fixed feature list. The core idea is **compounding**: the agent becomes a progressively better *coach*, and higher capabilities are built on lower ones.

"Better coach" compounds along **three knowledge axes** that accrete over time:

1. **Music knowledge** — *theory comprehension* (the coach "studies" music theory) **+ its application** to the specific song it is working with.
2. **Pedagogy** — *adaptive teaching*: variable pace, leveraging the learner's prior experience, re-representing the same concept different ways until it lands, and progressive disclosure tuned to how the learner consumes.
3. **Personalization** — a model of *this* learner, built from the **dialogue** (their queries, doubts, issues, flaws). **Not** from listening to them play.

> **Compounding is about the agent's capability maturation — not the learner's content progression.** Do not confuse "the ladder" with a syllabus the student climbs. The ladder is what the *coach* can do.

## 2. The Compounding Mechanism — Hybrid: Artifact-First, Live-When-Context-Demands

This is the single most important architectural decision. It is **not** "store-mediated vs. agent-as-tool" as a binary.

- **Stable understanding of the song compounds as durable, persisted, inspectable artifacts.** Fact pack → comprehension graph → section theory → concept cards → drill templates → arrangement maps. These are precomputed, versioned, and read back as tools.
- **Anything that depends on the current teaching moment stays live.** Choosing the right explanation, reframing on a learner's doubt, comparing two teaching paths, routing to a specialist, resolving ambiguity in the user's question ("teach it like I know blues", "make it easier for fingerstyle").

> **The durable spine is stored comprehension. The live layer is the adaptive interpreter that decides which artifacts matter, how to combine them, and when to generate a new view. The coach's skill *is* knowing which mode to be in.**

This resolves the three layers cleanly:

| Layer | Role | Lifetime |
|---|---|---|
| **Stores** | Durable memory; **where compounding accretes** | Persisted, versioned, hash-invalidated |
| **Capabilities** | A unit that *reads stores → runs an internal workflow → writes an enriched artifact back* | Per build / per request |
| **Primitives** | The compute pattern *inside* a capability (chaining, routing, parallel sectioning, voting, orchestrator–workers, evaluator–optimizer) | Per capability invocation |

**"Use the previous level as a tool"** is preserved — but the tool is a **bounded read over a persisted artifact** (exactly like today's `get_chords()` reads the fact pack), not a live nested-agent call. Live nesting (DeepAgents/LangGraph subagents) is reserved for *reasoning fan-out within* a capability (e.g. specialists writing graph sections in parallel).

**Why artifact-first for the durable spine:** compounding becomes durable, inspectable, cacheable, and cheap (no re-running lower capabilities every turn); it avoids nested-agent latency/cost/fragility.

## 3. The Three Stores

| Store | Scope | Contents | Dynamism |
|---|---|---|---|
| **Theory KB** | Global | Studied music theory the coach applies (chord construction, CAGED, voice-leading, common progressions, guitar idioms) | Mostly curated/static; least about compounding |
| **Comprehension Graph** | Per song | The typed, layered understanding of the song (see §4) | Accretes as the coach studies the song deeper; seeded from the fact pack |
| **Learner Model** | Per student | **Cross-song profile** (level, prior experience, learning rate, hand constraints, goals) + **per-(student, song) progress**; fed by dialogue | Accretes from every coaching interaction |

**Pedagogy is a *policy*, not a store.** It reads the Learner Model + Comprehension Graph and decides representation, pace, and disclosure. Near-term, "becoming a better teacher" = the Learner Model getting richer + better adaptation logic. A *cross-student* pedagogy that improves for everyone is the deferred meta-layer (§7).

> **Reality check vs. the POC:** the current system has *no* persistence for any of this — it's stateless (chat history passed per request), agents are cached per-track, and the fact pack is *rebuilt* on source-hash change, not *accreted*. **Introducing the minimal persistence layer is part of the first slice.** Compounding cannot happen until knowledge has somewhere to accumulate. *In WereCode, these three stores land as tables in the `werecode` schema (see build-flow §1, §4).*

## 4. The Comprehension Graph (the linchpin artifact)

A **typed, layered comprehension graph** — *not* a pure time-tree, and *not* a loose "everything graph."

- **Time backbone (zoomable map):** `Song → Section → 4-bar Phrase → Bar/beat → Event (note/chord)`.
- **Instrument-role as a parallel, first-class axis:** `vocals / lead / chords / bass / drums / rhythm`. Shape is **`time-level × role/layer`**. The role axis is what lets the coach answer *"what should I play on guitar here?"* vs *"what's happening in the full mix?"* — it is **not** an afterthought edge. *(This is exactly why build-flow §1 makes per-stem analysis + per-stem MIDI a hard prerequisite — the role axis has no substrate without per-stem data.)*
- **Every node carries `data + evidence + confidence + stable interpretation`** — not just data — because analysis is uncertain and conflicting. Only the *stable* interpretation is baked in; context-dependent views are generated live (§2).
- **Edges:** hierarchical (part-of), temporal (next/prev), repetition/similarity (section ≈ section), harmonic-function (this chord is the V of that key), instrument-role (this lead sits over those chords).
- **Voting lives here.** When a node is low-confidence or conflicting (e.g. detected vs. teaching key), the live layer runs N interpretations and takes consensus. The confidence-native graph is what makes voting trigger automatically — it is a technique, not a slice.

The graph is the **space** of music/pedagogy/learner knowledge at increasing aggregation; the capability ladder (§6) is the **trajectory** the coach climbs through it. They are neither identical nor orthogonal — **the ladder is a path through the graph's space.**

## 5. Agentic-Primitive Map

Primitives live *inside* capabilities. Provider/framework: LangChain DeepAgents / LangGraph + OpenAI (carry the POC's choices forward unless WereCode dictates otherwise).

| Primitive | Where it's used |
|---|---|
| **Prompt chaining** | Section briefing (comprehend question → select nodes → brief → check) |
| **Routing + decomposition** | Learning-path sequencing (route by section, decompose into ordered concepts) |
| **Parallelization — sectioning** | Generating per-section sub-plans / multiple drills in parallel, then aggregate |
| **Parallelization — voting** | Resolving low-confidence / conflicting graph nodes by consensus |
| **Orchestrator–workers** | Drill generation; arrangement (decompose by section, workers per role, aggregate) |
| **Evaluator–optimizer + memory** | Adaptive coaching loop (reflect on the learner's doubt → adjust the teaching view → update the Learner Model) |
| **Hierarchical orchestrator** | The solo-guitar arrangement capstone |

> **Where these run in WereCode (2026-06-14 study):** there is **no existing agent in WereCode** — the live capability agents are built **fresh** from the POC's DeepAgents patterns (build-flow §0). The primitives execute inside capability agents hosted as a **Modal service** (matching "Modal owns heavy compute" + the POC's Python/DeepAgents stack), invoked through a Next `/api/maestro/*` route via the `modalFetch` chokepoint. A TS-in-Next agent is the alternative; confirm at build start (build-flow §0).

## 6. The Vertical-Slice Roadmap

**Compounding contract — every slice obeys it:** *deepen the graph by one layer/axis · add one coaching verb that consumes the new depth + all prior artifacts · introduce one agentic primitive · hit one store milestone.* **Every slice ships a visibly better coach** (a slice is vertical, never pure infra).

| # | Slice | Graph / artifact added | New verb | Primitive | Compounds on | Closes gap |
|---|---|---|---|---|---|---|
| **1** | Section briefing | `Section × Role` nodes | *briefs* | prompt-chaining | fact pack | No teaching |
| **2** | Learning-path sequencer | + `Phrase / Bar` (transitions, strum slots, difficulty) | *sequences* what-to-learn-first | routing + decompose; parallel section sub-plans → aggregate | S1 | No goal sequencing |
| **3** | Drill generator | + Concept Cards, Drill Templates | *generates* practice material | orchestrator–workers; parallel sectioning | S1–2 + transpose / bar-grid / chords | No exercise generation |
| **4** | Adaptive personalization | **Learner Model online** (dialogue-fed) | *adapts* (reframe on doubt, pace, progressive disclosure) | evaluator–optimizer + memory | S1–3 | No personalization |
| **5** | Solo-guitar arrangement *(capstone)* | + `Event × Role` (lead/fills, voicings) | *arranges* multi-instrument → one guitar, easy→embellished | hierarchical orchestrator | **all of S1–4** | The aspiration |
| **(6)** | Cross-student meta *(deferred)* | — | *self-improves* across students | instrumentation + LLM-judge | sessions | No cross-student meta |

**Slice 1 in detail (the tracer bullet).** Build only the `Section × Role` layer + the **Section-Aware Guitar Briefing**: for each section — *what's happening · what role each instrument plays · what the guitarist should care about · the confidence/evidence behind it*. **Scope guardrail: no phrase/bar/event detail yet.** Slice 1 exists to prove three things end-to-end: (a) the durable **node schema** (`data + evidence + confidence + interpretation`), (b) **invalidation/versioning** (fact-pack pattern), (c) the **live retrieval → teaching path**. **Done = the agent teaches from a stored, inspectable section-role understanding instead of answering from flat facts.**

**Build mechanism for graph layers:** a build-time pass — deterministic rollup of the fact pack into nodes (reusing existing confidence fields), then an LLM interpretation step annotating each node's stable comprehension. Persist/version/invalidate by **reusing the fact-pack pattern** (latest + history snapshots, source-hash + ensure-current), stored alongside it.

**Judgment calls locked:** ① a *minimal self-reported* learner profile (beginner/intermediate + goal) may enter as early as S2 to condition sequencing; the dialogue-fed accreting Learner Model lands at S4. ② "Lead & fills" is **not** a separate slice — it's the **role-axis deepening** (section→bar→event) consumed by S3 (drills) and S5 (arrangement). ③ S4 precedes S5 so the capstone arrangement is personalized to the learner's level.

## 7. What's Explicitly Deferred (leave seams, don't build)

- **Listening to the learner play.** No audio/MIDI performance ingestion, ever, in this plan. The learner loop is dialogue-based.
- **Cross-student meta-improvement.** The coach getting better at teaching *everyone* is the desired end-state, but its instrumentation + evaluation + **LLM-as-judge** machinery is out of near-term scope. Design a seam; build per-student adaptation now.
- **Formal eval harness.** Near-term, "did it get better?" is judged by **inspection**, not a formal held-out eval pipeline. (Consequence of deferring the judge.)
- **Lyrics.** Out (see PRD).

## 8. How Today's POC Maps Forward

The POC already contains strong prior art to carry into WereCode. (Stable identifiers, not paths/lines.)

| POC element | Carries forward as |
|---|---|
| `SongFactPackService` (`build` / `ensure_current` / `query` / `_save`, `source_hashes`, latest + history snapshots) | The **template for every artifact store** — `ComprehensionGraphService` and friends mirror it exactly |
| The 7 bounded query tools (`get_sections` / `get_bar_grid` / `get_chords` / `get_key` / `get_midi_tracks` / `get_song_slice` / `transpose_song`) | The **IC-level music data** the graph's base layer rolls up; and the "bounded read = a tool" pattern for artifact access |
| `_resolve_teaching_key`, `key_conflict`, chord-fit candidate scoring | Prior art for **confidence-native interpretation** and **voting on conflicts** (detected vs. teaching key) |
| `create_agent_runner` / `_make_tools` / `_make_subagents` / `_register_maestro_profile` (excluded file tools, general-purpose subagent disabled, `task` override) | The **template for live capability agents** and tightly-scoped specialists |
| `_agent_trace` (tool calls, subagent delegations, model, usage) | The **observability** to keep — essential for the dev inspection feature flag |
| `_build_agent_messages` (bounded last-16-msgs / 6k-char history) | Today's **stand-in for the Learner Model** — replace with the real per-student store at S4 |
| Confidence fields (`meter_confidence`, `mean_conf`, `detected_key`/`teaching_key`, numeric→categorical thresholds) | Feed directly into node **evidence/confidence** |

> **The WereCode substrate these map onto (2026-06-14 study).** Stores → tables in the Supabase `werecode` schema + the 3 private buckets (`werecode-sources` / `werecode-artifacts` / `werecode-previews`) for artifact blobs (the analog of the fact pack's `_save`). Bounded reads / HTTP seams → Next `/api/maestro/*` route handlers (mirroring `/api/fact-pack/*` and `/api/agent/chat` in the POC). Heavy compute (graph build, LLM passes, capability agents) → a **Modal service behind the `modalFetch` chokepoint** (`src/lib/modal/client.ts`). Dev inspection / trace → behind **`isMaestroEnabled()`** (mirror `isPipelineEnabled()`; build-flow §2). **No existing LangGraph agent in WereCode** — capability agents are built fresh from these patterns (build-flow §0).

## 9. Testing Decisions

**What makes a good test here:** assert *external behavior* of a seam, never internal wiring of the model. Never call a live LLM in tests — stub it. Prior art is `tests/test_fact_pack.py` (POC).

**Seams (all existing, highest-level, preferred):**

- **Seam A — Artifact services (primary).** New stores (`ComprehensionGraphService`, `LearnerModelStore`, `TheoryKB`) mirror `SongFactPackService`: `build()/ensure_current()/query()`, persisted + versioned + `source_hashes`-invalidated. Test with the existing `_fixture` pattern: write fake analysis JSON → build → assert **artifact shape + persistence + invalidation**. No LLM.
- **Seam B — Live capability agents.** New capabilities mirror `create_agent_runner`/`_make_tools`: monkeypatch `sys.modules["deepagents"]` with a fake `create_deep_agent` and assert **wiring** (which graph-read tools, subagents, prompt are registered), plus deterministic **node-selection / message-assembly / trace** as pure functions. No LLM.
- **Seam C — HTTP.** New `/api/maestro/*` (graph + briefing) endpoints; in WereCode the corresponding seam is the Next route handler + the `modalFetch` chokepoint (mockable — see the baseline PRD's testing seams).

**Deferred:** the LLM-judge / eval harness (§7). Slice "leveling up" is validated by inspection near-term.

## 10. How to Think When Building (principles for implementers)

1. **Artifact-first discipline.** If something is stable understanding of the song, persist it as a versioned, inspectable artifact before teaching from it. If it depends on the live teaching moment, compute it live. When unsure, ask: *"would this be the same next session?"* — yes → artifact; no → live.
2. **Confidence-native everywhere.** Every node and every claim carries evidence + confidence. The coach is honest; uncertainty triggers voting, not bluffing.
3. **Guitar-role is first-class.** Always preserve the `× role` axis. "What should I play on guitar" must be answerable separately from "what's in the mix."
4. **Every slice ships a better coach.** No horizontal infra-only slices. A slice deepens the graph *and* adds a visible verb.
5. **Reuse the POC patterns.** The fact-pack persistence pattern and the agent-wiring/trace patterns are the templates — don't reinvent them. (But there is no WereCode agent to fork — build fresh; build-flow §0.)
6. **Respect the deferrals.** No live-performance listening; no cross-student judge; no formal eval harness — yet. Leave seams, don't build.
