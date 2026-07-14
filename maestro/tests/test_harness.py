"""Ticket #5 — the earned harness (judgment runner, grounding, router, evaluator).

All Seam B, all pure — the judgment runner is exercised only through stub
judges, never a live LLM. Wiring tests reuse the suite's fixture patterns:
`_pack`/`_stub_interpret` from test_brief, the fake-runner monkeypatch from
test_traceability, and closure-built tools from `_make_tools` with fake
fact-pack queries.
"""

import json

import pytest

from test_brief import _pack, _sections, _stub_interpret

import maestro_agent.agent as agent_mod
from maestro_agent.agent import _build_agent_messages, _evaluated, _make_tools, invoke_agent
from maestro_agent.brief import build_brief_node
from maestro_agent.config import Settings
from maestro_agent.drill import build_drill_node
from maestro_agent.harness import (
    SOURCE_COMPREHENSION_GRAPH,
    SOURCE_FACT_PACK,
    evaluate_node,
    extract_region,
    ground,
    parse_judgment,
    route_directive,
    route_followed,
    route_message,
    run_judgment,
)

# --- fixtures -----------------------------------------------------------------


def _rich_interpret(skeleton: dict) -> dict:
    """A judgment that behaves: hedges the ambiguity, abstains on the flagged
    parts, and only references real section indexes."""
    return {
        "kind": "interpretation",
        "status": "ok",
        "summary": "rich",
        "sections": [
            {
                "section_index": index,
                "mix_story": "full band",
                "guitar_focus": "strum",
                "hedges": ["which guitar leads cannot be determined"],
                "abstentions": ["vocals cannot be briefed — no MIDI, no analysis"],
            }
            for index in (1, 2)
        ],
    }


def _untwinned_pack() -> dict:
    """The canned pack with the twin guitars disambiguated by tags, so identity
    confidence is high and overall confidence is medium (the key), not low."""
    pack = _pack()
    pack["midi"]["stems"][0]["tags"] = ["rhythm"]
    pack["midi"]["stems"][1]["tags"] = ["lead"]
    return pack


def _flag_codes(node: dict) -> set[str]:
    return {flag["code"] for flag in node["flags"]}


# --- the judgment runner --------------------------------------------------------


def test_run_judgment_parses_fenced_json_and_records_model():
    raw = '```json\n{"summary": "s", "sections": []}\n```'
    result = run_judgment("INSTR\n", {"a": 1}, judge=lambda prompt: raw, model="openai/gpt-5.5")
    assert result["kind"] == "interpretation"
    assert result["status"] == "ok"
    assert result["summary"] == "s"
    assert result["model"] == "openai/gpt-5.5"


def test_run_judgment_prompt_is_instructions_plus_compact_payload():
    seen: dict = {}

    def _judge(prompt: str) -> str:
        seen["prompt"] = prompt
        return "{}"

    run_judgment("INSTR\n", {"a": [1, 2]}, judge=_judge)
    assert seen["prompt"] == 'INSTR\n{"a":[1,2]}'


def test_run_judgment_failure_degrades_never_raises():
    def _boom(prompt: str) -> str:
        raise RuntimeError("model down")

    result = run_judgment("INSTR", {}, judge=_boom)
    assert result["status"] == "unavailable"
    assert "model down" in result["error"]


def test_parse_judgment_plain_prose_becomes_summary():
    assert parse_judgment("plain prose, no JSON") == {"summary": "plain prose, no JSON"}


# --- grounding -------------------------------------------------------------------


def test_ground_stamps_tool_source_and_song_and_never_mutates():
    payload = {"sections": []}
    tagged = ground(payload, tool="get_sections", source=SOURCE_FACT_PACK, song_id="song-1")
    assert tagged["provenance"] == {"tool": "get_sections", "source": "song_fact_pack", "song_id": "song-1"}
    assert "provenance" not in payload  # a new dict, the original untouched


def test_ground_tags_error_payloads_and_passes_non_dicts_through():
    tagged = ground({"error": "nope"}, tool="get_key", source=SOURCE_FACT_PACK, song_id="s")
    assert tagged["error"] == "nope" and tagged["provenance"]["tool"] == "get_key"
    assert ground("not a dict", tool="t", source="s") == "not a dict"


def test_ground_is_deterministic_no_volatile_keys():
    first = ground({"a": 1}, tool="t", source="s", song_id="x")
    second = ground({"a": 1}, tool="t", source="s", song_id="x")
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


# --- the router: intent ------------------------------------------------------------


def test_drill_asks_route_to_drill():
    for message in ("give me a drill for the chorus", "any exercises?", "how should I practice the verse"):
        assert route_message(message, _sections())["intent"] == "drill"


def test_brief_asks_route_to_brief():
    for message in ("brief the chorus", "walk me through the chorus", "what should I play in the chorus"):
        assert route_message(message, _sections())["intent"] == "brief"


def test_drill_wins_when_both_verbs_present():
    route = route_message("practice the chorus — walk me through it", _sections())
    assert route["intent"] == "drill"


def test_everything_else_is_freeform():
    route = route_message("what key is this song in?", _sections())
    assert route == {"intent": "freeform", "region": None, "matched": None}


# --- the router: vocabulary-grounded region extraction ------------------------------


def test_region_comes_only_from_the_songs_section_vocabulary():
    assert route_message("drill the chorus", _sections())["region"] == "chorus"
    assert route_message("drill the intro please", _sections())["region"] == "intro"
    # "bridge" is not one of this song's sections — never extracted.
    assert route_message("drill the bridge", _sections())["region"] is None


def test_region_none_without_sections_and_numeric_only_when_explicit():
    assert route_message("drill the chorus", None)["region"] is None
    assert route_message("drill section 3", None)["region"] == "3"


def test_explicit_section_number_is_validated_against_the_pack():
    assert route_message("drill section 2", _sections())["region"] == "2"
    assert route_message("drill section 9", _sections())["region"] is None


def test_ambiguity_extracts_nothing():
    # Two distinct region names → don't guess.
    assert route_message("brief the chorus and the intro", _sections())["region"] is None
    # A name AND an explicit index → don't guess.
    assert route_message("drill the chorus, section 1", _sections())["region"] is None


def test_compound_section_names_beat_their_contained_word():
    sections = _sections() + [
        {"index": 3, "label": "pre-chorus", "section": "pre-chorus", "start_sec": 12.0, "end_sec": 16.0}
    ]
    assert extract_region("drill the pre-chorus", sections) == "pre-chorus"
    assert extract_region("drill the chorus", sections) == "chorus"


# --- the router: directive + follow-through -----------------------------------------


def test_directive_names_tool_and_region_when_known():
    directive = route_directive({"intent": "drill", "region": "chorus"})
    assert "drill_region('chorus')" in directive
    assert directive.startswith("[router]")


def test_directive_without_region_names_just_the_tool():
    directive = route_directive({"intent": "brief", "region": None})
    assert "brief_region(region)" in directive and "'" not in directive


def test_directive_is_none_for_freeform():
    assert route_directive({"intent": "freeform", "region": None}) is None


def test_route_followed_measures_the_routed_tool():
    assert route_followed({"intent": "freeform"}, []) is True
    assert route_followed({"intent": "drill"}, [{"name": "drill_region", "args": {}}]) is True
    assert route_followed({"intent": "drill"}, [{"name": "get_key", "args": {}}]) is False
    assert route_followed({"intent": "brief"}, None) is False


# --- the evaluator stub ---------------------------------------------------------------


def test_honest_node_evaluates_ok():
    node = build_brief_node(_untwinned_pack(), "the chorus", _rich_interpret)
    verdict = evaluate_node(node)
    assert verdict == {"status": "ok", "flags": []}


def test_failed_judgment_flags_formula_only():
    def _failed(skeleton: dict) -> dict:
        return {"kind": "interpretation", "status": "unavailable", "error": "model down"}

    verdict = evaluate_node(build_brief_node(_untwinned_pack(), "the chorus", _failed))
    assert _flag_codes(verdict) == {"judgment_unavailable"}


def test_low_overall_confidence_flags():
    # The default pack's twin guitars force identity (and overall) low.
    node = build_brief_node(_pack(), "the chorus", _rich_interpret)
    assert "low_confidence" in _flag_codes(evaluate_node(node))


def test_unknown_section_index_flags_the_observed_defect_class():
    def _wandering(skeleton: dict) -> dict:
        entry = _rich_interpret(skeleton)["sections"][0]
        return {"kind": "interpretation", "status": "ok", "summary": "s",
                "sections": [entry, {**entry, "section_index": 9}]}

    verdict = evaluate_node(build_brief_node(_untwinned_pack(), "the chorus", _wandering))
    codes = _flag_codes(verdict)
    assert "unknown_section_index" in codes
    detail = next(flag["detail"] for flag in verdict["flags"] if flag["code"] == "unknown_section_index")
    assert "[9]" in detail and "[1, 2]" in detail


def test_unhedged_ambiguity_and_missing_abstention_flag_a_bare_judgment():
    # Twins present + flagged parts present, but the stub judgment carries no
    # hedges and no abstentions.
    verdict = evaluate_node(build_brief_node(_pack(), "the chorus", _stub_interpret))
    codes = _flag_codes(verdict)
    assert "unhedged_ambiguity" in codes and "missing_abstention" in codes


def test_lost_evidence_flags_ungrounded_claim():
    node = build_brief_node(_untwinned_pack(), "the chorus", _rich_interpret)
    del node["data"]["key"]["evidence"]
    verdict = evaluate_node(node)
    assert "ungrounded_claim" in _flag_codes(verdict)
    detail = next(flag["detail"] for flag in verdict["flags"] if flag["code"] == "ungrounded_claim")
    assert "key" in detail


def test_drill_node_evaluates_via_exercises_and_cautions():
    def _drill_interpret(plan: dict) -> dict:
        return {"kind": "interpretation", "status": "ok", "summary": "d",
                "exercises": [{"section_index": 9, "focus": "f", "steps": [],
                               "tempo_advice": "t", "hedges": [], "abstentions": []}]}

    brief = build_brief_node(_pack(), "the chorus", _rich_interpret)
    node = build_drill_node(brief, "the chorus", _drill_interpret)
    codes = _flag_codes(evaluate_node(node))
    # Wrong index read from `exercises`; the pack's twins ride in as
    # generic_label cautions (unhedged) and flagged parts as cautions
    # (no abstentions); confidence is inherited low.
    assert {"unknown_section_index", "unhedged_ambiguity", "missing_abstention", "low_confidence"} <= codes


def test_evaluated_wrapper_skips_error_nodes_and_never_mutates():
    error = {"error": "No section matches"}
    assert _evaluated(error) is error
    node = build_brief_node(_untwinned_pack(), "the chorus", _rich_interpret)
    wrapped = _evaluated(node)
    assert wrapped["evaluation"]["status"] == "ok"
    assert "evaluation" not in node  # the persisted object is untouched


# --- wiring: tool dispatch carries provenance -------------------------------------


class _FakeQueries:
    def get_sections(self):
        return {"sections": [{"index": 1}]}

    def get_key(self):
        raise RuntimeError("nope")


class _FakeToolFactPack:
    def query(self, song_id):  # noqa: ARG002
        return _FakeQueries()


def _tool(tools, name):
    return next(tool for tool in tools if tool.__name__ == name)


def test_fact_pack_tool_responses_carry_provenance():
    tools = _make_tools(_FakeToolFactPack(), "song-1")
    result = _tool(tools, "get_sections")()
    assert result["sections"] == [{"index": 1}]
    assert result["provenance"] == {"tool": "get_sections", "source": SOURCE_FACT_PACK, "song_id": "song-1"}


def test_tool_error_responses_carry_provenance_too():
    tools = _make_tools(_FakeToolFactPack(), "song-1")
    result = _tool(tools, "get_key")()
    assert result["error"] == "nope"
    assert result["provenance"]["tool"] == "get_key"


def test_brief_and_drill_tools_attach_evaluation_and_graph_provenance(monkeypatch):
    brief = build_brief_node(_pack(), "the chorus", _rich_interpret)

    class _FakeGraph:
        def __init__(self, fact_pack):  # noqa: ARG002
            ...

        def ensure_current(self, song_id, region, interpret):  # noqa: ARG002
            return brief

    drill_raw = json.dumps({"summary": "d", "exercises": []})
    monkeypatch.setattr(agent_mod, "ComprehensionGraphService", _FakeGraph)
    monkeypatch.setattr(
        agent_mod, "make_judgment", lambda model, run_name="brief-judgment": (lambda prompt: drill_raw)
    )
    tools = _make_tools(_FakeToolFactPack(), "song-1")

    briefed = _tool(tools, "brief_region")("the chorus")
    assert briefed["provenance"] == {
        "tool": "brief_region", "source": SOURCE_COMPREHENSION_GRAPH, "song_id": "song-1"
    }
    assert briefed["evaluation"]["status"] in {"ok", "flagged"}
    assert "evaluation" not in brief  # the graph's node object is never mutated

    drilled = _tool(tools, "drill_region")("the chorus")
    assert drilled["node_type"] == "section_role_drill"
    assert drilled["provenance"]["tool"] == "drill_region"
    assert drilled["evaluation"]["status"] in {"ok", "flagged"}


# --- wiring: the routed turn ---------------------------------------------------------


class _FakeAgent:
    def __init__(self) -> None:
        self.invoke_args: list[tuple] = []

    def invoke(self, payload, config=None):  # noqa: ANN001
        self.invoke_args.append((payload, config))
        return {"messages": [{"role": "assistant", "content": "the answer"}]}


class _FakeFactPack:
    def ensure_current(self, song_id: str) -> dict:  # noqa: ARG002
        return {"version": 6, "created_at": "2026-07-12T00:00:00Z", "sections": _sections()}


def _settings(**overrides) -> Settings:
    defaults = dict(
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="test-key",
        werecode_schema="werecode",
        sources_bucket="sources",
        artifacts_bucket="artifacts",
        agent_model="openai/gpt-test",
        agent_enabled=True,
    )
    defaults.update(overrides)
    return Settings(**defaults)


@pytest.fixture()
def fake_agent(monkeypatch: pytest.MonkeyPatch) -> _FakeAgent:
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    fake = _FakeAgent()
    monkeypatch.setattr(agent_mod, "create_agent_runner", lambda *args, **kwargs: fake)
    monkeypatch.setattr(agent_mod, "_agent_cache", {})
    return fake


def test_build_agent_messages_appends_directive_to_the_final_user_message():
    messages = _build_agent_messages("song-1", "drill it", [], directive="[router] X")
    assert messages[-1]["content"].endswith("\n\n[router] X")
    assert "[router]" not in _build_agent_messages("song-1", "drill it", [])[-1]["content"]


def test_invoke_agent_routes_a_drill_ask_and_measures_follow_through(fake_agent: _FakeAgent):
    result = invoke_agent(_settings(), _FakeFactPack(), "give me a drill for the chorus", "song-1")
    router = result["raw"]["router"]
    assert router["intent"] == "drill"
    assert router["region"] == "chorus"  # extracted from the pack's real sections
    assert "drill_region('chorus')" in router["directive"]
    assert router["followed"] is False  # the fake agent called no tools — measurable
    payload, _ = fake_agent.invoke_args[0]
    assert payload["messages"][-1]["content"].endswith(router["directive"])


def test_invoke_agent_leaves_a_freeform_turn_untouched(fake_agent: _FakeAgent):
    result = invoke_agent(_settings(), _FakeFactPack(), "what key is this song in?", "song-1")
    router = result["raw"]["router"]
    assert router == {"intent": "freeform", "region": None, "matched": None, "directive": None, "followed": True}
    payload, _ = fake_agent.invoke_args[0]
    assert "[router]" not in payload["messages"][-1]["content"]
