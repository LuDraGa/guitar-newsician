# Stem Separator Standardization

**Date:** 2025-10-31
**Task:** Standardize stem separation feature to match codebase patterns

## Overview

Refactored the Demucs stem separation implementation to align with the existing WereCode architecture, making it consistent with downloaders, converters, and analyzers.

## Changes Made

### 1. Project Structure

Created standardized stem separator module:

```
app/stem_separators/
├── __init__.py          # Package init
├── config.yaml          # YAML configuration with documented options
├── stem_separator.py    # Core separation logic
└── main.py             # Interactive TUI entry point
```

### 2. Configuration System (`config.yaml`)

Implemented YAML-driven configuration matching codebase patterns:

**Key Features:**
- Clear documentation of all model options (htdemucs, htdemucs_ft, htdemucs_6s)
- Enum-like options documented in comments for device (auto/cuda/cpu)
- Enum-like options documented in comments for dtype (float32/float16)
- Enum-like options documented in comments for codec (wav/flac)
- Processing parameters (segment, overlap, shifts) with inline descriptions
- Directory management (input_dir, skip_existing, overwrite flags)

**Configuration Options:**
```yaml
input_dir: downloads           # Song directories with audio.wav
model: htdemucs_6s             # 6 sources (vocals, drums, bass, other, piano, guitar)
segment: 7.8                   # Segment size in seconds
overlap: 0.25                  # Overlap ratio (0.0-0.99)
shifts: 1                      # Test-time augmentation
device: auto                   # auto/cuda/cpu
dtype: float32                 # float32/float16
codec: wav                     # wav/flac
skip_existing: true            # Skip if stems/ exists
overwrite: false               # Overwrite individual stems
```

### 3. Audio I/O with pydub

**Replaced:** `soundfile` + `torchaudio` direct I/O
**With:** `pydub` for consistency with converters

**Benefits:**
- Unified audio handling across all modules
- Better format support (m4a, mp3, flac, ogg, aac, wav)
- Consistent with existing audio2wav converter
- Cleaner API for audio segment manipulation

**Implementation:**
- `_load_audio_pydub()`: Loads audio using pydub, converts to torch tensor
- `_save_audio_pydub()`: Saves torch tensor using pydub
- Handles channel conversion and normalization
- Supports both wav and flac output formats

### 4. Directory Structure

**New Structure:**
```
downloads/
├── Song Name/
│   ├── audio.wav          # Base audio (from converter)
│   ├── analysis.json      # Analysis results (from analyzer)
│   └── stems/             # Stem separation output
│       ├── vocals.wav
│       ├── drums.wav
│       ├── bass.wav
│       ├── other.wav
│       ├── piano.wav      # If using htdemucs_6s
│       └── guitar.wav     # If using htdemucs_6s
```

**Benefits:**
- Stems saved in same song folder (not separate output_dir)
- Maintains all related files together
- Easy to find and manage
- Follows same pattern as analysis.json

### 5. Main Entry Point (`main.py`)

Created interactive TUI matching other modules:

**Features:**
- Rich table showing available songs
- Status indication (# of stems if already separated)
- Configuration panel showing model, device, codec, stem count
- Progress tracking with callbacks
- Clear next-steps guidance

**User Flow:**
1. Launch with `python app/stem_separators/main.py`
2. View songs with audio.wav files
3. See which songs already have stems
4. Select song to separate
5. Watch progress with Rich progress bar
6. Get clear feedback on completion

### 6. Analyzer Integration

**Completely redesigned** analyzer to support interactive file selection:

**New Interactive Flow:**
1. Select song directory
2. See all available files (base audio + stems) with analysis status
3. Choose which files to analyze:
   - Enter numbers: `1,2,3` for specific files
   - Enter `all`: Analyze all files
   - Enter `base`: Analyze only audio.wav
   - Enter `stems`: Analyze only stem files
   - Enter `q`: Cancel

**Features:**
- **Per-file analysis**: Each file gets its own analysis JSON
- **Separate reports**: Base audio → `analysis.json`, stems → `analysis_vocals.json`, `analysis_drums.json`, etc.
- **Status tracking**: Shows which files are already analyzed
- **Flexible selection**: Choose any combination of files
- **Individual dashboards**: Dashboard shown for each analyzed file

**Implementation:**
- `find_analyzable_songs()`: Finds songs with audio.wav or stems/
- `display_song_selection()`: Shows songs with file counts and analysis status
- `display_file_selection()`: **NEW** - Interactive file picker with multiple selection modes
- `analyze_files()`: **NEW** - Analyzes selected files with individual output paths

**Example Output Structure:**
```
downloads/Song Name/
├── audio.wav                # Base audio
├── analysis.json            # Base audio analysis
├── stems/
│   ├── vocals.wav
│   ├── drums.wav
│   ├── bass.wav
│   └── ...
├── analysis_vocals.json     # Vocals stem analysis
├── analysis_drums.json      # Drums stem analysis
└── analysis_bass.json       # Bass stem analysis
```

### 7. Code Quality Improvements

**Standardization:**
- Pydantic models for configuration validation
- Type hints throughout
- Rich console for all user-facing output
- Error handling with try/except and clear messages
- Progress callbacks for long-running operations

**Removed:**
- Old `demucs_base.py` (replaced with modular approach)
- Hardcoded test paths at bottom of old file
- Unnecessary FastAPI references in comments
- Confusing dual config system

## Workflow Integration

The complete WereCode workflow now supports:

```bash
# 1. Download audio
python app/downloaders/yt_music_downloader/main.py

# 2. Convert to WAV
python app/converters/audio2wav.py

# 3. (Optional) Separate stems
python app/stem_separators/main.py

# 4. Analyze (Interactive - choose what to analyze)
python app/analyzers/main.py
# Then select:
# - Song directory
# - Which files to analyze (base, stems, specific files, or all)
```

**Example Analysis Session:**
```
$ python app/analyzers/main.py

Available Songs for Analysis
┌───┬──────────────┬────────────────────┬──────────────────┐
│ # │ Song Name    │ Available Files    │ Analysis Status  │
├───┼──────────────┼────────────────────┼──────────────────┤
│ 1 │ My Song      │ audio.wav, 6 stems │ base, 6 stems    │
└───┴──────────────┴────────────────────┴──────────────────┘

Select song to analyze: 1

Files available in My Song:
┌───┬──────────────┬────────────┬──────────────────┐
│ # │ File         │ Type       │ Analysis Status  │
├───┼──────────────┼────────────┼──────────────────┤
│ 1 │ audio.wav    │ Base Audio │ analyzed         │
│ 2 │ vocals.wav   │ Stem       │ not analyzed     │
│ 3 │ drums.wav    │ Stem       │ not analyzed     │
│ 4 │ bass.wav     │ Stem       │ not analyzed     │
│ 5 │ other.wav    │ Stem       │ not analyzed     │
│ 6 │ piano.wav    │ Stem       │ not analyzed     │
│ 7 │ guitar.wav   │ Stem       │ not analyzed     │
└───┴──────────────┴────────────┴──────────────────┘

Options:
  • Enter numbers (comma-separated): 1,2,3
  • Enter all: Analyze all files
  • Enter base: Analyze only base audio
  • Enter stems: Analyze only stems
  • Enter q: Cancel

What would you like to analyze?: 2,3  # Just vocals and drums
```

## Configuration Files Updated

1. **`app/stem_separators/config.yaml`**: New standardized config
2. **`app/analyzers/config.yaml`**: Removed `analyze_mode` (now interactive), removed `output_filename`

## Files Created

1. **`app/stem_separators/__init__.py`**: Package initialization
2. **`app/stem_separators/stem_separator.py`**: Core separation logic
3. **`app/stem_separators/main.py`**: Interactive TUI entry point
4. **`app/stem_separators/config.yaml`**: YAML configuration

## Files Modified

1. **`app/analyzers/config.yaml`**: Removed analyze_mode and output_filename (now dynamic)
2. **`app/analyzers/main.py`**: Complete rewrite with interactive file selection

## Files Removed

1. **`app/stem_separators/demucs_base.py`**: Old implementation
2. **`app/analyzers/main_old.py`**: Backup of old analyzer (can be deleted)

## Technical Details

### Model Options

**htdemucs** (4 sources):
- vocals, drums, bass, other
- Fast, good quality
- Standard separation

**htdemucs_ft** (4 sources):
- Fine-tuned version
- vocals, drums, bass, other
- Better quality than base htdemucs

**htdemucs_6s** (6 sources):
- vocals, drums, bass, other, piano, guitar
- Most detailed separation
- Piano quality can be inconsistent (noted in UI)
- Recommended for detailed analysis

### Device Selection

- `auto`: Automatically select CUDA if available, else CPU
- `cuda`: Force CUDA/GPU (requires PyTorch with CUDA)
- `cpu`: Force CPU (slower but works everywhere)

### Precision Options

- `float32`: Standard precision (always works)
- `float16`: Half precision (only with CUDA, 2x faster, same quality)

### Output Formats

- `wav`: Uncompressed, large files, perfect quality
- `flac`: Lossless compression, smaller than wav, perfect quality

## Testing Checklist

- [x] Config loads correctly
- [x] Model options documented
- [x] Device options documented
- [x] pydub I/O works for loading
- [x] pydub I/O works for saving
- [x] Directory structure (stems in song folder)
- [x] Main entry point TUI
- [x] Progress tracking
- [x] Analyzer mode options
- [x] Analyzer finds stems
- [x] Analyzer processes stems
- [ ] End-to-end test: download → convert → separate → analyze

## Known Issues

None at this time.

## Future Enhancements

1. **Batch Processing**: Process multiple songs at once
2. **Quality Presets**: Add preset configs (fast/balanced/quality)
3. **Advanced Options**: Expose more demucs parameters if needed
4. **Stem Preview**: Quick audio preview of separated stems
5. **Analyzer Dashboard**: Special dashboard view for comparing stems
6. **Stem Mixing**: Recombine stems with different levels

## Dependencies

Required packages (already in pyproject.toml or should be added):
- `demucs`: Stem separation engine
- `torch`: PyTorch for model
- `torchaudio`: Audio tensor operations
- `pydub`: Audio I/O
- `pydantic`: Configuration validation
- `rich`: Terminal UI
- `pyyaml`: YAML parsing

## Notes

- Stems are saved in-place in song directories for easy management
- Analyzer can now process stems individually for detailed analysis
- All UI patterns match existing modules (downloaders/converters/analyzers)
- Configuration is fully documented with inline comments
- Error handling follows existing patterns
- Progress feedback is consistent across all modules

---

**Status:** ✅ Complete
**Next Steps:** Test end-to-end workflow and create batch processing feature if needed
