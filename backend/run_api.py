#!/usr/bin/env python
"""Entry point for running the WereCode API server."""

import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Project root is one level up from backend
project_root = backend_dir.parent

if __name__ == "__main__":
    import uvicorn
    from dotenv import load_dotenv

    # Load environment variables from project root
    load_dotenv(project_root / ".env")

    # Get config from environment
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    reload = os.getenv("API_RELOAD", "true").lower() == "true"

    print(f"🎵 Starting WereCode API on {host}:{port}")
    print(f"📖 API docs: http://{host if host != '0.0.0.0' else 'localhost'}:{port}/docs")

    uvicorn.run(
        "app.api.main:app",
        host=host,
        port=port,
        reload=reload,
    )
