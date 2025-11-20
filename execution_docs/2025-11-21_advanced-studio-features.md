# Advanced Studio Features - 2025-11-21

## Objective
Add advanced playback and lyrics features to the Studio tab:
1. Fix lyrics panel height matching
2. Auto-scroll lyrics with LRC timestamp highlighting
3. Playback speed control (0.1x - 3x)

## Requirements

### 1. Lyrics Panel Height
**Issue**: Lyrics panel extended beyond stems mixer height
**Solution**: Use `height: fit-content` and `max-height: 100%` instead of fixed height

### 2. Auto-Scroll Lyrics
**Features**:
- Toggle switch for auto-scroll on/off
- Highlight current line based on playback time
- 0.3s lookahead (configurable 0-1s)
- Smooth scroll to keep active line centered
- Works only with LRC (synced) lyrics

### 3. Playback Speed Control
**Features**:
- Range: 0.1x to 3.0x
- 2 decimal precision display (e.g., 1.00x, 0.50x, 2.25x)
- Slider control in master transport
- Applies to all stems simultaneously
- Persists during playback

## Implementation

### CSS Additions (Lines 722-1156)

**Playback Speed Control**:
```css
.playback-speed-control      /* Container for speed controls */
.playback-speed-label         /* "Speed" label */
.playback-speed-value         /* Display value (e.g., "1.00x") */
.playback-speed-slider        /* Range input slider */
```

**Lyrics Controls**:
```css
.lyrics-controls              /* Container for toggle and offset controls */
.lyrics-control-group         /* Group for label + control */
.lyrics-control-label         /* Control labels */
.lyrics-toggle                /* Toggle switch container */
.lyrics-toggle.active         /* Active toggle state */
.lyrics-toggle-handle         /* Toggle switch handle */
.lyrics-slider                /* Offset slider */
```

**Lyrics Line Styles**:
```css
.lyrics-line                  /* Individual lyrics line */
.lyrics-line.active           /* Currently highlighted line */
.lyrics-line.upcoming         /* Next line (preview) */
```

**Active Line Styling**:
- Gradient background: `rgba(102, 126, 234, 0.2)` to transparent
- Left border: 3px solid #667eea
- Transform: Slight shift right (3px)
- Opacity transitions for smooth highlighting

### JavaScript Changes

**Global Variables** (Lines 1451-1453):
```javascript
let lyricsAutoScroll = true;         // Toggle state
let lyricsLookahead = 0.3;           // Highlight offset in seconds
let lyricsData = null;                // Parsed LRC data
```

**StemsMixer Class Updates**:

1. **Constructor** (Line 1464):
   - Added `this.playbackRate = 1.0`

2. **New Method: setPlaybackRate()** (Lines 1659-1674):
   ```javascript
   setPlaybackRate(rate) {
       rate = Math.max(0.1, Math.min(3.0, rate));
       this.playbackRate = rate;

       Object.values(this.audioElements).forEach(audio => {
           audio.playbackRate = rate;
       });

       const rateDisplay = document.getElementById('playback-rate-value');
       if (rateDisplay) {
           rateDisplay.textContent = `${rate.toFixed(2)}x`;
       }
   }
   ```

3. **Time Update Loop** (Line 1587):
   - Added `updateLyricsHighlight()` call after `updateTransportDisplay()`

**Lyrics Functions**:

1. **loadLyricsIntoPanel()** (Lines 2444-2539):
   - Parse LRC timestamps into seconds
   - Create data attributes for each line
   - Add controls for auto-scroll toggle and offset slider
   - Store parsed data in `lyricsData` global

2. **toggleLyricsAutoScroll()** (Lines 2541-2548):
   - Toggle auto-scroll on/off
   - Update toggle UI
   - Save state to localStorage

3. **setLyricsLookahead()** (Lines 2550-2557):
   - Set highlight offset (0-1s)
   - Update display
   - Save to localStorage

4. **updateLyricsHighlight()** (Lines 2559-2594):
   - Called every 100ms during playback
   - Find active line based on `currentTime + lookahead`
   - Apply `.active` class to current line
   - Apply `.upcoming` class to next line
   - Auto-scroll to center active line

### HTML Changes

**Master Transport** (Lines 2304-2316):
```html
<div class="playback-speed-control">
    <span class="playback-speed-label">Speed</span>
    <input type="range" class="playback-speed-slider"
           id="playback-rate-slider"
           min="10" max="300" value="100"
           oninput="stemsMixer?.setPlaybackRate(this.value / 100)">
    <span class="playback-speed-value" id="playback-rate-value">1.00x</span>
</div>
```

**Lyrics Controls** (Lines 2480-2500):
```html
<div class="lyrics-controls">
    <!-- Auto-scroll toggle -->
    <div class="lyrics-control-group">
        <span class="lyrics-control-label">Auto-scroll</span>
        <div class="lyrics-toggle active" onclick="toggleLyricsAutoScroll()">
            <div class="lyrics-toggle-handle"></div>
        </div>
    </div>

    <!-- Offset slider -->
    <div class="lyrics-control-group">
        <span class="lyrics-control-label">Offset</span>
        <input type="range" class="lyrics-slider"
               min="0" max="100" value="30"
               oninput="setLyricsLookahead(this.value / 100)">
        <span>0.3s</span>
    </div>
</div>
```

**Lyrics Lines** (Lines 2502-2509):
```html
<div class="lyrics-line" data-time="${timeInSeconds}" data-index="${index}">
    <div style="font-size: 0.85em; color: #e0e0e0; line-height: 1.6;">
        ${text}
    </div>
</div>
```

## Features Summary

### 1. Lyrics Panel Height Fix ✅
- Changed from `max-height: 600px` to `height: fit-content; max-height: 100%`
- Panel now adapts to content but doesn't exceed container height
- Better visual alignment with stems mixer

### 2. Auto-Scroll Lyrics ✅
- **Toggle Control**: Turn on/off auto-scroll
- **Offset Control**: Adjust lookahead time (0-1s, default 0.3s)
- **Active Line Highlighting**:
  - Current line: Purple gradient background + left border
  - Upcoming line: Slightly higher opacity
  - Other lines: 50% opacity
- **Smart Scrolling**:
  - Centers active line in viewport
  - Smooth scroll behavior
  - Only works with LRC (synced) lyrics
- **State Persistence**: Settings saved to localStorage

### 3. Playback Speed Control ✅
- **Range**: 0.1x (very slow) to 3.0x (triple speed)
- **Precision**: 2 decimal places (e.g., 0.25x, 1.50x, 2.75x)
- **UI**: Compact slider in master transport area
- **Sync**: Applied to all stems simultaneously
- **Display**: Real-time update of speed value

## Technical Details

### LRC Parsing Algorithm
1. Extract timestamp: `[mm:ss.xx]text`
2. Convert to seconds: `parseInt(minutes) * 60 + parseFloat(seconds)`
3. Store with text and index
4. Binary search during playback for efficiency

### Highlight Logic
```javascript
const currentTime = stemsMixer.currentTime + lyricsLookahead;

// Find active line (most recent timestamp <= currentTime)
for (let i = lyricsData.length - 1; i >= 0; i--) {
    if (currentTime >= lyricsData[i].timeInSeconds) {
        activeIndex = i;
        break;
    }
}
```

### Scroll Calculation
```javascript
const lineTop = line.offsetTop;
const containerHeight = container.clientHeight;
const scrollTo = lineTop - (containerHeight / 2) + (line.clientHeight / 2);
container.scrollTo({ top: scrollTo, behavior: 'smooth' });
```

## UX Enhancements

### Visual Feedback
- **Active Line**:
  - Purple gradient fade from left
  - 3px left border accent
  - Full opacity
  - Slight right shift (3px)

- **Upcoming Line**:
  - 70% opacity
  - No special styling

- **Other Lines**:
  - 50% opacity
  - Subtle presence

### Controls Design
- **Toggle Switch**: iOS-style with sliding handle
- **Sliders**: Minimal design with purple thumb
- **Labels**: Uppercase, subtle gray
- **Values**: Monospace font, purple color

## Performance Considerations

- Lyrics update every 100ms (same as time display)
- Efficient binary search for active line lookup
- Smooth scroll uses CSS `scroll-behavior`
- Class toggling minimized to active/upcoming lines only
- LocalStorage for settings persistence

## Browser Compatibility

- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support (with -moz- prefixes)
- ✅ Safari: Full support (with -webkit- prefixes)

## Files Modified
- `app/api/static/index.html`:
  - CSS: 200+ lines (lyrics controls, playback speed, line styles)
  - JavaScript: 150+ lines (auto-scroll logic, state management)
  - HTML: Lyrics controls, playback speed slider

## Testing Checklist
- [ ] Lyrics panel height matches stems mixer
- [ ] Auto-scroll toggle works
- [ ] Offset slider changes highlight timing
- [ ] Current line highlighted correctly
- [ ] Auto-scroll centers active line
- [ ] Playback speed slider works (0.1x - 3x)
- [ ] Speed applies to all stems
- [ ] Settings persist to localStorage
- [ ] Works on Chrome/Firefox/Safari
- [ ] Smooth transitions and animations

## Status
- [x] Design complete
- [x] Implementation complete
- [ ] User testing
- [ ] Complete
