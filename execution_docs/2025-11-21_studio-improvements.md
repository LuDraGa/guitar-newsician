# Studio Tab Improvements - 2025-11-21

## Objective
Fix lyrics panel height issue and add individual volume controls to stem channels.

## Issues Reported

### Issue 1: Lyrics Panel Height
**Problem**: Lyrics panel extends beyond the stems mixer height, creating visual imbalance
**Screenshot**: User provided screenshot showing lyrics panel taking excessive vertical space

**Root Cause**:
- No height constraint on `.studio-side-panel`
- Container not using `align-items: flex-start` to align tops
- Panel stretched to content height instead of matching mixer height

### Issue 2: Missing Volume Controls
**Request**: Add individual volume sliders to each stem channel for mixing control

## Implementation

### Fix 1: Lyrics Panel Height Constraint

**CSS Changes** (lines 889-913 in `app/api/static/index.html`):
```css
.studio-container {
    display: flex;
    gap: 20px;
    align-items: flex-start;    /* NEW: Align tops */
    transition: all 0.3s ease;
}

.studio-side-panel {
    width: 350px;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    transition: all 0.3s ease;
    max-height: 600px;           /* NEW: Max height constraint */
    align-self: stretch;         /* NEW: Stretch to match content */
}
```

**Result**:
- Lyrics panel now has maximum height of 600px
- Aligns with top of stems mixer
- Content scrolls if lyrics exceed height
- Visual balance maintained

### Fix 2: Volume Sliders for Stems

**CSS Additions** (lines 888-957):
- `.stem-volume-container` - Container for volume controls
- `.stem-volume-label` - "Vol" label above slider
- `.stem-volume-slider` - Range input styled as horizontal slider
- `.stem-volume-slider::-webkit-slider-thumb` - Custom thumb (gradient circle)
- `.stem-volume-slider::-moz-range-thumb` - Firefox thumb styling
- `.stem-volume-value` - Percentage display below slider

**JavaScript Changes**:

1. **StemsMixer Class** (line 1341):
   - Added `volume: 1.0` to initial stem state
   ```javascript
   this.stemStates[stemName] = { muted: false, soloed: false, volume: 1.0 };
   ```

2. **applyAudioStates()** (lines 1471-1472):
   - Apply volume to audio element
   ```javascript
   audio.volume = state.volume;
   ```

3. **New Method: setVolume()** (lines 1481-1498):
   ```javascript
   setVolume(stemName, volume) {
       if (!this.stemStates[stemName]) return;

       volume = Math.max(0, Math.min(1, volume));
       this.stemStates[stemName].volume = volume;

       const audio = this.audioElements[stemName];
       if (audio) {
           audio.volume = volume;
       }

       const volumeDisplay = document.getElementById(`stem-volume-value-${stemName}`);
       if (volumeDisplay) {
           volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
       }
   }
   ```

**HTML Changes** (lines 2162-2174):
```html
<div class="stem-volume-container">
    <div class="stem-volume-label">Vol</div>
    <input
        type="range"
        class="stem-volume-slider"
        id="stem-volume-${type}"
        min="0"
        max="100"
        value="100"
        oninput="stemsMixer?.setVolume('${type}', this.value / 100)"
        title="Volume for ${type}">
    <div class="stem-volume-value" id="stem-volume-value-${type}">100%</div>
</div>
```

## Features

### Volume Control Features
1. ✅ **Individual Control**: Each stem has its own volume slider
2. ✅ **Real-time Update**: Volume changes apply immediately to playback
3. ✅ **Visual Feedback**: Percentage display updates as slider moves
4. ✅ **Range**: 0% (silent) to 100% (full volume)
5. ✅ **Smooth Slider**: Gradient thumb with hover effects
6. ✅ **Cross-browser**: Styled for both Webkit and Firefox

### Layout Improvements
1. ✅ **Matched Heights**: Lyrics panel height matches stems mixer
2. ✅ **Scrollable Content**: Lyrics scroll if they exceed panel height
3. ✅ **Top Alignment**: Both panels start at same vertical position
4. ✅ **Flexible Layout**: Mixer can grow, lyrics panel constrained

## UI/UX Enhancements

### Slider Design
- Horizontal slider (standard for space-constrained layouts)
- 4px track height with subtle background
- 14px gradient circle thumb
- Hover effects: scale up thumb, show glow
- Smooth transitions

### Volume Display
- Shows percentage (0% - 100%)
- Color: Theme purple (#667eea)
- Updates in real-time as slider moves
- Small, unobtrusive text

### Layout Hierarchy
- Volume control below Mute/Solo buttons
- Compact vertical stacking
- Maintains 90px channel width
- Clear visual separation with spacing

## Files Modified
- `app/api/static/index.html`:
  - CSS: Added volume slider styles (70 lines)
  - CSS: Fixed studio container alignment
  - JavaScript: Added `setVolume()` method
  - JavaScript: Updated stem state initialization
  - JavaScript: Modified `applyAudioStates()` to apply volume
  - HTML: Added volume slider to stem channels

## Testing Checklist
- [ ] Lyrics panel height matches mixer height
- [ ] Lyrics scroll when content exceeds 600px
- [ ] Volume sliders appear for all available stems
- [ ] Volume changes apply immediately to playback
- [ ] Percentage display updates correctly
- [ ] Mute/Solo still work with volume changes
- [ ] Volume persists during playback
- [ ] Slider thumb shows hover effects
- [ ] Works on Chrome/Firefox/Safari

## Status
- [x] Issue identified
- [x] Solution designed
- [x] CSS implemented
- [x] JavaScript implemented
- [x] HTML updated
- [ ] User testing
- [ ] Complete
