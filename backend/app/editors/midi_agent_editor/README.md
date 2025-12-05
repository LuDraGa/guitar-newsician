# MIDI Agent Editor

AI-powered MIDI editing system using LangGraph multi-agent orchestration with OpenAI GPT models.

## Overview

This module provides intelligent MIDI editing capabilities that can:
- Analyze audio and MIDI to detect transcription errors
- Propose corrections for guitar techniques (bends, hammer-ons, slides, etc.)
- Allow user approval before applying changes
- Support parameter tuning for basic-pitch transcription

## Architecture

```
midi_agent_editor/
├── tools/              # Analysis and editing tools
│   ├── audio_tools.py  # Audio feature extraction (librosa-based)
│   ├── midi_tools.py   # MIDI parsing and analysis
│   └── midi_editor.py  # MIDI modification operations
├── agents/             # LangGraph agent system
│   ├── state.py        # Shared state definition
│   └── graph.py        # Workflow orchestration
└── README.md
```

## API Endpoints

### 1. Transcribe Audio to MIDI

```bash
POST /api/v1/midi-editor/transcribe
```

**Request:**
```json
{
  "song_id": "my-song",
  "stem_name": "guitar",
  "params": {
    "onset_threshold": 0.3,
    "frame_threshold": 0.3,
    "minimum_note_length": 58.0,
    "minimum_frequency": 80,
    "maximum_frequency": 2000,
    "melodia_trick": false,
    "multiple_pitch_bends": false
  },
  "force_retranscribe": false
}
```

**Response:**
```json
{
  "midi_path": "downloads/my-song/stems/guitar.mid",
  "notes_detected": 142,
  "params_used": { ... },
  "message": "Successfully transcribed guitar.wav"
}
```

### 2. Edit MIDI with Agents

```bash
POST /api/v1/midi-editor/edit
```

**Request:**
```json
{
  "song_id": "my-song",
  "stem_name": "guitar",
  "section_start": 23.5,
  "section_end": 27.0,
  "issue_description": "This section has a string bend, not two separate notes",
  "instrument_idx": 0
}
```

**Response:**
```json
{
  "change_session_id": "uuid-here",
  "proposed_changes": [
    {
      "type": "add_pitch_bend_sequence",
      "parameters": {
        "start_time": 24.1,
        "end_time": 24.5,
        "start_semitones": 0.0,
        "end_semitones": 2.0,
        "num_points": 10
      },
      "description": "Add pitch bend up 2.0 semitones",
      "reasoning": "Audio analysis detected pitch bend not present in MIDI"
    }
  ],
  "verification": {
    "is_valid": true,
    "change_count": 1,
    "summary": "Valid: 1 changes proposed"
  },
  "analysis_summary": "...",
  "requires_approval": true
}
```

### 3. Approve/Reject Changes

```bash
POST /api/v1/midi-editor/approve
```

**Request:**
```json
{
  "change_session_id": "uuid-here",
  "approved": true,
  "feedback": null
}
```

**Response:**
```json
{
  "status": "applied",
  "applied_changes": ["add_bend_0"],
  "message": "Successfully applied 1 changes. Backup saved to guitar.mid.bak"
}
```

### 4. Get Parameter Presets

```bash
GET /api/v1/midi-editor/presets
```

**Response:**
```json
{
  "presets": {
    "vocals": {
      "onset_threshold": 0.3,
      "frame_threshold": 0.2,
      "minimum_frequency": 80,
      "maximum_frequency": 1000,
      "melodia_trick": true,
      "description": "Optimized for monophonic vocal tracks"
    },
    "guitar": { ... },
    "bass": { ... },
    ...
  }
}
```

## Usage Example

### 1. Transcribe stem to MIDI

```python
import requests

response = requests.post("http://localhost:8000/api/v1/midi-editor/transcribe", json={
    "song_id": "bohemian-rhapsody",
    "stem_name": "guitar",
    "params": {
        "onset_threshold": 0.3,
        "frame_threshold": 0.3,
        "melodia_trick": false
    }
})

print(response.json())
# {'midi_path': '...', 'notes_detected': 234, ...}
```

### 2. Request agent to fix issue

```python
response = requests.post("http://localhost:8000/api/v1/midi-editor/edit", json={
    "song_id": "bohemian-rhapsody",
    "stem_name": "guitar",
    "section_start": 45.2,
    "section_end": 48.1,
    "issue_description": "Guitar solo has string bends that weren't captured"
})

result = response.json()
session_id = result["change_session_id"]
print(f"Proposed {len(result['proposed_changes'])} changes")
```

### 3. Approve changes

```python
response = requests.post("http://localhost:8000/api/v1/midi-editor/approve", json={
    "change_session_id": session_id,
    "approved": True
})

print(response.json())
# {'status': 'applied', 'applied_changes': [...], ...}
```

## Agent Workflow

The LangGraph workflow consists of:

1. **Audio Analysis Node** - Extracts pitch tracking, onsets, bends, vibrato
2. **MIDI Analysis Node** - Parses notes, chords, pitch bends, timing
3. **Comparison Node** - Uses LLM to identify discrepancies
4. **Editor Node** - LLM proposes specific MIDI editing operations
5. **Verification Node** - Validates proposed changes

## Audio Analysis Tools

Located in `tools/audio_tools.py`:

- `pitch_tracking()` - pYIN-based pitch detection
- `onset_detection()` - Note attack detection
- `spectral_analysis()` - Frequency content analysis
- `detect_pitch_bends()` - Identify pitch glides
- `detect_vibrato()` - Find periodic pitch modulation
- `describe_audio_features()` - Convert to LLM-readable text

## MIDI Analysis Tools

Located in `tools/midi_tools.py`:

- `extract_section()` - Get notes in time range
- `parse_notes()` - Convert to structured events
- `detect_chords()` - Find simultaneous notes
- `get_pitch_bends()` - Extract existing bends
- `time_align()` - Align audio onsets with MIDI notes
- `describe_midi_events()` - Convert to LLM-readable text

## MIDI Editor Tools

Located in `tools/midi_editor.py`:

- `add_note()` - Insert new notes
- `modify_note()` - Change pitch/timing/velocity
- `delete_note()` - Remove notes
- `merge_notes()` - Combine split notes
- `add_pitch_bend()` - Single bend event
- `add_pitch_bend_sequence()` - Smooth bend curve
- `add_control_change()` - Add CC events
- `quantize_timing()` - Snap to grid

## Testing

### Run API Server

```bash
cd backend
python run_api.py
```

API docs available at: `http://localhost:8000/docs`

### Test with Sample Audio

1. Download a song with guitar
2. Separate stems
3. Transcribe guitar stem
4. Identify problematic section
5. Request agent edit
6. Review and approve changes

## Configuration

### Environment Variables

```bash
# backend/.env
OPENAI_API_KEY=sk-...
```

### Basic-Pitch Parameters

Adjust in API request or use presets for stem types:
- **Vocals**: High melodia_trick, narrow frequency range
- **Bass**: Low frequency range, high onset threshold
- **Guitar**: Mid-range frequency, moderate thresholds
- **Piano**: Wide range, low thresholds, no melodia trick
- **Drums**: High thresholds, wide frequency range

## Limitations

- LLM cannot process audio directly (uses tool-generated descriptions)
- Pitch tracking accuracy depends on audio quality
- Guitar technique detection is heuristic-based
- Best results with isolated stems (not full mix)
- Requires manual approval for safety

## Future Enhancements

- Auto-detection mode (scan entire MIDI proactively)
- Batch editing (apply same fix to multiple sections)
- Style learning (remember user preferences)
- Tablature generation (convert MIDI to guitar tab)
- Real-time MIDI preview synthesis
- Integration with DAWs (export formats)

## Dependencies

- `langgraph` - Agent orchestration
- `langchain-openai` - LLM integration
- `librosa` - Audio analysis
- `pretty_midi` - MIDI manipulation
- `numpy`, `scipy` - Numerical processing
- `soundfile` - Audio I/O

## License

Part of WereCode project.
