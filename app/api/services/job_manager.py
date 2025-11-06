"""Job management and tracking service."""

import uuid
from datetime import datetime
from typing import Optional
from collections import defaultdict
from ..models.jobs import JobStatus, JobState, JobType


class JobManager:
    """Manages job lifecycle and status tracking."""

    def __init__(self):
        self._jobs: dict[str, JobStatus] = {}
        self._jobs_by_song: dict[str, list[str]] = defaultdict(list)

    def create_job(
        self,
        job_type: JobType,
        metadata: Optional[dict] = None,
        song_id: Optional[str] = None,
    ) -> str:
        """Create a new job and return its ID."""
        job_id = f"job_{uuid.uuid4().hex[:12]}"

        job_status = JobStatus(
            job_id=job_id,
            job_type=job_type,
            state=JobState.QUEUED,
            progress=0.0,
            message=f"{job_type.value} job created",
            metadata=metadata or {},
        )

        self._jobs[job_id] = job_status

        if song_id:
            self._jobs_by_song[song_id].append(job_id)

        return job_id

    def get_job(self, job_id: str) -> Optional[JobStatus]:
        """Get job status by ID."""
        return self._jobs.get(job_id)

    def get_jobs_for_song(self, song_id: str) -> list[JobStatus]:
        """Get all jobs for a specific song."""
        job_ids = self._jobs_by_song.get(song_id, [])
        return [self._jobs[jid] for jid in job_ids if jid in self._jobs]

    def update_job(
        self,
        job_id: str,
        state: Optional[JobState] = None,
        progress: Optional[float] = None,
        message: Optional[str] = None,
        error: Optional[str] = None,
        result: Optional[dict] = None,
    ) -> None:
        """Update job status."""
        job = self._jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        if state is not None:
            job.state = state
        if progress is not None:
            job.progress = progress
        if message is not None:
            job.message = message
        if error is not None:
            job.error = error
        if result is not None:
            job.result = result

        job.updated_at = datetime.utcnow()

        if state in (JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED):
            job.completed_at = datetime.utcnow()
            if state == JobState.COMPLETED:
                job.progress = 100.0

    def delete_job(self, job_id: str) -> bool:
        """Delete a job."""
        if job_id in self._jobs:
            del self._jobs[job_id]
            return True
        return False

    def list_jobs(
        self,
        job_type: Optional[JobType] = None,
        state: Optional[JobState] = None,
    ) -> list[JobStatus]:
        """List all jobs with optional filters."""
        jobs = list(self._jobs.values())

        if job_type:
            jobs = [j for j in jobs if j.job_type == job_type]
        if state:
            jobs = [j for j in jobs if j.state == state]

        return sorted(jobs, key=lambda j: j.created_at, reverse=True)


# Global job manager instance
job_manager = JobManager()
