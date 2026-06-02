"""Minimal YouTube Music lyrics helpers for the local download backend."""

from typing import Optional

from ytmusicapi import YTMusic


def format_lrc_timestamp(milliseconds: int) -> str:
    """Convert milliseconds to LRC timestamp format."""
    total_seconds = milliseconds / 1000
    minutes = int(total_seconds // 60)
    seconds = total_seconds % 60
    return f"[{minutes:02d}:{seconds:05.2f}]"


def fetch_lyrics(video_id: str, ytmusic: YTMusic) -> tuple[Optional[str], Optional[str]]:
    """Fetch synced and plain lyrics from YouTube Music when available."""
    try:
        watch_playlist = ytmusic.get_watch_playlist(video_id)
        if not watch_playlist or not watch_playlist.get("lyrics"):
            return None, None

        lyrics_data = ytmusic.get_lyrics(watch_playlist["lyrics"])
        if not lyrics_data or not lyrics_data.get("lyrics"):
            return None, None

        synced_lyrics = None
        plain_lyrics = None
        lyrics = lyrics_data["lyrics"]

        if lyrics_data.get("hasTimestamps") and isinstance(lyrics, list):
            synced_lyrics = "\n".join(
                f"{format_lrc_timestamp(line['start_time'])}{line['text']}"
                for line in lyrics
            )

        if isinstance(lyrics, list):
            plain_lyrics = "\n".join(line["text"] for line in lyrics)
        elif isinstance(lyrics, str):
            plain_lyrics = lyrics

        return synced_lyrics, plain_lyrics
    except Exception:
        return None, None
