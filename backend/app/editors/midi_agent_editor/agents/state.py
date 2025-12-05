"""
Shared state for MIDI editor agent workflow.
"""

from typing import TypedDict, Optional, List, Dict, Any
from dataclasses import dataclass


class MIDIEditorState(TypedDict):
    """
    Shared state across all agents in the MIDI editing workflow.
    """
    # Input parameters
    audio_path: str
    midi_path: str
    section_start: float
    section_end: float
    user_description: str
    instrument_idx: int  # Which MIDI instrument to edit

    # Analysis results
    audio_features: Optional[Dict[str, Any]]
    midi_features: Optional[Dict[str, Any]]

    # Comparison results
    discrepancies: Optional[List[Dict[str, Any]]]
    analysis_summary: Optional[str]

    # Editing proposals
    proposed_changes: Optional[List[Dict[str, Any]]]
    change_ids: Optional[List[str]]

    # Verification
    verification_result: Optional[Dict[str, Any]]
    is_valid: Optional[bool]

    # User interaction
    user_approval: Optional[bool]
    feedback: Optional[str]

    # Error handling
    error: Optional[str]
    current_step: Optional[str]


@dataclass
class DiscrepancyReport:
    """Report of discrepancy between audio and MIDI."""
    type: str  # "missing_bend", "incorrect_notes", "timing_mismatch", etc.
    severity: str  # "high", "medium", "low"
    description: str
    audio_evidence: str
    midi_evidence: str
    recommendation: str
