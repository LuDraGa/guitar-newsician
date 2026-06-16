# Execution Doc: Stem Label Metadata

**Date**: 2026-06-15
**Status**: Completed
**Owner**: Codex

## Objective

Make stems carry flexible identity, label, role, and tag metadata so the Studio can
show multiple same-role stems instead of collapsing everything into the default
vocals/guitar/bass/drums/piano/other lanes.

## Plan

- [x] Add a shared stem metadata helper for role inference, metadata creation,
      labels, tags, colors, and stable stem identity.
- [x] Include asset metadata in summary API responses and client cache
      normalization.
- [x] Persist the metadata contract for uploaded trusted stems and per-stem MIDI.
- [x] Persist the same contract for Modal separation output assets.
- [x] Update Studio stem filtering, dedupe, display, and vocal-stem detection to
      use metadata.

## Decisions Made

1. **Decision**: Store flexible stem labels/tags in `assets.metadata`, not a new
   table or widened kind enum.
   - **Rationale**: Existing asset kinds remain valid storage buckets for broad
     roles, while metadata carries precise instrument identity such as lead
     guitar, synth pad, or strings.

2. **Decision**: Dedupe Studio stems by metadata identity (`role:id`) with kind as
   a legacy fallback.
   - **Rationale**: Uploaded datasets can have several assets stored as
     `stem_guitar` or `stem_other`; those must remain separate if their stem IDs
     differ.

3. **Decision**: Keep Modal separation requests on the current default stem set,
   but write labels/tags for every Modal-created stem asset.
   - **Rationale**: This fixes the persistence/UI substrate first without
     changing the Modal contract.

## Testing

- [x] `PATH=/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin:$PATH pnpm typecheck`
- [x] `PATH=/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin:$PATH pnpm lint`

## Results

- Studio stem rows now display metadata labels and compact tags.
- Multiple uploaded stems with the same broad kind no longer collapse into one
  visible row.
- Uploaded stems and Modal-derived stems share the same metadata shape:
  `stem.id`, `stem.role`, `stem.label`, `stem.tags`, plus top-level compatibility
  fields (`stem_id`, `stem_role`, `stem_label`, `stem_tags`).

## References

- `src/lib/music/stem-metadata.ts`
- `src/features/library/LibraryClient.tsx`
- `src/server/werecode/modal-workflows.ts`
- `src/features/studio/StudioClient.tsx`
- `src/types/werecode-client.ts`
- `src/server/werecode/selects.ts`
