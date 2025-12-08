"""
LangGraph workflow for MIDI editing with multi-agent system.
"""

from typing import Dict, Any
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from .state import MIDIEditorState
from .schemas import DiscrepancyAnalysis, MIDIEditProposal
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
                end_time=state["section_end"],
            )

            state["audio_features"] = {
                "pitch_points": [
                    {
                        "time": p.time,
                        "frequency": p.frequency,
                        "confidence": p.confidence,
                    }
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
                        "direction": b.direction,
                    }
                    for b in audio_results["bends"]
                ],
                "vibratos": [
                    {
                        "start_time": v.start_time,
                        "end_time": v.end_time,
                        "rate": v.rate,
                        "extent": v.extent,
                    }
                    for v in audio_results["vibratos"]
                ],
                "description": audio_results["description"],
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
                instrument_idx=state.get("instrument_idx", 0),
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
                        "velocity": n.velocity,
                    }
                    for n in midi_results["notes"]
                ],
                "chords": [
                    {
                        "time": c.time,
                        "duration": c.duration,
                        "notes": c.notes,
                        "chord_name": c.chord_name,
                    }
                    for c in midi_results["chords"]
                ],
                "pitch_bends": [
                    {"time": pb.time, "value": pb.value, "semitones": pb.semitones}
                    for pb in midi_results["pitch_bends"]
                ],
                "description": midi_results["description"],
            }

        except Exception as e:
            state["error"] = f"MIDI analysis error: {str(e)}"

        return state

    def _comparison_node(self, state: MIDIEditorState) -> Dict[str, Any]:
        """
        Comparison agent node.
        Uses LLM with structured output to identify discrepancies between audio and MIDI.
        """
        try:
            state["current_step"] = "Comparing audio and MIDI features"

            # Create structured output LLM
            structured_llm = self.llm.with_structured_output(
                schema=DiscrepancyAnalysis,
                method="json_schema",
                strict=True
            )

            # Prepare prompt for LLM
            system_prompt = """You are an expert music transcription analyst.
Your task is to compare audio analysis features with MIDI data and identify discrepancies.

Common issues to look for:
1. **Missing pitch bends**: Audio shows pitch bend/slide, MIDI has discrete notes
2. **Incorrect note splitting**: Audio shows one sustained note, MIDI shows multiple short notes
3. **Timing misalignments**: Note starts/ends don't match audio onsets
4. **Missing articulations**: Vibrato, slides, or other expression not captured
5. **Wrong pitches**: MIDI pitch doesn't match detected audio frequency
6. **Extra/missing notes**: MIDI has notes not present in audio or vice versa

Analyze the data carefully and provide:
- A clear summary of what's wrong
- Specific discrepancies with severity levels
- Location information (time ranges) for each issue"""

            # Prepare MIDI notes summary
            midi_notes_summary = [
                {
                    'pitch': n['pitch_name'],
                    'start': n['start'],
                    'duration': n['duration']
                }
                for n in state['midi_features']['notes'][:5]
            ]

            user_prompt = f"""
User's Issue Description: "{state['user_description']}"

Section Time Range: {state['section_start']:.2f}s - {state['section_end']:.2f}s

Audio Analysis Summary:
{state['audio_features']['description']}

MIDI Analysis Summary:
{state['midi_features']['description']}

Detailed Comparison:
- Audio Pitch Bends Detected: {len(state['audio_features']['bends'])}
- MIDI Pitch Bends Present: {len(state['midi_features']['pitch_bends'])}
- Audio Onsets Detected: {len(state['audio_features']['onsets'])}
- MIDI Notes Present: {len(state['midi_features']['notes'])}

Audio Bends Detail: {state['audio_features']['bends'][:3] if state['audio_features']['bends'] else 'None detected'}
MIDI Notes Detail (first 5): {midi_notes_summary}

Based on the user's description and this analysis data, identify specific discrepancies.
"""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            # Get structured response
            analysis: DiscrepancyAnalysis = structured_llm.invoke(messages)

            # Store in state
            state["analysis_summary"] = analysis.summary
            state["discrepancies"] = [d.model_dump() for d in analysis.discrepancies]

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"❌ Comparison node error: {str(e)}")
            print(f"Traceback:\n{error_details}")
            state["error"] = f"Comparison error: {str(e)}"

        return state

    def _editor_node(self, state: MIDIEditorState) -> Dict[str, Any]:
        """
        MIDI editor agent node.
        Uses LLM with structured output to propose specific MIDI editing operations.
        """
        try:
            # Check if previous nodes failed
            if state.get("error"):
                # Don't proceed if there's already an error
                return state

            state["current_step"] = "Proposing MIDI edits"

            # Create structured output LLM
            structured_llm = self.llm.with_structured_output(
                schema=MIDIEditProposal,
                method="json_schema",
                strict=True
            )

            system_prompt = """You are an expert MIDI editor. Based on the discrepancy analysis,
propose specific MIDI editing operations to fix the issues.

Available operations (choose the appropriate type):

1. **merge_notes**: Merge multiple MIDI notes into one continuous note
   - Use when: Audio shows one sustained note but MIDI has it split into multiple notes
   - Parameters: note_indices (which notes to merge), keep_first (preserve first note's properties)

2. **add_pitch_bend_sequence**: Add a smooth pitch bend over time (for slides, bends, vibrato)
   - Use when: Audio shows pitch bend/slide but MIDI doesn't have it
   - Parameters: start_time, end_time, start_semitones (usually 0), end_semitones, num_points
   - Example: Guitar bend up 2 semitones over 0.5 seconds

3. **add_pitch_bend**: Add a single pitch bend event at a specific time
   - Use when: Quick pitch adjustment needed
   - Parameters: time, semitones

4. **modify_note**: Change properties of an existing note
   - Use when: Note has wrong pitch, timing, or velocity
   - Parameters: note_idx, pitch (MIDI 0-127), start, end, velocity (0-1)

5. **add_note**: Add a completely new note
   - Use when: MIDI is missing a note that's clearly in the audio
   - Parameters: pitch, start, end, velocity

6. **delete_note**: Remove an incorrect note
   - Use when: MIDI has a note that doesn't exist in audio (transcription artifact)
   - Parameters: note_idx

**Important**:
- Be specific and surgical - only fix what's necessary
- Reference note indices from the MIDI notes list (0-indexed)
- For time-based operations, use seconds (not beats)
- Provide clear reasoning for each change"""

            user_prompt = f"""
User's Issue Description: "{state['user_description']}"

Analysis Summary:
{state.get('analysis_summary', 'No prior analysis available - analyze based on raw features below.')}

Identified Discrepancies:
{state.get('discrepancies', [])}

Audio Features Available:
- Pitch bends detected: {len(state.get('audio_features', {}).get('bends', []))}
- Bend details: {state.get('audio_features', {}).get('bends', [])}
- Onsets detected: {len(state.get('audio_features', {}).get('onsets', []))}

MIDI Features Current State:
- Notes present: {len(state.get('midi_features', {}).get('notes', []))}
- Note details: {state.get('midi_features', {}).get('notes', [])}
- Existing pitch bends: {len(state.get('midi_features', {}).get('pitch_bends', []))}

Based on this analysis, propose specific MIDI editing operations.
Each operation must include:
1. Correct operation type
2. All required parameters with proper values
3. Clear description of what it does
4. Reasoning explaining why it's needed

If no changes are needed (MIDI already matches audio), return empty proposed_changes list.
"""

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            # Get structured response
            proposal: MIDIEditProposal = structured_llm.invoke(messages)

            # Store in state
            state["analysis_summary"] = proposal.analysis_summary
            state["proposed_changes"] = [c.model_dump() for c in proposal.proposed_changes]

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"❌ Editor node error: {str(e)}")
            print(f"Traceback:\n{error_details}")
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
                    "merge_notes",
                    "add_pitch_bend",
                    "modify_note",
                    "add_note",
                    "delete_note",
                    "add_pitch_bend_sequence",
                ]:
                    issues.append(f"Invalid change type: {change_type}")
                    is_valid = False

            state["verification_result"] = {
                "is_valid": is_valid,
                "issues": issues,
                "change_count": len(state.get("proposed_changes", [])),
                "summary": f"{'Valid' if is_valid else 'Invalid'}: {len(state.get('proposed_changes', []))} changes proposed",
            }
            state["is_valid"] = is_valid

        except Exception as e:
            state["error"] = f"Verification error: {str(e)}"
            state["is_valid"] = False

        return state


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
