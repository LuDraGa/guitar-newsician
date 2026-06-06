# Song Section Pill in Studio Transport

**Goal:** Surface the current song *section* (Intro / Verse 1 / Chorus / Bridge / Outro…)
as a live pill in the main playback control — the slot at the bottom of the Studio
page that currently shows a hardcoded **"Practice"** chip. Source of truth is the
`structure_msaf` analyzer's `mapped_segments`. Also draw faint section-boundary
bands behind the waveform for visual context.

Design reference: `newsician 2/project/transport-bar.jsx` (lines 22-27 bands, 108/125-127 pill).

## Data path (confirmed)

- `structure_msaf` is persisted as an `AnalysisResultRow` with
  `analyzer_name === 'structure_msaf'`.
- `persistAnalysisResults` stores the **whole** analyzer envelope in `data`
  (`data: value ?? {}`, `modal-workflows.ts:1134`), so segments live at:
  `row.data.data.mapped_segments` — an array of
  `{ label, section, start_sec, end_sec }`.
- `row.is_current` marks the live row; rows are pre-sorted by created_at desc.

## Design decisions

1. **Label style — numbered-when-repeated + smart generic relabel.**
   - `verse` / `chorus` / `bridge` → Title Case; append ` N` only when that type
     occurs more than once across the song (Verse 1, Verse 2, Chorus).
   - generic `section` label → **Intro** if it's the first segment, **Outro** if the
     last, else `Section N`.
2. **Scope — pill + waveform section bands.** Bands are absolute-positioned left-border
   lines at `(start/duration)*100%`, mirroring the reference; guarded on `duration > 0`.
3. The existing `Stems mix` / `Original` playback-mode chip beside the pill stays.
4. Fallback when no structure segments exist yet: a `Run analysis for sections`
   button (reuses the analyze workflow), shown only when a `sourceAsset` exists and
   nothing is running.

## Plan / Status — DONE

- [x] Add `SectionSegment` type + `deriveSectionSegments(analysisResults)` +
      `nameSectionSegments()` helpers (above `deriveChordEvents`). Filters to current
      ok `structure_msaf` row, reads `data.data.mapped_segments`, drops non-finite /
      `< 0.5s` spans, sorts by start, applies the naming rules above.
- [x] In `StudioClient`: `const sectionSegments = useMemo(() => deriveSectionSegments(analysisResults), [analysisResults])`.
- [x] Thread `sections` + `analyzing` + `onRunAnalyze` into `<TransportCard>`
      (`onRunAnalyze` gated on `sourceAsset`).
- [x] In `TransportCard`: `currentSection = sections.find(s => time >= s.start && time < s.end)`.
- [x] Replace static `Practice` chip with live section chip / `Run analysis for sections`
      fallback button (disabled + "Analyzing…" while a job runs).
- [x] Add section bands to `renderWaveform` (behind bars, before loop range; skips start≤0).
- [x] `pnpm typecheck` ✅ + `pnpm lint` ✅ (Node 22 via nvm — repo requires 22.x).

## Notes / open items

- The pill currently lives only in the **expanded** transport view; minimized view has
  no chip slot. Keeping parity (pill in expanded view only) unless asked otherwise.
- Degenerate trailing sliver segments (e.g. 150.836 → 150.870 in sample data) are
  filtered by the min-length guard so they never flash as the active section.
