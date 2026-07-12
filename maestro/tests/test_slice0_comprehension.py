"""Slice 0 — fact-pack comprehension (stem identity, per-stem detail, section activity).

Seam A: the stem-identity port + the MIDI section-activity rollup are pure
functions over fake inputs. Seam B: the new query views are pure functions over a
canned fact pack (no Supabase, no live LLM).
"""

from __future__ import annotations

import io

import mido

from maestro_agent.agent import _agent_cache_key, create_agent_runner, describe_tools
from maestro_agent.fact_pack import (
    SongFactPackQueries,
    _build_mix_dynamics,
    _crest_descriptor,
    _stem_pitch_class_profile,
    build_song_overview,
    render_song_overview,
)
from maestro_agent.midi import dominant_pitch_classes, note_activity_by_window
from maestro_agent.werecode_data import _stem_info


# --- 0.1: stem identity precedence (Seam A) ---------------------------------


def test_stem_info_reads_precise_identity_from_nested_metadata():
    asset = {
        "kind": "stem_guitar",
        "metadata": {"stem": {"id": "G2", "role": "guitar", "label": "Lead Guitar", "tags": ["solo", "overdrive"]}},
    }
    info = _stem_info(asset)
    assert info["id"] == "G2"
    assert info["role"] == "guitar"
    assert info["label"] == "Lead Guitar"
    assert "solo" in info["tags"] and "overdrive" in info["tags"]


def test_stem_info_derives_label_from_old_seed_shape():
    # Old seed: no nested stem / no explicit label — identity must still resolve.
    asset = {
        "kind": "stem_guitar",
        "metadata": {"stem_id": "S05", "role": "guitar", "inst_class": "electric_guitar_clean"},
    }
    info = _stem_info(asset)
    assert info["id"] == "S05"
    assert info["role"] == "guitar"
    assert info["label"] == "Electric Guitar Clean"  # title-cased from inst_class
    assert "guitar" in info["tags"]


def test_stem_info_keeps_two_guitars_distinct():
    lead = _stem_info({"kind": "stem_guitar", "metadata": {"stem_id": "S05", "stem_label": "Lead Guitar"}})
    rhythm = _stem_info({"kind": "stem_guitar", "metadata": {"stem_id": "S06", "stem_label": "Rhythm Guitar"}})
    assert lead["label"] != rhythm["label"]
    assert lead["id"] != rhythm["id"]


def test_stem_info_falls_back_to_kind_then_other():
    info = _stem_info({"kind": "stem_bass", "metadata": {}})
    assert info["role"] == "bass"
    info_unknown = _stem_info({"kind": "analysis_json", "metadata": {}})
    assert info_unknown["role"] == "other"


# --- 0.4: MIDI note-onset bucketing (Seam A) --------------------------------


def _midi_with_onsets(onsets_sec: list[float]) -> bytes:
    # ticks_per_beat=480 + default tempo 500000us (120bpm) => 1 sec == 960 ticks.
    midi = mido.MidiFile(ticks_per_beat=480)
    track = mido.MidiTrack()
    midi.tracks.append(track)
    prev_tick = 0
    for onset in onsets_sec:
        tick = round(onset * 960)
        track.append(mido.Message("note_on", note=60, velocity=80, time=max(0, tick - prev_tick)))
        track.append(mido.Message("note_off", note=60, velocity=0, time=10))
        prev_tick = tick + 10
    buffer = io.BytesIO()
    midi.save(file=buffer)
    return buffer.getvalue()


def test_note_activity_by_window_buckets_onsets_into_sections():
    data = _midi_with_onsets([0.5, 1.5, 1.6])
    windows = [(0.0, 1.0), (1.0, 2.0), (2.0, 3.0)]
    activity = note_activity_by_window(data, windows)
    assert [bucket["note_count"] for bucket in activity] == [1, 2, 0]
    assert activity[0]["active"] is True
    assert activity[2]["active"] is False
    assert activity[1]["pitch_range"] == {"min": 60, "max": 60}


# --- 0.2b: per-window pitch-class histogram + dominant PCs (Seam A) ----------


def _midi_with_pitched_onsets(events: list[tuple[float, int]]) -> bytes:
    # Same 1 sec == 960 ticks timing as _midi_with_onsets, but each onset names a pitch.
    midi = mido.MidiFile(ticks_per_beat=480)
    track = mido.MidiTrack()
    midi.tracks.append(track)
    prev_tick = 0
    for onset, pitch in events:
        tick = round(onset * 960)
        track.append(mido.Message("note_on", note=pitch, velocity=80, time=max(0, tick - prev_tick)))
        track.append(mido.Message("note_off", note=pitch, velocity=0, time=10))
        prev_tick = tick + 10
    buffer = io.BytesIO()
    midi.save(file=buffer)
    return buffer.getvalue()


def test_note_activity_by_window_accumulates_pitch_class_histogram():
    # window 0: C4(60) + C5(72) collapse to pitch class 0 (C); window 1: D(62) + G(67).
    data = _midi_with_pitched_onsets([(0.5, 60), (0.6, 72), (1.5, 62), (1.6, 67)])
    activity = note_activity_by_window(data, [(0.0, 1.0), (1.0, 2.0)])

    w0 = activity[0]
    assert w0["pitch_class_histogram"][0] == 2 and sum(w0["pitch_class_histogram"]) == 2
    assert w0["dominant_pitch_classes"] == [{"pc": 0, "note": "C", "count": 2}]

    w1 = activity[1]
    assert w1["pitch_class_histogram"][2] == 1 and w1["pitch_class_histogram"][7] == 1
    # count tie -> ordered by pitch-class index (D before G).
    assert [pc["note"] for pc in w1["dominant_pitch_classes"]] == ["D", "G"]


def test_dominant_pitch_classes_ranks_by_count_then_index_and_caps():
    histogram = [5, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 1]  # C=5, D=3, G=3, B=1
    dominant = dominant_pitch_classes(histogram, top_n=3)
    assert [pc["note"] for pc in dominant] == ["C", "D", "G"]  # B dropped by cap; D before G on tie
    assert dominant[0] == {"pc": 0, "note": "C", "count": 5}
    assert dominant_pitch_classes([0] * 12) == []


def test_stem_pitch_class_profile_sums_section_histograms():
    activity = [
        {"section_index": 0, "pitch_class_histogram": [2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]},
        {"section_index": 1, "pitch_class_histogram": [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]},
    ]
    profile = _stem_pitch_class_profile(activity)
    assert profile["pitch_class_histogram"][0] == 3  # C: 2 + 1
    assert profile["pitch_class_histogram"][2] == 1 and profile["pitch_class_histogram"][7] == 1
    assert profile["note_count"] == 5
    assert profile["dominant_pitch_classes"][0] == {"pc": 0, "note": "C", "count": 3}


def test_stem_pitch_class_profile_handles_empty_activity():
    profile = _stem_pitch_class_profile([])
    assert profile["pitch_class_histogram"] == [0] * 12
    assert profile["dominant_pitch_classes"] == []
    assert profile["note_count"] == 0


# --- 0.2 / 0.3 / 0.4: new query views over a canned pack (Seam B) -----------


def _pack() -> dict:
    return {
        "mix_dynamics": {
            "source": "basic_stats", "coarse": True, "rms": 0.1003, "peak_abs": 0.8884,
            "rms_dbfs": -20.0, "peak_dbfs": -1.0, "crest_db": 19.0, "dynamics": "dynamic",
            "zcr": 0.118, "sample_rate": 16000, "channels": 1,
        },
        "sections": [
            {"index": 0, "label": "intro", "section": "intro", "start_sec": 0.0, "end_sec": 4.0},
            {"index": 1, "label": "chorus", "section": "chorus", "start_sec": 4.0, "end_sec": 8.0},
        ],
        "midi": {
            "all_src": {},
            "stems": [
                {
                    "stem_id": "S05",
                    "label": "Lead Guitar",
                    "role": "guitar",
                    "tags": ["guitar", "solo"],
                    "is_drum": False,
                    "has_midi": True,
                    "integrated_loudness": -14.2,
                    "midi": {"total_notes": 120, "pitch_range": {"min": 52, "max": 76}},
                    "analysis": {
                        "status": "ok",
                        "keys": ["chords", "tonal_key"],
                        "chord_progression_count": 8,
                        "chords": [{"start_sec": 0.0, "end_sec": 2.0, "chord": "Bbm"}],
                        "sections": [],
                        "dynamics": {
                            "source": "basic_stats", "coarse": True, "rms": 0.047, "peak_abs": 0.398,
                            "rms_dbfs": -26.5, "peak_dbfs": -8.0, "crest_db": 18.5, "dynamics": "dynamic",
                            "zcr": 0.012, "sample_rate": 16000, "channels": 1,
                        },
                    },
                    "activity_by_section": [
                        {"section_index": 0, "active": False, "note_count": 0, "pitch_range": {"min": None, "max": None}, "mean_velocity": None, "pitch_class_histogram": [0] * 12, "dominant_pitch_classes": []},
                        {"section_index": 1, "active": True, "note_count": 44, "pitch_range": {"min": 55, "max": 76}, "mean_velocity": 81.0, "pitch_class_histogram": [20, 0, 0, 0, 0, 0, 0, 14, 0, 0, 10, 0], "dominant_pitch_classes": [{"pc": 0, "note": "C", "count": 20}, {"pc": 7, "note": "G", "count": 14}, {"pc": 10, "note": "A#", "count": 10}]},
                    ],
                    "pitch_class_profile": {
                        "pitch_class_histogram": [20, 0, 0, 0, 0, 0, 0, 14, 0, 0, 10, 0],
                        "dominant_pitch_classes": [{"pc": 0, "note": "C", "count": 20}, {"pc": 7, "note": "G", "count": 14}, {"pc": 10, "note": "A#", "count": 10}],
                        "note_count": 44,
                    },
                },
                {
                    "stem_id": "S02",
                    "label": "Bass",
                    "role": "bass",
                    "tags": ["bass"],
                    "is_drum": False,
                    "has_midi": False,
                    "integrated_loudness": -12.0,
                    "midi": {"error": "missing"},
                    "analysis": {"status": "missing"},
                },
            ],
        },
    }


class _FakeService:
    def __init__(self, pack: dict) -> None:
        self._pack_data = pack

    def ensure_current(self, song_id: str) -> dict:
        return self._pack_data


def _queries() -> SongFactPackQueries:
    return SongFactPackQueries(_FakeService(_pack()), "song-1")


def test_get_stems_is_a_lightweight_roster():
    result = _queries().get_stems()
    assert result["stem_count"] == 2
    lead = next(stem for stem in result["stems"] if stem["stem_id"] == "S05")
    assert lead["label"] == "Lead Guitar"
    assert lead["has_analysis"] is True
    bass = next(stem for stem in result["stems"] if stem["stem_id"] == "S02")
    assert bass["has_analysis"] is False
    # The roster must NOT carry heavy detail (no full chords/midi summaries).
    assert "chords" not in lead and "midi" not in lead


def test_get_stem_returns_full_detail_with_its_own_chords():
    result = _queries().get_stem("S05")
    stem = result["stem"]
    assert stem["label"] == "Lead Guitar"
    assert stem["analysis"]["chords"][0]["chord"] == "Bbm"
    assert stem["activity_by_section"][1]["note_count"] == 44


def test_get_stem_unknown_id_lists_available():
    result = _queries().get_stem("nope")
    assert "error" in result
    assert set(result["available"]) == {"S05", "S02"}


def test_get_stem_surfaces_pitch_class_profile():
    # 0.2b — drill-down exposes the stem's aggregate pitch content (root + fifth + ...).
    stem = _queries().get_stem("S05")["stem"]
    profile = stem["pitch_class_profile"]
    assert profile["note_count"] == 44
    assert [pc["note"] for pc in profile["dominant_pitch_classes"]] == ["C", "G", "A#"]


def test_get_section_activity_reports_active_parts_for_a_section():
    result = _queries().get_section_activity(section_index=1)
    assert result["sections_returned"] == 1
    section = result["activity"][0]
    assert section["label"] == "chorus"
    active = [part["stem_id"] for part in section["active_stems"]]
    assert active == ["S05"]  # lead guitar plays in the chorus
    assert result["stems_without_midi"] == ["S02"]


def test_get_section_activity_intro_has_no_active_stems():
    section = _queries().get_section_activity(section_index=0)["activity"][0]
    assert section["active_stems"] == []


def test_get_section_activity_surfaces_dominant_pitch_classes_per_part():
    # 0.2b — each part reports the notes it leans on in this section, so it can be
    # compared to the section's chords with no per-stem analysis needed.
    section = _queries().get_section_activity(section_index=1)["activity"][0]
    lead = next(part for part in section["active_stems"] if part["stem_id"] == "S05")
    assert [pc["note"] for pc in lead["dominant_pitch_classes"]] == ["C", "G", "A#"]


# --- 0.3: retrieval discipline — roster-and-drill, no default dumping (Seam B) -


_ROSTER_FIELDS = {"stem_id", "label", "role", "tags", "is_drum", "has_midi", "has_analysis", "integrated_loudness"}


def test_get_midi_tracks_returns_roster_not_per_stem_dump():
    # The MIDI tool keeps the mix-level summary but stops embedding every per-stem
    # MIDI/analysis block; it hands back a roster + a drill hint instead.
    result = _queries().get_midi_tracks()
    assert "all_src" in result  # mix-level MIDI is still the point of this tool
    assert result["stem_count"] == 2
    assert "hint" in result
    lead = next(stem for stem in result["stems"] if stem["stem_id"] == "S05")
    assert set(lead) == _ROSTER_FIELDS
    assert lead["has_midi"] is True and lead["has_analysis"] is True
    # the heavy per-stem detail must NOT ride along by default
    assert "midi" not in lead and "analysis" not in lead and "chords" not in lead


def test_get_song_slice_lists_parts_as_roster_not_full_summaries():
    # A slice is a musical passage view: it keeps tempo/key/chords/sections and now
    # references the cast as a lightweight `parts` roster (not the old midi_tracks dump).
    result = _queries().get_song_slice(0.0, 8.0)
    assert "chords" in result and "key" in result and result["sections"]
    assert "midi_tracks" not in result  # the heavy dump is gone
    assert "hint" in result
    parts = result["parts"]
    # ALL parts are present (has_midi distinguishes which carry MIDI), per the design call.
    assert {part["stem_id"] for part in parts} == {"S05", "S02"}
    for part in parts:
        assert set(part) == _ROSTER_FIELDS
        assert "analysis" not in part and "midi" not in part
    by_id = {part["stem_id"]: part for part in parts}
    assert by_id["S05"]["has_midi"] is True
    assert by_id["S02"]["has_midi"] is False


def test_get_stems_roster_matches_shared_entry_shape():
    # get_stems / get_midi_tracks / get_song_slice all share one roster shape.
    stems = _queries().get_stems()["stems"]
    assert all(set(stem) == _ROSTER_FIELDS for stem in stems)


# --- 0.5: seeded song overview (Seam B — pure assembly + cache key) ----------


def _overview_pack() -> dict:
    return {
        "version": 5,
        "created_at": "2026-06-17T00:00:00Z",
        "song_id": "song-1",
        "song": {"title": "Track00001", "artist": "BabySlakh", "duration_sec": 24.0},
        "duration_sec": 24.0,
        "tempo": {"bpm": 120.0, "confidence": "medium"},
        "confidence": {"overall": "medium"},
        "key": {
            "teaching_key": {"label": "G minor"},
            "detected_key": {"label": "Bb minor"},
            "key_conflict": True,
        },
        "sections": [{"index": 0}, {"index": 1}, {"index": 2}, {"index": 3}],
        "evidence": {"analysis_keys": ["chords", "tonal_key", "tempo_beats", "structure_msaf"]},
        "mix_dynamics": {
            "source": "basic_stats", "coarse": True, "rms": 0.1003, "peak_abs": 0.8884,
            "rms_dbfs": -20.0, "peak_dbfs": -1.0, "crest_db": 19.0, "dynamics": "dynamic",
            "zcr": 0.118, "sample_rate": 16000, "channels": 1,
        },
        "midi": {
            "stems": [
                {
                    "stem_id": "S05", "label": "Lead Guitar", "role": "guitar", "tags": ["solo"],
                    "is_drum": False, "has_midi": True, "integrated_loudness": -14.2,
                    "analysis": {"status": "ok"},
                },
                {
                    "stem_id": "S02", "label": "Bass", "role": "bass", "tags": ["bass"],
                    "is_drum": False, "has_midi": True, "integrated_loudness": -12.0,
                    "analysis": {"status": "missing"},
                },
            ],
        },
    }


def test_build_song_overview_compacts_the_pack():
    overview = build_song_overview(_overview_pack())
    assert overview["duration_sec"] == 24.0
    assert overview["tempo_bpm"] == 120.0 and overview["tempo_confidence"] == "medium"
    assert overview["teaching_key"] == "G minor" and overview["detected_key"] == "Bb minor"
    assert overview["key_conflict"] is True
    assert overview["section_count"] == 4
    assert overview["overall_confidence"] == "medium"
    assert overview["available_analyses"] == ["chords", "tonal_key", "tempo_beats", "structure_msaf"]
    # Parts reuse the shared roster shape exactly — the overview never diverges from get_stems.
    assert all(set(part) == _ROSTER_FIELDS for part in overview["parts"])
    lead = next(part for part in overview["parts"] if part["stem_id"] == "S05")
    assert lead["has_analysis"] is True
    bass = next(part for part in overview["parts"] if part["stem_id"] == "S02")
    assert bass["has_analysis"] is False and bass["has_midi"] is True


def test_render_song_overview_includes_conflict_and_parts():
    text = render_song_overview(build_song_overview(_overview_pack()))
    assert "NO tool calls" in text
    assert "KEY CONFLICT" in text and "G minor" in text and "Bb minor" in text
    assert "Lead Guitar" in text and "Bass" in text
    assert "get_stem(stem_id)" in text
    assert "Parts (2)" in text
    # 0.6 — the parts table renders a tags column (comma-joined; "—" when empty).
    assert "| id | part | role | tags |" in text
    assert "solo" in text


def test_render_song_overview_renders_tags_column_with_empty_fallback():
    pack = _overview_pack()
    pack["midi"]["stems"][1]["tags"] = []  # Bass has no tags
    text = render_song_overview(build_song_overview(pack))
    bass_row = next(line for line in text.splitlines() if "Bass" in line and "|" in line)
    assert "| — |" in bass_row  # empty tags render as the em dash fallback


def test_render_song_overview_handles_missing_key():
    pack = _overview_pack()
    pack["key"] = {}
    text = render_song_overview(build_song_overview(pack))
    assert "Key: not detected." in text
    assert "KEY CONFLICT" not in text


def test_render_song_overview_agreeing_key_has_no_conflict():
    pack = _overview_pack()
    pack["key"] = {
        "teaching_key": {"label": "C major"},
        "detected_key": {"label": "C major"},
        "key_conflict": False,
    }
    text = render_song_overview(build_song_overview(pack))
    assert "KEY CONFLICT" not in text
    assert "teaching and detected agree" in text


def test_agent_cache_key_distinguishes_model_and_pack_identity():
    pack_v5 = {"version": 5, "created_at": "2026-06-17T00:00:00Z"}
    pack_v5_rebuilt = {"version": 5, "created_at": "2026-06-17T01:00:00Z"}
    pack_v6 = {"version": 6, "created_at": "2026-06-17T00:00:00Z"}
    key = _agent_cache_key
    # Switching model must not reuse a runner bound to the old model.
    assert key("s1", "openai/a", pack_v5) != key("s1", "openai/b", pack_v5)
    # Same version but rebuilt content (re-analysis) must bust the baked-in overview.
    assert key("s1", "m", pack_v5) != key("s1", "m", pack_v5_rebuilt)
    # A FACT_PACK_VERSION bump must bust it too.
    assert key("s1", "m", pack_v5) != key("s1", "m", pack_v6)
    # No pack yet → a stable sentinel (so repeated blind-start calls share one runner).
    assert key("s1", "m", None) == "s1|m|nopack"
    assert key("s1", "m", None) == key("s1", "m", None)
    # Deterministic for the same inputs (the cached prefix must be reused).
    assert key("s1", "m", pack_v5) == key("s1", "m", pack_v5)


# --- 0.6 + #17: retrieval-discipline docstrings, no subagent surface (Seam B) --


class _FakeFactPack:
    """describe_tools / create_agent_runner only wire — they never read a song. The
    closures are built with this stub and only have their signatures/docstrings read."""

    def query(self, song_id: str):  # noqa: ARG002 - closures capture but never call it here
        return object()


def _tools_by_name() -> dict:
    return {tool["name"]: tool for tool in describe_tools(_FakeFactPack())}


def test_no_task_tool_after_roster_trim():
    """#17: the specialist roster is removed and the DeepAgents default
    general-purpose subagent is disabled via the litellm harness profile, so no
    `task` tool may be bound. A deepagents upgrade that silently re-adds the
    default must fail here. (settings is only consulted when model is omitted,
    and building the graph never calls the LLM.)"""
    runner = create_agent_runner(None, _FakeFactPack(), "song-x", model="openai/gpt-5.4-nano")
    bound_tools = set(runner.nodes["tools"].bound.tools_by_name)
    assert "task" not in bound_tools
    # The 7 fact-pack tools (+ get_stems/get_stem) must still be bound.
    assert {"get_sections", "get_bar_grid", "get_stem"} <= bound_tools


def test_bar_grid_docstring_carries_meter_provenance():
    """The rhythm specialist's one unique instruction survives the trim as
    tool-docstring guidance: bar provenance must be stated in answers."""
    desc = _tools_by_name()["get_bar_grid"]["description"].lower()
    assert "meter.source" in desc
    assert "downbeats" in desc and "beat grouping" in desc


def test_get_stems_docstring_demoted_to_thin_use_case():
    desc = _tools_by_name()["get_stems"]["description"].lower()
    assert "overview" in desc  # the roster already lives in the seeded overview
    assert "refresh" in desc and "fallback" in desc  # its two thin remaining jobs


def test_pitch_class_fields_named_in_drill_tool_docstrings():
    tools = _tools_by_name()
    assert "pitch_class_profile" in tools["get_stem"]["description"]
    assert "dominant_pitch_classes" in tools["get_section_activity"]["description"]


# --- 0.7: mix (and analyzed-stem) dynamics from basic_stats ------------------


def _basic_stats_analyses(*, rms=0.1003, peak_abs=0.8884, zcr=0.118, ok=True, with_data=True) -> dict:
    """The real basic_stats envelope shape (analyzer v0.1.0): a report dict with an
    `ok` flag + a `data` blob of whole-track linear measures. No LUFS by design."""
    report: dict = {"ok": ok, "version": "0.1.0", "error": None}
    if with_data:
        report["data"] = {
            "sr": 16000, "rms": rms, "zcr": zcr, "channels": 1, "peak_abs": peak_abs,
            "codec": "pcm_s16le", "bit_rate": 256001, "byte_size": 7729876, "duration_sec": 241.5,
        }
    return {"basic_stats": report, "tempo_beats": {"data": {}}}


def test_build_mix_dynamics_converts_peak_rms_to_dbfs_and_crest():
    dyn = _build_mix_dynamics(_basic_stats_analyses())
    assert dyn is not None
    assert dyn["source"] == "basic_stats" and dyn["coarse"] is True
    # 20*log10(0.8884) ≈ -1.0 ; 20*log10(0.1003) ≈ -20.0 ; crest = peak - rms.
    assert dyn["peak_dbfs"] == -1.0
    assert dyn["rms_dbfs"] == -20.0
    assert dyn["crest_db"] == 19.0
    assert dyn["dynamics"] == "dynamic"  # crest >= 18 dB
    assert dyn["zcr"] == 0.118 and dyn["sample_rate"] == 16000 and dyn["channels"] == 1
    # Raw linear amplitudes are kept as evidence...
    assert dyn["rms"] == 0.1003 and dyn["peak_abs"] == 0.8884
    # ...but the non-musical format trivia is dropped.
    assert "codec" not in dyn and "bit_rate" not in dyn and "byte_size" not in dyn


def test_build_mix_dynamics_absent_or_failed_returns_none():
    assert _build_mix_dynamics({"tempo_beats": {"data": {}}}) is None  # basic_stats absent
    assert _build_mix_dynamics(_basic_stats_analyses(ok=False)) is None  # analyzer failed
    assert _build_mix_dynamics(_basic_stats_analyses(with_data=False)) is None  # no data blob


def test_build_mix_dynamics_guards_nonpositive_amplitudes():
    # log10(0) is undefined — a silent/degenerate track must not crash the build.
    assert _build_mix_dynamics(_basic_stats_analyses(rms=0.0)) is None
    assert _build_mix_dynamics(_basic_stats_analyses(peak_abs=0.0)) is None


def test_build_mix_dynamics_omits_zcr_when_missing():
    analyses = _basic_stats_analyses()
    del analyses["basic_stats"]["data"]["zcr"]
    dyn = _build_mix_dynamics(analyses)
    assert dyn is not None and "zcr" not in dyn


def test_crest_descriptor_bands():
    assert _crest_descriptor(8.0) == "compressed"
    assert _crest_descriptor(11.9) == "compressed"
    assert _crest_descriptor(12.0) == "moderate"
    assert _crest_descriptor(17.9) == "moderate"
    assert _crest_descriptor(18.0) == "dynamic"
    assert _crest_descriptor(25.0) == "dynamic"


def test_get_song_slice_carries_whole_mix_dynamics():
    # mix_dynamics is global like key/tempo — present on the slice regardless of range.
    result = _queries().get_song_slice(0.0, 8.0)
    dyn = result["mix_dynamics"]
    assert dyn["crest_db"] == 19.0 and dyn["dynamics"] == "dynamic"


def test_get_stem_surfaces_its_own_dynamics_when_analyzed():
    stem = _queries().get_stem("S05")["stem"]
    dyn = stem["analysis"]["dynamics"]
    assert dyn["source"] == "basic_stats" and dyn["crest_db"] == 18.5
    # The part's own dynamics is distinct from its LUFS loudness — no conflation.
    assert stem["integrated_loudness"] == -14.2


def test_get_stem_without_analysis_has_no_dynamics_and_does_not_crash():
    stem = _queries().get_stem("S02")["stem"]
    assert stem["analysis"] == {"status": "missing"}
    assert "dynamics" not in stem["analysis"]


def test_build_song_overview_carries_mix_dynamics():
    overview = build_song_overview(_overview_pack())
    assert overview["mix_dynamics"]["crest_db"] == 19.0


def test_render_song_overview_includes_mix_dynamics_line():
    text = render_song_overview(build_song_overview(_overview_pack()))
    assert "Mix dynamics:" in text
    assert "peak -1.0 dBFS" in text and "avg -20.0 dBFS" in text
    assert "crest 19.0 dB (dynamic)" in text
    assert "brightness(zcr) 0.12" in text
    assert "coarse (16 kHz mono)" in text


def test_render_song_overview_omits_dynamics_line_when_absent():
    pack = _overview_pack()
    pack["mix_dynamics"] = None  # a pack built before basic_stats existed
    text = render_song_overview(build_song_overview(pack))
    assert "Mix dynamics:" not in text
