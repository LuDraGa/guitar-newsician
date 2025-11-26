# WereCode Complete Feature List

## 🎯 Overview

WereCode is a comprehensive music analysis platform with three interfaces:
1. **Web UI** - Single-page app (primary interface)
2. **Chat Client** - Natural language terminal interface
3. **REST API** - OpenAPI-compliant programmatic access

## 🌐 Web UI (http://localhost:8001)

### Core Features

#### 1. Download System
- **YouTube Music URL support**
- **Format selection**: M4A, MP3, OPUS
- **Quality levels**: High, Medium, Low
- **Real-time progress tracking**
- **Automatic metadata extraction** (title, artist, duration)

#### 2. Library Management
- **Card-based visual interface**
- **Real-time search/filter**
- **Status badges per song**:
  - 🎵 Lyrics (has/doesn't have)
  - 🎶 Synced Lyrics (timestamped)
  - 🎸 Stems (4-track separation)
  - 📊 Analysis (musical features)
  - 🎼 Stem Analysis (per-track analysis)
- **Persistent storage** (LocalStorage)
- **Bulk operations** (Clear all)

#### 3. Song Detail Modal

**Four comprehensive tabs:**

**Info Tab**
- Title, Artist, Duration
- File path and metadata
- Download/conversion history

**Analysis Tab**
- **Tempo Detection**
  - BPM (beats per minute)
  - Confidence score
- **Key Detection**
  - Musical key (C, D, E, F, G, A, B)
  - Scale (major/minor)
  - Confidence score
- **Chord Progression**
  - Full chord sequence
  - Visual chord display
  - Timeline markers
- **Song Structure**
  - Section labels (verse, chorus, bridge, etc.)
  - Timestamps for each section
  - Visual timeline

**Stems Tab**
- **4-track separation** using Demucs AI:
  - 🎤 Vocals
  - 🥁 Drums
  - 🎸 Bass
  - 🎹 Other instruments
- File paths for each stem
- Status indicators

**Lyrics Tab**
- Full lyrics display
- Synced lyrics (when available)
- Scrollable interface

#### 4. Action Buttons (Context-aware)

**Always Available:**
- 📁 **Convert to WAV**: Prepare for analysis
- 🗑️ **Delete**: Remove from library

**When Not Analyzed:**
- 📊 **Analyze**: Run full music analysis

**When Analyzed:**
- 🔄 **Re-analyze**: Run again with different settings

**When Stems Not Extracted:**
- 🎸 **Separate Stems**: Extract 4-track separation

#### 5. Jobs Panel

**Real-time tracking system:**
- **Slide-in panel** (bottom-right)
- **Job types tracked**:
  - Downloads
  - Conversions
  - Stem separations
  - Analysis operations
- **Live updates** (2-second polling)
- **Progress bars** with percentage
- **Status messages**
- **Badge counter** on toggle button
- **Auto-hide** when jobs complete

#### 6. Notifications

**Toast system:**
- Success (green)
- Error (red)
- Info (blue)
- **Auto-dismiss** (4 seconds)
- **Non-intrusive** placement (top-right)

#### 7. Interactive Background

- **Gradient follows mouse cursor**
- **Smooth animations**
- **Purple/blue color scheme**
- **Non-distracting**, subtle effect

### UX Features

- **Responsive design** (mobile-friendly)
- **Dark mode** (default)
- **Keyboard shortcuts** (Esc to close)
- **Smooth animations** throughout
- **Hover effects** on cards
- **Loading states** with spinners
- **Empty states** with helpful messaging
- **Confirmation dialogs** for destructive actions

## 💬 Chat Client (Terminal)

### Features

- **Natural language interface** via OpenAI
- **Function calling** for all API operations
- **Session history** persistence (`.werecode_session.json`)
- **Rich terminal UI**:
  - Tables for structured data
  - Panels for responses
  - Syntax highlighting
  - Spinners for loading
- **Interactive commands**:
  - `/clear` - Clear history
  - `/history` - Show conversation
  - `/jobs` - List all jobs
  - `/quit` - Exit

### Capabilities

- Download audio via natural language
- Convert formats
- Analyze music
- Separate stems
- Check job status
- Query analysis results
- Conversational workflow

## 🔌 REST API

### Endpoints

#### Download
```
POST /api/v1/download
```
- Download from YouTube Music
- Format selection (m4a, mp3, opus)
- Quality selection (high, medium, low)

#### Convert
```
POST /api/v1/convert
```
- Convert audio formats
- WAV, MP3, FLAC, AAC, OGG support
- Sample rate configuration
- Mono/stereo selection

#### Stem Separation
```
POST /api/v1/stems
```
- Demucs AI models (htdemucs, htdemucs_ft, mdx_extra)
- Select specific stems to extract
- Configurable quality (shifts parameter)

#### Analysis
```
POST /api/v1/analyze
```
- Run music analysis
- Select analyzers (tempo, key, chords, structure)
- Preset configurations (quick, full, production)
- Transpose chord progressions

```
GET /api/v1/analyze/query
```
- Query stored analysis results
- Filter by analysis type
- Retrieve specific song data

```
GET /api/v1/analyze/songs
```
- List all analyzed songs

#### Jobs
```
GET /api/v1/jobs/{job_id}
```
- Get job status and progress
- Retrieve results when complete

```
GET /api/v1/jobs
```
- List all jobs with filters

```
DELETE /api/v1/jobs/{job_id}
```
- Delete job from tracking

### OpenAPI Spec

- **Auto-generated documentation**: `/docs`
- **OpenAPI schema**: `/openapi.json`
- **Swagger UI**: Interactive testing
- **Request/response examples**
- **Full type validation** (Pydantic)

## 🔧 Technical Stack

### Backend
- **FastAPI** - Modern async web framework
- **Pydantic** - Data validation
- **yt-dlp** - YouTube audio extraction
- **Demucs** - AI stem separation
- **Essentia** - Music analysis
- **MSAF** - Structure segmentation
- **pydub** - Audio format conversion

### Frontend
- **Vanilla JS** - No framework dependencies
- **Canvas API** - Interactive background
- **LocalStorage** - Client-side persistence
- **Fetch API** - REST client
- **CSS3** - Modern styling

### Chat
- **OpenAI API** - Function calling
- **Rich** - Terminal UI
- **httpx** - Async HTTP client

## 📦 Data Flow

### Download → Analyze → Extract Workflow

```
1. User pastes YouTube URL
   ↓
2. Download job created (m4a/mp3/opus)
   ↓
3. Audio saved to /downloads/
   ↓
4. Optional: Convert to WAV (/outputs/converted/)
   ↓
5. Run Analysis (tempo, key, chords, structure)
   ↓
6. Results stored in memory + displayed
   ↓
7. Optional: Separate stems (/outputs/stems/)
   ↓
8. 4 tracks available (vocals, drums, bass, other)
   ↓
9. Optional: Analyze individual stems
```

### Data Persistence

- **Frontend**: LocalStorage for song library
- **Backend**: In-memory for active jobs
- **Files**: File system for audio/stems/analysis

## 🎛️ Configuration

All configurable via `.env`:

```bash
# API
API_PORT=8001
API_HOST=0.0.0.0

# OpenAI
OPENAI_API_KEY=your_key

# Analysis
TRANSPOSE_TO_KEY=C

# Paths
DOWNLOADS_DIR=downloads
OUTPUTS_DIR=outputs
STEMS_DIR=outputs/stems
CONVERTED_DIR=outputs/converted
```

## 🚀 Performance

- **Async operations** for non-blocking I/O
- **Job queue system** for parallel processing
- **2-second polling** for real-time updates
- **Lazy loading** of heavy dependencies
- **Efficient canvas rendering** (RAF)
- **Minimal bundle** (no external JS libs)

## 🔐 Security

- **CORS enabled** for cross-origin access
- **Input validation** via Pydantic
- **Error handling** throughout
- **No credential storage** in frontend
- **.env excluded** from git

## 📱 Browser Support

- **Modern browsers** (Chrome, Firefox, Safari, Edge)
- **ES6+ JavaScript**
- **CSS Grid** and **Flexbox**
- **Canvas API**
- **LocalStorage API**

## 🎯 Future Enhancements

Potential additions:
- Batch operations (analyze multiple songs)
- Export analysis to JSON/CSV
- Playlist support
- Audio playback in browser
- Lyrics sync editor
- Redis job queue for distributed processing
- WebSocket for real-time updates
- User authentication
- Cloud storage integration
- Mobile app

## 📚 Documentation

- **README.md**: Project overview
- **QUICKSTART.md**: Fast setup guide
- **FEATURES.md**: This file (complete feature list)
- **API Docs**: http://localhost:8001/docs (when running)
- **OpenAPI Schema**: http://localhost:8001/openapi.json

## 🎵 Enjoy WereCode!

Three ways to interact:
1. **Web UI** - Visual, intuitive, real-time
2. **Chat** - Conversational, natural language
3. **API** - Programmatic, automation-friendly

Pick your preference and start analyzing music! 🎸
