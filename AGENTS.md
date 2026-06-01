# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Quick Links

- **[README.md](README.md)**: Project overview and setup
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Detailed architecture and design patterns
- **[docs/WORKFLOWS.md](docs/WORKFLOWS.md)**: Common development workflows and examples
- **[docs/execution_docs/](execution_docs/)**: Task execution tracking and status docs

## Project Essentials

**WereCode**: Music analysis toolkit for downloading, converting, and analyzing audio from YouTube/YouTube Music.

- **Language**: Python 3.12+
- **Package Manager**: `uv` (NOT pip)
- **Key Dependencies**: essentia, msaf, yt-dlp, pydub, rich, pydantic

## Tool Preferences

### Search & Code Analysis

- **Use `rg` (ripgrep)** instead of `grep` for searching codebase
- **Use `ast-grep`** for structural code search when available
- **Use `fd`** instead of `find` for file finding if available
- Prefer Rich tool (Grep, Glob) over bash commands for file operations

### Development Tools

```bash
# Package management - ALWAYS use uv
uv sync                    # Install dependencies
uv add <package>           # Add new package
uv remove <package>        # Remove package

# Activate environment
source .venv/bin/activate
```

## Common Commands

See **[docs/WORKFLOWS.md](docs/WORKFLOWS.md)** for detailed workflows.

### Quick Reference

```bash
# Download YouTube audio (interactive Rich TUI)
python downloaders/yt_music_downloader/main.py

# Convert audio to WAV
python converters/audio2wav.py

# Analyze WAV files with pretty dashboard
python analyzers/main.py outputs/converted/audio2wav/ --pretty

# List available analyzers
python analyzers/main.py --list-analyzers
```

## Project Structure

```
WereCode/
├── downloaders/yt_music_downloader/  # YouTube audio downloader
├── converters/                        # Audio format converters
├── analyzers/                         # Music analysis (tempo, key, chords, structure)
├── downloads/                         # Default download directory
├── outputs/                           # Analysis results and converted files
├── docs/                              # Detailed documentation
└── execution_docs/                    # Task tracking documents
```

## Development Guidelines

### Execution Documentation

**IMPORTANT**: When performing significant changes or long-tail tasks, create a markdown execution document in `docs/execution_docs/` directory. Label properly: `docs/execution_docs/YYYY-MM-DD_task-name.md`

### Code Patterns

- **Configuration**: YAML files with Pydantic models for validation
- **Analysis**: Modular `Analyzer` base class pattern (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))
- **Terminal UI**: Use `rich` library for all user-facing output
- **Error Handling**: Return structured errors, don't crash on single file failures

### File Operations

- Use `Read`, `Write`, `Edit` tools over bash commands for file operations
- Use `Glob` for finding files by pattern
- Use `Grep` for searching file contents

## Key Environment Variables

- `TRANSPOSE_TO_KEY`: Transpose chord progressions to target key (e.g., `C`, `A`, `F#`)

## Known Issues

- **MSAF numpy compatibility**: Monkey patch included for `scipy.inf`
- **madmom on Python 3.12**: Currently disabled (compatibility issue)
- **YouTube 403 errors**: Auto-retries with browser cookies + Android client

For detailed architecture, analysis pipeline details, and development workflows, see the [docs/](docs/) directory.
