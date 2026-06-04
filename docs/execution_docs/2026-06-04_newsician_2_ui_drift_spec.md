# Spec: Newsician 2 Current UI Drift

**Date**: 2026-06-04
**Status**: Approval needed
**Owner**: Codex

## Purpose

This replaces the earlier over-broad drift notes. It only describes drift in
the currently wired UI:

- `src/components/shell/AppShell.tsx`
- `src/features/library/LibraryClient.tsx`
- `src/features/studio/StudioClient.tsx`
- `src/features/pipeline/PipelineClient.tsx`

Legacy Studio transcription/workflow artifacts were removed from the codebase
and are not considered UI drift.

## Current Baseline

The current app already has several intentional product changes:

- Studio has one shared main playback control across Karaoke, Guitar learner,
  and Lyrics editor. This is intentional and should stay.
- Production Library uses real source ingest, upload, and optional local-only
  YouTube download. This should stay, but can be visually softened.
- Production Pipeline has advanced filters, runtime columns, and collapsible
  JSON payload inspection. This should stay unless we decide to simplify the
  diagnostics page later.

The real remaining drift is mostly overall look and feel, especially in Studio.
The Newsician 2 design feels like a warm, focused music practice surface. The
current Studio works, but it reads more like a functional product console.

## Approval Summary

Approve the items you want and I will implement in that order.

| ID | Area | What changes | Why |
| --- | --- | --- | --- |
| A | Studio visual fit | Make Studio closer to Newsician 2: smaller song header, standalone mode pills, calmer spacing, stronger card proportions. | Biggest look-and-feel drift. |
| B | Karaoke panel | Make lyrics more expressive, stems more like live meters, chord panel less like a placeholder. | Makes Studio feel like a music/practice app. |
| C | Guitar learner | Move MIDI/MusicXML actions out of the primary mode row and improve empty/asset states. | Reduces console feel. |
| D | Coach dock | Add dismissible suggestions and conversation-style thread UI. | Matches the design's proactive coach. |
| E | Library intake polish | Keep real ingest/upload, but make expanded forms feel like intentional disclosure. | Lower priority; Library is mostly aligned. |
| F | Pipeline polish | Keep advanced diagnostics, but reduce dashboard weight from metrics/filters if desired. | Optional; current Pipeline is a product improvement. |

Recommended first pass: **A + B**, then review screenshots before touching the
rest.

## Non-Drift Decisions

These should not be "fixed" back to the mock:

- Do not remove the single shared Studio playback.
- Do not remove real Supabase/Next/Modal production actions.
- Do not move CRUD, jobs, storage, auth, or product state into the Python
  backend.
- Do not remove active MusicXML preview files; they are used by Guitar learner.
- Do not simplify Pipeline unless we explicitly choose visual match over
  diagnostics depth.

## Detailed Correction Options

<details>
<summary>A. Studio visual fit</summary>

### Current drift

- Song title/header is larger than the design and dominates the workspace.
- Studio mode tabs are currently a dark segmented control. The design uses
  standalone rounded mode pills with active dark fill and inactive outlined
  pills.
- Header controls, facts, messages, and content compete for vertical space.
- The overall Studio density feels more admin/product-console than practice
  surface.

### Correction

- Reduce song title closer to the design scale.
- Restore standalone mode pills for Karaoke, Guitar learner, Lyrics editor.
- Keep the song switcher and refresh, but make them secondary.
- Reserve a stable status/message row so layout does not jump.
- Preserve the full-height Studio and shared bottom playback.

</details>

<details>
<summary>B. Karaoke panel</summary>

### Current drift

- Lyrics are functional but less expressive than the design.
- Stem controls work, but they do not feel like live meters.
- Chord panel currently communicates analysis readiness more than musical state.

### Correction

- Increase lyric scale and vertical breathing room.
- Keep click-to-seek on the visible lyric text.
- Add live-meter behavior behind stem sliders without breaking real stem volume.
- Change chord panel toward current/next chord when data is available; use a
  design-matched pending state otherwise.

</details>

<details>
<summary>C. Guitar learner</summary>

### Current drift

- The mode row mixes learning modes with generation actions.
- Chord diagrams are placeholder-like.
- Missing MusicXML/tab states can feel technical instead of learner-focused.

### Correction

- Keep Chords, Sheet, and Tab as primary mode pills.
- Move MIDI/MusicXML generation into empty states or a secondary action group.
- Improve empty states for missing notation so they explain what the learner can
  do next.
- Keep the shared bottom playback.

</details>

<details>
<summary>D. Coach dock</summary>

### Current drift

- The dock exists and is positioned correctly.
- It lacks the design's conversation thread.
- Suggestions are not dismissible.

### Correction

- Add dismissible suggestion cards.
- Add conversation-style message bubbles above the composer.
- Keep current context-aware suggestions and real composer as the base.

</details>

<details>
<summary>E. Library intake polish</summary>

### Current drift

- Library hero, cards, search, and view switcher are close to the design.
- Expanded source/upload/local-dev forms make the page heavier than the mock.

### Correction

- Keep Add song and Upload audio as the main hero CTAs.
- Present expanded source/upload forms as a tighter disclosure, drawer, or
  modal.
- Keep local YouTube download gated and visually marked as local dev only.

</details>

<details>
<summary>F. Pipeline polish</summary>

### Current drift

- Pipeline is more powerful than the mock.
- Metrics and filters make it feel more dashboard-like.

### Correction

- Keep advanced filters and JSON explorer unless you want the leaner mock feel.
- Optionally collapse metrics into a compact summary row.
- Keep Search, Refresh, Jobs/Assets tabs, table, and right inspector as the main
  hierarchy.

</details>

## Cleanup Completed

Removed unused legacy Studio files:

- `src/features/studio/TranscriptionWorkspace.tsx`
- `src/features/studio/TranscriptionPanels.tsx`
- `src/features/studio/TranscriptionAssistantPanel.tsx`
- `src/features/studio/TranscriptionSelectionToolbar.tsx`
- `src/features/studio/useTranscriptionWorkspace.ts`
- `src/features/studio/StudioWorkflowPanels.tsx`
- `src/features/studio/StemMixerPanel.tsx`

Still active and kept:

- `src/features/studio/MusicXmlPreviewPanel.tsx`
- `src/features/studio/MusicXmlPreviewVisuals.tsx`

