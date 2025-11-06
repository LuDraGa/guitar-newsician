"""Job status tracking endpoint routes."""

from typing import Optional
from fastapi import APIRouter, HTTPException
from ..models.responses import JobStatusResponse
from ..models.jobs import JobType, JobState
from ..services.job_manager import job_manager

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get status of a specific job.

    Returns detailed status including progress, state, and result data.
    """
    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return JobStatusResponse(status=job)


@router.get("")
async def list_jobs(
    job_type: Optional[JobType] = None,
    state: Optional[JobState] = None,
):
    """
    List all jobs with optional filters.

    Filter by job type (download, convert, stem_separation, analysis)
    and/or state (queued, running, completed, failed, cancelled).
    """
    jobs = job_manager.list_jobs(job_type=job_type, state=state)

    return {
        "jobs": [job.model_dump() for job in jobs],
        "count": len(jobs),
    }


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job from tracking."""
    deleted = job_manager.delete_job(job_id)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return {"message": f"Job {job_id} deleted successfully"}
