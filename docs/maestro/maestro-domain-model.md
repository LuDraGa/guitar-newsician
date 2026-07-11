# Maestro — Domain Model (behind-the-scenes conceptual model)

> **Living doc.** The developer-facing conceptual model for how Maestro works *behind the scenes* and how it grows over time. This is **not** the product PRD ([maestro-coach-prd.md](maestro-coach-prd.md), the *what/why* for the learner) and **not** the product glossary ([../../CONTEXT.md](../../CONTEXT.md), which is product-only and devoid of implementation). This doc is the *how it's built and reasoned about* — the terminology, the classification rules, the growth axes, and the invariants — so the model stays consistent as slices land and we stop re-litigating settled cuts.
>
> **Created:** 2026-06-27 (crystallized over a multi-session domain-modeling + grilling pass). **Owner:** Maestro build. **Maintain it** whenever a new concept resolves, a slice deepens the model, or a boundary call is made.
>
> **Read order:** this doc → [maestro-agent-architecture.md](maestro-agent-architecture.md) (the store/mode/capability architecture it extends) → [agent-stack-capabilities.md](agent-stack-capabilities.md) (the Harness Ledger) → [maestro-coach-prd.md](maestro-coach-prd.md) (the product ladder).

---

## 1. The classification core (the rule that ends the confusion)

Maestro has many moving parts and one recurring question: *is this a capability or harness or something else?* The cut never comes from asking **what does it do** — it comes from two orthogonal questions:

1. **Active or passive?** Does it *do* something, or is it *acted upon*?
2. **Generic or domain-specific?** Is it reused by every verb, or is it one specific verb?

| | **Generic** (every verb reuses it) | **Domain-specific** (one verb) |
|---|---|---|
| **Active** (does something) | **Harness** — *HOW* | **Capability** — *WHAT* |
| **Passive** (acted upon) | harness-internal state | **Tools + Stores** — *WITH-WHAT* |

**The meta-rule: classify a thing by what it _is_, not by who touches it.** A store feels ambiguous only because both a capability (writes it) and the harness (manages it as memory) touch it — but the store itself is *passive*, so it's WITH-WHAT regardless of who acts on it.

This 2×2 also **caps the "meta tower."** Any question that feels "more meta" eventually loses its domain content and becomes a budget / scheduler / router — i.e. *generic* — at which point it is **harness** (one flat floor), not a new tier. See §7.

---

## 2. The trichotomy and the harness definition

Borrowed from Anthropic's harness writing¹ and mapped to Maestro. For **any** Maestro run:

| Term | Anthropic framing | Maestro |
|---|---|---|
| **Task** | the domain objective, possibly multi-session | the coaching goal: *brief this song · arrange it · fix my practice setup · answer this* |
| **Model** | the reasoning engine | the pinned OpenAI LLM (via the `openai/*` allowlist) |
| **Harness** | scaffolding for what the model can't do alone | the loop + tools + context-mgmt + memory + guardrails + verification + observability around it |

> **The harness test:** *"every component in a harness encodes an assumption about what the model can't do on its own."*¹ Use it as the decision rule — if a thing compensates for a model limitation (context window, forgetting across sessions, self-evaluation bias, acting safely), it's harness.

The **simplicity counterweight** (also from ¹): *"find the simplest solution possible, and only increase complexity when needed"* + keep only **load-bearing** components. This is the rule that stops the harness itself from bloating once "harness" becomes a thing we're proud of.

¹ [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) · [Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)

---

## 3. Glossary

| Term | Definition | Bucket |
|---|---|---|
| **Maestro / the coach** | the product whole the learner relates to (the in-product music coach) | — (the product framing; see [CONTEXT.md](../../CONTEXT.md)) |
| **Harness** | Maestro's operational envelope; generic machinery that encodes what the model can't do alone | active + generic |
| **Capability** | one domain coaching verb (brief, sequence, drill, adapt, arrange, operate…); a **formula over entities + judgment** (§5) | active + specific |
| **Tool** | a bounded affordance the model can call. **Retrieval tools** read (idempotent); **operator tools** write/act on Octave (effectful) | passive + specific |
| **Store** | a durable, versioned artifact (fact pack, Comprehension Graph, Learner Context, environment model) | passive + specific |
| **Workflow** | an execution plan composing capabilities/tools. **Curated** (authored by us, versioned, tested) or **emergent** (composed by Maestro at runtime) | curated = a capability's impl; emergent = the agent at runtime |
| **Runtime / substrate** | the framework the harness is built *with* (DeepAgents + LangChain/LangGraph + LiteLLM). Not the harness, not a domain concept | — |
| **QnA / retrieval node** | today's tool-calling loop over the fact pack; the reactive, read-only retrieval heart. In the larger flow it becomes one node | a constrained ReAct loop |
| **Cue** | a minimal, dismissible proactive nudge surfaced from observed learner activity (the autocomplete-ghost-text analog) | an interaction; its governance is harness (§7) |

---

## 4. The growth axes (phases are per-axis, not one ladder)

Maestro's evolution is a point moving through several **orthogonal axes** — not a single line. The PRD's S1–S5 is only *one* axis (teaching depth). "Phase" is meaningless until you say *phase along which axis*.

| Axis | From → To | What grows | Today |
|---|---|---|---|
| **Teaching depth** | answer → brief → sequence → drill → adapt → arrange | how coach-like it is (the PRD ladder) | Baseline (answers); Slice 1 = brief |
| **Scope** | one song → many songs → cross-song learning | how much **Learner Context** it carries | single-song |
| **Agency** | reads analysis → **operates Octave** | whether it acts on the app | read-only |
| **Initiative** | reactive (prompted) → **proactive** (observed) | what triggers it | reactive only |
| *(dormant)* **Self-improvement** | fixed teaching → learns-to-teach-better across learners | the deferred meta-layer (arch §7) | not started |

The axes move **semi-independently** — a proactive-but-shallow Maestro (cues while practicing one song) can precede a deep-but-reactive one. The corner where **agency × initiative** both max out ("I noticed you struggle → want me to loop it?" *and it loops*) is the most powerful and most dangerous point — it inherits the [ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md) HITL gate.

**A "Slice"** is a unit of build work that advances one or more axes. The S1–S5 "stages" are positions on the *teaching-depth* axis only.

---

## 5. Capabilities as formulas over entities (the leverage model)

The central scaling insight: **you grow Maestro by enriching the substrate, not by multiplying verbs.**

> A **capability is a formula over a shared entity-relationship graph, plus judgment.** Enrich the graph's entities/relationships and *every* formula that references them levels up.

- **Formula skeleton** = the deterministic rollup over entities + relationships (e.g. `brief` over `{Section, Role}` + `{plays-over, repeats}`).
- **Judgment** = the LLM interpretation step (Slice 1's "rollup + interpret"). A capability is *not* a pure formula — enriching entities boosts the formula; it does not remove the model's judgment.

**Boost, don't grow (mostly).** Add `{Phrase, transition-difficulty}` to the graph and the *same* `brief` formula now briefs at phrase level — richer, zero new capability. The honest exception: a genuinely new verb (`arrange`) is still added occasionally; it's not the brief-formula with more entities. Over time the *ratio* shifts toward enrichment.

### Subject-domain facet (not a class hierarchy)

Capabilities are faceted by **what they operate on** — a *derived* property (read which domain-stores they touch), never an assigned bucket:

- **Song-domain** — musical content: brief, drill, arrange. Reads the *song model* (fact pack / Comprehension Graph).
- **Environment-domain** — Octave's state: operate. Reads the *environment model* (surfaces, playback state, the agent's role/permissions).
- **Learner-domain** — the learner's engagement/understanding: the attention policy, adaptive reframing, pace/disclosure. Reads *Learner Context*.

### Cross-domain = composition (do NOT build a 1/2/3-domain lattice)

Cross-domain capabilities are where the real coaching lives (*"you keep missing this → drop to 70% and loop it"* = learner × environment × song). **But they are composed, not authored as monoliths** — a workflow wiring single-domain capabilities together. Enumerating 1-domain / 2-domain / 3-domain as seven classes re-introduces the explosion; **domain-span is derived, cross-domain is composition** (→ §6).

---

## 6. Workflows: curated vs emergent

A **workflow** is an execution plan. The concepts that compose it — chaining, routing, parallelization (sectioning / voting), orchestration, aggregation, evaluator-optimizer, subagents, sync/async, blocking/non-blocking — are all **harness composition primitives** (generic, reused = HOW). They are the harness's *instruction set* for building workflows.

| | **Curated workflow** | **Emergent workflow** |
|---|---|---|
| Authored by | us | Maestro, at runtime |
| Lifecycle | versioned, tested, the reliable paved path | composed on demand for an unplanned ask; ephemeral by default |
| Is | a capability's implementation | the agent using harness primitives over existing capabilities/tools |
| Verification | pre-tested | **runtime evaluator required** (it skipped pre-testing) |

**The promotion path:** an emergent workflow that proves **recurrent + valuable** is promoted to a curated, versioned capability. The library grows from real usage, not only from planning — this is the "expansions" harness virtue made concrete, and it feeds the dormant self-improvement axis.

**The risk gradient** (the safety crux, see §9): emergent over *retrieval* tools is low-risk (+ evaluator); emergent over *operator* tools is effectful and gated by [ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md).

---

## 7. Behaviour & interaction model

| Mode | Trigger | Shape |
|---|---|---|
| **Reactive turn** (today) | a user prompt | retrieve → answer |
| **ReAct loop** | a goal / command | reason → act (tool) → observe → repeat. *Today's QnA node is already a bounded, read-only ReAct loop* — operators are the same loop with effectful tools + guardrails |
| **Proactive cue** | **observation** of learner activity (looping a bar 5×, slowing a section, stalling) | a minimal, dismissible nudge that *augments, doesn't solve* |

**Initiative is orthogonal to the verb.** The same `drill` capability runs reactive (full drill) or proactive (one-line cue). What changes is the **intensity + frequency budget — and that budget is a harness responsibility (restraint).** Reactive budget = expansive; proactive budget = crisp, rate-limited. *Anti-bombard is the harness capping the budget, not the capability shrinking itself.*

**Proactive decomposed:** `harness (surface + firing budget) + existing capabilities dialed down + exactly one new capability` — the **attention policy** ("what deserves a nudge now, and when to stay silent"), which has no reactive twin and is a **learner-domain capability** (an early cousin of the S4 adaptive layer).

**Why this doesn't tier infinitely:** every "more meta" question has two flat escape hatches — (1) it's generic governance (budget/router) → **harness**, or (2) it has real learner content → folds back into the **learner-domain capability**. There is no third option, so no Level 3. Depth is bounded at *two active layers + one flat harness floor.*

---

## 8. Invariants (what every response must honor)

These are **harness-enforced invariants**, powered by structure we already committed to — chiefly the Comprehension Graph node schema `data + evidence + confidence + interpretation`. They are not new classes.

| Invariant | Definition | Powered by |
|---|---|---|
| **Grounding** | every claim traces to a source or is explicitly flagged as interpretation; no vibes | the node schema's **evidence** field; the QnA node's capture → filter → structure discipline |
| **Citations / provenance** | typed sources surfaced per claim: *musical-concept · song-data · learner/env-state · external*. **Flag-gated on the UI** — off for most learners, on for power users / testers | a surface over the existing usage trace (the observer already records tool reads; citations *elevate* them) |
| **Response stances** | **Answer** (grounded) · **Clarify** (ambiguous) · **Abstain-and-point** (can't determine → state the limit + give direction to look) · **Refuse-in-role** (out of scope, honest redirect). **Never Fabricate.** | the **confidence** field; the runtime evaluator |
| **Scope / role guardrail** | Maestro acts within its role (guitar coach over the Songbook); out-of-scope asks get an honest in-role redirect, not a faked answer | the **role model** (part of the environment model) + harness guardrails |

**Worked stress-tests** (the queries these invariants were derived from):
- *"This chorus lifts like [other song]'s — why, and how on guitar?"* → grounds the *device* (e.g. plagal lift + register jump), cites concept + both songs' data, **abstains-and-points** if song B isn't analyzed.
- *"Fix my practice setup for this bridge."* → emergent × operator → **HITL proposal** before any effect; each step logged ([ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md)).
- *"Write me a third verse" / "Is this legal to cover?"* → **Refuse-in-role** + direction.
- *"Exact original fingering?"* → **Abstain-and-point**: has notes, not hands; offers plausible fingerings + why; a tab would confirm.

---

## 9. Safety model

- **Two tool classes, two profiles.** Retrieval tools (read-only, idempotent) need no gate. Operator tools (effectful, on the learner's project) need **confirmation/HITL, undo, rate-limit.**
- **Risk gradient for emergent composition.** Emergent × retrieval = low-risk + runtime evaluator. Emergent × operator = the dangerous corner.
- **The decision ([ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md)):** allow emergent × operator behind **mandatory HITL + crisp proposals + per-step instrumentation** (proposed action · rationale · inputs · sources · HITL decision · outcome · undo handle). *The guardrail is the enabler of the intelligence, not a limit on it.* Instrumentation is a precondition — effectful emergence ships only after the logging exists.

---

## 10. Map to existing docs & build state

| This doc's concept | Where it already lives / lands |
|---|---|
| Harness, capability, store/tool | [agent-stack-capabilities.md](agent-stack-capabilities.md) — the **Harness Ledger** (audit of what we use / underuse / overuse / haven't touched) |
| Stores · live interpreter (Modes) · capabilities | [maestro-agent-architecture.md](maestro-agent-architecture.md) §2–§4 — this doc extends them with the axes, operator tools, proactive cues, and the formula/composition framing |
| Teaching-depth axis (brief → arrange) | [maestro-coach-prd.md](maestro-coach-prd.md) — the product ladder |
| Comprehension Graph node schema (`data+evidence+confidence+interpretation`) | architecture §6 (Slice 1) — the substrate that powers §8's invariants |

**Build state:** **Slice 0 is closed** (the fact pack comprehends the full per-stem substrate; see [SESSION_HANDOFF.md](SESSION_HANDOFF.md)). The agent today is a **single-song, read-only, reactive QnA node** — the bottom-left of every axis. **Slice 1 (Section × Role briefing)** is next: the first store + the first curated chain.

---

## 11. Open questions / parking lot

- **Environment model schema** — what exactly Maestro must know about Octave's state + its own role/permissions (the substrate for operator capabilities). Undefined.
- **Citation surface** — the concrete typed-provenance format + the UI flag wiring. Named, not designed.
- **Attention policy** — the first learner-domain capability; depends on a learner-activity signal/telemetry stream that doesn't exist yet.
- **Promotion path mechanics** — how an emergent workflow gets vetted + versioned into a curated capability.
- **Instrumentation spec** — the concrete per-step log schema required before effectful emergence ([ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md)) is enabled.
