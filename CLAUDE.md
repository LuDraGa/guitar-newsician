# CLAUDE.md

This repository is the WereCode root Next.js application.

## Runtime Split

- Next/Vercel owns UI, Supabase auth/data/storage, jobs, and orchestration.
- Supabase owns durable rows, private buckets, and RLS.
- Modal owns heavy model/ffmpeg compute.
- `backend/` is local-only and only supports YouTube download for development.

## Commands

Root app:

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

Local download backend:

```bash
cd backend
uv sync
uv run python run_api.py
```

## Backend Boundary

Only these backend endpoints should exist:

```text
POST /api/v1/download
GET  /api/v1/download/diagnostics
GET  /api/v1/jobs/{job_id}
GET  /health
```

Do not reintroduce Python APIs for product CRUD, analysis, stems, lyrics
alignment, MIDI, AI editing, storage, or auth. Those belong in Next/Supabase or
Modal.
