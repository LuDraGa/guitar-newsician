# Stem Separation Upgrade: htdemucs_6s with shifts=2

**Date:** 2025-11-07
**Task:** Update stem separation to use htdemucs_6s model with shifts=2 for better quality

## Context

The current implementation uses `htdemucs` (4 stems: vocals, drums, bass, other) with `shifts=1`. User has found:
1. Need guitar and piano stems → requires `htdemucs_6s` model
2. Quality is not great with default settings → `shifts=2` improves results significantly

The module already uses `htdemucs_6s`, but the API service and HTML UI still use plain `htdemucs`.

## Files to Update

### 1. API Request Model
- **File:** `app/api/models/requests.py`
- **Changes:**
  - Add "htdemucs_6s" to model Literal types
  - Change model default: "htdemucs" → "htdemucs_6s"
  - Add "guitar" and "piano" to stems Literal types
  - Update stems default to include all 6 stems
  - Change shifts default: 1 → 2

### 2. Stem Service
- **File:** `app/api/services/stem_service.py`
- **Changes:**
  - Change model default parameter: "htdemucs" → "htdemucs_6s"
  - Change shifts default parameter: 1 → 2
  - Update stems default list to include guitar and piano

### 3. HTML UI
- **File:** `app/api/static/index.html`
- **Changes:**
  - Update hardcoded model in separateStems() function
  - Update stems list to include guitar and piano
  - Add shifts parameter (if not already present)
  - Update display for all 6, once stems are extracted

### 4. Module Config (already correct)
- **File:** `app/stem_separators/config.yaml`
- **Changes:**
  - Update shifts: 1 → 2

## Implementation Status

- [x] Update API request model
- [x] Update stem service defaults
- [x] Update HTML UI
- [x] Update module config

## Changes Made

### 1. app/api/models/requests.py
- Added "htdemucs_6s" to model Literal types
- Changed default model from "htdemucs" to "htdemucs_6s"
- Added "guitar" and "piano" to stems Literal types
- Changed default stems to include all 6: vocals, drums, bass, other, guitar, piano
- Changed default shifts from 1 to 2

### 2. app/api/services/stem_service.py
- Changed model parameter default from "htdemucs" to "htdemucs_6s"
- Changed shifts parameter default from 1 to 2
- Updated stems_to_extract default list to include guitar and piano

### 3. app/api/static/index.html
- Updated separateStems() function to use 'htdemucs_6s' model
- Added guitar and piano to stems list in API call
- Added shifts: 2 parameter
- Updated renderStemsTab() to display all 6 stem types

### 4. app/stem_separators/config.yaml
- Changed shifts from 1 to 2

## Expected Outcome

- ✅ Default stem separation will produce 6 stems: vocals, drums, bass, other, guitar, piano
- ✅ Better quality separation with shifts=2
- ✅ Consistent behavior across module, API service, and UI

## Testing

Ready to test with sample songs. The stem separation should now:
1. Use htdemucs_6s model by default
2. Extract all 6 stems (including guitar and piano)
3. Use shifts=2 for better quality output