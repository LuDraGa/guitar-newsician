"""Job state management models."""

from enum import Enum
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class JobType(str, Enum):
    """Types of jobs supported by the API."""

    DOWNLOAD = "download"
    CONVERT = "convert"
    STEM_SEPARATION = "stem_separation"
    ANALYSIS = "analysis"


class JobState(str, Enum):
    """Job execution states."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobStatus(BaseModel):
    """Comprehensive job status tracking."""

    job_id: str = Field(..., description="Unique job identifier")
    job_type: JobType = Field(..., description="Type of job")
    state: JobState = Field(..., description="Current job state")
    progress: float = Field(0.0, ge=0.0, le=100.0, description="Progress percentage")
    message: Optional[str] = Field(None, description="Status message")
    error: Optional[str] = Field(None, description="Error message if failed")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict, description="Job-specific metadata")
    result: Optional[dict[str, Any]] = Field(None, description="Job result data")

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "job_abc123",
                "job_type": "download",
                "state": "completed",
                "progress": 100.0,
                "message": "Download completed successfully",
                "error": None,
                "created_at": "2025-11-04T12:00:00Z",
                "updated_at": "2025-11-04T12:05:00Z",
                "completed_at": "2025-11-04T12:05:00Z",
                "metadata": {"url": "https://music.youtube.com/watch?v=abc123"},
                "result": {"file_path": "/downloads/song.m4a", "title": "Song Name"},
            }
        }
