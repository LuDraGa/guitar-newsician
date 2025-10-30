"""Helper functions for metadata and lyrics processing."""

import json
import re
from pathlib import Path
from typing import Optional, Dict, Any

from ytmusicapi import YTMusic
from rich.console import Console

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


def fetch_lyrics(video_id: str, ytmusic: YTMusic) -> tuple[Optional[str], Optional[str]]:
    """Fetch lyrics from YouTube Music API.

    Returns:
        (synced_lyrics, plain_lyrics) - Either or both can be None
    """
    try:
        watch_playlist = ytmusic.get_watch_playlist(video_id)
        if not watch_playlist or not watch_playlist.get("lyrics"):
            return None, None

        lyrics_data = ytmusic.get_lyrics(watch_playlist["lyrics"])
        if not lyrics_data or not lyrics_data.get("lyrics"):
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
    except Exception:
        return None, None


def process_track_lyrics_and_metadata(
    track_info: Dict[str, Any],
    output_dir: Path,
    create_metadata: bool = True
) -> Dict[str, bool]:
    """Process lyrics and metadata for a single track.

    Args:
        track_info: yt-dlp info dict for the track
        output_dir: Directory where track files are saved
        create_metadata: Whether to create/update metadata.json

    Returns:
        Dict with has_synced_lyrics and has_plain_lyrics flags
    """
    lyrics_info = {"has_synced_lyrics": False, "has_plain_lyrics": False}

    # Extract video ID
    video_id = track_info.get("id")
    if not video_id:
        # Try to extract from URL
        webpage_url = track_info.get("webpage_url", "")
        video_id = extract_video_id(webpage_url)

    if not video_id:
        console.print(f"  [yellow]⚠ Could not extract video ID, skipping lyrics[/]")
        return lyrics_info

    # Fetch lyrics
    try:
        console.print(f"  [cyan]Fetching lyrics...[/]")
        ytmusic = YTMusic()
        synced_lyrics, plain_lyrics = fetch_lyrics(video_id, ytmusic)

        if synced_lyrics:
            lyrics_path = output_dir / "lyrics.lrc"
            lyrics_path.write_text(synced_lyrics, encoding="utf-8")
            console.print(f"  [green]✓ Synced lyrics saved[/]")
            lyrics_info["has_synced_lyrics"] = True

        if plain_lyrics:
            lyrics_txt_path = output_dir / "lyrics.txt"
            lyrics_txt_path.write_text(plain_lyrics, encoding="utf-8")
            if not synced_lyrics:
                console.print(f"  [green]✓ Plain lyrics saved[/]")
            lyrics_info["has_plain_lyrics"] = True

        if not synced_lyrics and not plain_lyrics:
            console.print(f"  [dim]No lyrics available[/]")

    except Exception as e:
        console.print(f"  [yellow]Warning: Failed to fetch lyrics: {e}[/]")

    # Update metadata.json with lyrics info
    if create_metadata and output_dir:
        metadata_path = output_dir / "metadata.json"
        if metadata_path.exists():
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                metadata.update(lyrics_info)
                with open(metadata_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f, indent=2, ensure_ascii=False)
            except Exception as e:
                console.print(f"  [yellow]Warning: Failed to update metadata: {e}[/]")

    return lyrics_info
