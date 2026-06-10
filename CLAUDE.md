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

## Design Context

Design work is grounded in two root files (created via `/impeccable init`):

- `PRODUCT.md` — strategic: register (`product`), users, purpose, brand
  personality, anti-references, and design principles. The *why*.
- `DESIGN.md` — visual: the committed design system (the "Luthier's Bench"
  palette, Schibsted/Hanken Grotesk + JetBrains Mono, pill/chip/segment
  primitives, elevation, do's and don'ts). The *how it looks*. Token source of
  truth is `src/app/globals.css`; `.impeccable/design.json` is the
  machine-readable sidecar.

Read PRODUCT.md and DESIGN.md before designing or restyling any surface.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role strings: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
