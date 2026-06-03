# WereCode Local Download Backend

This backend is local-only. It supports the root Next app's local YouTube
download bridge when `NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true`.

Run:

```bash
uv sync
uv run python run_api.py
```

Endpoints:

```text
POST /api/v1/download
GET  /api/v1/download/diagnostics
GET  /api/v1/jobs/{job_id}
GET  /health
```

Do not add production analysis, stems, MIDI, lyrics alignment, AI editing,
library CRUD, auth, or storage APIs here. Those belong in Next/Supabase or
Modal.
