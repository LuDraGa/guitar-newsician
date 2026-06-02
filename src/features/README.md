# Feature Migration Targets

This directory is the target for code moved out of the legacy Vite app.

- `library/`: song list, filters, upload/source creation, asset status
- `studio/`: playback, stem mixer, analysis views, workspace layout
- `jobs/`: job state, polling, progress display, retries
- `lyrics/`: lyrics fetch, LRC parsing, karaoke alignment display
- `midi/`: MIDI analysis, edit proposal/apply, piano roll helpers
- `transcription/`: Basic Pitch settings, note events, sheet/MusicXML surfaces

The remaining source-reference material lives in `frontend/src` until the old AI assistant, tabs, and advanced studio interactions are intentionally replaced in Next.
