# Local Synced Lyrics Before Modal

## Goal

Prefer existing or locally fetched synced lyrics before invoking the Modal lyrics alignment endpoint.

## Changes

- Added a Next server-only LRCLIB lookup client for lightweight synced/plain lyrics lookup by title, artist, album, and duration.
- Added `POST /api/workflows/lyrics/fetch` for local lyrics lookup and Supabase persistence.
- Updated `POST /api/workflows/lyrics/align` to:
  - return immediately if synced lyrics already exist,
  - try LRCLIB lookup next,
  - persist LRC/plain lyrics rows when found,
  - skip Modal when LRC is available,
  - fall back to Modal `/lyrics/align` when synced lyrics are missing.
- Added a Studio "Lyrics" action for direct LRCLIB lookup.

## Notes

- Modal remains responsible for expensive WhisperX/alignment work only when existing/LRCLIB synced lyrics are unavailable.
- Set `LYRICS_LOOKUP_ENABLED=false` to disable LRCLIB lookup.
- Set `LYRICS_LOOKUP_TIMEOUT_MS` to tune the LRCLIB timeout.
- Set `LRCLIB_USER_AGENT` to identify the app in LRCLIB requests.
