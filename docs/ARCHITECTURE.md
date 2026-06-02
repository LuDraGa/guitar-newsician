# WereCode Architecture

WereCode is a root Next.js application with a strict product/compute split.

## Next/Vercel

Owns:

- UI routes: `/`, `/library`, `/studio`, `/studio/[songId]`
- Supabase Auth session handling
- Songs, assets, jobs, lyrics, MIDI edit state, and arrangement state
- Supabase Storage signed upload/download URLs
- Workflow orchestration routes under `/api/workflows/*`
- Local-only bridge route `/api/local/youtube-download`

## Supabase

Owns:

- `werecode` schema rows
- Google-authenticated users
- Private buckets:
  - `werecode-sources`
  - `werecode-artifacts`
  - `werecode-previews`
- Owner-scoped RLS and storage isolation

## Modal

Owns heavy compute only:

- `GET /health`
- `GET /models`
- `GET /api-info`
- `POST /analyze/music`
- `POST /separate`
- `POST /lyrics/align`
- `POST /midi/transcribe`

## Local Python Backend

`backend/` is not a production backend. It exists only for local YouTube
download while the Next UI has `NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true`.

Allowed local endpoints:

```text
POST /api/v1/download
GET  /api/v1/download/diagnostics
GET  /api/v1/jobs/{job_id}
GET  /health
```

Everything else that used to live in Python has moved to either Modal compute
or Next/Supabase product state.
