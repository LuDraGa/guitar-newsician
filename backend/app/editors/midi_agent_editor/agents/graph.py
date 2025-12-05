"""
LangGraph workflow for MIDI editing with multi-agent system.
"""

from typing import Dict, Any
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from .state import MIDIEditorState
from ..tools.audio_tools import AudioAnalyzer
from ..tools.midi_tools import MIDIAnalyzer
from ..tools.midi_editor import MIDIEditor


class MIDIEditorWorkflow:
    """
    LangGraph workflow orchestrating multi-agent MIDI editing.
    """

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.1):
        """
        Initialize MIDI editor workflow.

        Args:
            model_name: OpenAI model to use
            temperature: LLM temperature (lower = more deterministic)
        """
        self.llm = ChatOpenAI(model=model_name, temperature=temperature)
        self.audio_analyzer = AudioAnalyzer()
        self.midi_analyzer = MIDIAnalyzer()
        self.midi_editor = MIDIEditor()

        # Build the workflow graph
        self.workflow = self._build_graph()
        self.app = self.workflow.compile()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        workflow = StateGraph(MIDIEditorState)

        # Add nodes for each agent/step
        workflow.add_node("analyze_audio", self._analyze_audio_node)
        workflow.add_node("analyze_midi", self._analyze_midi_node)
        workflow.add_node("compare", self._comparison_node)
        workflow.add_node("propose_edits", self._editor_node)
        workflow.add_node("verify", self._verification_node)

        # Define edges
        workflow.set_entry_point("analyze_audio")
        workflow.add_edge("analyze_audio", "analyze_midi")
        workflow.add_edge("analyze_midi", "compare")
        workflow.add_edge("compare", "propose_edits")
        workflow.add_edge("propose_edits", "verify")
        workflow.add_edge("verify", END)

        return workflow

    def _analyze_audio_node(self, state: MIDIEditorState) -> Dict[str, Any]:
        """
        Audio analysis agent node.
        Extracts audio features using analysis tools.
        """
        try:
            state["current_step"] = "Analyzing audio section"

            # Run audio analysis
            audio_results = self.audio_analyzer.analyze_section(
                audio_path=state["audio_path"],
                start_time=state["section_start"],
                end_time=state["section_end"]
            )

            state["audio_features"] = {
                "pitch_points": [
                    {"time": p.time, "frequency": p.frequency, "confidence": p.confidence}
                    for p in audio_results["pitch_points"]
                ],
                "onsets": [
                    {"time": o.time, "strength": o.strength}
                    for o in audio_results["onsets"]
                ],
                "bends": [
                    {
                        "start_time": b.start_time,
                        "end_time": b.end_time,
                        "start_freq": b.start_freq,
                        "end_freq": b.end_freq,
                        "semitones": b.semitones,
                        "direction": b.direction
                    }
                    for b in audio_results["bends"]
                ],
                "vibratos": [
                    {
                        "start_time": v.start_time,
                        "end_time": v.end_time,
                        "rate": v.rate,
                        "extent": v.extent
                    }
                    for v in audio_results["vibratos"]
                ],
                "description": audio_results["description"]
            }

        except Exception as e:
            state["error"] = f"Audio analysis error: {str(e)}"

        return state

    def _analyze_midi_node(self, state: MIDIEditorState) -> Dict[str, Any]:
        """
        MIDI analysis agent node.
        Extracts MIDI features using analysis tools.
        """
        try:
            state["current_step"] = "Analyzing MIDI section"

            # Run MIDI analysis
            midi_results = self.midi_analyzer.analyze_section(
                midi_path=state["midi_path"],
                start_time=state["section_start"],
                end_time=state["section_end"],
                instrument_idx=state.get("instrument_idx", 0)
            )

            state["midi_features"] = {
                "notes": [
                    {
                        "note_id": n.note_id,
                        "pitch": n.pitch,
                        "pitch_name": n.pitch_name,
                        "start": n.start,
                        "end": n.end,
                        "duration": n.duration,
                        "velocity": n.velocity
                    }
                    for n in midi_results["notes"]
                ],
                "chords": [
                    {
                        "time": c.time,
                        "duration": c.duration,
                        "notes": c.notes,
                        "chord_name": c.chord_name
                    }
                    for c in midi_results["chords"]
                ],
                "pitch_bends": [
                    {"time": pb.time, "value": pb.value, "semitones": pb.semitones}
                    for pb in midi_results["pitch_bends"]
                ],
                "description": midi_results["description"]
            }

        except Exception as e:
            state["error"] = f"MIDI analysis error: {str(e)}"

        return state

    def _comparison_node(self, state: MIDIEditorState) -> Dict[str, Any]:
        """
        Comparison agent node.
        Uses LLM to identify discrepancies between audio and MIDI.
        """
        try:
            state["current_step"] = "Comparing audio and MIDI features"

            # Prepare prompt for LLM
            system_prompt = """You are an expert music transcription analyst.
Your task is to compare audio analysis features with MIDI data and identify discrepancies.
Focus on:
1. Missing pitch bends (audio shows bend, MIDI has discrete notes)
2. Incorrect note splitting (audio shows one note, MIDI shows multiple)
3. Timing misalignments
4. Missing articulations (vibrato, slides, etc.)

Provide a structured analysis of discrepancies with severity levels."""

            user_prompt = f"""
User Issue Description: {state['user_description']}

Audio Analysis:
{state['audio_features']['description']}

MIDI Analysis:
{state['midi_features']['description']}

Audio Pitch Bends Detected: {len(state['audio_features']['bends'])}
MIDI Pitch Bends Present: {len(state['midi_features']['pitch_bends'])}

Audio Onsets: {len(state['audio_features']['onsets'])}
MIDI Notes: {len(state['midi_features']['notes'])}

Based on the user's description and the analysis data, identify specific discrepancies
and recommend corrections. Format your response as a structured analysis.
"""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]

            response = self.llm.invoke(messages)

            state["analysis_summary"] = response.content
            state["discrepancies"] = self._parse_discrepancies(
                response.content,
                state["audio_features"],
                state["midi_features"]
            )

        except Exception as e:
            state["error"] = f"Comparison error: {str(e)}"

        return state

    def _editor_node(self, state: MIDIEditorState) -> Dict[str, Any]:
        """
        MIDI editor agent node.
        Uses LLM to propose specific MIDI editing operations.
        """
        try:
            state["current_step"] = "Proposing MIDI edits"

            system_prompt = """You are an expert MIDI editor. Based on the discrepancy analysis,
propose specific MIDI editing operations to fix the issues.

Available operations:
1. merge_notes: Merge multiple notes into one (for incorrect splits)
2. add_pitch_bend: Add pitch bend events (for missing bends/slides)
3. modify_note: Change note properties (pitch, timing, velocity)
4. add_note: Add missing notes
5. delete_note: Remove incorrect notes

Provide concrete, executable editing instructions."""

            user_prompt = f"""
Analysis Summary:
{state['analysis_summary']}

User's Issue: {state['user_description']}

Audio Features:
- Bends detected: {state['audio_features']['bends']}

MIDI Features:
- Notes: {len(state['midi_features']['notes'])}
- Existing bends: {len(state['midi_features']['pitch_bends'])}

Propose specific MIDI editing operations to address the discrepancies.
Format each operation clearly with parameters.
"""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]

            response = self.llm.invoke(messages)

            # Parse proposed changes
            state["proposed_changes"] = self._parse_proposed_changes(
                response.content,
                state
            )

        except Exception as e:
            state["error"] = f"Editor error: {str(e)}"

        return state

    def _verification_node(self, state: MIDIEditorState) -> Dict[str, Any]:
        """
        Verification agent node.
        Validates proposed changes before applying.
        """
        try:
            state["current_step"] = "Verifying proposed changes"

            # Basic validation checks
            is_valid = True
            issues = []

            if not state.get("proposed_changes"):
                is_valid = False
                issues.append("No changes proposed")

            # Check change validity
            for change in state.get("proposed_changes", []):
                change_type = change.get("type")

                if change_type not in [
                    "merge_notes", "add_pitch_bend", "modify_note",
                    "add_note", "delete_note", "add_pitch_bend_sequence"
                ]:
                    issues.append(f"Invalid change type: {change_type}")
                    is_valid = False

            state["verification_result"] = {
                "is_valid": is_valid,
                "issues": issues,
                "change_count": len(state.get("proposed_changes", [])),
                "summary": f"{'Valid' if is_valid else 'Invalid'}: {len(state.get('proposed_changes', []))} changes proposed"
            }
            state["is_valid"] = is_valid

        except Exception as e:
            state["error"] = f"Verification error: {str(e)}"
            state["is_valid"] = False

        return state

    def _parse_discrepancies(
        self,
        llm_response: str,
        audio_features: Dict,
        midi_features: Dict
    ) -> list:
        """
        Parse LLM response to extract structured discrepancies.
        This is a simplified parser - could be enhanced with structured output.
        """
        # For now, return a basic discrepancy based on feature comparison
        discrepancies = []

        # Check for missing bends
        if len(audio_features["bends"]) > len(midi_features["pitch_bends"]):
            discrepancies.append({
                "type": "missing_pitch_bends",
                "severity": "high",
                "count": len(audio_features["bends"]) - len(midi_features["pitch_bends"]),
                "audio_bends": audio_features["bends"]
            })

        # Check for note count mismatch
        if len(audio_features["onsets"]) != len(midi_features["notes"]):
            discrepancies.append({
                "type": "note_count_mismatch",
                "severity": "medium",
                "audio_onsets": len(audio_features["onsets"]),
                "midi_notes": len(midi_features["notes"])
            })

        return discrepancies

    def _parse_proposed_changes(
        self,
        llm_response: str,
        state: MIDIEditorState
    ) -> list:
        """
        Parse LLM response to extract proposed MIDI changes.
        This is simplified - could use structured output or function calling.
        """
        changes = []

        # If audio shows bends but MIDI doesn't have them, propose adding bends
        audio_bends = state["audio_features"]["bends"]
        midi_bends = state["midi_features"]["pitch_bends"]

        if len(audio_bends) > len(midi_bends):
            for bend in audio_bends:
                changes.append({
                    "type": "add_pitch_bend_sequence",
                    "parameters": {
                        "start_time": bend["start_time"],
                        "end_time": bend["end_time"],
                        "start_semitones": 0.0,
                        "end_semitones": bend["semitones"],
                        "num_points": 10
                    },
                    "description": f"Add pitch bend {bend['direction']} {abs(bend['semitones']):.1f} semitones",
                    "reasoning": "Audio analysis detected pitch bend not present in MIDI"
                })

        return changes

    async def arun(self, initial_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the workflow asynchronously.

        Args:
            initial_state: Initial state dict

        Returns:
            Final state after workflow completion
        """
        # Add defaults
        if "instrument_idx" not in initial_state:
            initial_state["instrument_idx"] = 0

        result = await self.app.ainvoke(initial_state)
        return result

    def run(self, initial_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the workflow synchronously.

        Args:
            initial_state: Initial state dict

        Returns:
            Final state after workflow completion
        """
        # Add defaults
        if "instrument_idx" not in initial_state:
            initial_state["instrument_idx"] = 0

        result = self.app.invoke(initial_state)
        return result
