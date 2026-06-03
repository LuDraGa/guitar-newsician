# WereCode

WereCode is now a root Next.js application intended for Vercel deployment. The
app owns the product surface: Google auth through Supabase, the library and
studio UI, job state, Supabase database rows, Supabase Storage signed URLs, and
orchestration calls to Modal.

Modal is reserved for heavy media/model work. Supabase owns durable data,
private object storage, and owner-scoped RLS.

## Runtime Split

### Next/Vercel

- App Router UI for `/`, `/library`, and `/studio/[songId]`
- Supabase Auth session handling
- Next route handlers for songs, assets, jobs, lyrics, MIDI edit state, and
  workflow orchestration
- Supabase Storage signed upload/download URL creation
- Calls to the Modal compute gateway

### Supabase

- `werecode` schema tables and RLS policies
- Google-authenticated users
- Private buckets:
  - `werecode-sources`
  - `werecode-artifacts`
  - `werecode-previews`

### Modal

Modal should expose compute and metadata endpoints only:

- `GET /health`
- `GET /models`
- `GET /api-info`
- `POST /analyze/music`
- `POST /separate`
- `POST /lyrics/align`
- `POST /midi/transcribe`

## Local Development

Use pnpm from the repository root.

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

Checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Environment Variables

Required for Vercel production/preview:

```env
NEXT_PUBLIC_SUPABASE_URL=https://olquywzupxszttgiptco.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
NEXT_PUBLIC_AUTH_ENABLED=true
MODAL_GATEWAY_URL=https://abhirooprasad--werecode-modal-apis-fastapi-app.modal.run
```

Optional if the Modal gateway is protected:

```env
MODAL_GATEWAY_TOKEN=<modal-gateway-token>
```

Local-only development variables:

```env
SUPABASE_SERVICE_ROLE_KEY=<local-dev-only>
WERECODE_ENABLE_DEV_IDENTITY=true
WERECODE_DEV_USER_ID=<auth.users.id>
NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true
LOCAL_WERECODE_API_URL=http://localhost:8001
```

Do not set dev identity or local YouTube download variables on Vercel.

## Local YouTube Download

YouTube download is not part of the production Vercel or Modal path. It is a
local-only bridge for development.

Run the legacy backend separately when the local flag is enabled:

```bash
cd backend
uv sync
uv run python run_api.py
```

Then keep the Next app running from the repository root with `pnpm dev`.

## Repository Map

- `src/`: production Next.js app
- `supabase/sql/`: manual Supabase schema and verification SQL
- `backend/`: local-only Python YouTube download backend
- `docs/execution_docs/`: migration and task tracking docs

The Vercel project root should be this repository root. The local `backend/`
directory is not a production deployment root.

## Deployment

The current manual deployment checklist is maintained in:

`docs/execution_docs/2026-05-25_supabase-next-vercel-transition.md`
