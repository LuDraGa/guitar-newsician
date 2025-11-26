"""Stem separation endpoint routes."""

from fastapi import APIRouter, BackgroundTasks
from ..models.requests import StemSeparationRequest
from ..models.responses import JobResponse
from ..models.jobs import JobType
from ..services.job_manager import job_manager
from ..services.stem_service import StemService

router = APIRouter(prefix="/stems", tags=["stems"])
stem_service = StemService()


@router.post("", response_model=JobResponse)
async def separate_stems(request: StemSeparationRequest, background_tasks: BackgroundTasks):
    """
    Separate audio into stems using Demucs.

    Creates an async job to split audio into individual stems (vocals, drums,
    bass, other) using the specified Demucs model.
    """
    # Create job
    job_id = job_manager.create_job(
        job_type=JobType.STEM_SEPARATION,
        metadata={
            "input_path": request.input_path,
            "model": request.model,
            "stems": request.stems,
            "shifts": request.shifts,
        },
    )

    # Add stem separation task to background
    background_tasks.add_task(
        stem_service.separate,
        job_id=job_id,
        input_path=request.input_path,
        model=request.model,
        stems=request.stems,
        output_dir=request.output_dir,
        shifts=request.shifts,
    )

    return JobResponse(
        job_id=job_id,
        status="queued",
        message="Stem separation job created successfully",
    )
