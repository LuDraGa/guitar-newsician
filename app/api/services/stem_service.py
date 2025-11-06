"""Stem separation service implementation using Demucs Python API."""

import asyncio
import logging
from pathlib import Path
from typing import Optional

import torch
import torchaudio
from dotenv import load_dotenv

# Demucs Python API
from demucs.pretrained import get_model
from demucs.apply import apply_model

# Import helpers from the module
from app.stem_separators.stem_separator import (
    _load_audio_pydub,
    _save_audio_pydub,
    _pick_segment_seconds,
    _select_device,
)

from ..models.jobs import JobState
from ..services.job_manager import job_manager
from ..config import get_config
from ..utils.path_helpers import get_song_id_from_path, ensure_dir

load_dotenv()
logger = logging.getLogger(__name__)


class StemService:
    """Service for separating audio into stems using Demucs Python API."""

    async def separate(
        self,
        job_id: str,
        input_path: str,
        model: str = "htdemucs",
        stems: list[str] = None,
        output_dir: Optional[str] = None,
        shifts: int = 1,
        segment: Optional[float] = 7.8,
        overlap: float = 0.25,
        device: str = "auto",
    ) -> dict:
        """Separate audio into stems using Demucs Python API.

        Saves stems in song folder structure:
            Input: downloads/Song Title/audio.wav
            Output: downloads/Song Title/stems/vocals.wav
                    downloads/Song Title/stems/drums.wav
                    downloads/Song Title/stems/bass.wav
                    downloads/Song Title/stems/other.wav

        Args:
            job_id: Job identifier for tracking
            input_path: Path to input audio file
            model: Demucs model name (htdemucs, htdemucs_ft, htdemucs_6s)
            stems: List of stems to extract (defaults to all 4)
            output_dir: Optional custom output directory
            shifts: Test-time augmentation shifts
            segment: Segment size in seconds (None = auto)
            overlap: Overlap ratio (0.0-0.99)
            device: Device to use (auto, cuda, cpu)

        Returns:
            dict: Result with stems paths and metadata
        """
        try:
            job_manager.update_job(
                job_id,
                state=JobState.RUNNING,
                progress=5.0,
                message="Initializing stem separation...",
            )

            input_file = Path(input_path)
            if not input_file.exists():
                raise FileNotFoundError(f"Input file not found: {input_path}")

            # Get config
            config = get_config()

            # Determine output directory
            if output_dir:
                final_stems_dir = Path(output_dir)
            else:
                song_folder = input_file.parent
                final_stems_dir = config.get_stems_folder(song_folder)

            ensure_dir(final_stems_dir)

            stems_to_extract = stems or ["vocals", "drums", "bass", "other"]

            logger.info(f"Starting stem separation for {input_file.name}")
            logger.info(f"Model: {model}, Device: {device}, Shifts: {shifts}")
            logger.info(f"Output directory: {final_stems_dir}")

            # Select device
            torch_device = _select_device(device)
            logger.info(f"Using device: {torch_device}")

            # Run separation in executor (blocking operation)
            def _run_separation():
                """Run stem separation synchronously."""
                try:
                    # Load model
                    job_manager.update_job(
                        job_id,
                        progress=10.0,
                        message=f"Loading {model} model...",
                    )
                    logger.info(f"Loading Demucs model: {model}")
                    demucs_model = get_model(model)
                    demucs_model.to(torch_device)
                    logger.info(f"Model loaded successfully")

                    # Load audio
                    job_manager.update_job(
                        job_id,
                        progress=20.0,
                        message="Loading audio file...",
                    )
                    logger.info(f"Loading audio from: {input_file}")
                    wav, sr = _load_audio_pydub(input_file)
                    logger.info(f"Audio loaded: {wav.shape}, sample rate: {sr}")

                    # Resample if needed
                    target_sr = getattr(demucs_model, "samplerate", 44100)
                    if sr != target_sr:
                        logger.info(f"Resampling from {sr} to {target_sr}")
                        wav = torchaudio.functional.resample(wav, sr, target_sr)
                        sr = target_sr

                    # Ensure stereo
                    if wav.shape[0] == 1:
                        logger.info("Converting mono to stereo")
                        wav = wav.repeat(2, 1)

                    # Prepare for model
                    job_manager.update_job(
                        job_id,
                        progress=30.0,
                        message="Separating stems (this may take a while)...",
                    )
                    logger.info("Starting stem separation")

                    mix = wav.to(torch_device)
                    mix = mix.unsqueeze(0)  # [1, C, T]

                    # Run separation
                    seg_s = _pick_segment_seconds(demucs_model, segment)
                    logger.info(f"Using segment size: {seg_s}s")

                    with torch.no_grad():
                        out = apply_model(
                            demucs_model,
                            mix,
                            shifts=shifts,
                            overlap=overlap,
                            split=bool(seg_s),
                            segment=seg_s,
                            progress=False,
                            device=torch_device,
                        )  # [1, S, C, T]

                    logger.info("Stem separation completed")

                    # Save stems
                    job_manager.update_job(
                        job_id,
                        progress=80.0,
                        message="Saving stems...",
                    )

                    out = out.squeeze(0).to(torch.float32).cpu()  # [S, C, T]
                    stem_names = getattr(demucs_model, "sources", ["drums", "bass", "other", "vocals"])

                    stem_paths = {}
                    for i, stem_name in enumerate(stem_names):
                        if stem_name in stems_to_extract:
                            audio = out[i]
                            save_path = final_stems_dir / f"{stem_name}.wav"

                            logger.info(f"Saving stem: {stem_name} -> {save_path}")
                            _save_audio_pydub(save_path, audio, sr, fmt="wav")
                            stem_paths[stem_name] = str(save_path)

                    logger.info(f"Successfully saved {len(stem_paths)} stems")
                    return stem_paths

                except Exception as e:
                    logger.error(f"Stem separation failed: {e}", exc_info=True)
                    raise

            # Run separation in executor to avoid blocking event loop
            loop = asyncio.get_event_loop()
            stem_paths = await loop.run_in_executor(None, _run_separation)

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

            logger.info(f"Stem separation job {job_id} completed successfully")
            return result

        except Exception as e:
            logger.error(f"Stem separation job {job_id} failed: {e}", exc_info=True)
            job_manager.update_job(
                job_id,
                state=JobState.FAILED,
                error=str(e),
                message=f"Stem separation failed: {str(e)}",
            )
            raise
