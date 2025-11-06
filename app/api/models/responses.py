"""Response models for API endpoints."""

from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
from .jobs import JobStatus


class JobResponse(BaseModel):
    """Response for job creation."""

    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Initial job status")
    message: str = Field(..., description="Human-readable message")

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "job_abc123",
                "status": "queued",
                "message": "Download job created successfully",
            }
        }


class JobStatusResponse(BaseModel):
    """Detailed job status response."""

    status: JobStatus

    class Config:
        json_schema_extra = {
            "example": {
                "status": {
                    "job_id": "job_abc123",
                    "job_type": "download",
                    "state": "running",
                    "progress": 45.5,
                    "message": "Downloading audio...",
                    "error": None,
                    "created_at": "2025-11-04T12:00:00Z",
                    "updated_at": "2025-11-04T12:02:00Z",
                    "completed_at": None,
                    "metadata": {"url": "https://music.youtube.com/watch?v=abc123"},
                    "result": None,
                }
            }
        }


class DownloadResponse(BaseModel):
    """Response for completed download."""

    file_path: str = Field(..., description="Path to downloaded file")
    title: str = Field(..., description="Song title")
    artist: Optional[str] = Field(None, description="Artist name")
    duration: Optional[float] = Field(None, description="Duration in seconds")
    file_size: int = Field(..., description="File size in bytes")

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "/downloads/song.m4a",
                "title": "Never Gonna Give You Up",
                "artist": "Rick Astley",
                "duration": 213.0,
                "file_size": 5242880,
            }
        }


class ConvertResponse(BaseModel):
    """Response for completed conversion."""

    input_path: str = Field(..., description="Original file path")
    output_path: str = Field(..., description="Converted file path")
    output_format: str = Field(..., description="Output format")
    file_size: int = Field(..., description="Output file size in bytes")

    class Config:
        json_schema_extra = {
            "example": {
                "input_path": "/downloads/song.m4a",
                "output_path": "/outputs/converted/song.wav",
                "output_format": "wav",
                "file_size": 10485760,
            }
        }


class StemResponse(BaseModel):
    """Response for completed stem separation."""

    input_path: str = Field(..., description="Original file path")
    stems: dict[str, str] = Field(..., description="Map of stem type to file path")
    model: str = Field(..., description="Demucs model used")

    class Config:
        json_schema_extra = {
            "example": {
                "input_path": "/downloads/song.wav",
                "stems": {
                    "vocals": "/outputs/stems/song/vocals.wav",
                    "drums": "/outputs/stems/song/drums.wav",
                    "bass": "/outputs/stems/song/bass.wav",
                    "other": "/outputs/stems/song/other.wav",
                },
                "model": "htdemucs",
            }
        }


class AnalysisResponse(BaseModel):
    """Response for completed analysis."""

    song_id: str = Field(..., description="Song identifier")
    file_path: str = Field(..., description="Analyzed file path")
    analyses: dict[str, Any] = Field(..., description="Analysis results by type")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "song_id": "song_abc123",
                "file_path": "/outputs/converted/song.wav",
                "analyses": {
                    "tempo": {"bpm": 120.5, "confidence": 0.95},
                    "key": {"key": "C", "scale": "major", "confidence": 0.88},
                    "chords": {
                        "progression": ["C", "Am", "F", "G"],
                        "timeline": [0.0, 2.0, 4.0, 6.0],
                    },
                },
                "timestamp": "2025-11-04T12:10:00Z",
            }
        }
