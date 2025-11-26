"""
Demucs Stem Separator
YAML-driven stem separation with pydub I/O and Rich UI.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Literal, Callable
import time
import yaml

import torch
import torchaudio
from pydub import AudioSegment
import numpy as np

from pydantic import BaseModel, Field, field_validator
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

# Demucs
from demucs.pretrained import get_model
from demucs.apply import apply_model

console = Console()

# ---------------------
# Enums & Config Models
# ---------------------

Device = Literal["auto", "cuda", "cpu"]
DType = Literal["float32", "float16"]
Codec = Literal["wav", "flac"]
ModelName = Literal["htdemucs", "htdemucs_ft", "htdemucs_6s"]


class StemSeparatorConfig(BaseModel):
    """Configuration for stem separation."""

    input_dir: Path = Field(
        default=Path("downloads"),
        description="Input directory with song folders containing audio.wav files"
    )
    audio_exts: List[str] = Field(
        default=["wav", "mp3", "flac", "ogg", "m4a", "aac"],
        description="Supported audio file extensions"
    )

    # Demucs settings
    model: ModelName = Field(default="htdemucs_6s", description="Demucs model to use")
    segment: Optional[float] = Field(
        default=7.8,
        description="Segment size in seconds (None = auto)"
    )
    overlap: float = Field(default=0.25, ge=0.0, le=0.99, description="Overlap ratio")
    shifts: int = Field(default=1, ge=1, description="Test-time augmentation shifts")
    device: Device = Field(default="auto", description="Device to use")
    dtype: DType = Field(default="float32", description="Precision")

    # Output settings
    codec: Codec = Field(default="wav", description="Output format")
    skip_existing: bool = Field(default=True, description="Skip if stems directory exists")
    overwrite: bool = Field(default=False, description="Overwrite existing stem files")


# ---------------------
# Helpers
# ---------------------


def _select_device(pref: Device) -> torch.device:
    """Select device based on preference."""
    if pref == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device(pref)


def _load_audio_pydub(path: Path) -> tuple[torch.Tensor, int]:
    """
    Load audio using pydub and convert to torch tensor.

    Returns:
        tuple: (audio_tensor [C, T], sample_rate)
    """
    audio = AudioSegment.from_file(str(path))

    # Get sample rate
    sr = audio.frame_rate

    # Convert to numpy array
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)

    # Normalize to [-1, 1]
    samples = samples / (2 ** (8 * audio.sample_width - 1))

    # Reshape based on channels
    if audio.channels == 2:
        samples = samples.reshape((-1, 2))
        samples = samples.T  # [2, T]
    else:
        samples = samples.reshape((1, -1))  # [1, T]

    # Convert to torch tensor
    wav = torch.from_numpy(samples).float()

    return wav, sr


def _save_audio_pydub(path: Path, audio: torch.Tensor, sr: int, fmt: str = "wav") -> None:
    """
    Save audio tensor using pydub.

    Args:
        path: Output file path
        audio: Audio tensor [C, T]
        sr: Sample rate
        fmt: Output format (wav or flac)
    """
    # Convert to numpy and denormalize
    audio_np = audio.cpu().numpy()  # [C, T]

    # Transpose to [T, C] for pydub
    audio_np = audio_np.T

    # Convert to int16
    audio_int16 = (audio_np * 32767).astype(np.int16)

    # Flatten for pydub
    audio_flat = audio_int16.flatten()

    # Create AudioSegment
    channels = audio.shape[0]
    audio_segment = AudioSegment(
        audio_flat.tobytes(),
        frame_rate=sr,
        sample_width=2,  # 16-bit
        channels=channels
    )

    # Export
    audio_segment.export(str(path), format=fmt)


def _pick_segment_seconds(model, requested: Optional[float]) -> Optional[float]:
    """
    Return appropriate segment length in seconds.

    Args:
        model: Demucs model
        requested: Requested segment size

    Returns:
        Segment size in seconds
    """
    sr = getattr(model, "samplerate", 44100)
    tl = getattr(model, "training_length", None)

    if tl is None and hasattr(model, "models") and model.models:
        tl = getattr(model.models[0], "training_length", None)
        sr = getattr(model.models[0], "samplerate", sr)

    if tl is None:
        default_seg_s = 7.8
        return default_seg_s if requested is None else requested

    model_seg_s = tl / sr

    if requested is None:
        return model_seg_s

    # Snap to nearest multiple
    k = max(1, round(requested / model_seg_s))
    return k * model_seg_s


def _pretty_header(cfg: StemSeparatorConfig, num_files: int) -> None:
    """Display configuration header."""
    tbl = Table.grid(expand=True)
    tbl.add_column(justify="right", ratio=1)
    tbl.add_column(justify="left", ratio=3)
    tbl.add_row("Model", cfg.model)
    tbl.add_row("Segment", f"{cfg.segment}s" if cfg.segment else "auto")
    tbl.add_row("Overlap", f"{int(cfg.overlap*100)}%")
    tbl.add_row("Shifts", str(cfg.shifts))
    tbl.add_row("Device", cfg.device)
    tbl.add_row("Codec", cfg.codec)
    tbl.add_row("Input Dir", str(cfg.input_dir))
    tbl.add_row("Files to Process", str(num_files))
    console.print(Panel(tbl, title="Demucs Stem Separator", border_style="magenta"))


# ---------------------
# Core API
# ---------------------


def separate_stems(
    song_dir: Path,
    config: StemSeparatorConfig,
    progress_callback: Optional[Callable[[str, int], None]] = None
) -> Optional[Path]:
    """
    Separate stems for a single song.

    Args:
        song_dir: Path to song directory
        config: Configuration
        progress_callback: Optional callback(status_message, percentage)

    Returns:
        Path to stems directory if successful, None otherwise
    """
    # Find audio file
    audio_file = song_dir / "audio.wav"
    if not audio_file.exists():
        # Try other formats
        for ext in config.audio_exts:
            potential = song_dir / f"audio.{ext}"
            if potential.exists():
                audio_file = potential
                break

    if not audio_file.exists():
        console.print(f"[red]No audio file found in {song_dir.name}[/red]")
        return None

    # Check if stems already exist
    stems_dir = song_dir / "stems"
    if stems_dir.exists() and config.skip_existing:
        console.print(f"[yellow]Stems already exist for {song_dir.name}, skipping[/yellow]")
        return stems_dir

    # Create stems directory
    stems_dir.mkdir(parents=True, exist_ok=True)

    # Device/dtype
    device = _select_device(config.device)
    use_fp16 = config.dtype == "float16" and device.type == "cuda"

    try:
        if progress_callback:
            progress_callback("Loading model", 10)

        # Load model
        model = get_model(config.model)
        model.to(device)
        if use_fp16:
            model.half()

        if progress_callback:
            progress_callback("Loading audio", 20)

        # Load audio
        wav, sr = _load_audio_pydub(audio_file)
        target_sr = getattr(model, "samplerate", 44100)

        if sr != target_sr:
            wav = torchaudio.functional.resample(wav, sr, target_sr)
            sr = target_sr

        # Ensure stereo
        if wav.shape[0] == 1:
            wav = wav.repeat(2, 1)

        if progress_callback:
            progress_callback("Separating stems", 40)

        # Prepare for model
        mix = wav.to(device)
        if use_fp16:
            mix = mix.half()
        mix = mix.unsqueeze(0)  # [1, C, T]

        # Run separation
        seg_s = _pick_segment_seconds(model, config.segment)
        with torch.no_grad():
            out = apply_model(
                model,
                mix,
                shifts=config.shifts,
                overlap=config.overlap,
                split=bool(seg_s),
                segment=seg_s,
                progress=False,
                device=device,
            )  # [1, S, C, T]

        if progress_callback:
            progress_callback("Saving stems", 80)

        # Save stems
        out = out.squeeze(0).to(torch.float32).cpu()  # [S, C, T]
        stems = getattr(model, "sources", ["drums", "bass", "other", "vocals"])

        saved_files = []
        for i, stem_name in enumerate(stems):
            audio = out[i]
            save_path = stems_dir / f"{stem_name}.{config.codec}"

            # Check if should overwrite
            if save_path.exists() and not config.overwrite:
                console.print(f"[dim]Skipping existing: {stem_name}.{config.codec}[/dim]")
                continue

            _save_audio_pydub(save_path, audio, sr, fmt=config.codec)
            saved_files.append(stem_name)

        if progress_callback:
            progress_callback("Complete", 100)

        console.print(f"[green]✓ Saved {len(saved_files)} stems: {', '.join(saved_files)}[/green]")
        return stems_dir

    except Exception as e:
        console.print(f"[red]✗ Failed to separate stems for {song_dir.name}: {e}[/red]")
        return None


def load_config(config_path: Path = Path(__file__).parent / "config.yaml") -> StemSeparatorConfig:
    """Load configuration from YAML file."""
    if not config_path.exists():
        console.print(f"[yellow]Config not found at {config_path}, using defaults[/yellow]")
        return StemSeparatorConfig()

    with open(config_path, "r") as f:
        data = yaml.safe_load(f)

    return StemSeparatorConfig(**data)
