# Stem Visualization Improvements - Execution Document

**Date:** 2025-12-02
**Status:** In Progress
**Branch:** formalizeUI

## Objective

Fix the stem visualization in the Studio panel to display:
1. Real audio waveforms from stem WAV files
2. Real spectrograms and frequency visualizations
3. Proper overlays for beats, downbeats, chords, and sections from analysis data
4. Improved layout (vertical stacking instead of 2x3 grid)

## Current Issues

### 1. Placeholder Visualizations
- Waveforms are random sine/cosine waves
- Spectrograms are random colored blocks
- Equalizers are random height bars
- None use actual audio data

### 2. Placeholder Overlays
- Beat overlays are simple gradient bars
- Chord overlays are simple gradient bars
- Section overlays are simple gradient bars
- None use actual analysis data

### 3. Layout Problems
- 2x3 grid doesn't make sense for left-to-right playback
- Stems should be stacked vertically to align with playhead

## Data Available

### Analysis Data Structure (from `AnalysisData` in api.ts)
```typescript
{
  tempo?: {
    bpm: number
    confidence: number
    beats: number[]          // Beat timestamps in seconds
    downbeats: number[]      // Downbeat timestamps in seconds
  }
  key?: {
    key: string
    scale: string
    strength: number
  }
  chords?: Array<{
    timestamp: number         // Start time in seconds
    chord: string            // e.g., "C:maj", "Am:min"
    duration: number         // Duration in seconds
  }>
  sections?: Array<{
    label: string            // e.g., "verse", "chorus", "bridge"
    start: number           // Start time in seconds
    end: number             // End time in seconds
  }>
}
```

### Audio Data
- Stem URLs available via `libraryApi.getStemUrl(songId, stemType)`
- Full mix URL via `libraryApi.getAudioUrl(songId)`
- StudioPanel already loads audio via `useSimpleAudioPlayback` hook

## Implementation Plan

### Task 1: Fetch and Pass Analysis Data
- Fetch analysis data in StudioPanel
- Pass to StemVisualizer as prop
- Handle missing analysis gracefully

### Task 2: Create Waveform Extractor Utility
- Use Web Audio API to decode audio buffers
- Extract waveform peaks for visualization
- Cache results to avoid re-processing
- Support downsampling for performance

### Task 3: Implement Real Waveform Visualization
- Replace placeholder sine waves
- Render actual audio amplitude data
- Use canvas for performance
- Show stereo channels or mono

### Task 4: Implement Spectrogram Visualization
- Use Web Audio API AnalyserNode
- Create frequency-time heatmap
- Real-time or pre-rendered approach
- Color gradient for amplitude

### Task 5: Implement Equalizer Visualization
- Use Web Audio API AnalyserNode
- Frequency band analysis (8-12 bands)
- Real-time bar chart visualization
- Smooth animations

### Task 6: Implement Beat/Downbeat Overlays
- Render vertical lines at beat timestamps
- Different styling for downbeats
- Position based on duration
- Sync with playhead

### Task 7: Implement Chord Overlays
- Render chord regions as colored blocks
- Show chord name in region
- Position/width based on timestamp/duration
- Color code by chord type or root

### Task 8: Implement Section Overlays
- Render section regions with labels
- Different colors for verse/chorus/bridge/etc
- Position based on section start/end
- Clickable to seek

### Task 9: Fix Layout
- Change from 2x3 grid to vertical stack
- Each stem gets full width
- Height adjustable or fixed
- Playhead moves horizontally across all stems
- Overlays span all stems or per-stem

## Technical Approach

### Option A: Canvas-based Rendering
**Pros:**
- High performance for complex visualizations
- Full control over rendering
- Good for real-time updates

**Cons:**
- More code complexity
- Not as declarative
- Accessibility concerns

### Option B: SVG-based Rendering
**Pros:**
- Declarative and easier to reason about
- Good for static/semi-static visualizations
- Accessible and inspectable

**Cons:**
- Performance concerns with many elements
- May need optimization for real-time

### Hybrid Approach (Recommended)
- **Canvas for waveforms/spectrograms**: High-performance real-time viz
- **SVG for overlays**: Easy to position and style beat/chord/section markers
- **React components**: Wrap canvas/SVG for lifecycle management

## File Changes

### New Files
- `frontend/src/utils/audioAnalysis.ts` - Web Audio API utilities
- `frontend/src/utils/waveformExtractor.ts` - Waveform data extraction
- `frontend/src/components/studio/visualizers/WaveformCanvas.tsx` - Canvas waveform
- `frontend/src/components/studio/visualizers/SpectrogramCanvas.tsx` - Canvas spectrogram
- `frontend/src/components/studio/visualizers/EqualizerCanvas.tsx` - Canvas equalizer
- `frontend/src/components/studio/visualizers/AnalysisOverlays.tsx` - SVG overlays

### Modified Files
- `frontend/src/components/studio/StemVisualizer.tsx` - Main component refactor
- `frontend/src/components/studio/types.ts` - Add analysis data types
- `frontend/src/components/panels/StudioPanel.tsx` - Fetch and pass analysis data

## Progress Tracking

- [x] Create execution document
- [x] Fetch analysis data in StudioPanel
- [x] Create waveform extractor utility
- [x] Implement real waveform rendering
- [x] Fix layout to vertical stacking
- [x] Implement beat/downbeat overlays
- [x] Implement chord overlays
- [x] Implement section overlays
- [x] Implement spectrogram visualization
- [x] Implement equalizer visualization
- [x] Optimize performance with caching and downsampling
- [x] Test with missing analysis data (handled gracefully)
- [ ] User testing with multiple songs/stems

## Implementation Summary

### What Was Built

1. **Real Waveform Rendering**
   - Created `WaveformCanvas` component using HTML5 Canvas
   - Uses Web Audio API to decode and extract waveform data
   - Displays min/max amplitude pairs for detailed visualization
   - Color-coded per stem type
   - Caching support to avoid re-processing

2. **Analysis Overlays**
   - Created `AnalysisOverlays` component using SVG
   - **Beats**: Vertical lines at beat timestamps, thicker for downbeats
   - **Chords**: Colored regions with chord labels, color-coded by major/minor
   - **Sections**: Bottom-aligned labeled regions (verse, chorus, bridge, etc.)
   - All overlays positioned using percentage-based layout

3. **Vertical Layout**
   - Changed from 2x3 grid to vertical stacking
   - Each stem gets full width with fixed height (120px)
   - Playhead and loop markers span all stems vertically
   - Analysis overlays span all stems
   - Better alignment with left-to-right playback

4. **Data Integration**
   - StudioPanel fetches analysis data from backend
   - Passes to StemVisualizer along with songId
   - StemVisualizer fetches stem URLs dynamically
   - Graceful handling of missing data

### Technical Decisions

- **Canvas for waveforms**: Better performance than SVG for dense data
- **SVG for overlays**: Easier to position and style, good for sparse annotations
- **Hybrid approach**: Combines strengths of both rendering methods
- **Responsive sizing**: Measures container width and re-renders on resize
- **Caching**: Waveform data cached to avoid re-processing on remounts

### Additional Visualizations Implemented

5. **Spectrogram Visualization**
   - Created `SpectrogramCanvas` component using Canvas
   - Implemented DFT (Discrete Fourier Transform) for frequency analysis
   - Displays frequency content over time as a heatmap
   - Color-coded per stem type with alpha based on magnitude
   - Log-scale normalization for better perceptual representation
   - Low frequencies at bottom (more musical)
   - Cached for performance

6. **Equalizer Visualization** (REMOVED)
   - Initially implemented but removed per user feedback
   - Did not look good and sync was problematic
   - Not required for core functionality

## Final Implementation Notes

- ✅ Two visualizers implemented: Waveform and Spectrogram
- ✅ Handles missing analysis data gracefully
- ✅ All visualizations use caching for instant reload
- ✅ Playhead sync works with vertical layout
- ✅ Overlays working with proper data structure mapping
- ✅ Performance optimized with downsampling and simplified FFT
- 💡 Future: Consider adding zoom/pan controls for waveform view
- 💡 Future: Could upgrade to WebGL for even better spectrogram performance

### Performance Optimizations

- **Waveform**: Downsampled to 1/3 resolution (300-400 samples)
- **Spectrogram**: Simplified DFT with binning for faster computation
- **Equalizer**: Uses cached spectrogram data, no real-time FFT needed
- **All visualizations**: Cached results, instant on revisit
- **Loading indicators**: Colored spinners with status text

## Success Criteria

1. ✅ Waveforms show actual audio amplitude data
2. ✅ Spectrograms show frequency content over time
3. ✅ Beat markers appear at correct timestamps
4. ✅ Chord regions display with correct timing and labels
6. ✅ Section markers show song structure
7. ✅ Layout stacks stems vertically
8. ✅ Playhead moves horizontally across visualization
9. ✅ Performance is acceptable (no lag/jank)
10. ✅ Graceful degradation when data is missing
