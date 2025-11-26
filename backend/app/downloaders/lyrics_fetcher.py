#!/usr/bin/env python3
"""Fetch synced lyrics from YouTube Music using ytmusicapi."""

import re
from pathlib import Path
from typing import Optional

from ytmusicapi import YTMusic
from rich.console import Console
from rich.panel import Panel

console = Console()


def extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube/YouTube Music URL."""
    patterns = [
        r'(?:v=|/)([0-9A-Za-z_-]{11}).*',
        r'youtu\.be/([0-9A-Za-z_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def format_lrc_timestamp(milliseconds: int) -> str:
    """Convert milliseconds to LRC timestamp format [mm:ss.xx]."""
    total_seconds = milliseconds / 1000
    minutes = int(total_seconds // 60)
    seconds = total_seconds % 60
    return f"[{minutes:02d}:{seconds:05.2f}]"


def fetch_lyrics(video_id: str) -> tuple[Optional[str], Optional[str]]:
    """Fetch lyrics from YouTube Music API.

    Returns:
        (synced_lyrics, plain_lyrics) - Either or both can be None
    """
    ytmusic = YTMusic()

    try:
        watch_playlist = ytmusic.get_watch_playlist(video_id)

        if not watch_playlist or not watch_playlist.get("lyrics"):
            console.print("[yellow]No lyrics available for this track[/]")
            return None, None

        lyrics_data = ytmusic.get_lyrics(watch_playlist["lyrics"])

        if not lyrics_data or not lyrics_data.get("lyrics"):
            console.print("[yellow]Could not fetch lyrics[/]")
            return None, None

        synced_lyrics = None
        plain_lyrics = None

        # Check for synced lyrics (with timestamps)
        if lyrics_data.get("hasTimestamps"):
            lrc_lines = [
                f"{format_lrc_timestamp(line['start_time'])}{line['text']}"
                for line in lyrics_data["lyrics"]
            ]
            synced_lyrics = "\n".join(lrc_lines)

        # Get plain text version
        if isinstance(lyrics_data["lyrics"], list):
            plain_lines = [line["text"] for line in lyrics_data["lyrics"]]
            plain_lyrics = "\n".join(plain_lines)
        elif isinstance(lyrics_data["lyrics"], str):
            plain_lyrics = lyrics_data["lyrics"]

        return synced_lyrics, plain_lyrics

    except Exception as e:
        console.print(f"[red]Error fetching lyrics: {e}[/]")
        return None, None


def save_lyrics(lyrics: str, output_path: Path):
    """Save lyrics to file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(lyrics, encoding="utf-8")
    console.print(f"[green]✓ Lyrics saved to: {output_path}[/]")


def main():
    """Main CLI entry point."""
    console.print(
        Panel.fit(
            "[bold white]YouTube Music Lyrics Fetcher[/]",
            title="[bold cyan]lyrics-fetcher[/]",
            border_style="cyan",
        )
    )

    from rich.prompt import Prompt

    url = Prompt.ask("[bold green]Paste YouTube Music URL[/]")

    video_id = extract_video_id(url)
    if not video_id:
        console.print("[red]Invalid URL[/]")
        return

    console.print(f"\n[cyan]Video ID:[/] {video_id}")
    console.print("[cyan]Fetching lyrics...[/]\n")

    synced_lyrics, plain_lyrics = fetch_lyrics(video_id)

    if synced_lyrics:
        # Save synced lyrics
        output_path = Path(f"lyrics_{video_id}.lrc")
        save_lyrics(synced_lyrics, output_path)

        # Show preview
        lines = synced_lyrics.split("\n")[:5]
        console.print("\n[dim]Synced Lyrics Preview:[/]")
        for line in lines:
            console.print(f"  {line}")
        if len(synced_lyrics.split("\n")) > 5:
            console.print("  ...")

    if plain_lyrics:
        # Save plain lyrics
        output_path = Path(f"lyrics_{video_id}.txt")
        save_lyrics(plain_lyrics, output_path)

        if not synced_lyrics:
            # Show preview if we didn't already show synced
            lines = plain_lyrics.split("\n")[:5]
            console.print("\n[dim]Plain Lyrics Preview:[/]")
            for line in lines:
                console.print(f"  {line}")
            if len(plain_lyrics.split("\n")) > 5:
                console.print("  ...")

    if not synced_lyrics and not plain_lyrics:
        console.print("[yellow]No lyrics available[/]")


if __name__ == "__main__":
    main()
