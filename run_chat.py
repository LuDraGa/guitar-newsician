#!/usr/bin/env python
"""Entry point for running the WereCode Chat Client."""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    from app.api.chat_client import main
    main()
