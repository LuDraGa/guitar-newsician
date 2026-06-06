# Relocate pipeline run/re-run controls into their features

**Goal:** Kill the shared top "Re-run" strip in Studio (the ugly multi-pill row
that bundled four unrelated stage actions and duplicated each feature's own run
CTA). Push every stage's run + force-re-run *into the feature that owns its
output*, and give Analysis — the one cross-cutting stage — a dedicated home on
the mode-tabs row.

## Decisions (approved)

| Stage | Home |
|---|---|
| **Stems** re-run | Stem mixer box header (Karaoke tab) |
| **Lyrics** re-run | Lyrics box — Karaoke `LyricsPane` header + Lyrics editor `Auto-align` |
| **MIDI** run + re-run | Guitar learner tab toolbar only |
| **Analysis** (Quick/Full depth + run/re-run + staleness) | Right end of the mode-tabs row, new `AnalysisControl` |

## Design language (consistent everywhere)

- **Quiet by default** — re-run is a `pill ghost sm` (outline), not a heavy dark pill.
- **Accent only when actionable** — when a stage's current output predates the
  latest `pipeline_version` (`computeStageStatuses().isStale`), the control flips
  to `accent-soft` bg + `accent-ink` text + a small `.pulse` accent dot
  ("new model available"). That is the only state that shouts.
- Analysis depth uses the real `.segment` control (light variant: card bg + line
  ring + ink active pill), replacing the hand-rolled inline-styled toggle.
- New shared `PipelineActionButton` primitive carries the quiet/stale logic so
  stems / analysis behave identically; lyrics + midi reuse the same inline rule.

## Plan / Status — DONE

- [x] Add `staleStages` memo (`Set<PipelineStage>` of stale stages) next to `stageStatuses`.
- [x] Remove `stageRerunners` (only the strip used it) + drop now-unused `PIPELINE_VERSIONS` / `PipelineStage` imports.
- [x] Delete the shared strip block (depth toggle + Re-run pills).
- [x] Wrap `StudioModeTabs` + new `AnalysisControl` in one justify-between row.
- [x] Add `PipelineActionButton` + `AnalysisControl` components.
- [x] `StemsPanel`: re-run in header when stems exist (`stemsStale`, `onRerunStems`).
- [x] `LyricsPane` (karaoke): re-sync in header when `syncedLyrics` exists.
- [x] `LyricsEditorProductView`: `Auto-align` becomes contextual `Re-align` + stale dot when synced.
- [x] `GuitarLearnerView`: MIDI button becomes `Re-run MIDI` + stale dot when `noteEventsAsset` exists.
- [x] Thread `*Stale` + `onRerun*` props through the three tab views.
- [x] `pnpm typecheck` ✅ + `pnpm lint` ✅ (Node 22 via nvm).

## Notes

- Staleness only meaningful when output exists; each feature box already gates the
  re-run affordance on its own has-output state, and `staleStages.has(stage)` is a
  pure hint (false when no output, since absent stages aren't in `stageStatuses`).
- Re-run = `workflowActions.*({ force: true })`; first-run = the existing non-force call.
- `analyzeDepth` stays the source of truth for the analyze preset (full = chords + structure).
