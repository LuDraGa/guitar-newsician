"""Helper utilities for retrieving synced lyrics from third-party providers.

This module wraps the optional :mod:`syncedlyrics` package and presents a
resilient API that the rest of the codebase can consume without having to
know about provider quirks or return types.  All functions silently handle the
library being missing so existing flows continue to work if the dependency has
not been installed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Optional

try:  # pragma: no cover - dependency is optional at runtime
    import syncedlyrics as _syncedlyrics
except Exception:  # pragma: no cover - we keep the API stable without import
    _syncedlyrics = None  # type: ignore[assignment]


class SyncedLyricsUnavailableError(RuntimeError):
    """Raised when synced lyrics are requested but the backend is unavailable."""


@dataclass(slots=True)
class SyncedLyricsResult:
    """Container describing the outcome of a synced lyrics lookup."""

    query: str
    provider: Optional[str]
    lyrics: Optional[str]

    @property
    def found(self) -> bool:
        return bool(self.lyrics)


def has_syncedlyrics() -> bool:
    """Return ``True`` if the optional :mod:`syncedlyrics` package is available."""

    return _syncedlyrics is not None


def _extract_text(candidate: Any) -> Optional[str]:
    """Best-effort extraction of the LRC text from various return types."""

    if candidate is None:
        return None

    if isinstance(candidate, str):
        text = candidate.strip()
        return text or None

    if isinstance(candidate, dict):
        for key in ("lyrics", "syncedLyrics", "lrc", "synced_lyrics"):
            value = candidate.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    for attr in ("lyrics", "synced_lyrics", "syncedLyrics", "lrc"):
        value = getattr(candidate, attr, None)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def _normalise_result(raw: Any) -> Optional[str]:
    """Flatten the different structures returned by ``syncedlyrics.search``."""

    text = _extract_text(raw)
    if text:
        return text

    if isinstance(raw, Iterable) and not isinstance(raw, (str, bytes, dict)):
        for item in raw:
            text = _extract_text(item)
            if text:
                return text

    return None


def fetch_synced_lyrics(
    title: str,
    artist: Optional[str] = None,
    *,
    providers: Optional[Iterable[str]] = None,
    allow_unsynced: bool = False,
) -> SyncedLyricsResult:
    """Attempt to fetch synced lyrics for ``title``/``artist``.

    Args:
        title: Track title.
        artist: Optional artist name to improve search accuracy.
        providers: Optional iterable restricting the providers used by
            ``syncedlyrics``.
        allow_unsynced: If ``True`` the search will fall back to unsynchronised
            lyrics if no timestamped version is found.

    Returns:
        :class:`SyncedLyricsResult` describing the outcome. ``result.lyrics`` is
        ``None`` when no match is found or the dependency is missing.
    """

    query = title.strip()
    if artist:
        query = f"{query} {artist.strip()}".strip()

    if not has_syncedlyrics():
        return SyncedLyricsResult(query=query, provider=None, lyrics=None)

    search_kwargs: dict[str, Any] = {
        "synced_only": not allow_unsynced,
    }

    if providers is not None:
        search_kwargs["providers"] = list(providers)

    # Some versions of the library use ``only_synced`` instead of
    # ``synced_only``. We attempt both to maintain compatibility.
    try:  # pragma: no cover - exercised at runtime with the dependency present
        raw_result = _syncedlyrics.search(query, **search_kwargs)
        provider_used = getattr(raw_result, "provider", None)
    except TypeError:
        search_kwargs.pop("synced_only", None)
        search_kwargs["only_synced"] = not allow_unsynced
        raw_result = _syncedlyrics.search(query, **search_kwargs)
        provider_used = getattr(raw_result, "provider", None)
    except Exception:
        return SyncedLyricsResult(query=query, provider=None, lyrics=None)

    lyrics_text = _normalise_result(raw_result)
    return SyncedLyricsResult(
        query=query,
        provider=provider_used,
        lyrics=lyrics_text,
    )


__all__ = [
    "SyncedLyricsResult",
    "SyncedLyricsUnavailableError",
    "fetch_synced_lyrics",
    "has_syncedlyrics",
]
