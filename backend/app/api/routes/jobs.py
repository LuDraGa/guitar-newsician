"""Job status tracking endpoint routes for local downloads."""

from fastapi import APIRouter, HTTPException

from ..models.responses import JobStatusResponse
from ..services.job_manager import job_manager

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get status of a specific local download job.

    The root Next app polls this route after starting `/api/v1/download`.
    """
    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return JobStatusResponse(status=job)
