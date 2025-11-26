"""Analysis endpoint routes."""

from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException
from ..models.requests import AnalysisRequest, AnalysisQueryRequest
from ..models.responses import JobResponse, AnalysisResponse
from ..models.jobs import JobType
from ..services.job_manager import job_manager
from ..services.analysis_service import AnalysisService

router = APIRouter(prefix="/analyze", tags=["analyze"])
analysis_service = AnalysisService()


@router.post("", response_model=JobResponse)
async def analyze_audio(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """
    Analyze audio file with specified analyzers.

    Creates an async job to run music analysis (tempo, key, chords, structure)
    on the provided audio file. Supports preset configurations and custom YAML configs.
    """
    # Create job
    job_id = job_manager.create_job(
        job_type=JobType.ANALYSIS,
        metadata={
            "input_path": request.input_path,
            "analyzers": request.analyzers,
            "preset": request.preset,
            "transpose_to": request.transpose_to,
        },
    )

    # Add analysis task to background
    background_tasks.add_task(
        analysis_service.analyze,
        job_id=job_id,
        input_path=request.input_path,
        analyzers=request.analyzers,
        preset=request.preset,
        config_path=request.config_path,
        transpose_to=request.transpose_to,
    )

    return JobResponse(
        job_id=job_id,
        status="queued",
        message="Analysis job created successfully",
    )


@router.get("/query", response_model=AnalysisResponse)
async def query_analysis(
    song_id: Optional[str] = None,
    analysis_types: Optional[str] = None,
):
    """
    Query stored analysis results.

    Retrieve analysis results for a specific song or all analyzed songs.
    Filter by analysis types (comma-separated).
    """
    try:
        types_list = analysis_types.split(",") if analysis_types else None

        result = analysis_service.query_analysis(
            song_id=song_id,
            analysis_types=types_list,
        )

        return AnalysisResponse(
            song_id=song_id or "all",
            file_path=result.get("file_path", ""),
            analyses=result.get("analyses", result),
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/songs")
async def list_analyzed_songs():
    """List all analyzed songs."""
    songs = analysis_service.list_songs()
    return {"songs": songs, "count": len(songs)}
