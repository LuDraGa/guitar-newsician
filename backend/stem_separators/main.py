"""
Stem Separator Main Entry Point
Interactive TUI for stem separation with Rich interface.
"""

from pathlib import Path
from typing import List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt
from rich import box
from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn, SpinnerColumn

from stem_separator import load_config, separate_stems, StemSeparatorConfig

console = Console()


def find_separable_songs(input_dir: Path, audio_exts: List[str]) -> List[Path]:
    """
    Find all song directories that have audio files (preferably audio.wav).

    Returns:
        List of song directory paths that contain audio files
    """
    if not input_dir.exists():
        return []

    separable = []
    for item in input_dir.iterdir():
        if not item.is_dir():
            continue

        # Prefer audio.wav, but accept other formats
        wav_file = item / "audio.wav"
        if wav_file.exists():
            separable.append(item)
            continue

        # Check for other audio formats
        for ext in audio_exts:
            audio_file = item / f"audio.{ext}"
            if audio_file.exists():
                separable.append(item)
                break

    return sorted(separable)


def display_song_selection(songs: List[Path], config: StemSeparatorConfig) -> Optional[Path]:
    """
    Display Rich TUI for song selection.

    Returns:
        Selected song directory path, or None if cancelled
    """
    if not songs:
        console.print("[red]No songs found![/red]")
        console.print(f"[yellow]Make sure {config.input_dir} contains song directories with audio files[/yellow]")
        return None

    # Create selection table
    table = Table(
        title="Available Songs for Stem Separation",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("#", justify="right", style="cyan")
    table.add_column("Song Directory", style="white")
    table.add_column("Audio File", style="green")
    table.add_column("Status", style="yellow")

    song_info = []
    for idx, song_dir in enumerate(songs, start=1):
        # Find audio file
        audio_file = song_dir / "audio.wav"
        if not audio_file.exists():
            for ext in config.audio_exts:
                potential = song_dir / f"audio.{ext}"
                if potential.exists():
                    audio_file = potential
                    break

        # Check if stems already exist
        stems_dir = song_dir / "stems"
        if stems_dir.exists():
            stem_files = list(stems_dir.glob(f"*.{config.codec}"))
            status = f"[dim]{len(stem_files)} stems[/dim]"
        else:
            status = "[bright_white]not separated[/bright_white]"

        song_info.append((song_dir, audio_file))
        table.add_row(
            str(idx),
            song_dir.name,
            audio_file.name if audio_file.exists() else "[red]no audio[/red]",
            status
        )

    console.print(table)
    console.print()

    # Show model info
    model_info = Table.grid(padding=(0, 2))
    model_info.add_row("[bold]Model:[/bold]", config.model)
    model_info.add_row("[bold]Device:[/bold]", config.device)
    model_info.add_row("[bold]Codec:[/bold]", config.codec)

    stems_count = "6 (vocals, drums, bass, other, piano, guitar)" if config.model == "htdemucs_6s" else \
                  "4 (vocals, drums, bass, other)" if config.model == "htdemucs" else \
                  "4 (vocals, drums, bass, other - fine-tuned)"

    model_info.add_row("[bold]Stems:[/bold]", stems_count)
    console.print(Panel(model_info, title="Configuration", border_style="dim"))
    console.print()

    # Prompt for selection
    choice = Prompt.ask(
        "[bold cyan]Select song to separate[/bold cyan]",
        choices=[str(i) for i in range(1, len(songs) + 1)] + ["q"],
        default="q"
    )

    if choice == "q":
        console.print("[yellow]Separation cancelled[/yellow]")
        return None

    return songs[int(choice) - 1]


def main():
    """Main entry point for interactive stem separation."""
    console.print(Panel.fit(
        "[bold cyan]Demucs Stem Separator[/bold cyan]\n"
        "Separate audio into individual stems (vocals, drums, bass, etc.)",
        border_style="cyan"
    ))
    console.print()

    # Load config
    config = load_config()
    console.print(f"[dim]Input directory: {config.input_dir}[/dim]")
    console.print(f"[dim]Model: {config.model} | Device: {config.device}[/dim]")
    console.print()

    # Find separable songs
    songs = find_separable_songs(config.input_dir, config.audio_exts)

    if not songs:
        console.print(f"[red]No songs found in {config.input_dir}[/red]")
        console.print("[yellow]Expected structure: {input_dir}/Song Name/audio.wav[/yellow]")
        return

    # Display selection
    selected_song = display_song_selection(songs, config)

    if not selected_song:
        return

    # Separate stems with progress tracking
    console.print()
    console.print(f"[cyan]Processing {selected_song.name}...[/cyan]")
    console.print()

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold]{task.description}"),
        BarColumn(),
        TextColumn("{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Initializing", total=100)

        def update_progress(status: str, percentage: int):
            progress.update(task, completed=percentage, description=status)

        result = separate_stems(selected_song, config, progress_callback=update_progress)

    if not result:
        console.print("[red]Stem separation failed[/red]")
        raise SystemExit(1)

    console.print()
    console.print(f"[green]✓ Stems saved to: {result}[/green]")
    console.print()

    # Show next steps
    next_steps = Table.grid(padding=(0, 2))
    next_steps.add_row("[bold cyan]Next steps:[/bold cyan]")
    next_steps.add_row("  1.", "Analyze individual stems using the analyzer")
    next_steps.add_row("  2.", f"Check {result} for separated audio files")
    console.print(Panel(next_steps, border_style="dim"))


if __name__ == "__main__":
    main()
