# Stems Mixer UI Redesign - 2025-11-21

## Objective
Redesign the stems tab in the song details section to provide a professional DAW-style mixer interface with synchronized playback, mute, and solo controls.

## Current State
- **Location**: `app/api/static/index.html` (lines 760-764, 1376-1408)
- **Layout**: Horizontal responsive grid (`info-grid`)
- **Playback**: Independent audio players per stem
- **Controls**: Only basic HTML5 audio controls
- **Issues**:
  - No synchronization between stem playbacks
  - No mute/solo functionality
  - Horizontal layout doesn't match industry standard (DAWs use vertical)
  - Uses full width with no room for additional controls

## Requirements
1. ✅ **Synced Playback**: All stems play in perfect sync
2. ✅ **Mute Controls**: Individual mute button per stem
3. ✅ **Solo Controls**: Individual solo button per stem (mutes all others)
4. ✅ **Vertical Layout**: Stack stems vertically like a DAW mixer
5. ✅ **Compact Width**: Don't use full width (leave room for future controls like volume, pan, etc.)
6. ✅ **Section-Based**: Make it a distinct section for future expansion

## Design Approach

### Architecture
- **Master Transport**: Single playback control that drives all stems
- **Stem Channels**: Vertical strips with individual controls
- **Web Audio API**: Use AudioContext for precise synchronization
- **State Management**: JavaScript object tracking mute/solo states

### Layout Structure
```
┌─────────────────────────────────────────┐
│  Master Transport Controls              │
│  ⏯ ⏹ ⏮ ⏭  [━━━━━━━━━━] 0:00 / 3:45    │
└─────────────────────────────────────────┘

┌─ Stems Mixer ────────────────────────────┐
│ ┌──────┬──────┬──────┬──────┬──────┬───┐│
│ │Vocals│ Drums│ Bass │Other │Guitar│..││
│ ├──────┼──────┼──────┼──────┼──────┼───┤│
│ │  M   │  M   │  M   │  M   │  M   │..││
│ │  S   │  S   │  S   │  S   │  S   │..││
│ │ [▓▓] │ [▓▓] │ [▓▓] │ [▓▓] │ [▓▓] │..││
│ └──────┴──────┴──────┴──────┴──────┴───┘│
└──────────────────────────────────────────┘
```

### UI Components

#### Master Transport
- Play/Pause button
- Stop button
- Seek bar (timeline scrubber)
- Time display (current / total)
- All controls affect all stems simultaneously

#### Stem Channel Strip
- **Header**: Stem name with icon
- **Mute Button**: Toggle mute for this stem
- **Solo Button**: Mute all others (exclusive or additive solo)
- **Level Meter**: Visual feedback of audio level (future)
- **Volume Fader**: Gain control (future)

### Synchronization Strategy

**Option 1: Multiple Audio Elements (Simpler)**
- Use multiple `<audio>` elements (one per stem)
- Control them via JavaScript:
  - Set `currentTime` on all elements before play
  - Listen to `timeupdate` on master to sync others
  - Handle play/pause/seek on all elements together
- Pros: Simple, works everywhere
- Cons: May drift slightly over time, less precise

**Option 2: Web Audio API (Better)**
- Load all stems as AudioBuffers
- Use AudioBufferSourceNode for each stem
- Start all sources at the same time with `audioContext.currentTime`
- Connect each source to GainNode for individual mute/volume
- Pros: Perfect sync, precise control
- Cons: More complex, need to handle decoding

**Decision**: Start with Option 1 for simplicity, can upgrade to Option 2 later if needed.

## Implementation Plan

### Phase 1: HTML/CSS Structure ✅
- [x] Create master transport controls section
- [x] Create stems mixer section with vertical layout
- [x] Style stem channel strips (fixed width, ~90px per stem)
- [x] Add mute/solo button styles
- [x] Ensure responsive behavior

### Phase 2: JavaScript Playback Engine ✅
- [x] Create `StemsMixer` class to manage state
- [x] Load all stem audio elements
- [x] Implement synchronized play/pause
- [x] Implement synchronized seek
- [x] Implement stop (pause + reset to 0)
- [x] Add time update loop for master transport
- [x] Add cleanup logic when switching songs/tabs

### Phase 3: Mute/Solo Controls ✅
- [x] Implement mute toggle (set `muted = true`)
- [x] Implement solo toggle (mute all except soloed)
- [x] Handle multiple solos (additive mode)
- [x] Update button states visually

### Phase 4: Testing & Polish 🔄
- [ ] Test sync accuracy across different browsers
- [ ] Test edge cases (seeking while playing, rapid clicks, etc.)
- [x] Add loading states for stems (unavailable state)
- [x] Add error handling for missing stems
- [ ] Ensure accessibility (keyboard controls, ARIA labels)
- [ ] Add volume faders (future enhancement)

## Technical Details

### CSS Classes
- `.stems-mixer-container` - Main container
- `.master-transport` - Transport controls section
- `.stems-channels` - Container for all stem strips
- `.stem-channel` - Individual stem strip
- `.stem-name` - Stem label
- `.btn-mute`, `.btn-solo` - Control buttons
- `.btn-mute.active`, `.btn-solo.active` - Active states

### JavaScript API
```javascript
class StemsMixer {
  constructor(stemFiles) { ... }
  play() { ... }
  pause() { ... }
  stop() { ... }
  seek(time) { ... }
  toggleMute(stemName) { ... }
  toggleSolo(stemName) { ... }
  getSyncedTime() { ... }
}
```

## Future Enhancements
- Volume faders per stem
- Pan controls
- EQ controls
- Level meters with peak detection
- Waveform visualization per stem
- Export mixed stems with applied mute/solo/volume
- Save/load mixer presets

## Status
- [x] Documentation created
- [x] Implementation complete
- [ ] Testing in progress
- [ ] Complete

## Implementation Summary

### What Was Implemented

**CSS Additions** (lines 673-887 in `app/api/static/index.html`):
- `.stems-mixer-container` - Main flex container for mixer UI
- `.master-transport` - Transport controls styling with gradient buttons
- `.seek-bar` - Custom seekbar with progress indicator and handle
- `.stems-channels-section` - Section wrapper for stem channels
- `.stem-channel` - Individual stem strip (90px fixed width)
- `.stem-btn` - Mute/Solo button styles with active states

**JavaScript Class** (lines 1087-1336):
- `StemsMixer` class with full playback synchronization
  - Multiple audio element management
  - Sync drift correction (0.3s tolerance)
  - Mute/Solo state management
  - Master transport controls
  - Automatic cleanup on destroy

**Updated Functions**:
- `renderStemsTab()` (lines 1843-1956): Complete rewrite with new mixer UI
- `handleSeekBarClick()` (lines 1959-1968): Seek bar interaction handler
- `selectSong()` (lines 1522-1546): Added mixer cleanup on song change
- `switchTab()` (lines 2025-2038): Added pause on tab switch

### Key Features
1. ✅ **Synchronized Playback**: All stems play together with drift correction
2. ✅ **Master Transport**: Play/Pause, Stop, Seek controls
3. ✅ **Mute Controls**: Individual mute per stem
4. ✅ **Solo Controls**: Exclusive or additive solo mode
5. ✅ **Vertical Layout**: DAW-style mixer strips
6. ✅ **Compact Design**: 90px per stem, horizontal scroll for many stems
7. ✅ **State Management**: Proper cleanup when switching songs/tabs
8. ✅ **Visual Feedback**: Button states, time display, progress bar

### Technical Decisions
- Used multiple `<audio>` elements approach (simpler than Web Audio API)
- Drift correction checks every 100ms, resyncs if > 0.3s difference
- Solo mode uses `audio.muted` property for instant response
- Hidden audio container for all stem elements
- Stem icons for visual distinction

## Notes
- Keep stem channel width fixed (~80-100px) to allow horizontal scrolling if needed
- Use flexbox for stem channels layout
- Consider using `requestAnimationFrame` for smooth time updates
- Add debouncing to seek bar to avoid performance issues
