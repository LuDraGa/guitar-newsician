"""
WAV to MIDI Converter
Converts WAV files to MIDI using Spotify's basic-pitch library.
"""

from pathlib import Path
from typing import List, Optional, Callable
import yaml
from pydantic import BaseModel, Field
from rich.console import Console

console = Console()

# Config path relative to this file
CONFIG_PATH = Path(__file__).parent / "config.yaml"


class Wav2MidiConfig(BaseModel):
    """Configuration for WAV to MIDI converter."""

    # Input/Output
    input_dir: Path = Field(
        default=Path("downloads"), description="Input directory with song folders"
    )
    output_mode: str = Field(
        default="in_place",
        description="Where to save MIDI: 'in_place', 'outputs', 'custom'",
    )
    output_dir: Optional[Path] = Field(
        default=None,
        description="Custom output directory (used if output_mode='custom')",
    )

    # Conversion modes
    stems_mode: str = Field(
        default="optional",
        description="Stem handling: 'disabled', 'optional', 'stems_only'",
    )
    convert_main_audio: bool = Field(
        default=True, description="Convert main audio.wav file"
    )

    # Basic-pitch settings
    onset_threshold: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="Onset threshold (0-1, higher = fewer notes)",
    )
    frame_threshold: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="Frame threshold (0-1, higher = fewer notes)",
    )
    minimum_note_length: float = Field(
        default=58.0, description="Minimum note length in milliseconds"
    )
    minimum_frequency: Optional[float] = Field(
        default=None, description="Minimum frequency in Hz (None = no filter)"
    )
    maximum_frequency: Optional[float] = Field(
        default=None, description="Maximum frequency in Hz (None = no filter)"
    )
    multiple_pitch_bends: bool = Field(
        default=False, description="Allow multiple pitch bends per note"
    )
    melodia_trick: bool = Field(
        default=True, description="Use melodia trick for monophonic sources"
    )

    # Processing
    overwrite: bool = Field(default=False, description="Overwrite existing MIDI files")
    skip_existing: bool = Field(default=True, description="Skip if MIDI exists")
    supported_formats: List[str] = Field(
        default=["wav", "mp3", "flac", "ogg", "m4a"],
        description="Supported audio formats",
    )


def load_config() -> Wav2MidiConfig:
    """Load configuration from YAML file."""
    if not CONFIG_PATH.exists():
        console.print(
            f"[yellow]Config not found at {CONFIG_PATH}, using defaults[/yellow]"
        )
        return Wav2MidiConfig()

    with open(CONFIG_PATH, "r") as f:
        data = yaml.safe_load(f)

    return Wav2MidiConfig(**data)


def convert_wav_to_midi(
    audio_path: Path,
    output_path: Path,
    config: Wav2MidiConfig,
    progress_callback: Optional[Callable[[str, float], None]] = None,
) -> bool:
    """
    Convert audio file to MIDI using basic-pitch.

    Args:
        audio_path: Input audio file (WAV, MP3, FLAC, etc.)
        output_path: Output MIDI file path
        config: Configuration object
        progress_callback: Optional callback(message: str, progress: float)

    Returns:
        True if successful, False otherwise
    """
    try:
        from basic_pitch.inference import predict
        from basic_pitch import ICASSP_2022_MODEL_PATH

        # Step 1: Load and predict
        if progress_callback:
            progress_callback(f"Analyzing {audio_path.name}...", 20.0)

        console.print(f"[cyan]Processing {audio_path.name}...[/cyan]")

        # Run prediction with basic-pitch
        model_output, midi_data, note_events = predict(
            str(audio_path),
            ICASSP_2022_MODEL_PATH,
            onset_threshold=config.onset_threshold,
            frame_threshold=config.frame_threshold,
            minimum_note_length=config.minimum_note_length,
            minimum_frequency=config.minimum_frequency,
            maximum_frequency=config.maximum_frequency,
            multiple_pitch_bends=config.multiple_pitch_bends,
            melodia_trick=config.melodia_trick,
        )

        if progress_callback:
            progress_callback("Writing MIDI file...", 80.0)

        # Check if we got any notes
        if len(note_events) == 0:
            console.print(f"[yellow]No notes detected in {audio_path.name}[/yellow]")
            return False

        # Save MIDI file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        midi_data.write(str(output_path))

        if progress_callback:
            progress_callback("Conversion complete", 100.0)

        console.print(
            f"[green]✓ Converted {audio_path.name} → {output_path.name}[/green]"
        )
        console.print(f"  Notes detected: {len(note_events)}")

        return True

    except Exception as e:
        console.print(f"[red]✗ Error converting {audio_path.name}: {e}[/red]")
        import traceback

        traceback.print_exc()
        return False


def find_audio_files(song_dir: Path, config: Wav2MidiConfig) -> dict:
    """
    Find convertible audio files in a song directory.

    Args:
        song_dir: Path to song directory
        config: Configuration object

    Returns:
        Dict with 'main' and 'stems' keys containing audio file paths
    """
    result = {"main": None, "stems": []}

    # Check for main audio file
    if config.convert_main_audio:
        for ext in config.supported_formats:
            audio_file = song_dir / f"audio.{ext}"
            if audio_file.exists():
                result["main"] = audio_file
                break

    # Check for stems
    if config.stems_mode != "disabled":
        stems_dir = song_dir / "stems"
        if stems_dir.exists():
            # Find all audio files in stems directory
            for ext in config.supported_formats:
                for stem_file in sorted(stems_dir.glob(f"*.{ext}")):
                    if stem_file not in result["stems"]:
                        result["stems"].append(stem_file)

    return result


def convert_song_to_midi(
    song_dir: Path,
    config: Wav2MidiConfig,
    convert_main: bool = True,
    stem_names: Optional[List[str]] = None,
    progress_callback: Optional[Callable[[str, float], None]] = None,
) -> dict:
    """
    Convert audio files in a song directory to MIDI.

    Args:
        song_dir: Path to song directory
        config: Configuration object
        convert_main: Convert main audio file
        stem_names: List of stem names to convert (None = all stems, [] = no stems)
        progress_callback: Optional progress callback

    Returns:
        Dict with conversion results
    """
    results = {"main": None, "stems": {}, "success_count": 0, "fail_count": 0}

    # Find audio files
    audio_files = find_audio_files(song_dir, config)

    # Filter stems if specific ones requested
    stems_to_convert = []
    if stem_names is not None:
        # Convert specific stems only
        for stem_file in audio_files["stems"]:
            stem_name = stem_file.stem
            if stem_name in stem_names:
                stems_to_convert.append(stem_file)
    else:
        # Convert all stems
        stems_to_convert = audio_files["stems"]

    total_files = 0
    if convert_main and audio_files["main"]:
        total_files += 1
    total_files += len(stems_to_convert)

    if total_files == 0:
        console.print(f"[yellow]No audio files to convert in {song_dir.name}[/yellow]")
        return results

    current_file = 0

    # Convert main audio
    if convert_main and audio_files["main"]:
        current_file += 1
        main_audio = audio_files["main"]
        main_midi = song_dir / "audio.mid"

        # Skip if exists and skip_existing is True
        if main_midi.exists() and config.skip_existing and not config.overwrite:
            console.print(f"[dim]Skipping {main_midi.name} (already exists)[/dim]")
            results["main"] = {"skipped": True, "path": str(main_midi)}
        else:
            console.print(
                f"[cyan]Converting main audio ({current_file}/{total_files})...[/cyan]"
            )
            success = convert_wav_to_midi(
                main_audio, main_midi, config, progress_callback
            )
            results["main"] = {
                "success": success,
                "path": str(main_midi) if success else None,
            }
            if success:
                results["success_count"] += 1
            else:
                results["fail_count"] += 1

    # Convert stems
    if stems_to_convert:
        for stem_audio in stems_to_convert:
            current_file += 1
            stem_name = stem_audio.stem
            stem_midi = stem_audio.parent / f"{stem_name}.mid"

            # Skip if exists and skip_existing is True
            if stem_midi.exists() and config.skip_existing and not config.overwrite:
                console.print(f"[dim]Skipping {stem_midi.name} (already exists)[/dim]")
                results["stems"][stem_name] = {"skipped": True, "path": str(stem_midi)}
                continue

            console.print(
                f"[cyan]Converting {stem_name} ({current_file}/{total_files})...[/cyan]"
            )
            success = convert_wav_to_midi(
                stem_audio, stem_midi, config, progress_callback
            )
            results["stems"][stem_name] = {
                "success": success,
                "path": str(stem_midi) if success else None,
            }
            if success:
                results["success_count"] += 1
            else:
                results["fail_count"] += 1

    return results
