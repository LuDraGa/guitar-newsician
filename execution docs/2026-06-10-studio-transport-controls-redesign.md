# Studio transport controls redesign

**Date:** 2026-06-10
**Branch:** core-flow-rework
**File of record:** `src/features/studio/StudioClient.tsx` (`TransportCard`), `src/app/globals.css`
**Reference:** `Newsician/transport-bar.jsx` (Claude design)

## Goal

Bring the reference transport bar's visual language (font decorations, backgrounds,
visual grouping hierarchy) to the live Studio transport. Pure visual reskin — the
Web Audio engine wiring, A/B-at-playhead logic, speed set, and keyboard shortcuts
stay identical. The only new state is a remembered mute level.

## Decisions (locked with user)

1. **Loop (A–B):** reference's accent-soft active pill. Idle buttons read `Set A` /
   `Set B`; once set they show the mono timestamp (`A 0:42` / `B 1:08`). Tiny label
   flips from `A–B` to the **loop length** (`0:26 loop`) when both are set.
2. **Volume:** functional **mute** button (remembers prior level via retained state),
   gradient-fill styled slider, mono `%` readout. Range **0–150%** boost preserved,
   with a subtle **100% detent** tick.
3. **Speed:** discrete buttons → **stepped snap slider**, 6 even-spaced stops
   (index-mapped over `[0.5,0.75,1,1.5,1.75,2]`), **1× emphasized as centered home**,
   mono `x1.0` readout. Lives bottom-right with loop+repeat, in the volume idiom.
4. **Repeat:** icon-only (no text, no switch track). Square iconbtn; **on-state = ink
   fill + accent-colored loop glyph** (strong toggle, distinct from soft A–B region).
5. **Skip buttons:** reference circular-arrow SVG with the `5` baked into the centre.
6. **Play button:** 50px ink circle + shadow-card.
7. **Minimized bar:** propagate the new play-button look; stays lean.
8. **CSS:** one scoped `.transport-range` class for the custom range thumb (webkit +
   moz pseudo-elements); track fill stays inline via gradient. Reused by volume + speed.

## Status

- [x] Execution doc
- [x] `.transport-range` slider CSS in globals.css
- [x] Mute state + effective-volume wiring
- [x] Skip buttons (circular-arrow SVG)
- [x] Play button 50px (expanded + minimized)
- [x] Volume cluster (mute + gradient slider + 100% detent + readout)
- [x] Loop (A–B) control restyle
- [x] Repeat toggle (icon-only, ink+accent on)
- [x] Speed slider (stepped snap, ticks, 1× home)
- [x] Remove now-unused imports (RotateCcw/RotateCw), add VolumeX
- [x] typecheck + lint + visual verify

## Verification (2026-06-10)

- `pnpm typecheck` — clean. `pnpm lint` — 0 errors (remaining warnings are pre-existing,
  in `Newsician/` and `.claude/skills/`, none in touched files).
- Browser preview (1440×900): loop pill flips to accent-soft + accent ring with the
  label reading the loop length (`1:09 LOOP`), ink-filled A/B mono timestamps, clear ✕.
  Repeat on-state = ink fill + accent glyph. Speed slider index→stop mapping confirmed
  (index 4 → `x1.75`), volume range preserved at 0–150. Circular-arrow skip buttons and
  50px play render correctly. No console errors.
