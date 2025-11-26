# WAV to MIDI Converter Implementation

**Date**: 2025-11-08 (Updated: 2025-11-10)
**Status**: ✅ Completed
**Goal**: Create a module to convert audio files (main audio or stems) to MIDI using Spotify's basic-pitch library

---

## Overview

**Technology Switch**: Initially planned with Essentia → Switched to **Spotify's basic-pitch** for superior transcription quality and polyphonic support.

Basic-pitch provides:
- **Neural network-based transcription** - More accurate than traditional pitch tracking
- **Polyphonic support** - Handles chords and multiple simultaneous notes
- **Instrument-agnostic** - Works on any audio source
- **Multiple format support** - WAV, MP3, FLAC, OGG, M4A
- **Pitch bend detection** - Captures expressive pitch variations

### Use Cases
1. Convert main `audio.wav` to `audio.mid`
2. Convert individual stems to MIDI (e.g., `stems/vocals.wav` → `stems/vocals.mid`)
3. Batch convert all stems in a song directory
4. Interactive TUI selection (following project patterns)

---

## Architecture

### Module Structure (`app/converters/wav2midi/`)

```
app/converters/wav2midi/
├── __init__.py                    # Public API exports
├── wav2midi_converter.py          # Core conversion logic + config
├── main.py                        # Interactive Rich TUI
└── config.yaml                    # YAML configuration
```

### API Service (`app/api/services/midi_service.py`)

- Async wrapper for conversion
- Job manager integration
- Batch processing support
- Error handling and recovery

---

## Implementation Details

### 1. Dependencies

**Add to `pyproject.toml`:**
```toml
dependencies = [
    ...
    "mido>=1.3.2",
]
```

**Install:**
```bash
uv add mido
```

---

### 2. Core Converter (`wav2midi_converter.py`)

#### Configuration Model (Pydantic)

```python
class Wav2MidiConfig(BaseModel):
    """Configuration for WAV to MIDI converter."""

    # Input/Output
    input_dir: Path = Field(default=Path("downloads"))
    output_mode: str = Field(
        default="in_place",
        description="Where to save MIDI: 'in_place', 'outputs', 'custom'"
    )
    output_dir: Optional[Path] = Field(default=None)

    # Conversion modes
    stems_mode: str = Field(
        default="optional",
        description="Stem handling: 'disabled', 'optional', 'stems_only'"
    )
    convert_main_audio: bool = Field(default=True)

    # Essentia Melodia settings
    frame_size: int = Field(default=2048)
    hop_size: int = Field(default=128)
    sample_rate: int = Field(default=44100)
    melodia_bin_resolution: float = Field(default=10.0)  # cents
    melodia_filter_iterations: int = Field(default=3)
    melodia_min_frequency: float = Field(default=55.0)    # Hz (A1)
    melodia_max_frequency: float = Field(default=1760.0)  # Hz (A6)

    # Pitch contour segmentation
    pitch_confidence_threshold: float = Field(
        default=0.0,
        description="Min confidence for valid pitch (0-1)"
    )
    min_note_duration: float = Field(
        default=0.1,
        description="Min note duration in seconds"
    )

    # MIDI settings
    midi_velocity: int = Field(default=80, ge=1, le=127)
    midi_tempo_bpm: int = Field(default=120, ge=20, le=300)
    midi_program: int = Field(
        default=0,
        description="MIDI program/instrument (0=Piano, 24=Guitar, etc.)"
    )

    # Processing
    overwrite: bool = Field(default=False)
    skip_existing: bool = Field(default=True)
    supported_formats: List[str] = Field(default=["wav"])
```

#### Core Conversion Function

```python
def convert_wav_to_midi(
    wav_path: Path,
    output_path: Path,
    config: Wav2MidiConfig,
    progress_callback: Optional[Callable] = None
) -> bool:
    """
    Convert WAV file to MIDI using Essentia pitch extraction.

    Args:
        wav_path: Input WAV file
        output_path: Output MIDI file path
        config: Configuration object
        progress_callback: Optional callback(message: str, progress: float)

    Returns:
        True if successful, False otherwise

    Pipeline:
        1. Load audio with EqloudLoader (optimized for melody)
        2. Extract pitch contour with PredominantPitchMelodia
        3. Segment contour into notes with PitchContourSegmentation
        4. Convert to MIDI with mido
    """
    try:
        # Step 1: Load audio
        if progress_callback:
            progress_callback("Loading audio...", 10)

        loader = es.EqloudLoader(filename=str(wav_path), sampleRate=config.sample_rate)
        audio = loader()

        # Step 2: Extract pitch contour
        if progress_callback:
            progress_callback("Extracting pitch contour...", 30)

        melodia = es.PredominantPitchMelodia(
            frameSize=config.frame_size,
            hopSize=config.hop_size,
            sampleRate=config.sample_rate,
            binResolution=config.melodia_bin_resolution,
            filterIterations=config.melodia_filter_iterations,
            minFrequency=config.melodia_min_frequency,
            maxFrequency=config.melodia_max_frequency
        )
        pitch_contour, pitch_confidence = melodia(audio)

        # Step 3: Segment into notes
        if progress_callback:
            progress_callback("Segmenting notes...", 60)

        segmentation = es.PitchContourSegmentation(
            hopSize=config.hop_size,
            sampleRate=config.sample_rate,
            minDuration=config.min_note_duration,
            pitchConfidence=config.pitch_confidence_threshold
        )
        onsets, durations, midi_notes = segmentation(pitch_contour, pitch_confidence)

        # Step 4: Write MIDI file
        if progress_callback:
            progress_callback("Writing MIDI file...", 80)

        _write_midi_file(
            output_path,
            onsets,
            durations,
            midi_notes,
            config.midi_velocity,
            config.midi_tempo_bpm,
            config.midi_program
        )

        if progress_callback:
            progress_callback("Conversion complete", 100)

        return True

    except Exception as e:
        console.print(f"[red]Error converting {wav_path.name}: {e}[/red]")
        return False


def _write_midi_file(
    output_path: Path,
    onsets: np.ndarray,
    durations: np.ndarray,
    midi_notes: np.ndarray,
    velocity: int,
    tempo_bpm: int,
    program: int
) -> None:
    """Write MIDI file using mido."""
    from mido import MidiFile, MidiTrack, Message, MetaMessage, bpm2tempo

    mid = MidiFile()
    track = MidiTrack()
    mid.tracks.append(track)

    # Set tempo
    track.append(MetaMessage('set_tempo', tempo=bpm2tempo(tempo_bpm)))

    # Set program/instrument
    track.append(Message('program_change', program=program, time=0))

    # Convert onsets/durations to MIDI ticks (480 ticks per beat)
    ticks_per_beat = mid.ticks_per_beat
    seconds_per_beat = 60.0 / tempo_bpm
    ticks_per_second = ticks_per_beat / seconds_per_beat

    # Create note events
    events = []
    for onset, duration, note in zip(onsets, durations, midi_notes):
        if note > 0:  # Skip invalid notes
            start_tick = int(onset * ticks_per_second)
            end_tick = int((onset + duration) * ticks_per_second)
            events.append(('note_on', start_tick, int(note), velocity))
            events.append(('note_off', end_tick, int(note), 0))

    # Sort by time and convert to delta times
    events.sort(key=lambda x: x[1])

    current_tick = 0
    for event_type, tick, note, vel in events:
        delta = tick - current_tick
        track.append(Message(event_type, note=note, velocity=vel, time=delta))
        current_tick = tick

    # Save file
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mid.save(str(output_path))
```

---

### 3. Interactive TUI (`main.py`)

Follow patterns from `app/stem_separators/main.py` and `app/converters/audio2wav.py`:

**Features:**
- Rich table showing available songs
- Display which songs have:
  - Main `audio.wav` (can convert to `audio.mid`)
  - `stems/` directory with stem files
  - Existing MIDI files (show status)
- Interactive selection with options:
  1. Convert main audio only
  2. Convert all stems only
  3. Convert both main + stems
  4. Select specific stems
- Progress bars with Rich Progress API
- Summary table showing conversion results

**Key Functions:**
```python
def find_convertible_songs(input_dir: Path) -> List[Path]
def display_song_selection(songs: List[Path], config: Wav2MidiConfig) -> Optional[Path]
def display_conversion_options(song_dir: Path, has_main: bool, has_stems: bool) -> str
def convert_song_to_midi(song_dir: Path, config: Wav2MidiConfig, mode: str) -> dict
```

---

### 4. Configuration (`config.yaml`)

```yaml
# WAV to MIDI Converter Configuration

# Input directory containing song directories
input_dir: downloads

# Output settings
# Options: in_place, outputs, custom
output_mode: in_place
# output_dir: outputs/midi  # Only used if output_mode is 'custom'

# Conversion modes
# Options: disabled, optional, stems_only
stems_mode: optional
convert_main_audio: true

# Essentia Melodia pitch extraction settings
frame_size: 2048
hop_size: 128
sample_rate: 44100
melodia_bin_resolution: 10.0        # cents
melodia_filter_iterations: 3
melodia_min_frequency: 55.0         # Hz (A1)
melodia_max_frequency: 1760.0       # Hz (A6)

# Pitch segmentation settings
pitch_confidence_threshold: 0.0
min_note_duration: 0.1              # seconds

# MIDI output settings
midi_velocity: 80                   # 1-127
midi_tempo_bpm: 120                 # 20-300
midi_program: 0                     # 0=Piano, 24=Guitar, etc.

# Processing options
overwrite: false
skip_existing: true
supported_formats:
  - wav
```

---

### 5. API Service (`app/api/services/midi_service.py`)

```python
class MidiService:
    """Service for WAV to MIDI conversion."""

    async def convert_to_midi(
        self,
        job_id: str,
        input_path: str,
        output_path: Optional[str] = None,
        config_overrides: Optional[dict] = None
    ) -> dict:
        """Convert WAV to MIDI with job tracking."""

    async def batch_convert_stems(
        self,
        job_id: str,
        song_dir: str,
        stem_names: Optional[List[str]] = None
    ) -> dict:
        """Convert multiple stems in a song directory."""
```

Follow `convert_service.py` pattern:
- Job manager state updates
- Progress tracking (0-100%)
- Error handling with detailed messages
- Result dict with file paths and metadata

---

## Tasks Checklist

### Phase 1: Core Module
- [ ] Add `mido>=1.3.2` to `pyproject.toml`
- [ ] Run `uv sync`
- [ ] Create `app/converters/wav2midi/` directory
- [ ] Implement `wav2midi_converter.py` with:
  - [ ] `Wav2MidiConfig` Pydantic model
  - [ ] `load_config()` function
  - [ ] `convert_wav_to_midi()` function
  - [ ] `_write_midi_file()` helper
- [ ] Create `config.yaml` with sensible defaults
- [ ] Implement `__init__.py` with public exports

### Phase 2: Interactive TUI
- [ ] Implement `main.py` with:
  - [ ] `find_convertible_songs()` - scan downloads directory
  - [ ] `display_song_selection()` - Rich table UI
  - [ ] `display_conversion_options()` - main/stems/both
  - [ ] `convert_song_to_midi()` - orchestration with progress
  - [ ] `main()` - entry point
- [ ] Test with sample songs
- [ ] Handle edge cases (no stems, no main audio, etc.)

### Phase 3: API Service
- [ ] Create `app/api/services/midi_service.py`
- [ ] Implement `MidiService` class:
  - [ ] `convert_to_midi()` - single file conversion
  - [ ] `batch_convert_stems()` - multiple stems
- [ ] Add job manager integration
- [ ] Test async operations

### Phase 4: API Routes (Optional)
- [ ] Create route in `app/api/routes/midi_routes.py`
- [ ] Add endpoints:
  - [ ] `POST /api/midi/convert` - single conversion
  - [ ] `POST /api/midi/batch` - batch stems
  - [ ] `GET /api/midi/job/{job_id}` - status check
- [ ] Update route registration

### Phase 5: Testing & Documentation
- [ ] Test with various audio files:
  - [ ] Main audio (complex mix)
  - [ ] Vocal stems (monophonic)
  - [ ] Bass stems
  - [ ] Guitar/Piano stems
- [ ] Verify MIDI output quality
- [ ] Document usage in README
- [ ] Add examples to WORKFLOWS.md

---

## Usage Examples

### Module (Interactive TUI)
```bash
python app/converters/wav2midi/main.py
```

### Direct Python Usage
```python
from app.converters.wav2midi import convert_wav_to_midi, load_config

config = load_config()
success = convert_wav_to_midi(
    wav_path=Path("downloads/Song/audio.wav"),
    output_path=Path("downloads/Song/audio.mid"),
    config=config
)
```

### API (when routes are implemented)
```bash
# Single file conversion
curl -X POST http://localhost:8000/api/midi/convert \
  -H "Content-Type: application/json" \
  -d '{"input_path": "downloads/Song/audio.wav"}'

# Batch convert all stems
curl -X POST http://localhost:8000/api/midi/batch \
  -H "Content-Type: application/json" \
  -d '{"song_dir": "downloads/Song"}'
```

---

## Notes & Considerations

### Essentia Algorithm Details
- **PredominantPitchMelodia**: Designed for monophonic melody extraction
  - Works best on vocal stems, bass, lead instruments
  - May struggle with polyphonic content (chords, complex mixes)
- **PitchContourSegmentation**: Converts continuous pitch to discrete notes
  - Uses silence detection and pitch stability
  - `minDuration` filters out very short artifacts

### MIDI Quality Expectations
- **Vocals/Bass**: Generally excellent (monophonic)
- **Main Mix**: Poor (too polyphonic for Melodia)
- **Guitar/Piano**: Variable (depends on playing style)
- **Drums/Percussion**: Not applicable (no pitch)

### Future Enhancements
- [ ] Add polyphonic MIDI conversion (using different Essentia algorithms)
- [ ] Support for multi-track MIDI (separate tracks per stem)
- [ ] Post-processing: quantization, note merging, velocity dynamics
- [ ] Integration with chord analysis (harmonically-aware conversion)
- [ ] Alternative pitch tracking algorithms (PYIN, CREPE, etc.)

---

## Status Updates

### 2025-11-10 - ✅ Implementation Complete
**Major Changes:**
- Switched from Essentia to Spotify's basic-pitch for better quality
- Migrated from Python 3.12 → Python 3.10 (required for basic-pitch on M1 Mac)
- Added `setuptools>=65.0.0` dependency (fixes `pkg_resources` import error)

**Completed:**
- ✅ Core converter module with basic-pitch integration
- ✅ Interactive TUI with stem selection (all/none/specific)
- ✅ Config system with basic-pitch parameters
- ✅ Python 3.10 migration
- ✅ Dependency resolution (setuptools fix)

**Bug Fix - pkg_resources Missing:**
```
Error: ModuleNotFoundError: No module named 'pkg_resources'
Cause: resampy (basic-pitch dependency) requires pkg_resources from setuptools
      setuptools was conditionally installed only for Python 3.11+ / 3.12+ on macOS
      After downgrading to Python 3.10, setuptools was not installed
Solution: Added "setuptools>=65.0.0" to pyproject.toml dependencies
```

**Not Implemented (Future Work):**
- ⏸️ API service (`app/api/services/midi_service.py`) - deferred
- ⏸️ API routes - deferred
- ⏸️ Batch processing endpoint - deferred

### 2025-11-08 - Initial Planning
- Created execution doc
- Defined architecture and implementation plan (Essentia-based)
- User requested switch to basic-pitch
