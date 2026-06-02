# Next/Pnpm Root Migration

**Date:** 2026-05-25
**Status:** In progress; Vercel root app and production Google auth smoke are wired

## Living plan status

This document is the working tracker for the Next/Vercel migration. Update it whenever a phase changes, scope is adjusted, or we learn a new implementation constraint.

- Phase 1: root Next.js + pnpm scaffold is complete.
- Phase 2: Supabase foundation is complete; SQL and schema exposure have been run manually.
- Phase 3: shared frontend types/utilities port is complete.
- Phase 4: route-level job/asset persistence and workflow orchestration routes are complete for the current Modal contract.
- Phase 5: library UI is ported to Next/Supabase, including upload, local-only YouTube download, archive, recent jobs, and workflow controls.
- Phase 6: studio route and core panels are ported, but UX/UI completion is still pending.
- Phase 7: Vercel deployment wiring and production Google auth smoke are complete; RLS/storage hardening still needs a two-user pass.

## Objective

Move WereCode to a single Vercel-deployable Next.js application at the repository root. The app owns UI, auth, Supabase data, Supabase Storage signed URLs, and job orchestration. Modal remains the only backend for heavy media/model compute.

## Package/runtime decisions

- Package manager: `pnpm`
- Root Node pin: `.nvmrc` -> `v20.20.0`
- Root app scripts:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm start`
  - `pnpm typecheck`
- Vercel root: repository root
- Modal gateway: `https://abhirooprasad--werecode-modal-apis-fastapi-app.modal.run`

## Current source paths to preserve

These directories remain significant migration inputs and should not be deleted until their behavior has been ported and verified.

| Current path                                 | Role                                     | Target path                                                                      |
| -------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| `frontend/src/views/library/LibraryPage.tsx` | Current library screen                   | `src/app/(app)/library/page.tsx` plus `src/features/library/*`                   |
| `frontend/src/components/library/*`          | Current library UI components            | `src/features/library/components/*`                                              |
| `frontend/src/components/panels/*`           | Current studio/transcription/MIDI panels | `src/features/studio/components/*` and `src/features/transcription/components/*` |
| `frontend/src/components/studio/*`           | Stem mixer, lyrics, playback controls    | `src/features/studio/components/*`                                               |
| `frontend/src/services/api.ts`               | Old FastAPI client                       | Replace with `src/lib/modal/*`, `src/lib/supabase/*`, and Next route handlers    |
| `frontend/src/services/midiEditorService.ts` | Old MIDI editor client                   | `src/features/midi/api/*` and Next route handlers                                |
| `frontend/src/store/appStore.ts`             | Current Zustand app state                | Split into feature-local stores under `src/features/*/store.ts`                  |
| `frontend/src/utils/*`                       | Music parsing/render helpers             | `src/lib/music/*` or feature-local utilities                                     |
| `frontend/src/types/*`                       | UI/domain types                          | `src/types/*`                                                                    |
| `backend/app/api/routes/*`                   | Legacy FastAPI behavior                  | `src/app/api/*/route.ts` and server actions                                      |
| `backend/app/api/services/*`                 | Legacy orchestration behavior            | `src/server/jobs/*` and `src/lib/modal/*`                                        |
| `backend/app/analyzers/*`                    | Analysis shape reference                 | Modal `/analyze/music` plus `src/types/analysis.ts`                              |
| `backend/app/stem_separators/*`              | Stem model behavior reference            | Modal `/separate`                                                                |
| `backend/app/converters/wav2midi/*`          | Basic Pitch behavior reference           | Modal `/midi/transcribe` and `/transcribe/instrument`                            |

## Target structure

```text
WereCode/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── library/
│   │   │   └── studio/
│   │   └── api/
│   │       ├── auth/callback/
│   │       ├── health/
│   │       └── modal/[...segments]/
│   ├── components/
│   │   └── shell/
│   ├── features/
│   │   ├── library/
│   │   ├── studio/
│   │   ├── jobs/
│   │   ├── lyrics/
│   │   ├── midi/
│   │   └── transcription/
│   ├── lib/
│   │   ├── modal/
│   │   └── supabase/
│   └── types/
├── frontend/        # Legacy Vite source reference during migration
├── backend/         # Legacy/local backend and model behavior reference
└── supabase/sql/    # Schema migrations to run manually in Supabase
```

## Modularity rules for the UI port

- Keep route files thin. `src/app/**/page.tsx` should compose feature components and load initial data, not own complex state machines.
- Put reusable app chrome and primitives in `src/components/*`.
- Put domain-specific UI in `src/features/<domain>/components/*`.
- Put feature effects and subscriptions in feature hooks such as `src/features/studio/hooks/*`; each effect needs explicit cleanup.
- Put feature API calls in `src/features/<domain>/api/*`, backed by shared clients in `src/lib/*`.
- Put shared music parsing and transform utilities in `src/lib/music/*`.
- Split files once they start mixing unrelated concerns or grow beyond roughly 300 lines.
- Preserve current visual/effect behavior during the port first, then improve UX in a later pass.

## First implementation slice

- Added root `.nvmrc`.
- Added root `package.json` with pnpm and Next.js scripts.
- Added initial App Router shell.
- Added `/api/health` route that checks the Modal gateway.
- Added generic `/api/modal/[...segments]` proxy for contract-level Modal calls.
- Added Supabase server/client helper foundation with lazy runtime env access.

## Supabase foundation slice

- SQL migration exists at `supabase/sql/2026-05-25_werecode_schema.sql` and is intended to be run manually in the Supabase console.
- Supabase project URL: `https://olquywzupxszttgiptco.supabase.co`.
- Auth model: Google social auth in production, Supabase session cookies through Next route handlers and middleware.
- Storage model: private buckets with object paths rooted at `auth.uid()`:
  - `werecode-sources`
  - `werecode-artifacts`
  - `werecode-previews`
- Backend code must use lazy Supabase initialization so `next build` stays safe without runtime secrets.
- Supabase schema name is fixed as `werecode` in SQL and app constants, not runtime env.
- Supabase keys use current project API key names: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not legacy `anon` or `service_role`.
- Added `src/proxy.ts` for Next 16 Supabase session refresh.
- Added `src/app/api/auth/session/route.ts` for current user/session state.
- Added `src/app/api/supabase/health/route.ts` for env readiness checks.
- Added `src/app/api/storage/sign-upload/route.ts` and `src/app/api/storage/sign-download/route.ts` for authenticated signed URL creation.
- Added shared helpers in `src/lib/supabase/*` and schema/domain types in `src/types/werecode.ts`.

## Shared frontend types/utilities slice

- Ported legacy library song/download types into `src/types/library.ts`.
- Ported notation types into `src/types/music-notation.ts`.
- Added `src/types/lyrics.ts` for reusable lyric-line data.
- Ported LRC parsing and time formatting into `src/lib/music/lrc.ts`.
- Ported MIDI parsing helpers into `src/lib/music/midi.ts` without Vite `import.meta.env` coupling.
- Split waveform extraction into small modules under `src/lib/music/waveform/*`:
  - `types.ts`
  - `audio-context.ts`
  - `extract.ts`
  - `spectrogram.ts`
  - `cache.ts`
- Added `src/lib/music/index.ts` and `src/lib/utils/*` barrel exports for later UI ports.

## Authenticated app route slice

- Added request context helper at `src/server/werecode/context.ts`.
- Added shared Zod schemas at `src/server/werecode/schemas.ts`.
- Added `GET`/`POST /api/songs`.
- Added `GET`/`PATCH`/`DELETE /api/songs/[songId]`; delete archives instead of hard-deleting.
- Added `GET`/`POST /api/songs/[songId]/assets`, with storage bucket validation and user-scoped object path checks.
- Added `GET`/`POST /api/jobs`.
- Added `GET`/`PATCH /api/jobs/[jobId]`.
- These routes rely on Supabase Auth session cookies and RLS. They do not use a Supabase secret key.

## Required Supabase environment

These are required once the Supabase project is wired into local/prod environments:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_AUTH_ENABLED=false` locally, `true` in production.
- `MODAL_GATEWAY_URL`

After the URL and publishable key are added, `/api/supabase/health` should move from `supabase_env_missing` to `configured`. SQL readiness is validated through authenticated app routes because the app is not keeping a Supabase secret key.

`SUPABASE_SERVICE_ROLE_KEY`, `WERECODE_ENABLE_DEV_IDENTITY`, and
`WERECODE_DEV_USER_ID` are local development escape hatches only. They must not
be set on Vercel.

`NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD` and `LOCAL_WERECODE_API_URL` are also
local-only and keep yt-dlp out of production.

## Verification log

- `pnpm lint` passes under Node `v22.20.0`.
- `pnpm typecheck` passes under Node `v22.20.0`.
- `pnpm build` is the Vercel build command; earlier local build checks were constrained by local disk/sandbox conditions.
- Production Google login has been smoke-tested successfully on the Vercel deployment.
- Local dev route checks:
  - `GET /api/auth/session` returns `{ authEnabled: false, configured: false, user: null }` before local Supabase env is added.
  - `GET /api/supabase/health` returns `supabase_env_missing` before local Supabase URL/publishable key is added.
  - `POST /api/storage/sign-upload` returns `auth_required` before Supabase auth is configured.
  - `GET /api/songs` and `GET /api/jobs` return `auth_required` before Supabase auth is configured.

## Next implementation slices

1. Complete the repo/Vercel shape cleanup so the root Next app is the only production deployment target.
2. Run a two-user production RLS/storage smoke test: user A must not read, sign, mutate, or archive user B rows or objects.
3. Finish the studio UX/UI pass for playback, waveform, lyrics, stems, MIDI, and transcription panels.
4. Decide artifact cleanup behavior for failed or abandoned workflow jobs.
5. Remove or further quarantine legacy Vite/FastAPI references once their remaining reference value is exhausted.
