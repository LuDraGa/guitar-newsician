# Karaoke Stem Playback RCA

Date: 2026-06-05
Status: Implemented
Owner: Codex

## Problem

On Studio -> Karaoke, lowering all non-vocal stem levels to `0` could still
leave non-vocal instruments audible. Using Solo on the vocal stem produced the
expected vocal-only playback.

## Root Cause

The mixer UI displayed only one latest stem per kind, but the transport played
every stem asset row attached to the song. If a song had duplicate stem outputs
from multiple separation runs, older hidden drums/bass/other stem audio elements
kept their default volumes. Solo appeared to work because it silenced every
non-solo stem row, including hidden duplicates.

This was not the original full-track audio element playing alongside stems; the
original audio path is already disabled when stem playback is active.

## Change

Studio now derives a single latest-per-kind playable stem set and uses that same
set for:

- Karaoke mixer rows
- stem signed URL requests
- transport stem audio elements

The selected stem per kind is chosen by `created_at`, then displayed in the
normal stem order.

## Verification

- `pnpm typecheck` with Node `v22.20.0`
- `pnpm lint` with Node `v22.20.0`
- Browser smoke check: `http://localhost:3000/studio` rendered without console
  errors.

## Remaining Manual Check

The local browser session had no selected song with duplicate stem assets, so the
exact vocal-only mixer interaction still needs to be verified against a real
song fixture.
