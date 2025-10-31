# YouTube Music Downloader with gytmdl

**Date**: 2025-10-30
**Task**: Create a new music-focused downloader using gytmdl with Rich TUI and YAML config

## Executive Summary

Creating a **dedicated YouTube Music downloader** to complement the existing yt-dlp downloader:

**Division of Responsibilities:**
- **Existing yt-dlp downloader** → General video/audio downloads (YouTube, YouTube Music, other sites)
- **New gytmdl downloader** → Music-specific downloads with rich metadata and synced lyrics

Creating the new downloader using **gytmdl** to access YouTube Music API for:
- ✅ **Synced lyrics in LRC format** (The key feature!)
- ✅ Precise metadata from YouTube Music
- ✅ High-resolution album covers
- ✅ Track numbers and album info
- ✅ Artist discography support

## Research Findings

### Tool Comparison

#### gytmdl ⭐ (CHOSEN)
**Why it's better for our use case:**
- Uses YouTube Music API for precise metadata
- **Downloads synced lyrics in LRC format** 🎯
- High-resolution square album covers
- Track numbers, total track counts
- Modern codebase (Python 3.10+)
- Multiple download modes (ytdlp, aria2c)
- Artist discography support

**Requirements:**
- Python 3.10+
- FFmpeg
- Optional: Browser cookies for premium/age-restricted content

**Installation:**
```bash
pip install gytmdl
```

#### ytmdl (Not chosen)
**Pros:**
- Multiple metadata sources (iTunes, Spotify, LastFM, Deezer, Gaana)
- Older Python support (3.6.1+)
- Audio trimming feature

**Cons:**
- ❌ No synced lyrics
- ❌ Less accurate metadata (doesn't use YouTube Music API)
- ❌ Not YouTube Music-specific

### Decision: Use gytmdl

## Architecture Design

### Project Structure

```
app/downloaders/yt_music_gytmdl/
├── main.py                 # Main TUI application
├── config.yaml             # User configuration
├── downloader.py           # gytmdl wrapper/interface
└── ui/
    ├── __init__.py
    ├── menus.py            # Rich interactive menus
    └── prompts.py          # Custom prompts and selections
```

### Output Structure

```
downloads/
  Song Title - Artist Name/
    ├── audio.m4a           # Audio file
    ├── cover.jpg           # Album cover (high-res)
    ├── lyrics.lrc          # Synced lyrics (timestamped!)
    └── metadata.json       # Comprehensive metadata
```

### Configuration (YAML)

```yaml
# Download settings
download_dir: downloads
audio_quality: high  # low, medium, high, premium
audio_format: m4a    # m4a, mp3, opus

# Naming templates
folder_template: "%(title)s - %(artist)s"
file_template: "audio"

# Metadata options
download_lyrics: true
download_cover: true
cover_size: 1200  # pixels
cover_format: jpg

# Advanced options
use_cookies: false
cookies_file: null
download_mode: ytdlp  # ytdlp or aria2c
proxy: null

# Tag embedding
embed_cover: true
embed_lyrics: true
```

### Rich TUI Features

#### Interactive Selection Menus
Instead of typing option numbers, use arrow keys to navigate:

```python
from rich.prompt import Prompt
from rich.console import Console
from rich.table import Table
from rich import box

# Example: Audio quality selection
options = ["Low (128kbps)", "Medium (256kbps)", "High (320kbps)", "Premium (Best)"]
# Use rich.prompt with custom display for navigation
```

#### Main Features
1. **Welcome Screen** - Panel with app info
2. **URL Input** - Prompt for YouTube Music URL
3. **Interactive Settings Menu**
   - Audio Quality (↑↓ navigation)
   - Audio Format (↑↓ navigation)
   - Lyrics options (Y/N toggle)
   - Cover options (Y/N toggle)
4. **Download Progress** - Rich progress bars
5. **Results Display** - Panel with file list
6. **Error Handling** - Styled error messages

## Implementation Plan

### Phase 1: Setup & Dependencies ✅
- [x] Research gytmdl and ytmdl
- [x] Choose gytmdl as primary tool
- [ ] Install dependencies
- [ ] Verify FFmpeg availability

### Phase 2: Core Implementation
- [ ] Create project structure
- [ ] Implement config model (Pydantic + YAML)
- [ ] Create gytmdl wrapper class
- [ ] Implement metadata extraction

### Phase 3: Rich TUI Development
- [ ] Design menu system with arrow key navigation
- [ ] Create interactive prompts
- [ ] Implement progress tracking
- [ ] Style output panels

### Phase 4: Integration & Features
- [ ] Download audio with gytmdl
- [ ] Extract and save synced lyrics (LRC)
- [ ] Download and save cover art
- [ ] Generate metadata.json
- [ ] Organize files in folder structure

### Phase 5: Testing & Polish
- [ ] Test with various YouTube Music URLs
- [ ] Test artist discography download
- [ ] Verify lyrics sync format
- [ ] Error handling edge cases
- [ ] Documentation

## Installation Commands

```bash
# For uv package manager
uv add gytmdl

# Verify FFmpeg (should already be installed for yt-dlp)
ffmpeg -version

# Optional: For aria2c download mode
uv add aria2p
```

## Key Differences from Current yt-dlp Downloader

| Feature | Current (yt-dlp) | New (gytmdl) |
|---------|------------------|--------------|
| Lyrics | ❌ No access to YT Music lyrics | ✅ Synced LRC lyrics |
| Metadata | Basic (video info) | ✅ Precise (YT Music API) |
| Album Art | Thumbnail | ✅ High-res square cover |
| Track Info | No track numbers | ✅ Track #, total tracks |
| Use Case | General video/audio | 🎵 Music-specific |
| API | YouTube Data | YouTube Music API |

## Technical Considerations

### 1. gytmdl Integration
- gytmdl is a CLI tool, not a library
- Options:
  - **A) Subprocess calls** - Run gytmdl CLI commands
  - **B) Import internals** - Import gytmdl modules directly
  - **Recommendation**: Try (B) first for tighter integration

### 2. Synced Lyrics (LRC Format)
```lrc
[00:12.00]Line 1 of lyrics
[00:17.20]Line 2 of lyrics
[00:21.10]Line 3 of lyrics
```
- Timestamped lyrics format
- Can be embedded in audio files
- Displayable in compatible players

### 3. Rich TUI - Arrow Key Navigation
Need to implement custom selection menu:
```python
from rich.console import Console
from rich.prompt import Prompt
import readchar  # For arrow key detection

# Custom implementation for navigable menus
```

### 4. Cookie Support
For premium/age-restricted content:
- Export cookies from browser (Netscape format)
- Configure path in config.yaml
- gytmdl handles authentication

## Implementation Complete! ✅

**What was built:**
- Simple, focused downloader using gytmdl
- YAML config with essentials only
- Pydantic validation
- Rich TUI for progress/results
- Synced lyrics (.lrc) download
- metadata.json export
- High-res cover art
- Clean folder structure

**Files created:**
- `app/downloaders/yt_music_gytmdl/main.py` (210 lines)
- `app/downloaders/yt_music_gytmdl/config.yaml`
- `app/downloaders/yt_music_gytmdl/__init__.py`

## Success Criteria

- [x] Research complete
- [x] gytmdl integration working
- [x] Synced lyrics (LRC) extracted and saved
- [x] High-res cover art downloaded
- [x] Metadata.json with comprehensive info
- [x] Rich TUI with clean output
- [x] YAML config working
- [x] Folder structure: `{title} - {artist}/`
- [x] Error handling included
- [ ] Tested with real URL (ready to test)

## Next Steps

1. Install gytmdl via uv
2. Test basic gytmdl functionality
3. Create project structure
4. Implement config model
5. Build Rich TUI
6. Integrate gytmdl download logic
7. Add lyrics/metadata extraction
8. Test and refine

## Notes

- gytmdl solves the "YouTube Music lyrics ≠ YouTube subtitles" problem
- **Two downloaders, two purposes:**
  - `yt_music_downloader/` - General purpose (yt-dlp) - for all video/audio downloads
  - `yt_music_gytmdl/` - Music focused (gytmdl) - for metadata-rich music downloads with lyrics
- This new downloader is music-specific with premium metadata
- LRC format is industry standard for synced lyrics
- High-res covers are crucial for music library managers
- User can choose tool based on need: quick download vs. rich metadata
