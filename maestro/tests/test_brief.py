"""Ticket #1 — the ephemeral Section×Role brief (formula + judgment + node).

Seam A: node-selection (`resolve_region`) and the rollup (`build_brief_skeleton`)
are pure functions over a canned pack — determinism, no-silent-drop, generic-label
hedging flags, per-claim evidence/confidence. The judgment is exercised only
through a stub (`interpret_skeleton(judge=...)`) — never a live LLM.
Seam B: `brief_region` registration/docstring via describe_tools + the bound
graph, and the node shape via `build_brief_node` with a stubbed interpreter.
"""

import json

from maestro_agent.agent import create_agent_runner, describe_tools
from maestro_agent.brief import (
    build_brief_node,
    build_brief_skeleton,
    interpret_skeleton,
    resolve_region,
)

# --- fixtures -----------------------------------------------------------------


def _sections() -> list[dict]:
    return [
        {"index": 0, "label": "intro", "section": "intro", "start_sec": 0.0, "end_sec": 4.0},
        {"index": 1, "label": "chorus", "section": "chorus", "start_sec": 4.0, "end_sec": 8.0},
        {"index": 2, "label": "chorus", "section": "chorus", "start_sec": 8.0, "end_sec": 12.0},
    ]


def _activity(counts: dict[int, int]) -> list[dict]:
    return [
        {
            "section_index": index,
            "active": count > 0,
            "note_count": count,
            "pitch_range": {"min": 40 if count else None, "max": 70 if count else None},
            "mean_velocity": 80.0 if count else None,
            "pitch_class_histogram": [count] + [0] * 11,
            "dominant_pitch_classes": [{"pc": 0, "note": "C", "count": count}] if count else [],
        }
        for index, count in counts.items()
    ]


def _pack() -> dict:
    return {
        "song_id": "song-1",
        "version": 6,
        "created_at": "2026-07-12T00:00:00Z",
        "key": {
            "teaching_key": {"key": "Bb", "scale": "minor", "label": "Bb minor", "confidence": "medium"},
            "detected_key": {"key": "Db", "scale": "major", "label": "Db major", "confidence": "medium"},
            "key_conflict": True,
        },
        "tempo": {"bpm": 132.0, "confidence": "high"},
        "mix_dynamics": {"peak_dbfs": -1.0, "rms_dbfs": -20.0, "crest_db": 19.0, "dynamics": "dynamic"},
        "sections": _sections(),
        "chords": {
            "progression": [
                {"start_sec": 0.0, "end_sec": 3.9, "chord": "Bbm", "mean_conf": 0.7},
                {"start_sec": 4.1, "end_sec": 6.0, "chord": "Db", "mean_conf": 0.5},
                {"start_sec": 6.0, "end_sec": 7.9, "chord": "Ab", "mean_conf": 0.5},
                {"start_sec": 8.1, "end_sec": 10.0, "chord": "Gb", "mean_conf": 0.3},
            ],
        },
        "midi": {
            "all_src": {},
            "stems": [
                # Two untagged twins labeled exactly like their role → generic.
                {"stem_id": "S00", "label": "Guitar", "role": "guitar", "tags": [], "is_drum": False,
                 "has_midi": True, "integrated_loudness": -15.0,
                 "analysis": {"status": "missing"},
                 "activity_by_section": _activity({0: 0, 1: 12, 2: 9})},
                {"stem_id": "S07", "label": "Guitar", "role": "guitar", "tags": [], "is_drum": False,
                 "has_midi": True, "integrated_loudness": -16.0,
                 "analysis": {"status": "missing"},
                 "activity_by_section": _activity({0: 0, 1: 30, 2: 22})},
                # A tagged same-role peer stays distinguishable → not generic.
                {"stem_id": "S05", "label": "Lead Guitar", "role": "guitar", "tags": ["solo"], "is_drum": False,
                 "has_midi": True, "integrated_loudness": -14.0,
                 "analysis": {"status": "missing"},
                 "activity_by_section": _activity({0: 0, 1: 44, 2: 0})},
                # Analyzed but no MIDI → no per-section activity, analysis rides.
                {"stem_id": "S02", "label": "Bass", "role": "bass", "tags": [], "is_drum": False,
                 "has_midi": False, "integrated_loudness": -18.29,
                 "analysis": {
                     "status": "ok",
                     "key": {"teaching_key": {"key": "Bb", "scale": "minor", "confidence": "high"}},
                     "chord_progression_count": 8,
                     "dynamics": {"peak_dbfs": -12.8, "rms_dbfs": -28.4, "crest_db": 15.6, "dynamics": "dynamic"},
                 }},
                # Neither MIDI nor analysis → must be flagged, never dropped.
                {"stem_id": "S09", "label": "Vocals", "role": "vocals", "tags": [], "is_drum": False,
                 "has_midi": False, "integrated_loudness": None,
                 "analysis": {"status": "missing"}},
            ],
        },
    }


def _stub_interpret(skeleton: dict) -> dict:
    return {"kind": "interpretation", "status": "ok", "summary": "stubbed", "sections": []}


# --- Seam A: node-selection (pure) ---------------------------------------------


def test_resolve_region_strips_article_and_returns_all_matching_sections():
    matched = resolve_region(_sections(), "the chorus")
    assert [section["index"] for section in matched] == [1, 2]


def test_resolve_region_matches_numeric_index():
    matched = resolve_region(_sections(), "2")
    assert [section["index"] for section in matched] == [2]


def test_resolve_region_no_match_or_empty_returns_nothing():
    assert resolve_region(_sections(), "bridge") == []
    assert resolve_region(_sections(), "  the  ") == []


# --- Seam A: the formula (pure rollup) ------------------------------------------


def test_skeleton_is_deterministic_on_repeat():
    sections = resolve_region(_sections(), "chorus")
    first = build_brief_skeleton(_pack(), sections)
    second = build_brief_skeleton(_pack(), sections)
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_skeleton_lists_every_stem_in_every_section():
    skeleton = build_brief_skeleton(_pack(), resolve_region(_sections(), "chorus"))
    assert len(skeleton["sections"]) == 2
    for section in skeleton["sections"]:
        assert [part["stem_id"] for part in section["parts"]] == ["S00", "S07", "S05", "S02", "S09"]


def test_unanalyzable_part_is_flagged_never_dropped():
    section = build_brief_skeleton(_pack(), resolve_region(_sections(), "chorus"))["sections"][0]
    vocals = next(part for part in section["parts"] if part["stem_id"] == "S09")
    assert vocals["status"] == "unanalyzable"
    assert "do not guess" in vocals["flag"]
    assert "activity" not in vocals


def test_analyzed_part_without_midi_is_unmeasured_but_carries_analysis():
    section = build_brief_skeleton(_pack(), resolve_region(_sections(), "chorus"))["sections"][0]
    bass = next(part for part in section["parts"] if part["stem_id"] == "S02")
    assert bass["status"] == "unmeasured_here"
    assert bass["analysis"]["own_key_confidence"] == "high"
    assert bass["analysis"]["dynamics"]["crest_db"] == 15.6
    assert bass["analysis"]["integrated_loudness"] == -18.29


def test_generic_labels_flag_untagged_twins_but_not_the_tagged_peer():
    skeleton = build_brief_skeleton(_pack(), resolve_region(_sections(), "chorus"))
    assert skeleton["generic_label_stem_ids"] == ["S00", "S07"]
    section = skeleton["sections"][0]
    twin = next(part for part in section["parts"] if part["stem_id"] == "S00")
    lead = next(part for part in section["parts"] if part["stem_id"] == "S05")
    assert twin["generic_label"] is True and twin["identity_confidence"] == "low"
    assert lead["generic_label"] is False and lead["identity_confidence"] == "high"


def test_identical_tag_echo_twins_are_still_ambiguous():
    # Live finding (seed's three "Organ" stems): a tag that merely echoes the
    # role ("other") on identically labeled twins distinguishes nothing — the
    # whole (role, label, tags) identity colliding is what flags. Distinct tag
    # sets on the same label DO distinguish.
    pack = _pack()
    pack["midi"]["stems"] = [
        {"stem_id": "O1", "label": "Organ", "role": "other", "tags": ["other"], "is_drum": False,
         "has_midi": False, "integrated_loudness": None, "analysis": {"status": "missing"}},
        {"stem_id": "O2", "label": "Organ", "role": "other", "tags": ["other"], "is_drum": False,
         "has_midi": False, "integrated_loudness": None, "analysis": {"status": "missing"}},
        {"stem_id": "O3", "label": "Organ", "role": "other", "tags": ["pad"], "is_drum": False,
         "has_midi": False, "integrated_loudness": None, "analysis": {"status": "missing"}},
    ]
    skeleton = build_brief_skeleton(pack, resolve_region(_sections(), "chorus"))
    assert skeleton["generic_label_stem_ids"] == ["O1", "O2"]


def test_section_chords_are_filtered_to_the_window():
    skeleton = build_brief_skeleton(_pack(), resolve_region(_sections(), "chorus"))
    first, second = skeleton["sections"]
    assert [entry["chord"] for entry in first["mix"]["chords"]["progression"]] == ["Db", "Ab"]
    assert [entry["chord"] for entry in second["mix"]["chords"]["progression"]] == ["Gb"]
    assert second["mix"]["chords"]["confidence"] == "low"  # mean_conf 0.3


def test_every_claim_row_carries_evidence_and_confidence():
    skeleton = build_brief_skeleton(_pack(), resolve_region(_sections(), "chorus"))
    assert skeleton["key"]["evidence"] and skeleton["key"]["confidence"]
    assert skeleton["tempo"]["evidence"] and skeleton["tempo"]["confidence"]
    section = skeleton["sections"][0]
    assert section["mix"]["chords"]["evidence"] and section["mix"]["chords"]["confidence"]
    active = next(part for part in section["parts"] if part["stem_id"] == "S07")
    assert active["activity"]["evidence"] and active["activity"]["confidence"] == "high"
    assert active["identity_evidence"]


# --- Seam A: the judgment (stubbed — parsing + degradation) ----------------------


def test_interpret_parses_fenced_json_and_records_model():
    raw = '```json\n{"summary": "s", "sections": []}\n```'
    result = interpret_skeleton({"sections": []}, judge=lambda prompt: raw, model="openai/gpt-5.5")
    assert result["kind"] == "interpretation"
    assert result["status"] == "ok"
    assert result["summary"] == "s"
    assert result["model"] == "openai/gpt-5.5"


def test_interpret_wraps_unparseable_output_as_summary():
    result = interpret_skeleton({"sections": []}, judge=lambda prompt: "plain prose, no JSON")
    assert result["status"] == "ok"
    assert result["summary"] == "plain prose, no JSON"


def test_interpret_failure_degrades_never_raises():
    def _boom(prompt: str) -> str:
        raise RuntimeError("model down")

    result = interpret_skeleton({"sections": []}, judge=_boom)
    assert result["kind"] == "interpretation"
    assert result["status"] == "unavailable"
    assert "model down" in result["error"]


# --- Seam B: the node ------------------------------------------------------------


def test_brief_node_shape_data_evidence_confidence_interpretation():
    node = build_brief_node(_pack(), "the chorus", _stub_interpret)
    assert node["node_type"] == "section_role_brief"
    assert node["source"] == "computed_fresh"  # story-14 seam; graph_recall arrives with #2
    assert node["ephemeral"] is True
    assert node["pack_version"] == 6
    assert node["region"]["section_indexes"] == [1, 2]
    assert node["data"]["sections"]
    assert node["evidence"]["per_claim"] is True
    assert node["confidence"]["identity"] == "low"  # the untagged Guitar twins
    assert node["interpretation"]["kind"] == "interpretation"


def test_brief_node_unknown_region_abstains_and_points():
    node = build_brief_node(_pack(), "bridge", _stub_interpret)
    assert "error" in node and "bridge" in node["error"]
    assert [entry["index"] for entry in node["available_sections"]] == [0, 1, 2]


# --- Seam B: wiring --------------------------------------------------------------


class _FakeFactPack:
    def query(self, song_id: str):  # noqa: ARG002 - closures capture but never call it
        return object()


def test_brief_region_registered_with_scoped_docstring():
    tools = {tool["name"]: tool for tool in describe_tools(_FakeFactPack())}
    assert "brief_region" in tools
    desc = tools["brief_region"]["description"]
    assert "Section×Role" in desc
    assert "data + evidence + confidence + interpretation" in desc
    params = tools["brief_region"]["params"]
    assert params == [{"name": "region", "type": "str", "required": True, "default": None}]


def test_brief_region_bound_on_the_agent_graph():
    runner = create_agent_runner(None, _FakeFactPack(), "song-x", model="openai/gpt-5.4-nano")
    assert "brief_region" in set(runner.nodes["tools"].bound.tools_by_name)
