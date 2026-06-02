# Supabase And Next/Vercel Transition

Date: 2026-05-25
Status: In progress; production auth and root Vercel deployment are wired

## Goal

Move WereCode from a Vite frontend plus separate FastAPI backend into a Vercel-deployable Next.js app. The Next app should own UI, auth, durable app state, job orchestration, and signed storage URLs. Modal should own heavy media/model work.

Supabase project:

- API URL: `https://olquywzupxszttgiptco.supabase.co`
- Auth users: Google login users already exist in `auth.users`

## Supabase SQL

Run this file in the Supabase SQL editor:

`supabase/sql/2026-05-25_werecode_schema.sql`

Then run:

`supabase/sql/2026-05-25_werecode_schema_verify.sql`

It creates:

- isolated `werecode` schema
- `profiles` mirrored from `auth.users`
- `songs`, `song_versions`, `assets`, `jobs`
- `analysis_results`, `lyrics`, `midi_edit_sessions`
- private storage buckets:
  - `werecode-sources`
  - `werecode-artifacts`
  - `werecode-previews`
- owner-scoped RLS policies for authenticated users
- storage policies where object paths begin with the user's auth id

Expected storage path convention:

```text
<owner_id>/<song_id>/sources/audio.m4a
<owner_id>/<song_id>/artifacts/audio.wav
<owner_id>/<song_id>/artifacts/stems/vocals.wav
<owner_id>/<song_id>/artifacts/analysis.json
<owner_id>/<song_id>/artifacts/audio.mid
```

If the app queries Supabase directly from the browser using the anon key, add `werecode` to exposed schemas in Supabase API settings. If all database writes happen through Next route handlers using the service role key, keep direct client access minimal and route reads/writes through Next.

The current Next implementation uses Supabase server/browser clients with `db.schema = "werecode"`, so add `werecode` to Supabase Dashboard -> Project Settings -> API -> Exposed schemas.

For Google auth redirects, add these under Authentication -> URL Configuration:

```text
http://localhost:3000/api/auth/callback
https://<your-vercel-domain>/api/auth/callback
```

## Manual Vercel Deployment Checklist

Do this from the Vercel and Supabase dashboards. No Vercel CLI flow is required.

### 1. Push Source Branch

The current migration branch is:

```text
formalizeUI
```

It has been pushed to GitHub:

```text
https://github.com/LuDraGa/guitar-newsician
```

Use this branch when creating the first Vercel preview project/deployment.

### 2. Create Or Connect Vercel Project

In Vercel:

1. Import the GitHub repo `LuDraGa/guitar-newsician`.
2. Select the `formalizeUI` branch for the initial preview deployment.
3. Framework preset: `Next.js`.
4. Root directory: repository root.
5. Install command: `pnpm install --frozen-lockfile`.
6. Build command: `pnpm build`.
7. Output directory: leave default.

The repo already contains:

```text
vercel.json
package.json
pnpm-lock.yaml
next.config.mjs
```

### 3. Set Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables.

Production and Preview:

```env
NEXT_PUBLIC_SUPABASE_URL=https://olquywzupxszttgiptco.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
NEXT_PUBLIC_AUTH_ENABLED=true
MODAL_GATEWAY_URL=https://abhirooprasad--werecode-modal-apis-fastapi-app.modal.run
MODAL_GATEWAY_TOKEN=<only-if-modal-gateway-auth-is-enabled>
```

Production only after the production domain is known:

```env
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
```

Do not set these on Vercel:

```env
WERECODE_ENABLE_DEV_IDENTITY
WERECODE_DEV_USER_ID
NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD
LOCAL_WERECODE_API_URL
LOCAL_YOUTUBE_DOWNLOAD_TIMEOUT_MS
LOCAL_YOUTUBE_DOWNLOAD_POLL_MS
YTDLP_NODE_PATH
YTDLP_COOKIEFILE
YTDLP_COOKIES_BROWSER
```

`SUPABASE_SERVICE_ROLE_KEY` should not be required in production. Production
routes use Supabase Auth cookies and owner-scoped RLS. Keep the service role key
for local dev identity only unless a future server-only admin workflow explicitly
needs it.

### 4. Configure Supabase Auth URLs

In Supabase Dashboard -> Authentication -> URL Configuration:

1. Set Site URL to the final Vercel production URL.
2. Add redirect URL:

```text
https://<your-vercel-domain>/api/auth/callback
```

3. Keep local callback for dev:

```text
http://localhost:3000/api/auth/callback
```

In Supabase Dashboard -> Authentication -> Providers -> Google, confirm Google
is enabled. In the Google Cloud OAuth client backing that provider, the
authorized redirect URI must be the Supabase callback, not the Vercel callback:

```text
https://olquywzupxszttgiptco.supabase.co/auth/v1/callback
```

The app's Google sign-in sends an exact Vercel callback URL with no query string:

```text
https://<your-vercel-domain>/api/auth/callback
```

For preview deployments, Google OAuth will not work until the exact preview
callback URL is added. Keep auth testing focused on production unless you want to
maintain preview redirect URLs.

### 5. Confirm Supabase API Settings

In Supabase Dashboard -> Project Settings -> API:

1. Ensure `werecode` is in exposed schemas.
2. Confirm the client uses the publishable key, not service role.
3. Confirm storage buckets exist:

```text
werecode-sources
werecode-artifacts
werecode-previews
```

### 6. Deploy And Smoke Test

After the Vercel build completes:

1. Open `/api/health`.
2. Open `/api/supabase/health`.
3. Sign in with Google.
4. Open `/library`.
5. Upload or create a song row.
6. Confirm rows appear under the signed-in user only.
7. Run one lightweight workflow first, then Modal-backed workflows:
   - source audio upload
   - analysis
   - stems
   - lyrics alignment
   - MIDI transcription

### 7. Known Remaining Hardening

Before calling this production-complete:

- Verify RLS with two real Google users.
- Confirm storage object access is user-scoped for both upload and download.
- Decide whether Preview deployments should allow Google auth.
- Add cleanup policy for abandoned failed job artifacts.
- Finish UI/UX completion after deployment plumbing is stable.

## Local Dev Identity Mode

Google OAuth is not required for the local migration loop. While:

```env
NEXT_PUBLIC_AUTH_ENABLED=false
SUPABASE_SERVICE_ROLE_KEY=...
WERECODE_ENABLE_DEV_IDENTITY=true
WERECODE_DEV_USER_ID=<auth.users.id>
```

Next API routes use a server-only service-role Supabase client and write rows as
`WERECODE_DEV_USER_ID`. This keeps local development unblocked before Vercel
callback URLs and production Google auth are finalized.

Use one of the IDs from the profile backfill, for example:

```env
WERECODE_DEV_USER_ID=4cad0b5d-2bdf-43c9-860c-d729b81aa9bf
```

Do not enable this mode in production or Vercel previews. The implementation now
requires `WERECODE_ENABLE_DEV_IDENTITY=true`, `NODE_ENV=development`, and no
`VERCEL_ENV` before service-role dev identity is used.

## Local YouTube Download Mode

YouTube/yt-dlp is not part of the production Next or Modal path. Production UI is
upload-first.

For local development only, the Library page can show a YouTube download control
that calls the legacy FastAPI backend running on the same machine:

```env
NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true
LOCAL_WERECODE_API_URL=http://localhost:8001
```

Run the backend separately:

```bash
cd /Users/abhiroopprasad/code/side-projects/WereCode/backend
uv run python run_api.py
```

The local backend now uses `yt-dlp[default]` plus the external JS challenge
solver path for YouTube's newer extraction challenges. Prefer Node 22+ for this:

```env
YTDLP_NODE_PATH=/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin/node
```

If `YTDLP_NODE_PATH` is unset or points to older Node, the backend scans PATH and
local nvm installs and prefers the newest Node 22+ runtime. Check the active
runtime with:

```bash
curl http://localhost:8001/api/v1/download/diagnostics
```

Browser cookies are only a fallback for cases where YouTube explicitly returns
the sign-in/bot-check block for the current video or network.

The Next route `POST /api/local/youtube-download` starts
`POST /api/v1/download`, polls `GET /api/v1/jobs/:id`, reads the resulting local
audio file, uploads it to Supabase Storage, creates a source asset row, and
persists downloaded lyrics if the backend created `lyrics.txt` or `lyrics.lrc`.
This route is blocked unless `NODE_ENV=development`, no `VERCEL_ENV` is present,
and `NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true`.

## Current UX Run Command

The production-shaped UI now runs from the repository root as a Next app.

Terminal:

```bash
cd /Users/abhiroopprasad/code/side-projects/WereCode
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

The visible app has routes for `/`, `/library`, `/studio`, and
`/studio/[songId]`. Library data, jobs, assets, lyrics, MIDI edit sessions, and
workflow state are now backed by Supabase/Next route handlers. Modal is used
only through workflow orchestration routes for compute endpoints.

Start the legacy backend only when testing local YouTube download mode:

```bash
cd /Users/abhiroopprasad/code/side-projects/WereCode/backend
uv sync
uv run python run_api.py
```

Then enable the local-only flags in the root `.env`:

```text
NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true
LOCAL_WERECODE_API_URL=http://localhost:8001
```

Do not enable those flags in Vercel.

## Target Runtime Split

### Next/Vercel

Owns:

- Google auth session handling through Supabase Auth
- product routes and UI
- library/studio pages
- durable jobs table
- asset records and signed URL generation
- calls to Modal gateway
- polling and job status updates
- user-edited lyrics, metadata, and approvals

Does not own:

- yt-dlp downloads
- ffmpeg conversion
- Demucs separation
- Basic Pitch inference
- WhisperX alignment
- Essentia/MSAF analysis
- long-running MIDI/MusicXML conversion

### Supabase

Owns:

- auth users
- `werecode` schema app data
- private source/artifact/preview buckets
- row-level owner isolation
- signed upload/download URLs

### Modal

Owns:

- `/health`
- `/models`
- `/api-info`
- `/analyze/music`
- `/separate`
- `/lyrics/align`
- `/midi/transcribe`
- `/transcribe/instrument` if retained by the Modal service for direct
  instrument-specific experimentation; the product app currently uses
  `/midi/transcribe` for the main workflow.

Everything else is product/backend state and belongs in this Next app.

## Migration Plan

### Phase 1: Data Foundation

1. Run the Supabase SQL.
2. Add environment variables for local and Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `MODAL_GATEWAY_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` only for local dev identity
   - `WERECODE_ENABLE_DEV_IDENTITY=true` for local development only
3. Create storage path helpers using `<owner_id>/<song_id>/...`.
4. Add typed DB access helpers for the `werecode` schema.

### Phase 2: Next App Shell

1. Replace Vite with Next App Router.
2. Move existing views/components into Next routes:
   - `/`
   - `/library`
   - `/studio/[songId]`
3. Replace `frontend/src/services/api.ts` FastAPI calls with relative `/api/*` route calls.
4. Add Supabase auth client and login/session components.

### Phase 3: Next API Routes

Implement route handlers:

```text
GET    /api/library
POST   /api/songs
POST   /api/songs/probe
POST   /api/songs/ingest
GET    /api/songs/[songId]
DELETE /api/songs/[songId]
GET    /api/songs/[songId]/assets/[assetId]/signed-url
POST   /api/workflows/analyze
POST   /api/workflows/separate
POST   /api/workflows/lyrics/align
POST   /api/workflows/midi/transcribe
POST   /api/workflows/midi/convert-musicxml
POST   /api/workflows/midi/edit/apply
POST   /api/workflows/arrangement/manifest
GET    /api/jobs
GET    /api/jobs/[jobId]
POST   /api/lyrics/save
GET    /api/songs/[songId]/midi-edits
POST   /api/songs/[songId]/midi-edits
PATCH  /api/songs/[songId]/midi-edits/[sessionId]
```

These route handlers create rows, generate signed URLs, call Modal, and update `werecode.jobs` plus `werecode.assets`.

Current boundary cleanup:

- `/api/songs/probe` and `/api/songs/ingest` are Next-owned source registration
  routes. They do not call Modal `/ingest/*` and do not create asset rows unless
  source audio actually exists.
- `/api/workflows/*` route handlers own the compute orchestration entrypoints.
- `/api/modal/[...segments]` is restricted to GET metadata routes only:
  `/health`, `/models`, `/api-info`.
- Modal compute endpoints are no longer exposed as raw Next proxy routes.
- `POST /api/jobs/[jobId]/run` reuses the existing job row for implemented
  workflows instead of creating a duplicate job.

### Next-Owned API Implementation Tasks

The following must stay in this repo, not Modal:

- `POST /api/songs`: create manual/upload/import song rows.
- `POST /api/songs/probe` and `POST /api/songs/ingest`: parse/register source
  URLs in Supabase. YouTube download is not part of the current Modal contract;
  audio upload is the active path for source audio.
- `GET /api/library`: aggregate songs and jobs for UI.
- `POST /api/storage/sign-upload` and `POST /api/storage/sign-download`: Supabase Storage signing.
- `GET /api/songs/[songId]/assets` and `POST /api/songs/[songId]/assets`: asset CRUD.
- `GET /api/songs/[songId]/analysis-results`: read persisted analysis rows.
- `GET /api/songs/[songId]/lyrics` and `POST /api/lyrics/save`: user/product lyrics state.
- `POST /api/workflows/analyze`: Next creates job, signs URLs, calls Modal `/analyze/music`, persists assets and `analysis_results`.
- `POST /api/workflows/separate`: Next creates job, signs URLs, calls Modal `/separate`, persists stem assets.
- `POST /api/workflows/lyrics/align`: Next creates job, signs URLs, calls Modal `/lyrics/align`, persists lyrics alignment artifact and `lyrics` row.
- `POST /api/workflows/midi/transcribe`: Next creates job, signs URLs, calls Modal `/midi/transcribe`, persists MIDI/note event assets.
- `GET/POST/PATCH /api/songs/[songId]/midi-edits`: MIDI edit proposal/approval/apply session state.
- `POST /api/workflows/midi/convert-musicxml`: lightweight Next-owned MusicXML generation from note event JSON.
- `POST /api/workflows/midi/edit/apply`: applies edit state by writing a manifest asset; it does not run a model.
- `POST /api/workflows/arrangement/manifest`: stores arrangement manifest state in `songs.metadata`.
- `POST /api/local/youtube-download`: local-only bridge to the legacy backend for yt-dlp development use. Never enable on Vercel.

### Phase 4: Modal Integration

Modal should expose only:

```text
GET  /health
GET  /models
GET  /api-info
POST /analyze/music
POST /separate
POST /lyrics/align
POST /midi/transcribe
```

Implementation tasks:

1. Retarget the Modal stack from tarregaSheets to WereCode.
2. Implement real signed URL IO for inputs and outputs.
3. Keep Demucs, Basic Pitch, WhisperX/alignment, Essentia/MSAF, ffmpeg, and
   other high-compute/model dependencies inside Modal.
4. Keep CRUD, jobs, asset rows, lyrics rows, analysis result rows, and user state
   inside this Next app.
5. Do not add Modal endpoints for lyrics fetch, MIDI edit proposal/apply, or
   MusicXML until the Next-owned product/state contract is designed.

### Phase 5: Remove FastAPI From Production

1. Keep Python backend scripts only as local/dev tools if useful.
2. Keep production independent of `uvicorn`.
3. Keep production independent of local `downloads/` assumptions.
4. Deploy the root Next app on Vercel.
5. Configure Vercel env vars and Modal API URL.

Current status:

- Root Next app deployment is wired.
- Production Google auth has passed an initial smoke test.
- Local YouTube download remains local-only through the legacy backend.
- Legacy `backend/` and `frontend/` directories remain in the repository as
  reference/local paths and are excluded from the root Vercel deployment payload.
- Old `studio_Design/` screenshot artifacts have been removed; future design
  work should happen directly in the Next app or in new committed assets.

## Next Work Queue

1. Run two-user RLS and storage isolation checks in production.
2. Finish studio UX/UI completion for waveform, playback, lyrics, stems, MIDI,
   and transcription surfaces.
3. Decide cleanup policy for failed jobs and abandoned storage objects.
4. Retire or further quarantine legacy reference directories when they are no
   longer needed.

## Open Decisions

- Storage provider is assumed to be Supabase Storage for now.
- Direct browser DB access versus all access through Next route handlers: recommend route handlers first for simpler security and orchestration.
- Modal callbacks versus Next polling: start with Next route handlers calling Modal synchronously for shorter jobs and polling app job records for longer jobs.
