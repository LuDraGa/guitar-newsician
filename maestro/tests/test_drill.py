"""Ticket #4 — the light Section×Role drill, composed on the shared graph.

Seam A: the drill formula (`build_drill_plan`) is a pure function over a brief
NODE — determinism, tempo ladder (abstains on missing bpm), guitar-first focus,
flag/hedge pass-through, per-row evidence. The drill judgment is exercised only
through a stub (`interpret_plan(judge=...)`) — never a live LLM.
Seam B: the node shape (inherited confidence, `brief_source` trace seam, error
pass-through), the composition seam — cold fill runs brief's judgment exactly
once through the graph service and a warm repeat recalls (stories 15/16, plus
the structural no-parallel-rollup assertion on the module source) — and
`drill_region` registration/binding, mirroring `brief_region`'s tests.
"""

import inspect
import json

from test_brief import _pack, _stub_interpret
from test_comprehension_graph import _CountingInterpreter, _service

import maestro_agent.drill as drill_module
from maestro_agent.agent import create_agent_runner, describe_tools
from maestro_agent.brief import build_brief_node
from maestro_agent.drill import build_drill_node, build_drill_plan, interpret_plan

# --- fixtures -----------------------------------------------------------------


def _brief_node(pack: dict | None = None, region: str = "the chorus", interpret=None) -> dict:
    return build_brief_node(pack or _pack(), region, interpret or _stub_interpret)


# --- Seam A: the drill formula (pure over the brief node) -------------------------


def test_drill_plan_is_deterministic_on_repeat():
    node = _brief_node()
    first = build_drill_plan(node)
    second = build_drill_plan(node)
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_tempo_ladder_derives_from_pack_bpm():
    plan = build_drill_plan(_brief_node())
    assert plan["tempo_ladder"] == [
        {"percent": 60, "bpm": 79},
        {"percent": 75, "bpm": 99},
        {"percent": 90, "bpm": 119},
        {"percent": 100, "bpm": 132},
    ]
    assert plan["tempo_evidence"] == "song_fact_pack.tempo"


def test_missing_bpm_abstains_with_a_caution_never_fabricates():
    pack = _pack()
    pack["tempo"] = {"bpm": None, "confidence": "unknown"}
    plan = build_drill_plan(_brief_node(pack))
    assert plan["tempo_ladder"] is None
    assert [caution["reason"] for caution in plan["cautions"]] == ["no_tempo"]
    assert "by ear" in plan["cautions"][0]["note"]


def test_focus_parts_are_active_guitar_first():
    # Give the bass per-section activity so a non-guitar active part exists.
    pack = _pack()
    bass = next(stem for stem in pack["midi"]["stems"] if stem["stem_id"] == "S02")
    bass["has_midi"] = True
    bass["activity_by_section"] = [
        {"section_index": 1, "active": True, "note_count": 8,
         "pitch_range": {"min": 30, "max": 45}, "mean_velocity": 70.0,
         "pitch_class_histogram": [8] + [0] * 11,
         "dominant_pitch_classes": [{"pc": 0, "note": "C", "count": 8}]},
    ]
    plan = build_drill_plan(_brief_node(pack, region="1"))
    section = plan["sections"][0]
    # Guitars (skeleton order) lead; the active bass follows; silent/flagged absent.
    assert [row["stem_id"] for row in section["focus_parts"]] == ["S00", "S07", "S05", "S02"]
    assert [row["role"] for row in section["focus_parts"]] == ["guitar", "guitar", "guitar", "bass"]


def test_cautions_pass_through_flags_and_generic_labels_never_dropped():
    plan = build_drill_plan(_brief_node(region="1"))
    cautions = plan["sections"][0]["cautions"]
    by_reason = {(c["stem_id"], c["reason"]) for c in cautions}
    assert ("S09", "unanalyzable") in by_reason  # no MIDI, no analysis
    assert ("S02", "unmeasured_here") in by_reason  # analyzed, no per-section MIDI
    assert ("S00", "generic_label") in by_reason and ("S07", "generic_label") in by_reason
    assert not any(c["stem_id"] == "S05" for c in cautions)  # the tagged peer is clean


def test_plan_rows_carry_evidence():
    plan = build_drill_plan(_brief_node(region="1"))
    section = plan["sections"][0]
    assert section["loop"]["evidence"] == "song_fact_pack.sections"
    assert section["loop"]["start_sec"] == 4.0 and section["loop"]["end_sec"] == 8.0
    assert section["chords"]["evidence"]
    assert all(row["evidence"] for row in section["focus_parts"])
    assert all(caution["evidence"] for caution in section["cautions"])


def test_brief_context_rides_when_judgment_ok_and_is_omitted_when_unavailable():
    def _rich_interpret(skeleton: dict) -> dict:
        return {
            "kind": "interpretation", "status": "ok", "summary": "s",
            "sections": [{"section_index": 1, "mix_story": "full band", "guitar_focus": "strum",
                          "hedges": ["which guitar leads is unknown"], "abstentions": []}],
        }

    plan = build_drill_plan(_brief_node(interpret=_rich_interpret))
    assert plan["brief_context"] == [
        {"section_index": 1, "mix_story": "full band", "guitar_focus": "strum",
         "hedges": ["which guitar leads is unknown"], "abstentions": []}
    ]

    def _failed_interpret(skeleton: dict) -> dict:
        return {"kind": "interpretation", "status": "unavailable", "error": "model down"}

    plan = build_drill_plan(_brief_node(interpret=_failed_interpret))
    assert "brief_context" not in plan  # the deterministic plan stands alone


# --- Seam A: the drill judgment (stubbed — parsing + degradation) ------------------


def test_interpret_plan_parses_fenced_json_and_records_model():
    raw = '```json\n{"summary": "s", "exercises": []}\n```'
    result = interpret_plan({"sections": []}, judge=lambda prompt: raw, model="openai/gpt-5.5")
    assert result["kind"] == "interpretation"
    assert result["status"] == "ok"
    assert result["summary"] == "s"
    assert result["model"] == "openai/gpt-5.5"


def test_interpret_plan_failure_degrades_never_raises():
    def _boom(prompt: str) -> str:
        raise RuntimeError("model down")

    result = interpret_plan({"sections": []}, judge=_boom)
    assert result["kind"] == "interpretation"
    assert result["status"] == "unavailable"
    assert "model down" in result["error"]


# --- Seam B: the node ---------------------------------------------------------------


def _stub_drill_interpret(plan: dict) -> dict:
    return {"kind": "interpretation", "status": "ok", "summary": "drill", "exercises": []}


def test_drill_node_shape_inherits_brief_confidence_and_names_brief_source():
    brief = _brief_node()
    node = build_drill_node(brief, "the chorus", _stub_drill_interpret)
    assert node["node_type"] == "section_role_drill"
    assert node["source"] == "computed_fresh"
    assert node["ephemeral"] is True  # the durable artifact is the brief node underneath
    assert node["brief_source"] == "computed_fresh"
    assert node["region"] == brief["region"]
    assert node["pack_version"] == 6
    assert node["data"]["sections"]
    assert node["evidence"]["per_claim"] is True
    assert node["confidence"] == brief["confidence"]  # only as confident as the comprehension
    assert node["interpretation"]["kind"] == "interpretation"


def test_drill_node_unknown_region_passes_the_error_through_untouched():
    calls = {"n": 0}

    def _counting(plan: dict) -> dict:
        calls["n"] += 1
        return _stub_drill_interpret(plan)

    error = _brief_node(region="bridge")
    node = build_drill_node(error, "bridge", _counting)
    assert node is error  # abstain-and-point verbatim
    assert calls["n"] == 0  # the drill judgment never ran


# --- Seam B: composition on the shared graph (stories 15/16) ------------------------


def test_drill_cold_fill_runs_brief_judgment_once_then_recalls():
    service, data, _ = _service()
    brief_interpreter = _CountingInterpreter()
    drill_interpreter = _CountingInterpreter()

    def _drill(region: str) -> dict:
        # The drill_region tool body's flow: comprehension ONLY via the service.
        brief_node = service.ensure_current("song-1", region, brief_interpreter)
        return build_drill_node(brief_node, region, drill_interpreter)

    first = _drill("the chorus")
    assert first["brief_source"] == "computed_fresh"  # cold fill via brief's formula
    assert brief_interpreter.calls == 1
    assert data.saves == 1  # the brief node persisted underneath

    second = _drill("CHORUS")  # canonicalization converges on the same node
    assert second["brief_source"] == "graph_recall"  # the substrate compounded
    assert brief_interpreter.calls == 1  # no second brief judgment pass
    assert drill_interpreter.calls == 2  # the drill pass runs per ask (ephemeral)
    assert data.saves == 1  # the drill node itself is never persisted


def test_no_parallel_rollup_path_exists_in_the_drill_module():
    # Structural story-15/16 guarantee: drill's only comprehension inputs are
    # the brief NODE and the graph service — it never imports the rollup.
    source = inspect.getsource(drill_module)
    assert "build_brief_skeleton" not in source
    assert "_section_entry" not in source
    assert "_part_row" not in source
    assert "from maestro_agent.fact_pack" not in source


# --- Seam B: wiring -------------------------------------------------------------------


class _IntrospectFactPack:
    def query(self, song_id):  # noqa: ARG002 - closures capture but never call it
        return object()


def test_drill_region_registered_with_scoped_docstring():
    tools = {tool["name"]: tool for tool in describe_tools(_IntrospectFactPack())}
    assert "drill_region" in tools
    desc = tools["drill_region"]["description"]
    assert "Comprehension Graph" in desc
    assert "brief_source" in desc
    assert "tempo ladder" in desc
    assert tools["drill_region"]["params"] == [
        {"name": "region", "type": "str", "required": True, "default": None}
    ]


def test_drill_region_bound_on_the_agent_graph():
    runner = create_agent_runner(None, _IntrospectFactPack(), "song-x", model="openai/gpt-5.4-nano")
    assert "drill_region" in set(runner.nodes["tools"].bound.tools_by_name)
