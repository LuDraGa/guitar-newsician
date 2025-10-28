# Development Workflows

## Common Workflows

### 1. Download → Convert → Analyze (Full Pipeline)

```bash
# Step 1: Download audio from YouTube
python downloaders/yt_music_downloader/main.py
# Follow interactive prompts, use directory picker

# Step 2: Convert to WAV
python converters/audio2wav.py
# Converts everything in downloads/ to outputs/converted/audio2wav/

# Step 3: Run analysis with dashboard
# Edit analyzers/main.py main() function to use desired config preset
python analyzers/main.py
```

Or programmatically:
```python
from pathlib import Path
from converters.audio2wav import bulk_convert_to_wav
from analyzers.main import FULL_ANALYSIS, run_batch_analysis

# Convert
bulk_convert_to_wav(
    input_dir=Path("downloads"),
    output_dir=Path("outputs/converted/audio2wav"),
)

# Analyze
config = FULL_ANALYSIS.model_copy(update={
    "input_path": Path("outputs/converted/audio2wav"),
})
run_batch_analysis(config)
```

### 2. Batch Analysis with Configuration Presets

The analyzers use **code-based configuration** instead of command-line arguments. Edit the `main()` function in `analyzers/main.py` to configure your analysis.

**Available Presets:**

```python
from analyzers.main import (
    QUICK_ANALYSIS,      # Fast, essential analyzers only, no dashboard
    FULL_ANALYSIS,       # All analyzers with detailed dashboard
    PRODUCTION_ANALYSIS, # Optimized for large batches (16 workers, recursive)
    CHORD_ANALYSIS,      # Chord-focused with extended chord display
    STRUCTURE_ANALYSIS,  # Structure-focused with extended sections
    run_batch_analysis,
)

# Use a preset
run_batch_analysis(FULL_ANALYSIS)

# Modify a preset
config = PRODUCTION_ANALYSIS.model_copy(update={
    "input_path": Path("custom/path"),
    "workers": 32,
})
run_batch_analysis(config)

# Create custom config
from analyzers.main import AnalysisConfig

config = AnalysisConfig(
    input_path=Path("my_wavs"),
    output_dir=Path("my_output"),
    recurse=True,
    skip_existing=True,
    workers=8,
    enable=["tempo_beats", "tonal_key", "chords"],
    show_dashboard=True,
    max_chords=20,
)
run_batch_analysis(config)
```

Then run:
```bash
python analyzers/main.py
```

### 3. Single File Quick Analysis

```python
# Convert single file
from converters.audio2wav import convert_to_wav
convert_to_wav('song.m4a')

# Analyze single file
from pathlib import Path
from analyzers.music_analysis import run_analysis

output = run_analysis(
    wav_path=Path("outputs/converted/audio2wav/song.wav"),
    out_dir=Path("outputs/analysis/wav_music"),
)
print(f"Analysis complete: {output}")
```

### 4. Chord Analysis with Transposition

```bash
# Set target key for transposition
export TRANSPOSE_TO_KEY=C
```

```python
# Run chord-focused analysis
from analyzers.main import CHORD_ANALYSIS, run_batch_analysis

run_batch_analysis(CHORD_ANALYSIS)

# Check output JSON for transposed_to_key section
import json
from pathlib import Path

output_file = Path("outputs/analysis/wav_music/song.analysis.json")
data = json.loads(output_file.read_text())
transposed = data["chords"]["data"]["transposed_to_key"]
print(transposed)
```

### 5. Configuration Examples

**Analyzer Configuration Presets:**

```python
# analyzers/main.py

# Quick analysis - only essentials, no dashboard
QUICK_ANALYSIS = AnalysisConfig(
    skip_existing=True,
    workers=8,
    enable=["basic_stats", "tempo_beats"],
    show_dashboard=False,
)

# Full analysis - all analyzers with detailed dashboard
FULL_ANALYSIS = AnalysisConfig(
    skip_existing=False,
    workers=4,
    show_dashboard=True,
    max_chords=20,
    max_beats=20,
    max_sections=15,
)

# Production - large batches
PRODUCTION_ANALYSIS = AnalysisConfig(
    recurse=True,
    skip_existing=True,
    workers=16,
    show_dashboard=False,
)

# Use in main()
def main():
    # Pick a preset
    config = FULL_ANALYSIS

    # Or customize
    config = AnalysisConfig(
        input_path=Path("my_wavs"),
        workers=12,
        enable=["tempo_beats", "chords", "tonal_key"],
        show_dashboard=True,
    )

    run_batch_analysis(config)
```

**Download Configuration:**

Edit `downloaders/yt_music_downloader/config.yaml`:
```yaml
download_dir: /custom/path
audio_format: mp3
audio_quality: '320'
rate_limit: '2M'
embed_metadata: true
```

Then run:
```bash
python downloaders/yt_music_downloader/main.py
```

Or override interactively when prompted.

### 6. Programmatic Usage

#### As Module - Converter

```python
from pathlib import Path
from converters.audio2wav import convert_to_wav, bulk_convert_to_wav

# Single file
wav_path = convert_to_wav(
    Path("song.m4a"),
    output_dir=Path("outputs/wav"),
    target_sr=44100,
    mono=True,
    overwrite=False
)

# Bulk
bulk_convert_to_wav(
    input_dir=Path("downloads"),
    output_dir=Path("outputs/wav"),
    mono=True
)
```

#### As Module - Analysis

```python
from pathlib import Path
from analyzers.music_analysis import run_analysis, list_analyzers

# List available analyzers
for name, available in list_analyzers():
    print(f"{name}: {'✓' if available else '✗'}")

# Run analysis
output_json = run_analysis(
    wav_path=Path("song.wav"),
    out_dir=Path("outputs/analysis"),
    enable=["tempo_beats", "chords"],  # Optional: filter analyzers
    disable=None
)

# Read results
import json
with open(output_json) as f:
    results = json.load(f)
    bpm = results["tempo_beats"]["data"]["bpm"]
    key = results["tonal_key"]["data"]["key"]
```

## Development Tasks

### Adding a New Analyzer

See [ARCHITECTURE.md](ARCHITECTURE.md#adding-new-analyzers) for base pattern.

**Example: Loudness Analyzer**

```python
# In analyzers/music_analysis.py

class LoudnessAnalyzer(Analyzer):
    """EBU R128 loudness analysis."""
    NAME = "loudness"
    VERSION = "0.1.0"

    def available(self) -> bool:
        try:
            import pyloudnorm
            return True
        except ImportError:
            return False

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        import pyloudnorm as pyln
        import soundfile as sf

        data, rate = sf.read(str(ctx.wav_path))
        meter = pyln.Meter(rate)
        loudness = meter.integrated_loudness(data)

        return {
            "integrated_loudness_lufs": float(loudness),
            "sample_rate": rate
        }

# Add to ANALYZERS list
ANALYZERS = [
    BasicStatsAnalyzer(),
    TempoBeatsAnalyzer(),
    TonalKeyAnalyzer(),
    ChordInferenceAnalyzer(),
    StructureMSAFAnalyzer(),
    LoudnessAnalyzer(),  # ← Add here
]
```

Then install dependency:
```bash
uv add pyloudnorm
```

### Debugging Analysis Failures

```bash
# Run with specific analyzer to isolate issue
python analyzers/main.py file.wav --enable tempo_beats

# Check output JSON for error details
cat outputs/analysis/wav_music/file.analysis.json | jq '.tempo_beats'
# Look for: "ok": false, "error": "..."
```

### Testing Download Configuration

```bash
# Test different formats
python downloaders/yt_music_downloader/main.py
# Select: audio_format = mp3, flac, etc.

# Test rate limiting (useful for avoiding throttling)
# Edit config.yaml: rate_limit: '1M'

# Test proxy
# Edit config.yaml: proxy: 'http://127.0.0.1:8080'
```

## Troubleshooting

### YouTube 403 Forbidden

The downloader auto-retries with browser cookies, but you can also:

1. Edit `config.yaml`:
```yaml
use_cookies_from_browser: chrome  # or firefox, edge, safari
yt_player_client: android
```

2. Or export cookies manually:
```yaml
cookiefile: /path/to/cookies.txt
```

### MSAF Import Errors

If you see scipy/numpy errors:
```python
# This patch is already in music_analysis.py
import numpy as np, scipy as _scipy
setattr(_scipy, "inf", np.inf)
import msaf
```

### Slow Analysis on Large Files

```bash
# Use parallel processing
python analyzers/main.py large_directory/ --workers 16

# Disable slow analyzers
python analyzers/main.py file.wav --disable structure_msaf
```

### Memory Issues with Long Audio

For very long files (>1 hour), analyzers may consume significant memory. Consider:

1. Split audio into chunks before analysis
2. Use lower sample rate in conversion:
```python
convert_to_wav(file, target_sr=22050)  # Instead of 44100
```

## Rich Dashboard Customization

```bash
# Limit displayed items in dashboard
python analyzers/main.py file.wav --pretty \
    --pretty-max-chords 20 \
    --pretty-max-beats 15 \
    --pretty-max-sections 8
```

## Search & Code Navigation

### Finding Code Patterns

```bash
# Find all analyzer classes
rg "class.*Analyzer" analyzers/

# Find Pydantic models
rg "class.*BaseModel" --type py

# Find Rich console usage
rg "console\.(print|log)" --type py

# Find config YAML usage
fd -e yaml
```

### Structural Search with ast-grep

```bash
# Find all Essentia algorithm usage (if ast-grep available)
ast-grep --pattern 'es.$_($_)' analyzers/

# Find all Path operations
ast-grep --pattern 'Path($_)'
```

## File Naming Patterns

### Downloads
Default template: `%(title)s [%(id)s].%(ext)s`

Example: `Song Title [dQw4w9WgXcQ].m4a`

### Converted WAV
Pattern: `<original_stem>.wav`

Example: `Song Title [dQw4w9WgXcQ].wav`

### Analysis JSON
Pattern: `<wav_stem>.analysis.json`

Example: `Song Title [dQw4w9WgXcQ].analysis.json`

## Environment Variables

```bash
# Transpose chord analysis to target key
export TRANSPOSE_TO_KEY=C
export TRANSPOSE_TO_KEY=F#
export TRANSPOSE_TO_KEY=Bb

# Unset to disable
unset TRANSPOSE_TO_KEY
```
