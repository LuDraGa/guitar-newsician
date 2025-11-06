"""Convert endpoint routes."""

from fastapi import APIRouter, BackgroundTasks
from ..models.requests import ConvertRequest
from ..models.responses import JobResponse
from ..models.jobs import JobType
from ..services.job_manager import job_manager
from ..services.convert_service import ConvertService

router = APIRouter(prefix="/convert", tags=["convert"])
convert_service = ConvertService()


@router.post("", response_model=JobResponse)
async def convert_audio(request: ConvertRequest, background_tasks: BackgroundTasks):
    """
    Convert audio file to different format.

    Creates an async job to convert audio to the specified format with
    optional sample rate and channel configuration.
    """
    # Create job
    job_id = job_manager.create_job(
        job_type=JobType.CONVERT,
        metadata={
            "input_path": request.input_path,
            "output_format": request.output_format,
            "sample_rate": request.sample_rate,
            "channels": request.channels,
        },
    )

    # Add conversion task to background
    background_tasks.add_task(
        convert_service.convert,
        job_id=job_id,
        input_path=request.input_path,
        output_format=request.output_format,
        output_dir=request.output_dir,
        sample_rate=request.sample_rate or 44100,
        channels=request.channels or 2,
    )

    return JobResponse(
        job_id=job_id,
        status="queued",
        message="Conversion job created successfully",
    )
