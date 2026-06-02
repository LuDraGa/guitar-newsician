"""Request models for local download endpoints."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


class DownloadRequest(BaseModel):
    """Request to download audio from YouTube or YouTube Music."""

    url: HttpUrl = Field(..., description="YouTube or YouTube Music URL to download")
    output_dir: Optional[str] = Field(None, description="Custom output directory")
    format: Literal["m4a", "opus", "mp3"] = Field("m4a", description="Audio format")
    quality: Literal["high", "medium", "low"] = Field("high", description="Audio quality")
