"""Utilities for working with lyrics data."""

from .synced_lyrics import (
    SyncedLyricsUnavailableError,
    fetch_synced_lyrics,
    has_syncedlyrics,
)

__all__ = [
    "SyncedLyricsUnavailableError",
    "fetch_synced_lyrics",
    "has_syncedlyrics",
]
