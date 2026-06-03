# AGENTS.md

This file gives Codex repository guidance for WereCode.

## Project Essentials

WereCode is a root Next.js app deployed on Vercel. The app owns UI, Supabase
auth/data/storage, job state, and orchestration. Modal owns heavy compute. The
Python backend is local-only and exists only for development YouTube download.

## Current Runtime Split

- `src/`: production Next.js app and API routes
- `supabase/sql/`: manual Supabase schema and verification SQL
- `backend/`: local-only YouTube download API used when
  `NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true`

Do not add production CRUD, jobs, storage, auth, or product state back into the
Python backend. Those belong in Next route handlers and Supabase.

## Common Commands

Root Next app:

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

Local YouTube backend:

```bash
cd backend
uv sync
uv run python run_api.py
```

Backend local endpoints:

```text
POST /api/v1/download
GET  /api/v1/download/diagnostics
GET  /api/v1/jobs/{job_id}
GET  /health
```

## Development Guidelines

- Use `rg` for text search.
- Use `uv` for Python package management inside `backend/`.
- Use `pnpm` for the root Next app.
- For significant changes, add or update an execution document in
  `docs/execution_docs/`.
- Keep Modal compute concerns out of this repo except for typed orchestration
  requests/responses.

## Backend Boundary

The backend must stay local-only. It should not expose analysis, stems, MIDI,
lyrics alignment, AI editing, library CRUD, or storage APIs. Those are either
Modal compute endpoints or Next-owned product routes.
