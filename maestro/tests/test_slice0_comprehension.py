"""Slice 0 — fact-pack comprehension (stem identity, per-stem detail, section activity).

Seam A: the stem-identity port + the MIDI section-activity rollup are pure
functions over fake inputs. Seam B: the new query views are pure functions over a
canned fact pack (no Supabase, no live LLM).
"""

from __future__ import annotations

import io

import mido

from maestro_agent.fact_pack import SongFactPackQueries, _stem_pitch_class_profile
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
