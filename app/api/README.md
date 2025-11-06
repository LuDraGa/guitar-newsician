# WereCode API

OpenAPI-compliant REST API for music analysis with OpenAI-powered chat interface.

## Overview

WereCode API provides a comprehensive set of endpoints for:
- **Downloading** audio from YouTube Music
- **Converting** audio between formats
- **Separating** audio into stems (vocals, drums, bass, other)
- **Analyzing** music (tempo, key, chords, structure)
- **Tracking** job status for async operations
- **Querying** stored analysis results

## Architecture

```
app/api/
├── main.py                 # FastAPI application
├── chat_client.py          # Rich-based CLI chat interface
├── openai_tools.json       # OpenAI function definitions
├── models/                 # Pydantic models
│   ├── requests.py         # Request schemas
│   ├── responses.py        # Response schemas
│   └── jobs.py             # Job state models
├── routes/                 # API endpoints
│   ├── download.py         # Download routes
│   ├── convert.py          # Convert routes
│   ├── stems.py            # Stem separation routes
│   ├── analyze.py          # Analysis routes
│   └── jobs.py             # Job tracking routes
└── services/               # Business logic
    ├── job_manager.py      # Job state management
    ├── download_service.py # Download implementation
    ├── convert_service.py  # Conversion implementation
    ├── stem_service.py     # Stem separation implementation
    └── analysis_service.py # Analysis implementation
```

## Installation

```bash
# 1. Configure environment variables
cp .env.example .env
# Edit .env and add your OpenAI API key

# 2. Install dependencies
uv sync

# 3. Activate environment
source .venv/bin/activate
```

## Usage

### 1. Start the API Server

```bash
# Option A: Use the startup script (recommended)
./app/api/start_server.sh

# Option B: Run from project root
python run_api.py

# Option C: Using uvicorn directly
uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base**: http://localhost:8000/api/v1
- **Interactive Docs**: http://localhost:8000/docs
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### 2. Use the Chat Interface

```bash
# Option A: Use the startup script (recommended)
./app/api/start_chat.sh

# Option B: Run from project root
python run_chat.py

# Option C: With custom API URL
python run_chat.py --api-url http://localhost:8000/api/v1
```

**Chat Interface Features:**
- Natural language interaction powered by OpenAI
- Automatic tool calling for WereCode operations
- Persistent session history (saved to `.werecode_session.json`)
- Rich terminal UI with tables, panels, and syntax highlighting
- Real-time job status tracking

**Chat Commands:**
- `/clear` - Clear session history
- `/history` - Show session history
- `/jobs` - List all jobs
- `/quit` or `/exit` - Exit the chat

**Example Conversations:**

```
You: Download audio from https://music.youtube.com/watch?v=abc123
Assistant: [Downloads audio and returns job ID]

You: What's the status of job_abc123?
Assistant: [Shows job status with progress]

You: Convert downloaded_song.m4a to WAV
Assistant: [Converts and returns result]

You: Analyze the tempo and key of converted_song.wav
Assistant: [Runs analysis and shows results]

You: Separate vocals from song.wav
Assistant: [Separates stems using Demucs]
```

### 3. Direct API Usage

#### Download Audio

```bash
curl -X POST "http://localhost:8000/api/v1/download" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "format": "m4a",
    "quality": "high"
  }'
```

Response:
```json
{
  "job_id": "job_abc123",
  "status": "queued",
  "message": "Download job created successfully"
}
```

#### Convert Audio

```bash
curl -X POST "http://localhost:8000/api/v1/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "input_path": "/downloads/song.m4a",
    "output_format": "wav",
    "sample_rate": 44100,
    "channels": 2
  }'
```

#### Separate Stems

```bash
curl -X POST "http://localhost:8000/api/v1/stems" \
  -H "Content-Type: application/json" \
  -d '{
    "input_path": "/downloads/song.wav",
    "model": "htdemucs",
    "stems": ["vocals", "drums", "bass", "other"]
  }'
```

#### Analyze Audio

```bash
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "input_path": "/outputs/converted/song.wav",
    "analyzers": ["tempo", "key", "chords", "structure"],
    "preset": "full",
    "transpose_to": "C"
  }'
```

#### Check Job Status

```bash
curl "http://localhost:8000/api/v1/jobs/job_abc123"
```

Response:
```json
{
  "status": {
    "job_id": "job_abc123",
    "job_type": "download",
    "state": "completed",
    "progress": 100.0,
    "message": "Download completed",
    "error": null,
    "created_at": "2025-11-04T12:00:00Z",
    "updated_at": "2025-11-04T12:05:00Z",
    "completed_at": "2025-11-04T12:05:00Z",
    "metadata": {"url": "https://music.youtube.com/watch?v=abc123"},
    "result": {
      "file_path": "/downloads/song.m4a",
      "title": "Song Name",
      "artist": "Artist Name",
      "duration": 213.0,
      "file_size": 5242880
    }
  }
}
```

#### Query Analysis Results

```bash
# Get all analyses for a song
curl "http://localhost:8000/api/v1/analyze/query?song_id=song_abc123"

# Get specific analysis types
curl "http://localhost:8000/api/v1/analyze/query?song_id=song_abc123&analysis_types=tempo,key"

# List all analyzed songs
curl "http://localhost:8000/api/v1/analyze/songs"
```

## API Endpoints

### Download
- `POST /api/v1/download` - Download audio from YouTube Music

### Convert
- `POST /api/v1/convert` - Convert audio to different format

### Stems
- `POST /api/v1/stems` - Separate audio into stems

### Analyze
- `POST /api/v1/analyze` - Analyze audio file
- `GET /api/v1/analyze/query` - Query analysis results
- `GET /api/v1/analyze/songs` - List analyzed songs

### Jobs
- `GET /api/v1/jobs/{job_id}` - Get job status
- `GET /api/v1/jobs` - List all jobs (with optional filters)
- `DELETE /api/v1/jobs/{job_id}` - Delete a job

## OpenAI Tools Integration

The `openai_tools.json` file contains OpenAI-compatible function definitions for:
- `download_audio` - Download from YouTube Music
- `convert_audio` - Convert audio formats
- `separate_stems` - Separate into stems
- `analyze_audio` - Run music analysis
- `get_job_status` - Check job status
- `query_analysis` - Query stored results
- `list_analyzed_songs` - List all analyzed songs

These can be used with OpenAI's function calling API or other compatible LLM APIs.

## Session History

The chat client maintains session history in `.werecode_session.json`:
- Persists across sessions
- Includes all messages and tool calls
- Can be cleared with `/clear` command
- Automatically saved after each interaction

## Job States

Jobs can be in the following states:
- `queued` - Job created, waiting to start
- `running` - Job currently executing
- `completed` - Job finished successfully
- `failed` - Job encountered an error
- `cancelled` - Job was cancelled

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `404` - Resource not found
- `422` - Validation error
- `500` - Internal server error

Error responses include detailed messages:
```json
{
  "detail": "Error message here"
}
```

## Development

### Running Tests

```bash
# Install dev dependencies (when available)
uv sync --group dev

# Run tests
pytest
```

### Viewing API Documentation

Visit http://localhost:8000/docs for interactive Swagger UI documentation.

### Extending the API

1. **Add new endpoint**: Create route in `app/api/routes/`
2. **Add request/response models**: Update `app/api/models/`
3. **Add service logic**: Implement in `app/api/services/`
4. **Add OpenAI tool**: Update `openai_tools.json`
5. **Register route**: Include in `app/api/main.py`

## Configuration

### Environment Variables (.env file)

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# OpenAI API Key (required for chat client)
OPENAI_API_KEY=your_openai_api_key_here

# API Server Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true

# Analysis Configuration
TRANSPOSE_TO_KEY=C

# File Paths
DOWNLOADS_DIR=downloads
OUTPUTS_DIR=outputs
STEMS_DIR=outputs/stems
CONVERTED_DIR=outputs/converted

# Job Configuration
JOB_TIMEOUT_SECONDS=3600
MAX_CONCURRENT_JOBS=5

# Logging
LOG_LEVEL=INFO
LOG_FILE=werecode.log
```

**Key Variables:**
- `OPENAI_API_KEY` - Required for chat client
- `API_HOST`, `API_PORT` - Server host and port
- `TRANSPOSE_TO_KEY` - Default transposition key for chord analysis
- `DOWNLOADS_DIR`, `OUTPUTS_DIR` - Default file paths
- `LOG_LEVEL` - Logging verbosity (DEBUG, INFO, WARNING, ERROR)

### API Configuration

Additional CORS settings can be configured in `app/api/main.py`

## Examples

### Complete Workflow

```python
import httpx

client = httpx.Client(base_url="http://localhost:8000/api/v1")

# 1. Download
response = client.post("/download", json={
    "url": "https://music.youtube.com/watch?v=abc123",
    "format": "m4a"
})
download_job_id = response.json()["job_id"]

# 2. Wait for download (poll status)
import time
while True:
    status = client.get(f"/jobs/{download_job_id}").json()
    if status["status"]["state"] == "completed":
        file_path = status["status"]["result"]["file_path"]
        break
    time.sleep(1)

# 3. Convert to WAV
response = client.post("/convert", json={
    "input_path": file_path,
    "output_format": "wav"
})
convert_job_id = response.json()["job_id"]

# 4. Wait for conversion
while True:
    status = client.get(f"/jobs/{convert_job_id}").json()
    if status["status"]["state"] == "completed":
        wav_path = status["status"]["result"]["output_path"]
        break
    time.sleep(1)

# 5. Analyze
response = client.post("/analyze", json={
    "input_path": wav_path,
    "analyzers": ["tempo", "key", "chords"],
    "preset": "full"
})
analysis_job_id = response.json()["job_id"]

# 6. Get results
while True:
    status = client.get(f"/jobs/{analysis_job_id}").json()
    if status["status"]["state"] == "completed":
        analysis = status["status"]["result"]["analyses"]
        print(f"Tempo: {analysis['tempo']['bpm']} BPM")
        print(f"Key: {analysis['key']['key']} {analysis['key']['scale']}")
        print(f"Chords: {analysis['chords']['progression']}")
        break
    time.sleep(1)
```

## Troubleshooting

### Chat client not starting
- Check `OPENAI_API_KEY` is set
- Ensure API server is running
- Verify correct API URL

### Jobs stuck in "running" state
- Check server logs for errors
- Ensure dependencies (yt-dlp, demucs, essentia) are installed
- Verify input file paths exist

### Analysis fails
- Input must be WAV format for analysis
- Convert other formats first
- Check audio file is valid

## License

See main WereCode LICENSE file.

## Contributing

See main WereCode CONTRIBUTING guidelines.