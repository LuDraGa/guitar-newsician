"""Music analysis service implementation."""

import os
import asyncio
import json
from pathlib import Path
from typing import Optional, Any
from dotenv import load_dotenv
from ..models.jobs import JobState
from ..services.job_manager import job_manager
from ..config import get_config
from ..utils.path_helpers import get_song_id_from_path

load_dotenv()


class AnalysisService:
    """Service for analyzing audio files."""

    def __init__(self):
        self._analysis_cache: dict[str, dict] = {}

    def _cleanup_msaf_artifacts(self, song_folder: Path, analysis_input: Path):
        """
        Clean up MSAF temporary artifacts after analysis.

        MSAF creates:
        - song_folder/estimations/*.jams (estimation files)
        - .features_msaf_tmp.json (features cache, location varies)
        """
        import shutil
        import logging

        logger = logging.getLogger(__name__)

        # 1. Clean up estimations directory (MSAF creates this)
        estimations_dir = song_folder / "estimations"
        if estimations_dir.exists():
            try:
                shutil.rmtree(estimations_dir)
                logger.info(f"Cleaned up MSAF estimations directory: {estimations_dir}")
            except Exception as e:
                logger.warning(f"Failed to cleanup estimations dir: {e}")

        # 2. Clean up features cache file (may be in multiple locations)
        # Check song folder first, then parent directories up to downloads
        for check_dir in [song_folder, song_folder.parent, Path.cwd()]:
            features_tmp = check_dir / ".features_msaf_tmp.json"
            if features_tmp.exists():
                try:
                    features_tmp.unlink()
                    logger.info(f"Cleaned up MSAF features cache: {features_tmp}")
                    break  # Only delete first found
                except Exception as e:
                    logger.warning(f"Failed to cleanup features cache: {e}")

    async def analyze(
        self,
        job_id: str,
        input_path: str,
        analyzers: list[str] = None,
        preset: Optional[str] = None,
        config_path: Optional[str] = None,
        transpose_to: Optional[str] = None,
        is_stem: bool = False,  # New parameter to indicate stem analysis
    ) -> dict:
        """Analyze audio file with specified analyzers.

        Now saves analysis results in song folder structure:
            Input: downloads/Song Title/audio.wav
            Output: downloads/Song Title/analysis.json

            Or for stems:
            Input: downloads/Song Title/stems/vocals.wav
            Output: downloads/Song Title/stems/analysis/vocals_analysis.json
        """
        try:
            job_manager.update_job(
                job_id,
                state=JobState.RUNNING,
                progress=10.0,
                message="Initializing analysis...",
            )

            input_file = Path(input_path)
            if not input_file.exists():
                raise FileNotFoundError(f"Input file not found: {input_path}")

            # Get config
            config = get_config()

            # Map API analyzer names to actual analyzer names in music_analysis.py
            analyzer_name_map = {
                "tempo": "tempo_beats",
                "key": "tonal_key",
                "chords": "chords",
                "structure": "structure_msaf",
                "basic_stats": "basic_stats",
            }

            api_analyzers = analyzers or ["tempo", "key", "chords", "structure"]
            analyzers_to_run = [analyzer_name_map.get(a, a) for a in api_analyzers]

            # Import analyzer module (lazy import)
            from backend.analyzers.music_analysis import run_analysis

            job_manager.update_job(
                job_id,
                progress=30.0,
                message=f"Running {len(analyzers_to_run)} analyzers...",
            )

            # Run analysis in thread pool
            def _run_analysis():
                # Set transpose key if provided
                if transpose_to:
                    os.environ["TRANSPOSE_TO_KEY"] = transpose_to
                elif config.transpose_to_key:
                    os.environ["TRANSPOSE_TO_KEY"] = config.transpose_to_key

                # Determine output directory
                if is_stem:
                    out_dir = config.get_stem_analysis_folder(input_file.parent.parent)
                    out_dir.mkdir(parents=True, exist_ok=True)
                else:
                    out_dir = input_file.parent

                # Run analysis - returns path to created JSON file
                analysis_json_path = run_analysis(
                    wav_path=input_file,
                    out_dir=out_dir,
                    enable=analyzers_to_run,
                    disable=None,
                    progress_callback=None,
                )

                # Read results from JSON
                with open(analysis_json_path, 'r', encoding='utf-8') as f:
                    results = json.load(f)

                # Move to desired location if naming doesn't match convention
                if is_stem:
                    desired_name = f"{input_file.stem}_analysis.json"
                else:
                    desired_name = "analysis.json"

                desired_path = out_dir / desired_name
                if analysis_json_path != desired_path:
                    analysis_json_path.rename(desired_path)
                    analysis_json_path = desired_path

                return results, str(analysis_json_path), out_dir

            loop = asyncio.get_event_loop()
            analysis_results, final_analysis_path, out_dir = await loop.run_in_executor(None, _run_analysis)

            job_manager.update_job(
                job_id,
                progress=90.0,
                message="Analysis completed, saving metadata...",
            )

            # Determine song folder based on whether it's a stem or main track
            if is_stem:
                # For stems: input is downloads/Song/stems/vocals.wav
                song_folder = input_file.parent.parent  # Go up two levels
            else:
                # For main track: input is downloads/Song/audio.wav
                song_folder = input_file.parent

            # Analysis file was already saved by run_analysis
            analysis_file = Path(final_analysis_path)

            # Clean up MSAF artifacts
            try:
                self._cleanup_msaf_artifacts(song_folder, input_file)
            except Exception as e:
                # Don't fail analysis if cleanup fails
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"MSAF cleanup failed but analysis succeeded: {e}")

            # Extract song info
            song_id = get_song_id_from_path(song_folder)

            # Store in cache
            cache_key = f"{song_id}_{input_file.stem}" if is_stem else song_id
            self._analysis_cache[cache_key] = {
                "song_id": song_id,
                "song_folder": str(song_folder),
                "file_path": str(input_file),
                "analysis_file": str(analysis_file),
                "is_stem": is_stem,
                "analyses": analysis_results,
            }

            result = {
                "song_id": song_id,
                "song_folder": str(song_folder),
                "file_path": str(input_file),
                "analysis_file": str(analysis_file),
                "is_stem": is_stem,
                "analyses": analysis_results,
            }

            job_manager.update_job(
                job_id,
                state=JobState.COMPLETED,
                progress=100.0,
                message="Analysis completed",
                result=result,
            )

            return result

        except Exception as e:
            job_manager.update_job(
                job_id,
                state=JobState.FAILED,
                error=str(e),
                message=f"Analysis failed: {str(e)}",
            )
            raise

    def query_analysis(
        self,
        song_id: Optional[str] = None,
        analysis_types: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Query stored analysis results."""
        if song_id:
            cached = self._analysis_cache.get(song_id)
            if not cached:
                raise ValueError(f"No analysis found for song: {song_id}")

            result = cached.copy()

            # Filter by analysis types if specified
            if analysis_types:
                result["analyses"] = {
                    k: v for k, v in result["analyses"].items() if k in analysis_types
                }

            return result

        # Return all cached analyses
        return {
            song_id: {
                "file_path": data["file_path"],
                "analyses": {
                    k: v
                    for k, v in data["analyses"].items()
                    if not analysis_types or k in analysis_types
                },
            }
            for song_id, data in self._analysis_cache.items()
        }

    def list_songs(self) -> list[str]:
        """List all analyzed songs."""
        return list(self._analysis_cache.keys())
