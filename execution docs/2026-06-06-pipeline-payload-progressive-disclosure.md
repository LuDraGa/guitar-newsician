# Pipeline payload viewer — design alignment + progressive disclosure

**Date:** 2026-06-06
**Branch:** feature/analysis-fullstack
**File:** `src/features/pipeline/PipelineClient.tsx`
**Status:** ✅ Implemented · typecheck + lint clean · reviewed and approved by user

## Problem

Right-hand **Job payload** panel renders `metadata`, `request_payload`,
`response_payload`, `diagnostics`. Three issues:

1. **Weird nested grey box.** `JobPayloadExplorer` is a `bg-paper` (grey)
   wrapper; inside it each `JsonSection` is a `bg-card` (near-white) card; the
   whole thing sits inside `aside.surface` (also near-white). Result:
   white → grey → white nesting. Only place in the app that does this.
2. **Horizontal stretch.** `JsonSection` `min-w-max` + every `JsonNode` row
   `min-w-max whitespace-nowrap` + outer `overflow-auto`. A single long string
   primitive (rendered in full) drags the whole tree's width out; every
   container inherits it.
3. **No truncation / length.** Long strings render in full; wrapping would
   explode vertical space.

## Approach (aligned to product DNA)

- **A. Recessed trays, not a grey wrapper.** Outer wrapper → transparent
  vertical scroll region. Each section → self-contained recessed `--paper`
  tray (inset hairline, `--radius`), separated by `gap-3`. Mirrors the
  recessed-well language already used by AssetDetail's storage-path block.
- **B. Bound width per tray.** Drop `min-w-max` from sections; scope
  horizontal scroll to each tray's body. String values wrap inside the tray
  (`break-words`) instead of stretching; structural `{ } [ ]` rows stay nowrap.
- **C. Progressive disclosure for long strings** (new `JsonString`):
  - Preview first **140** chars, dimmed `…`.
  - **Show more** reveals **+100/click** (chunked, user-controlled vertical).
  - **Show all** escape hatch + **Less** to collapse.
  - Length badge (`2,438 chars`).
- **D. Header polish.** Hover affordance on the section toggle; title truncates,
  summary stays; per-section copy retained.

## Decisions (confirmed with user)

- Preview length: **~140 chars**.
- Reveal controls: **Show more (+100) + Show all + Less**.

## Edits (all in `PipelineClient.tsx`)

- [x] `JobPayloadExplorer` — transparent `flex-col gap-3 overflow-y-auto`
  container; fallback box → recessed `--paper`.
- [x] `JsonSection` — recessed `--paper` tray, drop `min-w-max`, hover on
  header, body `overflow-x-auto`.
- [x] `JsonNode` primitive branch — wrappable value cell (`flex-1 min-w-0`),
  drop row-level `min-w-max whitespace-nowrap`.
- [x] `JsonName` — `shrink-0` so keys don't compress.
- [x] `JsonPrimitive` — strings delegate to new `JsonString`.
- [x] New `JsonString` + constants `STRING_PREVIEW=140`, `STRING_STEP=100`.

## Verify

- [x] `pnpm typecheck` — clean
- [x] `pnpm lint` — clean
- [x] Browser — reviewed and approved by user on running dev server.

## Out of scope

Job/asset lists, AssetDetail, filters. Payload explorer only.
