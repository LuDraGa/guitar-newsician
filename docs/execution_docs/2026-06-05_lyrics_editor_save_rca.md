# Lyrics Editor Save RCA

Date: 2026-06-05
Status: Implemented
Owner: Codex

## Problem

Saving lyrics from Studio's Lyrics editor appeared successful, but Karaoke showed
the old wrong lyrics afterward. Manually stamped timing was not available as
Karaoke sync.

## Root Cause

- The Lyrics editor save path only persisted `lyrics_type = plain`, even when
  rows had timestamps.
- Karaoke and the editor preferred any existing synced row (`lrc` or
  `alignment_json`) over the newer plain edit, so an old wrong `.lrc` row could
  immediately mask the user's saved text.
- Studio selected only one synced row before parsing it. A newer unparseable
  alignment row could mask an older valid `.lrc` row.
- The shared LRC parser accepted a narrow timestamp format and treated all
  fractional timestamp digits as centiseconds.

## Changes

- Editor Save now persists plain lyrics and, when at least one row has a
  timestamp, also upserts a user-authored `lrc` row.
- Studio picks the latest parseable synced row that is not older than the latest
  plain row.
- Editor reloads user `.lrc` content directly so untimed placeholder rows remain
  editable.
- The Save badge is updated only after the API write completes.
- LRC parsing now supports timestamps without fractions, colon fractions,
  repeated leading timestamps, and arbitrary fractional precision.

## Verification

- `pnpm typecheck` with Node `v22.20.0`
- `pnpm lint` with Node `v22.20.0`
- Browser smoke test: `http://localhost:3000/studio` rendered the empty Studio
  state without console errors.

## Remaining Manual Check

The local session had no selected song fixture, so the exact Lyrics editor
save workflow still needs a real song to verify end to end in-browser.
