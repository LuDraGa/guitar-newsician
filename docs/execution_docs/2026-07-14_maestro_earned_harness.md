# Execution Doc: Maestro Earned Harness — grounding + router + evaluator stub (#5)

**Date**: 2026-07-14
**Status**: In Progress — BUILT, 163/163 pytest green; awaiting `:8000` restart + live try-it, then commit on user ask
**Owner**: Maestro build (map [#6](https://github.com/LuDraGa/guitar-newsician/issues/6), ticket [#5](https://github.com/LuDraGa/guitar-newsician/issues/5))
**Branch**: `maestro/agent-buildout`

## Objective

Extract the first **earned harness seams** from the now-observed `brief` ↔ `drill`
duplication — never from speculation:

- **(0) Shared judgment runner** — the literally-observed duplication:
  `drill.interpret_plan` deliberately mirrors `brief.interpret_skeleton`
  (same prompt-assembly → try/parse/degrade shape) and imports the private
  `_parse_judgment` across modules. #5 is the extraction point both docstrings name.
- **(a) Structural grounding** — provenance auto-tagged at tool dispatch, so every
  tool response carries its source *by construction*, not author discipline.
- **(b) Router** — a pure (no-LLM) classifier over the learner's message
  (`brief` / `drill` / `freeform`) whose verdict **nudges** the model via a
  deterministic per-turn directive line; region extracted only against the song's
  real section vocabulary.
- **(c) Evaluator stub** — a pure runtime check attaching warning flags to a
  brief/drill node (ungrounded claim, low confidence, unhedged ambiguity,
  unknown section index — the observed #4 narration defect class). Flags only,
  never blocks, never persisted.

All in `maestro/` (Python) — no Next/TS, no schema change, no new env, zero new
LLM calls.

## Context

- Ticket #5 of the maestro-brief-drill lane (PRD `.scratch/maestro-brief-drill/PRD.md`,
  "Earned harness (Issue 05)"): with `brief` + `drill` sharing grounding and a
  routing need, extract (a)/(b)/(c) — "built from observed duplication, not speculated."
- **Observed:** the judgment-pass shape duplication (drill module docstring:
  "this is the observation"); hand-authored evidence strings on every claim row;
  the #4 live watch-item — nano's *prose* misnamed section indices ("4,5,8,9" vs the
  node's real `[1,4,5,6]`) while the structured node was right.
- **Not observed:** an actual brief/drill mis-route — soft docstring routing held in
  every live try-it. Hence the router bites softly (nudge, not hard dispatch) and its
  classification + follow-through are recorded per turn so any future misfire is
  measurable evidence, not anecdote.

## Decisions Made (locked with the user, 2026-07-14)

1. **Router mode = nudge.** `route_message` classifies; on brief/drill the turn's
   user message gains one deterministic directive line ("call `drill_region` once…").
   The model can override a wrong guess — router failure is safe. Route + a
   `followed` check ride the trace.
   - *Alternatives:* shadow-mode (log only — delivers least), hard pre-dispatch
     (Python invokes the tool itself — no escape hatch on a wrong classification).
2. **Region extraction = yes, vocabulary-grounded.** The user's call: the extraction
   becomes reusable when later compounding invokes these verbs internally (no model
   in the loop). Safety property: candidates come **only** from the pack's actual
   section kinds/labels (the same vocabulary `resolve_region` accepts) plus a
   `section N` numeric pattern — a messy sentence extracts nothing and the nudge
   names just the tool. Ambiguity (two distinct regions named) → no region.
3. **Evaluator verdict = computed fresh each time.** Attached to the tool response
   at the dispatch seam (fresh *and* recalled nodes), never written to
   `maestro_comprehension_graph` — improving the checker later applies to every
   brief retroactively; no `COMPREHENSION_GRAPH_VERSION` bump.
4. **One module: `maestro_agent/harness.py`.** The four pieces are each small and
   together *are* the harness; a single module keeps the seam visible (mirrors how
   `tracing.py` owns observability).

## Plan (the locked spec)

### New module `maestro/maestro_agent/harness.py`

- [ ] **Judgment runner.** `run_judgment(instructions, payload, judge, model=None) -> dict`
      = prompt assembly (`instructions + compact-JSON payload`) → `judge(prompt)` →
      `parse_judgment` → `{kind, model?, status: ok|unavailable, …}`. Failure degrades,
      never raises (the formula half of a node stays valuable). `parse_judgment`
      (ex-`brief._parse_judgment`), `make_judgment` (the LiteLLM+Langfuse judge
      factory) and `_content_text` move here — the judgment plumbing consolidates at
      the harness; `brief.py` / `drill.py` keep their instruction strings and thin
      `interpret_skeleton` / `interpret_plan` wrappers (public signatures unchanged).
- [ ] **Grounding.** `ground(payload, *, tool, source, song_id) -> dict` stamps a
      deterministic top-level `provenance` key (`{tool, source, song_id}` — no
      timestamps, so byte-identical-repeat guarantees hold) on every dict-shaped tool
      response, error responses included. Sources: the 10 fact-pack tools →
      `song_fact_pack`; `brief_region`/`drill_region` → `comprehension_graph`.
- [ ] **Router.** `route_message(message, sections=None) -> {intent, region, matched}`
      — pure keyword classification (drill verbs: drill/exercise/practice/practise;
      brief verbs: brief/walk me through/break down/what should I play in…; drill wins
      when both; anything else `freeform`), region extracted per Decision 2.
      `route_directive(route) -> str | None` renders the nudge line (`None` for freeform).
- [ ] **Evaluator stub.** `evaluate_node(node) -> {status: ok|flagged, flags: [{code, detail}]}`
      over a brief or drill node (dispatch on `node_type`); error nodes (honest
      abstentions) are not evaluated. Checks:
      `judgment_unavailable` · `low_confidence` (overall) · `unhedged_ambiguity`
      (generic-label twins present, judgment ok, zero hedges) · `missing_abstention`
      (flagged parts present, judgment ok, zero abstentions) · `unknown_section_index`
      (interpretation references a section index outside the node's region — the #4
      defect class, at node level) · `ungrounded_claim` (a known claim row lost its
      evidence path — regression guard on the by-construction grounding).

### `maestro/maestro_agent/agent.py`

- [ ] `_make_tools`: route every tool return through a `_dispatch(tool_name, source, func, *args)`
      helper = `_safe_fact_query` + `ground(...)`; `brief_region`/`drill_region`
      additionally attach `evaluation: evaluate_node(node)` (on non-error nodes,
      as a new dict — never mutating the persisted/stored object).
- [ ] `invoke_agent`: `route = route_message(message, pack sections)` →
      `_build_agent_messages(..., directive=route_directive(route))` appends the
      nudge as a trailing line of the final user message (per-turn content — the
      cached static prefix is untouched); after the loop, `trace["router"] =
      {**route, directive, followed}` where `followed` = freeform, or the routed
      tool appears in the turn's `tool_calls`.
- [ ] `_build_agent_messages(song_id, message, history, directive=None)` — pure,
      backward-compatible default.

### `maestro/maestro_agent/brief.py` / `drill.py`

- [ ] `interpret_skeleton` / `interpret_plan` delegate to `harness.run_judgment`;
      drill's private cross-import of `_parse_judgment` from brief is gone (imports
      from harness). Module docstrings updated: the observation is now the extraction.
      Drill's structural no-parallel-rollup test constraints still hold (harness
      import is not a rollup symbol).

### Tests — new `maestro/tests/test_harness.py` (Seam B, pure, no LLM)

- [ ] `run_judgment`: fenced-JSON parse; model recorded; judge raise → `unavailable`,
      never raises. (Existing `interpret_*` tests in test_brief/test_drill stay green —
      wrappers preserved.)
- [ ] `ground`: provenance shape on success and error payloads; determinism (no
      volatile keys).
- [ ] `route_message`: drill/brief/freeform cases incl. the system-prompt phrasings;
      drill-beats-brief; region extraction against a sections fixture (kind match,
      label match, `section 3`, ambiguous two-region ask → None, no sections → None).
- [ ] `route_directive`: freeform → None; with/without region.
- [ ] `evaluate_node`: an honest seed-shaped brief node → `ok`; one case per flag
      code (incl. the `unknown_section_index` #4 regression); drill-node variants.
- [ ] Wiring: `_build_agent_messages` directive placement; `brief_region`/`drill_region`
      responses carry `evaluation` + `provenance` (reusing test_drill's fake-graph
      fixtures); fact-pack tool responses carry `provenance`; `invoke_agent` trace
      carries `router` (existing fake-deep-agent monkeypatch pattern).
- [ ] Full gate: `cd maestro && uv run pytest` — 129 existing + new, all green.

### Versions / boundaries

- No `FACT_PACK_VERSION` bump (no stored pack field). No `COMPREHENSION_GRAPH_VERSION`
  bump (stored node rows unchanged — `evaluation`/`provenance` attach after
  persistence, so fresh and recalled responses read identically). No config/env
  change. No Next/TS change (`provenance`/`evaluation` are additive JSON keys the
  existing drawers can already show).

## Acceptance criteria mapping (ticket #5)

| Criterion | How it's met |
|---|---|
| Dispatch auto-tags reads; brief/drill inherit without bookkeeping | `ground()` on all 12 tools; nodes get it at the same seam |
| Router selects brief/drill/freeform; mis-routing reduced (live try-it) | `route_message` + nudge; `trace.router.followed` makes routing measurable |
| Evaluator stub flags ungrounded / low-confidence briefs | `evaluate_node` flags, attached to every returned node |
| Seam B: router + evaluator as pure functions, no LLM | `tests/test_harness.py` |
| May split into sub-issues if too coarse | Not needed — one slice, ~4 focused pieces |

## Live try-it (user, after `:8000` restart)

1. **"Give me a drill for the chorus"** → trace `router = {intent: drill, region: chorus, followed: true}`; exactly one `drill_region` call; response node carries `evaluation` + `provenance`.
   *Expected evaluation on the seed:* `flagged` with `low_confidence` — honest, not a bug: the three generic "Guitar" twins force identity (and overall) confidence low. `unhedged_ambiguity`/`missing_abstention` should NOT fire (gpt-5.5 hedges and abstains live).
2. **"Walk me through the verse"** → brief route, one `brief_region` call, same checks.
3. **"What key is this song in?"** → `freeform`, no directive line, behavior unchanged from today.
4. Eyeball a fact-pack tool response (e.g. `get_stem`) in the runtime rail → `provenance` present.
5. Cost/latency unchanged (router + evaluator + grounding are pure Python).

## Progress Log

### 2026-07-14

**Action**: Claimed #5 on the map; loaded handoff → PRD → architecture §6 → ledger →
`agent.py`/`brief.py`/`drill.py`/`comprehension_graph.py`/`llm.py`; grilled the three
design forks with the user (router mode / region extraction / evaluator home).
**Result**: Spec above locked. Notable finding: no live mis-route has ever been
observed — the router's day-one bite is deliberately a nudge, with per-turn
follow-through measurement; the evaluator targets the defect class that *was*
observed (#4's wrong section indices in prose).
**Notes**: Awaiting implementation approval (Ask → Explain → **Approve** → Implement).

### 2026-07-14 (later)

**Action**: Approved → implemented per the locked spec. New `maestro_agent/harness.py`
(judgment runner + `parse_judgment`/`make_judgment` moved in; `ground`;
`route_message`/`extract_region`/`route_directive`/`route_followed`;
`evaluate_node` + helpers). `brief.py`/`drill.py` became thin wrappers over
`run_judgment` (drill's private cross-import of brief's parser is gone).
`agent.py`: `_dispatch` grounds all 12 tools; `brief_region`/`drill_region`
attach `evaluation` via `_evaluated` (new dict — the persisted node object is
never mutated); `invoke_agent` routes each turn, injects the nudge via
`_build_agent_messages(..., directive=)`, and records
`trace.router = {intent, region, matched, directive, followed}`.
New `tests/test_harness.py` (34 tests: runner, grounding, router intent +
vocabulary-grounded region + compound-name containment, directive/followed,
all six evaluator flag codes incl. the #4 `unknown_section_index` regression,
tool-dispatch + routed-turn wiring on the suite's existing fake patterns).
**Result**: `uv run pytest` — **163/163 green** (129 existing untouched + 34 new),
first run. No FACT_PACK_VERSION / COMPREHENSION_GRAPH_VERSION bump, no env, no
Next/TS change.
**Notes**: Try-it expectation corrected: the seed's brief node evaluates
`flagged`/`low_confidence` by design (twin guitars → identity low) — the
evaluator being visible and honest is the pass condition, not an empty flag list.

## Blockers

- None.

## References

- Ticket: https://github.com/LuDraGa/guitar-newsician/issues/5 · Map: issue #6
- PRD: `.scratch/maestro-brief-drill/PRD.md` (Implementation Decisions → "Earned harness")
- Prior art: `docs/execution_docs/2026-07-12_maestro_light_drill.md` (the observation),
  `maestro/maestro_agent/drill.py` module docstring, `maestro/tests/test_drill.py`
  (structural + wiring test patterns)
- Capability ledger to update on completion: `docs/maestro/agent-stack-capabilities.md`
  (chaining's "check" step lands; router/grounding entries)
