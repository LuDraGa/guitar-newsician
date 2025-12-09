# Transcription Panel: 3-Column Resizable Layout

**Date**: 2025-12-08
**Task**: Restructure transcription panel to use 3 resizable columns

## Objective

Transform the transcription panel from a 2-column layout to a 3-column layout with draggable resize handles:

1. **Column 1**: Transcription Settings (left, smaller width)
2. **Column 2**: Piano Roll (center, majority of screen width).. also other visualizations like sheet and tablature.
3. **Column 3**: AI Assistant (right, moderate width)

## Requirements

- [x] Each column should be draggable/resizable
- [x] Piano roll should get the majority of screen width
- [x] AI assistant should be a separate column (not stacked with piano roll)
- [x] Transcription panel should use full screen width
- [x] Resize handles between columns for user adjustment

## Implementation Plan

### 1. Layout Structure

- Change from `grid-cols-[300px_1fr]` to 3-column flexbox with resize handles
- Default widths:
  - Settings: 280px (20%)
  - Piano Roll: ~60% of remaining space
  - AI Assistant: ~40% of remaining space

### 2. Resize Functionality

- Add resize handles between each column pair
- Implement mouse drag handlers for resize
- Store column widths in component state
- Add visual feedback during resize

### 3. Components Modified

- `TranscriptionPanel.tsx` - Main layout restructure

## Status

- ✅ Execution doc created
- ✅ Layout restructure complete
- ✅ Resize handles implemented
- ✅ Column widths configured (20% settings, 52% piano roll, ~28% AI)
- ✅ Fixed resize bug - event listeners now attach properly on mousedown

## Implementation Details

### Changes Made

1. **Added ResizeHandle component** - Reusable resize divider with hover effects
2. **Column width state** - `settingsWidth` (20%) and `pianoRollWidth` (52%), AI calculated dynamically
3. **Resize logic** - Mouse drag handlers with min/max constraints:
   - Settings: 15-30%
   - Piano Roll: 30-70%
   - AI: Remaining space
4. **Layout change** - From `grid-cols-[300px_1fr]` to flexbox with dynamic width percentages

### Files Modified

- `/frontend/src/components/panels/TranscriptionPanel.tsx` - Added resize functionality and 3-column layout

### Bug Fix: Resize Not Working

**Issue**: Cursor changed on hover but dragging didn't resize columns

**Root Cause**: Event listeners for `mousemove` and `mouseup` were set up in a `useEffect` that only depended on `[settingsWidth]`. The effect didn't re-run when `isResizingRef.current` changed, so listeners were never attached.

**Solution**: Moved event listener setup from `useEffect` into the `handleResizeStart` callback. Now listeners attach immediately on mousedown and cleanup on mouseup.

## Notes

- Using flexbox instead of CSS grid for better resize control
- Resize handles are 4px wide interactive areas with visual feedback
- Min/max width constraints prevent columns from disappearing
- Piano roll now has dedicated space (majority) without AI assistant stacking below it