"""API route handlers."""

from .download import router as download_router
from .convert import router as convert_router
from .stems import router as stems_router
from .analyze import router as analyze_router
from .jobs import router as jobs_router
from .config import router as config_router
from .library import router as library_router
from .lyrics import router as lyrics_router

__all__ = [
    "download_router",
    "convert_router",
    "stems_router",
    "analyze_router",
    "jobs_router",
    "config_router",
    "library_router",
    "lyrics_router",
]
