"""Response models for local download endpoints."""

from pydantic import BaseModel, Field

from .jobs import JobStatus


class JobResponse(BaseModel):
    """Response for local job creation."""

    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Initial job status")
    message: str = Field(..., description="Human-readable message")


class JobStatusResponse(BaseModel):
    """Detailed local job status response."""

    status: JobStatus
