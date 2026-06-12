# Execution Doc: Studio Pitch-Preserving Speed

**Date**: 2026-06-12
**Status**: Completed
**Owner**: Codex

## Objective

Fix Studio transport speed changes so practice speed does not transpose the song.

## Context

- The Studio transport uses a shared Web Audio clock with decoded `AudioBufferSourceNode`s.
- Changing `AudioBufferSourceNode.playbackRate` changes both tempo and pitch.
- A first granular overlap approach preserved pitch but introduced robotic/static artifacts because fixed grains were not phase-aware enough for full music mixes.

## Plan

- [x] Keep the shared-clock Web Audio engine for stem sync, loop behavior, and master gain.
- [x] Apply inverse pitch correction from the current playback speed, with `1x` resolving to zero semitones.
- [x] Dispose pitch-correction DSP nodes on pause, seek, song change, and unmount.
- [x] Keep pitch-correction nodes warmed during playback so rapid speed changes do not briefly expose uncorrected pitch.
- [x] Add a short internal transition duck while the pitch-correction window settles.
- [x] Verify with typecheck and lint.

## Progress Log

### 2026-06-12 18:11

**Action**: Replaced the fixed-grain pitch-preserving scheduler with inverse semitone correction through the existing Tone.js `PitchShift` effect.
**Result**: The transport still uses `playbackRate` for timing, and the pitch path applies `-12 * log2(rate)` semitones of correction.
**Notes**: This avoids the obvious fixed-grain comb-filter/static failure while keeping the single-clock playback architecture.

### 2026-06-12 18:18

**Action**: Switched native buffer-source to Tone pitch-shifter routing through Tone's `connect` helper.
**Result**: Avoids the browser runtime error from calling native `AudioNode.connect()` with Tone's wrapped node internals.
**Notes**: Native Web Audio nodes and Tone nodes need Tone's resolver when crossing that boundary.

### 2026-06-12 18:35

**Action**: Kept a pitch shifter in each live source path and changed playback rate plus inverse pitch correction in place.
**Result**: Rate-only changes no longer stop/recreate source nodes or cold-start a new pitch-shift window.
**Notes**: This targets the brief wrong-pitch transient heard when tapping between speeds quickly.

### 2026-06-12 18:46

**Action**: Added a separate transition gain between master gain and limiter, with a tiny fade-out before the scheduled rate switch and fade-in after the pitch window settles.
**Result**: Rapid speed changes hide the short correction mismatch instead of playing a wrong-pitch sliver at full volume.
**Notes**: The transition gain is separate from master volume, so volume and mute behavior remain independent.

### 2026-06-12 18:55

**Action**: Deferred the Tone pitch-correction update to the same switch point as the scheduled source playback-rate change.
**Result**: The old rate keeps the old correction during fade-out, then rate and correction change together while the transition gain is silent.
**Notes**: Pending deferred correction is cancelled on later rate changes or transport teardown.

## Blockers

- [ ] Manual audio quality verification still needs an authenticated Studio session with a real uploaded song/stems.

## Decisions Made

1. **Decision**: Keep the Web Audio buffer-source engine instead of returning to independent `<audio>` elements.
   - **Rationale**: The engine was introduced to fix stem drift, loop sync, and master volume boost.
   - **Alternatives Considered**: Native `HTMLMediaElement.preservesPitch`, which has better browser DSP but reopens the old multi-element drift problem for stems.

2. **Decision**: Use the existing Tone.js pitch shifter as the immediate correction path and keep it warmed while playing.
   - **Rationale**: It avoids adding a dependency and keeps changes scoped to the Studio transport.
   - **Alternatives Considered**: Custom granular scheduling, which caused robotic/static artifacts; a dedicated WSOLA/phase-vocoder dependency, which is likely the longer-term quality ceiling.

## Testing

- [x] `pnpm typecheck` with Node 22
- [x] `pnpm lint` with Node 22
- [ ] Manual Studio listening pass at `0.5x`, `0.75x`, `1.5x`, `1.75x`, and `2x`

## Results

Studio playback rate changes now keep timing on the shared Web Audio clock and compensate the pitch shift for the active speed.
