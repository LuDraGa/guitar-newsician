"""Audio conversion service implementation."""

import asyncio
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from pydub import AudioSegment
from ..models.jobs import JobState
from ..services.job_manager import job_manager
from ..config import get_config
from ..utils.path_helpers import get_song_id_from_path

load_dotenv()


class ConvertService:
    """Service for converting audio formats."""

    async def convert(
        self,
        job_id: str,
        input_path: str,
        output_format: str = "wav",
        output_dir: Optional[str] = None,
        sample_rate: int = 44100,
        channels: int = 2,
    ) -> dict:
        """Convert audio file to target format.

        Now saves converted file in the same song folder as the input file.
        For example:
            Input: downloads/Song Title/audio.m4a
            Output: downloads/Song Title/audio.wav
        """
        try:
            job_manager.update_job(
                job_id,
                state=JobState.RUNNING,
                progress=10.0,
                message="Loading audio file...",
            )

            input_file = Path(input_path)
            if not input_file.exists():
                raise FileNotFoundError(f"Input file not found: {input_path}")

            # Get config
            config = get_config()

            # Determine output path - save in same folder as input
            if output_dir:
                # Custom output dir specified
                out_dir = Path(output_dir)
                out_dir.mkdir(parents=True, exist_ok=True)
                output_file = out_dir / f"audio.{output_format}"
            else:
                # Save in same folder as input (song folder structure)
                song_folder = input_file.parent
                output_file = song_folder / f"audio.{output_format}"

            job_manager.update_job(
                job_id,
                progress=30.0,
                message=f"Converting to {output_format}...",
            )

            # Run conversion in thread pool to avoid blocking
            def _convert():
                audio = AudioSegment.from_file(str(input_file))

                # Set channels
                if channels == 1:
                    audio = audio.set_channels(1)
                elif channels == 2:
                    audio = audio.set_channels(2)

                # Set sample rate
                audio = audio.set_frame_rate(sample_rate)

                # Export
                audio.export(str(output_file), format=output_format)
                return output_file

            loop = asyncio.get_event_loop()
            output_path = await loop.run_in_executor(None, _convert)

            # Extract song info
            song_folder = output_path.parent
            song_id = get_song_id_from_path(song_folder)

            result = {
                "song_folder": str(song_folder),
                "song_id": song_id,
                "input_path": str(input_file),
                "output_path": str(output_path),
                "output_format": output_format,
                "file_size": output_path.stat().st_size,
            }

            job_manager.update_job(
                job_id,
                state=JobState.COMPLETED,
                progress=100.0,
                message="Conversion completed",
                result=result,
            )

            return result

        except Exception as e:
            job_manager.update_job(
                job_id,
                state=JobState.FAILED,
                error=str(e),
                message=f"Conversion failed: {str(e)}",
            )
            raise
