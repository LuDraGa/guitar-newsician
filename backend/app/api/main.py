"""Local-only FastAPI server for WereCode YouTube downloads."""

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import download_router, jobs_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    print("🎵 WereCode local download API starting up...")
    yield
    print("🎵 WereCode local download API shutting down...")


app = FastAPI(
    title="WereCode Local YouTube Download API",
    description="""
    Local development backend used only by the root Next app when
    `NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true`.

    Production analysis, stems, lyrics alignment, and MIDI transcription run
    through Modal and are orchestrated by Next route handlers.
    """,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(download_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")


@app.get("/")
async def root():
    """API information."""
    return {
        "name": "WereCode Local YouTube Download API",
        "version": "0.1.0",
        "scope": "local_youtube_download_only",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "endpoints": [
            "POST /api/v1/download",
            "GET /api/v1/download/diagnostics",
            "GET /api/v1/jobs/{job_id}",
        ],
    }


@app.get("/api")
async def api_root():
    """API information."""
    return await root()


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "werecode-local-download-api"}
