# Execution Doc: Studio Stem Analysis Controls

**Date**: 2026-06-15
**Status**: Completed
**Owner**: Codex

## Objective

Keep the Studio's main Analyze action scoped to the full track while adding
per-stem analysis controls and making long stem lists scroll inside the Stems
panel.

## Plan

- [x] Make the main Studio analysis labels explicitly say track analysis.
- [x] Add per-stem analyze actions from each stem row.
- [x] Persist per-stem analysis as `stem_analysis_json` assets linked to the
      stem audio via `source_asset_id`.
- [x] Make analysis freshness/supersede target-specific so full-track and
      per-stem analyses coexist.
- [x] Show per-stem analysis status in the Stems panel.
- [x] Make the populated Stems panel top-aligned and internally scrollable.

## Decisions Made

1. **Decision**: Reuse `/api/workflows/analyze` for stem analysis with
   `is_stem=true`.
   - **Rationale**: The Modal endpoint already accepts `is_stem`; only the
     WereCode persistence target needed to differ.

2. **Decision**: Keep the Modal upload key as `analysis` for both full-track and
   stem analysis.
   - **Rationale**: The storage artifact kind changes inside WereCode, but the
     Modal analyze endpoint still receives the same output key contract.

3. **Decision**: Preserve the existing one-analyze-job-per-song dedupe behavior.
   - **Rationale**: The database unique index currently dedupes active jobs by
     `(song_id, job_type)`. The UI disables other stem analysis buttons while
     one analysis job is active.

## Testing

- [x] `PATH=/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin:$PATH pnpm typecheck`
- [x] `PATH=/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin:$PATH pnpm lint`

## References

- `src/server/werecode/modal-workflows.ts`
- `src/features/studio/StudioClient.tsx`
- `src/types/werecode-client.ts`
- `src/server/werecode/selects.ts`
