# Execution Doc: Stem Separation Free Tier Guard

**Date**: 2026-06-06
**Status**: Completed
**Owner**: Codex

## Objective

Prevent predictable Supabase Free storage failures when Modal writes WAV stem
artifacts for longer tracks.

## Context

Supabase Free storage rejects uploads above the project global file-size limit,
even when a bucket row has a larger `file_size_limit`. A 315 second source M4A
can decode and separate into WAV stems of roughly 53 MB per stem, so the first
stem upload fails before WereCode can persist any stem assets.

## Changes

- Added a shared 4:30 WAV stem duration guard.
- Added server preflight handling for `/api/workflows/separate`.
- Added Studio UI warning text and disabled the stem extraction CTA for tracks
  that exceed the guard.
- Recorded estimated WAV stem bytes in the skipped job diagnostics.
- Changed the default requested stem artifact format to FLAC.
- Signed FLAC output paths and content types for separation artifacts.
- Added a Modal response guard that fails and cleans up if Modal returns an
  uploaded artifact in a format different from the requested format.

## Decisions Made

1. **Decision**: Guard by decoded duration, not uploaded source file size.
   - **Rationale**: Small M4A/AAC sources can expand into large WAV outputs.
   - **Alternatives Considered**: Input byte-size caps, chunking, and pre-model
     compression.

2. **Decision**: Skip Modal and mark the job failed when the guard triggers.
   - **Rationale**: Avoids spending compute on a job that will fail at storage
     upload and keeps diagnostics visible in job history.
   - **Alternatives Considered**: Throwing a route error before creating a job.

3. **Decision**: Make the 4:30 guard apply only to WAV outputs.
   - **Rationale**: FLAC output should reduce per-stem object size while staying
     lossless relative to the separated PCM stem.
   - **Alternatives Considered**: Keeping the guard even when FLAC is requested.

4. **Decision**: Validate Modal's returned artifact format before creating
   asset rows.
   - **Rationale**: The live Modal OpenAPI contract does not yet advertise an
     `output_format` field, so Next must not persist mislabeled artifacts if the
     current deployment ignores the FLAC request.
   - **Alternatives Considered**: Blindly trusting `.flac` signed upload paths.

## Testing

- `pnpm typecheck`
- `pnpm lint`

## Reconstruction — StudioClient UI wiring (2026-06-06)

The Studio guard UI portion of this work was missing from the working tree
(StudioClient.tsx matched HEAD; the stash held only backend files, so it was not
recoverable from git). The lib `src/lib/audio/stem-separation-limits.ts`
survived. Re-applied the StudioClient integration:

- Imported `DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT` alongside
  `getStemSeparationDurationLimitWarning`.
- Added the `stemSeparationWarning` `useMemo`, passing the default artifact
  format so the guard only fires for WAV (decision #3).
- Threaded `stemSeparationWarning` through `KaraokeProductView` into
  `StemsPanel`; renders a danger chip and disables the "Extract stems" CTA when
  set.
- Added `output_format: DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT` to the
  `/api/workflows/separate` payload (default stems now FLAC).

Because the default format is FLAC, the warning resolves to `null` and the UI
gating is dormant until a WAV request reintroduces it. `pnpm typecheck` and
`pnpm lint` pass (Node 22).

## Reconstruction — server (modal-workflows.ts, 2026-06-06)

The server half was also missing from the working tree (the existing
`modal-workflows.ts` diff was unrelated prettier reformatting; `output_format`
was silently stripped by zod and stem paths were hardcoded `.wav`). Re-applied
from the recovered diff, plus reconstructed the preflight block the diff assumed:

- Imported the format helpers/constants/type from `stem-separation-limits`.
- Added `expectedFormat?` to `OutputSpec`.
- Added `output_format: z.enum(['flac','wav']).default(FLAC)` to
  `separateWorkflowSchema` (was being dropped before).
- `runSeparateWorkflow`: fetch song (`requireOwnedSong`) + input-asset duration,
  compute `durationWarning` with `input.output_format`, and **preflight skip**
  (`skipSeparateForDurationGuard`) when the WAV guard trips — marks the job
  failed and records `estimateStereoWavBytes` (per-stem + total) in diagnostics,
  no Modal call (decision #2). Dormant under the FLAC default.
- Stem `outputSpecs` now use `${stem}.${output_format}`,
  `stemSeparationContentType(...)`, and `expectedFormat`.
- Modal payload includes `output_format`.
- `runJobWithModal`: `let modal`; after a ready/skipped response, run
  `validateModalArtifactFormats` and flip the response to `failed` + append a
  diagnostic on format mismatch (decision #4 — Modal contract doesn't yet
  advertise `output_format`, so never persist mislabeled artifacts).

`pnpm typecheck` and `pnpm lint` pass (Node 22).

## Follow-Ups

- Add browser-friendly compressed preview stems for playback.
- Revisit long-track chunking only after FLAC and preview artifacts are in place.
- Confirm or deploy Modal support for `/separate` request field
  `output_format: "flac"`.
