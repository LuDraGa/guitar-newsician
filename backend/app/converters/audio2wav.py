"""
Audio to WAV Converter
Converts audio files (m4a, mp3, etc.) to WAV format in-place within song directories.
"""

from pathlib import Path
from typing import List, Optional
import yaml
from pydantic import BaseModel, Field
from pydub import AudioSegment
from rich.console import Console
from rich.prompt import Prompt
from rich.table import Table
from rich.panel import Panel
from rich import box

console = Console()

# Config path relative to this file
CONFIG_PATH = Path(__file__).parent / "config.yaml"


class ConverterConfig(BaseModel):
    """Configuration for audio to WAV converter."""

    input_dir: Path = Field(default=Path("downloads"), description="Input directory with song folders")
    target_sample_rate: int = Field(default=44100, description="Target sample rate in Hz")
    mono: bool = Field(default=False, description="Convert to mono")
    overwrite: bool = Field(default=False, description="Overwrite existing WAV files")
    supported_formats: List[str] = Field(
        default=["m4a", "mp3", "flac", "aac", "ogg", "wav"],
        description="Supported audio formats"
    )


def load_config() -> ConverterConfig:
    """Load configuration from YAML file."""
    if not CONFIG_PATH.exists():
        console.print(f"[yellow]Config not found at {CONFIG_PATH}, using defaults[/yellow]")
        return ConverterConfig()

    with open(CONFIG_PATH, "r") as f:
        data = yaml.safe_load(f)

    # Resolve input_dir relative to config file location if it's relative
    if "input_dir" in data:
        input_path = Path(data["input_dir"])
        if not input_path.is_absolute():
            data["input_dir"] = str((CONFIG_PATH.parent / input_path).resolve())

    return ConverterConfig(**data)


def find_convertible_songs(input_dir: Path, supported_formats: List[str]) -> List[Path]:
    """
    Find all song directories that have convertible audio files.

    Returns:
        List of song directory paths that contain audio files
    """
    if not input_dir.exists():
        return []

    convertible = []
    for item in input_dir.iterdir():
        if not item.is_dir():
            continue

        # Look for audio files in supported formats
        for ext in supported_formats:
            audio_file = item / f"audio.{ext}"
            if audio_file.exists():
                convertible.append(item)
                break

    return sorted(convertible)


def display_song_selection(songs: List[Path]) -> Optional[Path]:
    """
    Display Rich TUI for song selection.

    Returns:
        Selected song directory path, or None if cancelled
    """
    if not songs:
        console.print("[red]No convertible songs found![/red]")
        console.print("[yellow]Make sure your input directory contains song folders with audio.m4a files[/yellow]")
        return None

    # Create selection table
    table = Table(
        title="Available Songs for Conversion",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("#", justify="right", style="cyan")
    table.add_column("Song Directory", style="white")
    table.add_column("Audio Files", style="green")

    # List audio files in each directory
    song_info = []
    for idx, song_dir in enumerate(songs, start=1):
        audio_files = [f.name for f in song_dir.iterdir() if f.suffix.lower() in ['.m4a', '.mp3', '.flac', '.aac', '.ogg', '.wav']]
        song_info.append((song_dir, audio_files))
        table.add_row(
            str(idx),
            song_dir.name,
            ", ".join(audio_files)
        )

    console.print(table)
    console.print()

    # Prompt for selection
    choice = Prompt.ask(
        "[bold cyan]Select song to convert[/bold cyan]",
        choices=[str(i) for i in range(1, len(songs) + 1)] + ["q"],
        default="q"
    )

    if choice == "q":
        console.print("[yellow]Conversion cancelled[/yellow]")
        return None

    return songs[int(choice) - 1]


def convert_song_to_wav(
    song_dir: Path,
    target_sr: int,
    mono: bool,
    overwrite: bool,
    supported_formats: List[str]
) -> bool:
    """
    Convert audio file in song directory to WAV format.

    Args:
        song_dir: Path to song directory
        target_sr: Target sample rate
        mono: Convert to mono
        overwrite: Overwrite existing WAV
        supported_formats: List of supported formats

    Returns:
        True if successful, False otherwise
    """
    # Find audio file
    input_file = None
    for ext in supported_formats:
        potential = song_dir / f"audio.{ext}"
        if potential.exists() and potential.suffix.lower() != ".wav":
            input_file = potential
            break

    if not input_file:
        console.print(f"[red]No convertible audio file found in {song_dir.name}[/red]")
        return False

    output_file = song_dir / "audio.wav"

    # Check if already exists
    if output_file.exists() and not overwrite:
        console.print(f"[yellow]WAV already exists in {song_dir.name} (use overwrite=true to replace)[/yellow]")
        return False

    try:
        console.print(f"[cyan]Converting {song_dir.name}...[/cyan]")
        console.print(f"  Input:  {input_file.name}")
        console.print(f"  Output: {output_file.name}")

        # Load audio
        ext = input_file.suffix.lower().lstrip(".")
        audio = AudioSegment.from_file(input_file, format=ext)

        # Apply transformations
        if mono:
            audio = audio.set_channels(1)
            console.print(f"  → Converted to mono")

        # Export with target sample rate
        audio.export(
            output_file,
            format="wav",
            parameters=["-ar", str(target_sr)]
        )

        console.print(f"[green]✓ Successfully converted {song_dir.name}[/green]")
        console.print(f"  Sample Rate: {target_sr} Hz")
        console.print(f"  Channels: {'1 (mono)' if mono else audio.channels}")
        console.print()

        return True

    except Exception as e:
        console.print(f"[red]✗ Failed to convert {song_dir.name}: {e}[/red]")
        return False


def main():
    """Main entry point for interactive conversion."""
    console.print(Panel.fit(
        "[bold cyan]Audio to WAV Converter[/bold cyan]\n"
        "Convert audio files to WAV format in-place",
        border_style="cyan"
    ))
    console.print()

    # Load config
    config = load_config()
    console.print(f"[dim]Input directory: {config.input_dir}[/dim]")
    console.print(f"[dim]Target SR: {config.target_sample_rate} Hz | Mono: {config.mono}[/dim]")
    console.print()

    # Find convertible songs
    songs = find_convertible_songs(config.input_dir, config.supported_formats)

    if not songs:
        console.print(f"[red]No songs found in {config.input_dir}[/red]")
        console.print("[yellow]Expected structure: {input_dir}/Song Name/audio.m4a[/yellow]")
        return

    # Display selection
    selected_song = display_song_selection(songs)

    if not selected_song:
        return

    # Convert
    success = convert_song_to_wav(
        selected_song,
        config.target_sample_rate,
        config.mono,
        config.overwrite,
        config.supported_formats
    )

    if not success:
        console.print("[red]Conversion failed[/red]")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
