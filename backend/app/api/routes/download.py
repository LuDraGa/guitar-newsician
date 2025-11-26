"""Download endpoint routes."""

import asyncio
from fastapi import APIRouter, BackgroundTasks
from ..models.requests import DownloadRequest
from ..models.responses import JobResponse
from ..models.jobs import JobType
from ..services.job_manager import job_manager
from ..services.download_service import DownloadService

router = APIRouter(prefix="/download", tags=["download"])
download_service = DownloadService()


@router.post("", response_model=JobResponse)
async def download_audio(request: DownloadRequest, background_tasks: BackgroundTasks):
    """
    Download audio from YouTube Music URL.

    Creates an async job to download audio in the specified format and quality.
    Use the returned job_id to track progress via /jobs/{job_id}.
    """
    # Create job
    job_id = job_manager.create_job(
        job_type=JobType.DOWNLOAD,
        metadata={
            "url": str(request.url),
            "format": request.format,
            "quality": request.quality,
        },
    )

    # Add download task to background
    background_tasks.add_task(
        download_service.download,
        job_id=job_id,
        url=str(request.url),
        output_dir=request.output_dir,
        audio_format=request.format,
        quality=request.quality,
    )

    return JobResponse(
        job_id=job_id,
        status="queued",
        message="Download job created successfully",
    )
