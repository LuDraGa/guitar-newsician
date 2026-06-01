# MIDI Transcription & Editing UI Integration Guide

## Where to Use This Feature

### **Current Flow:**
1. User opens a song in **Studio** view (`LibraryPage.tsx` → `StudioPanel.tsx`)
2. User clicks on a **stem** (vocals, guitar, bass, drums, etc.)
3. **TranscriptionPanel** opens as a side overlay
4. Currently shows placeholder "Transcription UI coming soon"

### **New Flow with MIDI Transcription:**
1. User opens song in Studio
2. User clicks on a stem → **TranscriptionPanel** opens
3. **NEW:** User can:
   - Transcribe audio → MIDI with custom parameters
   - View MIDI piano roll
   - Select problematic sections
   - Request AI editing with natural language
   - Approve/reject AI-proposed changes
   - Download MIDI file

---

## UI Location & Integration Points

### **File:** `frontend/src/components/panels/TranscriptionPanel.tsx`

**Current Structure:**
```
TranscriptionPanel (side overlay panel)
├── Header (title + close button)
├── Transcription Options (placeholder buttons)
│   ├── Guitar Tabs
│   ├── Piano Roll
│   └── Chord Chart
├── Transcription Preview (placeholder)
└── AI Assistant (placeholder input)
```

**New Structure:**
```
TranscriptionPanel
├── Header
├── Transcription Settings Panel (NEW)
│   ├── Preset Selector (Vocals, Guitar, Bass, etc.)
│   ├── Advanced Parameters (collapsible)
│   │   ├── Onset Threshold slider
│   │   ├── Frame Threshold slider
│   │   ├── Min Note Length input
│   │   ├── Frequency Range inputs
│   │   ├── Melodia Trick toggle
│   │   └── Multiple Pitch Bends toggle
│   └── Transcribe Button
├── MIDI Status Display
│   ├── Transcription progress
│   ├── Notes detected count
│   └── Download MIDI button
├── Piano Roll Viewer (NEW)
│   ├── Time ruler
│   ├── MIDI notes visualization
│   ├── Waveform overlay
│   └── Section selection tool (click-drag)
├── AI Editor Panel (NEW)
│   ├── Selected section display
│   ├── Issue description input
│   ├── "Request AI Edit" button
│   ├── Proposed changes preview
│   └── Approve/Reject buttons
└── MIDI Download & Export
```

---

## UI Components to Build

### **1. Transcription Settings Component**

**Location:** `frontend/src/components/panels/TranscriptionSettings.tsx`

**Features:**
- Preset dropdown (Vocals, Guitar, Bass, Piano, Drums, Custom)
- Collapsible advanced settings panel
- Parameter sliders with real-time preview
- Transcribe button with loading state
- Progress indicator

**API Call:**
```typescript
POST /api/v1/midi-editor/transcribe
{
  song_id: string,
  stem_name: string,
  params: {
    onset_threshold: number,
    frame_threshold: number,
    // ...
  }
}
```

---

### **2. Piano Roll Viewer Component**

**Location:** `frontend/src/components/panels/PianoRollViewer.tsx`

**Features:**
- Canvas-based piano roll rendering
- MIDI notes as colored rectangles
- Audio waveform backdrop
- Time ruler with playback cursor
- Click-drag section selection
- Zoom in/out controls

**Libraries:**
- Consider using: `@tonejs/midi` for MIDI parsing
- `wavesurfer.js` for waveform display
- Custom canvas rendering for piano roll

---

### **3. AI Editor Component**

**Location:** `frontend/src/components/panels/AIEditor.tsx`

**Features:**
- Selected time range display (e.g., "23.5s - 27.0s")
- Natural language input field
- Example prompts (chips below input)
- Request button with loading state
- Proposed changes display (before/after comparison)
- Approve/Reject action buttons

**API Calls:**
```typescript
// 1. Request editing
POST /api/v1/midi-editor/edit
{
  song_id, stem_name,
  section_start, section_end,
  issue_description
}

// 2. Approve/Reject
POST /api/v1/midi-editor/approve
{
  change_session_id,
  approved: boolean
}
```

---

### **4. MIDI Status Display**

**Location:** Inline in `TranscriptionPanel.tsx`

**Features:**
- "Not transcribed" state
- "Transcribing..." loading state
- "Transcribed: 142 notes" success state
- Error state with retry button
- Download MIDI button

---

## Step-by-Step Integration

### **Step 1: Add API Service**

Create: `frontend/src/services/midiEditorService.ts`

```typescript
import { apiClient } from '@/api/client'

export interface BasicPitchParams {
  onset_threshold: number
  frame_threshold: number
  minimum_note_length: number
  minimum_frequency?: number
  maximum_frequency?: number
  melodia_trick: boolean
  multiple_pitch_bends: boolean
}

export interface TranscribeRequest {
  song_id: string
  stem_name: string
  params?: BasicPitchParams
  force_retranscribe?: boolean
}

export interface EditRequest {
  song_id: string
  stem_name: string
  section_start: number
  section_end: number
  issue_description: string
}

export const midiEditorService = {
  async transcribe(request: TranscribeRequest) {
    return apiClient.post('/midi-editor/transcribe', request)
  },

  async edit(request: EditRequest) {
    return apiClient.post('/midi-editor/edit', request)
  },

  async approve(sessionId: string, approved: boolean) {
    return apiClient.post('/midi-editor/approve', {
      change_session_id: sessionId,
      approved
    })
  },

  async getPresets() {
    return apiClient.get('/midi-editor/presets')
  }
}
```

---

### **Step 2: Update TranscriptionPanel State**

Add to `TranscriptionPanel.tsx`:

```typescript
const [midiStatus, setMidiStatus] = useState<'none' | 'transcribing' | 'transcribed' | 'error'>('none')
const [transcriptionParams, setTranscriptionParams] = useState<BasicPitchParams | null>(null)
const [selectedSection, setSelectedSection] = useState<{start: number, end: number} | null>(null)
const [aiEditSession, setAiEditSession] = useState<string | null>(null)
const [proposedChanges, setProposedChanges] = useState<any[]>([])
```

---

### **Step 3: Replace Placeholder UI**

Replace lines 50-94 in `TranscriptionPanel.tsx` with:

```tsx
{/* Transcription Settings */}
<TranscriptionSettings
  songId={songId}
  stemName={stemType}
  onTranscribe={handleTranscribe}
  status={midiStatus}
/>

{/* Piano Roll Viewer (only show if transcribed) */}
{midiStatus === 'transcribed' && (
  <PianoRollViewer
    midiPath={midiPath}
    audioPath={audioPath}
    onSectionSelect={setSelectedSection}
  />
)}

{/* AI Editor (only show if section selected) */}
{selectedSection && (
  <AIEditor
    songId={songId}
    stemName={stemType}
    section={selectedSection}
    onApprove={handleApprove}
    onReject={handleReject}
  />
)}
```

---

### **Step 4: Implement Handler Functions**

```typescript
const handleTranscribe = async (params: BasicPitchParams) => {
  setMidiStatus('transcribing')
  try {
    const result = await midiEditorService.transcribe({
      song_id: songId,
      stem_name: stemType,
      params
    })
    setMidiStatus('transcribed')
    setMidiPath(result.midi_path)
    // Show success toast
  } catch (error) {
    setMidiStatus('error')
    // Show error toast
  }
}

const handleApprove = async (sessionId: string) => {
  try {
    await midiEditorService.approve(sessionId, true)
    // Reload MIDI file
    // Show success message
  } catch (error) {
    // Show error
  }
}

const handleReject = async (sessionId: string) => {
  await midiEditorService.approve(sessionId, false)
  setAiEditSession(null)
  setProposedChanges([])
}
```

---

## Visual Design

### **Color Scheme (matching your existing dark theme)**

```css
/* MIDI Notes */
- Note rectangles: bg-accent-500/20 border-accent-500/50
- Selected notes: bg-accent-400/40 border-accent-400
- Pitch bends: bg-blue-500/30 (curves)

/* Section Selection */
- Selection overlay: bg-yellow-500/10 border-yellow-500/50
- Time markers: border-yellow-400

/* AI Editor States */
- Proposed add: bg-green-500/20 border-green-500/50
- Proposed delete: bg-red-500/20 border-red-500/50
- Proposed modify: bg-blue-500/20 border-blue-500/50
```

---

## Example User Flow

### **Scenario: User wants to transcribe guitar solo and fix a missed bend**

1. **User opens song** in Studio
2. **Clicks "guitar" stem** → TranscriptionPanel opens on right side
3. **Sees** "Transcribe Audio to MIDI" section at top
4. **Clicks preset dropdown** → selects "Guitar (Lead)"
5. **Parameters auto-fill:**
   - Onset: 0.3
   - Frame: 0.3
   - Freq: 80-2000 Hz
6. **Clicks "Transcribe" button**
   - Shows progress spinner
   - After ~10 seconds: "✓ Transcribed: 234 notes detected"
7. **Piano roll appears** below settings
   - Shows guitar notes as colored bars
   - Waveform in background
8. **User scrubs through** and finds section with issue (45.2s - 48.1s)
9. **Click-drags** on piano roll to select that section
10. **AI Editor panel expands** below piano roll
11. **User types:** "This section has string bends that weren't captured"
12. **Clicks "Request AI Edit"**
    - Shows loading state
    - Agent analyzes audio + MIDI
13. **Proposed changes appear:**
    - "Add pitch bend: 46.3s → 46.7s (+2 semitones)"
    - Shows before/after comparison
14. **User clicks "Approve"**
    - Changes applied to MIDI
    - Piano roll updates to show pitch bend curve
15. **User clicks "Download MIDI"**
    - Downloads corrected MIDI file

---

## Testing Checklist

- [ ] Transcribe button triggers API call
- [ ] Progress indicator shows during transcription
- [ ] Success state displays note count
- [ ] Preset selector changes parameters
- [ ] Advanced settings toggle works
- [ ] Piano roll renders MIDI notes correctly
- [ ] Section selection via click-drag works
- [ ] AI editor input accepts text
- [ ] Request AI Edit button triggers workflow
- [ ] Proposed changes display correctly
- [ ] Approve button applies changes
- [ ] Reject button cancels changes
- [ ] MIDI file updates after approval
- [ ] Download button works
- [ ] Error states show appropriate messages
- [ ] Loading states show spinners/progress

---

## Next Steps

1. ✅ Backend API complete
2. 🔄 Create `TranscriptionSettings.tsx`
3. 🔄 Create `PianoRollViewer.tsx`
4. 🔄 Create `AIEditor.tsx`
5. 🔄 Update `TranscriptionPanel.tsx` to integrate all components
6. 🔄 Add API service layer
7. 🔄 Test full workflow
8. 🔄 Add error handling and loading states
9. 🔄 Polish UI/UX with animations

---

**Want me to build these components now?**
