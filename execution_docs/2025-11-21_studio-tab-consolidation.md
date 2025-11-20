# Studio Tab Consolidation - 2025-11-21

## Objective
Consolidate the stems and lyrics tabs into a unified "Studio" tab with an intuitive, minimalist design using collapsible sections and smart layout patterns.

## Current State
- **Tabs**: Info, Analysis, Stems, Lyrics (4 separate tabs)
- **Stems tab**: Contains the new mixer UI with transport controls
- **Lyrics tab**: Contains lyrics display (synced or plain)
- **Audio player**: Separate player at top of song details

## Requirements
1. ✅ **New Tab Structure**: Info, Analysis, Studio (3 tabs)
2. ✅ **Studio Tab Contains**:
   - Stems mixer (main component)
   - Lyrics display (secondary component)
   - Main audio playback (if no stems available)
3. ✅ **Design Principles**:
   - Intuitive and minimalist
   - Not cluttered or noisy
   - Use collapsible sections
   - Smart use of space
   - Reuse existing components (don't reinvent)

## Design Approach

### Layout Strategy

**Option A: Side Panel Layout** ⭐ SELECTED
```
┌─────────────────────────────────────────────┐
│  Studio Tab                                 │
├─────────────────────────────┬───────────────┤
│                             │               │
│  Stems Mixer (Main)         │   Lyrics      │
│  - Master Transport         │   Panel       │
│  - Stem Channels            │   (Collapse)  │
│  - Mute/Solo Controls       │               │
│                             │   [Toggle]    │
│                             │               │
└─────────────────────────────┴───────────────┘
```

**Features**:
- Stems mixer takes 65-70% width
- Lyrics panel on right side (30-35% width)
- Lyrics panel can collapse to icon/button
- When collapsed, mixer expands to full width
- Clean, focused layout

**Option B: Stacked with Accordions**
```
┌─────────────────────────────────────────────┐
│  Studio Tab                                 │
├─────────────────────────────────────────────┤
│  ▼ Stems Mixer (Expanded)                   │
│  - Master Transport                         │
│  - Stem Channels                            │
├─────────────────────────────────────────────┤
│  ▶ Lyrics (Collapsed)                       │
└─────────────────────────────────────────────┘
```

**Features**:
- Vertical stacking
- Collapsible sections with expand/collapse icons
- Simpler responsive behavior
- Good for mobile

**Decision**: Use **Option A** (Side Panel) for desktop with responsive fallback to stacked for mobile.

### Component Breakdown

#### 1. Stems Mixer Section
- **Reuse**: Existing `.stems-mixer-container` component
- **Changes**: None needed, just reposition
- **Behavior**: Main focus when stems available

#### 2. Lyrics Panel
- **Reuse**: Existing lyrics rendering logic
- **New**: Collapsible side panel wrapper
- **States**:
  - Expanded (default if lyrics available)
  - Collapsed (icon/button on right edge)
  - Hidden (if no lyrics)

#### 3. Fallback Audio Player
- **Show when**: No stems available
- **Reuse**: Existing audio player component
- **Position**: Center of studio area

### UX Patterns

#### Collapsible Panel
- Click on panel header or icon to toggle
- Smooth slide animation (CSS transitions)
- Remember state in localStorage
- Visual indicator (▶/▼ or ≡ icon)

#### Responsive Behavior
- **Desktop (>1024px)**: Side-by-side layout
- **Tablet (768-1024px)**: Side-by-side with narrower lyrics
- **Mobile (<768px)**: Stacked accordion style

#### Visual Hierarchy
- Stems mixer uses gradient borders and shadows
- Lyrics panel has subtle background
- Clear section headers with icons
- Minimal borders, focus on spacing

## Implementation Plan

### Phase 1: CSS Layout System ✅
- [x] Add `.studio-container` flex layout
- [x] Add `.studio-main` for stems mixer area
- [x] Add `.studio-side-panel` for collapsible lyrics
- [x] Add `.panel-collapsed` state styles
- [x] Add responsive breakpoints
- [x] Add smooth transitions

### Phase 2: Update HTML Structure ✅
- [x] Change tabs from 4 to 3 (Info, Analysis, Studio)
- [x] Create `tab-studio` content div
- [x] Remove separate `tab-stems` and `tab-lyrics`

### Phase 3: JavaScript Refactor ✅
- [x] Create `renderStudioTab()` function
- [x] Merge `renderStemsTab()` and `renderLyricsTab()` logic
- [x] Add `toggleLyricsPanel()` function
- [x] Add `loadLyricsIntoPanel()` async function
- [x] Add localStorage for panel state
- [x] Update `switchTab()` to handle 'studio'
- [x] Remove old `renderLyricsTab()` function

### Phase 4: Testing & Polish 🔄
- [ ] Test with stems + lyrics
- [ ] Test with stems only
- [ ] Test with lyrics only
- [ ] Test with neither (fallback player)
- [ ] Test responsive behavior
- [ ] Test panel collapse/expand

## Technical Details

### CSS Classes
```css
.studio-container           // Main flex container
.studio-main                // Left side (stems mixer)
.studio-side-panel          // Right side (lyrics)
.studio-side-panel.collapsed // Collapsed state
.panel-header               // Collapsible header
.panel-toggle-btn           // Collapse/expand button
.studio-fallback            // Fallback audio player
```

### JavaScript Functions
```javascript
renderStudioTab()           // Main render function
toggleLyricsPanel()         // Collapse/expand lyrics
savePanelState()            // Save to localStorage
loadPanelState()            // Load from localStorage
```

### HTML Structure
```html
<div id="tab-studio" class="tab-content">
  <div class="studio-container">
    <div class="studio-main">
      <!-- Stems mixer or fallback player -->
    </div>
    <div class="studio-side-panel" id="lyrics-panel">
      <div class="panel-header">
        <span>📝 Lyrics</span>
        <button class="panel-toggle-btn">⮜</button>
      </div>
      <div class="panel-content">
        <!-- Lyrics content -->
      </div>
    </div>
  </div>
</div>
```

## Benefits

1. **Reduced Cognitive Load**: 3 tabs instead of 4
2. **Contextual Grouping**: All creative tools in one place
3. **Efficient Use of Space**: Side panel maximizes screen real estate
4. **Flexible Layout**: Collapse what you don't need
5. **Clean Aesthetic**: Minimal, focused design
6. **Reusable Components**: No reinvention needed

## Future Enhancements
- Add MIDI piano roll view to Studio tab
- Add waveform visualization
- Add effects rack panel
- Add recording functionality
- Add export/bounce options
- Drag-and-drop lyrics to sync with audio

## Status
- [x] Documentation created
- [x] Implementation complete
- [x] Bug fix: Lyrics loading timing issue
- [ ] User testing in progress
- [ ] Complete

## Bug Fixes

### Issue: Lyrics showing "Loading lyrics..." indefinitely
**Root Cause**: Race condition in DOM rendering
- `loadLyricsIntoPanel()` was called before `container.innerHTML` was set
- The function tried to find `#lyrics-panel-content` before it existed in the DOM
- Result: Panel never populated with actual lyrics content

**Fix** (line 2138-2141):
- Moved `loadLyricsIntoPanel()` call AFTER `container.innerHTML = ...`
- Ensures DOM elements exist before async function tries to populate them
- Added better error handling with HTTP status checks and console logging

**Files Modified**:
- `app/api/static/index.html`: Fixed async timing, added error handling

## Implementation Summary

### What Was Implemented

**CSS Additions** (lines 888-1028 in `app/api/static/index.html`):
- `.studio-container` - Main flex container with side-by-side layout
- `.studio-main` - Flexible main area for stems mixer (takes remaining space)
- `.studio-side-panel` - 350px width collapsible panel for lyrics
- `.studio-side-panel.collapsed` - Collapsed state (44px width, hides content)
- `.panel-header` - Clickable header with toggle button
- `.panel-toggle-btn` - Collapse/expand button with rotation animation
- `.studio-fallback` - Centered fallback UI when no stems available
- Responsive breakpoints for mobile/tablet (stacks vertically on mobile)

**HTML Changes** (lines 1096-1119):
- Tabs reduced from 4 to 3: Info, Analysis, Studio
- Removed `tab-stems` and `tab-lyrics` divs
- Added single `tab-studio` div for combined layout
- Studio tab uses 🎙️ icon

**JavaScript Functions**:
- `renderStudioTab()` (lines 1980-2140): Main rendering function
  - Checks for stems and lyrics availability
  - Builds stems mixer HTML (reuses previous implementation)
  - Creates collapsible lyrics panel with localStorage state
  - Shows fallback audio player when no stems available
  - Initializes StemsMixer with setTimeout for DOM readiness

- `loadLyricsIntoPanel()` (lines 2142-2207): Async lyrics loader
  - Fetches lyrics from API
  - Parses LRC format for synced lyrics
  - Displays plain lyrics with proper formatting
  - Shows "Fetch Lyrics" button on error
  - Compact display optimized for side panel

- `toggleLyricsPanel()` (lines 2209-2216): Panel toggle handler
  - Toggles collapsed class
  - Persists state to localStorage
  - Smooth CSS transitions

- Updated `switchTab()` (line 2232): Changed from 'stems' to 'studio'
- Updated `renderSongDetails()` (line 1710): Calls `renderStudioTab()` instead of separate functions
- Removed old `renderLyricsTab()` function (no longer needed)

### Key Features
1. ✅ **Unified Studio Tab**: Single tab for all creative work
2. ✅ **Side-by-Side Layout**: Stems mixer + lyrics panel
3. ✅ **Collapsible Panel**: Lyrics can collapse to save space
4. ✅ **State Persistence**: Panel state saved to localStorage
5. ✅ **Fallback UI**: Audio player shown when no stems
6. ✅ **Responsive Design**: Stacks vertically on mobile
7. ✅ **Minimalist Aesthetic**: Clean, spacious design
8. ✅ **Reused Components**: No reinvention, just reorganization

### Layout Behavior
- **Desktop (>1024px)**: Stems mixer (flex-grow) + Lyrics panel (350px)
- **Tablet (768-1024px)**: Stems mixer (flex-grow) + Lyrics panel (280px)
- **Mobile (<768px)**: Stacked vertically, full width panels
- **Collapsed**: Lyrics panel shrinks to 44px, only icon visible

### Design Principles Applied
- **Cognitive Load**: 3 tabs instead of 4
- **Contextual Grouping**: Studio tools together
- **Space Efficiency**: Collapsible panel maximizes workspace
- **Minimal Noise**: Subtle borders, generous spacing
- **Progressive Disclosure**: Hide what's not needed
