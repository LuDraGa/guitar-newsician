# Maestro Traceability Lane — Langfuse + Feedback Capture + Cost Guard

**Ticket:** [#8 Traceability lane](https://github.com/LuDraGa/guitar-newsician/issues/8) on the [cohort-ready map (#6)](https://github.com/LuDraGa/guitar-newsician/issues/6)
**Branch:** `maestro/agent-buildout` · **Status:** ✅ RESOLVED — committed `91b70f1` (pushed 2026-07-12); live-verified incl. user's real turns + budget over-flag ($0.0011 > $0.001 test) reconciled against Langfuse server costs
**Why:** the capability ledger's own words — "the signal exists; the feedback loop doesn't." Before a cohort teaches us anything, every turn must leave a trace we can read, a user reaction we can join to it, and a cost number we can trust. The #7 duel also proved the current cost numbers are *lower bounds* (observer race, evidence on the ticket) — the guard can't sit on a racy path.

---

## The three pieces

### 1. Langfuse tracing (per-turn, full depth)

**Where:** the seam the ledger reserved — but note the wiring point is `agent.invoke`, not the LiteLLM callback. DeepAgents is LangGraph underneath, so Langfuse's **LangChain `CallbackHandler` (SDK v3)** passed in `config={"callbacks": [handler]}` captures the whole run tree natively: every LLM generation, every tool call, every specialist (subagent) hop — the things the ticket asks for that a flat LiteLLM callback can't see.

- New module `maestro/maestro_agent/tracing.py` (keeps `llm.py` a pure model chokepoint):
  - `langfuse_enabled()` — true iff `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` present in `maestro/.env`.
  - `build_handler()` — a `langfuse.langchain.CallbackHandler`, or `None` when disabled.
  - `new_trace_id()` — `Langfuse.create_trace_id()` when enabled, else `uuid4().hex`. **A trace id is minted every turn either way** — the feedback table keys on it even when Langfuse is off.
  - `flush()` — blocking flush after each turn (local dev service gets killed with Ctrl-C; per-request flush means no lost traces; revisit at Modal promotion #14).
  - `record_feedback_score(trace_id, verdict, comment)` — Langfuse score `user-thumbs` (BOOLEAN, comment attached); no-op when disabled.
- `invoke_agent` (`agent.py`):
  - mint `trace_id`; when enabled, wrap the invoke in `start_as_current_observation(as_type="span", name="maestro-turn", trace_context={"trace_id": trace_id})`, set trace input/output.
  - `config` gains `callbacks=[handler]` + `metadata`: `langfuse_session_id` (conversation id), `langfuse_user_id` (song owner), `langfuse_tags=[song_id, model]`, plus `pack_version`/`pack_created_at` — the seam where #1's **fresh-vs-graph-recall flag** (PRD story 14) will land as one more metadata key.
  - response `raw` gains `trace_id` (rides the existing `ChatTrace` into the client untouched).
- Plumbing for session/user: `ChatRequest` (`app.py`) gains optional `session_id` + `user_id`; the Next chat route passes `user.id` and the client's conversation id through. Langfuse then groups a learner's whole conversation as a session — exactly the cohort-observation view.
- Dep: `langfuse>=3.0` in `maestro/pyproject.toml`. Config keys live in `maestro/.env` only (`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL`); Next never sees them.
- **Graceful degradation is a hard requirement:** no keys → no handler, everything (incl. tests) runs exactly as today.

### 2. Observer race fix → trustworthy per-turn numbers

The #7 evidence: LiteLLM fires success callbacks on a background thread; `drain()` right after `agent.invoke()` races it and drops the final call's usage (~half of the 10 live runs).

- `MaestroUsageObserver` (`llm.py`) gets an **in-flight fence**: `log_pre_api_call` increments a pending counter; success/failure handlers (sync + async variants) decrement under a `threading.Condition`. `drain(wait_pending_s=2.0)` waits until pending == 0 (or timeout) before snapshotting.
- The Runtime rail and the cost guard both sit on the fenced drain — the recorded turn cost stops being a lower bound.

### 3. Cost guard (soft, surfaced)

- `Settings` gains `turn_budget_usd` from `MAESTRO_TURN_BUDGET_USD` (default **0.50** — a 5.5 judgment turn measured $0.13–0.19, so 0.50 flags runaways without nagging normal use; `0` disables).
- After the fenced drain, `invoke_agent` appends `trace["budget"] = {"limit_usd", "spent_usd", "over"}`; over-budget also logs a warning server-side.
- UI: the Runtime rail's cost chip goes warning-styled when `budget.over`, with the limit shown.
- **Soft by design today** (flag + surface, never block): whether the gate walk (#16) needs a hard per-session cap is a decision for when Langfuse data exists. The check runs post-turn — you can't know a turn's cost before running it.

### 4. Feedback capture (thumbs + flag, RLS'd)

- **SQL** `supabase/sql/2026-07-12_werecode_maestro_feedback.sql`:
  - `werecode.maestro_feedback`: `id` uuid pk · `owner_id` uuid → `auth.users` · `song_id` uuid → `werecode.songs` · `trace_id` text · `verdict` text check `('up','down')` · `comment` text · `model` text · timestamps + `set_updated_at` trigger.
  - `unique (owner_id, trace_id)` — one verdict per turn per user; re-clicking upserts (change your mind, add a comment later).
  - RLS: `maestro_feedback_owner_all` — same `owner_id = auth.uid() and werecode.is_member(auth.uid())` shape as `songs_owner_all`. Enabled day one.
- **Route** `POST /api/maestro/feedback` (new): zod-validated `{songId, traceId, verdict, comment?}` → `getWereCodeRequestContext` + `requireOwnedSong` → **upsert via the user-scoped client** (RLS enforced, not service role) → then best-effort forward to the agent's new `POST /feedback` so the verdict also lands as a Langfuse score on the trace (failure logged, never surfaced — the Supabase row is the durable record).
- **UI** (`MaestroClient.tsx`): thumbs up/down on each assistant message that carries a `trace_id`, plus an optional one-line "what went wrong/right?" text field that appears after a click. Submitted state persists in the stored conversation (survives reload). Styled per DESIGN.md chips; no layout shift.
- Note: Langfuse's stock frontend pattern (`LangfuseWeb`, public key in the browser) is **rejected** — feedback goes through our authed route into the RLS'd table; Langfuse gets a server-side copy.

## What this is NOT

- No hard spend blocking, no per-tool cost attribution, no alerting — the guard flags, humans decide.
- No eval harness / LLM-judge (map: out of scope).
- No `FACT_PACK_VERSION` bump (nothing stored in the pack changes).
- No system-prompt change (prefix cache untouched).

## Tests (deterministic gate — no live LLM, no live Langfuse)

- **Seam A:** fence behavior (delayed background success → `drain` waits; timeout path returns what it has) · budget status helper (under/over/disabled) · `new_trace_id` shape with/without Langfuse.
- **Seam B (monkeypatched `create_deep_agent`):** `raw` carries `trace_id` + `budget` · no Langfuse keys → no handler in `config` · `/feedback` app route delegates to `tracing.record_feedback_score` (monkeypatched).
- **Next:** `pnpm typecheck` + `pnpm lint`.
- Gate: `cd maestro && uv run pytest` all green.

## HITL prerequisites (user)

1. **Langfuse project** — create one (cloud region of your choice, or self-host) and drop `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` into `maestro/.env`. Everything ships dark until the keys exist.
2. **Run the SQL** (`supabase/sql/2026-07-12_werecode_maestro_feedback.sql`) in the Supabase SQL editor.
3. Restart `:8000` after the build; `pnpm dev` as usual.

## Live try-it (user-verified)

1. Two-turn chat on the seeded song → trace appears in Langfuse: nested tool calls, tokens (incl. `cached_tokens` on turn 2), cost, latency; both turns grouped under one session.
2. Runtime rail: `usage_calls` no longer drops the final completion (the #7 failure mode).
3. Thumbs-down a reply with a comment → row in `werecode.maestro_feedback` + `user-thumbs` score on the Langfuse trace.
4. Set `MAESTRO_TURN_BUDGET_USD=0.001`, one turn → budget chip flags over; restore default.

## Approved calls (2026-07-12)

- Budget default **$0.50** (`0` disables) — soft flag only.
- Thumbs **+ optional comment** (comment reaches Supabase + the Langfuse score).
- **Both** session id (conversation) and user id (song owner) pass through to Langfuse.

## Files changed

- `maestro/pyproject.toml` — `langfuse>=3.0` (resolved 4.14.0).
- `maestro/maestro_agent/tracing.py` — **new**: `langfuse_enabled` / `new_trace_id` / `build_handler` / `turn_context` (span + `propagate_attributes`) / `set_turn_io` / `flush` / `record_feedback_score`. Every path degrades to a no-op without keys; tracing can never break a turn.
- `maestro/maestro_agent/llm.py` — observer in-flight fence: `log_pre_api_call` registers, success/failure (sync + async) retire, `drain(wait_pending_s=2.0)` waits, `reset()` clears stale pending at request start.
- `maestro/maestro_agent/agent.py` — `invoke_agent` gains `session_id`/`user_id`; mints `trace_id`; wraps the invoke in `turn_context` with metadata (song, model, pack version/created_at — the story-14 seam); attaches the handler via `config`; `raw` gains `trace_id` + `budget` (`_budget_status`); over-budget logs a warning.
- `maestro/maestro_agent/config.py` — `turn_budget_usd` (`MAESTRO_TURN_BUDGET_USD`, default 0.50).
- `maestro/maestro_agent/app.py` — `ChatRequest.session_id/user_id`; **new `POST /feedback`** → `record_feedback_score`.
- `maestro/tests/test_traceability.py` — **new**, 17 tests (budget, tracing no-op paths, fence incl. the #7 race repro, Seam B invoke trace shape, `/feedback` route). **83/83 total.**
- `supabase/sql/2026-07-12_werecode_maestro_feedback.sql` — **new**: `werecode.maestro_feedback` + RLS (`songs_owner_all` shape) + `unique (owner_id, trace_id)` upsert key.
- `src/lib/maestro/client.ts` — chat passes `session_id`/`user_id`; new `sendFeedbackScore` (`/feedback` forward).
- `src/app/api/maestro/chat/route.ts` — `sessionId` in schema; passes `user.id`.
- `src/app/api/maestro/feedback/route.ts` — **new**: RLS'd upsert first, best-effort Langfuse forward second.
- `src/features/maestro/MaestroClient.tsx` — thumbs + optional-note footer on assistant messages (optimistic, rolls back on failure, persists with the conversation); budget-aware cost chip in the Runtime rail; `sessionId` sent with each turn.

## Progress log

- **2026-07-12** — Ticket claimed. Context read (handoff, ledger, `llm.py`, `agent.py`, `app.py`, chat route, MaestroClient, schema RLS patterns, #7 race evidence). Langfuse v3 LangChain-handler wiring confirmed against current docs. Plan drafted.
- **2026-07-12** — Plan approved (all four calls as recommended). Built all four pieces. Gate: **83/83 pytest** (17 new), `pnpm typecheck` + `pnpm lint` clean.
- **2026-07-12** — Keys arrived in root `.env` → copied to `maestro/.env` (the service's own env); `auth_check: True`. Best-practices audit against the Langfuse skill's baseline: all rows pass (framework integration, trace names, hierarchy, explicit I/O, session/user, feedback-as-scores).
- **2026-07-12 — LIVE TRY-IT ✅ (agent-driven, user-sanctioned; SQL run + `:8000` restarted by user).** Seeded song, nano, session `tryit-2026-07-12-traceability`:
  - **Turn 1** ("what do you know…"): overview answered with **0 tool calls**, trace `f502ad9a…`, final call captured (325 completion tokens — the #7 race would have dropped it), `budget` block present (spent $0.0019, under $0.50).
  - **Turn 2** (bass loudness/dynamics): `get_stem` drilled, S03 crest 18.5 dB kept distinct from LUFS; **`cached_tokens` 6,784 on BOTH calls** (prefix cache proven); **2/2 model calls in `usage_calls`** — the fence held on a multi-call turn.
  - **Langfuse server-side:** both traces present as `maestro-turn` — turn 2 = 11 observations (2 generations + `get_stem` tool span, full tree), session + user grouping live, metadata carries `song_id`/`model`/`pack_version`/`pack_created_at`, trace I/O = question/answer only, **server-computed cost $0.00209681 matches the fenced observer ($0.002097)**.
  - **Feedback:** `POST /feedback` → `user-thumbs` BOOLEAN score **linked to the trace with comment intact** (verify via `trace.get` / `scores.get_by_id`; the v3 scores *list* endpoint returns a slim projection with `traceId: null` — not a bug). `werecode.maestro_feedback` reachable, 0 rows (UI path pending).
  - **Left to the user:** eyeball the traces in the Langfuse UI, click thumbs in the browser (exercises the RLS'd row via the Next route). Budget over-flag live demo optional (`MAESTRO_TURN_BUDGET_USD=0.001` + restart); logic is test-covered.
  ▶ **NEXT: commit + push, then resolve [#8](https://github.com/LuDraGa/guitar-newsician/issues/8).**
