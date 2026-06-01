# WereCode UI Documentation

**Version:** 1.0
**Last Updated:** 2025-11-26
**Current Stack:** Vanilla JS + HTML + CSS (Single-page web app)
**Future Stack:** React + Next.js + Vite + Tailwind + ESLint + Prettier for deployment on Vercel

---

## 📑 Quick Navigation

Use these **keyword notches** to request specific details:

- `#overview` - High-level UI architecture
- `#library-page` - Library table, filters, search, pills
- `#studio-tab` - Stems mixer, playback, synchronized lyrics
- `#analysis-tab` - Tempo, key, chords, structure visualization
- `#info-tab` - Song metadata and details
- `#modals` - Download modal, settings modal
- `#jobs-panel` - Background job tracking system
- `#design-language` - Colors, typography, spacing, animations
- `#ux-principles` - North star guidelines for UX/UI decisions
- `#user-flows` - Navigation patterns and interaction flows
- `#responsive` - Mobile and tablet behavior
- `#accessibility` - A11y features and considerations
- `#components-detail` - Deep dive into specific components

---

## 🎯 Overview

WereCode UI is a **music analysis and transcription platform** that allows users to download, analyze, and work with music from YouTube Music. The interface is designed to be **intuitive from day one** while offering **power-user features** that can be toggled on demand.

### Core Philosophy

- **Casual-first, power-user ready**: Simple by default, detailed on toggle
- **Progressive disclosure**: Show basic info first, reveal complexity as needed
- **Real-time feedback**: Live updates, progress tracking, immediate visual response
- **Dark-mode native**: Built for extended use in low-light environments
- **Non-intrusive background tasks**: Jobs run async with minimal UI disruption

### Current Structure

```
┌─────────────────────────────────────────┐
│           Header (Title + Logo)         │
├─────────────────────────────────────────┤
│   Actions Bar (Search, Filters, CTAs)   │
├─────────────────────────────────────────┤
│                                         │
│      Library Table (Sortable Cards)     │
│      ┌────────────────────────────┐     │
│      │  Song 1  │ Status Badges   │     │
│      │  Song 2  │ Pills + Actions │     │
│      └────────────────────────────┘     │
│                                         │
├─────────────────────────────────────────┤
│      Details Panel (Tabs: Info,         │
│      Analysis, Studio)                  │
│      ┌──────────┬──────────┬─────────┐  │
│      │   Info   │ Analysis │ Studio  │  │
│      └──────────┴──────────┴─────────┘  │
└─────────────────────────────────────────┘

Overlays:
├── Jobs Panel (slide-in from bottom-right)
├── Download Modal (centered overlay)
├── Settings Modal (centered overlay)
└── Toast Notifications (top-right)
```

---

## 📚 Library Page

The **Library** is the main landing view where all downloaded/analyzed songs live.

### Components

#### **Search & Filter Bar**

- **Search input**: Real-time filter by title or artist
- **Status filter dropdown**: Filter by processing state
  - All Songs
  - Has Analysis
  - Has Stems
  - Has Lyrics
  - Has Synced Lyrics
  - Has Converted (WAV)
  - Raw Only (no processing)
- **Action buttons**: Download New Song, Settings, Refresh

#### **Song Table**

- **Sortable columns**: Click to sort by title, artist, duration, date
- **Draggable column reorder**: Drag column headers to reorder
- **Persistent column order**: Saved in LocalStorage
- **Row selection**: Click row to view details
- **Hover states**: Visual feedback on interaction

**Columns:**

- Title
- Artist
- Duration (MM:SS format)
- Download Date (relative time)
- Status (badge pills)
- Actions (View button)

#### **Status Badge Pills**

Visual indicators showing what processing has been done:

- 🎵 **WAV**: Converted to WAV format
- 📊 **Analysis**: Tempo/key/chords analyzed
- 🎸 **Stems**: 4-track separation complete
- 📝 **Lyrics**: Lyrics fetched
- 🎤 **Synced**: Timestamped synced lyrics available
- ⚠️ **Raw**: No processing yet (warning state)

**Color coding:**

- Green = Complete/Available
- Yellow = Warning/Incomplete
- Red = Error state

#### **Empty State**

When no songs in library:

- Large icon (🎵)
- Helpful message
- CTA to download first song

---

## 🎙️ Studio Tab

The **Studio** is where stems mixing and synced lyrics come together for playback and analysis.

### Layout

```
┌─────────────────────────────────────────────────┐
│              Stems Mixer (Main Area)            │
│  ┌───────────────────────────────────────────┐  │
│  │  Transport Controls  │  Playback Speed    │  │
│  │  ▶️ ⏸️ ⏹️             │  0.1x - 3.0x.      │  │
│  ├───────────────────────────────────────────┤  │
│  │  Progress Bar (clickable seek)            │  │
│  ├───────────────────────────────────────────┤  │
│  │  Stem Track 1: Vocals                     │  │
│  │    [M] [S] [Volume Slider] [Waveform]     │  │
│  │  Stem Track 2: Drums                      │  │
│  │  Stem Track 3: Bass                       │  │
│  │  Stem Track 4: Other                      │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────┐                            │
│  │ Lyrics Panel    │ (Collapsible sidebar)      │
│  │ - Auto-scroll   │                            │
│  │ - Highlighted   │                            │
│  │ - Clickable     │                            │
│  └─────────────────┘                            │
└─────────────────────────────────────────────────┘
```

### Features

#### **Stems Mixer**

- **Synchronized multi-track playback**: All stems play in perfect sync
- **Per-stem controls**:
  - **Mute (M)**: Silence individual stem
  - **Solo (S)**: Play only this stem (mutes all others)
  - **Volume slider**: 0-100% per stem
  - **Visual feedback**: Active states on buttons
- **Master transport controls**:
  - Play/Pause (▶️/⏸️)
  - Stop (⏹️)
  - Progress bar (click to seek)
  - Time display (current / total)
- **Playback speed control**: 0.1x to 3.0x (slider)
- **Real-time synchronization**: All audio elements stay locked together

**Smart Solo/Mute Logic:**

- When ANY stem is soloed, all others auto-mute
- Un-solo all → restore previous mute states
- Visual indicators show active/inactive states

#### **Lyrics Panel**

- **Collapsible sidebar**: Click header to collapse/expand (persisted in LocalStorage)
- **Synced lyrics display**: Lyrics highlight in real-time with playback
- **Auto-scroll feature**:
  - Toggleable on/off
  - Scrolls lyrics to keep active line centered
  - Configurable lookahead (0.3s default)
- **Auto-focus feature**:
  - Toggleable on/off
  - Keeps current lyric line visually emphasized
- **Click-to-seek**: Click any lyric line to jump to that timestamp
- **Manual scroll override**: Auto-scroll pauses when user manually scrolls
- **Fallback state**: Shows "No lyrics available" if none present

**Lyrics Rendering:**

- Line-by-line display
- Current line highlighted (color accent)
- Past lines dimmed
- Future lines normal opacity
- Smooth transitions between lines

#### **Fallback States**

- **No stems**: Shows message "No stems available" + CTA to separate stems
- **No lyrics**: Lyrics panel shows "No lyrics available"
- **No synced lyrics**: Falls back to plain text display

---

## 📊 Analysis Tab

Displays comprehensive music analysis results.

### Sections

#### **Tempo Detection**

- BPM (beats per minute) - large display
- Confidence score (0-100%)
- Visual metronome icon

#### **Key Detection**

- Musical key (C, D, E, F, G, A, B)
- Scale (Major/Minor)
- Confidence score
- Circle of fifths visualization (future)

#### **Chord Progression**

- **Visual chord display**: Each chord as a pill/badge
- **Timeline markers**: Shows when each chord appears
- **Scrollable**: Handles long progressions
- **Transposable**: If transpose key is set in settings

#### **Song Structure**

- **Section labels**: Verse, Chorus, Bridge, Intro, Outro
- **Timeline visualization**: Visual segments showing structure
- **Timestamps**: Click to seek (if audio player present)
- **Color-coded sections**: Different colors for different parts

**Fallback State:**

- "No analysis available. Run analysis first."
- CTA button to trigger analysis

---

## ℹ️ Info Tab

Shows song metadata and file information.

### Info Grid

Responsive grid layout with info cards:

- **Song ID**: Unique identifier (monospace font)
- **Duration**: Human-readable format
- **Video ID**: YouTube video ID
- **Channel**: Uploader/artist channel
- **Album**: Album name (if available)
- **Upload Date**: When uploaded to YouTube
- **Download Date**: When downloaded to WereCode
- **File Path**: Local file location
- **Thumbnail**: Album art preview (if available)
- **File Size**: Human-readable size
- **Format**: Audio format (M4A, MP3, WAV, etc.)
- **Sample Rate**: Audio sample rate
- **Bitrate**: Audio bitrate

**Visual Style:**

- Card-based layout
- Label (uppercase, small, gray)
- Value (larger, white, bold)
- Grid auto-fits based on screen size

---

## 🪟 Modals

### Download Modal

Triggered by "Download New Song" button.

**Fields:**

- YouTube Music URL (text input)
- Format dropdown (M4A, MP3, OPUS)
- Quality dropdown (High/320kbps, Medium/192kbps, Low/128kbps)
- Start Download button (full-width CTA)

**Behavior:**

- Opens centered overlay with backdrop blur
- Validates URL before submission
- Creates job and closes modal on submit
- Clears form after successful submission

### Settings Modal

Triggered by "Settings" button.

**Fields:**

- Downloads Directory
- Organize by Song (folder per song)
- Stems Subfolder
- Transpose To Key (chord transposition)
- Default Analysis Preset (Quick/Full/Production)

**Actions:**

- Save Settings (persists to backend config)
- Reload from Server (fetches current config)

**Behavior:**

- Centered overlay with backdrop
- Form validation
- Success/error toast on save

---

## 📋 Jobs Panel

Background job tracking system that appears as a slide-in panel.

### Features

- **Slide-in from bottom-right**: Non-intrusive placement
- **Badge counter**: Shows number of active jobs on toggle button
- **Auto-show**: Appears when new job starts
- **Auto-hide**: Hides when all jobs complete
- **2-second polling**: Real-time updates via API polling
- **Manual toggle**: Click jobs button to show/hide

### Job Display

Each job card shows:

- **Job type icon**: 📥 Download, 🔄 Convert, 🎸 Stems, 📊 Analysis
- **Job name**: Description of operation
- **Progress bar**: Visual percentage (0-100%)
- **Status message**: "Downloading...", "Complete", "Failed"
- **Timestamp**: When job started

**States:**

- Queued (waiting)
- Running (in progress, animated)
- Completed (green, success icon)
- Failed (red, error icon)

### Interaction

- Click job card → expand details
- Failed jobs → show error message
- Completed jobs → fade out after 5 seconds

---

## 🎨 Design Language

### Color Palette

**Primary:**

- Purple: `#667eea` (primary brand, CTAs)
- Deep Purple: `#764ba2` (gradients, accents)

**Background:**

- Deep Blue-Black: `#0a0e27` (page background)
- Dark Panels: `rgba(255, 255, 255, 0.03)` (cards, panels)
- Light Panels: `rgba(255, 255, 255, 0.05)` (headers)

**Text:**

- Primary: `#e0e0e0` (main text)
- Secondary: `#a0a0a0` (labels, hints)
- White: `#ffffff` (emphasis)

**Status Colors:**

- Success: `#4caf50` (green)
- Error: `#f44336` (red)
- Warning: `#ff9800` (orange)
- Info: `#667eea` (blue-purple)

**Borders:**

- Subtle: `rgba(255, 255, 255, 0.1)`
- Focus: `#667eea`

### Typography

**Font Stack:**

```css
-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif
```

**Sizes:**

- Headings: `2.5em` (h1), `1.5em` (h2), `1.1em` (h4)
- Body: `0.9em - 1em`
- Small: `0.75em - 0.8em`
- Monospace: `'Courier New', monospace` (for IDs, code)

**Weights:**

- Normal: 400
- Medium: 500
- Bold: 600

### Spacing & Layout

**Container:**

- Max-width: `1600px`
- Padding: `20px`
- Centered with `margin: 0 auto`

**Gaps:**

- Small: `10px`
- Medium: `15px`
- Large: `20px`

**Border Radius:**

- Cards: `12px`
- Buttons: `8px`
- Pills/Badges: `12px` (fully rounded)
- Modal: `15px`

### Effects & Animations

#### **Glassmorphism**

- Backdrop blur: `blur(10px)`
- Semi-transparent backgrounds: `rgba(255, 255, 255, 0.03)`
- Subtle borders: `1px solid rgba(255, 255, 255, 0.1)`

#### **Hover States**

- Transform: `translateY(-2px)` (lift effect)
- Box shadow: `0 10px 25px rgba(102, 126, 234, 0.4)`
- Transition: `all 0.3s ease`

#### **Animations**

- Slide-in: `slideDown 0.3s ease`
- Fade-in: `fadeIn 0.3s ease`
- Smooth scrolling: `scroll-behavior: smooth`

#### **Interactive Background**

- Gradient follows mouse cursor
- Smooth color transitions
- Subtle, non-distracting movement

### Buttons

**Primary Button:**

- Gradient background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- White text
- Hover: Lift + shadow

**Secondary Button:**

- Transparent with border
- Background: `rgba(255, 255, 255, 0.1)`
- Hover: Slightly brighter

**Stem Control Buttons:**

- Small, square buttons
- Mute (M): Red when active
- Solo (S): Yellow when active
- Icon-based

---

## 🌟 UX Principles

### North Star Guidelines

#### **1. Intuitive from Day One**

- **No learning curve for basics**: Download → Analyze → Play should be obvious
- **Progressive disclosure**: Advanced features hidden until needed
- **Visual feedback**: Every action has immediate visual response
- **Contextual help**: Empty states guide users on next steps

#### **2. Casual User First, Power User Ready**

- **Default simplicity**: Show essentials, hide complexity
- **Toggle-based power features**:
  - Column reordering (draggable headers)
  - Manual lyrics scroll override
  - Advanced settings in modal
  - Detailed metadata in Info tab
- **No overwhelming UI**: Clean, breathable layouts
- **Smart defaults**: Sensible presets that work for 80% of use cases

#### **3. Real-Time Feedback Loop**

- **Live updates**: Jobs panel polls every 2 seconds
- **Progress indicators**: Every async operation shows progress
- **Instant search**: Filter-as-you-type with no lag
- **Smooth animations**: Transitions feel responsive, not sluggish

#### **4. Non-Intrusive Background Tasks**

- **Jobs run silently**: Downloads/analysis don't block UI
- **Slide-in panels**: Jobs panel doesn't cover main content
- **Toast notifications**: Quick confirmations, auto-dismiss
- **Badge counters**: Glanceable status without checking panel

#### **5. Persistent State & Memory**

- **LocalStorage**: Column order, collapsed states, settings persist
- **Smart resume**: Return to last selected song
- **Session continuity**: No data loss on refresh
- **Undo-friendly**: Confirmations for destructive actions

#### **6. Accessibility & Inclusivity**

- **Keyboard shortcuts**: ESC to close modals
- **Focus management**: Clear focus indicators
- **Color contrast**: WCAG AA compliant text/background ratios
- **Screen reader friendly**: Semantic HTML structure (future)

#### **7. Performance First**

- **Lazy loading**: Heavy components load on-demand
- **Efficient rendering**: No unnecessary re-renders
- **Optimized polling**: Smart intervals for job updates
- **Minimal bundle**: Vanilla JS, no framework overhead (current)

---

## 🔄 User Flows

### Primary Flow: Download → Analyze → Play

```
1. User clicks "Download New Song"
   ↓
2. Enters YouTube Music URL + selects format/quality
   ↓
3. Clicks "Start Download"
   ↓
4. Modal closes, Jobs panel appears (badge shows "1")
   ↓
5. Download progresses (2s polling updates)
   ↓
6. Download completes → Toast notification
   ↓
7. Song appears in Library table with status badge
   ↓
8. User clicks song row → Details panel opens
   ↓
9. User clicks "Convert to WAV" (if not already)
   ↓
10. User clicks "Analyze"
    ↓
11. Jobs panel shows analysis progress
    ↓
12. Analysis completes → Status pills update
    ↓
13. User switches to "Analysis" tab → sees results
    ↓
14. User clicks "Separate Stems"
    ↓
15. Stems processing (can take 2-5 minutes)
    ↓
16. Stems complete → "Studio" tab becomes active
    ↓
17. User switches to "Studio" tab
    ↓
18. Stems mixer loads with 4 tracks
    ↓
19. User clicks Play → synced playback with lyrics
    ↓
20. User toggles mute/solo, adjusts volumes, plays with speed
```

### Secondary Flows

#### **Quick Browse & Filter**

1. User types in search box
2. Table filters in real-time
3. User selects status filter dropdown
4. Only matching songs show
5. User clicks song → views details

#### **Settings Configuration**

1. User clicks "Settings"
2. Adjusts default analysis preset
3. Sets transpose key
4. Clicks "Save Settings"
5. Toast confirms save
6. Future analyses use new settings

#### **Lyrics Interaction**

1. User opens Studio tab with synced lyrics
2. Playback starts
3. Lyrics auto-scroll and highlight
4. User clicks a lyric line
5. Playback seeks to that timestamp
6. User toggles auto-scroll off
7. Manually scrolls lyrics while music plays

---

## 📱 Responsive Design

### Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Responsive Behavior

#### **Mobile (< 768px)**

- Single-column layouts
- Hamburger menu (future)
- Full-width modals
- Stacked table → card view
- Studio side panel collapses by default
- Reduced padding/margins

#### **Tablet (768px - 1024px)**

- Two-column grid where applicable
- Studio side panel collapsible
- Table columns adjust (hide less important)

#### **Desktop (> 1024px)**

- Full multi-column layouts
- All features visible
- Optimal spacing

---

## ♿ Accessibility

### Current Features

- **Keyboard navigation**: Tab through interactive elements
- **ESC to close**: Modals close with Escape key
- **Focus indicators**: Visible focus states on buttons/inputs
- **Color contrast**: Text meets WCAG AA standards
- **Semantic HTML**: Proper heading hierarchy

### Future Improvements

- **Screen reader support**: ARIA labels and live regions
- **Keyboard shortcuts**: Global hotkeys for common actions
- **High contrast mode**: Toggle for increased contrast
- **Reduced motion**: Respect `prefers-reduced-motion`
- **Focus trap**: Modal focus management

---

## 🔧 Component Details Reference

Use these sub-notches to request deep dives:

- `#library-table-impl` - Table sorting, filtering, drag-drop logic
- `#stems-mixer-impl` - Audio sync algorithm, mute/solo state machine
- `#lyrics-sync-impl` - Timestamp matching, auto-scroll calculations
- `#jobs-polling-impl` - Polling strategy, error handling, retry logic
- `#modal-system-impl` - Modal state management, backdrop handling
- `#toast-system-impl` - Notification queue, auto-dismiss timing
- `#search-filter-impl` - Search algorithm, filter combinations
- `#badge-logic-impl` - Status pill determination logic
- `#audio-player-impl` - Synchronized multi-track playback
- `#local-storage-impl` - Persistence strategy, data structure

---

## 🚀 Future Tech Stack Migration

### Planned: React + Next.js + Vite + Tailwind

**Benefits:**

- **Component reusability**: Shared UI components
- **State management**: React Context / Zustand / Redux
- **Build optimization**: Tree shaking, code splitting, rollup visualizers
- **Type safety**: TypeScript integration
- **Modern tooling**: ESLint, Prettier, pre-commit hooks
- **Server-side rendering**: Next.js for better SEO/performance
- **Tailwind CSS**: Utility-first styling, design system
- **Deployment**: Vercel hosting with edge functions

**Migration Strategy:**

- Start with component library (atoms → molecules → organisms)
- Migrate page by page (Library → Studio → Analysis)
- Keep API contract identical
- A/B test old vs new UI before full cutover

---

## 📝 Notes for Future Development

### Keyword Notch Usage

When requesting more detail, use format:

```
"Give me details on #stems-mixer"
"Expand #ux-principles with examples"
"Deep dive into #lyrics-sync-impl"
"Less detail on #design-language, just color palette"
```

### Documentation Philosophy

- **High-level first**: Understand the "why" before the "how"
- **Feature-focused**: What it does, not how it's coded
- **Visual aids**: Diagrams, layouts, flows over paragraphs
- **Notches for drilling**: Tags for expanding specific areas
- **Living document**: Update as UI evolves

---

**End of UI Documentation**
_Use keyword notches to navigate and expand specific sections._
