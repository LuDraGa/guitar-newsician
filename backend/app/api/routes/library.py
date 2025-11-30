"""Library management endpoints."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from ..services.library_service import LibraryService

router = APIRouter()
library_service = LibraryService()


@router.get("/library/scan")
async def scan_library():
    """Scan downloads directory and return all songs with their status."""
    try:
        songs = library_service.scan_library()
        return {
            "total": len(songs),
            "songs": songs,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan library: {str(e)}")


@router.get("/library/songs")
async def list_songs():
    """List all songs in the library."""
    try:
        songs = library_service.scan_library()
        return {"songs": songs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list songs: {str(e)}")


@router.get("/library/songs/{song_id}")
async def get_song(song_id: str):
    """Get detailed information about a specific song."""
    song_info = library_service.get_song(song_id)

    if not song_info:
        raise HTTPException(status_code=404, detail=f"Song not found: {song_id}")

    return song_info


@router.get("/library/songs/{song_id}/lyrics")
async def get_lyrics(song_id: str):
    """Get lyrics for a song."""
    lyrics = library_service.get_lyrics(song_id)

    if not lyrics["plain"] and not lyrics["synced"]:
        raise HTTPException(status_code=404, detail=f"No lyrics found for song: {song_id}")

    return lyrics


@router.get("/library/songs/{song_id}/analysis")
async def get_analysis(song_id: str):
    """Get analysis results for a song."""
    analysis = library_service.get_analysis(song_id)

    if not analysis:
        raise HTTPException(status_code=404, detail=f"No analysis found for song: {song_id}")

    return analysis


@router.get("/library/songs/{song_id}/audio")
async def stream_audio(song_id: str):
    """Stream audio file for a song."""
    import os
    from pathlib import Path

    song_info = library_service.get_song(song_id)

    if not song_info:
        raise HTTPException(status_code=404, detail=f"Song not found: {song_id}")

    # Prefer converted WAV file (better browser support), fallback to original
    audio_file = song_info.get("converted_file") or song_info.get("audio_file")

    if not audio_file or not os.path.exists(audio_file):
        raise HTTPException(status_code=404, detail=f"Audio file not found for song: {song_id}")

    # Detect proper media type based on file extension
    file_ext = Path(audio_file).suffix.lower()
    media_type_map = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".opus": "audio/ogg",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }
    media_type = media_type_map.get(file_ext, "audio/mpeg")

    return FileResponse(
        audio_file,
        media_type=media_type,
        filename=f"{song_id}{file_ext}",
    )


@router.get("/library/songs/{song_id}/stems/{stem_type}")
async def stream_stem(song_id: str, stem_type: str):
    """Stream a specific stem file for a song."""
    import os
    from pathlib import Path

    song_info = library_service.get_song(song_id)

    if not song_info or not song_info.get("stem_files"):
        raise HTTPException(status_code=404, detail=f"Stems not found for song: {song_id}")

    stem_files = song_info["stem_files"]
    if stem_type not in stem_files:
        raise HTTPException(status_code=404, detail=f"Stem '{stem_type}' not found for song: {song_id}")

    stem_path = stem_files[stem_type]

    if not os.path.exists(stem_path):
        raise HTTPException(status_code=404, detail=f"Stem file not found: {stem_path}")

    # Detect proper media type
    file_ext = Path(stem_path).suffix.lower()
    media_type = "audio/wav" if file_ext == ".wav" else "audio/mpeg"

    return FileResponse(
        stem_path,
        media_type=media_type,
        filename=f"{song_id}_{stem_type}{file_ext}",
    )


@router.delete("/library/songs/{song_id}")
async def delete_song(song_id: str):
    """Delete a song and all its associated files."""
    success = library_service.delete_song(song_id)

    if not success:
        raise HTTPException(status_code=404, detail=f"Failed to delete song: {song_id}")

    return {"message": f"Song deleted successfully: {song_id}"}
