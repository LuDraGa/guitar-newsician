"""MIDI inspection helpers (ported from the POC).

The POC read MIDI from local file paths; in WereCode the bytes come from a
storage download, so the summarizer also accepts raw bytes (mido reads from a
file object) to avoid temp files. The summary shape is unchanged so the fact
pack's compaction logic ports verbatim.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any

import mido


def summarize_midi(path: Path, *, max_notes: int = 64) -> dict[str, Any]:
    """Return a compact JSON-safe summary of a MIDI file on disk."""

    return _summarize(mido.MidiFile(path), source=str(path), max_notes=max_notes)


def summarize_midi_bytes(data: bytes, *, source: str = "<bytes>", max_notes: int = 64) -> dict[str, Any]:
    """Return a compact JSON-safe summary of MIDI bytes (e.g. a storage blob)."""

    return _summarize(mido.MidiFile(file=io.BytesIO(data)), source=source, max_notes=max_notes)


def note_activity_by_window(data: bytes, windows: list[tuple[float, float]]) -> list[dict[str, Any]]:
    """Bucket a MIDI's note onsets into time windows (the deterministic Section ×
    Role rollup that Slice 1 consumes).

    Walks the merged track stream once (so tempo changes apply globally, unlike
    the per-track `_summarize`) and assigns each note-on to the window its onset
    falls in. Returns one summary per input window, in order: `active`,
    `note_count`, `pitch_range`, `mean_velocity`."""

    midi = mido.MidiFile(file=io.BytesIO(data))
    buckets = [{"note_count": 0, "pitch_min": None, "pitch_max": None, "velocity_sum": 0} for _ in windows]
    tempo = 500_000
    seconds = 0.0
    for message in mido.merge_tracks(midi.tracks):
        seconds += mido.tick2second(message.time, midi.ticks_per_beat, tempo)
        if message.type == "set_tempo":
            tempo = message.tempo
            continue
        if message.type != "note_on" or int(getattr(message, "velocity", 0)) <= 0:
            continue
        index = _window_index(windows, seconds)
        if index is None:
            continue
        bucket = buckets[index]
        pitch = int(message.note)
        bucket["note_count"] += 1
        bucket["velocity_sum"] += int(message.velocity)
        bucket["pitch_min"] = pitch if bucket["pitch_min"] is None else min(bucket["pitch_min"], pitch)
        bucket["pitch_max"] = pitch if bucket["pitch_max"] is None else max(bucket["pitch_max"], pitch)

    result: list[dict[str, Any]] = []
    for bucket in buckets:
        count = bucket["note_count"]
        result.append(
            {
                "active": count > 0,
                "note_count": count,
                "pitch_range": {"min": bucket["pitch_min"], "max": bucket["pitch_max"]},
                "mean_velocity": round(bucket["velocity_sum"] / count, 1) if count else None,
            }
        )
    return result


def _window_index(windows: list[tuple[float, float]], time_sec: float) -> int | None:
    last = len(windows) - 1
    for index, (start, end) in enumerate(windows):
        if time_sec >= start and (time_sec < end or (index == last and time_sec <= end)):
            return index
    return None


def _summarize(midi: "mido.MidiFile", *, source: str, max_notes: int) -> dict[str, Any]:
    notes: list[dict[str, Any]] = []
    programs: dict[str, set[int]] = {}
    note_counts_by_channel: dict[str, int] = {}
    pitch_min: int | None = None
    pitch_max: int | None = None
    message_count = 0
    tempo_changes: list[dict[str, Any]] = []
    time_signatures: list[dict[str, Any]] = []
    key_signatures: list[dict[str, Any]] = []

    for track_index, track in enumerate(midi.tracks):
        tempo = 500_000
        seconds = 0.0
        active_notes: dict[tuple[int, int], list[tuple[float, int]]] = {}
        for message in track:
            message_count += 1
            seconds += mido.tick2second(message.time, midi.ticks_per_beat, tempo)
            if message.type == "set_tempo":
                tempo = message.tempo
                tempo_changes.append(
                    {
                        "track_index": track_index,
                        "time_sec": round(seconds, 6),
                        "bpm": round(mido.tempo2bpm(tempo), 3),
                    }
                )
                continue
            if message.type == "time_signature":
                time_signatures.append(
                    {
                        "track_index": track_index,
                        "time_sec": round(seconds, 6),
                        "numerator": int(message.numerator),
                        "denominator": int(message.denominator),
                    }
                )
                continue
            if message.type == "key_signature":
                key_signatures.append(
                    {
                        "track_index": track_index,
                        "time_sec": round(seconds, 6),
                        "key": str(message.key),
                    }
                )
                continue
            channel = getattr(message, "channel", None)
            if message.type == "program_change" and channel is not None:
                programs.setdefault(str(channel), set()).add(int(message.program))
                continue
            if message.type not in {"note_on", "note_off"} or channel is None:
                continue
            pitch = int(message.note)
            pitch_min = pitch if pitch_min is None else min(pitch_min, pitch)
            pitch_max = pitch if pitch_max is None else max(pitch_max, pitch)
            key = (int(channel), pitch)
            if message.type == "note_on" and int(message.velocity) > 0:
                active_notes.setdefault(key, []).append((seconds, int(message.velocity)))
                continue
            starts = active_notes.get(key)
            if not starts:
                continue
            start_sec, velocity = starts.pop(0)
            note_counts_by_channel[str(channel)] = note_counts_by_channel.get(str(channel), 0) + 1
            if len(notes) < max_notes:
                notes.append(
                    {
                        "track_index": track_index,
                        "channel": int(channel),
                        "pitch_midi": pitch,
                        "start_sec": round(start_sec, 6),
                        "end_sec": round(seconds, 6),
                        "duration_sec": round(max(0.0, seconds - start_sec), 6),
                        "velocity": velocity,
                    }
                )

    total_notes = sum(note_counts_by_channel.values())
    return {
        "path": source,
        "type": midi.type,
        "ticks_per_beat": midi.ticks_per_beat,
        "length_sec": round(float(midi.length), 6),
        "track_count": len(midi.tracks),
        "message_count": message_count,
        "total_notes": total_notes,
        "pitch_range": {"min": pitch_min, "max": pitch_max},
        "programs_by_channel": {channel: sorted(values) for channel, values in sorted(programs.items())},
        "note_counts_by_channel": dict(sorted(note_counts_by_channel.items())),
        "tempo_changes": tempo_changes[:32],
        "time_signatures": time_signatures[:32],
        "key_signatures": key_signatures[:32],
        "notes_sample": notes,
        "notes_sample_limit": max_notes,
    }
