# Music Transcription Alternatives to Omnizart

**Date**: 2025-11-10
**Status**: Research Complete
**Goal**: Find modern, maintained alternatives to Omnizart for music transcription

---

## Executive Summary

**Omnizart** is unmaintained (last release 2020) and has complex dependency issues on M1 Mac:
- Requires PyYAML < 6.0
- Depends on `madmom` (requires Cython in build env)
- Depends on `vamp` (requires numpy in build env)
- Depends on `llvmlite` via `numba` (requires system LLVM installation)

**Recommendation**: Skip omnizart. You already have **basic-pitch** working perfectly. Optionally add complementary tools below.

---

## Top Alternatives (2024-2025)

### 1. ✅ **Basic-Pitch** (Spotify) - ALREADY INSTALLED

**Status**: ✅ Active (2024-2025 releases, maintained by Spotify)
**Installation**: `pip install basic-pitch` (DONE)
**Python**: 3.7-3.11 (works on 3.10 ✓)
**M1 Mac**: ✅ Supported

**Features**:
- 🎵 Neural network-based transcription (lightweight, fast)
- 🎹 Polyphonic support (handles chords, multiple notes)
- 🎸 Instrument-agnostic (works on any audio)
- 📊 Pitch bend detection
- 🗂️ Multiple formats: WAV, MP3, FLAC, OGG, M4A

**Pros**:
- ALREADY WORKING in your project
- Easy pip install, no complex dependencies
- Actively maintained by Spotify
- Best balance of quality vs ease of use

**Cons**:
- Works best on one instrument at a time
- Not specialized for specific instruments

**Use Cases**:
- General-purpose audio → MIDI conversion
- Vocals, bass, guitar, piano stems
- Quick transcription without complex setup

---

### 2. 🎹 **Piano-Transcription-Inference** (ByteDance)

**Status**: ✅ Very Active (v0.0.6 released Jan 26, 2025)
**Installation**: `pip install piano_transcription_inference`
**Python**: 3.7+ (tested on 3.10)
**M1 Mac**: ✅ Tested on macOS 12.1 M1

**Features**:
- 🎹 Specialized for piano transcription
- 🎼 High-quality piano → MIDI conversion
- ⚡ Fast inference with PyTorch

**Pros**:
- State-of-the-art piano transcription quality
- Recently updated (Jan 2025)
- Simple pip install
- M1 Mac confirmed working

**Cons**:
- Piano-only (not instrument-agnostic)
- Requires PyTorch + ffmpeg

**Use Cases**:
- **Piano stems** from Demucs separation
- Classical music transcription
- Piano practice/learning tools

**Installation**:
```bash
pip install piano_transcription_inference
# Requires: PyTorch (from pytorch.org) + ffmpeg
```

---

### 3. 🎼 **MT3** (Google Magenta)

**Status**: ✅ Active (Copyright 2024, research-grade)
**Installation**: Colab notebook (no pip package)
**Python**: 3.8+
**M1 Mac**: ⚠️ TensorFlow dependency (may need workarounds)

**Features**:
- 🎵 Multi-instrument transcription
- 🧠 Transformer-based (T5X framework)
- 🎯 State-of-the-art accuracy

**Pros**:
- Cutting-edge research model
- Handles multiple instruments simultaneously
- Best transcription accuracy in benchmarks

**Cons**:
- ❌ No pip package (Colab notebook only)
- ❌ Complex TensorFlow setup
- ❌ Resource-intensive (requires GPU)
- ❌ Not suitable for production integration

**Use Cases**:
- Research projects
- High-quality batch transcription (offline)
- Multi-instrument dense mixes

**Note**: **Not recommended** for your use case (CLI tool integration). Use basic-pitch or piano-transcription-inference instead.

---

### 4. 📊 **CREPE** (Pitch Tracking)

**Status**: ✅ Active (Released Aug 19, 2024)
**Installation**: `pip install crepe`
**Python**: 3.x
**M1 Mac**: ✅ Compatible

**Features**:
- 🎯 SOTA pitch tracking (not full transcription)
- 🎵 Monophonic pitch detection
- ⚡ Fast and accurate

**Pros**:
- Best-in-class pitch tracking
- Recently maintained (2024)
- Easy installation
- Works well with librosa/essentia

**Cons**:
- Only pitch tracking (no note segmentation/MIDI export)
- Monophonic (one note at a time)

**Use Cases**:
- Pitch analysis for vocals/bass
- Feature extraction for ML models
- Complement to basic-pitch for advanced pipelines

---

### 5. 🎼 **music21** (Analysis Framework)

**Status**: ✅ Very Active (v9.7, Python 3.11-3.13 support)
**Installation**: `pip install music21`
**Python**: 3.11+ (3.10 should work)
**M1 Mac**: ✅ Compatible

**Features**:
- 📝 Post-processing MIDI files
- 🎵 Music theory analysis (chords, keys, scales)
- 🎹 Notation rendering (MusicXML, Lilypond)
- 🗂️ Format conversion (MIDI ↔ MusicXML ↔ ABC)

**Pros**:
- Actively maintained (MIT)
- Comprehensive musicology toolkit
- Perfect complement to basic-pitch
- Powerful music analysis capabilities

**Cons**:
- Not a transcription tool (analysis/manipulation only)
- Requires existing MIDI/MusicXML input

**Use Cases**:
- **Post-process MIDI** from basic-pitch/piano-transcription
- Add chord symbols, key signatures
- Transpose, analyze harmony
- Export to sheet music

**Integration Example**:
```python
# 1. Transcribe with basic-pitch
from basic_pitch.inference import predict
model_output, midi_data, note_events = predict('audio.wav')
midi_data.write('output.mid')

# 2. Analyze with music21
import music21
score = music21.converter.parse('output.mid')
key = score.analyze('key')
chords = score.chordify()
score.show()  # Display as sheet music
```

---

## Not Recommended

### ❌ **amt-tools** (Research Framework)
- **Status**: Work-in-progress research code
- **Installation**: Git clone + manual setup
- **Reason**: Not a user-facing library, requires significant ML expertise

### ❌ **aubio**
- **Status**: Unmaintained (last release 2019)
- **Reason**: Outdated, better alternatives available (CREPE)

### ❌ **Omnizart**
- **Status**: Unmaintained (last release 2020)
- **Installation**: ❌ Broken on M1 Mac Python 3.10
- **Reason**: Complex dependencies, build failures, no maintenance

---

## Recommended Setup for WereCode

### Current (Already Working)
```toml
[dependencies]
basic-pitch = ">=0.3.0"  # ✅ Installed, working
```

### Optional Additions

**Option A: Piano Specialist**
```toml
piano-transcription-inference = ">=0.0.6"  # For piano stems
```

**Option B: Music Analysis**
```toml
music21 = ">=9.7"  # Post-process MIDI, add theory analysis
```

**Option C: Advanced Pitch Tracking**
```toml
crepe = ">=0.0.16"  # Complement basic-pitch for vocals/bass
```

---

## Feature Comparison Matrix

| Feature | basic-pitch | piano-trans | MT3 | music21 | CREPE |
|---------|-------------|-------------|-----|---------|-------|
| **Install Ease** | ✅ Excellent | ✅ Good | ❌ Complex | ✅ Excellent | ✅ Excellent |
| **M1 Mac** | ✅ Yes | ✅ Yes | ⚠️ Maybe | ✅ Yes | ✅ Yes |
| **Maintenance** | ✅ Active | ✅ Active | ✅ Research | ✅ Active | ✅ Active |
| **Polyphonic** | ✅ Yes | ✅ Yes | ✅ Yes | N/A | ❌ No |
| **Multi-Instrument** | ✅ Yes | ❌ Piano only | ✅ Yes | N/A | ❌ Mono |
| **Audio → MIDI** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Music Analysis** | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **Production Ready** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |

---

## Use Case Recommendations

### Your Project: Stem → MIDI Conversion
**Best Choice**: **basic-pitch** (already installed)
- Works on all stem types
- No additional dependencies needed
- Proven to work in your environment

### If You Need Piano Specialist
**Add**: **piano-transcription-inference**
```bash
uv add piano-transcription-inference
```
- Use for piano stems from Demucs
- Better piano quality than basic-pitch

### If You Want Music Theory Analysis
**Add**: **music21**
```bash
uv add music21
```
- Post-process MIDI from basic-pitch
- Add chord symbols, key detection
- Export to sheet music formats

---

## Implementation Plan

### Phase 1: Keep Current Setup ✅
- basic-pitch is working perfectly
- No changes needed
- Focus on building features

### Phase 2: Optional Enhancements
**If needed later:**

1. **Piano specialization**:
   ```bash
   uv add piano-transcription-inference
   ```
   - Add piano-specific converter module
   - Use for `stems/piano.wav` only

2. **Music analysis**:
   ```bash
   uv add music21
   ```
   - Post-process MIDI files
   - Add chord/key analysis features

3. **Advanced pitch tracking**:
   ```bash
   uv add crepe
   ```
   - Complement basic-pitch for vocals
   - Extract pitch features for ML

---

## Conclusion

### TL;DR

1. ✅ **Keep basic-pitch** - It's working, maintained, and sufficient
2. ❌ **Skip omnizart** - Unmaintained, broken on M1 Mac
3. 🎹 **Consider piano-transcription** - If piano quality is critical
4. 📊 **Consider music21** - For music theory analysis features
5. 🎯 **Consider CREPE** - For advanced pitch tracking needs

### Next Steps

**Immediate**: Remove omnizart from dependencies, revert PyYAML version
```bash
# In pyproject.toml
pyyaml = ">=6.0.3"  # Revert to latest
# Remove: omnizart, cython, numpy version pins
uv sync
```

**Future**: Add piano-transcription or music21 when features are needed

---

## Status: ✅ Research Complete

- Omnizart incompatibility documented
- Modern alternatives identified and evaluated
- Recommendation: Stick with basic-pitch
- Optional enhancements available when needed
