"""Path manipulation and validation helpers."""

import re
from pathlib import Path
from typing import Optional, List


def sanitize_filename(filename: str, max_length: int = 70) -> str:
    """
    Sanitize a string to be safe for use as a filename.

    Args:
        filename: The string to sanitize
        max_length: Maximum length of the resulting filename

    Returns:
        A filesystem-safe filename
    """
    # Remove or replace unsafe characters
    # Keep: letters, numbers, spaces, hyphens, underscores, parentheses, dots
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', filename)

    # Replace multiple spaces with single space
    safe = re.sub(r'\s+', ' ', safe)

    # Trim leading/trailing spaces and dots
    safe = safe.strip(' .')

    # Truncate to max length
    if len(safe) > max_length:
        safe = safe[:max_length].rstrip(' .')

    # Fallback if empty
    if not safe:
        safe = "untitled"

    return safe


def ensure_dir(path: Path) -> Path:
    """
    Ensure a directory exists, creating it if necessary.

    Args:
        path: Path to the directory

    Returns:
        The path (for chaining)
    """
    path.mkdir(parents=True, exist_ok=True)
    return path


def find_audio_file(directory: Path, extensions: Optional[List[str]] = None) -> Optional[Path]:
    """
    Find an audio file in a directory.

    Args:
        directory: Directory to search
        extensions: List of extensions to look for (default: common audio formats)

    Returns:
        Path to the audio file, or None if not found
    """
    if extensions is None:
        extensions = ['.m4a', '.mp3', '.wav', '.flac', '.opus', '.aac', '.ogg']

    if not directory.exists() or not directory.is_dir():
        return None

    # Try exact names first (our naming convention)
    for name in ['audio', 'converted', 'original']:
        for ext in extensions:
            audio_file = directory / f"{name}{ext}"
            if audio_file.exists():
                return audio_file

    # Fall back to scanning directory
    for file in directory.iterdir():
        if file.is_file() and file.suffix.lower() in extensions:
            return file

    return None


def get_song_id_from_path(song_folder: Path) -> str:
    """
    Generate a song ID from the folder path.

    Args:
        song_folder: Path to the song folder

    Returns:
        A unique song ID (just the folder name for now)
    """
    return song_folder.name


def find_file_by_extension(directory: Path, extension: str) -> Optional[Path]:
    """
    Find a file with a specific extension in a directory.

    Args:
        directory: Directory to search
        extension: File extension (with or without leading dot)

    Returns:
        Path to the file, or None if not found
    """
    if not directory.exists() or not directory.is_dir():
        return None

    if not extension.startswith('.'):
        extension = f'.{extension}'

    for file in directory.iterdir():
        if file.is_file() and file.suffix.lower() == extension.lower():
            return file

    return None
