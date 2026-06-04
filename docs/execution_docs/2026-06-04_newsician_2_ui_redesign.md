# Execution Doc: Newsician 2 UI Redesign

**Date**: 2026-06-04
**Status**: Completed
**Owner**: Codex

## Objective

Rework the WereCode app UI using the exported `newsician 2` design bundle as the visual direction, while preserving the Next.js and Supabase-owned product workflows.

## Context

- The `newsician 2/project/` prototype defines a warm paper/ink studio with segmented navigation, pill controls, readiness chips, generated cover art, library cards, studio panels, and a pipeline diagnostics workspace.
- The production app already owns library CRUD, uploads, job orchestration, lyrics, assets, and Supabase storage from Next route handlers.
- The redesign needed to copy the library, studio, and pipeline experience without moving production state back into the local-only Python backend.

## Plan

- [x] Read `newsician 2/README.md` and follow the primary prototype imports.
- [x] Port the visual system into app globals and shared React primitives.
- [x] Redesign the app shell and library client around the prototype’s library view.
- [x] Redesign the studio client and workflow panels while preserving orchestration actions.
- [x] Add a production Next pipeline diagnostics route using existing job and asset APIs.
- [x] Verify typecheck, lint, desktop routes, and mobile-width layout.
- [x] Apply design-review correction so Library and Studio match the prototype product UX instead of exposing dev workflow surfaces.

## Progress Log

### 2026-06-04

**Action**: Ported the warm visual language from `newsician 2/project/styles.css`.
**Result**: Added paper/ink tokens, pill controls, segmented nav, cover art, chips, status dots, and responsive shell behavior in the root app.
**Notes**: Kept Geist as the actual app font per the existing Next stack.

---

### 2026-06-04

**Action**: Rebuilt Library, Studio, and Pipeline UI surfaces.
**Result**: Library now uses the prototype-style hero, intake toolbars, grid/list cards, readiness chips, and recent jobs rail. Studio now uses a song header, workflow pills, readiness panels, coach rail, jobs rail, and the existing deeper transcription/stem surfaces. Pipeline now has a real `/pipeline` route backed by app job and asset APIs.
**Notes**: No production data ownership moved outside Next/Supabase.

---

### 2026-06-04

**Action**: Ran verification and responsive checks.
**Result**: `pnpm typecheck` and `pnpm lint` pass with the compatible Node runtime. Browser checks passed on `/library`, `/studio`, and `/pipeline` with no console errors. Mobile width showed no body overflow.
**Notes**: The shell’s mobile `Ask coach` hiding needed a dedicated helper because the custom `.pill` rule overrode Tailwind’s `hidden`.

---

### 2026-06-04

**Action**: Reworked the redesign after product/design review.
**Result**: Library no longer shows recent jobs or dev workflow surfaces. Studio now opens as the product workspace from the design: Karaoke, Guitar learner, and Lyrics editor modes backed by existing real workflow APIs. `Ask coach` now toggles an in-studio coach drawer/panel instead of acting like a separate destination.
**Notes**: Pipeline was left structurally intact because it already matched the design direction.

---

### 2026-06-04

**Action**: Ran second-pass verification.
**Result**: `pnpm typecheck` and `pnpm lint` pass with the compatible Node runtime. Browser checks passed for `/library`, `/studio`, `/pipeline`, the Studio coach toggle, Studio mode switching, and mobile-width Library/Studio layout. The Next dev hydration warning from waveform float serialization was fixed by using integer bar heights.
**Notes**: Screenshots were captured under `/private/tmp/werecode-redesign-*-v2.png`.

---

### 2026-06-04

**Action**: Restored the Library page's local-only YouTube download control.
**Result**: Product Add song now always uses the product ingest/probe path, while the YouTube download form is a separate Library-only surface rendered only when `NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true`.
**Notes**: This keeps local development yt-dlp workflow visible without exposing it as normal product intake.

---

### 2026-06-04

**Action**: Tightened Studio after screenshot review.
**Result**: Studio now uses a bounded desktop workspace instead of a long scrolling page. Karaoke keeps the mixer, lyrics, chord status, and transport in one viewport; Guitar uses fixed-size chord cards plus a progression strip; Lyrics editor keeps its bottom action visible. Coach is now a viewport-fixed overlay drawer and no longer pushes or resizes the Studio canvas.
**Notes**: Removed the Studio transform wrapper so fixed overlays are positioned against the viewport, not the animated section container.

---

### 2026-06-04

**Action**: Matched Studio playback behavior to the product design tabs.
**Result**: Karaoke, Guitar learner, and Lyrics editor now share one bottom playback control. The shared player includes A/B loop controls and the full practice speed set, while Karaoke has an Auto-scroll toggle for synced lyrics.
**Notes**: Keeping transport at the Studio container level also keeps lyric timing state available across tab switches.

---

### 2026-06-04

**Action**: Made the Studio product controls functional against playback.
**Result**: Karaoke stem levels, mute, and solo now drive the shared transport's actual stem mix when stem assets are available. Synced lyric lines seek playback with a 350 ms lead-in. The Lyrics editor now matches the product sync design with timestamp rows, import, validation, offset, .lrc export, and stamp-and-advance controls.
**Notes**: The transport falls back to the original track when signed stems are unavailable, and switches to synchronized multi-stem playback once stem URLs are ready.

---

### 2026-06-04

**Action**: Polished Studio stem and lyric interactions after functional verification.
**Result**: Replaced the transparent native stem range with an accessible custom level slider that updates the active stem mix directly. Synced lyric text now renders word spans inside the timed line control, so clicks on individual words still seek the shared transport.
**Notes**: Browser verification confirmed keyboard slider changes update the hidden stem audio volume mirror, and word clicks seek to the intended lead-in target.

---

### 2026-06-04

**Action**: Fixed Studio regression reports from live use.
**Result**: Synced lyric click targets now hug the visible lyric text instead of spanning the whole pane. Stem volume changes preserve the current transport time and suppress stray stem time updates while the mix changes.
**Notes**: Browser verification confirmed vocal volume changes no longer move the playback cursor.

---

### 2026-06-04

**Action**: Fixed the remaining Studio mixer rollback path and expanded Pipeline controls.
**Result**: Stem level, mute, and solo changes now guard against stale stem time updates moving the shared transport backwards. Mute and solo controls have distinct active styling. Pipeline refresh now lives with the search/control strip, and jobs can be filtered by multiple songs, job types, endpoints, and statuses.
**Notes**: Browser verification confirmed a 0:56 synced-lyric seek stayed at 0:56 after level, mute, and solo changes. Pipeline verification confirmed multi-select status filtering, selected counts, and Clear filters behavior.

## Blockers

- [x] Local default Node was `v18.20.3`, below the repo requirement.
  - Resolved by running checks with the bundled compatible Node runtime.
- [x] ESLint picked up the exported `newsician 2` prototype files.
  - Resolved by adding the design bundle to ESLint ignores.
- [x] Next dev overlay showed a waveform hydration warning after the Studio rewrite.
  - Resolved by making generated waveform bar heights deterministic integer percentages.

## Decisions Made

1. **Decision**: Keep the redesign in production React/Next components instead of copying prototype globals directly.
   - **Rationale**: The prototype is a visual handoff, while the app needs real Supabase data and route handlers.
   - **Alternatives Considered**: Importing prototype JSX directly, which would have introduced mock state and browser globals.

2. **Decision**: Add `/pipeline` as a Next route backed by existing jobs and assets APIs.
   - **Rationale**: The prototype includes a Pipeline workspace, and this repo’s runtime split says pipeline/product state belongs in the Next app.
   - **Alternatives Considered**: Leaving Pipeline as nav-only or mock-only.

## Testing

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] Browser verification for `/library`
- [x] Browser verification for `/studio`
- [x] Browser verification for `/pipeline`
- [x] Mobile-width overflow and nav visibility check
- [x] Browser verification for Studio coach toggle
- [x] Browser verification for Studio Karaoke, Guitar learner, and Lyrics editor modes
- [x] Browser verification for local-only Library YouTube download gating/copy
- [x] Browser verification for revised Studio sizing, no desktop page overflow, coach overlay bounds, and mobile horizontal overflow
- [x] Browser verification for shared Studio playback, loop controls, Lyrics editor playback, and Karaoke auto-scroll toggle
- [x] Browser verification for functional stem mix controls, lyric click-to-seek, and the redesigned Lyrics editor sync workflow
- [x] Browser verification for custom stem slider volume updates and word-level lyric seeking
- [x] Browser verification for lyric hit target geometry and stem-volume changes preserving transport time
- [x] Browser verification for level, mute, and solo changes preserving the non-zero Studio transport time
- [x] Browser verification for Pipeline refresh placement and multi-select filters

## Results

The app now follows the `newsician 2` product direction more closely: Library is product-first with a local-only YouTube development control behind the env flag, Studio is a bounded karaoke/guitar/lyrics workspace with an overlay coach drawer, Pipeline remains diagnostics-focused, and real WereCode data/workflows are still owned by the root Next app and Supabase.

## References

- `newsician 2/README.md`
- `newsician 2/project/WereCode Studio.html`
- `newsician 2/project/styles.css`
- `newsician 2/project/library.jsx`
- `newsician 2/project/app.jsx`
- `newsician 2/project/pipeline.jsx`
