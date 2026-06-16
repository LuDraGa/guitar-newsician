# Execution Doc: Trusted Dataset Upload UI

**Date**: 2026-06-15
**Status**: Completed
**Owner**: Codex

## Objective

Add a library intake path for trusted multi-asset song datasets: mix audio, full MIDI, per-stem audio, per-stem MIDI, and optional BabySlakh-style `metadata.yaml`.

## Context

- Maestro needs accurate per-(song, stem) substrate before deeper agent work.
- The existing UI only uploaded one `source_audio` file.
- `scripts/seed-maestro-babyslakh.mjs` was explicitly a stand-in for this missing UI.
- The Supabase schema already supports source audio/MIDI, per-stem audio, and the June 14 migration adds per-stem MIDI and per-stem analysis asset kinds.

## Plan

- [x] Align TypeScript/Zod asset kind definitions with the June 14 SQL migration.
- [x] Add a trusted dataset upload mode in the library UI.
- [x] Parse optional BabySlakh stem metadata for role and stem identity.
- [x] Upload files via existing signed storage upload and owned asset routes.
- [x] Patch song readiness flags after all selected assets are saved.
- [x] Run independent file uploads concurrently and show per-file status.

## Progress Log

### 2026-06-15 20:19 IST

**Action**: Added multi-asset upload support in `LibraryClient`.
**Result**: Users can upload mix audio, full MIDI, stem audio files, stem MIDI files, and optional YAML metadata.
**Notes**: Stem MIDI assets link to matching stem audio assets through `source_asset_id` when both files share the same stem id.

---

### 2026-06-15 20:19 IST

**Action**: Updated app asset kind definitions.
**Result**: `stem_midi_vocals/drums/bass/other/guitar/piano` and `stem_analysis_json` now pass app validation.
**Notes**: This mirrors `supabase/sql/2026-06-14_werecode_maestro_per_stem_kinds.sql`.

---

### 2026-06-15 20:32 IST

**Action**: Refactored trusted dataset upload execution.
**Result**: Independent files now upload concurrently with `Promise.allSettled`; each stem lane only serializes its own audio before its own MIDI so `source_asset_id` stays correct.
**Notes**: The upload progress card now lists every selected file with queued/signing/hashing/uploading/saving/done/failed state.

---

## Blockers

- [x] Node engine mismatch in default shell: resolved by running checks with `/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin` first on `PATH`.

## Decisions Made

1. **Decision**: Keep the upload workflow in the Next app using existing signed-upload and asset routes.
   - **Rationale**: Production product state belongs in Next and Supabase; the Python backend stays local-only.
   - **Alternatives Considered**: Adding Python backend ingestion was rejected by the repository boundary.

2. **Decision**: Store trusted stems and MIDI in `werecode-sources`.
   - **Rationale**: These are user-supplied source assets, not Modal-derived artifacts.
   - **Alternatives Considered**: Storing them in artifacts would blur provenance and make Maestro substrate less explicit.

3. **Decision**: Use BabySlakh `metadata.yaml` when present, with filename fallback.
   - **Rationale**: BabySlakh stem IDs and roles are reliable in metadata; non-BabySlakh uploads should still work with role inference.
   - **Alternatives Considered**: Requiring manual per-stem role entry was deferred to keep this intake path small.

4. **Decision**: Upload independent assets concurrently while keeping per-stem MIDI dependent on matching stem audio.
   - **Rationale**: Mix, full MIDI, metadata, and different stem lanes do not depend on each other; only `source_asset_id` linking requires local ordering inside one stem lane.
   - **Alternatives Considered**: Fully serial upload was slower; fully parallel stem MIDI would lose deterministic audio-asset linkage.

## Testing

- [x] `PATH=/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin:$PATH pnpm typecheck`
- [x] `PATH=/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin:$PATH pnpm lint`

## Results

- The library now has a second intake action: `Upload stems/MIDI`.
- Uploaded dataset assets carry provenance metadata and browser-computed SHA-256 checksums when Web Crypto is available.
- Song readiness is updated for audio, stems, and MIDI after the upload completes.
- The uploader shows per-file progress and failures while the aggregate upload continues to settle all active promises.

## References

- `src/features/library/LibraryClient.tsx`
- `src/server/werecode/schemas.ts`
- `src/types/werecode.ts`
- `scripts/seed-maestro-babyslakh.mjs`
- `supabase/sql/2026-06-14_werecode_maestro_per_stem_kinds.sql`
