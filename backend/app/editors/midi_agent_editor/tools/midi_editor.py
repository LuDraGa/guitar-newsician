"""
MIDI Editor Tools for MIDI Agent System
Provides tools to modify MIDI files programmatically for agent use.
"""

from pathlib import Path
from typing import List, Optional, Dict
from dataclasses import dataclass
import pretty_midi
import numpy as np


@dataclass
class Change:
    """Represents a single MIDI modification."""
    change_id: str
    change_type: str  # "add_note", "modify_note", "delete_note", "add_bend", etc.
    description: str
    parameters: Dict


@dataclass
class ChangeReport:
    """Report of changes between original and modified MIDI."""
    added_notes: int
    modified_notes: int
    deleted_notes: int
    added_bends: int
    added_ccs: int
    summary: str


class MIDIEditor:
    """
    MIDI editing tools for agent-based modifications.
    Provides safe, reversible MIDI editing operations.
    """

    def __init__(self):
        """Initialize MIDI editor."""
        self.changes_log: List[Change] = []

    def load_midi(self, midi_path: str) -> pretty_midi.PrettyMIDI:
        """Load MIDI file."""
        return pretty_midi.PrettyMIDI(midi_path)

    def save_midi(self, midi: pretty_midi.PrettyMIDI, output_path: str) -> None:
        """
        Save MIDI file.

        Args:
            midi: PrettyMIDI object
            output_path: Path to save to
        """
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        midi.write(output_path)

    def add_note(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        pitch: int,
        start: float,
        end: float,
        velocity: int = 100
    ) -> str:
        """
        Add a new note to MIDI.

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument to add to
            pitch: MIDI note number (0-127)
            start: Start time in seconds
            end: End time in seconds
            velocity: Note velocity (0-127)

        Returns:
            Change ID for tracking
        """
        if instrument_idx >= len(midi.instruments):
            raise ValueError(f"Instrument index {instrument_idx} out of range")

        # Create note
        note = pretty_midi.Note(
            velocity=velocity,
            pitch=pitch,
            start=start,
            end=end
        )

        # Add to instrument
        midi.instruments[instrument_idx].notes.append(note)

        # Sort notes by start time
        midi.instruments[instrument_idx].notes.sort(key=lambda n: n.start)

        # Log change
        change_id = f"add_note_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="add_note",
                description=f"Added {pretty_midi.note_number_to_name(pitch)} at {start:.2f}s",
                parameters={
                    "pitch": pitch,
                    "start": start,
                    "end": end,
                    "velocity": velocity
                }
            )
        )

        return change_id

    def modify_note(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        note_idx: int,
        pitch: Optional[int] = None,
        start: Optional[float] = None,
        end: Optional[float] = None,
        velocity: Optional[int] = None
    ) -> str:
        """
        Modify an existing note.

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument
            note_idx: Index of note to modify
            pitch: New pitch (optional)
            start: New start time (optional)
            end: New end time (optional)
            velocity: New velocity (optional)

        Returns:
            Change ID
        """
        if instrument_idx >= len(midi.instruments):
            raise ValueError(f"Instrument index {instrument_idx} out of range")

        instrument = midi.instruments[instrument_idx]

        if note_idx >= len(instrument.notes):
            raise ValueError(f"Note index {note_idx} out of range")

        note = instrument.notes[note_idx]
        old_pitch = note.pitch

        # Apply modifications
        if pitch is not None:
            note.pitch = pitch
        if start is not None:
            note.start = start
        if end is not None:
            note.end = end
        if velocity is not None:
            note.velocity = velocity

        # Re-sort notes
        instrument.notes.sort(key=lambda n: n.start)

        # Log change
        change_id = f"modify_note_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="modify_note",
                description=f"Modified note at index {note_idx}",
                parameters={
                    "note_idx": note_idx,
                    "old_pitch": old_pitch,
                    "new_pitch": pitch,
                    "start": start,
                    "end": end,
                    "velocity": velocity
                }
            )
        )

        return change_id

    def delete_note(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        note_idx: int
    ) -> str:
        """
        Delete a note from MIDI.

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument
            note_idx: Index of note to delete

        Returns:
            Change ID
        """
        if instrument_idx >= len(midi.instruments):
            raise ValueError(f"Instrument index {instrument_idx} out of range")

        instrument = midi.instruments[instrument_idx]

        if note_idx >= len(instrument.notes):
            raise ValueError(f"Note index {note_idx} out of range")

        note = instrument.notes[note_idx]
        pitch_name = pretty_midi.note_number_to_name(note.pitch)

        # Remove note
        del instrument.notes[note_idx]

        # Log change
        change_id = f"delete_note_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="delete_note",
                description=f"Deleted {pitch_name} at {note.start:.2f}s",
                parameters={
                    "note_idx": note_idx,
                    "pitch": note.pitch,
                    "start": note.start,
                    "end": note.end
                }
            )
        )

        return change_id

    def add_pitch_bend(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        time: float,
        semitones: float
    ) -> str:
        """
        Add pitch bend event.

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument
            time: Time of pitch bend (seconds)
            semitones: Pitch bend in semitones (typically ±2)

        Returns:
            Change ID
        """
        if instrument_idx >= len(midi.instruments):
            raise ValueError(f"Instrument index {instrument_idx} out of range")

        # Convert semitones to MIDI pitch bend value (-8192 to +8191)
        # Assuming ±2 semitone range
        bend_value = int((semitones / 2.0) * 8192)
        bend_value = max(-8192, min(8191, bend_value))

        # Create pitch bend
        bend = pretty_midi.PitchBend(pitch=bend_value, time=time)

        # Add to instrument
        midi.instruments[instrument_idx].pitch_bends.append(bend)

        # Sort by time
        midi.instruments[instrument_idx].pitch_bends.sort(key=lambda b: b.time)

        # Log change
        change_id = f"add_bend_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="add_pitch_bend",
                description=f"Added pitch bend of {semitones:+.2f} semitones at {time:.2f}s",
                parameters={
                    "time": time,
                    "semitones": semitones,
                    "bend_value": bend_value
                }
            )
        )

        return change_id

    def add_pitch_bend_sequence(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        start_time: float,
        end_time: float,
        start_semitones: float,
        end_semitones: float,
        num_points: int = 10
    ) -> str:
        """
        Add a smooth pitch bend sequence (for slides, bends, etc.).

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument
            start_time: Start time of bend
            end_time: End time of bend
            start_semitones: Starting pitch offset
            end_semitones: Ending pitch offset
            num_points: Number of intermediate points

        Returns:
            Change ID
        """
        times = np.linspace(start_time, end_time, num_points)
        semitones = np.linspace(start_semitones, end_semitones, num_points)

        for t, st in zip(times, semitones):
            self.add_pitch_bend(midi, instrument_idx, float(t), float(st))

        # Log combined change
        change_id = f"add_bend_seq_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="add_pitch_bend_sequence",
                description=f"Added pitch bend sequence {start_time:.2f}s-{end_time:.2f}s",
                parameters={
                    "start_time": start_time,
                    "end_time": end_time,
                    "start_semitones": start_semitones,
                    "end_semitones": end_semitones,
                    "num_points": num_points
                }
            )
        )

        return change_id

    def add_control_change(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        cc_number: int,
        value: int,
        time: float
    ) -> str:
        """
        Add control change event.

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument
            cc_number: CC number (0-127)
            value: CC value (0-127)
            time: Time of CC event (seconds)

        Returns:
            Change ID
        """
        if instrument_idx >= len(midi.instruments):
            raise ValueError(f"Instrument index {instrument_idx} out of range")

        # Create CC event
        cc = pretty_midi.ControlChange(number=cc_number, value=value, time=time)

        # Add to instrument
        midi.instruments[instrument_idx].control_changes.append(cc)

        # Sort by time
        midi.instruments[instrument_idx].control_changes.sort(key=lambda c: c.time)

        # Log change
        change_id = f"add_cc_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="add_control_change",
                description=f"Added CC#{cc_number}={value} at {time:.2f}s",
                parameters={
                    "cc_number": cc_number,
                    "value": value,
                    "time": time
                }
            )
        )

        return change_id

    def merge_notes(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        note_indices: List[int],
        keep_first: bool = True
    ) -> str:
        """
        Merge multiple notes into one (useful for fixing incorrect note splits).

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument
            note_indices: Indices of notes to merge
            keep_first: If True, keep properties of first note; else average

        Returns:
            Change ID
        """
        if instrument_idx >= len(midi.instruments):
            raise ValueError(f"Instrument index {instrument_idx} out of range")

        instrument = midi.instruments[instrument_idx]
        notes_to_merge = [instrument.notes[i] for i in sorted(note_indices)]

        if len(notes_to_merge) < 2:
            raise ValueError("Need at least 2 notes to merge")

        # Calculate merged note properties
        if keep_first:
            pitch = notes_to_merge[0].pitch
            velocity = notes_to_merge[0].velocity
        else:
            pitch = int(np.mean([n.pitch for n in notes_to_merge]))
            velocity = int(np.mean([n.velocity for n in notes_to_merge]))

        start = min(n.start for n in notes_to_merge)
        end = max(n.end for n in notes_to_merge)

        # Remove old notes (in reverse order to preserve indices)
        for idx in sorted(note_indices, reverse=True):
            del instrument.notes[idx]

        # Add merged note
        merged_note = pretty_midi.Note(
            velocity=velocity,
            pitch=pitch,
            start=start,
            end=end
        )
        instrument.notes.append(merged_note)
        instrument.notes.sort(key=lambda n: n.start)

        # Log change
        change_id = f"merge_notes_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="merge_notes",
                description=f"Merged {len(note_indices)} notes into one",
                parameters={
                    "note_indices": note_indices,
                    "merged_pitch": pitch,
                    "merged_start": start,
                    "merged_end": end
                }
            )
        )

        return change_id

    def quantize_timing(
        self,
        midi: pretty_midi.PrettyMIDI,
        instrument_idx: int,
        grid: float = 0.125
    ) -> str:
        """
        Quantize note timings to grid.

        Args:
            midi: PrettyMIDI object
            instrument_idx: Which instrument
            grid: Grid size in beats (e.g., 0.125 = 32nd notes)

        Returns:
            Change ID
        """
        if instrument_idx >= len(midi.instruments):
            raise ValueError(f"Instrument index {instrument_idx} out of range")

        instrument = midi.instruments[instrument_idx]

        # Get tempo (assuming constant tempo)
        tempo = 120.0  # Default, ideally extract from MIDI
        beat_duration = 60.0 / tempo
        grid_duration = beat_duration * grid

        notes_quantized = 0
        for note in instrument.notes:
            # Quantize start time
            quantized_start = round(note.start / grid_duration) * grid_duration
            duration = note.end - note.start
            note.start = quantized_start
            note.end = quantized_start + duration
            notes_quantized += 1

        # Log change
        change_id = f"quantize_{len(self.changes_log)}"
        self.changes_log.append(
            Change(
                change_id=change_id,
                change_type="quantize_timing",
                description=f"Quantized {notes_quantized} notes to {grid} beat grid",
                parameters={
                    "grid": grid,
                    "notes_affected": notes_quantized
                }
            )
        )

        return change_id

    def preview_changes(
        self,
        original: pretty_midi.PrettyMIDI,
        modified: pretty_midi.PrettyMIDI,
        instrument_idx: int = 0
    ) -> ChangeReport:
        """
        Generate report comparing original and modified MIDI.

        Args:
            original: Original MIDI
            modified: Modified MIDI
            instrument_idx: Which instrument to compare

        Returns:
            Change report
        """
        orig_inst = original.instruments[instrument_idx] if instrument_idx < len(original.instruments) else None
        mod_inst = modified.instruments[instrument_idx] if instrument_idx < len(modified.instruments) else None

        if not orig_inst or not mod_inst:
            return ChangeReport(0, 0, 0, 0, 0, "No instruments to compare")

        # Count changes
        orig_notes = len(orig_inst.notes)
        mod_notes = len(mod_inst.notes)
        added_notes = max(0, mod_notes - orig_notes)
        deleted_notes = max(0, orig_notes - mod_notes)
        modified_notes = min(orig_notes, mod_notes)  # Approximate

        added_bends = len(mod_inst.pitch_bends) - len(orig_inst.pitch_bends)
        added_ccs = len(mod_inst.control_changes) - len(orig_inst.control_changes)

        # Generate summary
        summary_parts = []
        if added_notes > 0:
            summary_parts.append(f"+{added_notes} notes")
        if deleted_notes > 0:
            summary_parts.append(f"-{deleted_notes} notes")
        if added_bends > 0:
            summary_parts.append(f"+{added_bends} bends")
        if added_ccs > 0:
            summary_parts.append(f"+{added_ccs} CCs")

        summary = ", ".join(summary_parts) if summary_parts else "No changes detected"

        return ChangeReport(
            added_notes=added_notes,
            modified_notes=modified_notes,
            deleted_notes=deleted_notes,
            added_bends=max(0, added_bends),
            added_ccs=max(0, added_ccs),
            summary=summary
        )

    def get_changes_log(self) -> List[Change]:
        """Get list of all changes made."""
        return self.changes_log

    def clear_changes_log(self) -> None:
        """Clear the changes log."""
        self.changes_log = []
