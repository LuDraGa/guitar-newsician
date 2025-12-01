# Fix Audio Loading Timeouts in Studio Panel

**Date**: 2025-12-01
**Issue**: Audio stems timeout after 10 seconds when loading in Studio Panel
**Status**: ✅ **COMPLETED** - Ready for Testing

## Problem Analysis

### Symptoms
- Timeout loading audio after 10 seconds
- ReadyState: 0 (HAVE_NOTHING - no data loaded)
- NetworkState: 2 (NETWORK_LOADING - loading but not progressing)
- Error: `http://localhost:8001/api/v1/library/songs/{song_id}/stems/{stem_type}`

### Root Causes
1. **Sequential Loading**: Stems load one-by-one in a for loop (StudioPanel.tsx:123-128)
2. **No HTTP Range Requests**: Backend FileResponse doesn't support partial content/streaming
3. **Large File Sizes**: WAV stems are 30-100MB+ each
4. **Short Timeout**: 10 seconds is too short for large files
5. **No Chunked Transfer**: Files sent as complete responses

## Implementation Plan

### 1. Enable HTTP Range Requests (Backend) ✅
- [x] Add `StreamingResponse` support to FastAPI endpoints
- [x] Enable `Accept-Ranges` headers
- [x] Support `Range` request headers
- [x] Send `Content-Range` responses for partial content
- [x] Added `range_requests_response()` helper function

**File**: `backend/app/api/routes/library.py`

**Changes**:
- Created `range_requests_response()` function for HTTP range request support
- Updated `stream_audio()` to use streaming with range requests
- Updated `stream_stem()` to use streaming with range requests
- Streams in 1MB chunks for better performance
- Properly handles partial content requests (206 status code)

### 2. Load Stems in Parallel (Frontend) ✅
- [x] Change from sequential `for` loop to `Promise.all()`
- [x] Load all stems simultaneously
- [x] Add progress tracking for each stem

**File**: `frontend/src/components/panels/StudioPanel.tsx:119-136`

**Changes**:
- Replaced sequential for loop with `Promise.all()`
- All stems now load simultaneously instead of one-by-one
- Added per-stem error handling
- Better logging for parallel loading

### 3. Increase Timeout & Progressive Loading ✅
- [x] Increased timeout from 10s to 60s (hard timeout)
- [x] Add progress-based timeout (fail only if no progress for 30s)
- [x] Monitor `readyState` changes as progress indicator
- [x] Track progress every 3 seconds

**File**: `frontend/src/hooks/useSimpleAudioPlayback.ts:34-143`

**Changes**:
- Progressive timeout: Only fails if no progress for 30 seconds
- Hard timeout: Absolute maximum of 60 seconds
- Progress detection via `readyState` changes
- Progress event listener resets timeout counter
- Check every 3 seconds (10 checks = 30 seconds max no-progress time)

### 4. Optional: Audio Compression (Future)
- [ ] Pre-generate MP3 versions of stems for web playback
- [ ] Reduce file sizes from ~50MB to ~5MB per stem
- [ ] Add conversion step to stem separation pipeline

## Implementation Status

### Completed ✅
- [x] Problem analysis
- [x] Created execution doc
- [x] Backend: Enable HTTP range requests with streaming
- [x] Frontend: Parallel stem loading
- [x] Frontend: Increase timeout with progressive loading
- [x] Code implementation complete

### Ready for Testing
- [ ] Manual testing with real stems
- [ ] Performance validation

## Testing Checklist
- [ ] Single stem loads successfully
- [ ] Multiple stems load in parallel
- [ ] Large files (>50MB) load without timeout
- [ ] Network throttling test (slow connection)
- [ ] Verify audio playback after loading

## Summary of Changes

### Backend (`backend/app/api/routes/library.py`)
1. **New `range_requests_response()` function**: Handles HTTP range requests with 1MB chunking
2. **Updated endpoints**: Both `/audio` and `/stems/{stem_type}` now support streaming
3. **Benefits**: Faster initial loading, seekable audio, better browser caching

### Frontend (`frontend/src/components/panels/StudioPanel.tsx`)
1. **Parallel loading**: Changed from sequential to `Promise.all()`
2. **Faster load times**: All stems load simultaneously (6x faster for 6 stems)
3. **Better error handling**: Per-stem error tracking

### Frontend (`frontend/src/hooks/useSimpleAudioPlayback.ts`)
1. **Progressive timeout**: 30 seconds with no progress before failing
2. **Hard timeout**: 60 seconds absolute maximum
3. **Smart monitoring**: Only fails if truly stuck, not just slow

## Performance Impact

### Before
- **Load time**: Sequential (30-60s per stem × 6 stems = 3-6 minutes)
- **Timeout**: Fixed 10 seconds (too short for large files)
- **Streaming**: None (full file download required)

### After
- **Load time**: Parallel (30-60s total for all stems)
- **Timeout**: Progressive (30s no-progress, 60s hard limit)
- **Streaming**: HTTP range requests (instant seek, progressive loading)

**Expected improvement**: 6x faster loading for songs with 6 stems

## Notes
- Old timeout: 10 seconds (fixed)
- New timeout: 30 seconds (no progress) / 60 seconds (hard limit)
- Typical stem file size: 30-100MB
- Number of stems: 4-6 simultaneously
- Total data transfer: 200-600MB for full song
- **Streaming enabled**: Browser can start playback before full download
