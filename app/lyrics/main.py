"""
Synced Lyrics Fetcher
Fetch synced lyrics for songs using Rich TUI (follows analyzer/converter patterns).
"""

from __future__ import annotations
from pathlib import Path
from typing import List, Optional
import yaml
import json
from pydantic import BaseModel, Field
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.text import Text
from rich import box
from rich.syntax import Syntax

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from synced_lyrics import fetch_synced_lyrics, has_syncedlyrics

console = Console()
CONFIG_PATH = Path(__file__).parent / "config.yaml"


# ============================================================================
# Configuration Model
# ============================================================================


class LyricsConfig(BaseModel):
    """Configuration for synced lyrics fetcher."""

    input_dir: Path = Field(default=Path("downloads"), description="Input directory with song folders")
    providers: Optional[List[str]] = Field(default=None, description="Lyrics providers to use")
    allow_unsynced: bool = Field(default=False, description="Allow unsynced lyrics fallback")
    overwrite: bool = Field(default=False, description="Overwrite existing lyrics files")
    output_filename: str = Field(default="lyrics.lrc", description="Output filename for lyrics")
    show_preview: bool = Field(default=True, description="Show lyrics preview after fetching")
    max_preview_lines: int = Field(default=10, description="Max lines to preview")


def load_config() -> LyricsConfig:
    """Load configuration from YAML file."""
    if not CONFIG_PATH.exists():
        console.print(f"[yellow]Config not found at {CONFIG_PATH}, using defaults[/yellow]")
        return LyricsConfig()

    with open(CONFIG_PATH, "r") as f:
        data = yaml.safe_load(f)

    return LyricsConfig(**data)


def find_songs_with_metadata(input_dir: Path) -> List[tuple[Path, dict]]:
    """
    Find all song directories that have metadata.json files.

    Returns:
        List of (song_dir, metadata) tuples
    """
    if not input_dir.exists():
        return []

    songs = []
    for item in input_dir.iterdir():
        if not item.is_dir():
            continue

        metadata_file = item / "metadata.json"
        if metadata_file.exists():
            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                songs.append((item, metadata))
            except Exception:
                continue

    return sorted(songs, key=lambda x: x[0].name)


def display_song_selection(songs: List[tuple[Path, dict]], config: LyricsConfig) -> Optional[tuple[Path, dict]]:
    """
    Display Rich TUI for song selection.

    Returns:
        Selected (song_dir, metadata) tuple, or None if cancelled
    """
    if not songs:
        console.print("[red]No songs with metadata.json found![/red]")
        console.print(f"[yellow]Make sure songs in {config.input_dir} have metadata.json files[/yellow]")
        return None

    # Create selection table
    table = Table(
        title="Available Songs",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("#", justify="right", style="cyan")
    table.add_column("Title", style="white")
    table.add_column("Artist", style="green")
    table.add_column("Lyrics Status", style="yellow")

    for idx, (song_dir, metadata) in enumerate(songs, start=1):
        title = metadata.get("title", song_dir.name)
        artist = metadata.get("artist", "Unknown")

        # Check if lyrics already exist
        lyrics_file = song_dir / config.output_filename
        if lyrics_file.exists():
            status = "[dim]✓ exists[/dim]"
        else:
            status = "[bright_white]not fetched[/bright_white]"

        table.add_row(str(idx), title, artist, status)

    console.print(table)
    console.print()

    # Prompt for selection
    choices = [str(i) for i in range(1, len(songs) + 1)] + ["all", "q"]
    choice = Prompt.ask(
        "[bold cyan]Select song (or 'all' for all songs)[/bold cyan]",
        choices=choices,
        default="q"
    )

    if choice == "q":
        console.print("[yellow]Lyrics fetch cancelled[/yellow]")
        return None

    if choice == "all":
        return "all"

    return songs[int(choice) - 1]


def fetch_and_save_lyrics(
    song_dir: Path,
    metadata: dict,
    config: LyricsConfig
) -> bool:
    """
    Fetch and save lyrics for a single song.

    Args:
        song_dir: Song directory path
        metadata: Song metadata dict
        config: Lyrics configuration

    Returns:
        True if successful, False otherwise
    """
    title = metadata.get("title", metadata.get("track", ""))
    artist = metadata.get("artist", "")

    if not title:
        console.print(f"[red]✗ No title found in metadata for {song_dir.name}[/red]")
        return False

    lyrics_file = song_dir / config.output_filename

    # Check if already exists
    if lyrics_file.exists() and not config.overwrite:
        overwrite = Confirm.ask(
            f"[yellow]Lyrics exist for {title}. Overwrite?[/yellow]",
            default=False
        )
        if not overwrite:
            console.print("[dim]Skipping...[/dim]")
            return False

    # Fetch lyrics
    console.print(f"[cyan]Fetching lyrics for: {title} - {artist}[/cyan]")

    try:
        result = fetch_synced_lyrics(
            title=title,
            artist=artist,
            providers=config.providers,
            allow_unsynced=config.allow_unsynced
        )

        if not result.found or not result.lyrics:
            console.print(f"[red]✗ No lyrics found for {title}[/red]")
            if result.provider:
                console.print(f"[dim]Tried provider: {result.provider}[/dim]")
            return False

        # Save lyrics
        lyrics_file.write_text(result.lyrics, encoding="utf-8")

        console.print(f"[green]✓ Lyrics saved: {lyrics_file.name}[/green]")
        if result.provider:
            console.print(f"[dim]Provider: {result.provider}[/dim]")

        # Show preview if enabled
        if config.show_preview:
            preview_lyrics(result.lyrics, config.max_preview_lines)

        return True

    except Exception as e:
        console.print(f"[red]✗ Error fetching lyrics: {e}[/red]")
        return False


def preview_lyrics(lyrics: str, max_lines: int = 10) -> None:
    """Display a preview of the fetched lyrics."""
    lines = lyrics.strip().split("\n")
    preview_lines = lines[:max_lines]

    preview_text = "\n".join(preview_lines)
    if len(lines) > max_lines:
        preview_text += f"\n[dim]... ({len(lines) - max_lines} more lines)[/dim]"

    console.print()
    console.print(Panel(
        Text(preview_text, style="dim white"),
        title="[bold]Lyrics Preview[/bold]",
        border_style="magenta",
        box=box.ROUNDED
    ))


def main():
    """Main entry point for interactive lyrics fetching."""
    console.print(Panel.fit(
        "[bold cyan]Synced Lyrics Fetcher[/bold cyan]\n"
        "Fetch synced lyrics from online providers",
        border_style="cyan"
    ))
    console.print()

    # Check if syncedlyrics is available
    if not has_syncedlyrics():
        console.print(Panel(
            "[red]syncedlyrics package not installed![/red]\n\n"
            "Install it with:\n"
            "[cyan]uv add syncedlyrics[/cyan]",
            border_style="red",
            box=box.ROUNDED
        ))
        return

    # Load config
    config = load_config()
    console.print(f"[dim]Input directory: {config.input_dir}[/dim]")
    console.print(f"[dim]Providers: {config.providers or 'all'}[/dim]")
    console.print()

    # Find songs with metadata
    songs = find_songs_with_metadata(config.input_dir)

    if not songs:
        console.print(f"[red]No songs with metadata.json found in {config.input_dir}[/red]")
        console.print("[yellow]Download songs using the downloader first[/yellow]")
        return

    # Display song selection
    selection = display_song_selection(songs, config)

    if not selection:
        return

    # Process selection
    if selection == "all":
        console.print()
        console.print(f"[bold cyan]Fetching lyrics for {len(songs)} song(s)...[/bold cyan]")
        console.print()

        success_count = 0
        for song_dir, metadata in songs:
            console.print(f"[bold]{song_dir.name}[/bold]")
            if fetch_and_save_lyrics(song_dir, metadata, config):
                success_count += 1
            console.print()

        console.print(f"[green]✓ Successfully fetched {success_count}/{len(songs)} lyrics[/green]")
    else:
        song_dir, metadata = selection
        console.print()
        fetch_and_save_lyrics(song_dir, metadata, config)


if __name__ == "__main__":
    main()
