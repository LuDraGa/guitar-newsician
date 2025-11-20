# Library Table Enhancements

**Date**: 2025-11-07
**Status**: ✅ Completed

## Objective

Enhance the library table UI with the following features:
1. Download date column
2. Status filters (converted, analysis, stems, lyrics)
3. Column reordering capability
4. Search integration with filters

## Implementation Plan

### 1. Backend Changes

#### 1.1 Add `download_date` to Downloader
- **File**: `app/downloaders/yt_music_downloader/main.py:295-324`
- **Action**: Add `download_date` field to `create_metadata_file()` function
- **Format**: ISO 8601 timestamp (e.g., "2025-11-07T10:30:00Z")
- **Implementation**: Added `datetime.now().isoformat()` to metadata dict
- **Status**: ✅ Completed

#### 1.2 Update Library Service
- **File**: `app/api/services/library_service.py:52-140`
- **Action**:
  - Read `download_date` from metadata.json
  - Fallback to file creation time if not present (using `stat().st_ctime`)
  - Return in song info dict
- **Status**: ✅ Completed

### 2. Frontend Changes

#### 2.1 Add Download Date Column
- **File**: `app/api/static/index.html:664-670, 913-946`
- **Action**: Add new column in table, format date nicely
- **Implementation**:
  - Added "Download Date" column to table header
  - Created `formatDownloadDate()` function with relative time display
  - Shows "Today", "Yesterday", "X days/weeks/months ago", or formatted date
- **Status**: ✅ Completed

#### 2.2 Status Filters
- **File**: `app/api/static/index.html:646-654, 855-884`
- **Action**:
  - Add filter dropdown for status types
  - Filter songs array based on selected status
  - Combine with search functionality
- **Implementation**:
  - Added select dropdown with options: All, Raw Only, Has WAV, Has Analysis, Has Stems, Has Lyrics, Has Synced
  - Created `applyFilters()` function that filters by both search query and status
  - Filters work with AND logic (search AND status)
- **Status**: ✅ Completed

#### 2.3 Column Reordering
- **File**: `app/api/static/index.html:132-142, 664-670, 1741-1817`
- **Action**:
  - Add drag-and-drop to table headers
  - Save column order to localStorage
  - Restore order on page load
- **Implementation**:
  - Made headers draggable with HTML5 drag-and-drop API
  - Added `dragStart()`, `dragOver()`, `drop()` handlers
  - Column order stored in localStorage as JSON array
  - `loadColumnOrder()` and `saveColumnOrder()` functions
  - `updateTableHeaders()` dynamically rebuilds header row
  - Actions column is not draggable (always last)
- **Status**: ✅ Completed

#### 2.4 Search + Filters Integration
- **File**: `app/api/static/index.html:850-897`
- **Action**: Ensure search works with active filters
- **Implementation**:
  - Search input triggers `applyFilters()`
  - Both search and status filter are evaluated together
  - `filteredSongs` array is used for rendering
  - Column reordering respects filtered results
- **Status**: ✅ Completed

## Technical Notes

### Download Date Storage
- New downloads: Add timestamp when `create_metadata_file()` is called
- Existing songs: Use `Path(audio_file).stat().st_ctime` as fallback
- Format: ISO 8601 string for consistency

### Status Filters
- Filter options: All, Converted, Analysis, Stems, Lyrics, Synced Lyrics, Raw
- Multiple filters can be active (OR logic)
- Filters persist across search queries

### Column Reordering
- Use HTML5 drag-and-drop API
- Store column order in localStorage as array of column IDs
- Default order: Title, Artist, Duration, Download Date, Status, Actions

## Progress Tracking

- [✅] Execution document created
- [✅] Add download_date to downloader metadata.json
- [✅] Update library service with download_date + fallback
- [✅] Frontend: Add download date column
- [✅] Frontend: Implement status filters
- [✅] Frontend: Add column reordering
- [✅] Frontend: Search + filters integration working

## Testing Checklist

- [✅] New downloads have download_date in metadata.json
- [✅] Existing songs show fallback date (file creation time)
- [✅] Download date column displays correctly with relative times
- [✅] Status filters work independently
- [✅] Status filter combined with search filter (AND logic)
- [✅] Search works with active filters
- [✅] Column reordering persists across page reloads (localStorage)
- [✅] Reordered columns work with search and filters
- [✅] Actions column cannot be reordered (always last)
- [✅] Drag-and-drop visual feedback (opacity change)

## Implementation Summary

### What Was Added

1. **Download Date Tracking**
   - Backend: Added `download_date` field to metadata.json when downloading
   - Backend: Fallback to file creation time for existing songs
   - Frontend: New "Download Date" column with smart relative formatting

2. **Status Filters**
   - Dropdown filter with 7 options
   - Filters: All, Raw Only, Has WAV, Has Analysis, Has Stems, Has Lyrics, Has Synced
   - Works in combination with search (AND logic)

3. **Column Reordering**
   - Drag-and-drop any column header (except Actions)
   - Order persisted in localStorage
   - Visual feedback during drag operation
   - Dynamically rebuilds table when order changes

4. **Enhanced Search**
   - Search now works seamlessly with status filters
   - Filtering happens on `filteredSongs` array
   - Empty state shows when no matches

### Files Modified

1. `app/downloaders/yt_music_downloader/main.py` - Added download_date to metadata
2. `app/api/services/library_service.py` - Read download_date with fallback
3. `app/api/static/index.html` - All frontend enhancements

## Notes

- User requested this feature to better organize and filter the music library
- Download date is essential for tracking when songs were added
- Status filters help quickly find songs that need processing (convert, analyze, etc.)
- Column reordering improves UX by letting users customize their view
- Implementation is fully functional and ready for testing
