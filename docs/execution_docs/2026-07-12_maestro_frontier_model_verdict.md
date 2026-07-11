# Frontier-model verdict — does Maestro delegate off nano?

> **Map ticket:** [#7](https://github.com/LuDraGa/guitar-newsician/issues/7) on the [maestro-cohort-ready map (#6)](https://github.com/LuDraGa/guitar-newsician/issues/6) · **Type:** task (HITL — user runs `:8000` + judges live)
> **Status:** ✅ RESOLVED 2026-07-12 — **split verdict locked** (user call): `openai/gpt-5.5` for #1's brief judgment pass · chat stays on the picker with nano default
> **Full side-by-side (every raw answer + trace):** [committed asset](assets/2026-07-12_frontier_model_verdict_comparison.html) · [live artifact](https://claude.ai/code/artifact/a7bcc1cb-6ad7-4862-bf49-e8c54e828d71) (private to the account)
> **Branch:** `maestro/agent-buildout`

## Why this ticket exists

Every Slice-0 live try-it ran on `gpt-5.4-nano`, and specialist routing **never fired** (0.6 finding: the agent answered arrangement questions directly instead of hopping to `parts_agent`; routing is soft by design). Before #1 (ephemeral brief) builds its interpretation pass against a model, we need a verdict: on a frontier model, (1) does delegation fire, (2) how much deeper are answers, (3) what does a turn cost. The resolution locks the model — or an interpretation-vs-chat split — for the whole brief-drill lane, and feeds the specialist-roster re-evaluation fog on the map.

## Finding: the swap is zero-code

The "config-only swap" is already built — no edit needed anywhere:

- **UI picker is the lever.** `MODEL OPTIONS` in [`MaestroClient.tsx`](../../src/features/maestro/MaestroClient.tsx) (`Nano · 5.4` … `Best Pro · 5.5`) sends `openai/${modelId}` per request; `DEFAULT_MODEL_ID = 'gpt-5.4-nano'` is why all prior runs were nano.
- **Allowlist passes.** `resolve_model` ([`agent.py`](../../maestro/maestro_agent/agent.py), `ALLOWED_MODEL_PREFIX = "openai/"`) accepts every picker option.
- **Backend default is already frontier.** `maestro/.env` sets `MAESTRO_AGENT_MODEL=openai:gpt-5.5` — it only applies when a request omits `model`, which the UI never does.
- **Agent cache keys on model** (`_agent_cache_key` = song|model|pack identity), so switching the picker mid-session builds a fresh runner — no stale-prompt contamination between models.
- **Observability is in place.** Per-turn trace rail shows actions (tool calls **and** specialist `task` hops), model, latency, usage incl. `cached_tokens` and `cost_usd`; the cost ledger accumulates per song.

The only *code* candidate — flipping `DEFAULT_MODEL_ID` — is **part of the resolution**, not the experiment. It lands (or doesn't) once the verdict is in.

## Protocol (user-driven, live)

Setup: restart `:8000` (`cd maestro && uv run uvicorn maestro_agent.app:app --port 8000`), run `pnpm dev`, open `/app/maestro`, seeded song **BabySlakh Track00001**.

For **each model — A: `Nano · 5.4` (baseline re-run, captures the cost numbers 0.x sessions never recorded) and B: `Best · 5.5` (frontier)** — run one fresh chat per prompt:

| # | Prompt (canonical Slice-0 form) | Probes |
|---|---|---|
| P1 | "What key is this song in — is it separate for different instruments?" | 0.3 retrieval discipline; per-stem drill vs gesture |
| P2 | "Compare the lead vs rhythm guitar." | 0.6 arrangement question — **the** delegation bait for `parts_agent` |
| P3 | "How dynamic is this mix?" | 0.7 seeded mix-dynamics line, ~0 tool calls expected |
| P4 | "How loud is the bass, and what's its dynamic range?" | 0.7 LUFS-vs-crest honesty; `get_stem` drill |

Plus one **2-turn** conversation per model (any prompt, then a follow-up) to confirm `cached_tokens > 0` on turn 2 — closes the 0.5 carry-over.

**Record per prompt × model (from the trace rail):**

1. **Delegation** — any `task` action / specialist hop in the actions list? Which specialist?
2. **Answer depth** — your judgment, guitar in hand where relevant (esp. P2: does 5.5 resolve lead-vs-rhythm beyond nano's hedge, given the three generically-tagged guitars?).
3. **Cost & tokens** — `cost_usd`, prompt/completion/`cached_tokens`, latency per turn.

Optional escalation: if 5.5 still never delegates, one P2 run on `Best Pro · 5.5`; if 5.5 delegates but cost feels cohort-prohibitive, one P2 run on `Normal · 5.4` as the middle datapoint.

## Results (run 2026-07-12, agent-driven direct `POST :8000/chat`, fresh chat per prompt)

**Delegation: 0/10 runs on BOTH models.** No `task`/specialist hop ever — `gpt-5.5` answers arrangement questions directly with tools, same as nano. The 0.6 finding is model-independent under soft routing.

| Prompt | Nano 5.4 | Best 5.5 |
|---|---|---|
| P1 key-per-instrument | `get_key` + 2×`get_stem` · correct on Ab-teaching/Bb-detected conflict, honest per-part framing, thinner · $0.0038 · 6.6s | 4×`get_stem` · same verdict + per-stem PC table, "part roles not separate keys", practical Ab scale/chords · $0.194 (cold cache) · 22.4s |
| P2 lead-vs-rhythm | 4×`get_section_activity` + 3×`get_stem` · **compared only S00 vs S07, ignored S08 entirely**; called S00 lead / S07 rhythm · $0.0053 · 10.8s | 3×`get_stem` + `get_sections` · **considered all three guitars**; called S07 lead / S08 rhythm / S00 secondary hook, evidence tables (range, density, dominant PCs) · $0.135 · 20.5s |
| P3 mix dynamics | **re-fetched `get_song_slice`** despite the seeded overview line; wording slightly self-contradictory ("moderately dynamic… not huge contrasts" vs crest 19) · $0.0003 · 5.5s | **zero tool calls — answered from the seeded overview** (the designed 0.7 behavior), consistent interpretation · ~$0.01 (usage lost, see race) · 5.1s |
| P4 bass loudness | `get_stem` · S03 peak −8.0 / RMS −26.5 / crest 18.5, correct; **never mentioned LUFS** · $0.0003 · 3.9s | `get_stem` · same numbers, **explicitly named the missing `integrated_loudness`** ("coarse, not LUFS") · $0.0073+ · 5.6s |
| turn-2 `cached_tokens` | **13,568 ✓** (2 calls) | **6,784 ✓** (1 logged call) — 0.5 carry-over closed on both |

**The two models DISAGREE on lead-vs-rhythm** (same note-count evidence: S00=108, S07=208, S08=130): nano reads busy-S07 as rhythm "groove engine"; 5.5 reads busy-wide-range-S07 as lead. Neither is checkable against ground truth because all three guitars are generically tagged — hard, concrete evidence for **#9 stem-tag UI**.

**Cost/latency delta:** nano $0.0003–0.005/turn, 4–11s. 5.5 $0.007–0.19/turn, 5–22s — roughly **25–50× on judgment-heavy turns**, but single-retrieval turns with a warm prefix are ~$0.01. Prefix caching works on both (`cached_tokens` 6,784 = the static system prefix).

**Bonus finding — usage-observer race (feeds #8):** on ~half the runs the FINAL completion's usage record is missing (`nano_P3` logged 26 completion tokens for a ~200-token answer; `best_P3` logged **zero calls** for a full answer; `best_P4`/`best_turn2` similar). LiteLLM success callbacks fire on a background thread; `observer.drain()` right after `agent.invoke()` races them, so **recorded costs are lower bounds**. Langfuse (#8) should replace or flush-fence this path.

Raw JSON for all 10 runs: session scratchpad `frontier_run/runs/*.json` (session-local; key numbers preserved above).

## Verdict (RESOLVED 2026-07-12, user call)

- **Model locked:** **interpretation-vs-chat split.** `openai/gpt-5.5` is what [#1's](https://github.com/LuDraGa/guitar-newsician/issues/1) brief interpretation/judgment pass builds against — its edge showed up exactly there (weighed all 3 guitars where nano silently dropped S08; trusted the seeded prefix with zero tool calls; flagged the missing LUFS unprompted), and a brief's judgment pass is a one-shot cached background cost, not per-turn.
- **Interpretation-vs-chat split?** Yes. Chat stays on the UI picker with **nano default** (`DEFAULT_MODEL_ID` unchanged — no code change from this ticket): in plain chat turns the depth gap was small while 5.5 ran ~25–50× the cost and ~2× the latency — the wrong trade for a live cohort.
- **Specialist-roster implication:** delegation was 0/10 on both models → the map's roster fog graduated into [#17 Specialist roster verdict](https://github.com/LuDraGa/guitar-newsician/issues/17).
- **Side findings routed:** usage-observer race → evidence on [#8](https://github.com/LuDraGa/guitar-newsician/issues/8); lead-vs-rhythm model disagreement on generically-tagged guitars → evidence on [#9](https://github.com/LuDraGa/guitar-newsician/issues/9).

## Progress log

- **2026-07-12** — Ticket claimed on the map. Investigated the chokepoint: swap is zero-code (UI picker → `openai/*` allowlist → LiteLLM; backend default already `gpt-5.5`). Protocol + results matrix drafted; handed to the user for the live runs.
- **2026-07-12 (later)** — User delegated the run ("servers are up, easiest for you to do the run and observe"). Ran all 10 calls directly against `:8000/chat`. Results recorded above: no delegation on either model; 5.5 deeper + better retrieval discipline; ~25–50× cost on judgment turns; models disagree on lead-vs-rhythm (evidence for #9); usage-observer race discovered (evidence for #8). Awaiting the user's verdict to resolve the ticket.
