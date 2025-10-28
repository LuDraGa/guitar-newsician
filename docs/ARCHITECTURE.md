# Architecture Documentation

## Overview

WereCode follows a modular pipeline architecture for music processing and analysis.

## Core Components

### 1. Downloaders (`downloaders/`)

**YouTube Music Downloader** ([yt_music_downloader/main.py](../downloaders/yt_music_downloader/main.py))

- **Config-driven**: YAML configuration with Pydantic `DLConfig` model
- **Interactive TUI**: Rich-based terminal UI with custom directory picker
- **Error Recovery**: Automatic 403 fallback strategy
  - Initial attempt with default settings
  - Retry with browser cookies + Android player client
- **Progress Tracking**: Real-time yt-dlp progress hooks
- **Features**:
  - Unique terminal directory picker (`.` = select, `..` = up, numeric = enter, `/` or `~` = jump to path)
  - Support for mp3, m4a, opus, flac, wav, aac formats
  - Rate limiting, proxy support, metadata embedding
  - Playlist detection and handling

### 2. Converters (`converters/`)

**Audio2Wav Converter** ([audio2wav.py](../converters/audio2wav.py))

- **Purpose**: Normalize audio to WAV format for analysis
- **Backend**: pydub with ffmpeg
- **Supported Formats**: m4a, mp3, flac, aac, ogg, wav
- **Default Settings**:
  - Sample Rate: 44.1kHz (configurable)
  - Channels: Mono (configurable)
  - Output: `outputs/converted/audio2wav/`
- **Features**:
  - Bulk conversion with `bulk_convert_to_wav()`
  - Skip existing files option
  - Automatic directory creation

### 3. Analyzers (`analyzers/`)

**Analysis Pipeline** ([music_analysis.py](../analyzers/music_analysis.py))

#### Base Architecture

**AnalysisContext** (dataclass):
```python
- wav_path: Path           # Source file
- file_hash: str           # SHA1 for versioning
- sr: int                  # Sample rate
- channels: int            # Channel count
- duration_sec: float      # Duration
```

**Analyzer Base Class**:
- `NAME`: Analyzer identifier
- `VERSION`: For backward compatibility
- `available()`: Dependency check
- `_run(ctx)`: Core analysis logic
- `analyze(ctx)`: Wrapper with timing and error handling

Returns `AnalyzerReport`:
- `name`, `version`, `elapsed_sec`
- `ok`: Success boolean
- `error`: Error message if failed
- `data`: Analysis results dict

#### Available Analyzers

**1. BasicStatsAnalyzer**
- RMS, peak amplitude, zero-crossing rate
- Uses soundfile or pydub
- Fast, minimal dependencies

**2. TempoBeatsAnalyzer**
- Essentia RhythmExtractor2013 (multifeature method)
- Outputs:
  - Global BPM
  - Beat grid (seconds)
  - Downbeats (heuristic: every 4th beat)
  - Tempo map (instantaneous BPM between beats)
- Robust to tempo changes

**3. TonalKeyAnalyzer**
- HPCP-based key estimation
- Essentia Key estimator with Temperley profile
- Outputs:
  - Key (C, C#, D, etc.)
  - Scale (major/minor)
  - Strength (confidence)
  - Mean HPCP vector (36-bin)
- Parameters:
  - Frame size: 4096
  - Hop size: 2048
  - HPCP bins: 36

**4. ChordInferenceAnalyzer**
- HPCP-based chord recognition
- Simple Maj/Min triad templates (24 chords: 12 major + 12 minor)
- Outputs:
  - Frame-level chords with confidence
  - Compressed progression (consecutive identical chords merged)
  - Transposition maps (0-11 semitones)
  - Optional transposition to target key (via `TRANSPOSE_TO_KEY` env var)
- Template matching: cosine similarity between HPCP and chord templates

**5. StructureMSAFAnalyzer**
- MSAF segmentation (sf + fmc2d algorithms)
- Outputs:
  - Raw boundaries and labels
  - Segments with start/end times
  - Mapped segments with semantic labels
- **Heuristic Mapping**:
  - Most total duration → "chorus"
  - Most frequent recurring (non-chorus) → "verse"
  - Unique labels by position:
    - First → "intro"
    - Last → "outro"
    - Middle → "bridge"
  - Others → "section"

#### Analysis Runner

**CLI Runner** ([main.py](../analyzers/main.py))

- Parallel processing with `ThreadPoolExecutor`
- Supports single file or directory (with `--recurse`)
- Skip existing analysis option
- Rich dashboard visualization (`--pretty`)
- Analyzer filtering (`--enable`, `--disable`)

**Output Format**:
```json
{
  "_meta": {
    "source": "path/to/file.wav",
    "file_hash": "sha1...",
    "sr": 44100,
    "channels": 1,
    "duration_sec": 245.3,
    "created_at": "2025-10-28 12:34:56"
  },
  "basic_stats": {
    "ok": true,
    "version": "0.1.0",
    "elapsed_sec": 0.123,
    "error": null,
    "data": { "rms": 0.234, "peak_abs": 0.987, ... }
  },
  "tempo_beats": { ... },
  "tonal_key": { ... },
  "chords": { ... },
  "structure_msaf": { ... }
}
```

## Data Flow

```
YouTube URL
    ↓
[yt_music_downloader] → downloads/ (m4a, mp3, etc.)
    ↓
[audio2wav] → outputs/converted/audio2wav/ (.wav, 44.1kHz, mono)
    ↓
[music_analysis] → outputs/analysis/wav_music/ (.analysis.json)
```

## Design Patterns

### 1. Config-as-Code
- YAML configuration files
- Pydantic models for validation and type safety
- Easy to version control and share

### 2. Analyzer Registry
- `ANALYZERS` list in music_analysis.py
- Add new analyzers by appending to list
- Automatic inclusion in CLI and runner

### 3. Incremental Analysis
- Analysis JSONs are loaded and updated
- Can re-run specific analyzers without losing others
- File hash tracking for change detection

### 4. Error Resilience
- Each analyzer reports success/failure independently
- Failed analyzer doesn't block others
- Errors stored in output JSON for debugging

### 5. Rich Terminal UI
- All user-facing output uses `rich` library
- Progress bars, tables, panels, syntax highlighting
- Consistent visual language across tools

## Extension Points

### Adding New Analyzers

1. Create analyzer class in `analyzers/music_analysis.py`:
```python
class MyAnalyzer(Analyzer):
    NAME = "my_analyzer"
    VERSION = "0.1.0"

    def available(self) -> bool:
        return True  # or check for dependencies

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        # Your analysis logic
        return {"result": "data"}
```

2. Add to `ANALYZERS` list:
```python
ANALYZERS = [
    BasicStatsAnalyzer(),
    TempoBeatsAnalyzer(),
    # ... existing analyzers
    MyAnalyzer(),  # Add here
]
```

3. Analysis automatically available via CLI

### Adding New Converters

Create converter module in `converters/` following audio2wav.py pattern:
- Accept `Path` inputs/outputs
- Provide bulk and single-file functions
- Skip existing files option
- Print progress to stdout

### Adding New Downloaders

Follow yt_music_downloader pattern:
- YAML config with Pydantic model
- Rich TUI for user interaction
- Progress hooks for real-time feedback
- Save to `downloads/` directory

## Dependencies & Compatibility

### Critical Dependencies
- **essentia**: v2.1b6.dev1389+ (for all music analysis)
- **msaf**: v0.1.80+ (requires numpy compatibility patch)
- **yt-dlp**: Latest (YouTube API changes frequently)
- **ffmpeg**: System dependency (via ffmpeg-python, pydub)

### Python Version
- Requires Python 3.12+
- Some dependencies (madmom) not compatible with 3.12 yet

### Known Compatibility Issues
1. **msaf + recent numpy**: Monkey patch `scipy.inf = np.inf` required
2. **madmom**: Disabled in current version (Python 3.12 incompatible)
3. **yt-dlp 403 errors**: Mitigated with browser cookies + Android client fallback
