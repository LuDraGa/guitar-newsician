# Maestro Agent Stack — Capability Ledger

> **Living doc.** The map of what the agent stack (DeepAgents + our wiring) gives us:
> what's **load-bearing today**, what's **surplus we carry but don't use**, what we
> **need next**, what we **aspire to**, and what we **deliberately don't need**.
> Maintain it whenever you wire a new capability or spot framework surplus — so the
> "fight the framework vs. live with it" calls are made once, on the record, not re-litigated.
>
> **Created:** 2026-06-17 (Slice 0.6 — in lieu of trimming the DeepAgents static prompt, we *document* the surplus). **Owner:** Maestro build.

---

## The stack (what Maestro runs on)

- **DeepAgents** (`create_deep_agent`) — the agent loop, subagent (`task`) routing, middleware, and system-prompt assembly. The static system prefix it builds is what OpenAI prompt-caches.
- **LangChain / LangGraph** underneath (state graph, tool nodes, message types).
- **LiteLLM-backed chat model** (`maestro_agent.llm`) — OpenAI via the Responses API; model pinned through our `openai/*` allowlist.
- **Our wiring** (`maestro_agent.agent`) — the bounded `SongFactPack` tools, the specialists, the usage observer (`cached_tokens` surfaced), and the per-(song, model, pack-identity) agent cache.

## ✅ Using (load-bearing today)

| Capability | Where | Notes |
|---|---|---|
| **Prompt caching** of the stable prefix | OpenAI auto, preserved by us | 0.5 seeded overview rides it (baked at agent creation, not re-sent per turn); `cached_tokens` proves hits in the trace. The whole "keep the prefix stable" discipline exists to protect this. |
| **Subagents + `task` routing** | `_make_subagents` | structure / harmony / rhythm / midi specialists (0.6 adds **parts**). Soft prompt-level tool guidance, not hard tool-locking. |
| **System-prompt assembly + tool-calling loop** | `create_deep_agent` | the core agent behavior. |
| **Per-request usage trace** | `MaestroUsageObserver` | tokens incl. `cached_tokens`, per call + summarized. |

## 🟡 Have but NOT utilizing (surplus baked into the static prompt)

| Surplus | What it is | Disable knob (if known) |
|---|---|---|
| **Default file/shell tools** | `write_todos`, `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute` (shell). Maestro touches no files or shell → dead weight in the cached prefix + tool surface the model must learn to ignore. | **No clean knob** — they come from DeepAgents' PlanningMiddleware/FilesystemMiddleware; stripping them means reconstructing the middleware stack (fragile across upgrades). See "don't need". |
| **General-purpose subagent** | Auto-added when we don't declare one named `general-purpose`; a competing route alongside our specialists. | **Clean:** `general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False)` — then `task` still routes to *our* subagents. (Verify the import path before relying on it.) |
| **Skills, Memory, Filesystem backends, `interrupt_on` (HITL), `response_format` (structured output), `checkpointer`+`store` (persistence), async subagents** | All exposed by `create_deep_agent`, none wired. | n/a (opt-in params). |

## 🔜 Need (load-bearing soon, per the PRD ladder)

- **Slice 1 — a persistent Comprehension Graph store** (build / ensure_current / version / hash-invalidate). Current plan reuses *our fact-pack pattern*, not DeepAgents `checkpointer`/`store` — but those are the framework alternative if we ever want graph state inside the agent.
- **S3+ — structured output** (`response_format`) for drills / concept cards that must be machine-checkable.
- **S4 — Learner Model online**: DeepAgents `MemoryMiddleware` is a candidate substrate (vs. a `werecode` table).

## 🌟 Want / aspire (valuable, not scheduled)

- **HITL (`interrupt_on`)** — confirmations on high-stakes coaching actions.
- **Async / parallel subagents** — parallel section sub-plans for S2/S3 orchestration (orchestrator–workers).
- **Structured `response_format`** as the eval seam (architecture §7 defers the LLM-judge; structured answers make it cheap later).

## 🚫 Don't need (deliberately out, for now)

- **File/shell tools + general-purpose subagent** — surplus (above). **Decision (0.6): document, don't strip.** The general-purpose subagent *has* a clean off-switch but we leave it for consistency + low payoff; the file tools have *no* clean switch and the cost is one-time cached-prefix tokens. Revisit only if either competes for routing or the prefix bloats meaningfully.
- **Sandbox/`execute` backend** — no code execution in Maestro.
- **DeepAgents default model** — we pin OpenAI via the allowlist; never rely on the framework default.

## How to maintain this ledger

1. Wire a new capability → move it from **Need/Want → Using**.
2. Spot framework surplus → log it under **Have-but-unused** with the disable knob if you found one.
3. Decide to live with surplus → record the call (and *why*) under **Don't need**, so it isn't re-argued.
4. Keep it honest: this is the load-bearing-vs-surplus-vs-aspired map, not a feature wishlist.
