"""Lyrics fetching endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import json
from ..services.library_service import LibraryService

router = APIRouter()
library_service = LibraryService()


class LyricsFetchRequest(BaseModel):
    """Request to fetch lyrics for a song."""
    song_id: str


@router.post("/lyrics/fetch")
async def fetch_lyrics(request: LyricsFetchRequest):
    """Fetch lyrics for a song using cascading strategy: YTMusic first, then syncedlyrics."""
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Get song info
        song_info = library_service.get_song(request.song_id)
        if not song_info:
            raise HTTPException(status_code=404, detail=f"Song not found: {request.song_id}")

        song_folder = Path(song_info["song_folder"])
        metadata = song_info.get("metadata", {})

        synced_lyrics = None
        plain_lyrics = None
        lyrics_source = []

        # Strategy 1: Try YTMusic API first (gets plain lyrics from YouTube Music)
        video_id = metadata.get("video_id")
        if video_id:
            try:
                logger.info(f"Attempting YTMusic lyrics fetch for video_id: {video_id}")
                from ytmusicapi import YTMusic
                from app.downloaders.yt_music_downloader.helpers import fetch_lyrics as fetch_ytmusic_lyrics

                ytmusic = YTMusic()
                ytm_synced, ytm_plain = fetch_ytmusic_lyrics(video_id, ytmusic)

                if ytm_synced:
                    synced_lyrics = ytm_synced
                    lyrics_source.append("YTMusic (synced)")
                    logger.info(f"YTMusic: Found synced lyrics for {request.song_id}")

                if ytm_plain:
                    plain_lyrics = ytm_plain
                    lyrics_source.append("YTMusic (plain)")
                    logger.info(f"YTMusic: Found plain lyrics for {request.song_id}")

            except Exception as e:
                logger.warning(f"YTMusic lyrics fetch failed: {str(e)}")
        else:
            logger.info("No video_id in metadata, skipping YTMusic")

        # Strategy 2: If no synced lyrics from YTMusic, try syncedlyrics
        if not synced_lyrics:
            try:
                logger.info(f"Attempting syncedlyrics fetch for {request.song_id}")
                from app.lyrics.synced_lyrics import fetch_synced_lyrics, has_syncedlyrics

                if has_syncedlyrics():
                    title = metadata.get("title", song_info.get("title", ""))
                    artist = metadata.get("artist", song_info.get("artist", ""))

                    if title:
                        result = fetch_synced_lyrics(
                            title=title,
                            artist=artist,
                            allow_unsynced=True  # Allow fallback to unsynced
                        )

                        if result.found and result.lyrics:
                            # syncedlyrics returns LRC format if synced
                            if '[' in result.lyrics and ']' in result.lyrics[:10]:
                                synced_lyrics = result.lyrics
                                lyrics_source.append(f"syncedlyrics/{result.provider} (synced)")
                                logger.info(f"syncedlyrics: Found synced lyrics via {result.provider}")
                            else:
                                # Unsynced fallback
                                if not plain_lyrics:  # Only if we don't have plain from YTMusic
                                    plain_lyrics = result.lyrics
                                    lyrics_source.append(f"syncedlyrics/{result.provider} (plain)")
                                    logger.info(f"syncedlyrics: Found plain lyrics via {result.provider}")
                else:
                    logger.info("syncedlyrics package not installed")

            except Exception as e:
                logger.warning(f"syncedlyrics fetch failed: {str(e)}")

        # Save lyrics to song folder
        lyrics_info = {"has_synced_lyrics": False, "has_plain_lyrics": False}

        if synced_lyrics:
            lyrics_lrc = song_folder / "lyrics.lrc"
            lyrics_lrc.write_text(synced_lyrics, encoding="utf-8")
            lyrics_info["has_synced_lyrics"] = True
            logger.info(f"Saved synced lyrics to {lyrics_lrc}")

        if plain_lyrics:
            lyrics_txt = song_folder / "lyrics.txt"
            lyrics_txt.write_text(plain_lyrics, encoding="utf-8")
            lyrics_info["has_plain_lyrics"] = True
            logger.info(f"Saved plain lyrics to {lyrics_txt}")

        # Update metadata.json
        metadata_path = song_folder / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata_dict = json.load(f)
            metadata_dict.update(lyrics_info)
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(metadata_dict, f, indent=2, ensure_ascii=False)

        if not synced_lyrics and not plain_lyrics:
            return {
                "success": False,
                "message": "No lyrics available for this song from any source",
                "has_synced_lyrics": False,
                "has_plain_lyrics": False,
                "sources_tried": ["YTMusic", "syncedlyrics"]
            }

        return {
            "success": True,
            "message": f"Lyrics fetched successfully from: {', '.join(lyrics_source)}",
            "has_synced_lyrics": lyrics_info["has_synced_lyrics"],
            "has_plain_lyrics": lyrics_info["has_plain_lyrics"],
            "sources": lyrics_source
        }

    except Exception as e:
        logger.error(f"Lyrics fetch failed for {request.song_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch lyrics: {str(e)}")
