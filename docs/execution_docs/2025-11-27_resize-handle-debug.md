# Resize Handle Debug - 2025-11-27

## Problem
The resize handle between transcription and studio panels is inverted:
- Drag RIGHT → Transcription gets SMALLER (should get LARGER)
- Drag LEFT → Transcription gets LARGER (should get SMALLER)

## Current Setup (PanelLayout.tsx)
```
<PanelGroup direction="horizontal">
  <Panel> {/* Transcription - 20% default */}
  <PanelResizeHandle/>
  <Panel> {/* Studio - 80% default */}
</PanelGroup>
```

## Investigation Steps

### Step 1: Verify react-resizable-panels behavior
- Normal behavior: Handle controls the panel BEFORE it (to its left)
- Dragging RIGHT should expand left panel
- Our symptoms: Exact opposite

### Step 2: Check transforms
- ✅ Removed translateX from transcription motion.div (now uses opacity/scale)
- ✅ Changed outer motion.div from x: '-100%' to x: '100%'
- ❌ Still inverted after restart

### Step 3: Test hypotheses
- ✅ Added explicit id props to panels
- ✅ Removed className="flex-row" from PanelGroup
- ✅ Cleaned up conditional rendering (removed nested fragments)
- [ ] Test if issue persists

### Step 4: Research findings
- Found GitHub issue #173: `flex-direction: row-reverse` causes inverted behavior
- We're not using that CSS, so not the issue
- Conditional rendering with fragments might confuse panel order

## Next Steps if still broken
1. Try always rendering both panels (hide with CSS instead of conditional)
2. Remove ALL framer-motion animations to isolate
3. Check browser DevTools to see actual DOM order
4. Create minimal test case without animations

## Decision: Build Custom Panel System

After multiple attempts to fix react-resizable-panels inversion issue, decided to build custom solution.

### Requirements
- Horizontal resizable panels
- Drag handle between panels
- Min/max size constraints
- Smooth drag experience
- Modular and extensible
- Full control over behavior

### Architecture
1. **ResizeHandle** - Draggable divider component
2. **ResizablePanel** - Panel wrapper with size state
3. **PanelContainer** - Coordinate layout and manage children

### Implementation Plan
1. ✅ Create ResizeHandle with mouse drag logic
2. ✅ Create Panel component
3. ✅ Create PanelContainer with flexbox layout
4. ✅ Replace react-resizable-panels in PanelLayout.tsx

## Implementation Complete

### Created Files
- `frontend/src/components/panels/ResizablePanels.tsx` - Modular, self-contained panel system

### Components
1. **PanelGroup** - Container that manages panel sizes via React Context
2. **Panel** - Individual panel with size constraints (min/max)
3. **ResizeHandle** - Draggable divider with mouse event handling

### Key Features
- Percentage-based sizing (responsive)
- Min/max constraints per panel
- Smooth drag interaction
- Prevents text selection during drag
- Horizontal and vertical layouts
- Fully typed with TypeScript
- Minimal dependencies (only React)
- Modular and reusable across projects

### Integration
- Updated PanelLayout.tsx to use custom components
- Removed react-resizable-panels dependency
- Maintained same UI/UX behavior with correct drag direction
