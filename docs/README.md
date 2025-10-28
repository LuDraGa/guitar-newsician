# WereCode Documentation

## Documentation Index

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: System architecture, component design, and extension points
- **[WORKFLOWS.md](WORKFLOWS.md)**: Development workflows, usage examples, and troubleshooting

## Quick Start

1. **Setup**: `uv sync` to install dependencies
2. **Download**: `python downloaders/yt_music_downloader/main.py`
3. **Convert**: `python converters/audio2wav.py`
4. **Analyze**: `python analyzers/main.py outputs/converted/audio2wav/ --pretty`

## Tools Documentation

### Downloaders
- **[YouTube Music Downloader](../downloaders/yt_music_downloader/)**: Interactive TUI for downloading YouTube audio
  - Config: `config.yaml`
  - Main: `main.py`

### Converters
- **[Audio2Wav](../converters/audio2wav.py)**: Multi-format to WAV converter

### Analyzers
- **[Music Analysis](../analyzers/music_analysis.py)**: Core analysis engine
  - Tempo & beats (Essentia)
  - Key detection (HPCP)
  - Chord recognition (template matching)
  - Structure segmentation (MSAF)
- **[Analysis Runner](../analyzers/main.py)**: CLI with parallel processing and Rich dashboard

## Key Concepts

### Analysis Pipeline
```
Audio File → WAV (44.1kHz mono) → Multiple Analyzers → JSON Output
```

### Analyzer Pattern
All analyzers inherit from base `Analyzer` class and implement:
- `available()`: Check dependencies
- `_run(ctx)`: Perform analysis
- Return structured `Dict[str, Any]`

### Output Format
Single JSON per file with metadata and per-analyzer results. See [ARCHITECTURE.md](ARCHITECTURE.md#analysis-runner) for schema.

## Development

See [WORKFLOWS.md](WORKFLOWS.md) for:
- Common workflows
- Adding new analyzers
- Programmatic usage
- Troubleshooting

## Project Links

- **[Main README](../README.md)**: Project overview
- **[CLAUDE.md](../CLAUDE.md)**: Guidance for Claude Code
- **[Execution Docs](../execution_docs/)**: Task tracking documents
