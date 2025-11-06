# Synced Lyrics Module Implementation

**Date:** 2025-11-04
**Status:** In Progress

## Objective

Create a synced lyrics fetcher module that:
- Follows project patterns (YAML config + Pydantic models + Rich TUI)
- Works with the song directory structure (downloads/song_name/)
- Fetches synced lyrics from third-party providers via syncedlyrics
- Saves lyrics as `lyrics.lrc` in song directories
- Provides interactive selection like other modules

## Project Structure

```
app/lyrics/
├── config.yaml          # YAML configuration
├── main.py             # Interactive Rich TUI entry point
├── synced_lyrics.py    # Existing utility module (already present)
└── __init__.py         # Package initialization
```

## Song Directory Structure

```
downloads/
└── Song Name/
    ├── metadata.json       # Song metadata (title, artist)
    ├── audio.m4a          # Downloaded audio
    ├── audio.wav          # Converted WAV (optional)
    ├── analysis.json      # Analysis results (optional)
    ├── lyrics.lrc         # Synced lyrics (NEW)
    └── stems/             # Separated stems (optional)
```

## Implementation Steps

### 1. ✅ Create Execution Doc
- [x] Document implementation plan
- [x] Define directory structure
- [x] List implementation steps

### 2. ⏳ Create YAML Config
- [ ] Define config.yaml with settings:
  - input_dir (downloads)
  - providers list
  - allow_unsynced flag
  - overwrite flag
  - output format (lrc filename)

### 3. ⏳ Create Pydantic Config Model
- [ ] LyricsConfig class with validation
- [ ] Default values matching YAML
- [ ] Config loading function

### 4. ⏳ Create main.py with Rich TUI
- [ ] Song selection interface (like analyzers)
- [ ] Display existing lyrics status
- [ ] Interactive fetch with progress
- [ ] Success/failure Rich panels
- [ ] Display fetched lyrics preview

### 5. ⏳ Add Dependencies
- [ ] Add syncedlyrics to pyproject.toml
- [ ] Run uv sync to install

### 6. ⏳ Test with Real Songs
- [ ] Test with songs that have metadata
- [ ] Verify lyrics.lrc file creation
- [ ] Test overwrite logic
- [ ] Test provider fallback

### 7. ⏳ Verify Directory Structure
- [ ] Ensure lyrics saved in correct location
- [ ] Validate LRC format
- [ ] Test with missing metadata

## Technical Details

### Configuration Schema

```yaml
# Lyrics Fetcher Configuration
input_dir: downloads
providers: null  # null = use all providers
allow_unsynced: false
overwrite: false
output_filename: lyrics.lrc
```

### Pydantic Model

```python
class LyricsConfig(BaseModel):
    input_dir: Path = Field(default=Path("downloads"))
    providers: Optional[List[str]] = None
    allow_unsynced: bool = False
    overwrite: bool = False
    output_filename: str = "lyrics.lrc"
```

### Metadata Format

Songs in downloads/ should have metadata.json:
```json
{
  "title": "Song Name",
  "artist": "Artist Name",
  "url": "https://...",
  ...
}
```

### Output Format

LRC file format:
```
[00:12.00]Line one lyrics
[00:15.00]Line two lyrics
```

## Testing Plan

1. Test with existing downloaded songs
2. Verify lyrics fetch for songs with clear metadata
3. Test error handling for songs without metadata
4. Verify overwrite behavior
5. Test provider fallback logic

## Dependencies

- syncedlyrics: Third-party lyrics fetcher
- rich: TUI components
- pydantic: Config validation
- PyYAML: Config loading

## Integration Points

- Uses existing `synced_lyrics.py` utility
- Follows analyzer/converter YAML + Rich TUI pattern
- Works with existing song directory structure
- Compatible with metadata.json from downloaders

## Status Updates

- **2025-11-04 (Start)**: Created execution doc, planning implementation
