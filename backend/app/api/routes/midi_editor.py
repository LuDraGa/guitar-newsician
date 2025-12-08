"""
MIDI Editor Routes
API endpoints for AI-powered MIDI editing with LangGraph agents.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from pathlib import Path
import uuid

from ...editors.midi_agent_editor.agents.graph import MIDIEditorWorkflow
from ...editors.midi_agent_editor.tools.midi_editor import MIDIEditor, Change

router = APIRouter(prefix="/midi-editor", tags=["midi-editor"])

# In-memory storage for pending approvals (in production, use database)
pending_changes: Dict[str, Dict] = {}


# Request/Response Models
class BasicPitchParams(BaseModel):
    """Parameters for basic-pitch transcription."""
    onset_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    frame_threshold: float = Field(default=0.3, ge=0.0, le=1.0)
    minimum_note_length: float = Field(default=58.0, description="Milliseconds")
    minimum_frequency: Optional[float] = Field(default=None, description="Hz")
    maximum_frequency: Optional[float] = Field(default=None, description="Hz")
    melodia_trick: bool = Field(default=True)
    multiple_pitch_bends: bool = Field(default=False)


class TranscribeRequest(BaseModel):
    """Request to transcribe audio to MIDI."""
    song_id: str
    stem_name: Optional[str] = None
    params: Optional[BasicPitchParams] = None
    force_retranscribe: bool = False


class EditRequest(BaseModel):
    """Request to edit MIDI using agents."""
    song_id: str
    stem_name: Optional[str] = None
    section_start: float
    section_end: float
    issue_description: str
    instrument_idx: int = 0


class ApprovalRequest(BaseModel):
    """Request to approve/reject proposed changes."""
    change_session_id: str
    approved: bool
    feedback: Optional[str] = None


class TranscribeResponse(BaseModel):
    """Response from transcription."""
    midi_path: str
    notes_detected: int
    params_used: BasicPitchParams
    message: str


class EditResponse(BaseModel):
    """Response from MIDI editing agent."""
    change_session_id: str
    proposed_changes: List[Dict[str, Any]]
    verification: Dict[str, Any]
    analysis_summary: str
    requires_approval: bool = True


class ApprovalResponse(BaseModel):
    """Response after approval/rejection."""
    status: str
    applied_changes: Optional[List[str]] = None
    message: str


class ChatMessage(BaseModel):
    """A single chat message."""
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    """Request to chat about MIDI."""
    song_id: str
    stem_name: Optional[str] = None
    query: str
    section_start: Optional[float] = None
    section_end: Optional[float] = None
    conversation_history: Optional[List[ChatMessage]] = None


class ChatResponse(BaseModel):
    """Response from MIDI chat."""
    response: str
    structured_data: Optional[Dict[str, Any]] = None


# Helper functions
def get_audio_path(song_id: str, stem_name: Optional[str] = None) -> str:
    """
    Get path to audio file for song/stem.

    Args:
        song_id: Song identifier
        stem_name: Optional stem name

    Returns:
        Path to audio file
    """
    # Get absolute path to downloads directory
    backend_dir = Path(__file__).parent.parent.parent.parent  # Go up to backend/
    downloads_dir = backend_dir.parent / "downloads"  # Go to project root / downloads
    song_dir = downloads_dir / song_id

    if stem_name:
        # Stem audio
        stem_file = song_dir / "stems" / f"{stem_name}.wav"
        if not stem_file.exists():
            raise HTTPException(404, f"Stem audio not found: {stem_file}")
        return str(stem_file.absolute())
    else:
        # Main audio
        audio_file = song_dir / "audio.wav"
        if not audio_file.exists():
            raise HTTPException(404, f"Audio not found: {audio_file}")
        return str(audio_file.absolute())


def get_midi_path(song_id: str, stem_name: Optional[str] = None) -> str:
    """
    Get path to MIDI file for song/stem.

    Args:
        song_id: Song identifier
        stem_name: Optional stem name

    Returns:
        Path to MIDI file
    """
    # Get absolute path to downloads directory
    backend_dir = Path(__file__).parent.parent.parent.parent  # Go up to backend/
    downloads_dir = backend_dir.parent / "downloads"  # Go to project root / downloads
    song_dir = downloads_dir / song_id

    if stem_name:
        # Stem MIDI
        midi_file = song_dir / "stems" / f"{stem_name}.mid"
    else:
        # Main MIDI
        midi_file = song_dir / "audio.mid"

    if not midi_file.exists():
        raise HTTPException(404, f"MIDI file not found: {midi_file}")

    return str(midi_file.absolute())


def get_default_params_for_stem(stem_name: Optional[str]) -> BasicPitchParams:
    """
    Get default transcription parameters based on stem type.

    Args:
        stem_name: Stem type (vocals, bass, guitar, etc.)

    Returns:
        BasicPitchParams optimized for stem type
    """
    if not stem_name:
        return BasicPitchParams()

    # Preset profiles based on stem type
    presets = {
        "vocals": BasicPitchParams(
            onset_threshold=0.3,
            frame_threshold=0.2,
            minimum_frequency=80,
            maximum_frequency=1000,
            melodia_trick=True
        ),
        "bass": BasicPitchParams(
            onset_threshold=0.4,
            frame_threshold=0.3,
            minimum_frequency=40,
            maximum_frequency=400,
            melodia_trick=True
        ),
        "guitar": BasicPitchParams(
            onset_threshold=0.3,
            frame_threshold=0.3,
            minimum_frequency=80,
            maximum_frequency=2000,
            melodia_trick=False
        ),
        "piano": BasicPitchParams(
            onset_threshold=0.25,
            frame_threshold=0.2,
            melodia_trick=False
        ),
        "drums": BasicPitchParams(
            onset_threshold=0.5,
            frame_threshold=0.5,
            minimum_frequency=40,
            maximum_frequency=8000,
            melodia_trick=False
        )
    }

    # Return preset or default
    return presets.get(stem_name.lower(), BasicPitchParams())


# Routes
@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio_to_midi(request: TranscribeRequest):
    """
    Transcribe audio to MIDI using basic-pitch with custom parameters.

    This endpoint supports parameter tuning during the testing phase to help
    identify optimal settings per stem type.
    """
    try:
        # Get audio path
        audio_path = get_audio_path(request.song_id, request.stem_name)

        # Use provided params or get defaults for stem type
        params = request.params or get_default_params_for_stem(request.stem_name)

        # Determine output MIDI path using absolute path
        backend_dir = Path(__file__).parent.parent.parent.parent
        downloads_dir = backend_dir.parent / "downloads"
        song_dir = downloads_dir / request.song_id

        if request.stem_name:
            midi_path = song_dir / "stems" / f"{request.stem_name}.mid"
        else:
            midi_path = song_dir / "audio.mid"

        midi_path = midi_path.absolute()

        # Check if already exists
        if midi_path.exists() and not request.force_retranscribe:
            raise HTTPException(
                400,
                f"MIDI already exists. Use force_retranscribe=true to regenerate."
            )

        # Import and run transcription
        from ...converters.wav2midi.wav2midi_converter import (
            convert_wav_to_midi,
            Wav2MidiConfig
        )

        # Create config from params
        config = Wav2MidiConfig(
            onset_threshold=params.onset_threshold,
            frame_threshold=params.frame_threshold,
            minimum_note_length=params.minimum_note_length,
            minimum_frequency=params.minimum_frequency,
            maximum_frequency=params.maximum_frequency,
            melodia_trick=params.melodia_trick,
            multiple_pitch_bends=params.multiple_pitch_bends
        )

        # Run transcription
        success = convert_wav_to_midi(
            audio_path=Path(audio_path),
            output_path=midi_path,
            config=config
        )

        if not success:
            raise HTTPException(500, "Transcription failed")

        # TODO: Log parameters for analysis
        # log_transcription_params(request.song_id, request.stem_name, params)

        # Count notes (simplified - read MIDI and count)
        import pretty_midi
        midi = pretty_midi.PrettyMIDI(str(midi_path))
        note_count = sum(len(inst.notes) for inst in midi.instruments)

        # Return URL path instead of file system path
        midi_url = f"/api/v1/midi-editor/download/{request.song_id}"
        if request.stem_name:
            midi_url += f"?stem_name={request.stem_name}"

        return TranscribeResponse(
            midi_path=midi_url,
            notes_detected=note_count,
            params_used=params,
            message=f"Successfully transcribed {Path(audio_path).name}"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Transcription error: {str(e)}")


@router.post("/edit", response_model=EditResponse)
async def edit_midi_with_agent(request: EditRequest):
    """
    Use AI agents to analyze and propose MIDI edits.

    The agent will:
    1. Analyze the audio section
    2. Analyze the MIDI section
    3. Compare and identify discrepancies
    4. Propose specific editing operations
    5. Return proposed changes for user approval
    """
    try:
        # Get paths
        audio_path = get_audio_path(request.song_id, request.stem_name)
        midi_path = get_midi_path(request.song_id, request.stem_name)

        # Initialize workflow
        workflow = MIDIEditorWorkflow()

        # Prepare initial state
        initial_state = {
            "audio_path": audio_path,
            "midi_path": midi_path,
            "section_start": request.section_start,
            "section_end": request.section_end,
            "user_description": request.issue_description,
            "instrument_idx": request.instrument_idx
        }

        # Run agent workflow
        result = workflow.run(initial_state)

        # Check for errors
        if result.get("error"):
            raise HTTPException(500, f"Agent workflow error: {result['error']}")

        # Generate session ID for tracking approval
        session_id = str(uuid.uuid4())

        # Store in pending changes
        pending_changes[session_id] = {
            "song_id": request.song_id,
            "stem_name": request.stem_name,
            "midi_path": midi_path,
            "proposed_changes": result.get("proposed_changes", []),
            "instrument_idx": request.instrument_idx
        }

        return EditResponse(
            change_session_id=session_id,
            proposed_changes=result.get("proposed_changes", []),
            verification=result.get("verification_result", {}),
            analysis_summary=result.get("analysis_summary", ""),
            requires_approval=True
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"MIDI editing error: {str(e)}")


@router.post("/approve", response_model=ApprovalResponse)
async def approve_midi_changes(request: ApprovalRequest):
    """
    Approve or reject proposed MIDI changes.

    If approved, applies the changes to the MIDI file.
    If rejected, discards the changes.
    """
    try:
        # Get pending changes
        if request.change_session_id not in pending_changes:
            raise HTTPException(404, "Change session not found or expired")

        session = pending_changes[request.change_session_id]

        if not request.approved:
            # User rejected - just clean up
            del pending_changes[request.change_session_id]
            return ApprovalResponse(
                status="rejected",
                message="Changes rejected by user"
            )

        # User approved - apply changes
        midi_path = session["midi_path"]
        proposed_changes = session["proposed_changes"]
        instrument_idx = session["instrument_idx"]

        # Load MIDI
        import pretty_midi
        midi = pretty_midi.PrettyMIDI(midi_path)

        # Apply changes
        editor = MIDIEditor()
        applied_change_ids = []

        for change in proposed_changes:
            change_type = change.get("type")

            # Support both formats: nested parameters and flattened (new structured output)
            # New format: all fields at top level (from Pydantic model_dump)
            # Old format: nested under "parameters" key
            if "parameters" in change:
                # Old format (nested)
                params = change["parameters"]
            else:
                # New format (flattened) - extract all non-common fields and filter out None
                params = {
                    k: v for k, v in change.items()
                    if k not in ["type", "description", "reasoning"] and v is not None
                }

            try:
                if change_type == "add_pitch_bend_sequence":
                    change_id = editor.add_pitch_bend_sequence(
                        midi,
                        instrument_idx,
                        **params
                    )
                    applied_change_ids.append(change_id)

                elif change_type == "add_pitch_bend":
                    change_id = editor.add_pitch_bend(
                        midi,
                        instrument_idx,
                        params["time"],
                        params["semitones"]
                    )
                    applied_change_ids.append(change_id)

                elif change_type == "merge_notes":
                    change_id = editor.merge_notes(
                        midi,
                        instrument_idx,
                        params["note_indices"],
                        params.get("keep_first", True)
                    )
                    applied_change_ids.append(change_id)

                elif change_type == "modify_note":
                    change_id = editor.modify_note(
                        midi,
                        instrument_idx,
                        params["note_idx"],
                        **{k: v for k, v in params.items() if k != "note_idx"}
                    )
                    applied_change_ids.append(change_id)

                elif change_type == "add_note":
                    change_id = editor.add_note(
                        midi,
                        instrument_idx,
                        **params
                    )
                    applied_change_ids.append(change_id)

                elif change_type == "delete_note":
                    change_id = editor.delete_note(
                        midi,
                        instrument_idx,
                        params["note_idx"]
                    )
                    applied_change_ids.append(change_id)

            except Exception as e:
                print(f"Warning: Failed to apply change {change_type}: {e}")
                print(f"Change data: {change}")
                print(f"Extracted params: {params}")

        # Save modified MIDI
        # Create backup first
        backup_path = Path(midi_path).with_suffix('.mid.bak')
        import shutil
        shutil.copy2(midi_path, backup_path)

        # Save modified version
        editor.save_midi(midi, midi_path)

        # Clean up session
        del pending_changes[request.change_session_id]

        return ApprovalResponse(
            status="applied",
            applied_changes=applied_change_ids,
            message=f"Successfully applied {len(applied_change_ids)} changes. Backup saved to {backup_path.name}"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error applying changes: {str(e)}")


@router.get("/status/{song_id}")
async def get_midi_status(song_id: str, stem_name: Optional[str] = None):
    """
    Check if MIDI file exists for a given song/stem.

    Returns status and metadata if it exists.
    """
    try:
        # Get absolute path to downloads directory
        backend_dir = Path(__file__).parent.parent.parent.parent
        downloads_dir = backend_dir.parent / "downloads"
        song_dir = downloads_dir / song_id

        if stem_name:
            midi_file = song_dir / "stems" / f"{stem_name}.mid"
        else:
            midi_file = song_dir / "audio.mid"

        if not midi_file.exists():
            return {
                "exists": False,
                "status": "none",
                "message": "MIDI file not found"
            }

        # File exists - get metadata
        import pretty_midi
        midi = pretty_midi.PrettyMIDI(str(midi_file.absolute()))
        note_count = sum(len(inst.notes) for inst in midi.instruments)

        # Return URL path instead of file system path
        midi_url = f"/api/v1/midi-editor/download/{song_id}"
        if stem_name:
            midi_url += f"?stem_name={stem_name}"

        return {
            "exists": True,
            "status": "transcribed",
            "midi_path": midi_url,
            "notes_detected": note_count,
            "message": "MIDI file exists"
        }

    except Exception as e:
        return {
            "exists": False,
            "status": "error",
            "message": f"Error checking MIDI: {str(e)}"
        }


@router.get("/download/{song_id}")
async def download_midi(song_id: str, stem_name: Optional[str] = None):
    """
    Download MIDI file for a given song/stem.

    Returns the MIDI file as a downloadable response.
    """
    try:
        midi_path = get_midi_path(song_id, stem_name)

        if not Path(midi_path).exists():
            raise HTTPException(404, f"MIDI file not found: {midi_path}")

        # Return file with proper MIME type
        return FileResponse(
            path=midi_path,
            media_type="audio/midi",
            filename=Path(midi_path).name
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error downloading MIDI: {str(e)}")


@router.post("/chat", response_model=ChatResponse)
async def chat_about_midi(request: ChatRequest):
    """
    Conversational MIDI analysis - no modifications.

    Chat about MIDI content, get analysis, discover patterns.
    This endpoint doesn't modify MIDI files.
    """
    try:
        # Get MIDI path and analyze
        midi_path = get_midi_path(request.song_id, request.stem_name)

        # Import analysis tools
        from ...editors.midi_agent_editor.tools.midi_tools import MIDIAnalyzer
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        # Analyze MIDI section (or full MIDI if no section specified)
        analyzer = MIDIAnalyzer()

        if request.section_start is not None and request.section_end is not None:
            # Analyze specific section
            midi_analysis = analyzer.analyze_section(
                midi_path=midi_path,
                start_time=request.section_start,
                end_time=request.section_end,
                instrument_idx=0
            )
            section_context = f"Selected section: {request.section_start:.2f}s - {request.section_end:.2f}s"
        else:
            # Analyze full MIDI
            midi_analysis = analyzer.analyze_section(
                midi_path=midi_path,
                start_time=0,
                end_time=999999,  # Large number to get all notes
                instrument_idx=0
            )
            section_context = "Analyzing entire MIDI file"

        # Build conversation history for context (keep last 4 messages for speed)
        conversation_messages = []
        if request.conversation_history:
            # Only keep recent context to speed up responses
            recent_history = request.conversation_history[-4:]
            for msg in recent_history:
                if msg.role == "user":
                    conversation_messages.append(HumanMessage(content=msg.content))
                else:
                    conversation_messages.append(SystemMessage(content=msg.content))

        # Create LLM - use faster model for chat (gpt-4o-mini is already fast, but lower temperature)
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)

        # System prompt - music theory expert, conversational
        system_prompt = """You are an expert music theorist and MIDI analyst. Your role is to help users understand their MIDI files through conversation.

You can:
- Analyze harmonic content (chords, progressions, keys)
- Identify melodic patterns and motifs
- Explain musical structure (verse, chorus, sections)
- Discuss rhythm and timing
- Compare different sections
- Provide music theory insights

Be conversational, educational, and specific. Reference timestamps when discussing sections.
If asked about patterns, list them with specific locations.
If asked about chords, provide chord names and progressions.

DO NOT propose MIDI edits - you're here to analyze and discuss, not modify."""

        # Prepare concise MIDI data summary
        notes_summary = [{'pitch': n.pitch_name, 'start': n.start, 'duration': n.duration} for n in midi_analysis['notes'][:15]]
        chords_summary = [c.chord_name for c in midi_analysis['chords'][:12]]

        # Build user prompt with MIDI analysis data
        user_prompt = f"""
{section_context}

User's Question: "{request.query}"

MIDI Summary:
- Total notes: {len(midi_analysis['notes'])}
- Sample notes: {notes_summary}
- Chords detected: {len(midi_analysis['chords'])}
- Chord progression: {chords_summary}
- Pitch bends: {len(midi_analysis['pitch_bends'])}

Analysis: {midi_analysis['description']}

Answer concisely and conversationally. Reference timestamps when relevant.
"""

        # Combine messages
        messages = [SystemMessage(content=system_prompt)] + conversation_messages + [HumanMessage(content=user_prompt)]

        # Get response
        response = llm.invoke(messages)

        return ChatResponse(
            response=response.content,
            structured_data={
                "notes_count": len(midi_analysis['notes']),
                "chords_detected": len(midi_analysis['chords']),
                "chord_names": [c.chord_name for c in midi_analysis['chords'][:20]],
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chat error: {str(e)}")


@router.get("/presets")
async def get_parameter_presets():
    """Get available basic-pitch parameter presets for different stem types."""
    return {
        "presets": {
            "vocals": {
                "onset_threshold": 0.3,
                "frame_threshold": 0.2,
                "minimum_frequency": 80,
                "maximum_frequency": 1000,
                "melodia_trick": True,
                "description": "Optimized for monophonic vocal tracks"
            },
            "bass": {
                "onset_threshold": 0.4,
                "frame_threshold": 0.3,
                "minimum_frequency": 40,
                "maximum_frequency": 400,
                "melodia_trick": True,
                "description": "Optimized for bass guitar and low-frequency instruments"
            },
            "guitar": {
                "onset_threshold": 0.3,
                "frame_threshold": 0.3,
                "minimum_frequency": 80,
                "maximum_frequency": 2000,
                "melodia_trick": False,
                "description": "Optimized for guitar (lead and rhythm)"
            },
            "piano": {
                "onset_threshold": 0.25,
                "frame_threshold": 0.2,
                "melodia_trick": False,
                "description": "Optimized for piano and keyboard instruments"
            },
            "drums": {
                "onset_threshold": 0.5,
                "frame_threshold": 0.5,
                "minimum_frequency": 40,
                "maximum_frequency": 8000,
                "melodia_trick": False,
                "description": "Optimized for pitched percussion"
            }
        }
    }
