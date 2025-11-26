"""Configuration management endpoints."""

from fastapi import APIRouter, HTTPException
from ..config import get_config, update_config, reload_config
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class ConfigUpdate(BaseModel):
    """Model for config updates."""

    downloads_dir: Optional[str] = None
    outputs_dir: Optional[str] = None
    organize_by_song: Optional[bool] = None
    stems_subfolder: Optional[str] = None
    analysis_subfolder: Optional[str] = None
    transpose_to_key: Optional[str] = None
    default_analysis_preset: Optional[str] = None
    job_timeout_seconds: Optional[int] = None
    max_concurrent_jobs: Optional[int] = None
    log_level: Optional[str] = None


@router.get("/config")
async def get_current_config():
    """Get current configuration."""
    config = get_config()
    return config.model_dump_safe()


@router.put("/config")
async def update_configuration(updates: ConfigUpdate):
    """Update configuration values."""
    try:
        # Filter out None values
        updates_dict = {k: v for k, v in updates.model_dump().items() if v is not None}

        if not updates_dict:
            raise HTTPException(status_code=400, detail="No updates provided")

        # Update config
        config = update_config(**updates_dict)

        return {
            "message": "Configuration updated successfully",
            "config": config.model_dump_safe(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")


@router.post("/config/reload")
async def reload_configuration():
    """Reload configuration from environment."""
    try:
        config = reload_config()
        return {
            "message": "Configuration reloaded from environment",
            "config": config.model_dump_safe(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to reload config: {str(e)}"
        )
