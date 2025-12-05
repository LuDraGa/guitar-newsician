"""
MIDI Analysis Tools for MIDI Agent System
Provides MIDI parsing and analysis tools that convert MIDI data into
text/numerical descriptions that LLMs can reason about.
"""

from pathlib import Path
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass
import numpy as np
import pretty_midi


@dataclass
class NoteEvent:
    """MIDI note event."""
    note_id: str  # Unique identifier
    pitch: int  # MIDI note number (0-127)
    pitch_name: str  # e.g., "C4", "F#3"
    start: float  # seconds
    end: float  # seconds
    duration: float  # seconds
    velocity: int  # 0-127


@dataclass
class ChordEvent:
    """Chord detected in MIDI."""
    time: float
    duration: float
    notes: List[int]  # MIDI note numbers
    chord_name: str  # e.g., "Cmaj", "Am7"


@dataclass
class PitchBendEvent:
    """MIDI pitch bend event."""
    time: float
    value: int  # -8192 to +8191
    semitones: float  # Approximate semitone bend


@dataclass
class ControlChangeEvent:
    """MIDI CC event."""
    time: float
    cc_number: int
    value: int  # 0-127


class MIDIAnalyzer:
    """
    MIDI analysis tools for agent-based MIDI editing.
    Converts MIDI data into LLM-readable descriptions.
    """

    def __init__(self):
        """Initialize MIDI analyzer."""
        pass

    def load_midi(self, midi_path: str) -> pretty_midi.PrettyMIDI:
        """
        Load MIDI file.

        Args:
            midi_path: Path to MIDI file

        Returns:
            PrettyMIDI object
        """
        return pretty_midi.PrettyMIDI(midi_path)

    def extract_section(
        self,
        midi: pretty_midi.PrettyMIDI,
        start_time: float,
        end_time: float,
        instrument_idx: int = 0
    ) -> List[pretty_midi.Note]:
        """
        Extract notes within time range.

        Args:
            midi: PrettyMIDI object
            start_time: Section start time (seconds)
            end_time: Section end time (seconds)
            instrument_idx: Which instrument to extract from

        Returns:
            List of notes in the time range
        """
        if instrument_idx >= len(midi.instruments):
            return []

        instrument = midi.instruments[instrument_idx]
        notes = []

        for note in instrument.notes:
            # Include notes that overlap with the time range
            if note.start < end_time and note.end > start_time:
                notes.append(note)

        return sorted(notes, key=lambda n: n.start)

    def parse_notes(self, notes: List[pretty_midi.Note]) -> List[NoteEvent]:
        """
        Convert pretty_midi notes to NoteEvent objects.

        Args:
            notes: List of pretty_midi Note objects

        Returns:
            List of NoteEvent objects
        """
        events = []

        for i, note in enumerate(notes):
            events.append(
                NoteEvent(
                    note_id=f"note_{i}_{note.start:.3f}",
                    pitch=note.pitch,
                    pitch_name=pretty_midi.note_number_to_name(note.pitch),
                    start=note.start,
                    end=note.end,
                    duration=note.end - note.start,
                    velocity=note.velocity
                )
            )

        return events

    def detect_chords(
        self,
        notes: List[pretty_midi.Note],
        time_tolerance: float = 0.05
    ) -> List[ChordEvent]:
        """
        Detect chords (simultaneous notes) in MIDI.

        Args:
            notes: List of MIDI notes
            time_tolerance: Time window for considering notes simultaneous (seconds)

        Returns:
            List of detected chords
        """
        if not notes:
            return []

        chords = []
        sorted_notes = sorted(notes, key=lambda n: n.start)

        i = 0
        while i < len(sorted_notes):
            current_note = sorted_notes[i]
            chord_notes = [current_note]
            chord_pitches = [current_note.pitch]

            # Find all notes starting around the same time
            j = i + 1
            while j < len(sorted_notes):
                if sorted_notes[j].start - current_note.start <= time_tolerance:
                    chord_notes.append(sorted_notes[j])
                    chord_pitches.append(sorted_notes[j].pitch)
                    j += 1
                else:
                    break

            # Only consider it a chord if 3+ notes
            if len(chord_pitches) >= 3:
                # Simple chord naming (basic implementation)
                chord_name = self._simple_chord_name(chord_pitches)

                # Calculate chord duration (minimum of all note durations)
                min_end = min(n.end for n in chord_notes)

                chords.append(
                    ChordEvent(
                        time=current_note.start,
                        duration=min_end - current_note.start,
                        notes=sorted(set(chord_pitches)),
                        chord_name=chord_name
                    )
                )

            i = j if j > i + 1 else i + 1

        return chords

    def _simple_chord_name(self, pitches: List[int]) -> str:
        """
        Generate simple chord name from MIDI pitches.

        Args:
            pitches: List of MIDI note numbers

        Returns:
            Chord name string
        """
        # Normalize to root position (all within one octave)
        normalized = sorted(set([p % 12 for p in pitches]))

        if len(normalized) < 3:
            return "dyad"

        # Get root note name
        root = pretty_midi.note_number_to_name(pitches[0])[:-1]  # Remove octave

        # Simple chord quality detection
        intervals = [normalized[i] - normalized[0] for i in range(len(normalized))]

        if intervals == [0, 4, 7]:
            return f"{root}maj"
        elif intervals == [0, 3, 7]:
            return f"{root}min"
        elif intervals == [0, 4, 7, 10]:
            return f"{root}7"
        elif intervals == [0, 3, 7, 10]:
            return f"{root}min7"
        elif intervals == [0, 4, 7, 11]:
            return f"{root}maj7"
        else:
            return f"{root}chord"

    def get_pitch_bends(
        self,
        midi: pretty_midi.PrettyMIDI,
        start_time: float,
        end_time: float,
        instrument_idx: int = 0
    ) -> List[PitchBendEvent]:
        """
        Extract pitch bend events within time range.

        Args:
            midi: PrettyMIDI object
            start_time: Section start time
            end_time: Section end time
            instrument_idx: Which instrument to extract from

        Returns:
            List of pitch bend events
        """
        if instrument_idx >= len(midi.instruments):
            return []

        instrument = midi.instruments[instrument_idx]
        bends = []

        for bend in instrument.pitch_bends:
            if start_time <= bend.time <= end_time:
                # Convert pitch bend value to approximate semitones
                # MIDI pitch bend: -8192 to +8191, typically ±2 semitones
                semitones = (bend.pitch / 8192.0) * 2.0

                bends.append(
                    PitchBendEvent(
                        time=bend.time,
                        value=bend.pitch,
                        semitones=semitones
                    )
                )

        return sorted(bends, key=lambda b: b.time)

    def get_control_changes(
        self,
        midi: pretty_midi.PrettyMIDI,
        start_time: float,
        end_time: float,
        instrument_idx: int = 0,
        cc_numbers: Optional[List[int]] = None
    ) -> List[ControlChangeEvent]:
        """
        Extract control change events.

        Args:
            midi: PrettyMIDI object
            start_time: Section start time
            end_time: Section end time
            instrument_idx: Which instrument to extract from
            cc_numbers: Optional filter for specific CC numbers

        Returns:
            List of control change events
        """
        if instrument_idx >= len(midi.instruments):
            return []

        instrument = midi.instruments[instrument_idx]
        ccs = []

        for cc in instrument.control_changes:
            if start_time <= cc.time <= end_time:
                if cc_numbers is None or cc.number in cc_numbers:
                    ccs.append(
                        ControlChangeEvent(
                            time=cc.time,
                            cc_number=cc.number,
                            value=cc.value
                        )
                    )

        return sorted(ccs, key=lambda c: c.time)

    def time_align(
        self,
        audio_onsets: List[float],
        midi_notes: List[pretty_midi.Note],
        tolerance: float = 0.1
    ) -> Dict[int, float]:
        """
        Align MIDI notes with audio onsets.

        Args:
            audio_onsets: List of onset times from audio (seconds)
            midi_notes: List of MIDI notes
            tolerance: Time tolerance for matching (seconds)

        Returns:
            Dictionary mapping MIDI note index to time offset
        """
        alignment = {}

        for i, note in enumerate(midi_notes):
            # Find closest audio onset
            closest_onset = min(audio_onsets, key=lambda t: abs(t - note.start))
            offset = closest_onset - note.start

            if abs(offset) <= tolerance:
                alignment[i] = offset

        return alignment

    def describe_midi_events(
        self,
        notes: List[NoteEvent],
        chords: List[ChordEvent],
        pitch_bends: List[PitchBendEvent],
        ccs: List[ControlChangeEvent]
    ) -> str:
        """
        Convert MIDI events to LLM-readable text description.

        Args:
            notes: Note events
            chords: Chord events
            pitch_bends: Pitch bend events
            ccs: Control change events

        Returns:
            Human-readable description
        """
        lines = ["=== MIDI Analysis ===\n"]

        # Notes summary
        lines.append(f"Total Notes: {len(notes)}")

        if notes:
            pitches = [n.pitch for n in notes]
            pitch_names = [n.pitch_name for n in notes]

            lines.append(f"Pitch Range: {min(pitch_names)} to {max(pitch_names)}")
            lines.append(f"Mean Velocity: {np.mean([n.velocity for n in notes]):.1f}")
            lines.append(f"Mean Duration: {np.mean([n.duration for n in notes]):.3f}s")

            # First few notes
            lines.append("\nFirst Notes:")
            for note in notes[:5]:
                lines.append(
                    f"  - {note.start:.2f}s: {note.pitch_name} "
                    f"(vel={note.velocity}, dur={note.duration:.3f}s)"
                )

        # Chords
        if chords:
            lines.append(f"\nChords Detected: {len(chords)}")
            for chord in chords[:3]:
                lines.append(
                    f"  - {chord.time:.2f}s: {chord.chord_name} "
                    f"({len(chord.notes)} notes)"
                )

        # Pitch bends
        if pitch_bends:
            lines.append(f"\nPitch Bends: {len(pitch_bends)}")
            for bend in pitch_bends[:5]:
                lines.append(
                    f"  - {bend.time:.2f}s: {bend.semitones:+.2f} semitones "
                    f"(value={bend.value})"
                )
        else:
            lines.append("\nNo pitch bend events found")

        # Control changes
        if ccs:
            lines.append(f"\nControl Changes: {len(ccs)}")
            # Group by CC number
            cc_groups = {}
            for cc in ccs:
                if cc.cc_number not in cc_groups:
                    cc_groups[cc.cc_number] = []
                cc_groups[cc.cc_number].append(cc)

            for cc_num, events in cc_groups.items():
                lines.append(f"  - CC#{cc_num}: {len(events)} events")

        return "\n".join(lines)

    def analyze_section(
        self,
        midi_path: str,
        start_time: float,
        end_time: float,
        instrument_idx: int = 0
    ) -> Dict:
        """
        Complete analysis of a MIDI section.

        Args:
            midi_path: Path to MIDI file
            start_time: Section start time (seconds)
            end_time: Section end time (seconds)
            instrument_idx: Which instrument to analyze

        Returns:
            Dictionary with all analysis results
        """
        # Load MIDI
        midi = self.load_midi(midi_path)

        # Extract section
        notes = self.extract_section(midi, start_time, end_time, instrument_idx)

        # Run analyses
        note_events = self.parse_notes(notes)
        chords = self.detect_chords(notes)
        pitch_bends = self.get_pitch_bends(midi, start_time, end_time, instrument_idx)
        ccs = self.get_control_changes(midi, start_time, end_time, instrument_idx)

        # Generate description
        description = self.describe_midi_events(note_events, chords, pitch_bends, ccs)

        return {
            "notes": note_events,
            "chords": chords,
            "pitch_bends": pitch_bends,
            "control_changes": ccs,
            "description": description
        }
