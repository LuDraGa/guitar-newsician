# OpenAPI REST API Implementation

**Date**: 2025-11-04
**Status**: ✅ Completed

## Objective

Create a comprehensive REST API for WereCode with OpenAPI specification and OpenAI-compatible tool definitions.

## API Endpoints

### 1. Download (`POST /api/v1/download`)
- Accept YouTube Music URL
- Return job ID for tracking
- Async download with status updates

### 2. Convert (`POST /api/v1/convert`)
- Convert audio to various formats (wav, mp3, flac, etc.)
- Support batch conversion
- Return job ID

### 3. Status (`GET /api/v1/jobs/{job_id}`)
- Track status of downloads, conversions, analyses
- Return progress percentage and current state
- Include error messages if failed

### 4. Stem Separation (`POST /api/v1/stems`)
- Split audio into stems using Demucs
- Configurable stem types (vocals, drums, bass, other)
- Return job ID

### 5. Run Analysis (`POST /api/v1/analyze`)
- Execute analysis pipeline (tempo, key, chords, structure)
- Support preset configurations
- Return job ID and analysis results

### 6. Query Analysis (`GET /api/v1/analysis/{song_id}`)
- Retrieve stored analysis results
- Filter by analysis type
- Natural language query support

## Technology Stack

- **Framework**: FastAPI (async, OpenAPI auto-generation)
- **Validation**: Pydantic models
- **Job Queue**: asyncio + in-memory (or Redis for production)
- **OpenAI Tools**: Function calling compatible definitions

## File Structure

```
app/api/
├── __init__.py
├── main.py                 # FastAPI app
├── routes/
│   ├── __init__.py
│   ├── download.py         # Download endpoints
│   ├── convert.py          # Conversion endpoints
│   ├── stems.py            # Stem separation endpoints
│   ├── analyze.py          # Analysis endpoints
│   └── jobs.py             # Job status tracking
├── models/
│   ├── __init__.py
│   ├── requests.py         # Request models
│   ├── responses.py        # Response models
│   └── jobs.py             # Job state models
├── services/
│   ├── __init__.py
│   ├── job_manager.py      # Job tracking service
│   ├── download_service.py
│   ├── convert_service.py
│   ├── stem_service.py
│   └── analysis_service.py
└── openai_tools.json       # OpenAI function definitions
```

## Tasks Checklist

- [x] Create execution documentation
- [x] Design OpenAPI specification
- [x] Create API server structure
- [x] Implement download endpoint
- [x] Implement convert endpoint
- [x] Implement status tracking endpoint
- [x] Implement stem separation endpoint
- [x] Implement analysis execution endpoint
- [x] Implement analysis query endpoint
- [x] Add OpenAI-compatible tool definitions
- [x] Create Rich-based CLI chat interface
- [x] Add session history management
- [x] Update dependencies in pyproject.toml
- [x] Create comprehensive documentation

## Implementation Summary

### Completed Components

1. **FastAPI Server** (`app/api/main.py`)
   - Full OpenAPI auto-documentation
   - CORS middleware configured
   - All endpoints registered
   - Health check endpoint

2. **Pydantic Models** (`app/api/models/`)
   - Request models for all operations
   - Response models with examples
   - Job state management models
   - Full validation and type safety

3. **API Routes** (`app/api/routes/`)
   - Download route with async job creation
   - Convert route with format support
   - Stem separation route with Demucs integration
   - Analysis route with preset support
   - Jobs route with filtering and status tracking

4. **Service Layer** (`app/api/services/`)
   - JobManager for state tracking
   - DownloadService using yt-dlp
   - ConvertService using pydub
   - StemService using Demucs
   - AnalysisService with caching

5. **Chat Client** (`app/api/chat_client.py`)
   - Rich terminal UI with panels and tables
   - OpenAI integration with function calling
   - Session history persistence
   - Interactive commands (/clear, /history, /jobs, etc.)
   - Real-time job status display

6. **OpenAI Tools** (`app/api/openai_tools.json`)
   - 7 function definitions
   - Compatible with OpenAI API
   - Complete parameter schemas
   - Description and examples

7. **Documentation** (`app/api/README.md`)
   - Installation instructions
   - Usage examples (CLI and API)
   - Complete endpoint reference
   - Troubleshooting guide
   - Python workflow example

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# 2. Install dependencies
uv sync

# 3. Start API server
python run_api.py
# Or: ./app/api/start_server.sh

# 4. In another terminal, start chat client
python run_chat.py
# Or: ./app/api/start_chat.sh
```

## API Endpoints

- `POST /api/v1/download` - Download from YouTube Music
- `POST /api/v1/convert` - Convert audio formats
- `POST /api/v1/stems` - Separate into stems
- `POST /api/v1/analyze` - Run music analysis
- `GET /api/v1/analyze/query` - Query analysis results
- `GET /api/v1/analyze/songs` - List analyzed songs
- `GET /api/v1/jobs/{job_id}` - Get job status
- `GET /api/v1/jobs` - List all jobs
- `DELETE /api/v1/jobs/{job_id}` - Delete job

## Environment Configuration

Created `.env` and `.env.example` files with configuration for:
- OpenAI API key
- API server settings (host, port, reload)
- File paths (downloads, outputs, stems, converted)
- Job configuration (timeout, concurrency)
- Logging settings

All services now use environment variables with sensible defaults.

## Notes

- ✅ Uses existing downloaders, converters, analyzers as service layer
- ✅ Maintains async/await pattern throughout
- ✅ Proper error handling and validation
- ✅ OpenAI tools JSON compatible with GPT-4 function calling
- ✅ Session history persisted to `.werecode_session.json`
- ✅ Job states: queued, running, completed, failed, cancelled
- ✅ Environment-based configuration via .env file
- ✅ Startup scripts for easy server/chat launch
- ✅ .gitignore updated to exclude .env, logs, outputs
- ⚠️ Future: Add rate limiting for production use
- ⚠️ Future: Consider Redis for distributed job queue
