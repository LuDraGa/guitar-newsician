# Backend Local Download Cleanup

Date: 2026-06-02
Status: implemented

## Objective

Restrict `backend/` to the only backend behavior still used by the root Next app:
local YouTube download during development.

## Kept

- `backend/run_api.py`
- FastAPI app shell under `backend/app/api/main.py`
- `POST /api/v1/download`
- `GET /api/v1/download/diagnostics`
- `GET /api/v1/jobs/{job_id}`
- local in-memory job tracking
- yt-dlp download service
- minimal YouTube Music/syncedlyrics helpers used to create `lyrics.txt` and
  `lyrics.lrc` for the Next local import bridge

## Removed

- Python analysis, conversion, stem separation, MIDI editor, and AI chat APIs
- old static API UI and OpenAI tools JSON
- old CLI analyzer/converter/stem/downloader modules
- heavyweight backend dependencies that now belong to Modal or are no longer
  used locally

## Boundary

Do not add production product state or compute APIs back into `backend/`.
Production state belongs in Next/Supabase. Production compute belongs in Modal.
