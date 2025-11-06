"""Library service for managing and scanning song collections."""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from ..config import get_config
from ..utils.path_helpers import find_audio_file, get_song_id_from_path


class LibraryService:
    """Service for scanning and managing the music library."""

    def scan_library(self) -> List[Dict[str, Any]]:
        """Scan downloads directory and return all songs with their status."""
        config = get_config()
        downloads_dir = config.downloads_dir

        if not downloads_dir.exists():
            return []

        songs = []

        # Scan for song folders (organize_by_song = true)
        for item in downloads_dir.iterdir():
            if item.is_dir() and not item.name.startswith("."):
                song_info = self._get_song_info(item)
                if song_info:
                    songs.append(song_info)

        # Also check for loose audio files (old structure)
        audio_extensions = [".m4a", ".mp3", ".wav", ".flac", ".opus", ".aac", ".ogg"]
        for item in downloads_dir.iterdir():
            if item.is_file() and item.suffix.lower() in audio_extensions:
                # Create minimal song info for loose files
                song_info = {
                    "song_id": item.stem,
                    "song_folder": str(downloads_dir),
                    "title": item.stem,
                    "audio_file": str(item),
                    "has_audio": True,
                    "has_converted": False,
                    "has_analysis": False,
                    "has_stems": False,
                    "has_lyrics": False,
                    "has_synced_lyrics": False,
                    "metadata": {},
                }
                songs.append(song_info)

        return songs

    def _get_song_info(self, song_folder: Path) -> Optional[Dict[str, Any]]:
        """Get detailed information about a song from its folder."""
        config = get_config()

        # Find audio file
        audio_file = find_audio_file(song_folder)
        if not audio_file:
            return None

        song_id = get_song_id_from_path(song_folder)

        # Check for metadata.json
        metadata = {}
        metadata_file = song_folder / "metadata.json"
        if metadata_file.exists():
            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
            except:
                pass

        # Check for converted file
        converted_file = song_folder / "converted.wav"
        has_converted = converted_file.exists()

        # Check for analysis
        analysis_file = song_folder / "analysis.json"
        has_analysis = analysis_file.exists()

        # Check for stems folder
        stems_folder = config.get_stems_folder(song_folder)
        has_stems = stems_folder.exists() and any(
            f.suffix == ".wav" for f in stems_folder.iterdir() if f.is_file()
        )

        # Get stem files if they exist
        stem_files = {}
        if has_stems:
            for stem_type in ["vocals", "drums", "bass", "other"]:
                stem_file = stems_folder / f"{stem_type}.wav"
                if stem_file.exists():
                    stem_files[stem_type] = str(stem_file)

        # Check for stem analysis
        stem_analysis_folder = config.get_stem_analysis_folder(song_folder)
        has_stem_analysis = stem_analysis_folder.exists() and any(
            f.suffix == ".json" for f in stem_analysis_folder.iterdir() if f.is_file()
        )

        # Check for lyrics
        lyrics_txt = song_folder / "lyrics.txt"
        lyrics_lrc = song_folder / "lyrics.lrc"
        has_lyrics = lyrics_txt.exists()
        has_synced_lyrics = lyrics_lrc.exists()

        return {
            "song_id": song_id,
            "song_folder": str(song_folder),
            "title": metadata.get("title", song_id),
            "artist": metadata.get("artist", "Unknown Artist"),
            "duration": metadata.get("duration"),
            "audio_file": str(audio_file),
            "converted_file": str(converted_file) if has_converted else None,
            "analysis_file": str(analysis_file) if has_analysis else None,
            "stems_folder": str(stems_folder) if has_stems else None,
            "stem_files": stem_files,
            "lyrics_file": str(lyrics_txt) if has_lyrics else None,
            "synced_lyrics_file": str(lyrics_lrc) if has_synced_lyrics else None,
            "has_audio": True,
            "has_converted": has_converted,
            "has_analysis": has_analysis,
            "has_stems": has_stems,
            "has_stem_analysis": has_stem_analysis,
            "has_lyrics": has_lyrics,
            "has_synced_lyrics": has_synced_lyrics,
            "metadata": metadata,
        }

    def get_song(self, song_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific song."""
        config = get_config()

        # Try to find song folder by ID
        song_folder = config.downloads_dir / song_id

        if song_folder.exists() and song_folder.is_dir():
            return self._get_song_info(song_folder)

        return None

    def get_lyrics(self, song_id: str) -> Dict[str, Optional[str]]:
        """Get lyrics for a song."""
        song_info = self.get_song(song_id)

        if not song_info:
            return {"plain": None, "synced": None}

        result = {"plain": None, "synced": None}

        # Read plain lyrics
        if song_info.get("lyrics_file"):
            try:
                with open(song_info["lyrics_file"], "r", encoding="utf-8") as f:
                    result["plain"] = f.read()
            except:
                pass

        # Read synced lyrics
        if song_info.get("synced_lyrics_file"):
            try:
                with open(song_info["synced_lyrics_file"], "r", encoding="utf-8") as f:
                    result["synced"] = f.read()
            except:
                pass

        return result

    def get_analysis(self, song_id: str) -> Optional[Dict[str, Any]]:
        """Get analysis results for a song."""
        song_info = self.get_song(song_id)

        if not song_info or not song_info.get("analysis_file"):
            return None

        try:
            with open(song_info["analysis_file"], "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return None

    def delete_song(self, song_id: str) -> bool:
        """Delete a song and all its associated files."""
        import shutil

        config = get_config()
        song_folder = config.downloads_dir / song_id

        if song_folder.exists() and song_folder.is_dir():
            try:
                shutil.rmtree(song_folder)
                return True
            except:
                return False

        return False
