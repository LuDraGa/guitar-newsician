# Lyrics Editing Feature - Execution Document

**Date**: 2025-12-02
**Task**: Build lyrics editing functionality in the Studio Panel

## Requirements

### Use Cases

1. **No lyrics found on YouTube**
   - User needs to create lyrics.txt from scratch
   - Or paste lyrics content from external source

2. **Plain text (.txt) exists, no synced lyrics (.lrc)**
   - User has lyrics.txt but needs to create lyrics.lrc
   - Two options:
     a. Paste .lrc content directly
     b. Manually sync lyrics with playback (select lines while audio plays)

3. **Synced lyrics (.lrc) exists but has errors**
   - Timing is off
   - Text is wrong
   - User needs to edit both timing and text

### Design Requirements

- Edit button: Pencil icon (no text label)
- Tooltip/aria-label: "Edit" or "Edit lyrics"
- In-place editing within the LyricsPanel itself
- Different editing modes based on the situation

---

## Proposed UX/UI Design

### 1. Edit Button Placement

**Location**: In the LyricsPanel header, next to the auto-scroll toggle

```
┌─────────────────────────────────────┐
│ Lyrics               [Edit] [Auto]  │ ← Edit button here
└─────────────────────────────────────┘
```

### 2. Editing Modes

#### Mode A: Create/Edit Plain Text Lyrics
**When**: No lyrics or only .txt exists

**UI**:
- Click Edit → Panel transforms to a textarea
- Simple text editor with basic formatting
- Actions:
  - Save (writes to lyrics.txt)
  - Cancel (discard changes)

#### Mode B: Create/Edit Synced Lyrics (Paste LRC)
**When**: User wants to paste complete .lrc content

**UI**:
- Tab/toggle: "Plain Text" | "Synced (Paste LRC)"
- Textarea for pasting .lrc format
- Validates LRC format
- Actions:
  - Save (writes to lyrics.lrc)
  - Cancel

#### Mode C: Manual Sync (Interactive)
**When**: .txt exists, user wants to create .lrc by syncing with playback

**UI**:
- Shows plain text lyrics line by line
- "Tap to sync" mode - as audio plays, user taps/clicks each line when it starts
- Or: Click timestamp button next to each line to capture current time
- Actions:
  - Start Sync Session (requires playback)
  - Mark Line (captures current time)
  - Save (writes to lyrics.lrc)
  - Cancel

#### Mode D: Edit Existing Synced Lyrics
**When**: .lrc exists but needs corrections

**UI**:
- Shows editable list of synced lines
- Each line has:
  - Timestamp (editable time input)
  - Text (editable text input)
  - Delete button
- Can add new lines
- Can reorder lines (drag handle)
- Actions:
  - Save (writes to lyrics.lrc)
  - Cancel

---

## Implementation Plan

### Phase 1: Foundation
- [ ] Create LyricsEditor component structure
- [ ] Add edit button to LyricsPanel header
- [ ] Implement edit mode state management
- [ ] Create backend API for saving lyrics

### Phase 2: Plain Text Editor (Mode A)
- [ ] Build textarea editor UI
- [ ] Implement save/cancel actions
- [ ] Backend endpoint: POST /api/lyrics/save-plain

### Phase 3: Paste LRC Editor (Mode B)
- [ ] Build LRC paste UI
- [ ] Add LRC format validation
- [ ] Backend endpoint: POST /api/lyrics/save-synced

### Phase 4: Manual Sync (Mode C)
- [ ] Build interactive sync UI
- [ ] Implement tap-to-sync with playback
- [ ] Capture timestamps for each line
- [ ] Generate .lrc format from captured data

### Phase 5: Edit Synced Lyrics (Mode D)
- [ ] Build editable synced lyrics list
- [ ] Timestamp editing (time input)
- [ ] Text editing (inline text input)
- [ ] Add/delete lines
- [ ] Reorder lines (drag and drop)
- [ ] Update backend endpoint

### Phase 6: Polish & Testing
- [ ] Error handling and validation
- [ ] Loading states
- [ ] Success/error notifications
- [ ] Keyboard shortcuts
- [ ] Accessibility (ARIA labels)
- [ ] Testing with real songs

---

## Technical Notes

### Data Flow

**Current**:
- Backend provides lyrics via song metadata
- Frontend reads lyrics.txt / lyrics.lrc from song folder
- No editing capability

**After**:
- Frontend sends edited lyrics to backend
- Backend writes to lyrics.txt / lyrics.lrc
- Backend updates metadata.json
- Frontend refreshes lyrics data

### API Endpoints Needed

```typescript
POST /api/lyrics/save
{
  song_id: string
  type: 'plain' | 'synced'
  content: string // raw text or LRC format
}

Response:
{
  success: boolean
  message: string
  has_synced_lyrics: boolean
  has_plain_lyrics: boolean
}
```

### Component Structure

```
LyricsPanel
├── Header (with Edit button)
├── LyricsDisplay (read-only view)
└── LyricsEditor (edit mode)
    ├── PlainTextEditor
    ├── SyncedLyricsEditor
    │   ├── PasteLRCMode
    │   ├── ManualSyncMode
    │   └── EditSyncedMode
    └── Actions (Save/Cancel)
```

---

## Status

- [x] Requirements gathered
- [x] UX/UI design proposed
- [x] User approval on design
- [x] Implementation completed
- [ ] Testing with real songs
- [ ] Feature deployed

## Implementation Complete

All components have been implemented:

1. **Backend API** (`/api/lyrics/save`)
   - Validates and saves plain text or synced lyrics
   - Updates metadata.json
   - Handles both .txt and .lrc formats

2. **Frontend Components**
   - `PlainTextEditor`: Simple textarea for plain lyrics
   - `PasteLRCEditor`: LRC format validator and editor
   - `ManualSyncEditor`: Interactive sync with playback
   - `EditSyncedEditor`: Full-featured synced lyrics editor with drag-and-drop

3. **Integration**
   - Edit button added to all LyricsPanel states
   - Keyboard shortcuts (Esc to cancel, Cmd/Ctrl+S to save)
   - Auto-save to localStorage
   - Proper state management and callbacks

---

## Notes

- The pencil icon should be minimal and consistent with the existing UI
- All editing should feel "in-place" - no modal overlays
- Keyboard shortcuts: Escape to cancel, Cmd/Ctrl+S to save
- Auto-save drafts to localStorage to prevent data loss
