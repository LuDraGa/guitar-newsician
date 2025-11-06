#!/bin/bash

# WereCode Chat Client Startup Script

echo "🎵 Starting WereCode Chat Client..."

# Change to project root
cd "$(dirname "$0")/../.." || exit

# Load .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check OpenAI API key
if [[ -z "$OPENAI_API_KEY" ]]; then
    echo "❌ OPENAI_API_KEY not set in .env file"
    echo ""
    echo "Please add your OpenAI API key to .env:"
    echo "  OPENAI_API_KEY=your_api_key_here"
    echo ""
    exit 1
fi

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "⚠️  Virtual environment not activated"
    echo "Activating .venv..."
    source .venv/bin/activate
fi

# Check dependencies
if ! python -c "import openai" 2>/dev/null; then
    echo "❌ Dependencies not installed"
    echo "Running: uv sync"
    uv sync
fi

# Check if API server is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "⚠️  API server not responding at http://localhost:8000"
    echo ""
    echo "Please start the API server first:"
    echo "  ./app/api/start_server.sh"
    echo ""
    echo "Or run in another terminal:"
    echo "  python run_api.py"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start chat client using entry point
echo "✅ Starting chat client..."
echo ""
python run_chat.py
