"""Centralized configuration system for WereCode API."""

import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv

# Find project root (parent of backend/)
_current_file = Path(__file__).resolve()
_backend_dir = _current_file.parent.parent.parent  # backend/app/api -> backend/
_project_root = _backend_dir.parent  # backend/ -> project root

# Load .env from project root
load_dotenv(_project_root / ".env")


class WereCodeConfig(BaseModel):
    """Global configuration for WereCode API."""

    # Base directories (resolved relative to project root)
    downloads_dir: Path = Field(
        default_factory=lambda: _project_root / Path(os.getenv("DOWNLOADS_DIR", "downloads"))
    )
    outputs_dir: Path = Field(
        default_factory=lambda: _project_root / Path(os.getenv("OUTPUTS_DIR", "outputs"))
    )

    # File organization
    organize_by_song: bool = Field(
        default_factory=lambda: os.getenv("ORGANIZE_BY_SONG", "true").lower() == "true"
    )
    stems_subfolder: str = Field(
        default_factory=lambda: os.getenv("STEMS_SUBFOLDER", "stems")
    )
    analysis_subfolder: str = Field(
        default_factory=lambda: os.getenv("ANALYSIS_SUBFOLDER", "analysis")
    )

    # Analysis settings
    transpose_to_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("TRANSPOSE_TO_KEY") or None
    )
    default_analysis_preset: str = Field(
        default_factory=lambda: os.getenv("DEFAULT_ANALYSIS_PRESET", "full")
    )

    # Job settings
    job_timeout_seconds: int = Field(
        default_factory=lambda: int(os.getenv("JOB_TIMEOUT_SECONDS", "3600"))
    )
    max_concurrent_jobs: int = Field(
        default_factory=lambda: int(os.getenv("MAX_CONCURRENT_JOBS", "5"))
    )

    # Logging
    log_level: str = Field(
        default_factory=lambda: os.getenv("LOG_LEVEL", "INFO")
    )
    log_file: Optional[str] = Field(
        default_factory=lambda: os.getenv("LOG_FILE")
    )

    @field_validator("downloads_dir", "outputs_dir", mode="before")
    @classmethod
    def convert_to_path(cls, v):
        """Convert string paths to Path objects."""
        if isinstance(v, str):
            return Path(v)
        return v

    def ensure_directories(self):
        """Create all configured directories if they don't exist."""
        self.downloads_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)

    def get_song_folder(self, song_title: str) -> Path:
        """
        Get the folder path for a song.

        If organize_by_song is True, returns downloads_dir/<sanitized_title>/
        Otherwise returns downloads_dir/
        """
        if self.organize_by_song:
            # Sanitize title for filesystem
            from .utils.path_helpers import sanitize_filename
            safe_title = sanitize_filename(song_title, max_length=70)
            return self.downloads_dir / safe_title
        return self.downloads_dir

    def get_stems_folder(self, song_folder: Path) -> Path:
        """Get the stems folder for a song."""
        return song_folder / self.stems_subfolder

    def get_stem_analysis_folder(self, song_folder: Path) -> Path:
        """Get the stem analysis folder for a song."""
        return song_folder / self.stems_subfolder / self.analysis_subfolder

    def model_dump_safe(self) -> dict:
        """Export config as dict with string paths."""
        data = self.model_dump()
        data["downloads_dir"] = str(self.downloads_dir)
        data["outputs_dir"] = str(self.outputs_dir)
        return data


# Global config instance
_config: Optional[WereCodeConfig] = None


def get_config() -> WereCodeConfig:
    """Get the global configuration instance."""
    global _config
    if _config is None:
        _config = WereCodeConfig()
        _config.ensure_directories()
    return _config


def reload_config():
    """Reload configuration from environment."""
    global _config
    load_dotenv(override=True)
    _config = WereCodeConfig()
    _config.ensure_directories()
    return _config


def update_config(**kwargs) -> WereCodeConfig:
    """Update specific configuration values."""
    global _config
    if _config is None:
        _config = get_config()

    # Update with provided values
    for key, value in kwargs.items():
        if hasattr(_config, key):
            setattr(_config, key, value)

    _config.ensure_directories()
    return _config
