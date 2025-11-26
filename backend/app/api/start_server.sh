#!/bin/bash

# WereCode API Server Startup Script

echo "🎵 Starting WereCode API Server..."

# Change to project root
cd "$(dirname "$0")/../.." || exit

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "⚠️  Virtual environment not activated"
    echo "Activating .venv..."
    source .venv/bin/activate
fi

# Check dependencies
echo "Checking dependencies..."
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ Dependencies not installed"
    echo "Running: uv sync"
    uv sync
fi

# Start server using entry point
echo "✅ Starting FastAPI server..."
echo ""
python run_api.py
