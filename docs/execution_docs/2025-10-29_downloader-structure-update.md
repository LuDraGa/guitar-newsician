# Downloader Structure Update

**Date**: 2025-10-29
**Task**: Update YouTube Music downloader with timestamped lyrics and improved file structure

## Objectives

1. **Download timestamped lyrics** - Add subtitle/lyrics downloading capability
2. **Create metadata file** - Generate JSON metadata for each download
3. **Restructure downloads** - One directory per song with cleaner naming

## Current Structure

```
downloads/
  Song Title [video_id].m4a
  Another Song [video_id].m4a
```

**Issues**:
- Filenames too long with title and ID
- No lyrics/subtitles
- No metadata file
- Flat directory structure

## Target Structure

```
downloads/
  song-name-12345/
    audio.m4a
    lyrics.vtt (or .srt, .json)
    metadata.json
```

**Benefits**:
- Cleaner organization
- Shorter filenames
- All related files in one place
- Easier to process programmatically

## Implementation Plan

### 1. Config Model Updates
- Add `download_subtitles` boolean field
- Add `subtitle_format` field (vtt, srt, json)
- Update `filename_template` to use directory-based structure
- Add `create_metadata` boolean field

### 2. Directory Structure
- Change outtmpl to: `%(id)s/audio.%(ext)s`
- Directory name: sanitized video ID (short, unique)
- All files in same directory

### 3. Subtitle/Lyrics Download
- Enable yt-dlp `writesubtitles` and `writeautomaticsub`
- Use `subtitleslangs`: ['en', 'en-US', 'en-GB'] priority
- Save as `lyrics.vtt` (or user preference)

### 4. Metadata File
- Extract from yt-dlp `info` dict
- Include: title, artist, album, duration, upload_date, description, thumbnail_url
- Save as `metadata.json` in song directory

## Status

- [x] Create execution document
- [x] Analyze current implementation
- [x] Update config model
- [x] Implement directory structure
- [x] Add subtitle downloading
- [x] Add metadata generation
- [x] Update default config
- [x] Test implementation (initial)
- [x] Fix: Changed folder naming from video ID to title
- [x] Fix: Updated subtitle template extraction logic
- [ ] Verify subtitle downloading works (may depend on video availability)

## Implementation Details

### Changes Made

1. **Config Model (main.py:32-70)**
   - Added `SubtitleFmt` literal type for subtitle formats
   - Added `download_subtitles` boolean field (default: True)
   - Added `subtitle_format` field (default: "vtt")
   - Added `subtitle_langs` list field (default: ["en", "en-US", "en-GB"])
   - Added `create_metadata` boolean field (default: True)
   - Changed default `filename_template` to `%(id)s/audio.%(ext)s`

2. **build_ytdlp_opts() (main.py:213-281)**
   - Added FFmpegSubtitlesConvertor postprocessor for subtitle format conversion
   - Added subtitle template configuration
   - Enabled `writesubtitles` and `writeautomaticsub` when configured
   - Set `subtitleslangs` and `subtitlesformat` from config
   - Configured subtitle output template

3. **create_metadata_file() (main.py:284-310)**
   - New function to extract and save metadata as JSON
   - Extracts: video_id, title, artist, album, duration, upload_date, description, thumbnail, webpage_url, view_count, like_count, channel info, categories, tags
   - Filters out None values
   - Saves to `metadata.json` in song directory

4. **main() function updates (main.py:478-508)**
   - Added metadata file creation after successful download
   - Updated result display to show output directory and list all downloaded files
   - Better error handling for metadata creation

5. **config.yaml**
   - Updated with new default values
   - Added comments for clarity
   - Set all new features to enabled by default

## Post-Test Fixes

### Issue 1: Folder Naming
**Problem**: Folders named with video ID (e.g., `fZZFKVbQpoE`) instead of human-readable names
**Solution**:
- Changed default `filename_template` from `%(id)s/audio.%(ext)s` to `%(title).70s/audio.%(ext)s`
- Updated subtitle template extraction logic to handle title-based paths
- Modified metadata creation to detect actual output directory from yt-dlp info
- Title truncated to 70 chars to avoid excessively long folder names

### Issue 2: Subtitles Not Downloading
**Possible Causes**:
- Video may not have subtitles/captions available
- Auto-generated captions may not exist for the video
- YouTube Music lyrics != YouTube subtitles/captions (different systems)

**Debugging Steps Added**:
- Enabled verbose output when `download_subtitles` is True
- Added subtitle availability checking after download
- Reports which languages are available if requested languages not found
- Distinguishes between manual subtitles and auto-captions

**Current Configuration**:
- `writesubtitles: True` - downloads manual subtitles
- `writeautomaticsub: True` - downloads auto-generated subtitles
- `subtitleslangs: [en, en-US, en-GB]` - priority order
- FFmpegSubtitlesConvertor converts to specified format (vtt/srt/json3)

**Important Note**:
YouTube Music's synchronized lyrics feature is DIFFERENT from YouTube's standard subtitle/caption system. The lyrics you see in YouTube Music's interface may not be available as downloadable subtitles via yt-dlp. yt-dlp can only download:
1. Manual subtitles uploaded by the video creator
2. Auto-generated captions (speech-to-text)

The synchronized lyrics in YouTube Music are a separate feature and may not be accessible through standard subtitle extraction.

## Notes

- Use yt-dlp's built-in subtitle features
- Directory names use sanitized title (70 char max, auto-sanitized by yt-dlp)
- Handle cases where subtitles unavailable gracefully
- Backward compatible: can use `%(id)s` in template if preferred
- Metadata.json creation confirmed working well
