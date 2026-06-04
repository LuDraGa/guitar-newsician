# Execution Doc: Studio API Call Optimization

Date: 2026-06-05
Status: Implemented
Owner: Codex

## Objective

Reduce Studio page browser requests, Next-to-Supabase reads, and oversized
payloads while preserving fast UI feedback. Studio should behave like the
Library/Pipeline cache work: cached data renders immediately on return
navigation, local workflow responses patch the cache, and Manual Refresh remains
the explicit freshness control.

## Context

Current Studio initial load fans out into:

- `GET /api/songs/[songId]`
- `GET /api/songs/[songId]/assets`
- `GET /api/songs/[songId]/analysis-results`
- `GET /api/songs/[songId]/lyrics`
- `GET /api/songs/[songId]/assets/[assetId]/signed-url` for playable audio
- `GET .../signed-url` once per stem asset
- MusicXML preview later signs and fetches MusicXML separately.

The Supabase read count is higher than the browser request count because child
routes use `requireOwnedSong()` before their own query. Signed URL routes also
select full asset rows even though signing only needs bucket/object path.

## Decisions Made

1. **Add a bundled Studio detail endpoint**
   - Rationale: One endpoint can verify song ownership once and fetch the
     Studio data in parallel.
   - Target: `GET /api/studio/[songId]`.

2. **Cache Studio detail by song ID**
   - Rationale: Returning to the same Studio song should render from cache
     without DB reads.
   - Policy: cache until local mutation/workflow patch or explicit Refresh.

3. **Batch and cache signed URLs**
   - Rationale: Per-asset signing multiplies browser requests and DB reads for
     playable audio, stems, and MusicXML previews.
   - Target: `POST /api/songs/[songId]/assets/sign-urls` with multiple asset IDs.

4. **Patch state from workflow responses**
   - Rationale: Current workflow success calls `loadStudio(song.id)`, which
     repeats all Studio reads after every action.
   - Target: merge returned song/assets/lyrics/analysis/job into local and
     shared cache; use forced reload only from explicit Refresh.

5. **Defer compact analysis/chord persistence**
   - Rationale: Full `analysis_results.data` can be large, but deriving and
     storing compact chord events is a broader data-contract change.

## Implementation Plan

- [x] Add Studio detail response types.
- [x] Extend shared client cache with `studioBySongId` and signed URL entries.
- [x] Add `GET /api/studio/[songId]`.
- [x] Add `POST /api/songs/[songId]/assets/sign-urls`.
- [x] Wire `StudioClient` to load from cache first and fetch only when empty or
      manually refreshed.
- [x] Replace per-stem signing with batch signing and signed URL cache reuse.
- [x] Remove post-workflow/post-save full reloads where response data is enough
      to patch state.
- [x] Cache MusicXML preview fetches by asset ID.
- [x] Run typecheck/lint and update this document.

## Acceptance Criteria

- Returning to the same Studio song uses cached detail data without a detail
  fetch.
- Initial Studio load uses one bundled detail endpoint instead of four separate
  metadata endpoints.
- Playable/stem signing uses one batch signing request for missing/expired URLs.
- Reopening MusicXML preview for the same asset reuses cached signed URL and
  parsed preview where possible.
- Workflow success no longer forces a full Studio reload when the response
  contains the changed data.
- Manual Refresh forces fresh Studio detail; signed URLs are reused until their
  expiry margin is reached because they do not represent product-state
  freshness.

## Testing

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] Browser/manual: Studio page renders without errors.
- [ ] Browser/manual: Studio page renders from bundled detail endpoint.
- [ ] Browser/manual: Library -> Studio -> Library -> same Studio renders from
      cached detail.
- [ ] Browser/manual: stem signing uses batch endpoint for missing URLs.
- [ ] Browser/manual: MusicXML preview reuses cached parsed preview.
- [ ] Browser/manual: run workflow/save lyrics patches Studio without full
      reload.

Testing note: the local Library currently has `0 SONGS`, so browser verification
could only cover `/studio` empty-state rendering. Real-song navigation and
request-count verification need at least one local song fixture.

## Risks

- Current Studio file already contains unrelated dirty UI changes; edits must
  preserve them.
- Signed URLs expire; cache entries need an expiry margin.
- Workflow responses may not include every changed derived row yet, so fallback
  forced refresh may still be needed for incomplete responses.
- Analysis JSON may remain large until the later compact chord-events contract.

## Progress Log

### 2026-06-05

Action: Mapped current Studio fetch/signing behavior.
Result: Identified four metadata calls, per-asset signing, post-workflow full
reloads, and full-row overfetching as primary targets.
Notes: The first implementation will optimize request shape and caching without
changing Modal compute contracts.

Action: Implemented Studio bundled endpoint, batch signing, Studio cache wiring,
MusicXML preview cache, and local mutation patching.
Result: Studio no longer fans out four metadata requests on cache misses, no
longer refetches detail on return navigation, and no longer reloads all Studio
data after save/workflow responses that return changed rows.
Notes: Added a Studio header Refresh button for forced detail freshness. Signed
URLs remain cached until expiry because refreshing them early does not improve
product-state freshness.

Action: Ran validation.
Result: `pnpm typecheck` and `pnpm lint` passed with the bundled Node runtime.
Browser smoke test loaded `/studio` and showed the no-song state successfully.
Notes: Browser verification of a real song was blocked by an empty local
Library.

## Results

Implemented. Remaining optimization opportunity: compacting
`analysis_results.data` into a smaller chord/timing summary contract.
