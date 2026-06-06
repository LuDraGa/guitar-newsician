# Re-runnable pipeline stages (version-stamped supersede)

Status: **Code complete** — 2026-06-06 (migration not yet applied to Supabase)

## Goal

Let any previously-processed song be re-run through a stage (stem separation,
analysis, MIDI transcription, lyrics alignment) when the backend/Modal model is
upgraded — without producing duplicate assets/rows, and surfacing "a newer model
exists, re-run" in the Studio.

Scope locked with user:
- **Replace-in-place** (latest run wins; prior rows soft-archived `is_current=false`, storage kept).
- **Per-song only** (no library-wide queue/cron/backfill).

## Why it was impossible before

- `persistAnalysisResults` / `createAssetRows` use plain `.insert()` → re-run
  appends duplicate rows for the same `(song, analyzer)` / stem kind. No "current"
  pointer. Client hacks around it with `latestAssetsByKind` / `dedupeLatestStemAssets`.
- No version/provenance stamp → can't tell a song is stale vs a new model.
- No generalized `force` / skip-if-fresh guard (only `midi`/`lyrics_fetch` had ad-hoc skips).
- `runStoredJob(jobId)` replay primitive existed but was never wired to the UI.

## Design

1. **Version registry** — `src/server/werecode/pipeline-versions.ts`. One version
   string per stage; bump on model swap. Also maps stage ↔ representative asset
   kinds and computes stale stages. Importable by client + server (no `server-only`).
2. **Schema** — additive columns:
   - `assets.pipeline_version text`, `assets.is_current boolean default true`
   - `analysis_results.is_current boolean default true`
   - partial indexes on `(song_id, kind) where is_current`.
   Legacy rows backfill to `is_current=true`, `pipeline_version=null` → null != latest
   → correctly flagged stale (exactly the "re-run old music" case).
3. **Supersede + skip-if-fresh** — in `modal-workflows.ts`:
   - `force` added to analyze/separate/midi/lyrics_align schemas.
   - Skip: if `!force` and a current stage asset already matches the registry
     version → mark job ready/"up to date", return existing, never call Modal.
     (Replay via `existingJob` always runs.)
   - On success: flip prior current rows `is_current=false`, insert new stamped
     with `pipeline_version` + `is_current=true`. Fixes the duplicate bug.
4. **Re-run UI** — studio route filters `is_current=true`; `assetSummarySelect`
   exposes `pipeline_version`. `StudioClient` computes `computeStageStatuses` from
   current assets and renders a self-contained **Re-run** bar with a button per
   *completed* stage (`force: true`) — always available, no version bump required.
   Stale stages additionally show a "· new model" hint. Sub-component buttons unchanged.

## Files

- [x] `execution docs/rerun-stages.md` (this doc)
- [x] `supabase/sql/2026-06-06_werecode_pipeline_versions.sql` — migration
- [x] `src/server/werecode/pipeline-versions.ts` — registry + helpers
- [x] `src/types/werecode.ts` — AssetRow/AnalysisResultRow fields
- [x] `src/types/werecode-client.ts` — AssetSummary.pipeline_version
- [x] `src/server/werecode/selects.ts` — assetSummarySelect += pipeline_version
- [x] `src/lib/client-cache/werecode-data-cache.ts` — toAssetSummary mapper
- [x] `src/server/werecode/modal-workflows.ts` — force/supersede/skip/stamp
- [x] `src/app/api/studio/[songId]/route.ts` — filter is_current
- [x] `src/features/studio/StudioClient.tsx` — staleStages + banner + force

## Verification

- [x] `pnpm typecheck` clean (Node 22)
- [x] `pnpm lint` clean
- [ ] Migration applies (run in Supabase SQL editor) — **pending, do before deploy**
- [ ] Re-run a stage → no duplicate current assets; prior soft-archived
- [ ] Old song shows stale banner; re-run clears it

## How to use after deploy

1. Apply `2026-06-06_werecode_pipeline_versions.sql` in Supabase.
2. When you upgrade a model on Modal/backend, bump the matching `version`
   string in `src/server/werecode/pipeline-versions.ts` and deploy. Every song
   with an older output then shows "Newer model available — Re-run {stage}".
3. Clicking Re-run forces the stage, supersedes the old output in place.

## Analyze depth

- **Default is Full** — both first-pass Analyze and Re-run send the explicit full
  analyzer set (`ANALYZE_FULL_ANALYZERS` in `pipeline-versions.ts`):
  `basic_stats`, `tempo_beats`, `tonal_key`, `chords`, `structure_msaf`.
- A **Quick / Full toggle** sits in the control strip above the workspace
  (visible whenever source audio exists). `analyzeDepth` state, default `'full'`.
  Quick uses the cheap `preset: 'quick'` (3 fast analyzers); Full sends the list.
- The toggle drives both the first-pass Analyze button and the Re-run Analysis
  button (label shows the active depth, e.g. "Analysis (full)").
- Note: `structure_msaf` is the heaviest analyzer — Full runs noticeably longer
  than Quick (inline under the 300s route cap).

## Follow-ups (out of scope now)

- Purge job for soft-archived (`is_current=false`) storage objects (storage grows otherwise).
- Library-wide backfill (queue + cron draining `runStoredJob`).
- Per-analyzer version compare for analysis (currently stage-level via `analysis_json` asset).
