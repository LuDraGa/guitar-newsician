#!/usr/bin/env python3
"""Process existing downloaded tracks to add metadata and lyrics."""

import sys
import json
from pathlib import Path
from rich.console import Console
from rich.prompt import Prompt
from yt_dlp import YoutubeDL

# Import helpers
try:
    from helpers import process_track_lyrics_and_metadata
except ImportError:
    from .helpers import process_track_lyrics_and_metadata

console = Console()


def main():
    """Process a single directory to add metadata and lyrics."""

    if len(sys.argv) > 1:
        dir_path = Path(sys.argv[1])
    else:
        dir_path = Prompt.ask("[cyan]Enter directory path[/]")
        dir_path = Path(dir_path)

    if not dir_path.exists() or not dir_path.is_dir():
        console.print(f"[red]Directory not found: {dir_path}[/]")
        return

    # Check for audio file
    audio_file = dir_path / "audio.m4a"
    if not audio_file.exists():
        console.print(f"[red]No audio.m4a found in {dir_path}[/]")
        return

    console.print(f"\n[cyan]Processing:[/] {dir_path.name}\n")

    # Get video URL
    url = Prompt.ask("[green]Paste YouTube Music URL for this track[/]")

    # Fetch info from yt-dlp
    console.print("[cyan]Fetching track info...[/]")
    with YoutubeDL({"quiet": True}) as ydl:
        track_info = ydl.extract_info(url, download=False)

    # Create metadata.json
    console.print("[cyan]Creating metadata.json...[/]")
    metadata = {
        "video_id": track_info.get("id"),
        "title": track_info.get("title"),
        "artist": track_info.get("artist") or track_info.get("uploader") or track_info.get("channel"),
        "album": track_info.get("album"),
        "track": track_info.get("track"),
        "duration": track_info.get("duration"),
        "upload_date": track_info.get("upload_date"),
        "description": track_info.get("description"),
        "thumbnail": track_info.get("thumbnail"),
        "webpage_url": track_info.get("webpage_url"),
    }
    metadata = {k: v for k, v in metadata.items() if v is not None}

    metadata_path = dir_path / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    console.print("[green]✓ Metadata created[/]")

    # Process lyrics
    process_track_lyrics_and_metadata(
        track_info,
        dir_path,
        create_metadata=True
    )

    # Show results
    files = sorted(dir_path.iterdir())
    console.print(f"\n[green]Files in {dir_path.name}:[/]")
    for f in files:
        console.print(f"  • {f.name}")


if __name__ == "__main__":
    main()
