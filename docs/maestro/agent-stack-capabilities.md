# Maestro Agent Stack — Capability Ledger

> **Living doc.** The map of what the agent stack (DeepAgents + our wiring) gives us,
> read through five honest lenses: what we're **(a) using** (load-bearing today),
> what we're **(b) underusing** (touch but don't exploit), what we're **(c) overusing**
> (carry but don't yet need), what's **(d) unused/untouched** (future value — including
> *workflows-as-agents*), and the forward map (**need next / aspire / deliberately don't need**).
>
> Maintain it whenever you wire a new capability or spot framework surplus — so the
> "fight the framework vs. live with it" calls are made once, on the record, not re-litigated.
>
> **Created:** 2026-06-17 (Slice 0.6 — in lieu of trimming the DeepAgents static prompt, we *document* the surplus).
> **Expanded:** 2026-06-17 (added the (b) underusing / (c) overusing lenses, the workflow-as-agents axis, and the "QnA node in a larger flow" framing). **Owner:** Maestro build.

---

## The stack (what Maestro runs on)

- **DeepAgents** (`create_deep_agent`) — the agent loop, subagent (`task`) routing, middleware, and system-prompt assembly. The static system prefix it builds is what OpenAI prompt-caches. Full constructor surface (params we *do* and *don't* pass) is the audit basis below.
- **LangChain / LangGraph** underneath (state graph, tool nodes, message types) — the substrate for any future multi-node *workflow* (routing / orchestration / parallelization / chaining).
- **LiteLLM-backed chat model** (`maestro_agent.llm`) — OpenAI via the Responses API; model pinned through our `openai/*` allowlist. Single chokepoint for tokens/cost/instrumentation and provider switching.
- **Our wiring** (`maestro_agent.agent`) — the bounded `SongFactPack` tools, the specialists, the usage observer (`cached_tokens` surfaced), and the per-(song, model, pack-identity) agent cache.

> **The `create_deep_agent` constructor surface** (so the audit names real knobs): `model`, `tools`, `system_prompt`, `subagents`, `name` — **we pass these**. `middleware`, `skills`, `memory`, `permissions`, `backend`, `interrupt_on`, `response_format`, `state_schema`, `context_schema`, `checkpointer`, `store`, `cache`, `debug` — **we don't**. On the shelf as middleware: `AsyncSubAgentMiddleware`, `RubricMiddleware`, `MemoryMiddleware`, `FilesystemMiddleware`, `SkillsMiddleware`, `SummarizationMiddleware`.

---

## (a) ✅ Using — load-bearing today

| Capability | Where | Notes |
|---|---|---|
| **Prompt caching** of the stable prefix | OpenAI auto, preserved by us | 0.5 seeded overview rides it (baked at agent creation, not re-sent per turn); `cached_tokens` proves hits in the trace. The whole "keep the prefix stable" discipline exists to protect this. |
| **Subagents + `task` routing** (mechanism) | `_make_subagents` | structure / harmony / rhythm / **parts** / midi specialists (5). Soft prompt-level tool guidance, not hard tool-locking. *Mechanism is load-bearing; current utilization is low — see (c).* |
| **System-prompt assembly + tool-calling loop** | `create_deep_agent` | the core agent behavior; the 10 bounded `SongFactPack` tools hang off it. |
| **Per-request usage trace** | `MaestroUsageObserver` | tokens incl. `cached_tokens`, per call + summarized, ride the chat trace. **In-flight fence** (#8) closed the drain race the #7 duel exposed — the numbers are no longer lower bounds. |
| **Per-(song, model, pack) agent cache** | `_agent_cache` | so a model switch or pack rebuild doesn't reuse a stale baked-in overview. |
| **Langfuse tracing** (#8) | `maestro_agent.tracing` + `CallbackHandler` on `agent.invoke` | full run tree per turn (generations, tool calls, specialist hops) under a per-turn `trace_id`; session = conversation id, user = song owner; pack version/created_at in metadata (the story-14 fresh-vs-recall seam). Keys in `maestro/.env`; degrades to a no-op without them. |
| **User feedback loop** (#8) | `werecode.maestro_feedback` (RLS'd) + `/api/maestro/feedback` + thumbs UI | thumbs + optional note keyed to `trace_id`; durable row first, best-effort `user-thumbs` Langfuse score second. |
| **Per-turn cost guard** (#8) | `_budget_status` on the fenced observer totals | soft: `MAESTRO_TURN_BUDGET_USD` (default $0.50, `0` disables) flags over-budget turns in `trace.budget` + the Runtime rail; never blocks. |

## (b) 🟠 Underusing — we touch it, but don't exploit it

> Capabilities that *are* wired (so they show in (a)) but run at a fraction of their reach. These are the "free upside if we lean in" entries — no new dependency, just more use of what's already paid for.

| Capability | How we use it now | The unexploited reach |
|---|---|---|
| **LiteLLM chokepoint** (`maestro_agent.llm`) | one OpenAI call per turn; observer records tokens/cost (fenced). | Built to be the seam for **multi-provider routing and ensemble/voting** — still single-line opt-ins later. ~~Richer instrumentation (Langfuse)~~ → **wired at #8** (via the LangChain handler on `agent.invoke`, the seam that sees the whole run tree). |
| **The usage trace / `cached_tokens`** | captured + displayed in the Runtime rail; the **#8 budget guard acts on it** (per-turn `trace.budget` flag). | Remaining reach: cache-hit alerting and per-tool cost attribution (Langfuse now carries the raw data for both). |
| **Subagent routing** | 5 specialists registered; soft guidance. | Delegation **rarely fires** on nano single-turn QnA (0.6 live finding: the main agent answered directly). We have the routing graph but exercise ~none of it — the *orchestration* value (decompose → delegate → merge) is untapped until the verbs that need it (S2+). |
| **System prompt as the only output contract** | prose instructions; Markdown answers. | We shape behavior through the prompt but take **unstructured prose** out. `response_format` would let the same agent emit *machine-checkable structured retrieval* — the QnA-node job (see "Where this is heading"). Underused because today's surface is a chat box, not a consumer. |

## (c) 🟡 Overusing — we carry it, but don't yet need it

> Capabilities provisioned **ahead of the workload that exercises them**. Not *wrong* — most are deliberate scaffolding for Slices 1–5 — but worth naming so we don't mistake "present" for "earning its keep." The cost is mostly one-time cached-prefix tokens + surface the model must learn to ignore.

| Carried | Why it's overuse *today* | Disposition |
|---|---|---|
| **5 specialist subagent definitions** in every prefix | On nano + single-turn QnA, delegation seldom fires (0.6), so we pay prefix weight for routing machinery that mostly doesn't route. | **Keep** — it's intentional scaffolding for the orchestration verbs (S2 sequence, S3 drill, S5 arrange). Re-evaluate the *count* if the larger default model still doesn't delegate. |
| **Auto general-purpose subagent** | Auto-added (we pass no `general_purpose_subagent=...`); a competing route alongside our specialists that we never want to win. | **Documented, left on** — clean off-switch exists (`GeneralPurposeSubagentProfile(enabled=False)`) but low payoff; flip it if it ever steals a route. |
| **Default file/shell tools** (`write_todos`, `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`) | Maestro touches no files/shell → dead tools in the cached prefix. | **Document, don't strip** (0.6 call) — no clean knob (PlanningMiddleware/FilesystemMiddleware surgery is fragile across upgrades); cost is one-time cached tokens. |

## (d) ⚪ Unused / untouched — future value

> Never wired; named here so future slices reach for the framework primitive instead of re-inventing it.

### Single-agent extension points (constructor params)

| Param / middleware | What it buys | Likely slice |
|---|---|---|
| **`response_format`** | structured, machine-checkable output (the QnA-node contract; drills/concept cards). | S3+, and the reframe below. |
| **`checkpointer` + `store`** | persistent agent/graph state inside the framework. | Slice 1 alternative — current plan reuses *our fact-pack pattern* instead. |
| **`MemoryMiddleware`** | a memory substrate for the online Learner Model. | S4 (vs. a `werecode` table). |
| **`interrupt_on` (HITL)** | confirmations on high-stakes coaching actions. | aspire (see below). |
| **`RubricMiddleware`** | rubric-based grading of outputs. | the eval/LLM-judge seam (architecture §7 / S6) — cheap once outputs are structured. |
| **`SummarizationMiddleware`** | long-conversation context management (eviction/clip/summarize). | when chats outgrow the `MAX_HISTORY_*` truncation we do by hand. |
| **`cache` (BaseCache)** | response-level caching (distinct from OpenAI prompt caching). | not needed while prompt caching carries it. |
| **`skills`, `permissions`, `backend`** | skill packs, FS permissions, sandbox/execute backends. | not on the roadmap. |

### Workflows-as-agents axis (the big untapped lever)

> DeepAgents/LangGraph can compose **multiple agent steps into a workflow**, not just one tool-calling loop. We use exactly one pattern today (single agent + soft, single-level subagent routing). The four classic patterns and where each lands:

| Pattern | What it is | DeepAgents/LangGraph primitive | Our status → where it lands |
|---|---|---|---|
| **Routing** | pick the right specialist/path for a request | `task` + subagent descriptions | **Partially used** (soft, rarely fires on nano). The only workflow pattern we touch. |
| **Chaining** (prompt-chaining) | fixed multi-step pipeline: comprehend → select → brief → check | a LangGraph sequence / staged prompts | **Unused.** Slice 1's brief verb is the first real chain (architecture §6 names prompt-chaining as its primitive). |
| **Orchestration** (orchestrator–workers) | a lead agent decomposes a goal, spins workers, merges results | nested subagents / a lead graph node | **Unused.** S3 drill generator, S5 arrangement capstone. |
| **Parallelization** | run independent sub-plans concurrently (e.g. per-section) | **`AsyncSubAgentMiddleware` / `AsyncSubAgent`** | **Unused** — the framework already ships the async-subagent middleware. S2/S3 parallel section sub-plans. |

---

## Where this is heading — today's agent becomes a *QnA node*

> Architectural framing (captured 2026-06-17, sets up Slice 1).

As the agentic capability ladder climbs (S1 brief → S2 sequence → S3 drill → S4 adapt → S5 arrange), the **orchestration moves up a level** — chaining, orchestrator–workers, and parallel sub-plans become the top-level shape. In that larger flow, **today's whole agent collapses into a single role: a QnA / retrieval node.**

That reframes its mandate. The node's job is **not** "nicer chat prose" — it's **capture → filter → structure-richly**: pull the right slice of the fact pack, drop the noise, and hand back a **dense, structured, machine-consumable** answer that an orchestrator (or a brief/sequence/drill step) can build on. Concretely:

- It pushes **`response_format`** (currently (b) underused → (d) unused) toward load-bearing: the node should emit structured retrieval, not free text, once it's feeding another step rather than a human chat box.
- It recasts some of today's **(c) overuse** as *premature orchestration*: the specialist/routing machinery is provisioned for verbs that don't exist yet; when they do, that machinery moves **up** (into the orchestrator) and the QnA node underneath gets *simpler and more disciplined*, not more agentic.
- It means the highest-value near-term work on the current agent is **sharper capture/filter/structure** (the comprehension discipline Slice 0 has been building), not chat polish (why 0.8's CTA chips were deferred).

*Not scheduled work — a lens.* When Slice 1 lifts `get_section_activity` into the Comprehension Graph with an LLM interpretation step, that interpretation step is the first place this QnA-node shape gets real: structured nodes out, not prose.

---

## 🔜 Need — load-bearing soon, per the PRD ladder

- **Slice 1 — a persistent Comprehension Graph store** (build / ensure_current / version / hash-invalidate). Current plan reuses *our fact-pack pattern*, not DeepAgents `checkpointer`/`store` — but those are the framework alternative if we ever want graph state inside the agent. Slice 1 also introduces the first **chain** (comprehend → brief → check).
- **S3+ — structured output** (`response_format`) for drills / concept cards that must be machine-checkable — and, per the reframe above, for the QnA node's own retrieval contract.
- **S4 — Learner Model online**: DeepAgents `MemoryMiddleware` is a candidate substrate (vs. a `werecode` table).

## 🌟 Want / aspire — valuable, not scheduled

- **HITL (`interrupt_on`)** — confirmations on high-stakes coaching actions.
- **Async / parallel subagents (`AsyncSubAgentMiddleware`)** — parallel section sub-plans for S2/S3 orchestration (orchestrator–workers). The middleware is already on the shelf.
- **Structured `response_format` + `RubricMiddleware`** as the eval seam (architecture §7 defers the LLM-judge; structured answers + a rubric make it cheap later).

## 🚫 Don't need — deliberately out, for now

- **File/shell tools + general-purpose subagent** — surplus (see (c)). **Decision (0.6): document, don't strip.** The general-purpose subagent *has* a clean off-switch but we leave it for consistency + low payoff; the file tools have *no* clean switch and the cost is one-time cached-prefix tokens. Revisit only if either competes for routing or the prefix bloats meaningfully.
- **Sandbox/`execute` backend** — no code execution in Maestro.
- **DeepAgents default model** — we pin OpenAI via the allowlist; never rely on the framework default.

---

## How to maintain this ledger

1. Wire a new capability → move it from **(d) unused / Need / Want → (a) using**.
2. Use a wired capability harder (e.g. turn on `response_format`, add a provider) → move it from **(b) underusing → (a) using**.
3. Spot framework surplus we carry → log it under **(c) overusing** (or **(d) unused**) with the disable knob if you found one, and a one-line *why we keep it*.
4. Decide to live with surplus → record the call (and *why*) under **Don't need**, so it isn't re-argued.
5. Keep it honest: this is the load-bearing-vs-underused-vs-overused-vs-aspired map, not a feature wishlist.
