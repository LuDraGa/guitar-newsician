"""Stem separation service implementation."""

import asyncio
import shutil
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from ..models.jobs import JobState
from ..services.job_manager import job_manager
from ..config import get_config
from ..utils.path_helpers import get_song_id_from_path, ensure_dir

load_dotenv()


class StemService:
    """Service for separating audio into stems using Demucs."""

    async def separate(
        self,
        job_id: str,
        input_path: str,
        model: str = "htdemucs",
        stems: list[str] = None,
        output_dir: Optional[str] = None,
        shifts: int = 1,
    ) -> dict:
        """Separate audio into stems.

        Now saves stems in song folder structure:
            Input: downloads/Song Title/audio.m4a
            Output: downloads/Song Title/stems/vocals.wav
                    downloads/Song Title/stems/drums.wav
                    downloads/Song Title/stems/bass.wav
                    downloads/Song Title/stems/other.wav
        """
        try:
            job_manager.update_job(
                job_id,
                state=JobState.RUNNING,
                progress=10.0,
                message="Initializing stem separation...",
            )

            input_file = Path(input_path)
            if not input_file.exists():
                raise FileNotFoundError(f"Input file not found: {input_path}")

            # Get config
            config = get_config()

            # Determine output directory
            if output_dir:
                # Custom output dir specified
                final_stems_dir = Path(output_dir)
            else:
                # Save in song folder's stems subfolder
                song_folder = input_file.parent
                final_stems_dir = config.get_stems_folder(song_folder)

            ensure_dir(final_stems_dir)

            # Demucs needs a temp output directory (it creates nested structure)
            temp_out_dir = final_stems_dir.parent / ".demucs_temp"
            temp_out_dir.mkdir(parents=True, exist_ok=True)

            stems_to_extract = stems or ["vocals", "drums", "bass", "other"]

            job_manager.update_job(
                job_id,
                progress=20.0,
                message=f"Running Demucs {model} model...",
            )

            # Run demucs in subprocess
            import subprocess

            cmd = [
                "python",
                "-m",
                "demucs",
                "-n",
                model,
                "--out",
                str(temp_out_dir),
                "--shifts",
                str(shifts),
                str(input_file),
            ]

            def _run_demucs():
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
                stdout, stderr = process.communicate()

                # Demucs writes progress to stderr, so only check return code
                if process.returncode != 0:
                    # Check if it's actually an error (not just progress output)
                    if "Error" in stderr or "Traceback" in stderr:
                        raise RuntimeError(f"Demucs failed: {stderr}")

                return stdout

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _run_demucs)

            job_manager.update_job(
                job_id,
                progress=85.0,
                message="Moving stems to song folder...",
            )

            # Find separated files in temp directory
            # Demucs creates: temp_out_dir/model/input_stem/*wav
            demucs_stem_dir = temp_out_dir / model / input_file.stem
            stem_paths = {}

            if not demucs_stem_dir.exists():
                raise RuntimeError(f"Demucs output directory not found: {demucs_stem_dir}")

            # Move stems to final location
            for stem_type in stems_to_extract:
                temp_stem_file = demucs_stem_dir / f"{stem_type}.wav"
                if temp_stem_file.exists():
                    final_stem_file = final_stems_dir / f"{stem_type}.wav"
                    shutil.move(str(temp_stem_file), str(final_stem_file))
                    stem_paths[stem_type] = str(final_stem_file)

            # Clean up temp directory
            try:
                shutil.rmtree(temp_out_dir)
            except:
                pass  # Don't fail if cleanup fails

            # Extract song info
            song_folder = input_file.parent
            song_id = get_song_id_from_path(song_folder)

            result = {
                "song_folder": str(song_folder),
                "song_id": song_id,
                "stems_folder": str(final_stems_dir),
                "input_path": str(input_file),
                "stems": stem_paths,
                "model": model,
            }

            job_manager.update_job(
                job_id,
                state=JobState.COMPLETED,
                progress=100.0,
                message="Stem separation completed",
                result=result,
            )

            return result

        except Exception as e:
            job_manager.update_job(
                job_id,
                state=JobState.FAILED,
                error=str(e),
                message=f"Stem separation failed: {str(e)}",
            )
            raise
