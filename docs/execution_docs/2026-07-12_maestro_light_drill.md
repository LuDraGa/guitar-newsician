# Maestro — Ticket #4: Light drill over brief (composed on the shared graph)

**Status:** RESOLVED (2026-07-14) — committed + pushed, #4 closed on the map.
**129/129 pytest green** (114 + 15 new); all three live try-it legs passed
against the running `:8000` (cold chorus drill by the user in the UI; warm
recall + cross-verb compounding agent-driven): warm drill = **exactly ONE
`gpt-5.5` call** (`drill-judgment` only, $0.136/45s chorus · $0.081/34s
verse), `brief_source: graph_recall` both times; fresh verse brief
($0.079/30s, persisted) → verse drill rode it for free. Loop windows in the
drill match the brief's own section times — read from the store, not
recomputed. Frontier advanced to #5 + #9.
**Ticket:** [maestro-brief-drill 04](https://github.com/LuDraGa/guitar-newsician/issues/4) · map [#6](https://github.com/LuDraGa/guitar-newsician/issues/6)
**Branch:** `maestro/agent-buildout`
**Blast radius:** `maestro/` only — no schema change, no Next/TS change (Track 1). Tool count 11 → 12; one additive system-prompt line (rides the cached prefix).
**Sources:** PRD (`.scratch/maestro-brief-drill/PRD.md` stories 6, 15, 16) · architecture §6 · #1's `brief.py` · #2's `comprehension_graph.py` + exec doc (the `ensure_current`/`query` composition seam was locked there for exactly this ticket)

## What this slice is

The second coaching verb: `drill_region(region)` → a practice exercise for a
region, **composed on the shared Comprehension Graph**. Drill reaches the
region's comprehension exclusively through
`ComprehensionGraphService.ensure_current` — a **cold** region is populated by
`brief`'s formula + judgment first (persisting the brief node as a side
effect: the compounding win), a **warm** region recalls with no brief judgment
pass — then adds **drill-specific judgment** (what to loop, at what tempo,
what to focus on) grounded in the brief node's rows.

This is the **light** drill (Section×Role + tempo) — NOT the S3
orchestrator-workers drill-template generator. Demoable: "drill the bridge" →
an exercise that cites what's actually happening there.

## Locked decisions (user-approved 2026-07-12)

1. **Drill judgment model = the brief model** (`Settings.brief_model`, `gpt-5.5`
   per #7's verdict). No new setting. Cost watch-item for #16: a COLD drill
   pays brief judgment + drill judgment back-to-back (~$0.25+/~80s); warm
   regions pay only the drill pass.
2. **Drill output is ephemeral but node-shaped.** The exercise node mirrors the
   brief node (`data + evidence + confidence + interpretation`, `region`,
   `source`, pack identity) but is **not** persisted — no second `node_type`
   row, no schema change. The persisted artifact is the **brief** node
   underneath (via `ensure_current`). Turning drill persistence on later is a
   one-seam add (a `section_role_drill` upsert mirroring brief's); it's
   recorded as fog on the map, graduating at S3 or when cold-drill latency is
   felt.
3. **"No parallel rollup" is structural.** `drill.py` never imports
   `build_brief_skeleton` / the formula internals — its only inputs are the
   brief NODE and the graph service. A Seam B test asserts the module source
   is clean of the rollup symbols (story 15/16).
4. **Judgment-pass duplication is deliberate #5 fodder.** `interpret_plan`
   mirrors `interpret_skeleton`'s try/parse/degrade shape rather than
   extracting a shared helper now — the earned harness (#5) extracts from
   observed duplication, and this is the observation.
5. **Confidence inherits from the brief node** — the drill is only as
   confident as the comprehension it stands on; `identity`/`overall` pass
   through, plus `per_claim: true` on the plan rows.
6. **`brief_source` rides the drill node** — the story-14-style seam showing
   whether the underlying brief came `computed_fresh` (cold fill) or
   `graph_recall` (warm), so the trace proves composition/compounding live.

## Design

### New module — `maestro/maestro_agent/drill.py`

Mirrors `brief.py`'s formula + judgment split:

- **`build_drill_plan(brief_node)` — the drill formula (pure, no LLM).**
  Reads only `brief_node["data"]` (the skeleton). Per matched section:
  - **loop window** = the section's `start_sec`/`end_sec` (bar-level looping
    is S3/deepening territory);
  - **focus parts** = active parts, guitar-role first (deterministic:
    guitar-role group then others, skeleton order within groups), each row
    carrying `stem_id/label/role/note_count/pitch_range/dominant_pitch_classes`
    + its evidence path;
  - **chords to practice** = the section's mix progression (already
    windowed + truncated by the brief formula);
  - **cautions** = every flagged part passes through, never dropped:
    `unanalyzable`/`unmeasured_here` rows carry their original `flag`;
    `generic_label` rows carry an identity hedge. Each caution keeps
    `stem_id` + evidence.
  - **tempo ladder** = 60/75/90/100% of the pack bpm (rounded); a missing bpm
    yields `tempo_ladder: None` + a caution — abstain, never fabricate.
  - **`brief_context`** = the brief interpretation's per-section
    `mix_story/guitar_focus/hedges/abstentions` when its status is ok
    (grounded input for the drill judgment; omitted when unavailable — the
    deterministic plan stands alone).
- **`DRILL_JUDGMENT_INSTRUCTIONS` + `interpret_plan(plan, judge, model)` —
  exactly ONE LLM pass.** Output JSON:
  `{"summary", "exercises": [{"section_index", "focus", "steps", "tempo_advice", "hedges", "abstentions"}]}`.
  Rules mirror brief's: ground every statement in plan rows, cite stem_ids,
  hedge on `generic_label`, abstain-and-point on flags, never fabricate
  fingering/voicings. Parse best-effort via brief's `_parse_judgment`;
  failure degrades to `status: unavailable`, never raises.
- **`build_drill_node(brief_node, region, interpret)`** — passes through an
  unknown-region error node untouched (abstain-and-point); otherwise
  assembles the node-shaped result: `node_type: section_role_drill`,
  `source: computed_fresh`, `ephemeral: True`, region + pack identity from
  the brief node, `brief_source`, `data` = plan, inherited confidence,
  `interpretation` = drill judgment.

### `brief.py` — one tiny change

`make_judgment(model, run_name="brief-judgment")` gains the `run_name`
parameter so drill's pass lands in the Langfuse turn trace as
`drill-judgment` (same LiteLLM chokepoint → the fenced usage observer prices
it into the turn budget automatically).

### `agent.py` — wiring

- `drill_region(region)` tool (count 11 → 12), body mirroring `brief_region`:
  lazily builds `ComprehensionGraphService`, gets the brief node via
  `ensure_current` (cold-fill seam), then runs the drill formula + judgment.
  Wrapped in `_safe_fact_query`.
- One additive system-prompt line: "give me a drill / exercise / how should I
  practice <section>" asks → call `drill_region` ONCE and answer from the
  node, keep hedges/abstentions visible.

### Tests — `maestro/tests/test_drill.py` (no live LLM, per the locked seams)

- **Seam A (pure formula):** deterministic on repeat; tempo ladder from bpm
  132 → 79/99/119/132; missing bpm → no ladder + caution (abstention, not
  fabrication); focus = active parts guitar-first; flags/hedges pass through
  never dropped (S09 unanalyzable, the untagged Guitar twins); plan rows
  carry evidence.
- **Seam A (judgment):** parse + degradation mirror brief's (`interpret_plan`
  with stub judges; failure → `unavailable`, never raises).
- **Seam B (node + composition):** node shape + inherited confidence;
  unknown-region error passes through; **cold fill runs brief's judgment
  exactly once and persists the brief node; a second drill on the same region
  recalls (`brief_source: graph_recall`, brief interpreter still at 1 call)**
  — reusing #2's `_FakeGraphData`/`_FakeFactPack`/`_CountingInterpreter`
  fakes; **module-source assertion: `drill.py` contains no
  `build_brief_skeleton`/`_section_entry`** (no parallel rollup path exists —
  story 15/16); `drill_region` registered with scoped docstring + bound on
  the agent graph (mirrors brief's registration tests).

### Ledger

`docs/maestro/agent-stack-capabilities.md` gains the drill line (second verb
composing on the shared substrate — the composition seam is now proven, story
19).

## Gate + verify

- `cd maestro && uv run pytest` — deterministic gate, all green before
  handoff.
- User restarts `:8000` (any `maestro/` change), then live try-it:
  1. **Cold drill** — "give me a drill for the chorus" on a rebuilt/cold
     region → trace shows ONE `brief_region`-path judgment (`brief-judgment`)
     + ONE `drill-judgment`; brief node persisted; exercise cites real
     stems/chords; the untagged guitars hedged; fingering absent →
     abstain-and-point.
  2. **Warm drill** — repeat → NO `brief-judgment` in the trace
     (`brief_source: graph_recall`), only `drill-judgment`; cheaper + faster.
  3. **Compounding demo** — "brief the chorus" first, then "drill the chorus"
     → the drill's underlying brief recalls warm (the substrate enriched by
     one verb lifts the other).
- Commit on the user's ask (holistic why-message, no AI attribution), push to
  origin immediately, then resolve #4 on the map.

## Progress log

- 2026-07-12 — Ticket claimed (assigned LuDraGa). Substrate studied
  (`brief.py`, `comprehension_graph.py`, agent wiring, #1/#2 test idioms).
  Plan approved by the user: drill judgment on `gpt-5.5` (the brief model);
  drill output ephemeral but node-shaped; #9 deferred to a different session.
  This doc written. Implementation next.
- 2026-07-12 — BUILT. `maestro_agent/drill.py` (formula + judgment + node,
  per the design above, no deviations); `brief.py`'s `make_judgment` gained
  the `run_name` param (default `brief-judgment`, so #1's behavior is
  unchanged); `agent.py` wired `drill_region` (tool count 11 → 12) + the
  additive system-prompt drill line; `tests/test_drill.py` = 15 tests across
  the locked seams, reusing #1's `_pack`/`_stub_interpret` and #2's fakes —
  including the cold-fill-once-then-recall composition test and the
  structural no-parallel-rollup source assertion. Capability ledger gained
  the drill row (+ the graph-store row #2 had missed). **129/129 pytest
  green.** Next: user restarts `:8000` → live try-it legs 1–3 above.
- 2026-07-14 — LIVE-VERIFIED, all three legs. (1) Cold chorus drill (user, in
  the UI): exercise cited real stems (S08 muted electric, S01 bass, S09
  drums), tempo ladder 50/62/74/83 off the real 82.7 BPM, identity hedge held
  ("not a separate lead/rhythm identity"), fingering ask
  abstained-and-pointed. (2) Warm chorus repeat (agent-driven, trace
  `992e1652…`): `brief_source: graph_recall`, ONE `gpt-5.5` call, $0.136/45s.
  (3) Fresh verse brief (trace `5f5e130c…`, `computed_fresh`, persisted,
  $0.079/30s) → verse drill (trace `1fcb7903…`): `brief_source:
  graph_recall`, ONE `gpt-5.5` call, $0.081/34s — the drill rode the brief's
  node for free; its loop windows (4.04–13.05 / 13.05–28.05 / 79.04–92.56s)
  match the brief's section times exactly. 9/9 expectations PASS.
  **Watch-item for #16 (not a #4 defect):** the nano chat seat's cold-drill
  PROSE named section indices "4, 5, 8, 9" while the stored node's real
  `section_indexes` were `[1, 4, 5, 6]` — narration imprecision; the
  structured node (what persists and what the surface renders) is
  authoritative and correct. Committed + pushed; #4 resolved on the map.
