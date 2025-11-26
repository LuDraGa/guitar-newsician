#!/usr/bin/env python
"""Entry point for running the WereCode API server."""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    import uvicorn
    from dotenv import load_dotenv

    # Load environment variables
    load_dotenv()

    # Get config from environment
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    reload = os.getenv("API_RELOAD", "true").lower() == "true"

    print(f"🎵 Starting WereCode API on {host}:{port}")
    print(f"📖 API docs: http://{host if host != '0.0.0.0' else 'localhost'}:{port}/docs")

    uvicorn.run(
        "backend.api.main:app",
        host=host,
        port=port,
        reload=reload,
    )
