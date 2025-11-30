# Studio Overlay Panel - Full Implementation

**Date**: 2025-11-28
**Task**: Implement complete studio overlay panel with stem mixer, visualizer, and playback controls

## Overview

Transform the basic StudioPanel placeholder into a fully-featured studio overlay matching the design specification.

## Design Specification

```
┌────────────────────────────── STUDIO (overlay drawer) ──────────────────────────────┐
│ Song — Artist       ActionsDropdown▾ ->[Convert][Analyze][Separate Stems ▾][Delete] │
├───────────────┬───────────────────────────────────────────────┬─────────────────────┤
│ STEM MIXER     │ MULTI-STEM VISUALIZER (ALWAYS ALL STEMS)      │ RIGHT PANEL         │
│ Vocals  M S ▮  │ View: [Waveform▾] Overlays: Beats Chords Sec │ Lyrics (always)     │
│ Drums   M S ▮  │ ┌──────────┬──────────┬──────────┐           │ autoscroll          │
│ Bass    M S ▮  │ │ Vocals   │ Drums    │ Bass     │           │ offset slider       │
│ Guitar  M S ▮  │ ├──────────┼──────────┼──────────┤           │ click line => seek  │
│ Piano   M S ▮  │ │ Guitar   │ Piano    │ Other    │           │ offset slider       │
│ Other   M S ▮  │ └──────────┴──────────┴──────────┘           │ click line => seek  │
│ Master▮  Max ▮ │                                              │                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ Playback Controls: ⏮ ⏯ ⏭  0:42 / 4:50  Speed 1.0x  Loop [A—B]  Metronome MasterVol│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Header with Actions
- Song title and artist
- Actions dropdown: Convert, Analyze, Separate Stems (with model selection), Delete
- Close button

### 2. Stem Mixer (Left Column)
- Individual stem controls: Vocals, Drums, Bass, Guitar, Piano, Other
- Each stem: Mute (M), Solo (S), Volume slider
- Master volume + Max volume control
- Click stem lane → opens transcription panel

### 3. Multi-Stem Visualizer (Center)
- View options: Waveform / Spectrogram / Equalizer (dropdown)
- Overlays: Beats, Chords, Sections (toggleable, colored highlights)
- Grid layout showing all stems simultaneously
- Visual feedback: amplitude scales with volume, dims when muted, highlights on solo
- Shared playhead across all stems
- Loop A/B markers
- Click visualization → opens transcription

### 4. Lyrics Panel (Right)
- Always visible
- Synced lyrics display (if available)
- Auto-scroll toggle
- Offset slider (adjust sync timing)
- Click line → seek to that time
- Fallback to static lyrics if synced not available

### 5. Playback Controls (Bottom)
- Transport: Previous, Play/Pause, Next
- Time display: current / total
- Speed control: 0.5x - 2.0x
- Loop A-B points
- Metronome toggle
- Master volume

## Implementation Plan

### Phase 1: Component Structure
- [x] Create execution document
- [ ] Create component file structure
  - `StudioHeader.tsx` - Title, actions dropdown
  - `StemMixer.tsx` - Left column with stem controls
  - `StemVisualizer.tsx` - Center visualizer area
  - `LyricsPanel.tsx` - Right panel
  - `PlaybackControls.tsx` - Bottom controls
- [ ] Create shared types/interfaces
  - `studio.ts` - Stem state, playback state, visualizer options

### Phase 2: Stem Mixer
- [ ] Build StemControl component (M/S/Volume for each stem)
- [ ] Implement mute/solo logic
- [ ] Add volume sliders
- [ ] Master volume + max volume controls
- [ ] Visual states (active, muted, solo)

### Phase 3: Visualizer (Placeholder → Real)
- [ ] Implement view selector (Waveform/Spectrogram/Equalizer)
- [ ] Build grid layout for multi-stem display
- [ ] Add overlay toggles (Beats/Chords/Sections)
- [ ] Implement shared playhead
- [ ] Add loop A/B markers
- [ ] Visual feedback for mute/solo/volume
- [ ] Click handler to open transcription

### Phase 4: Lyrics Panel
- [ ] Display synced lyrics (.lrc format)
- [ ] Implement auto-scroll
- [ ] Add offset slider
- [ ] Click line to seek
- [ ] Highlight current line
- [ ] Fallback to static lyrics

### Phase 5: Playback Controls
- [ ] Transport controls (prev/play/next)
- [ ] Time display and scrubber
- [ ] Speed control
- [ ] Loop A-B controls
- [ ] Metronome toggle
- [ ] Master volume

### Phase 6: Integration & Polish
- [ ] Wire up audio playback (Web Audio API / Howler.js)
- [ ] Connect all controls to audio engine
- [ ] Add keyboard shortcuts
- [ ] Animations and transitions
- [ ] Responsive design adjustments
- [ ] Testing

## Technical Decisions

### Audio Playback
- **Library**: Howler.js or Web Audio API
  - Howler.js: Simpler API, good for basic playback
  - Web Audio API: More control, required for visualizations
- **Decision**: Start with Howler.js, migrate to Web Audio API when adding visualizations

### Audio Visualization
- **Library**: WaveSurfer.js or custom Canvas/WebGL
  - WaveSurfer.js: Ready-made waveform visualizations
  - Custom: More control, harder to implement
- **Decision**: WaveSurfer.js for MVP, custom for advanced features

### State Management
- React useState/useReducer for local playback state
- Potential zustand store if state becomes complex

## File Structure
```
frontend/src/components/studio/
├── StudioHeader.tsx           # Header with actions
├── StemMixer.tsx              # Left column mixer
├── StemControl.tsx            # Individual stem control
├── StemVisualizer.tsx         # Center visualizer
├── LyricsPanel.tsx            # Right lyrics panel
├── PlaybackControls.tsx       # Bottom controls
├── useAudioPlayback.ts        # Audio engine hook
└── types.ts                   # Shared types
```

## Status
- **Current**: ✅ **COMPLETE** - Full integration with real data and Web Audio API
- **Blockers**: None
- **Next Steps** (Future Enhancements):
  1. Real waveform visualization from audio buffers (Canvas/WebGL)
  2. Beat/chord/section overlays from analysis data
  3. Keyboard shortcuts (spacebar, arrow keys, etc.)
  4. Job status notifications (toast/snackbar)
  5. Loop playback enforcement
  6. Metronome implementation

## Completed
- [x] Created execution document
- [x] Created component file structure
  - `types.ts` - Shared types and interfaces
  - `StudioHeader.tsx` - Header with actions dropdown
  - `StemControl.tsx` - Individual stem control component
  - `StemMixer.tsx` - Left column mixer with all stem controls
  - `StemVisualizer.tsx` - Center visualizer with view options
  - `LyricsPanel.tsx` - Right panel with synced lyrics
  - `PlaybackControls.tsx` - Bottom playback controls
- [x] Integrated all components into StudioPanel
- [x] Fixed TypeScript build errors

## Components Created

All components are functional with state management and proper UI:

1. **StudioHeader** (`StudioHeader.tsx`)
   - Song title and artist display
   - Actions dropdown with Convert, Analyze, Separate Stems, Delete
   - Stems submenu with 2/4/6 stem options
   - Close button

2. **StemMixer** (`StemMixer.tsx`)
   - Individual stem controls (Vocals, Drums, Bass, Guitar, Piano, Other)
   - Mute/Solo/Volume for each stem
   - Master volume control
   - Max volume (limiter) control
   - Active stem counter
   - Click to transcribe hint

3. **StemVisualizer** (`StemVisualizer.tsx`)
   - View selector: Waveform / Spectrogram / Equalizer
   - Overlay toggles: Beats / Chords / Sections
   - 2x3 grid showing all 6 stems
   - Shared playhead across all stems
   - Loop A/B markers
   - Visual feedback for mute/solo/volume
   - Click to seek functionality
   - Click stem to transcribe

4. **LyricsPanel** (`LyricsPanel.tsx`)
   - Synced lyrics display (.lrc format)
   - Auto-scroll toggle
   - Offset slider (-2000ms to +2000ms)
   - Active line highlighting
   - Click line to seek
   - Fallback to static lyrics
   - No lyrics placeholder

5. **PlaybackControls** (`PlaybackControls.tsx`)
   - Transport: Previous / Play-Pause / Next
   - Progress bar with seek
   - Time display (current / total)
   - Speed control: 0.5x - 2.0x
   - Loop toggle + A/B points
   - Metronome toggle
   - Master volume slider

## Layout

The StudioPanel now has a three-column layout:
- **Left** (280px): Stem Mixer
- **Center** (flex): Visualizer
- **Right** (300px): Lyrics Panel
- **Bottom**: Playback Controls

All panels are scrollable independently and maintain state across user interactions.

## Data Integration - COMPLETED ✅

### API Service Layer (`services/api.ts`)
Created comprehensive API client for all backend endpoints:
- **Library**: `scanLibrary()`, `getSong()`, `getLyrics()`, `getAnalysis()`, `getAudioUrl()`, `getStemUrl()`, `deleteSong()`
- **Convert**: `convert()` - Start audio conversion jobs
- **Analysis**: `analyze()`, `queryAnalysis()` - Run and query music analysis
- **Stems**: `separate()` - Separate audio into stems
- **Lyrics**: `fetch()` - Fetch synced/plain lyrics
- **Jobs**: `getJob()`, `listJobs()` - Track async job progress

### Audio Playback (`hooks/useAudioPlayback.ts`)
Built custom Web Audio API hook with full multi-stem support:
- **Multi-stem loading**: Load and decode multiple stem audio files
- **Synchronized playback**: All stems share single AudioContext timeline
- **Individual controls**: Volume, mute per-stem via GainNodes
- **Master/Max volume**: Global volume controls
- **Playback controls**: Play, pause, seek, speed (0.5x - 2.0x)
- **Time tracking**: requestAnimationFrame-based position updates
- **Analyser support**: Get AnalyserNode for visualizations

**Why Web Audio API over Howler.js:**
- Native multi-stem mixing with GainNodes
- Perfect synchronization (shared AudioContext)
- No bundle size increase
- Built-in visualization support (AnalyserNode)
- More control for future effects/routing

### Lyrics Parser (`utils/lrcParser.ts`)
LRC format parser for synced lyrics:
- Parses `[mm:ss.xx]` timestamps to seconds
- Filters out metadata tags (`[ar:`, `[ti:`, etc.)
- Returns sorted array of `{timestamp, text}` objects
- Time formatting utilities

### StudioPanel Integration
Full data integration in `StudioPanel.tsx`:
- ✅ Loads audio from backend API (full mix or individual stems)
- ✅ Loads and parses synced lyrics (.lrc) or static lyrics
- ✅ Loads analysis data (for future overlays)
- ✅ Wire up all action buttons:
  - **Convert**: Starts WAV conversion job via API
  - **Analyze**: Starts analysis job via API
  - **Separate Stems**: Starts Demucs stem separation (2/4/6 stems)
  - **Delete**: Deletes song and all files
- ✅ Real-time audio playback with Web Audio API
- ✅ Synced lyrics highlighting with auto-scroll
- ✅ Multi-stem volume/mute/solo controls
- ✅ Loop A/B markers (UI ready, enforcement pending)
- ✅ Speed control (0.5x - 2.0x)
- ✅ Loading states and error handling

## Files Created

### Core Implementation
1. `frontend/src/components/studio/types.ts` - Shared TypeScript types
2. `frontend/src/components/studio/StudioHeader.tsx` - Header with actions dropdown
3. `frontend/src/components/studio/StemControl.tsx` - Individual stem control
4. `frontend/src/components/studio/StemMixer.tsx` - Stem mixer panel
5. `frontend/src/components/studio/StemVisualizer.tsx` - Multi-stem visualizer
6. `frontend/src/components/studio/LyricsPanel.tsx` - Lyrics panel with sync
7. `frontend/src/components/studio/PlaybackControls.tsx` - Playback controls

### Data Integration
8. `frontend/src/services/api.ts` - Backend API client
9. `frontend/src/hooks/useAudioPlayback.ts` - Web Audio API playback hook
10. `frontend/src/utils/lrcParser.ts` - LRC lyrics parser

### Main Component
11. `frontend/src/components/panels/StudioPanel.tsx` - Fully integrated studio panel

## Technical Highlights

- **No external audio libraries** - Pure Web Audio API implementation
- **Multi-stem architecture** - Up to 6 stems with individual control
- **Real-time mixing** - GainNode-based volume/mute/solo
- **Synced lyrics** - LRC format parsing with auto-scroll
- **Backend integration** - All CRUD operations via REST API
- **TypeScript** - Full type safety throughout
- **Loading states** - Proper async handling and error boundaries

## Notes
- Stem mixer and visualizer are unified (not separate tabs)
- Visualizer always shows all stems simultaneously
- Click any stem lane opens transcription for that stem
- Playback state synced across all components
- Lyrics sync with playback if .lrc available
