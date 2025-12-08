"""
Pydantic schemas for structured LLM outputs in MIDI editing workflow.
"""

from typing import List, Literal, Union, Annotated
from pydantic import BaseModel, Field


# ============================================================================
# Comparison Agent Schemas
# ============================================================================


class Discrepancy(BaseModel):
    """A specific discrepancy between audio and MIDI."""

    type: str = Field(description="Type of discrepancy (e.g., missing_pitch_bend, note_count_mismatch)")
    severity: Literal["low", "medium", "high"] = Field(description="Severity level")
    description: str = Field(description="Human-readable description of the issue")
    location: str = Field(description="Approximate time/location in the section (e.g., '2.5s-3.2s')")


class DiscrepancyAnalysis(BaseModel):
    """Complete analysis comparing audio features with MIDI data."""

    summary: str = Field(
        description="Overall summary of the comparison between audio and MIDI"
    )
    discrepancies: List[Discrepancy] = Field(
        description="List of specific discrepancies found",
        default_factory=list
    )
    confidence: Literal["low", "medium", "high"] = Field(
        description="Confidence level in the analysis"
    )


# ============================================================================
# MIDI Editor Agent Schemas - Flattened for json_schema compatibility
# ============================================================================


class ProposedChange(BaseModel):
    """
    A proposed MIDI editing operation.

    Flattened schema with all fields as Optional to work with OpenAI's json_schema method
    (which doesn't support oneOf/anyOf/allOf unions).

    The 'type' field determines which other fields are required:
    - merge_notes: note_indices, keep_first
    - add_pitch_bend: time, semitones
    - add_pitch_bend_sequence: start_time, end_time, start_semitones, end_semitones, num_points
    - modify_note: note_idx, and optionally pitch, start, end, velocity
    - add_note: pitch, start, end, velocity
    - delete_note: note_idx
    """

    # Required for all types
    type: Literal[
        "merge_notes",
        "add_pitch_bend",
        "add_pitch_bend_sequence",
        "modify_note",
        "add_note",
        "delete_note"
    ] = Field(description="Type of MIDI editing operation")

    description: str = Field(
        description="Human-readable description of what this change does"
    )

    reasoning: str = Field(
        description="Why this change is needed based on audio/MIDI analysis"
    )

    # merge_notes parameters
    note_indices: List[int] | None = Field(
        default=None,
        description="[merge_notes] Indices of notes to merge (in chronological order)"
    )
    keep_first: bool | None = Field(
        default=None,
        description="[merge_notes] If True, keep first note's properties; else use average"
    )

    # add_pitch_bend parameters
    time: float | None = Field(
        default=None,
        description="[add_pitch_bend] Time in seconds when bend occurs"
    )
    semitones: float | None = Field(
        default=None,
        description="[add_pitch_bend, add_pitch_bend_sequence] Pitch bend amount in semitones"
    )

    # add_pitch_bend_sequence parameters
    start_time: float | None = Field(
        default=None,
        description="[add_pitch_bend_sequence] Start time of bend in seconds"
    )
    end_time: float | None = Field(
        default=None,
        description="[add_pitch_bend_sequence] End time of bend in seconds"
    )
    start_semitones: float | None = Field(
        default=None,
        description="[add_pitch_bend_sequence] Starting pitch offset (usually 0.0)"
    )
    end_semitones: float | None = Field(
        default=None,
        description="[add_pitch_bend_sequence] Ending pitch offset in semitones"
    )
    num_points: int | None = Field(
        default=None,
        description="[add_pitch_bend_sequence] Number of intermediate bend points (2-50, more = smoother)",
        ge=2,
        le=50
    )

    # modify_note / delete_note parameters
    note_idx: int | None = Field(
        default=None,
        description="[modify_note, delete_note] Index of note to modify or delete"
    )

    # modify_note / add_note parameters
    pitch: int | None = Field(
        default=None,
        description="[modify_note, add_note] MIDI pitch (0-127)",
        ge=0,
        le=127
    )
    start: float | None = Field(
        default=None,
        description="[modify_note, add_note] Start time in seconds",
        ge=0.0
    )
    end: float | None = Field(
        default=None,
        description="[modify_note, add_note] End time in seconds",
        ge=0.0
    )
    velocity: float | None = Field(
        default=None,
        description="[modify_note, add_note] Note velocity (0.0-1.0)",
        ge=0.0,
        le=1.0
    )


class MIDIEditProposal(BaseModel):
    """Complete proposal of MIDI edits from the editor agent."""

    analysis_summary: str = Field(
        description="Brief summary explaining what issues were found and how to fix them"
    )
    proposed_changes: List[ProposedChange] = Field(
        description="List of specific MIDI editing operations to apply (can be empty if no issues found)",
        default_factory=list
    )
    confidence: Literal["low", "medium", "high"] = Field(
        description="Confidence level in the proposed edits"
    )
