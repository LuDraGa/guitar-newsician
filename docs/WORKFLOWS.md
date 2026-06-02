# WereCode Workflows

## Root App Development

```bash
pnpm install
pnpm dev
```

Open the printed Next URL. If `localhost:3000` is occupied by another process,
use the alternate local address printed by Next.

Checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Local YouTube Download

Production does not use yt-dlp. For local development only:

```env
NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true
LOCAL_WERECODE_API_URL=http://localhost:8001
```

Run the local backend:

```bash
cd backend
uv sync
uv run python run_api.py
```

Useful backend checks:

```bash
curl http://localhost:8001/health
curl http://localhost:8001/api/v1/download/diagnostics
```

The Next route `/api/local/youtube-download` starts the backend download job,
polls `/api/v1/jobs/{job_id}`, uploads the resulting local audio/metadata to
Supabase Storage, and creates Supabase rows.

## Production Workflows

Use the Next Studio UI or call the Next workflow routes:

```text
POST /api/workflows/analyze
POST /api/workflows/separate
POST /api/workflows/lyrics/fetch
POST /api/workflows/lyrics/align
POST /api/workflows/midi/transcribe
POST /api/workflows/midi/convert-musicxml
POST /api/workflows/midi/edit/apply
POST /api/workflows/arrangement/manifest
```

Next creates jobs, signs URLs, calls Modal where compute is needed, persists
artifacts to Supabase Storage, and updates Supabase rows.
