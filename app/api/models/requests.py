"""Request models for API endpoints."""

from typing import Optional, Literal
from pydantic import BaseModel, Field, HttpUrl


class DownloadRequest(BaseModel):
    """Request to download audio from YouTube Music."""

    url: HttpUrl = Field(..., description="YouTube Music URL to download")
    output_dir: Optional[str] = Field(None, description="Custom output directory")
    format: Literal["m4a", "opus", "mp3"] = Field("m4a", description="Audio format")
    quality: Literal["high", "medium", "low"] = Field("high", description="Audio quality")

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
                "output_dir": "/downloads/custom",
                "format": "m4a",
                "quality": "high",
            }
        }


class ConvertRequest(BaseModel):
    """Request to convert audio to different format."""

    input_path: str = Field(..., description="Path to input audio file")
    output_format: Literal["wav", "mp3", "flac", "aac", "ogg"] = Field(
        "wav", description="Target output format"
    )
    output_dir: Optional[str] = Field(None, description="Custom output directory")
    sample_rate: Optional[int] = Field(44100, description="Sample rate in Hz")
    channels: Optional[Literal[1, 2]] = Field(2, description="Number of channels (1=mono, 2=stereo)")

    class Config:
        json_schema_extra = {
            "example": {
                "input_path": "/downloads/song.m4a",
                "output_format": "wav",
                "sample_rate": 44100,
                "channels": 2,
            }
        }


class StemSeparationRequest(BaseModel):
    """Request to separate audio into stems."""

    input_path: str = Field(..., description="Path to input audio file")
    model: Literal["htdemucs", "htdemucs_ft", "htdemucs_6s", "mdx_extra"] = Field(
        "htdemucs_6s", description="Demucs model to use"
    )
    stems: list[Literal["vocals", "drums", "bass", "other", "guitar", "piano"]] = Field(
        ["vocals", "drums", "bass", "other", "guitar", "piano"], description="Stems to extract"
    )
    output_dir: Optional[str] = Field(None, description="Custom output directory")
    shifts: int = Field(2, description="Number of random shifts for better separation")

    class Config:
        json_schema_extra = {
            "example": {
                "input_path": "/downloads/song.wav",
                "model": "htdemucs_6s",
                "stems": ["vocals", "drums", "bass", "other", "guitar", "piano"],
                "shifts": 2,
            }
        }


class AnalysisRequest(BaseModel):
    """Request to analyze audio file."""

    input_path: str = Field(..., description="Path to input audio file (WAV format)")
    analyzers: list[Literal["tempo", "key", "chords", "structure"]] = Field(
        ["tempo", "key", "chords", "structure"], description="Analyzers to run"
    )
    preset: Optional[Literal["quick", "full", "production", "chord", "structure"]] = Field(
        None, description="Preset configuration"
    )
    config_path: Optional[str] = Field(None, description="Path to custom YAML config")
    transpose_to: Optional[str] = Field(None, description="Transpose chords to target key (e.g., 'C', 'A')")

    class Config:
        json_schema_extra = {
            "example": {
                "input_path": "/outputs/converted/song.wav",
                "analyzers": ["tempo", "key", "chords"],
                "preset": "full",
                "transpose_to": "C",
            }
        }


class AnalysisQueryRequest(BaseModel):
    """Request to query analysis results."""

    song_id: Optional[str] = Field(None, description="Song identifier or file path")
    analysis_types: Optional[list[Literal["tempo", "key", "chords", "structure"]]] = Field(
        None, description="Filter by analysis types"
    )
    query: Optional[str] = Field(None, description="Natural language query")

    class Config:
        json_schema_extra = {
            "example": {
                "song_id": "song_abc123",
                "analysis_types": ["chords", "key"],
                "query": "What is the chord progression in the chorus?",
            }
        }
