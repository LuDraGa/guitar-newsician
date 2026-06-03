# Repo Cleanup Audit

Date: 2026-06-02
Status: cleanup slice

## Production Surface Present

Root Next app routes:

- `/`
- `/library`
- `/studio`
- `/studio/[songId]`

Next API ownership:

- Auth/session: `/api/auth/callback`, `/api/auth/session`
- Health: `/api/health`, `/api/supabase/health`
- Library/jobs/songs/assets/lyrics/MIDI edit state
- Supabase Storage signed upload/download URLs
- Local-only YouTube bridge: `/api/local/youtube-download`
- Modal metadata proxy: `/api/modal/[...segments]` for GET metadata only
- Workflow orchestration:
  - `/api/workflows/analyze`
  - `/api/workflows/separate`
  - `/api/workflows/lyrics/fetch`
  - `/api/workflows/lyrics/align`
  - `/api/workflows/midi/transcribe`
  - `/api/workflows/midi/convert-musicxml`
  - `/api/workflows/midi/edit/apply`
  - `/api/workflows/arrangement/manifest`

Current Studio UI exposes playback, workflow actions, asset listing, workflow
state, stems, karaoke preview, MIDI/score artifacts, analysis rows, lyrics, and
jobs.

## Not Fully Ported Yet

Keep legacy source references until these are deliberately replaced in Next:

- AI assistant/chat/editor UX from the old transcription panel.
- Piano/sheet/tab interactive viewer tabs.
- Full stem mixer and waveform/spectrogram interaction.
- Any advanced MIDI edit proposal flow beyond the current manifest apply route.

## Cleanup Decision

Remove:

- Old 2025 execution documents that describe the previous Vite/FastAPI era.
- Old design screenshot artifacts under `studio_Design/`.
- Old top-level Vite-era UI documentation:
  - `docs/STUDIO_IMPROVEMENTS.md`
  - `docs/TRANSCRIPTION_UI_GUIDE.md`
  - `docs/UI_DOCUMENTATION.md`
- Backend compute/API artifacts after the Next/Modal split:
  - analysis, conversion, stems, MIDI editor, AI chat, static API UI, and old
    CLI downloader modules
  - heavyweight Python dependencies for Basic Pitch, Demucs, Essentia, MSAF,
    LangGraph/OpenAI, Music21, librosa, soundfile, and pydub

Keep:

- `backend/` only as the local-only YouTube download backend.
- Current 2026 migration docs and Supabase SQL.

Follow-up completed:

- Removed the remaining `frontend/` source reference after deciding migration
  should continue in a separate branch.
