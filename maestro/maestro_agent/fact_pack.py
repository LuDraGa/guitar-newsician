"""SongFactPack: canonical per-song facts + filtered query helpers.

Ported from the POC. The music logic (sections, bar grid, chords, key
resolution incl. detected-vs-teaching key, transpose, the bounded query views)
is verbatim. Only `SongFactPackService` is rewritten: it reads via the WereCode
data adapter (Supabase) instead of local BabySlakh files, and persists the pack
as an `analysis_results` row instead of a JSON file beside the track.
"""

from __future__ import annotations

import re
import statistics
import time
from typing import Any

from maestro_agent.midi import dominant_pitch_classes, note_activity_by_window, summarize_midi_bytes
from maestro_agent.werecode_data import AnalysisUnavailable, WereCodeSongData

FACT_PACK_SCHEMA = "maestro.song_fact_pack.v1"
# v5 (2026-06-16, Freshness): the pack stores a `dependency_fingerprint` (asset
# checksums + current analysis-row identities) so a re-analysis is detectable for
# the staleness signal. Bumping rebuilds every pack once so the field is present.
# v4 (Slice 0.2b): per-section activity carries a 12-bin pitch-class histogram +
# dominant pitch classes, and each stem gains an aggregate pitch_class_profile.
# v3: stems carry precise identity (label/tags), their own bounded chord
# progression + sections, and per-section activity. Bumping forces ensure_current
# to rebuild older packs so the role axis is populated.
FACT_PACK_VERSION = 5
MAX_TOOL_CHORDS = 64
MAX_TRANSPOSE_PREVIEW = 96
MAX_STEM_PROGRESSION = 64
KEY_FIT_TIE_WINDOW = 0.06

PITCH_CLASS_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
PITCH_CLASS_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
MAJOR_SCALE_PCS = {0, 2, 4, 5, 7, 9, 11}
MINOR_SCALE_PCS = {0, 2, 3, 5, 7, 8, 10}
NOTE_TO_PC = {
    "C": 0, "B#": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "Fb": 4,
    "E#": 5, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10,
    "Bb": 10, "B": 11, "Cb": 11,
}


class FactPackUnavailable(RuntimeError):
    """Raised when a song cannot produce a SongFactPack."""


class SongFactPackService:
    """Build, save, load, and query one song's canonical SongFactPack."""

    def __init__(self, data: WereCodeSongData) -> None:
        self.data = data

    def build(self, song_id: str) -> dict[str, Any]:
        pack = self._build_pack(song_id)
        self.data.save_fact_pack(song_id, pack["song"].get("owner_id"), pack)
        return pack

    def get_latest(self, song_id: str) -> dict[str, Any]:
        pack = self.data.get_latest_fact_pack(song_id)
        if pack is None:
            raise FileNotFoundError(f"No SongFactPack for song {song_id}")
        return pack

    def ensure_current(self, song_id: str) -> dict[str, Any]:
        current_hashes = self.data.asset_checksums(song_id)
        latest = self.data.get_latest_fact_pack(song_id)
        if latest and latest.get("source_hashes") == current_hashes and latest.get("version") == FACT_PACK_VERSION:
            return latest
        return self.build(song_id)

    def query(self, song_id: str) -> "SongFactPackQueries":
        return SongFactPackQueries(self, song_id)

    def status(self, song_id: str) -> dict[str, Any]:
        """Cheap, read-only freshness check: does the latest pack still reflect
        the song's current inputs? Recomputes the dependency fingerprint from
        metadata only (no MIDI, no rebuild) and diffs it against the stored one.
        Drives the chat-window staleness signal; never triggers a build."""
        latest = self.data.get_latest_fact_pack(song_id)
        if latest is None:
            return {
                "song_id": song_id,
                "has_pack": False,
                "stale": True,
                "version": None,
                "current_version": FACT_PACK_VERSION,
                "built_at": None,
                "reasons": ["Maestro hasn't studied this song yet."],
            }
        version = latest.get("version")
        current = self.data.dependency_signature(song_id)
        stored = latest.get("dependency_fingerprint")
        reasons = _fingerprint_reasons(stored, current)
        if version != FACT_PACK_VERSION:
            reasons = [f"Maestro's analysis format changed (v{version} → v{FACT_PACK_VERSION})."] + reasons
        return {
            "song_id": song_id,
            "has_pack": True,
            "stale": bool(reasons),
            "version": version,
            "current_version": FACT_PACK_VERSION,
            "built_at": latest.get("created_at"),
            "reasons": reasons,
        }

    def _build_pack(self, song_id: str) -> dict[str, Any]:
        song = self.data.get_song(song_id)
        try:
            mix_analysis = self.data.get_mix_analysis(song_id)
        except AnalysisUnavailable as exc:
            raise FactPackUnavailable(str(exc)) from exc

        analyses = mix_analysis.get("response", {}).get("analyses", {})
        midi_summary = _safe_midi_bytes(self.data.download_full_midi_bytes(song_id), "source_midi", max_notes=128)
        created_at = _now_iso()
        # Sections are computed before stems so each stem can roll its note onsets
        # into the section windows (the Section × Role activity, 0.4).
        sections = _build_sections(analyses)
        stems = self.data.list_stems(song_id)
        stem_summaries = [self._stem_summary(song_id, stem, max_notes=32, sections=sections) for stem in stems]

        bar_grid = _build_bar_grid(analyses, midi_summary)
        chords = _build_chords(analyses)
        tempo = _build_tempo(analyses)
        key = _build_key(analyses, chords)
        source_hashes = self.data.asset_checksums(song_id)

        return {
            "schema": FACT_PACK_SCHEMA,
            "version": FACT_PACK_VERSION,
            "song_id": song_id,
            "created_at": created_at,
            "song": {
                "song_id": song_id,
                "owner_id": song.get("owner_id"),
                "title": song.get("title"),
                "artist": song.get("artist"),
                "duration_sec": song.get("duration_sec"),
                "source_kind": song.get("source_kind"),
                "stems": stems,
            },
            "source_hashes": source_hashes,
            # Full input fingerprint (assets + analysis rows) for the staleness
            # signal — broader than source_hashes, which drives ensure_current.
            "dependency_fingerprint": self.data.dependency_signature(song_id),
            "source_artifacts": self.data.asset_manifest(song_id),
            "analysis_versions": _analysis_versions(mix_analysis, stem_summaries),
            "tool_versions": {"song_fact_pack": str(FACT_PACK_VERSION), "midi_summary": "1"},
            "duration_sec": analyses.get("_meta", {}).get("duration_sec"),
            "confidence": {
                "overall": _overall_confidence(
                    [tempo.get("confidence"), _key_confidence(key), bar_grid.get("meter_confidence")]
                ),
                "bar_grid": bar_grid.get("meter_confidence"),
                "key": _key_confidence(key),
                "tempo": tempo.get("confidence"),
            },
            "evidence": {
                "analysis_source": "analysis_results.maestro_mix_analysis",
                "analysis_keys": list(analyses.keys()),
                "midi_summary": "source_midi",
                "raw_chord_frames_in_fact_pack": False,
            },
            "tempo": tempo,
            "key": key,
            "sections": sections,
            "bar_grid": bar_grid,
            "chords": chords,
            "midi": {
                "all_src": _compact_midi_summary(midi_summary),
                "stems": stem_summaries,
            },
        }

    def _stem_summary(
        self,
        song_id: str,
        stem: dict[str, Any],
        *,
        max_notes: int,
        sections: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        stem_id = str(stem["stem_id"])
        summary: dict[str, Any] = {
            "stem_id": stem_id,
            # 0.1 — precise identity carried through from the adapter.
            "label": stem.get("label"),
            "role": stem.get("role"),
            "tags": stem.get("tags") or [],
            "inst_class": stem.get("inst_class"),
            "midi_program_name": stem.get("midi_program_name"),
            "program_num": stem.get("program_num"),
            "is_drum": bool(stem.get("is_drum")),
            "plugin_name": stem.get("plugin_name"),
            "integrated_loudness": stem.get("integrated_loudness"),
            "has_audio": bool(stem.get("has_audio")),
            "has_midi": bool(stem.get("has_midi")),
        }
        midi_bytes = self.data.download_stem_midi_bytes(song_id, stem_id) if stem.get("has_midi") else None
        summary["midi"] = _compact_midi_summary(_safe_midi_bytes(midi_bytes, f"stem:{stem_id}", max_notes=max_notes))

        # 0.4 — per-section note activity (the deterministic Section × Role rollup).
        # 0.2b — and an aggregate pitch-class profile so a stem without per-stem
        # chord analysis is still comparable to the mix's chord roots.
        if sections and midi_bytes:
            activity = _stem_activity_by_section(midi_bytes, sections)
            summary["activity_by_section"] = activity
            summary["pitch_class_profile"] = _stem_pitch_class_profile(activity)

        analysis = self.data.get_stem_analysis(song_id, stem_id)
        if analysis is None:
            summary["analysis"] = {"status": "missing"}
        else:
            analyses = analysis.get("response", {}).get("analyses", {})
            # 0.2 — keep the stem's own progression + sections, not just a count, so
            # questions like "does the bass follow the mix's chords?" are answerable.
            stem_chords = _build_chords(analyses)
            summary["analysis"] = {
                "status": analysis.get("response", {}).get("status"),
                "keys": list(analyses.keys()),
                "tempo": _build_tempo(analyses),
                "key": _build_key(analyses, stem_chords),
                "chord_progression_count": stem_chords["progression_count"],
                "chord_mean_conf": stem_chords["mean_conf"],
                "chords": stem_chords["progression"][:MAX_STEM_PROGRESSION],
                "chords_truncated": stem_chords["progression_count"] > MAX_STEM_PROGRESSION,
                "sections": _build_sections(analyses),
            }
        return summary


class SongFactPackQueries:
    """Filtered views over the current song SongFactPack (the agent's tools)."""

    def __init__(self, service: SongFactPackService, song_id: str) -> None:
        self.service = service
        self.song_id = song_id

    def get_sections(self) -> dict[str, Any]:
        pack = self._pack()
        return {
            "song_id": self.song_id,
            "sections": pack.get("sections", []),
            "evidence": {"source": "song_fact_pack.sections"},
        }

    def get_bar_grid(self, start_sec: float | None = None, end_sec: float | None = None) -> dict[str, Any]:
        pack = self._pack()
        grid = pack.get("bar_grid", {})
        bars = _filter_range(grid.get("bars", []), start_sec, end_sec)
        return {
            "song_id": self.song_id,
            "meter": {
                "beats_per_bar": grid.get("beats_per_bar"),
                "source": grid.get("meter_source"),
                "confidence": grid.get("meter_confidence"),
                "time_signatures": grid.get("time_signatures", []),
            },
            "bar_count": grid.get("bar_count"),
            "bars": bars,
        }

    def get_chords(
        self,
        start_sec: float | None = None,
        end_sec: float | None = None,
        limit: int = MAX_TOOL_CHORDS,
    ) -> dict[str, Any]:
        pack = self._pack()
        chords = pack.get("chords", {})
        progression = _filter_range(chords.get("progression", []), start_sec, end_sec)
        safe_limit = max(1, min(int(limit), 256))
        return {
            "song_id": self.song_id,
            "frames_hz": chords.get("frames_hz"),
            "requested_rate_hz": chords.get("requested_rate_hz"),
            "progression_count": len(progression),
            "returned": min(len(progression), safe_limit),
            "truncated": len(progression) > safe_limit,
            "progression": progression[:safe_limit],
            "evidence": {"source": "song_fact_pack.chords.progression"},
        }

    def get_key(self) -> dict[str, Any]:
        pack = self._pack()
        return {"song_id": self.song_id, **pack.get("key", {})}

    def get_midi_tracks(self) -> dict[str, Any]:
        pack = self._pack()
        midi = pack.get("midi", {})
        return {
            "song_id": self.song_id,
            "all_src": _midi_tool_summary(midi.get("all_src", {})),
            "stems": [_stem_tool_summary(stem) for stem in midi.get("stems", [])],
            "evidence": {"source": "song_fact_pack.midi"},
        }

    def get_stems(self) -> dict[str, Any]:
        """Lightweight stem roster (identity only) — the cheap entry point before
        drilling into one part with get_stem."""
        pack = self._pack()
        stems = pack.get("midi", {}).get("stems", [])
        return {
            "song_id": self.song_id,
            "stem_count": len(stems),
            "stems": [
                {
                    "stem_id": stem.get("stem_id"),
                    "label": stem.get("label"),
                    "role": stem.get("role"),
                    "tags": stem.get("tags") or [],
                    "is_drum": stem.get("is_drum"),
                    "has_midi": stem.get("has_midi"),
                    "has_analysis": (stem.get("analysis") or {}).get("status") not in (None, "missing"),
                    "integrated_loudness": stem.get("integrated_loudness"),
                }
                for stem in stems
            ],
            "evidence": {"source": "song_fact_pack.midi.stems"},
        }

    def get_stem(self, stem_id: str) -> dict[str, Any]:
        """Full detail for one stem/part: identity + MIDI summary + its own analysis
        (key/tempo/chords/sections) + per-section activity."""
        pack = self._pack()
        stems = pack.get("midi", {}).get("stems", [])
        target = next((stem for stem in stems if str(stem.get("stem_id")) == str(stem_id)), None)
        if target is None:
            return {
                "song_id": self.song_id,
                "error": f"No stem '{stem_id}' for this song.",
                "available": [stem.get("stem_id") for stem in stems],
            }
        return {
            "song_id": self.song_id,
            "stem": _stem_detail(target),
            "evidence": {"source": "song_fact_pack.midi.stems[stem_id]"},
        }

    def get_section_activity(
        self,
        section_index: int | None = None,
        start_sec: float | None = None,
        end_sec: float | None = None,
    ) -> dict[str, Any]:
        """Which stems play in a section (or time range) and a compact part summary
        for each — the time × role cross. Defaults to all sections if unscoped."""
        pack = self._pack()
        sections = pack.get("sections", [])
        stems = pack.get("midi", {}).get("stems", [])
        targets = _select_sections(sections, section_index, start_sec, end_sec)
        activity: list[dict[str, Any]] = []
        for section in targets:
            index = section.get("index")
            parts: list[dict[str, Any]] = []
            for stem in stems:
                act = _activity_for_index(stem, index)
                if act is None:
                    continue
                parts.append(
                    {
                        "stem_id": stem.get("stem_id"),
                        "label": stem.get("label"),
                        "role": stem.get("role"),
                        "active": act.get("active"),
                        "note_count": act.get("note_count"),
                        "pitch_range": act.get("pitch_range"),
                        "mean_velocity": act.get("mean_velocity"),
                        # 0.2b — what notes this part leans on here, so it can be
                        # compared to the section's chords without per-stem analysis.
                        "dominant_pitch_classes": act.get("dominant_pitch_classes") or [],
                    }
                )
            activity.append(
                {
                    "section_index": index,
                    "label": section.get("label"),
                    "section": section.get("section"),
                    "start_sec": section.get("start_sec"),
                    "end_sec": section.get("end_sec"),
                    "active_stems": [part for part in parts if part["active"]],
                    "all_parts": parts,
                }
            )
        return {
            "song_id": self.song_id,
            "sections_returned": len(activity),
            "activity": activity,
            "stems_without_midi": [stem.get("stem_id") for stem in stems if not stem.get("has_midi")],
            "evidence": {"source": "song_fact_pack.midi.stems[].activity_by_section"},
        }

    def get_song_slice(self, start_sec: float, end_sec: float) -> dict[str, Any]:
        start = float(start_sec)
        end = float(end_sec)
        if end < start:
            start, end = end, start
        pack = self._pack()
        return {
            "song_id": self.song_id,
            "range": {"start_sec": start, "end_sec": end},
            "tempo": pack.get("tempo", {}),
            "key": pack.get("key", {}),
            "sections": _filter_range(pack.get("sections", []), start, end),
            "bars": _filter_range(pack.get("bar_grid", {}).get("bars", []), start, end),
            "chords": self.get_chords(start, end, limit=MAX_TOOL_CHORDS),
            "midi_tracks": [_stem_tool_summary(stem) for stem in pack.get("midi", {}).get("stems", [])],
        }

    def transpose_song(self, semitones: int | None = None, target_key: str | None = None) -> dict[str, Any]:
        pack = self._pack()
        key = pack.get("key", {})
        teaching_key = key.get("teaching_key") or {}
        detected_key = key.get("detected_key") or {}
        current_key = teaching_key.get("key") or detected_key.get("key")
        interval = _transpose_interval(current_key, semitones, target_key)
        chords = pack.get("chords", {}).get("progression", [])
        transposed = [
            {
                **entry,
                "original_chord": entry.get("chord"),
                "chord": _transpose_chord(str(entry.get("chord")), interval, target_key or current_key),
            }
            for entry in chords[:MAX_TRANSPOSE_PREVIEW]
        ]
        transposed_key = _transpose_note(str(current_key), interval, target_key or current_key) if current_key else None
        return {
            "song_id": self.song_id,
            "source_key": key,
            "source_key_label": teaching_key.get("label") or detected_key.get("label"),
            "target_key": target_key or transposed_key,
            "semitones": interval,
            "progression_count": len(chords),
            "returned": len(transposed),
            "truncated": len(chords) > len(transposed),
            "progression_preview": transposed,
            "evidence": {"source": "song_fact_pack.chords.progression"},
        }

    def _pack(self) -> dict[str, Any]:
        return self.service.ensure_current(self.song_id)


# --- pure builders (ported verbatim from the POC) ---------------------------


def _build_sections(analyses: dict[str, Any]) -> list[dict[str, Any]]:
    report = analyses.get("structure_msaf", {})
    data = report.get("data") or {}
    segments = data.get("mapped_segments") or data.get("segments") or []
    sections: list[dict[str, Any]] = []
    for index, segment in enumerate(segments):
        start = _float(segment.get("start_sec"))
        end = _float(segment.get("end_sec"))
        sections.append(
            {
                "index": index,
                "start_sec": start,
                "end_sec": end,
                "duration_sec": round(max(0.0, end - start), 6),
                "label": segment.get("label"),
                "section": segment.get("section") or "section",
                "confidence": "medium" if report.get("ok") else "low",
                "evidence": "structure_msaf.mapped_segments" if data.get("mapped_segments") else "structure_msaf.segments",
            }
        )
    return sections


def _build_bar_grid(analyses: dict[str, Any], midi_summary: dict[str, Any]) -> dict[str, Any]:
    tempo_data = analyses.get("tempo_beats", {}).get("data") or {}
    beats = [_float(value) for value in tempo_data.get("beats_sec") or []]
    downbeats = [_float(value) for value in tempo_data.get("downbeats_sec") or []]
    duration = _float(analyses.get("_meta", {}).get("duration_sec"))
    time_signatures = midi_summary.get("time_signatures") or []
    explicit = time_signatures[0] if time_signatures else None
    beats_per_bar = int(explicit.get("numerator")) if explicit else 4

    if len(downbeats) >= 2:
        starts = downbeats
        meter_source = "midi_time_signature" if explicit else "analysis_downbeats"
        meter_confidence = "high" if explicit else "medium"
    else:
        starts = beats[::beats_per_bar] if beats else [0.0]
        meter_source = "midi_time_signature" if explicit else "beat_grouping"
        meter_confidence = "medium" if explicit else "low"

    bars: list[dict[str, Any]] = []
    for index, start in enumerate(starts):
        if index + 1 < len(starts):
            end = starts[index + 1]
        elif duration:
            end = duration
        elif beats:
            end = beats[-1]
        else:
            end = duration
        if end <= start:
            end = duration or start
        bar_beats = [beat for beat in beats if beat >= start and (not end or beat < end)]
        bars.append(
            {
                "bar": index + 1,
                "start_sec": round(start, 6),
                "end_sec": round(end, 6),
                "duration_sec": round(max(0.0, end - start), 6),
                "beats": [round(beat, 6) for beat in bar_beats[:beats_per_bar]],
                "beat_count": len(bar_beats),
            }
        )
    return {
        "beats_per_bar": beats_per_bar,
        "meter_source": meter_source,
        "meter_confidence": meter_confidence,
        "time_signatures": time_signatures,
        "beat_count": len(beats),
        "downbeat_count": len(downbeats),
        "bar_count": len(bars),
        "bars": bars,
        "evidence": "tempo_beats.data + midi.time_signatures",
    }


def _build_chords(analyses: dict[str, Any]) -> dict[str, Any]:
    data = analyses.get("chords", {}).get("data") or {}
    progression = [
        {
            "start_sec": _float(entry.get("start_sec")),
            "end_sec": _float(entry.get("end_sec")),
            "chord": entry.get("chord"),
            "mean_conf": entry.get("mean_conf"),
        }
        for entry in data.get("progression") or []
    ]
    confidences = [entry["mean_conf"] for entry in progression if isinstance(entry.get("mean_conf"), (int, float))]
    return {
        "frames_hz": data.get("frames_hz"),
        "requested_rate_hz": data.get("requested_rate_hz"),
        "progression_count": len(progression),
        "per_frame_count": len(data.get("per_frame") or []),
        "mean_conf": round(statistics.fmean(confidences), 6) if confidences else None,
        "progression": progression,
        "transpose_map": data.get("transpose_map") or {},
        "transposed_to_key": data.get("transposed_to_key"),
        "raw_per_frame_omitted": True,
    }


def _build_tempo(analyses: dict[str, Any]) -> dict[str, Any]:
    data = analyses.get("tempo_beats", {}).get("data") or {}
    confidence_value = data.get("beat_confidence")
    return {
        "bpm": data.get("bpm"),
        "beat_confidence": confidence_value,
        "confidence": _numeric_confidence(confidence_value, high=4.0, medium=1.5),
        "beat_count": len(data.get("beats_sec") or []),
        "downbeat_count": len(data.get("downbeats_sec") or []),
        "tempo_map_count": len(data.get("tempo_map_bpm") or []),
    }


def _build_key(analyses: dict[str, Any], chords: dict[str, Any] | None = None) -> dict[str, Any]:
    data = analyses.get("tonal_key", {}).get("data") or {}
    strength = data.get("strength")
    detected = {
        "key": data.get("key"),
        "scale": data.get("scale"),
        "label": _key_label(data.get("key"), data.get("scale")),
        "strength": strength,
        "confidence": _numeric_confidence(strength, high=0.75, medium=0.5),
        "hpcp_bins": len(data.get("hpcp_mean") or []),
    }
    progression = (chords or {}).get("progression")
    if progression is None:
        progression = (analyses.get("chords", {}).get("data") or {}).get("progression") or []
    chord_mean_conf = (chords or {}).get("mean_conf")
    if chord_mean_conf is None:
        confidences = [
            entry.get("mean_conf") for entry in progression if isinstance(entry.get("mean_conf"), (int, float))
        ]
        chord_mean_conf = round(statistics.fmean(confidences), 6) if confidences else None
    teaching, evidence = _resolve_teaching_key(detected, progression, chord_mean_conf)
    key_conflict = bool(detected.get("label") and teaching.get("label") and detected.get("label") != teaching.get("label"))
    return {
        "detected_key": detected,
        "teaching_key": teaching,
        "key_conflict": key_conflict,
        "chosen_key_reason": evidence["chosen_key_reason"],
        "evidence": evidence,
    }


def _resolve_teaching_key(
    detected: dict[str, Any],
    progression: list[dict[str, Any]],
    chord_mean_conf: float | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    candidates, dominant_chords = _score_key_candidates(progression)
    detected_key = detected.get("key")
    detected_scale = detected.get("scale") or "major"
    detected_label = detected.get("label")
    selected = None

    if candidates:
        best_fit = candidates[0]["fit_score"]
        close = [c for c in candidates if best_fit - c["fit_score"] <= KEY_FIT_TIE_WINDOW]
        detected_candidate = next(
            (c for c in close if c["label"] == detected_label and best_fit - c["fit_score"] <= 0.005),
            None,
        )
        selected = detected_candidate or max(
            close,
            key=lambda c: (c["tonic_prominence"], c["fit_score"], c["label"] == detected_label),
        )

    if selected:
        teaching_key = {
            "key": selected["key"],
            "scale": selected["scale"],
            "label": selected["label"],
            "confidence": _numeric_confidence(chord_mean_conf, high=0.65, medium=0.35),
        }
    else:
        teaching_key = {
            "key": detected_key,
            "scale": detected_scale,
            "label": detected_label,
            "confidence": detected.get("confidence", "unknown"),
        }

    evidence = {
        "detected_source": "tonal_key",
        "teaching_source": "chord_progression_fit" if selected else "tonal_key",
        "dominant_chords": dominant_chords,
        "candidate_scores": candidates[:6],
        "chosen_key_reason": "chord_fit_beats_global_key" if selected else "detected_key_no_chord_fit",
    }
    return teaching_key, evidence


def _score_key_candidates(progression: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    total_weight = 0.0
    root_weights = {pc: 0.0 for pc in range(12)}
    chord_weights: dict[str, float] = {}
    weighted_roots: list[tuple[int, float]] = []

    for entry in progression:
        chord = str(entry.get("chord") or "")
        root = _root_note(chord)
        root_pc = NOTE_TO_PC.get(root)
        if root_pc is None or chord in {"N", "None", "", "nan"}:
            continue
        duration = max(0.0, _float(entry.get("end_sec")) - _float(entry.get("start_sec")))
        confidence = _float(entry.get("mean_conf"), 1.0)
        weight = duration * max(0.0, confidence)
        if weight <= 0:
            continue
        total_weight += weight
        root_weights[root_pc] += weight
        chord_weights[chord] = chord_weights.get(chord, 0.0) + duration
        weighted_roots.append((root_pc, weight))

    dominant_chords = [
        chord for chord, _duration in sorted(chord_weights.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    if not total_weight:
        return [], dominant_chords

    candidates: list[dict[str, Any]] = []
    for root_pc, key_name in enumerate(PITCH_CLASS_FLAT):
        for scale, scale_pcs in (("major", MAJOR_SCALE_PCS), ("minor", MINOR_SCALE_PCS)):
            fit_weight = sum(
                weight for chord_pc, weight in weighted_roots if (chord_pc - root_pc) % 12 in scale_pcs
            )
            candidates.append(
                {
                    "key": key_name,
                    "scale": scale,
                    "label": _key_label(key_name, scale),
                    "fit_score": round(fit_weight / total_weight, 4),
                    "tonic_prominence": round(root_weights[root_pc] / total_weight, 4),
                }
            )
    return (
        sorted(candidates, key=lambda c: (c["fit_score"], c["tonic_prominence"]), reverse=True),
        dominant_chords,
    )


def _analysis_versions(mix_analysis: dict[str, Any], stem_summaries: list[dict[str, Any]]) -> dict[str, Any]:
    versions: dict[str, Any] = {"mix": {}}
    for name, report in (mix_analysis.get("response", {}).get("analyses") or {}).items():
        if isinstance(report, dict) and "version" in report:
            versions["mix"][name] = report.get("version")
    versions["stems"] = {
        stem["stem_id"]: (stem.get("analysis") or {}).get("keys", [])
        for stem in stem_summaries
        if (stem.get("analysis") or {}).get("status") != "missing"
    }
    return versions


def _compact_midi_summary(summary: dict[str, Any]) -> dict[str, Any]:
    if "error" in summary:
        return summary
    notes_sample = summary.get("notes_sample") or []
    return {
        "path": summary.get("path"),
        "length_sec": summary.get("length_sec"),
        "track_count": summary.get("track_count"),
        "message_count": summary.get("message_count"),
        "total_notes": summary.get("total_notes"),
        "pitch_range": summary.get("pitch_range"),
        "programs_by_channel": summary.get("programs_by_channel"),
        "note_counts_by_channel": summary.get("note_counts_by_channel"),
        "tempo_changes": summary.get("tempo_changes", []),
        "time_signatures": summary.get("time_signatures", []),
        "key_signatures": summary.get("key_signatures", []),
        "notes_sample_count": len(notes_sample),
        "notes_sample_omitted": bool(notes_sample),
    }


def _midi_tool_summary(summary: dict[str, Any]) -> dict[str, Any]:
    if "error" in summary:
        return {"error": summary.get("error")}
    return {
        "length_sec": summary.get("length_sec"),
        "track_count": summary.get("track_count"),
        "total_notes": summary.get("total_notes"),
        "pitch_range": summary.get("pitch_range"),
        "programs_by_channel": summary.get("programs_by_channel"),
        "note_counts_by_channel": summary.get("note_counts_by_channel"),
        "tempo_changes": summary.get("tempo_changes", []),
        "time_signatures": summary.get("time_signatures", []),
        "key_signatures": summary.get("key_signatures", []),
        "notes_sample_omitted": summary.get("notes_sample_omitted", False),
    }


def _stem_tool_summary(stem: dict[str, Any]) -> dict[str, Any]:
    analysis = stem.get("analysis") or {}
    midi = stem.get("midi") or {}
    return {
        "stem_id": stem.get("stem_id"),
        "label": stem.get("label"),
        "role": stem.get("role"),
        "tags": stem.get("tags") or [],
        "inst_class": stem.get("inst_class"),
        "midi_program_name": stem.get("midi_program_name"),
        "program_num": stem.get("program_num"),
        "is_drum": stem.get("is_drum"),
        "has_audio": stem.get("has_audio"),
        "has_midi": stem.get("has_midi"),
        "integrated_loudness": stem.get("integrated_loudness"),
        "midi": _midi_tool_summary(midi),
        "analysis": {
            "status": analysis.get("status"),
            "keys": analysis.get("keys", []),
            "tempo": analysis.get("tempo"),
            "key": analysis.get("key"),
            "chord_progression_count": analysis.get("chord_progression_count"),
        },
    }


def _stem_activity_by_section(midi_bytes: bytes, sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Per-section note activity for one stem: bucket its onsets into the song's
    section windows. Kept deterministic so it is Slice 1's graph-rollup input."""
    windows = [(_float(section.get("start_sec")), _float(section.get("end_sec"))) for section in sections]
    try:
        activity = note_activity_by_window(midi_bytes, windows)
    except Exception:  # a bad stem MIDI must not break the whole fact pack
        return []
    rolled: list[dict[str, Any]] = []
    for section, act in zip(sections, activity):
        rolled.append(
            {
                "section_index": section.get("index"),
                "label": section.get("label"),
                "section": section.get("section"),
                "start_sec": section.get("start_sec"),
                "end_sec": section.get("end_sec"),
                **act,
            }
        )
    return rolled


def _stem_pitch_class_profile(activity_by_section: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate one stem's pitch content across all sections (sum of the
    per-section histograms) → a song-wide PC profile + its dominant notes. Lets
    "what notes does the bass lean on?" be answered even with no chord analysis."""
    histogram = [0] * 12
    for act in activity_by_section:
        bins = act.get("pitch_class_histogram") or []
        for pc, count in enumerate(bins[:12]):
            histogram[pc] += int(count or 0)
    return {
        "pitch_class_histogram": histogram,
        "dominant_pitch_classes": dominant_pitch_classes(histogram),
        "note_count": sum(histogram),
    }


def _activity_for_index(stem: dict[str, Any], section_index: Any) -> dict[str, Any] | None:
    for act in stem.get("activity_by_section") or []:
        if act.get("section_index") == section_index:
            return act
    return None


def _select_sections(
    sections: list[dict[str, Any]],
    section_index: int | None,
    start_sec: float | None,
    end_sec: float | None,
) -> list[dict[str, Any]]:
    if section_index is not None:
        return [section for section in sections if section.get("index") == int(section_index)]
    if start_sec is not None or end_sec is not None:
        return _filter_range(sections, start_sec, end_sec)
    return sections


def _stem_detail(stem: dict[str, Any]) -> dict[str, Any]:
    return {
        "stem_id": stem.get("stem_id"),
        "label": stem.get("label"),
        "role": stem.get("role"),
        "tags": stem.get("tags") or [],
        "inst_class": stem.get("inst_class"),
        "midi_program_name": stem.get("midi_program_name"),
        "program_num": stem.get("program_num"),
        "is_drum": stem.get("is_drum"),
        "has_audio": stem.get("has_audio"),
        "has_midi": stem.get("has_midi"),
        "integrated_loudness": stem.get("integrated_loudness"),
        "midi": _midi_tool_summary(stem.get("midi") or {}),
        "analysis": stem.get("analysis") or {"status": "missing"},
        "activity_by_section": stem.get("activity_by_section") or [],
        # 0.2b — aggregate pitch classes across the stem (sum of section histograms).
        "pitch_class_profile": stem.get("pitch_class_profile"),
    }


def _fingerprint_reasons(stored: dict[str, Any] | None, current: dict[str, Any]) -> list[str]:
    """Human-readable diff between a pack's stored dependency fingerprint and the
    song's current one. Empty list == fresh. Pure (no I/O) so it is unit-tested
    directly. A missing stored fingerprint (pre-v5 pack) yields no reasons here —
    the version-mismatch check in `status()` covers those."""
    if not stored:
        return []
    reasons: list[str] = []

    stored_assets = stored.get("assets") or {}
    current_assets = current.get("assets") or {}
    for key in sorted(set(stored_assets) | set(current_assets)):
        if stored_assets.get(key) != current_assets.get(key):
            reasons.append(_asset_change_reason(key, key in stored_assets, key in current_assets))

    stored_an = stored.get("analyses") or {}
    current_an = current.get("analyses") or {}
    seen_scopes: set[str] = set()
    for key in sorted(set(stored_an) | set(current_an)):
        if stored_an.get(key) == current_an.get(key):
            continue
        scope = key.rsplit(":", 1)[0] if ":" in key else key
        if scope not in seen_scopes:
            seen_scopes.add(scope)
            reasons.append(_analysis_scope_reason(scope))

    return _cap_reasons(reasons)


def _asset_change_reason(key: str, was_present: bool, is_present: bool) -> str:
    label = key.split(":", 1)[0].replace("_", " ")
    if not was_present:
        return f"New asset: {label}."
    if not is_present:
        return f"Removed asset: {label}."
    return f"Updated asset: {label}."


def _analysis_scope_reason(scope: str) -> str:
    if scope.startswith("stem:"):
        return f"Stem {scope[len('stem:') :]} was re-analyzed."
    if scope == "mix":
        return "The mix analysis was re-run."
    return f"{scope} was re-analyzed."


def _cap_reasons(reasons: list[str], limit: int = 6) -> list[str]:
    if len(reasons) <= limit:
        return reasons
    return reasons[:limit] + [f"…and {len(reasons) - limit} more change(s)."]


def _safe_midi_bytes(data: bytes | None, source: str, *, max_notes: int) -> dict[str, Any]:
    if not data:
        return {"path": source, "error": "missing"}
    try:
        return summarize_midi_bytes(data, source=source, max_notes=max_notes)
    except Exception as exc:  # keep the fact pack buildable even if one MIDI is bad
        return {"path": source, "error": str(exc)}


def _filter_range(items: list[dict[str, Any]], start_sec: float | None, end_sec: float | None) -> list[dict[str, Any]]:
    if start_sec is None and end_sec is None:
        return list(items)
    start = float("-inf") if start_sec is None else float(start_sec)
    end = float("inf") if end_sec is None else float(end_sec)
    if end < start:
        start, end = end, start
    filtered = []
    for item in items:
        item_start = _float(item.get("start_sec"))
        item_end = _float(item.get("end_sec"), item_start)
        if item_end >= start and item_start <= end:
            filtered.append(item)
    return filtered


def _transpose_interval(current_key: str | None, semitones: int | None, target_key: str | None) -> int:
    if semitones is not None:
        return int(semitones) % 12
    if current_key and target_key:
        current_pc = NOTE_TO_PC.get(_root_note(current_key))
        target_pc = NOTE_TO_PC.get(_root_note(target_key))
        if current_pc is not None and target_pc is not None:
            return (target_pc - current_pc) % 12
    return 0


def _transpose_chord(chord: str, semitones: int, spelling_hint: str | None) -> str:
    if chord in {"N", "None", "", "nan"}:
        return chord
    match = re.match(r"^([A-G](?:#|b)?)(.*)$", chord)
    if not match:
        return chord
    root, suffix = match.groups()
    return _transpose_note(root, semitones, spelling_hint) + suffix


def _transpose_note(note: str, semitones: int, spelling_hint: str | None) -> str:
    root = _root_note(note)
    pc = NOTE_TO_PC.get(root)
    if pc is None:
        return note
    names = PITCH_CLASS_FLAT if (spelling_hint and "b" in spelling_hint) or "b" in root else PITCH_CLASS_SHARP
    return names[(pc + semitones) % 12]


def _root_note(value: str) -> str:
    match = re.match(r"^([A-G](?:#|b)?)", value.strip())
    return match.group(1) if match else value


def _key_label(key: Any, scale: Any) -> str | None:
    if not key:
        return None
    return f"{key} {scale or 'major'}"


def _key_confidence(key: dict[str, Any]) -> str | None:
    teaching = key.get("teaching_key") or {}
    detected = key.get("detected_key") or {}
    return teaching.get("confidence") or detected.get("confidence")


def _numeric_confidence(value: Any, *, high: float, medium: float) -> str:
    if not isinstance(value, (int, float)):
        return "unknown"
    if value >= high:
        return "high"
    if value >= medium:
        return "medium"
    return "low"


def _overall_confidence(values: list[str | None]) -> str:
    concrete = [value for value in values if value and value != "unknown"]
    if not concrete:
        return "unknown"
    if "low" in concrete:
        return "low"
    if "medium" in concrete:
        return "medium"
    return "high"


def _float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
