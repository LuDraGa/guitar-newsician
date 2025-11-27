# Studio Panel System - Execution Document

**Date**: 2025-11-27
**Task**: Build resizable studio and transcription panel system

## Requirements

### Panel Flow
```
Library (100vw)
  → Song Click → Studio (85vw default, 100vh)
    → Stem Select → Transcription (~20vw, 100vh) + Studio adjusts
```

### Panel Behavior
- **Visibility**: Library stays underneath, visible through 5-10% panel transparency
- **Resize**: Horizontal only via draggable dividers (react-resizable-panels)
- **Constraint**: Panels never overlap
- **Height**: Always 100vh

### Design
- Glassmorphic with 5-10% transparency
- Drop shadow for depth
- Slim shine border (accent color)
- Same design system (60-30-10, fonts, spacing)

### Close/Exit
- Close button on each panel
- ESC key closes active panel
- Studio close → back to library
- Transcription close → back to studio only

### Mobile
- One panel visible at a time
- Edge swipe gestures to open/close

## Implementation

- [x] Install react-resizable-panels
- [x] Create PanelLayout component - `frontend/src/components/panels/PanelLayout.tsx`
- [x] Build Studio panel component - `frontend/src/components/panels/StudioPanel.tsx`
- [x] Build Transcription panel component - `frontend/src/components/panels/TranscriptionPanel.tsx`
- [x] Add resize dividers - Integrated in PanelLayout with ResizeHandle
- [x] Wire up ESC key handler - Closes active panel (transcription → studio priority)
- [x] Add close animations - Framer Motion slide-in/out from right
- [x] Wire to LibraryPage - State management for selectedSong/selectedStem
- [x] Add glassmorphic styling - `.panel-glass` with 90% bg, slim accent border, drop shadow
- [ ] Mobile swipe gestures - TODO

## Components Created
1. `PanelLayout.tsx` - Manages panel visibility, animations, ESC handler
2. `StudioPanel.tsx` - Shows song info, audio player, stems, analysis
3. `TranscriptionPanel.tsx` - Tab editor, AI assistant, notation options
4. `index.css` - Added `.panel-glass` utility class

## Design Details
- **Panel transparency**: 90% (10% transparent) via `bg-dark-400/90`
- **Border**: Slim accent shine `border-accent-500/20`
- **Shadow**: Inset shine + drop shadow
- **Animations**: Spring slide from right (damping: 30, stiffness: 300)
- **Default width**: Studio 85%, Transcription 20%
- **Resize**: Draggable dividers, panels never overlap

## Status
- **Current**: Panel system complete, ready for testing
- **Blockers**: None
- **Next**: Mobile swipe gestures (future enhancement)
