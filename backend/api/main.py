"""FastAPI server for WereCode music analysis API."""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .routes import (
    download_router,
    convert_router,
    stems_router,
    analyze_router,
    jobs_router,
    config_router,
    library_router,
    lyrics_router,
)

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    print("🎵 WereCode API starting up...")
    yield
    # Shutdown
    print("🎵 WereCode API shutting down...")


app = FastAPI(
    title="WereCode Music Analysis API",
    description="""
    **WereCode** - Comprehensive music analysis API for downloading, converting,
    and analyzing audio from YouTube/YouTube Music.

    ## Features

    - **Download**: Extract audio from YouTube Music URLs
    - **Convert**: Transform audio between formats (WAV, MP3, FLAC, etc.)
    - **Stem Separation**: Split audio into vocals, drums, bass, and other
    - **Analysis**: Tempo, key, chords, and structure detection
    - **Job Tracking**: Async job processing with real-time status updates

    ## Workflow

    1. Download audio using `/download`
    2. Convert to WAV using `/convert`
    3. Optionally separate stems using `/stems`
    4. Analyze audio using `/analyze`
    5. Query results using `/analyze/query`
    6. Track all operations using `/jobs/{job_id}`
    """,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(download_router, prefix="/api/v1")
app.include_router(convert_router, prefix="/api/v1")
app.include_router(stems_router, prefix="/api/v1")
app.include_router(analyze_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(config_router, prefix="/api/v1")
app.include_router(library_router, prefix="/api/v1")
app.include_router(lyrics_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Serve the UI."""
    static_path = Path(__file__).parent / "static" / "index.html"
    if static_path.exists():
        return FileResponse(static_path)
    return {
        "name": "WereCode Music Analysis API",
        "version": "0.1.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }

@app.get("/api")
async def api_root():
    """API information."""
    return {
        "name": "WereCode Music Analysis API",
        "version": "0.1.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "werecode-api"}
