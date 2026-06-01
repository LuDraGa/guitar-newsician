# Transcription Panel UX Upgrade

**Date**: 2025-12-09
**Status**: In Progress
**Goal**: Redesign transcription panel layout for better UX, add multi-view support (Piano/Sheet/Tab)

---

## Problem Statement

Current transcription panel has poor UX:
1. **Settings column wastes space** (20% width for dropdown + sliders)
2. **Piano roll is cramped** (only 52% width despite being main focus)
3. **AI chat has nested containers** causing visual clutter and wasting space
4. **No support for sheet music or tablature views** (future requirement)

---

## Design Solution: Option 1 - Compact Header + 2-Column

### Layout Structure
```
┌────────────────────────────────────────────────────────────────┐
│ [Stem ▾] Vocals  [Transcribe] [View: Piano|Sheet|Tab] [⚙️] [✕]│
├─────────────────────────────────────────────┬──────────────────┤
│                                             │ AI Assistant     │
│  View Switcher: [🎹 Piano] [🎼 Sheet] [🎸 Tab] │ [Edit] [Chat]    │
│  ───────────────────────────────────────    │ ──────────────   │
│                                             │ Section: 0-5s    │
│                                             │                  │
│      Current Visualization (75%)            │ User message     │
│      - Piano Roll (current)                 │ AI response      │
│      - Sheet Music (future)                 │                  │
│      - Tablature (future)                   │                  │
│                                             │                  │
│      [Main Focus Area]                      │ [Input] [Send]   │
│                                             │                  │
└─────────────────────────────────────────────┴──────────────────┘
```

### Key Changes
- **Settings**: Moved to header, expandable on ⚙️ click
- **Visualization**: 75% width (was 52%)
- **AI Assistant**: 25% width, flattened component structure
- **View Switcher**: UI prepared for Piano/Sheet/Tab views

---

## Implementation Phases

### Phase 1: Layout Refactor (Current Sprint)
- [x] Create execution doc
- [ ] Refactor TranscriptionPanel.tsx layout
  - Remove 3-column structure (settings | piano | ai)
  - Implement 2-column structure (visualization | ai)
  - Move settings to header
- [ ] Create compact header with settings dropdown
- [ ] Expand piano roll to 75% width
- [ ] Flatten AIEditorWithChat.tsx structure
  - Remove nested containers
  - Simplify section info display
  - Clean up visual hierarchy
- [ ] Add view switcher UI (tabs for Piano/Sheet/Tab)

### Phase 2: View Infrastructure (Next)
- [ ] Create ViewContainer component
- [ ] Add view state management ('piano' | 'sheet' | 'tab')
- [ ] Create SheetMusicViewer placeholder component
- [ ] Create TablatureViewer placeholder component
- [ ] Wire up view switching logic

### Phase 3: Sheet Music Integration (Future)
- [ ] Research: Choose library (OSMD vs alphaTab vs VexFlow)
- [ ] Add library dependency
- [ ] Implement MIDI → MusicXML conversion
- [ ] Integrate sheet music renderer
- [ ] Add sheet-specific settings (clef, key signature, time signature)
- [ ] Test AI editing with sheet view

### Phase 4: Tablature Integration (Future)
- [ ] Integrate tab rendering (alphaTab or custom)
- [ ] Add instrument/tuning configuration
- [ ] Implement MIDI → Tab conversion
- [ ] Add tab-specific editing features
- [ ] Test AI editing with tab view

---

## Technical Details

### Components to Modify

1. **TranscriptionPanel.tsx**
   - Change from 3-column to 2-column layout
   - Add compact header with settings
   - Adjust width percentages: visualization 75%, AI 25%

2. **AIEditorWithChat.tsx**
   - Remove outer container border/padding
   - Flatten section info (no nested box)
   - Remove chat history outer container
   - Simplify visual hierarchy

3. **TranscriptionSettings.tsx**
   - Convert to dropdown/popover component
   - Add to header instead of sidebar

### New Components to Create

1. **TranscriptionHeader.tsx**
   - Stem selector
   - Transcribe button
   - View switcher tabs
   - Settings dropdown trigger
   - Close button

2. **ViewSwitcher.tsx**
   - Tab buttons: Piano | Sheet | Tab
   - Active state styling
   - View state management

3. **SettingsDropdown.tsx** (future)
   - Basic Pitch parameters
   - View-specific settings
   - Positioned under ⚙️ icon

### Libraries for Future Phases

- **Sheet Music**: `opensheetmusicdisplay` or `alphaTab`
- **Tablature**: `alphaTab` (best all-in-one option)
- **MIDI Parsing**: `@tonejs/midi` (if not already using)
- **MusicXML**: May need conversion library

---

## Files Changed

### Phase 1
- `frontend/src/components/panels/TranscriptionPanel.tsx` - Major refactor
- `frontend/src/components/panels/AIEditorWithChat.tsx` - Flatten structure
- `frontend/src/components/panels/TranscriptionSettings.tsx` - May need refactor
- New: `frontend/src/components/panels/TranscriptionHeader.tsx`
- New: `frontend/src/components/panels/ViewSwitcher.tsx`

---

## Testing Checklist

- [ ] Layout renders correctly on all screen sizes
- [ ] Settings dropdown works (when implemented)
- [ ] View switcher UI displays correctly
- [ ] Piano roll has more space and is usable
- [ ] AI chat feels cleaner, less nested
- [ ] Resizing between visualization and AI works
- [ ] All existing functionality still works (transcribe, edit, chat)

---

## Notes

- Keep backward compatibility - piano roll should work exactly as before
- Settings moved to header but should be easily accessible
- View switcher prepared for future, but only Piano is functional initially
- AI chat structure simplified but functionality unchanged

---

## Current Status

**Started**: 2025-12-09
**Phase**: 1 (Layout Refactor) - **✅ COMPLETE**

**Completed Tasks**:
- ✅ Created execution doc
- ✅ Refactored TranscriptionPanel to 2-column layout
- ✅ Expanded visualization area to 75% width (was 52%)
- ✅ Flattened AI chat component structure
- ✅ Added view switcher UI (Piano/Sheet/Tab tabs)
- ✅ Created compact header with settings dropdown
- ✅ Removed inline settings (now in header dropdown)

**Ready for**: User testing and feedback
**Next Phase**: Phase 2 - View Infrastructure (Sheet Music and Tablature integration)
