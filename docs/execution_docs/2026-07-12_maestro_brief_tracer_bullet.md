# Maestro — Ticket #1: Ephemeral Section×Role Briefing (tracer bullet)

**Status:** LIVE-VERIFIED — 101/101 pytest green; agent-driven try-it passed all
prompts (details below). Two live findings fixed in-tree post-verification —
**restart `:8000` once more** to pick them up (behavior delta is skeleton-only:
organ twins now hedged, region labels human-readable).
**Ticket:** [maestro-brief-drill 01](https://github.com/LuDraGa/guitar-newsician/issues/1) · map [#6](https://github.com/LuDraGa/guitar-newsician/issues/6)
**Branch:** `maestro/agent-buildout`
**Model (locked by #7):** judgment pass = `openai/gpt-5.5`; chat loop keeps its default picker.
**Sources:** `.scratch/maestro-brief-drill/PRD.md` · architecture §4/§6 · `SESSION_HANDOFF.md`

## What this slice is

The thin end-to-end `brief` path: a `brief_region` tool the existing DeepAgents
loop can call. Deterministic Section×Role rollup over the fact pack (**formula**)
+ exactly **one** `gpt-5.5` interpretation pass (**judgment**) → a structured
node `data + evidence + confidence + interpretation`, returned **in-memory**
(no persistence — that's ticket #2) and visible in the trace/sandbox.

## Design

### New module: `maestro/maestro_agent/brief.py`

All pure except the one LLM call, which is injected.

| Function | Kind | What it does |
|---|---|---|
| `resolve_region(sections, region)` | pure (node-selection) | `region: str` → matching sections. Numeric string → `index` match; otherwise case-insensitive label/section match with leading article stripped ("the chorus" → "chorus"). **All** matching sections return (a song has 2 choruses → both are the region). No match → `[]`; the tool answers honestly with the available section labels (abstain-and-point, never fabricate). |
| `build_brief_skeleton(pack, sections)` | pure (**the formula**) | The Section×Role rollup. Per section: mix context (chords filtered to the section window + `mean_conf`, key teaching/detected + conflict, tempo, `mix_dynamics`) and one row per stem — **every** stem appears: active parts carry `note_count / pitch_range / mean_velocity / dominant_pitch_classes` from `activity_by_section`; a stem with no MIDI and no analysis becomes a **flagged** `unanalyzable` row (never dropped). Per-stem analysis fields ride along when present (own key, chords count, `dynamics`, `integrated_loudness`). Reuses `fact_pack` helpers (`_activity_for_index`, `_filter_range`, `_numeric_confidence`) — no parallel rollup logic. |
| — claim shape | — | Every claim row carries `evidence` (fact-pack source path) + `confidence`. Confidence is deterministic: activity = high when MIDI-backed, `flagged` when unanalyzable; role identity = **low + `generic_label: true`** when duplicate/generic labels with no tags (the seed's three "Guitar" stems); chords/key reuse the pack's existing confidence fields. |
| `interpret_skeleton(skeleton, llm)` | 1 LLM pass (**the judgment**) | Single call on the assembled skeleton (never a list of NL sub-queries). Prompt demands: JSON out; per-role **"what the mix does" separated from "what the guitarist should do"**; hedge wherever `generic_label` is set; abstain-and-point where evidence is absent (e.g. exact fingering); tie statements to stem ids. Output parsed best-effort — unparseable → wrapped as `{"summary": raw_text}`. LLM failure → `interpretation: {"status": "unavailable", "error"}` and the formula half still returns (honest degradation, tool never throws). |
| `build_brief_node(pack, region, interpret)` | composition | → the node: `{node_type: "section_role_brief", region, data (skeleton), evidence, confidence, interpretation (labeled `"kind": "interpretation"`), pack_version, created_at, ephemeral: true}`. |

### Wiring (`agent.py`, `config.py`, `llm.py` untouched)

- `Settings.brief_model: str = "openai/gpt-5.5"` (env `MAESTRO_BRIEF_MODEL`) — #7's split made explicit and overridable.
- `_make_tools(fact_pack, song_id, settings=None)` gains `brief_region(region: str)`,
  docstring scoped to Section×Role briefing ("brief/walk me through <section> for
  a guitarist… returns a structured node…"). `describe_tools` keeps working
  (settings optional). Tool count 10 → 11.
- Judgment goes through `make_chat_model(settings.brief_model)` — the existing
  LiteLLM chokepoint, so the **usage observer prices the pass** (cost lands in
  the turn totals + soft budget flag) and the node itself rides the tool
  response into `_agent_trace` / Langfuse (PRD story 10: structured object in
  the sandbox). System prompt gains one line telling the loop to call
  `brief_region` for brief/walk-through asks and to narrate from the node
  without re-deriving it.

### Judgment-pass caveats (accepted)

- `gpt-5.5` is ~25–50× nano on judgment turns (#7) — the soft `$0.50` budget
  flag stays the guard; watch the first live costs.
- The interpretation LLM call is a plain invoke inside a tool body — it shows in
  Langfuse as cost via the observer, not as a nested LangChain span. Fine for
  the tracer bullet; revisit at #8's metadata seam if span nesting is wanted.

## Tests (Seam A/B, no live LLM — stub the judgment)

`maestro/tests/test_brief.py`, mirroring the slice-0 fixture pattern (`_pack()` fake).

- **Seam A — formula:** rollup determinism (same pack → identical skeleton, repeated); every stem appears; no-MIDI/no-analysis stem is flagged `unanalyzable`, never dropped; generic-label detection fires on duplicate untagged "Guitar" stems and not on distinct/tagged ones; claim rows all carry evidence + confidence; section chord filtering respects the window; `resolve_region` (index / label / article-stripping / multi-match / no-match) as pure node-selection tests.
- **Seam B — wiring:** `brief_region` registered with the scoped docstring (via `describe_tools`); node shape `data+evidence+confidence+interpretation` with a **stubbed** interpreter; interpretation labeled; LLM-failure path degrades to `status: unavailable`; unknown region returns available sections.
- Gate: `cd maestro && uv run pytest` (83 existing + ~14 new, all green). No `FACT_PACK_VERSION` bump (no stored-pack change — the node is ephemeral).

## Acceptance-criteria mapping

| Ticket criterion | Where it lands |
|---|---|
| bounded tool + scoped docstring | `_make_tools` + Seam B test |
| formula = pure fn, unit-tested at Seam A, no LLM | `build_brief_skeleton` + Seam A tests |
| node carries data/evidence/confidence/interpretation, labeled | `build_brief_node` + Seam B shape test |
| every active part appears; weak part flagged (test 2) | skeleton rows + flagged-not-dropped test |
| repeat ask → same coverage (test 1) | determinism test (interpretation stubbed) |
| mix vs guitar separation + hedging (tests 4, 6) | judgment prompt contract + `generic_label` flag; judged live |
| abstains-and-points (test 3) | no-match region path + judgment prompt contract; judged live |
| Seam B registration + node-selection pure fns | `resolve_region` tests + registration test |

## Live try-it (user, after `:8000` restart)

1. "Brief the chorus for a guitarist." → trace shows one `brief_region` call, node visible as structured object; answer separates mix vs guitar; hedges on the three generic "Guitar" stems.
2. Repeat the same ask → same role coverage.
3. "What exact fingering should I use in the chorus?" → abstains and points.
4. Eyeball the turn cost (gpt-5.5 judgment) against the budget flag.

## Map-alignment enhancements (user call at approval: "enhance aligned with #6")

Issue #1 predates #7/#8/#17 landing; the build folds their outcomes in:

- **#7 model split, explicit:** `Settings.brief_model` (`MAESTRO_BRIEF_MODEL`,
  default `openai/gpt-5.5`) — the judgment pass gets frontier depth, the chat
  seat keeps its picker. `DEFAULT_BRIEF_MODEL` covers a settings-less runner.
- **#8 traceability, wired in from day one:** the judgment invoke carries its
  own Langfuse `CallbackHandler` + `run_name="brief-judgment"` — inside the
  active `maestro-turn` OTEL context it lands in the SAME per-turn trace; the
  usage observer (global LiteLLM callback + in-flight fence) prices the pass
  into the turn totals and the soft budget flag. The node carries
  `source: "computed_fresh"` — the story-14 fresh-vs-recall seam (`graph_recall`
  arrives with #2's store).
- **#17 roster-only:** no subagent, no `task` tool — `brief_region` is a bounded
  tool on the main loop; routing is soft (docstring + one system-prompt line).

## Live verification (2026-07-12, agent-driven via `POST :8000/chat`, chat seat = nano, judgment = gpt-5.5)

Seeded song BabySlakh Track00001 (`efcbb636…`), pack v6, 10 stems.

| Check | Result |
|---|---|
| "Brief the chorus for a guitarist." | ✅ exactly ONE `brief_region` call; 3 LLM calls total (nano route → **gpt-5.5 judgment** → nano narration). Region resolved to all 4 choruses (indexes 1/4/5/6) via the `section` kind. Node in the trace: `computed_fresh`, `ephemeral`, per-claim evidence/confidence, `generic_label_stem_ids: [S00, S07, S08]` (the three "Guitar" stems). |
| Interpretation quality | ✅ `mix_story` vs `guitar_focus` cleanly separated per section, stem_ids cited; hedges name the generic guitars AND the truncated medium-conf chord read; abstention points at MIDI/audio needed for fingerings. Narrated answer teaches from the node (per-section guitar focus with note counts/pitch content). |
| Repeat ask (test 1, consistency) | ✅ skeleton **byte-identical** across turns (sorted-JSON equality); same region, same role coverage, same generic flags. |
| Fingering ask (test 3, honesty) | ✅ abstains ("can't give exact fingerings… no tablature/transcription"), explains why, gives what it CAN (chord tones + active stems). |
| Cost / budget | ✅ fresh brief turn $0.145 (judgment $0.1396 @ 13.2K in / 2.4K out), repeat $0.068 (**38.9K/41.8K tokens prompt-cache hit** — the identical skeleton makes the judgment prompt cacheable). Under the $0.50 soft flag. ⚠️ judgment latency ~40s → ~50s turn wall-time; watch for the cohort, hard budget is #16's. |
| Langfuse (#8 gate) | ✅ trace `8242023f…`: 12 observations, one tree — `maestro-turn` → `song_qna_agent` → `tools` → `brief_region` TOOL → **`brief-judgment` GENERATION nested under the tool span** with its $0.1396 cost. Fresh-vs-recall seam rides the node (`source`). |

### Live findings → resolutions (both in current scope, fixed + tested)

1. **Region labels showed "0.0"** — MSAF's `label` is a repetition-cluster id
   (all four choruses share "0.0"; the human name lives in `section`). Not a
   fact-pack bug — cluster ids are real analyzer semantics (and future fuel for
   repetition/similarity edges). Fix: `region.labels` prefers the `section`
   kind. *(No new ticket: data semantics, display-only.)*
2. **The seed's three "Organ" stems escaped the generic flag** — identical
   label + identical role-echo tag `["other"]`, but the original rule treated
   any tag as distinguishing. Rule sharpened: a stem is ambiguous when its whole
   `(role, label, tags)` identity collides with a peer's; distinct tag sets
   still distinguish. New Seam A test (`test_identical_tag_echo_twins_are_still_ambiguous`).

No out-of-scope findings ticket-worthy: judgment latency/cost is a recorded
watch-item owned by the #16 gate walk; the map's existing #9 (stem-tag UI)
already tracks curing the weak-tag data this slice hedges around.

## Progress log

- 2026-07-12 — plan drafted; ticket claim on GitHub denied by the session's
  permission classifier — user to assign #1.
- 2026-07-12 — user approved with the map-alignment enhancement; **BUILT**:
  `maestro_agent/brief.py` (resolve_region / build_brief_skeleton /
  interpret_skeleton / make_judgment / build_brief_node), `config.py`
  `brief_model`, `agent.py` wiring (tool count 10 → 11, one system-prompt
  routing line, `_make_tools` takes optional settings), `tests/test_brief.py`
  (17 new: Seam A node-selection + formula + stubbed judgment, Seam B node
  shape + registration + bound graph). **Gate: 100/100 pytest green.** No
  `FACT_PACK_VERSION` bump (node is ephemeral, stored pack unchanged).
- 2026-07-12 — **LIVE-VERIFIED** (agent-driven, user-started servers): all six
  acceptance lenses pass (see Live verification). Two live findings fixed
  in-tree (organ-twin hedging, readable region labels); **101/101 pytest
  green**. Committed + pushed; ticket #1 resolved on the map.
- ▶ Post-resolution: user restarts `:8000` once to pick up the two live-finding
  fixes. Frontier unblocked: #2 (durable graph store) and #9 (stem-tag UI).
