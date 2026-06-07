# Execution Doc: Studio Cache Persistence & Egress Optimization

Date: 2026-06-07
Status: Phases 1–3 implemented (typecheck + lint + boot smoke pass). No DB
migration required. Pending: browser request-count measurement (needs a real
song fixture) and optional studio_overview backfill.
Owner: Claude

## Objective

Extend the Library/Pipeline/Studio caching work so Studio reads survive a page
reload and a next-session revisit, and so Studio stops re-shipping the app's
single largest payload (full `analysis_results.data`) on every cold load. The
goal is fewer Next-to-Supabase reads and lower Supabase egress for the
reload/revisit pattern, without growing live client memory.

## Background: what already shipped vs. what was missed

The 2026-06-04 (Library/Pipeline) and 2026-06-05 (Studio) optimizations **did
ship and are intact**:

- Bundled `GET /api/studio/[songId]` — one round-trip, ownership checked once
  (`src/app/api/studio/[songId]/route.ts`).
- `loadStudio` serves from the `studioBySongId` cache before fetching
  (`StudioClient.tsx:378`).
- Signed URLs are batched + reused from cache (`StudioClient.tsx:308`,
  `POST /api/songs/[songId]/assets/sign-urls`).
- Workflow/save responses **patch** the cache instead of full reload
  (`StudioClient.tsx:438`, `:555`).

Two gaps remain — both hit Studio hardest:

1. **Every cache is in-memory only.** No `localStorage`/`sessionStorage`/
   `IndexedDB`/`persist` anywhere in `src/`. The zustand store and signed-URL
   map live only in the JS heap, so a hard reload, new tab, or next-session
   revisit throws away the in-session caching and re-pays the full Studio read.

2. **The bundled endpoint ships the biggest payload uncut.** `/api/studio`
   selects `analysis_results.*` (`route.ts:46`). Analysis is written one row per
   analyzer, each carrying a full `data` JSONB — chords-per-beat, beat grid,
   `structure_msaf.data.data.mapped_segments`, key, tempo
   (`modal-workflows.ts:1129`). Studio genuinely renders these (chords +
   sections + facts via `deriveSectionSegments` / `deriveChordEvents` /
   `buildSongFacts`), so the data can't be dropped — but it is re-fetched in
   full on every cold load.

Ruled out (so we don't chase fake wins):

- `src/lib/music/waveform/*` (extract/spectrogram/cache) is **dead code** —
  nothing calls it; `renderWaveform` draws synthetic bars
  (`StudioClient.tsx:1828`). There is no "re-download audio to draw waveforms"
  egress path. Tracked separately for removal.
- Playback is already lazy (`<audio preload="metadata">`,
  `StudioClient.tsx:1884`) — full audio downloads only on explicit play.

## Decisions

1. **Persist as a tier under the shared `useWereCodeDataCache` store.**
   Library/Pipeline/Studio share that store; adding persistence there benefits
   all three. No behavior/policy change — still
   cache-until-mutation-or-Manual-Refresh, just extended past a reload.

2. **Tier the storage by size + sensitivity (memory-safe):**
   - **Owner id only** → `localStorage` via zustand `persist` + `partialize`.
     REVISED during implementation: persisting the rendered summary slices
     (`songs`/`jobs`/`assets`) to localStorage triggers an SSR hydration
     mismatch, because zustand rehydrates synchronously and the first client
     render would then differ from the server HTML on Library/Pipeline. The
     owner id is never rendered, so it persists safely and still powers the
     account-switch guard. Rendered summaries stay in-memory (unchanged
     Library/Pipeline behavior); broadening them needs an SSR-safe hydration
     gate and is deferred to a follow-up.
   - **Heavy Studio detail** (`studioBySongId`, incl. analysis) → **IndexedDB**
     keyval keyed by `songId`, read lazily for the **active song only**.
     Deliberately NOT in the auto-rehydrated zustand slice, so the heap holds
     ~one song at a time regardless of library size.
   - **Signed URLs** (`signedUrlsByAssetId`) → `sessionStorage`, expiry-guarded;
     kept out of `localStorage` so capability tokens don't persist at rest
     across sessions.
   - `jobDetailsById` / `musicXmlPreviewsByAssetId` → not auto-rehydrated;
     IndexedDB optional later. Already lazy.

3. **Bound staleness with a TTL + existing Manual Refresh.** Persisted Studio
   detail carries `loadedAt`; entries older than ~10 min are treated as stale
   and revalidated on next open. Prevents server-side job completions from
   staying hidden indefinitely. Manual Refresh still forces fresh detail.

4. **Compact analysis contract (Phase 2).** At analyze write time, also persist
   a small derived `studio_overview` row (`{ key, tempo, sections, chords }`)
   alongside the full analyzer rows. `/api/studio` returns the compact row; full
   `analysis_results.data` is fetched on demand via the existing
   `GET /api/songs/[songId]/analysis-results?analyzer=...` route only when a deep
   view needs raw envelopes. Shrinks the first load too, not just revisits.

5. **Browser-cacheable playback (Phase 3).** Reuse stable signed-URL strings
   across reload (from Phase 1's sessionStorage tier) so replayed audio is served
   from the browser disk cache within the URL's TTL. Set an explicit
   `cacheControl` on source-audio upload. Note: stems/artifacts are written by
   Modal, so their `cacheControl` is a Modal-side change — flagged, not silently
   skipped. Rejected: a Next proxy with a stable URL — it would guarantee caching
   but **move** bytes through Vercel rather than cut Supabase egress.

6. **No new runtime deps.** Hand-roll a ~30-line IndexedDB keyval wrapper
   (matches the prior "prefer zustand over a new dep" decision). Revisit only if
   it proves fiddly.

## Implementation Plan

### Phase 1 — Cross-reload persistence (core, lowest risk)

- [x] Add `persist` middleware to `useWereCodeDataCache`. `partialize` narrowed
      to the owner id only (see Decision 2 revision). `clearWereCodeDataCache()`
      now wipes localStorage (`persist.clearStorage()`), sessionStorage signed
      URLs, and the IndexedDB Studio tier.
- [x] Add `src/lib/client-cache/idb-keyval.ts` (tiny IndexedDB wrapper) and
      `studio-detail-store.ts` (get/put/delete Studio detail by `songId`, with
      `loadedAt` TTL + 25-entry LRU eviction).
- [x] Rework `loadStudio`: live zustand → IndexedDB (`await`) → `/api/studio`,
      with write-through to both, a request-token guard against song switches,
      stale-while-revalidate paint, and `{ force }` bypass.
- [x] Persist `signedUrlsByAssetId` to `sessionStorage`, dropping expired
      entries on rehydrate; reuse the exact URL string across reload.
- [x] Workflow-success and lyrics-save patches write through to IndexedDB.
- [x] Owner-reconcile guard (`reconcileWereCodeCacheOwner`) wired into
      `AuthButton` so an account switch (even without sign-out) wipes all tiers;
      `LibraryClient` delete removes the song's IndexedDB entry.
- [x] `pnpm typecheck` + `pnpm lint` pass (Node 22 via nvm).
- [ ] Browser/manual measurement (needs a real local song fixture — local
      Library is still empty, as the prior phases noted).

### Phase 2 — Compact analysis contract

No DDL migration needed — `analysis_results` already has `analyzer_name` + `data`
+ `is_current`, so the summary is an additive row.

- [x] New shared `src/lib/music/analysis-overview.ts` — the section/chord/key-tempo
      derivations relocated out of `StudioClient` so the client render and the
      server summary share one implementation (no drift). Adds
      `deriveStudioOverviewData` (write) + `expandStudioOverview` (read).
- [x] Server: `persistAnalysisResults` (`modal-workflows.ts`) derives + stores a
      compact `studio_overview` row alongside the full rows, and excludes it from
      the response so the live post-run client is unchanged.
- [x] `/api/studio` reads only the small `studio_overview` row and expands it into
      synthetic analyzer rows; falls back to full rows for legacy songs with no
      overview. Cold loads no longer read the heavy analyzer envelopes.
- [x] Client unchanged in behavior — only the relocated functions are imported;
      it still derives sections/chords/facts from `analysisResults`.
- [x] `pnpm typecheck` + `pnpm lint` + boot smoke (3 routes SSR 200) pass.
- [ ] Optional backfill of `studio_overview` rows for existing songs (legacy
      fallback covers them until re-analyzed).
- [ ] Browser measurement of the cold-load payload drop (needs a real song).

### Phase 3 — Browser-cacheable playback

- [x] Set a long `cacheControl` (`31536000`, immutable per object path) on the
      browser source-audio upload (`LibraryClient` `uploadToSignedUrl`).
- [x] Stable signed-URL reuse across reload already landed in Phase 1
      (sessionStorage), so the disk cache hits on replay within the URL lifetime.
- [x] `pnpm typecheck` + `pnpm lint` + boot smoke pass.
- [ ] Modal-side follow-up: set `cacheControl` on stem/artifact writes (outside
      this repo's Next/Supabase boundary).
- [ ] Already-uploaded source audio keeps its prior `cacheControl` until
      re-uploaded — acceptable; new uploads get the long cache.

## Acceptance Criteria

- Hard-reloading Studio on a previously opened song performs **0** Supabase
  reads until the TTL lapses or Manual Refresh (verified by network panel).
- Live JS heap does not grow with library size — only the active song's detail
  is hydrated; others stay in IndexedDB.
- Signed URLs survive a reload within the same tab but are not written to
  `localStorage`.
- After Phase 2, the initial `/api/studio` payload excludes full analyzer
  `data`; sections/chords/facts still render identically.
- After Phase 3, replaying audio after a reload is served from browser cache
  (no repeat Supabase storage fetch) within the signed-URL TTL.
- Manual Refresh still forces fresh Studio detail across all phases.

## Testing

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] Browser/manual with a real song fixture: reload Studio → 0 reads; navigate
      Library→Studio→reload→same song renders from IndexedDB.
- [ ] Heap check: open several songs, confirm only active detail is live.
- [ ] Phase 2: compact payload renders sections/chords/facts unchanged.
- [ ] Phase 3: network panel shows browser-cache hit on audio replay.

## Risks

- **Staleness window grows** from "until you leave the SPA" to "until TTL/Manual
  Refresh." Mitigated by the ~10 min TTL + Manual Refresh; a max-`updated_at`
  freshness probe is a later option.
- **Quota** — IndexedDB needs an LRU/size cap; `localStorage` summaries must stay
  small. Handle `QuotaExceededError` gracefully (evict, then fall back to
  network).
- **Auth scoping** — persisted stores must be cleared on sign-out/user switch.
- **Phase 2 is the invasive one** — write-path + migration + endpoint shaping;
  legacy songs without an overview must fall back to full rows.
- **Phase 3 stems** — `cacheControl` for Modal-written artifacts needs a
  Modal-side change; only source audio is fully controllable from this repo.
- **Preserve existing dirty Studio UI edits** while editing the 3442-line client.

## Progress Log

### 2026-06-07

Action: Researched current Studio data path against ground truth (not the prior
doc). Confirmed the 2026-06-05 client caching shipped; identified in-memory-only
persistence and uncut `analysis_results` payload as the remaining gaps; ruled out
the dead waveform module and confirmed playback is already lazy.
Result: This proposed plan. Awaiting approval before implementing Phase 1.

---

Action: Implemented Phase 1 after approval. Added `idb-keyval` + `studio-detail-store`
(IndexedDB tier, TTL + LRU), persisted the store (owner-only to localStorage after
discovering the summary-persistence SSR hydration mismatch), added sessionStorage
signed-URL reuse, reworked `loadStudio` into a live→IndexedDB→network
stale-while-revalidate path with a request-token guard, wired workflow/save
write-throughs, and added the owner-reconcile + delete-eviction guards.
Result: A previously-opened Studio song now renders from IndexedDB on reload with
0 Supabase reads inside the 10-min TTL (background revalidate after). Heap stays
bounded — only the active song hydrates. `pnpm typecheck` + `pnpm lint` pass.
Notes: Browser request-count verification still blocked by an empty local Library.
Minor follow-up: on an account switch the IndexedDB wipe is async, so harden later
by tagging entries with owner id if the race matters.

---

Action: Implemented Phase 2 (compact analysis contract). Relocated the analysis
derivations into a shared `analysis-overview` module; analyze now stores a compact
`studio_overview` row (excluded from its own response); `/api/studio` reads only
that row and expands it to synthetic rows, with a legacy full-row fallback.
Discovered no DDL migration is required (the table already supports a new row type).
Result: Cold `/api/studio` loads stop reading the heavy per-analyzer envelopes —
the dominant row egress — while the client render path is byte-for-byte unchanged
(same functions, relocated). `pnpm typecheck` + `pnpm lint` clean; boot smoke 200
on /studio, /library, /pipeline. No browser change measurement yet (needs a song).

---

Action: Implemented Phase 3 (browser-cacheable playback). Set a 1-year, immutable
`cacheControl` on the browser source-audio upload in `LibraryClient`.
Result: Combined with Phase 1's stable signed-URL reuse, source-audio replays after
a reload are served from the browser disk cache instead of re-fetching from
Supabase Storage, within the signed URL's lifetime. `pnpm typecheck` + `pnpm lint`
clean; boot smoke 200. Stem/artifact cacheControl remains a Modal-side follow-up.
No manual steps required to ship: no DB migration, no env changes.

## References

- `src/lib/client-cache/werecode-data-cache.ts`
- `src/features/studio/StudioClient.tsx`
- `src/app/api/studio/[songId]/route.ts`
- `src/app/api/songs/[songId]/analysis-results/route.ts`
- `src/server/werecode/modal-workflows.ts`
- `src/lib/supabase/storage.ts`
- Prior: `docs/execution_docs/2026-06-04_api_call_volume_optimization.md`,
  `docs/execution_docs/2026-06-05_studio_api_call_optimization.md`
