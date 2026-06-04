# Execution Doc: API Call Volume Optimization

Date: 2026-06-04
Status: Implemented locally
Owner: Codex

## Objective

Reduce authenticated data-fetch cost and improve perceived UI speed by avoiding
unnecessary repeat Next-to-Supabase reads and reducing oversized API payloads.
Phase one is scoped to Library and Pipeline. Studio has the same class of
problem, but it will be handled after the first two surfaces are stable.

## Context

- Library currently fetches `/api/songs?limit=100` on mount.
- Pipeline currently fetches `/api/jobs?limit=100` and `/api/songs?limit=100`
  on mount, then fetches `/api/songs/[songId]/assets` when the selected asset
  song changes.
- The shared client fetch helpers force `cache: 'no-store'`, so page remounts
  always issue new browser-to-Next requests.
- API routes commonly use `.select('*')`, which sends large fields such as
  `metadata`, job payloads, diagnostics, and analysis data even when list UIs
  only need summary fields.
- Song readiness flags are maintained by app/workflow code, not database
  triggers. Cache correctness therefore depends on write/workflow responses
  patching client state.

Primary goal order:

1. Fewer Next-to-Supabase DB reads.
2. Faster perceived UI by rendering cached data immediately.
3. Fewer browser-to-Next API calls.
4. Smaller JSON responses where calls remain necessary.

## Current API Call Inventory

### Library

- Mount: `GET /api/songs?limit=100`
- Upload flow:
  - `POST /api/songs`
  - `POST /api/storage/sign-upload`
  - Supabase storage signed upload
  - `POST /api/songs/[songId]/assets`
  - `PATCH /api/songs/[songId]`
  - Current full reload: `GET /api/songs?limit=100`
- Delete flow:
  - `DELETE /api/songs/[songId]`
  - Local state already removes the song without full reload.

### Pipeline

- Mount:
  - `GET /api/jobs?limit=100`
  - `GET /api/songs?limit=100`
- Asset song change:
  - `GET /api/songs/[songId]/assets`
- Job detail:
  - No separate detail call today; full job payloads are loaded in the list
    response.

### Deferred: Studio

- Mount:
  - `GET /api/songs/[songId]`
  - `GET /api/songs/[songId]/assets`
  - `GET /api/songs/[songId]/analysis-results`
  - `GET /api/songs/[songId]/lyrics`
  - signed URL calls for playable audio and stems.

## Decisions Made

1. **Use client app cache for authenticated lists**
   - Rationale: Browser/Next HTTP caching is awkward for authenticated user data
     and local mutation semantics. The app already depends on `zustand`, so a
     small cache store avoids a new dependency.
   - Alternative considered: Add SWR or TanStack Query. Good long-term options,
     but unnecessary for phase one.

2. **Use cache-until-local-mutation-or-manual-refresh**
   - Rationale: The main pain is cost from repeated reads while navigating.
     Automatic revalidate-on-focus or route-remount refetch would preserve the
     current cost problem.
   - Alternative considered: Background stale-while-revalidate on every mount.
     Better freshness, but still causes DB reads when the user navigates.

3. **Patch cache from write/workflow responses**
   - Rationale: New songs, deleted songs, and readiness pill changes happen from
     known local actions. Those actions can update cached song/job/asset
     summaries without reloading the whole list.
   - Alternative considered: Refetch full lists after every mutation. Simpler,
     but it is the behavior being optimized away.

4. **Split Pipeline job summary from job detail**
   - Rationale: Job list does not need `request_payload`, `response_payload`, or
     `diagnostics`. Fetch those only when a user opens a specific job detail.
   - Alternative considered: Keep full jobs cached. This reduces remount reads
     but does not reduce initial payload volume.

5. **Keep Manual Refresh as the explicit freshness escape hatch**
   - Rationale: External changes from another browser tab/device are possible,
     but avoiding surprise DB reads is currently more important.
   - Future option: Add tiny freshness probes using max `updated_at` and counts.

## Implementation Plan

- [x] Add a shared client data cache store under `src/features/shared` or
      `src/lib/client-cache`.
- [x] Add typed summary shapes for Library songs, Pipeline jobs, and Pipeline
      assets.
- [x] Convert Library loading to:
      - render cached songs immediately when available;
      - fetch only on first empty cache or explicit refresh;
      - patch song cache after upload/create/update/delete;
      - remove the post-upload full library reload.
- [x] Change Library list API reads to explicit song summary columns.
- [x] Convert Pipeline loading to:
      - render cached job/song summaries immediately when available;
      - fetch only on first empty cache or explicit refresh;
      - cache assets by `songId`;
      - avoid asset refetch when switching back to an already loaded song.
- [x] Add Pipeline job summary/detail split:
      - summary endpoint excludes heavy payload fields;
      - existing job detail route remains the source for full payloads;
      - selected job detail is fetched lazily and cached by `jobId`.
- [x] Patch job caches from workflow responses where current flows create or run
      jobs.
- [x] Consider auth session caching after Library/Pipeline are stable.
- [x] Defer Studio bundle/signed URL caching to a later execution doc or phase.

## Commit Boundaries

1. **Execution doc**
   - Add this tracking document only.

2. **Shared cache primitives**
   - Add the cache store and typed cache helpers.
   - No behavior changes beyond infrastructure.

3. **Library cache and slim payload**
   - Move Library to cached song summaries.
   - Remove post-upload full list refetch.
   - Use explicit Supabase columns for list reads.

4. **Pipeline summary cache**
   - Cache Pipeline jobs/songs/assets.
   - Avoid remount and selected-song asset refetches.

5. **Pipeline job detail split**
   - Exclude heavy payloads from job list.
   - Fetch and cache full job payload only when needed.

6. **Verification and polish**
   - Typecheck/lint.
   - Update this doc with observed request-count changes and any tradeoffs.

## Acceptance Criteria

- Navigating away from Library and back does not call `/api/songs` when the
  song cache is already populated.
- Uploading a song updates the Library cache without a full `/api/songs` reload.
- Deleting a song updates the Library cache without a full `/api/songs` reload.
- Pipeline remount does not call `/api/jobs` or `/api/songs` when cache is
  already populated.
- Pipeline asset lists are cached per selected `songId`.
- Pipeline job list response excludes `request_payload`, `response_payload`, and
  `diagnostics`.
- Opening a Pipeline job detail loads full payload only for that selected job
  and reuses cached detail on repeat selection.
- Manual Refresh still forces a fresh load for the relevant surface.

## Testing

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] Browser/manual: Library and Pipeline render and navigate without visible
      runtime failure.
- [ ] Browser/manual: initial Library load performs one song list request.
- [ ] Browser/manual: Library -> Pipeline -> Library does not repeat the song
      list request.
- [ ] Browser/manual: upload audio updates the Library item without a full list
      request after the final patch.
- [ ] Browser/manual: initial Pipeline load performs summary requests only.
- [ ] Browser/manual: Pipeline -> Library -> Pipeline does not repeat jobs/songs
      summary requests.
- [ ] Browser/manual: selecting the same asset song twice does not repeat asset
      list requests.
- [ ] Browser/manual: selecting a job loads heavy payload once, then reuses
      cached detail on repeat selection.

## Risks

- External changes from another tab/device will not appear until Manual Refresh
  or a later freshness-probe phase.
- Caches must be scoped to the signed-in user. Auth changes should clear cached
  data.
- Existing user edits in UI files must be preserved while applying changes.
- Workflow endpoints may need small response-shape additions so the client can
  patch song/job caches without refetching.

## Progress Log

### 2026-06-04

Action: Investigated Library and Pipeline fetch behavior.
Result: Identified repeat mount fetches, full-row list payloads, and Pipeline
job payload overfetching as phase-one targets.
Notes: Studio has similar issues but is intentionally deferred.

---

Action: Captured phase-one decisions and implementation boundaries.
Result: Created this execution document before implementation.
Notes: The recommended cache policy is cache-until-local-mutation-or-manual-
refresh.

---

Action: Implemented Library and Pipeline phase-one cache changes.
Result: Added shared Zustand cache, song/job/asset summary types, slim list
selects, Library cache-backed loading, Pipeline summary/detail split, asset
cache by song, explicit Refresh controls, and cache patches from workflow
responses.
Notes: Studio fetch strategy remains deferred; Studio only patches shared
caches after workflow/save responses so Library/Pipeline summaries stay
consistent.

---

Action: Verified locally.
Result: `pnpm typecheck` and `pnpm lint` passed. Browser opened
`http://localhost:3000/library`, navigated to Pipeline, and returned to Library
successfully.
Notes: The available bundled Node runtime reported v24.14.0 while the repo
requires Node 22.x, so checks were run with `pnpm --config.engine-strict=false`.
The in-app browser wrapper did not expose fetch/performance request events, so
request-count checks remain code-path verified rather than browser-measured.

## Results

Implemented locally. Remaining follow-up manual checks need real song/job/asset
data: upload flow request count and repeated asset-song selection request count.

## References

- `src/features/library/LibraryClient.tsx`
- `src/features/library/library-utils.ts`
- `src/features/pipeline/PipelineClient.tsx`
- `src/features/studio/studio-utils.ts`
- `src/app/api/songs/route.ts`
- `src/app/api/jobs/route.ts`
- `src/app/api/jobs/[jobId]/route.ts`
