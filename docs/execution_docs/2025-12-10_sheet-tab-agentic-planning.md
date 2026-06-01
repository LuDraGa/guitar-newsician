# Sheet Music + Tablature Visualization & Agentic Experience Planning

**Date**: 2025-12-10
**Status**: 📋 Planning Phase
**Goal**: Design and plan implementation of editable sheet music/tablature views with upgraded AI interaction

---

## Problem Statement

Current transcription panel limitations:
1. **Only Piano Roll View** - No sheet music or tablature visualization
2. **Cumbersome AI Interaction** - Edit/chat mode toggle, multi-step approval flow, no visual feedback
3. **No Annotations** - Can't add notes, markings, fingerings like MuseScore
4. **Limited Editability** - No manual editing of notation, only AI-driven changes
5. **View Isolation** - Changes in MIDI don't reflect in other views (when they exist)

**User Goal**: MuseScore-like annotation system for sheet music, custom editable tablature, and significantly improved agentic interaction that feels natural and efficient.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TranscriptionPanel                            │
├─────────────────────────────────────────────────────────────────┤
│  Header: [Drums ▾|⚙️]  ✓ 234 notes  [Re-transcribe]      [✕]   │
├─────────────────────────────────────────────────────────────────┤
│  Tabs: [Piano Roll] [Sheet Music] [Tablature]                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────┬─────────────────────────┐  │
│  │  View Column (75%)              │  AI Assistant (25%)     │  │
│  │                                 │                         │  │
│  │  • PianoRollViewer             │  Unified AI Interface:  │  │
│  │  • SheetMusicViewer (NEW)      │  • Contextual           │  │
│  │  • TablatureViewer (NEW)       │  • Conversational       │  │
│  │                                 │  • Visual previews      │  │
│  │  + Annotation Layer            │  • Quick actions        │  │
│  │  + Selection Tools             │  • Smart suggestions    │  │
│  │  + Manual Editing              │                         │  │
│  │                                 │                         │  │
│  └─────────────────────────────────┴─────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Sheet Music Visualization

### Requirements

**Core Features:**
- ✅ Render MIDI as standard music notation (treble/bass clef)
- ✅ Auto-map MIDI notes → sheet music
- ✅ Editable notes (add, delete, move, change pitch/duration)
- ✅ Annotations like MuseScore:
  - Text (lyrics, fingerings, comments)
  - Dynamics (p, f, mp, mf, crescendo, etc.)
  - Articulations (staccato, accent, legato, etc.)
  - Tempo markings (BPM, ritardando, accelerando)
  - Chord symbols above staff
  - Guitar-specific: position markers (VII, XII), fingerings (1-4), techniques (H, P, S)
- ✅ Multi-track support (melody, chords, bass on separate staves)
- ✅ Key signature and time signature display/editing
- ✅ Measure numbering and repeat signs

**Integration:**
- Changes in sheet music reflect in MIDI and tablature
- AI can suggest notation improvements
- Export to MusicXML, PDF, MIDI

### Technology Research

#### Option 1: OpenSheetMusicDisplay (OSMD)
**Pros:**
- Mature, actively maintained
- Good MusicXML rendering
- Clean API for rendering

**Cons:**
- **Read-only** - no editing out of the box
- Would need custom editing layer on top
- Not designed for interactive editing

**Verdict:** ❌ Not suitable for editable sheet music

#### Option 2: VexFlow
**Pros:**
- Powerful low-level rendering engine
- Highly customizable
- Can build custom editing UI
- Good community

**Cons:**
- Low-level API (need to build everything)
- Steeper learning curve
- More development time

**Verdict:** ✅ Best for custom editable implementation

#### Option 3: alphaTab
**Pros:**
- Guitar-focused
- Supports both sheet music and tabs
- Good rendering quality

**Cons:**
- Primarily tab-focused
- Sheet music features secondary
- Limited annotation support

**Verdict:** 🟡 Better for tablature than sheet music

#### Option 4: Verovio
**Pros:**
- Excellent engraving quality
- Supports MEI and MusicXML
- Fast rendering

**Cons:**
- **Read-only** toolkit
- Not designed for interactive editing

**Verdict:** ❌ Not suitable for editable sheet music

### Recommended: VexFlow + Custom Editing Layer

**Implementation Strategy:**

1. **MIDI → MusicXML Conversion**
   ```
   MIDI File → music21 (Python) → MusicXML → Frontend
   ```
   - Use `music21` library in backend to convert MIDI to MusicXML
   - Preserve timing, key signature, time signature, dynamics

2. **MusicXML → VexFlow Rendering**
   ```typescript
   MusicXML → Parser → VexFlow Elements → Canvas Rendering
   ```
   - Parse MusicXML in frontend
   - Generate VexFlow rendering instructions
   - Render to HTML5 Canvas

3. **Annotation Layer**
   ```typescript
   interface Annotation {
     id: string
     type: 'text' | 'dynamic' | 'articulation' | 'tempo' | 'chord' | 'fingering'
     position: { measure: number, beat: number, staff?: number }
     content: string
     style?: CSSProperties
   }
   ```
   - Overlay on top of VexFlow rendering
   - SVG or HTML elements positioned over staff
   - Editable via click/drag interactions

4. **Editing Operations**
   - **Add Note**: Click staff position → create note
   - **Delete Note**: Select note → press delete
   - **Move Note**: Drag note to new position
   - **Change Pitch**: Drag note up/down on staff
   - **Change Duration**: Select note → change duration in toolbar
   - **Add Annotation**: Select annotation type → click position

### Component Structure

```typescript
// frontend/src/components/panels/SheetMusicViewer.tsx
interface SheetMusicViewerProps {
  midiPath: string
  onSectionSelect?: (start: number, end: number) => void
  selectedSection?: { start: number; end: number } | null
  annotations?: Annotation[]
  onAnnotationAdd?: (annotation: Annotation) => void
  onAnnotationEdit?: (id: string, changes: Partial<Annotation>) => void
  onAnnotationDelete?: (id: string) => void
  onNoteEdit?: (edit: NoteEdit) => void
}

export function SheetMusicViewer({ ... }: SheetMusicViewerProps) {
  // 1. Load MIDI and convert to MusicXML
  // 2. Parse MusicXML and generate VexFlow elements
  // 3. Render to canvas with VexFlow
  // 4. Overlay annotation layer
  // 5. Handle user interactions (selection, editing, annotation)
  // 6. Sync changes back to MIDI
}
```

---

## Part 2: Tablature Visualization

### Requirements

**Core Features:**
- ✅ Render MIDI as guitar tablature (6-string by default)
- ✅ Configurable tuning (standard, drop-D, DADGAD, etc.)
- ✅ Editable fret positions (add, delete, move notes)
- ✅ Guitar techniques:
  - Bends (full, half, quarter)
  - Slides (up, down)
  - Hammer-ons / Pull-offs (H, P)
  - Vibrato (~)
  - Palm muting (PM)
  - Harmonics (⟨⟩)
  - Tapping (T)
- ✅ Rhythm notation above tab (note durations, rests)
- ✅ Chord diagrams
- ✅ Measure numbers and repeat signs

**Integration:**
- Changes in tab reflect in MIDI and sheet music
- AI can suggest fingerings and techniques
- Export to Guitar Pro, PDF, MIDI

### Technology Research

#### Option 1: alphaTab (RECOMMENDED)
**Pros:**
- ✅ **Best-in-class guitar tab rendering**
- ✅ Supports Guitar Pro (GP3-7), MusicXML, MIDI
- ✅ Interactive playback with audio synthesis
- ✅ Customizable rendering (themes, layout)
- ✅ Good documentation and examples
- ✅ Active development

**Cons:**
- Editing API is limited (primarily a renderer)
- May need to build custom editing UI
- Large library size (~500KB)

**Verdict:** ✅ **Best choice for tablature**

#### Option 2: VexTab (VexFlow-based)
**Pros:**
- Built on VexFlow
- Text-based notation (easy to generate)
- Good for simple tabs

**Cons:**
- Less feature-rich than alphaTab
- No Guitar Pro import
- Limited technique support

**Verdict:** 🟡 Good for basic tabs, but alphaTab is better

### Recommended: alphaTab + Custom Editing Layer

**Implementation Strategy:**

1. **MIDI → Guitar Pro Conversion**
   ```
   MIDI File → music21 → Guitar Pro Format → Frontend
   ```
   - Use `music21` or custom converter
   - Map MIDI notes to fret positions (algorithm considers playability)
   - Add default fingerings based on position

2. **alphaTab Rendering**
   ```typescript
   Guitar Pro File → alphaTab API → Tab Rendering
   ```
   - Load GP file or MusicXML
   - Configure tuning and display options
   - Render to HTML/SVG

3. **Editing Layer**
   ```typescript
   interface TabEdit {
     measure: number
     beat: number
     string: number  // 1-6 (or more for extended range)
     fret: number    // 0-24
     technique?: 'bend' | 'slide' | 'hammer' | 'pull' | 'vibrato' | 'harmonic'
   }
   ```
   - Click tab position → change fret number
   - Right-click → add technique marker
   - Drag → move note to different string/position

4. **Technique Annotations**
   - Bends: Show target pitch (e.g., "full", "½", "¼")
   - Slides: Arrow between frets
   - Hammer/Pull: Slur line with H/P marker
   - Vibrato: Wavy line above note

### Component Structure

```typescript
// frontend/src/components/panels/TablatureViewer.tsx
interface TablatureViewerProps {
  midiPath: string
  tuning?: string[]  // Default: ['E', 'A', 'D', 'G', 'B', 'E']
  onSectionSelect?: (start: number, end: number) => void
  selectedSection?: { start: number; end: number } | null
  onTabEdit?: (edit: TabEdit) => void
  techniques?: TechniqueMarker[]
  onTechniqueAdd?: (technique: TechniqueMarker) => void
}

export function TablatureViewer({ ... }: TablatureViewerProps) {
  // 1. Load MIDI and convert to Guitar Pro format
  // 2. Initialize alphaTab with GP file
  // 3. Overlay editing layer
  // 4. Handle user interactions (fret changes, techniques)
  // 5. Sync changes back to MIDI
}
```

---

## Part 3: Agentic Experience Upgrade

### Current Problems

**Issues with Current AI Interaction:**

1. **Mode Switching Overhead**
   - User must toggle between "Edit Mode" and "Chat Mode"
   - Cognitive overhead: "Do I want to edit or just ask?"
   - AI can't proactively suggest edits in chat mode

2. **Multi-Step Approval Flow**
   - Select section → Switch to edit → Type instruction → Wait → Review → Approve
   - 5+ steps for a simple edit
   - If rejected, start over from scratch

3. **No Visual Feedback**
   - AI processing is invisible (just "Generating suggestions...")
   - No preview of proposed changes before approval
   - Changes not highlighted in context of full score

4. **Poor Iterative Editing**
   - Can't tweak AI proposals (all-or-nothing)
   - No undo/redo for applied changes
   - Can't have conversation about refinements

5. **View Isolation**
   - AI suggestions shown as text only
   - Not integrated with piano roll, sheet, or tab views
   - User must manually interpret suggestions

6. **Limited Context Awareness**
   - AI doesn't know which view user is looking at
   - Generic responses not tailored to current task
   - No proactive suggestions based on user activity

### Solution: Unified Conversational AI with Visual Integration

**Design Principles:**
- ✅ **Single Interface** - No edit/chat mode toggle
- ✅ **Conversational** - Chat naturally, AI proposes edits contextually
- ✅ **Visual** - Show AI changes directly in notation/tab/piano roll
- ✅ **Iterative** - Refine proposals through conversation
- ✅ **Proactive** - AI suggests improvements without being asked
- ✅ **Context-Aware** - AI knows current view and user activity

### New AI Assistant Architecture

```
┌─────────────────────────────────────────────────────────┐
│  AI Assistant (Unified Interface)                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  💬 Chat Messages (Conversational History)              │
│  ┌────────────────────────────────────────────────┐    │
│  │ User: "Simplify this passage"                  │    │
│  │ AI: "I can reduce note density by..."          │    │
│  │     [Preview Changes] [Apply] [Tweak]          │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  🎯 Quick Actions (Context-Aware Suggestions)           │
│  ┌────────────────────────────────────────────────┐    │
│  │ • Add harmonies to melody                      │    │
│  │ • Create fingerstyle arrangement               │    │
│  │ • Transpose to easier key                      │    │
│  │ • Separate rhythm and lead                     │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  🔍 Insights (Automatic Analysis)                       │
│  ┌────────────────────────────────────────────────┐    │
│  │ Key: A minor | Tempo: 120 BPM | 34 measures   │    │
│  │ Chord progression: Am - F - C - G              │    │
│  │ Complexity: Moderate (playable for beginners)  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ⚡ Chat Input                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Ask anything or request changes...             │    │
│  │ [Send]                                          │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Visual Change Previews

**When AI proposes an edit, show changes directly in notation:**

```
Piano Roll View:
┌──────────────────────────────────────────────────┐
│  [Original Notes in Blue]                        │
│  [Proposed Changes in Yellow Overlay]            │
│  [Deleted Notes Dimmed with Strike-through]      │
└──────────────────────────────────────────────────┘
  Actions: [Apply] [Reject] [Tweak Settings]

Sheet Music View:
┌──────────────────────────────────────────────────┐
│  Staff with [Original Notes in Black]            │
│            [Proposed Notes in Red]               │
│            [Diff highlighting measures]          │
└──────────────────────────────────────────────────┘
  Actions: [Apply] [Reject] [Show Alternative]

Tablature View:
┌──────────────────────────────────────────────────┐
│  Tab with [Original Frets in Normal Font]        │
│          [Proposed Frets in Bold+Color]          │
│          [Technique markers added in green]      │
└──────────────────────────────────────────────────┘
  Actions: [Apply] [Reject] [Suggest Different Position]
```

### Interaction Flow Examples

#### Example 1: Simple Edit Request

**Old Flow (5+ steps):**
1. User selects section on piano roll
2. User clicks "Edit Mode" tab
3. User types "simplify this passage"
4. User clicks "Generate Suggestions"
5. AI shows text description
6. User clicks "Preview"
7. User reviews and clicks "Approve"

**New Flow (2 steps):**
1. User selects section, types in chat: "simplify this passage"
2. AI immediately shows visual preview with [Apply] button

**What changed:**
- No mode switching
- Visual preview instant
- Reduced from 7 clicks to 1 message

#### Example 2: Iterative Refinement

**Old Flow:**
1. User requests edit
2. AI proposes changes
3. User rejects (not quite right)
4. User starts over with new instruction
5. Repeat until satisfied

**New Flow:**
1. User: "simplify this"
2. AI: Shows preview
3. User: "actually keep the melody notes"
4. AI: Updates preview with melody preserved
5. User: "perfect" → [Apply]

**What changed:**
- Conversational refinement
- AI remembers context
- Preview updates in place

#### Example 3: Proactive Suggestions

**Old Flow:**
- AI waits passively for instructions
- User must think of what to ask

**New Flow:**
- User working on transcription
- AI notices complex chord voicing
- AI: "💡 I notice this section has difficult fingerings. Want me to suggest easier positions?"
- User: "yes"
- AI: Shows tablature with alternative fingerings

**What changed:**
- AI proactively identifies issues
- Contextual suggestions
- Helpful without being intrusive

### Component Structure

```typescript
// frontend/src/components/panels/AIAssistant.tsx (NEW - replaces AIEditorWithChat)
interface AIAssistantProps {
  songId: string
  stemName: string
  currentView: 'piano' | 'sheet' | 'tab'  // NEW - view awareness
  section?: { start: number; end: number } | null
  onApply: (changes: ProposedChanges) => Promise<void>
  onPreview: (changes: ProposedChanges) => void  // NEW - preview in view
  onClearPreview: () => void  // NEW
}

interface ProposedChanges {
  sessionId: string
  description: string
  changes: {
    type: 'add' | 'delete' | 'modify'
    target: 'note' | 'chord' | 'annotation' | 'technique'
    data: any
  }[]
  preview_data: {
    piano_roll?: PianoRollChange[]
    sheet_music?: SheetMusicChange[]
    tablature?: TablatureChange[]
  }
}

export function AIAssistant({ currentView, onPreview, ... }: AIAssistantProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [quickActions, setQuickActions] = useState<QuickAction[]>([])
  const [insights, setInsights] = useState<Insight | null>(null)

  // Single chat interface - no mode toggle
  // AI can propose edits within conversation
  // Visual previews triggered automatically when AI suggests changes
  // Context-aware quick actions based on currentView

  const handleMessage = async (message: string) => {
    // 1. Send to AI
    // 2. If response includes proposed changes:
    //    - Call onPreview() to show changes in current view
    //    - Display [Apply] [Reject] buttons
    // 3. If just informational response:
    //    - Show as regular chat message
  }

  return (
    <div>
      {/* Insights Section (auto-populated) */}
      {insights && <InsightsPanel insights={insights} />}

      {/* Quick Actions (context-aware) */}
      <QuickActionsPanel actions={quickActions} onClick={handleQuickAction} />

      {/* Chat History (conversational) */}
      <ChatHistory messages={chatHistory} />

      {/* Single Input (no mode toggle) */}
      <ChatInput onSend={handleMessage} />
    </div>
  )
}
```

### Backend API Changes

**New endpoint for unified AI interaction:**

```python
# backend/app/api/routes/midi_editor.py

@router.post("/ai/message")
async def ai_message(request: AIMessageRequest):
    """
    Unified AI endpoint - handles both chat and edit requests.

    AI determines whether to:
    1. Provide informational response (chat)
    2. Propose concrete changes (edit)
    3. Both (explanation + edit proposal)
    """

    # Enhanced prompt with view context
    system_prompt = f"""
    You are a guitar expert AI assistant.

    Current context:
    - User is viewing: {request.current_view} (piano roll / sheet music / tablature)
    - Section selected: {request.section} (or whole MIDI)
    - Previous conversation: {request.chat_history}

    Your capabilities:
    1. Answer questions about the music
    2. Propose edits (add, delete, modify notes/chords/techniques)
    3. Suggest improvements proactively

    When proposing edits:
    - Always explain WHY you're making changes
    - Provide preview_data for visual rendering
    - Tailor changes to current view (e.g., fingerings for tab view)

    Response format:
    {{
      "message": "Conversational response",
      "proposed_changes": {{ ... }} | null,
      "quick_actions": ["action1", "action2", ...]
    }}
    """

    # AI decides whether to propose edits or just chat
    response = await llm_chain.invoke(...)

    if response.proposed_changes:
        # Generate preview data for current view
        preview_data = generate_preview(
            changes=response.proposed_changes,
            view=request.current_view
        )
        response.proposed_changes.preview_data = preview_data

    return response
```

### Quick Actions System

**Context-aware suggestions based on current view and content:**

```typescript
interface QuickAction {
  id: string
  label: string
  icon: string
  category: 'arrangement' | 'simplification' | 'theory' | 'technique'
  applicable_views: ('piano' | 'sheet' | 'tab')[]
}

// Generated dynamically based on:
// - Current view (piano / sheet / tab)
// - Content analysis (complexity, key, tempo)
// - User's recent activity

const exampleQuickActions = [
  {
    id: 'add-harmonies',
    label: 'Add harmonies to melody',
    icon: '🎵',
    category: 'arrangement',
    applicable_views: ['piano', 'sheet']
  },
  {
    id: 'fingerstyle-arrangement',
    label: 'Create fingerstyle arrangement',
    icon: '🎸',
    category: 'arrangement',
    applicable_views: ['tab']
  },
  {
    id: 'transpose-key',
    label: 'Transpose to easier key',
    icon: '🔄',
    category: 'simplification',
    applicable_views: ['piano', 'sheet', 'tab']
  },
  {
    id: 'separate-parts',
    label: 'Separate melody and chords',
    icon: '✂️',
    category: 'arrangement',
    applicable_views: ['piano', 'sheet', 'tab']
  },
  {
    id: 'add-fingerings',
    label: 'Suggest fingerings',
    icon: '👆',
    category: 'technique',
    applicable_views: ['tab']
  }
]
```

---

## Implementation Phases

### Phase 1: Sheet Music View Foundation (Week 1)
- [ ] Backend: MIDI → MusicXML conversion endpoint
- [ ] Frontend: VexFlow integration and basic rendering
- [ ] Frontend: SheetMusicViewer component structure
- [ ] Frontend: Basic note display (treble clef, key signature, time signature)
- [ ] Frontend: Section selection on sheet music
- [ ] Testing: Verify MIDI-sheet mapping accuracy

### Phase 2: Sheet Music Editing & Annotations (Week 2)
- [ ] Frontend: Annotation data model and storage
- [ ] Frontend: Annotation overlay layer (SVG/HTML)
- [ ] Frontend: Text annotations (click to add, edit, delete)
- [ ] Frontend: Dynamic markings (p, f, crescendo, etc.)
- [ ] Frontend: Articulation markers (staccato, accent, etc.)
- [ ] Frontend: Guitar-specific annotations (fingerings, positions)
- [ ] Frontend: Note editing (add, delete, move, change pitch)
- [ ] Backend: Save/load annotations with MIDI
- [ ] Testing: Annotation persistence and sync

### Phase 3: Tablature View Foundation (Week 3)
- [ ] Backend: MIDI → Guitar Pro conversion endpoint
- [ ] Backend: Intelligent fret mapping algorithm (playability-aware)
- [ ] Frontend: alphaTab integration
- [ ] Frontend: TablatureViewer component structure
- [ ] Frontend: Tuning configuration UI
- [ ] Frontend: Basic tab rendering with alphaTab
- [ ] Frontend: Section selection on tablature
- [ ] Testing: MIDI-tab mapping accuracy

### Phase 4: Tablature Editing & Techniques (Week 4)
- [ ] Frontend: Fret number editing (click to change)
- [ ] Frontend: Technique markers UI (bends, slides, hammer/pull)
- [ ] Frontend: String/position changes (drag notes)
- [ ] Frontend: Chord diagram display
- [ ] Backend: Save/load tab edits
- [ ] Backend: Tab → MIDI sync (reflect changes back)
- [ ] Testing: Tab editing and technique markers

### Phase 5: Unified AI Assistant (Week 5)
- [ ] Backend: New `/ai/message` unified endpoint
- [ ] Backend: View-aware AI prompting
- [ ] Backend: Preview data generation for each view
- [ ] Frontend: AIAssistant component (replaces AIEditorWithChat)
- [ ] Frontend: Remove edit/chat mode toggle
- [ ] Frontend: Visual change preview system
- [ ] Frontend: Preview overlays for piano roll
- [ ] Frontend: Preview overlays for sheet music
- [ ] Frontend: Preview overlays for tablature
- [ ] Testing: Unified AI flow with previews

### Phase 6: Advanced AI Features (Week 6)
- [ ] Backend: Proactive suggestion engine
- [ ] Backend: Quick actions generation (context-aware)
- [ ] Backend: Insights auto-analysis
- [ ] Frontend: Quick actions UI panel
- [ ] Frontend: Insights display
- [ ] Frontend: Iterative refinement (tweak proposals)
- [ ] Frontend: Undo/redo system for applied changes
- [ ] Testing: End-to-end AI interaction flows

### Phase 7: Multi-View Sync & Polish (Week 7)
- [ ] Backend: Change propagation across views
- [ ] Frontend: Real-time sync between piano/sheet/tab
- [ ] Frontend: View-specific edit handling
- [ ] Frontend: Export options (MusicXML, PDF, Guitar Pro, MIDI)
- [ ] Frontend: Performance optimization (lazy loading, caching)
- [ ] Frontend: Mobile responsiveness
- [ ] Testing: Cross-view sync and export

---

## Technical Challenges & Solutions

### Challenge 1: MIDI → Sheet Music Conversion
**Problem:** MIDI doesn't contain notation information (beaming, articulations, voice assignment)
**Solution:**
- Use `music21` for intelligent quantization and notation inference
- Apply heuristics for voice separation
- Allow manual override via annotations

### Challenge 2: MIDI → Tab Fret Mapping
**Problem:** Multiple ways to play same note on guitar (same pitch, different string/fret)
**Solution:**
- Algorithm considers: position proximity, playability, fingering comfort
- AI can suggest alternative positions
- User can manually adjust via drag-and-drop

### Challenge 3: Cross-View Synchronization
**Problem:** Edit in one view needs to reflect in others
**Solution:**
- Canonical MIDI representation as source of truth
- View-specific renderers subscribe to MIDI changes
- Bidirectional sync: view edits update MIDI, MIDI changes update views

### Challenge 4: Visual Change Previews
**Problem:** AI changes need to be overlaid on existing notation without modifying original
**Solution:**
- Separate preview layer (React state)
- CSS-based highlighting and overlays
- Preview data includes exact positions (measure, beat, string, fret)
- Clear preview button to remove overlays

### Challenge 5: Performance with Large Scores
**Problem:** VexFlow and alphaTab rendering can be slow for long pieces
**Solution:**
- Virtual scrolling (render only visible measures)
- Lazy loading of subsequent pages
- Web Workers for MIDI parsing and conversion
- Memoization of rendered measures

---

## API Design

### New Backend Endpoints

```python
# MIDI → MusicXML conversion
POST /api/midi-editor/convert/musicxml
Request: { song_id, stem_name, midi_path }
Response: { musicxml: string, measures: int, key: string, time_signature: string }

# MIDI → Guitar Pro conversion
POST /api/midi-editor/convert/guitar-pro
Request: { song_id, stem_name, midi_path, tuning?: string[] }
Response: { guitar_pro_path: string, fret_mappings: FretMapping[] }

# Save annotations
POST /api/midi-editor/annotations/save
Request: { song_id, stem_name, annotations: Annotation[] }
Response: { success: bool, saved_count: int }

# Load annotations
GET /api/midi-editor/annotations/load?song_id=X&stem_name=Y
Response: { annotations: Annotation[] }

# Unified AI message (replaces /ai/chat and /ai/edit)
POST /api/midi-editor/ai/message
Request: {
  song_id: string
  stem_name: string
  current_view: 'piano' | 'sheet' | 'tab'
  message: string
  section?: { start: number, end: number }
  chat_history: ChatMessage[]
}
Response: {
  message: string
  proposed_changes?: ProposedChanges
  quick_actions?: QuickAction[]
  insights?: Insight
}

# Preview proposed changes (generate overlay data)
POST /api/midi-editor/ai/preview
Request: { change_session_id: string, view: 'piano' | 'sheet' | 'tab' }
Response: { preview_data: ViewSpecificPreview }

# Apply changes (existing endpoint, no changes needed)
POST /api/midi-editor/ai/approve
Request: { change_session_id: string, approved: bool }
Response: { success: bool, updated_midi_path: string }
```

---

## Success Metrics

### User Experience Metrics
- ✅ Average time to complete an edit: **< 30 seconds** (currently ~2 minutes)
- ✅ Number of clicks to apply edit: **< 3 clicks** (currently 7+ clicks)
- ✅ User satisfaction with AI interaction: **> 8/10** (currently ~4/10)
- ✅ Percentage of users using sheet/tab views: **> 60%** (currently 0%)

### Technical Metrics
- ✅ Sheet music rendering time: **< 2 seconds** for 50 measures
- ✅ Tab rendering time: **< 1 second** for 50 measures
- ✅ AI response time with preview: **< 5 seconds**
- ✅ Cross-view sync latency: **< 200ms**

---

## Open Questions for Discussion

### Design Questions:
1. **Annotation UI**: Click-to-add or toolbar-based? (Recommend: toolbar with categories)
2. **Multi-track sheet music**: Separate staves or grand staff? (Recommend: user choice)
3. **Tab editing**: Inline editing or modal? (Recommend: inline for speed)
4. **Quick actions**: Persistent panel or popup? (Recommend: collapsible sidebar)

### Technical Questions:
1. **VexFlow vs alphaTab for sheet music**: VexFlow more customizable but more work. Worth it?
2. **Annotation storage**: Separate JSON file or embed in MusicXML? (Recommend: separate for flexibility)
3. **AI preview rendering**: Server-side or client-side? (Recommend: client for speed)
4. **Undo/redo**: Redux-style state management or custom history? (Recommend: custom with MIDI snapshots)

---

## Next Steps

1. **Review this document** with team/user
2. **Decide on open questions** (annotation UI, storage format, etc.)
3. **Create Phase 1 execution doc** for sheet music foundation
4. **Set up development environment** (VexFlow, alphaTab dependencies)
5. **Begin Phase 1 implementation**

---

## Status

**Status**: 📋 Planning Complete - Ready for Review
**Next**: Discuss design decisions and begin Phase 1 implementation
**Estimated Total Timeline**: 7 weeks (assuming full-time development)
