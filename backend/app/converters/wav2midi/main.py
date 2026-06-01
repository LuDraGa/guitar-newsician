"""
WAV to MIDI Converter Main Entry Point
Interactive TUI for audio to MIDI conversion with Rich interface.
"""

from pathlib import Path
from typing import List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt
from rich import box

from wav2midi_converter import load_config, convert_song_to_midi, find_audio_files, Wav2MidiConfig

console = Console()


def find_convertible_songs(input_dir: Path, config: Wav2MidiConfig) -> List[Path]:
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

        # Check for main audio or stems
        audio_files = find_audio_files(item, config)
        if audio_files['main'] or audio_files['stems']:
            convertible.append(item)

    return sorted(convertible)


def display_song_selection(songs: List[Path], config: Wav2MidiConfig) -> Optional[Path]:
    """
    Display Rich TUI for song selection.

    Returns:
        Selected song directory path, or None if cancelled
    """
    if not songs:
        console.print("[red]No songs with audio files found![/red]")
        console.print(f"[yellow]Make sure {config.input_dir} contains song directories with audio files[/yellow]")
        return None

    # Create selection table
    table = Table(
        title="Available Songs for MIDI Conversion",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("#", justify="right", style="cyan")
    table.add_column("Song Directory", style="white")
    table.add_column("Main Audio", style="green")
    table.add_column("Stems", style="yellow")
    table.add_column("MIDI Status", style="magenta")

    song_info = []
    for idx, song_dir in enumerate(songs, start=1):
        # Check for audio files
        audio_files = find_audio_files(song_dir, config)
        has_main = audio_files['main'] is not None
        stem_count = len(audio_files['stems'])

        # Check for existing MIDI files
        main_midi = song_dir / "audio.mid"
        stems_dir = song_dir / "stems"
        midi_stems = []
        if stems_dir.exists():
            midi_stems = list(stems_dir.glob("*.mid"))

        # Status
        midi_status_parts = []
        if main_midi.exists():
            midi_status_parts.append("main")
        if midi_stems:
            midi_status_parts.append(f"{len(midi_stems)} stems")
        midi_status = ", ".join(midi_status_parts) if midi_status_parts else "none"

        song_info.append((song_dir, has_main, stem_count))
        table.add_row(
            str(idx),
            song_dir.name,
            "✓" if has_main else "✗",
            str(stem_count) if stem_count > 0 else "✗",
            midi_status
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


def display_stem_selection(stems: List[Path]) -> Optional[List[str]]:
    """
    Display stem selection menu.

    Returns:
        List of selected stem names, empty list for none, or None to cancel
    """
    if not stems:
        return []

    console.print()
    console.print(Panel.fit(
        "[bold cyan]Select Stems to Convert[/bold cyan]",
        border_style="cyan"
    ))
    console.print()

    # Create stem selection table
    table = Table(
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("#", justify="right", style="cyan")
    table.add_column("Stem Name", style="white")
    table.add_column("Format", style="green")

    stem_names = []
    for idx, stem_file in enumerate(stems, start=1):
        stem_names.append(stem_file.stem)
        table.add_row(
            str(idx),
            stem_file.stem,
            stem_file.suffix.upper().lstrip(".")
        )

    console.print(table)
    console.print()
    console.print("[dim]Options:[/dim]")
    console.print("  [bold]all[/bold]     - Convert all stems")
    console.print("  [bold]none[/bold]    - Skip stems")
    console.print("  [bold]1,2,3[/bold]   - Select specific stems (comma-separated)")
    console.print("  [bold]q[/bold]       - Cancel")
    console.print()

    choice = Prompt.ask(
        "[bold cyan]Select stems[/bold cyan]",
        default="all"
    )

    if choice == "q":
        return None
    elif choice == "all":
        return stem_names
    elif choice == "none":
        return []
    else:
        # Parse comma-separated indices
        try:
            indices = [int(x.strip()) for x in choice.split(",")]
            selected = []
            for idx in indices:
                if 1 <= idx <= len(stem_names):
                    selected.append(stem_names[idx - 1])
                else:
                    console.print(f"[yellow]Warning: Index {idx} out of range, skipping[/yellow]")
            return selected
        except ValueError:
            console.print("[red]Invalid input, converting all stems[/red]")
            return stem_names


def display_conversion_options(song_dir: Path, audio_files: dict) -> dict:
    """
    Display conversion options and get user selection.

    Returns:
        Dict with 'convert_main' and 'stem_names' keys
    """
    has_main = audio_files['main'] is not None
    has_stems = len(audio_files['stems']) > 0

    console.print()
    console.print(Panel.fit(
        f"[bold]Song:[/bold] {song_dir.name}\n"
        f"[bold]Main audio:[/bold] {'✓ ' + audio_files['main'].name if has_main else '✗'}\n"
        f"[bold]Stems:[/bold] {len(audio_files['stems'])} files",
        border_style="cyan"
    ))
    console.print()

    # Get main audio conversion choice
    convert_main = False
    if has_main:
        convert_main = Prompt.ask(
            "[bold cyan]Convert main audio?[/bold cyan]",
            choices=["y", "n"],
            default="y"
        ) == "y"

    # Get stem selection
    stem_names = None
    if has_stems:
        stem_names = display_stem_selection(audio_files['stems'])
        if stem_names is None:
            # User cancelled
            return {'convert_main': False, 'stem_names': None}

    return {
        'convert_main': convert_main,
        'stem_names': stem_names if stem_names else []
    }


def display_results(results: dict):
    """Display conversion results in a nice table."""
    console.print()
    console.print("[bold green]Conversion Complete![/bold green]")
    console.print()

    # Create results table
    table = Table(
        title="Conversion Results",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("File", style="white")
    table.add_column("Status", style="green")
    table.add_column("Output", style="dim")

    # Main audio
    if results['main']:
        status = "✓" if results['main'].get('success') else "✗"
        if results['main'].get('skipped'):
            status = "⊘ skipped"
        path = results['main'].get('path', 'N/A')
        table.add_row("Main audio", status, path)

    # Stems
    for stem_name, stem_result in results['stems'].items():
        status = "✓" if stem_result.get('success') else "✗"
        if stem_result.get('skipped'):
            status = "⊘ skipped"
        path = stem_result.get('path', 'N/A')
        table.add_row(f"Stem: {stem_name}", status, path)

    console.print(table)
    console.print()

    # Summary
    total = results['success_count'] + results['fail_count']
    console.print(f"[bold]Summary:[/bold] {results['success_count']}/{total} successful")

    if results['fail_count'] > 0:
        console.print(f"[yellow]{results['fail_count']} conversions failed[/yellow]")


def main():
    """Main entry point for interactive audio to MIDI conversion."""
    console.print(Panel.fit(
        "[bold cyan]Audio to MIDI Converter[/bold cyan]\n"
        "Powered by Spotify's basic-pitch",
        border_style="cyan"
    ))
    console.print()

    # Load config
    config = load_config()
    console.print(f"[dim]Input directory: {config.input_dir}[/dim]")
    console.print(f"[dim]Stems mode: {config.stems_mode} | Skip existing: {config.skip_existing}[/dim]")
    console.print()

    # Find convertible songs
    songs = find_convertible_songs(config.input_dir, config)

    if not songs:
        console.print(f"[red]No songs found in {config.input_dir}[/red]")
        console.print("[yellow]Expected: song directories with audio.wav/mp3/etc or stems/*.wav[/yellow]")
        return

    # Display selection
    selected_song = display_song_selection(songs, config)

    if not selected_song:
        return

    # Find audio files in selected song
    audio_files = find_audio_files(selected_song, config)

    # Get conversion options
    options = display_conversion_options(selected_song, audio_files)

    if not options['convert_main'] and not options['stem_names']:
        console.print("[yellow]No files selected for conversion[/yellow]")
        return

    if options['stem_names'] is None:
        console.print("[yellow]Conversion cancelled[/yellow]")
        return

    # Convert
    console.print()
    console.print(f"[cyan]Converting {selected_song.name}...[/cyan]")
    console.print()

    results = convert_song_to_midi(
        selected_song,
        config,
        convert_main=options['convert_main'],
        stem_names=options['stem_names'] if options['stem_names'] else None
    )

    # Display results
    display_results(results)

    # Show next steps
    console.print()
    next_steps = Table.grid(padding=(0, 2))
    next_steps.add_row("[bold cyan]Next steps:[/bold cyan]")
    next_steps.add_row("  1.", "Open MIDI files in your DAW or MIDI editor")
    next_steps.add_row("  2.", "Use for music transcription or remixing")
    next_steps.add_row("  3.", "Adjust config.yaml thresholds for better results")
    console.print(Panel(next_steps, border_style="dim"))


if __name__ == "__main__":
    main()
