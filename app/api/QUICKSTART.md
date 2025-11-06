# WereCode API Quick Start Guide

## 🚀 Get Started in 4 Steps

### 1. Configure Environment

```bash
# Copy the example .env file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=your_api_key_here
```

### 2. Install Dependencies

```bash
# Install all required packages using uv
uv sync
```

### 3. Start the API Server

```bash
# Option A: Use the startup script (recommended)
./app/api/start_server.sh

# Option B: Run directly from project root
python run_api.py

# Option C: Use uvicorn directly
uvicorn app.api.main:app --reload
```

The server will start at **http://localhost:8001**

**Available at:**
- **Web UI**: http://localhost:8001 (Main interface)
- API Base: http://localhost:8001/api/v1
- Interactive Docs: http://localhost:8001/docs
- OpenAPI Schema: http://localhost:8001/openapi.json

### 4. Choose Your Interface

**Option A: Web UI (Recommended)**
- Just open http://localhost:8001 in your browser
- Beautiful single-page app with all features
- Real-time job tracking
- Interactive controls

**Option B: Chat Interface**
```bash
# Use the startup script (checks .env automatically)
./app/api/start_chat.sh

# Or run directly from project root
python run_chat.py
```

## 🎨 Web UI Features

The single-page web interface includes:

### Download & Library
- **URL Input**: Paste YouTube Music URLs with format/quality selectors
- **Search**: Real-time filter across your library
- **Song Cards**: Visual library with status badges for each feature
  - Lyrics (available/unavailable)
  - Synced Lyrics (timestamped)
  - Stems (separated tracks)
  - Analysis (tempo/key/chords/structure)
  - Stem Analysis (per-stem analysis)

### Song Details Modal
Click any song to see:
- **Info Tab**: Title, artist, duration, file path
- **Analysis Tab**: BPM, musical key, chord progression, song structure timeline
- **Stems Tab**: Available stems (vocals, drums, bass, other)
- **Lyrics Tab**: Song lyrics if available

### Action Buttons (per song)
- **📁 Convert to WAV**: Convert any format to WAV for analysis
- **📊 Analyze**: Run full music analysis (tempo, key, chords, structure)
- **🎸 Separate Stems**: Extract individual tracks using Demucs AI
- **🔄 Re-analyze**: Run analysis again with different settings
- **🗑️ Delete**: Remove song from library

### Jobs Panel
- **Real-time tracking**: Monitor all running operations
- **Progress bars**: See completion percentage
- **Notifications**: Toast alerts for job updates
- **Badge counter**: Shows number of active jobs

### Keyboard Shortcuts
- `Esc`: Close modals and panels
- Mouse follow: Interactive gradient background

## 💬 Chat Examples

Once the chat client is running, try these:

```
You: Download audio from https://music.youtube.com/watch?v=abc123

You: Convert song.m4a to WAV format

You: Analyze tempo and key of mysong.wav

You: Separate vocals from track.wav

You: What's the status of job_abc123?

You: Show me all my analyzed songs
```

## 🔧 Chat Commands

- `/clear` - Clear session history
- `/history` - Show conversation history
- `/jobs` - List all jobs
- `/quit` or `/exit` - Exit

## 📡 Direct API Usage (cURL)

### Download Audio
```bash
curl -X POST "http://localhost:8000/api/v1/download" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://music.youtube.com/watch?v=abc123", "format": "m4a"}'
```

### Check Job Status
```bash
curl "http://localhost:8000/api/v1/jobs/job_abc123"
```

### Convert Audio
```bash
curl -X POST "http://localhost:8000/api/v1/convert" \
  -H "Content-Type: application/json" \
  -d '{"input_path": "/downloads/song.m4a", "output_format": "wav"}'
```

### Analyze Audio
```bash
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"input_path": "/outputs/song.wav", "analyzers": ["tempo", "key"]}'
```

### Separate Stems
```bash
curl -X POST "http://localhost:8000/api/v1/stems" \
  -H "Content-Type: application/json" \
  -d '{"input_path": "/downloads/song.wav", "model": "htdemucs"}'
```

## 📁 File Structure

```
app/api/
├── main.py                   # FastAPI server
├── chat_client.py            # Rich CLI chat interface
├── openai_tools.json         # OpenAI function definitions
├── start_server.sh           # Server startup script
├── start_chat.sh             # Chat startup script
├── README.md                 # Full documentation
├── QUICKSTART.md            # This file
├── models/                   # Pydantic models
│   ├── requests.py
│   ├── responses.py
│   └── jobs.py
├── routes/                   # API endpoints
│   ├── download.py
│   ├── convert.py
│   ├── stems.py
│   ├── analyze.py
│   └── jobs.py
└── services/                 # Business logic
    ├── job_manager.py
    ├── download_service.py
    ├── convert_service.py
    ├── stem_service.py
    └── analysis_service.py
```

## 🔑 Features

### Available Tools (via API or Chat)

1. **Download** - Extract audio from YouTube Music URLs
2. **Convert** - Transform between formats (WAV, MP3, FLAC, AAC, OGG)
3. **Separate Stems** - Split into vocals, drums, bass, other (using Demucs)
4. **Analyze** - Detect tempo, key, chords, song structure
5. **Track Jobs** - Real-time status and progress monitoring
6. **Query Results** - Retrieve and filter analysis data

### Job States

- `queued` - Waiting to start
- `running` - Currently executing
- `completed` - Finished successfully
- `failed` - Encountered error
- `cancelled` - User cancelled

### Analysis Types

- **Tempo** - BPM and beat positions
- **Key** - Musical key and scale
- **Chords** - Chord progression and timeline
- **Structure** - Verse/chorus/bridge sections

## 🎯 Complete Workflow Example

```bash
# 1. Start server (terminal 1)
./app/api/start_server.sh

# 2. Start chat (terminal 2)
export OPENAI_API_KEY=sk-...
./app/api/start_chat.sh

# 3. Chat with the assistant
You: Download https://music.youtube.com/watch?v=abc123
Assistant: [Creates download job and shows job_id]

You: What's the status of job_xyz?
Assistant: [Shows progress: 75% complete...]

# Wait for completion...

You: Convert the downloaded file to WAV
Assistant: [Creates conversion job]

You: Analyze the WAV file for tempo and key
Assistant: [Runs analysis and shows results]

You: Transpose the chords to C major
Assistant: [Re-analyzes with transposition]
```

## 🐛 Troubleshooting

### Server won't start
- Check if port 8000 is available: `lsof -i :8000`
- Ensure dependencies installed: `uv sync`
- Check Python version: `python --version` (needs 3.12+)

### Chat client errors
- Verify `OPENAI_API_KEY` is set: `echo $OPENAI_API_KEY`
- Ensure API server is running: `curl http://localhost:8000/health`
- Check dependencies: `python -c "import openai"`

### Jobs stuck in "running"
- Check server logs for errors
- Verify input file paths exist
- Ensure ffmpeg is installed (for conversion)
- Check Demucs models downloaded (for stems)

### Analysis fails
- Input MUST be WAV format
- Convert other formats first
- Verify file is valid audio: `ffmpeg -i file.wav`

## 📚 Learn More

- **Full API Docs**: http://localhost:8000/docs (when server running)
- **Detailed README**: [app/api/README.md](README.md)
- **Execution Docs**: [execution_docs/2025-11-04_openapi-rest-api.md](../../execution_docs/2025-11-04_openapi-rest-api.md)
- **Project Docs**: [docs/](../../docs/)

## 🎉 You're Ready!

Start exploring music analysis with natural language commands! 🎵
