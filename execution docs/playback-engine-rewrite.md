# Studio Playback — Web Audio Engine Rewrite

**Status:** IMPLEMENTED — typecheck + lint clean; live audio verification pending (needs auth + real stems)
**Owner:** abhiroop
**Started:** 2026-06-08
**Scope chosen:** Full Web Audio rewrite (user-approved)

---

## Why

Current transport = N independent `<HTMLAudioElement>` (one per stem), "synced" by
poking `currentTime`. No shared clock. Consequences:

- **(e) loop desync:** each stem free-runs on its own internal clock. `syncStemFollowers`
  only corrects drift > 0.45s and ≤ once/sec. At loop boundary, master `onTimeUpdate`
  (~4Hz) sets `currentTime=loopStart` on every element → each is an independent async
  seek that resumes at a different real-time → phase offset every loop. FLAC makes it
  visible: frame-quantized seek (~thousands of samples/frame) snaps each element to its
  own frame boundary. No forced re-sync after the jump. → fundamentally unreliable.
- **(c) master volume:** `HTMLMediaElement.volume` is clamped **[0,1]**. 150% boost is
  impossible without Web Audio GainNode.

Both c and e require the same fix → real audio engine.

---

## Target architecture

```
stem bufferSource → [stem GainNode] ─┐
stem bufferSource → [stem GainNode] ─┼→ [master GainNode] → ctx.destination
stem bufferSource → [stem GainNode] ─┘
                  one AudioContext clock
```

- Decode each stem → `AudioBuffer` (reuse decode pattern from `lib/music/waveform/extract.ts`).
- Per-stem `GainNode` (level/mute/solo) → **master `GainNode`** (0–1.5) → destination.
- All `AudioBufferSourceNode`s `.start()` against one shared `ctx.currentTime` anchor.
- Transport position = `(ctx.currentTime - startContextTime) * rate + startOffset`,
  mapped into the active loop window when looping.

### What it unlocks

| Item | Mechanism |
|------|-----------|
| (e) sync | one sample clock; native `source.loop` + `loopStart`/`loopEnd` → sample-accurate, zero-gap loop |
| (c) master vol | master GainNode, gain may exceed 1.0 → 150% boost; effective stem gain = `level% × master%` |
| (d) repeat-song | same loop primitive with bounds `[0, duration]` |
| (b) arrow seek | reschedule sources at new offset (cheap) |

---

## Engine design notes

- **Source nodes are one-shot.** play() creates fresh `AudioBufferSourceNode`s each time;
  pause()/seek() call `.stop()` and recreate on next play.
- **play():** for each stem create source → connect gain → `source.start(0, offset)`.
  Record `startContextTime = ctx.currentTime`, `startOffset = offset`.
- **pause():** capture position, `.stop()` all, store `pausedOffset`.
- **seek(t):** playing → stop+recreate at offset t; paused → store pausedOffset=t. UI updates immediately.
- **Position UI:** rAF loop (~60Hz) replaces `onTimeUpdate` (~4Hz) → smoother seeker + tighter loop detection.
- **Loop / repeat:** native `source.loop=true; loopStart; loopEnd` on all sources (settable live).
  Position math maps elapsed into `[loopStart, loopEnd)`. A/B loop and repeat-song are the
  same primitive, different bounds.
- **Rate:** `source.playbackRate.value = rate`; position math multiplies elapsed by rate.
- **Master vol:** `masterGain.gain` via `setTargetAtTime` (short ramp) to avoid zipper noise.
- **Autoplay policy:** ctx starts suspended; `ctx.resume()` on first play (user gesture). OK.
- **Cleanup:** close ctx on unmount; re-decode when stem-source signature changes; drop stale buffers.

### Memory / latency

- Decoded PCM ≈ 20MB/min/stem (stereo f32). 4 stems × 4min ≈ ~300MB. Fine desktop, heavy
  mobile. Mitigation option: create ctx at reduced sampleRate (e.g. 32kHz) to cut ~30%.
- Decode is upfront (gated by existing "Preparing stems x/N" UI). Mark each stem ready as
  it decodes; duration = max(buffer.duration).

### DECISION — original-only mode

**Picked: unify both modes on the AudioBuffer engine** (decode the original track too).
Single engine, one clock, master volume applies everywhere, far less code.
Tradeoff: original-only play gains a ~1–2s decode gate (today it streams instantly via
`preload=metadata`). Covered by the same "Preparing" readiness UI.
*Alternative rejected:* keep original on HTMLAudio + MediaElementSourceNode→masterGain
(instant stream, master boost works) — but dual engines = double maintenance of
seek/loop/repeat. Not worth it.

---

## Feature work (built on the engine)

### (a) Seeker visual — engine-independent
- Drop fake `makeBars` bars in `renderWaveform` (~line 2053).
- Replace with: thin track + thick filled portion (fill behind playhead) + cursor knob at fill end.
- Keep loop-range overlay + section tick marks. Keep the invisible `<input range>` for click/drag scrub.

### (b) Arrow-key seek with acceleration
- keydown ArrowLeft/Right in transport scope (guard: ignore when typing in input/textarea).
- Tap = ±5s step. Hold = rAF loop accumulating delta; pace ramps ~5 → ~25 s/s over ~1.5s hold
  (continuous, not discrete). keyup → settle.
- Avoid conflict with lyric-editor ArrowUp/Down cursor handler (different keys; transport owns Left/Right).

### (c) Master volume control
- Slider 0–150% (allow boost). Default 100% (or 80% per user note — confirm default).
- masterGain.gain = master/100. Effective per-stem = product with existing level/mute/solo.
- Optional: soft limiter (DynamicsCompressor) before destination to tame clipping >100%.

### (d) Repeat-song toggle
- Transport mode: Off / Repeat-song (loop whole track) — coexists with A/B loop.
- When on, loop bounds = `[0, duration]`. At end → wrap to 0 seamlessly (native loop).

### (e) Loop sync — solved by engine (no separate code)

---

## Task checklist

- [x] Build Web Audio engine (`usePlaybackEngine`: decode, graph, play/pause/seek/position rAF) — replaces HTMLAudio refs
- [x] Wire master GainNode + DynamicsCompressor limiter + master volume slider, default 80% / max 150% (c)
- [x] Native gapless loop primitive for A/B loop + repeat-song (d, e)
- [x] New seeker line visual: thin track, accent fill, knob at fill end, section ticks, decode hairline (a)
- [x] Arrow-key seek with acceleration (tap ±5s / hold ramps 5→45 s/s) (b)
- [x] Subtle ready signal: play-button spinner + hairline decode progress on seeker (no extra layout)
- [x] Preserve: speed control, solo/mute, level preview event, minimized bar, section ticks, seekCommand/playbackCommand
- [x] `pnpm typecheck` + `pnpm lint` clean (note: repo needs Node 22; ran via nvm)
- [ ] Manual verify in app: stem-mix loop has zero desync; master 150% audibly boosts; arrow accel smooth; repeat seamless

## Implementation notes (done)

- New `usePlaybackEngine(engineSources, fallbackDuration)` hook owns the AudioContext graph and transport clock.
- Original-only mode unified onto the same engine (decodes `audioUrl` as a single source id `__original__`).
- Gain changes (master / per-stem / live preview) never touch the clock → they can never cause desync.
- Control changes (rate, loop bounds, repeat, seek) reschedule from live position; steady-state looping never reschedules (native gapless loop).
- Upstream `onTimeChange` throttled to ~20Hz; local seeker runs at 60Hz.
- Lint: decode effect kept imperative; React state reset moved to render-time "adjust state during render" to satisfy `react-hooks/set-state-in-effect`.

---

## Open confirmations before implement

1. Original-only mode: unify on Web Audio (my pick) — OK?
2. Master volume default: user note said "80%" — is 100% the default and 80% just an example, or default 80%?
3. Master volume max: 150% cap (user mentioned 150)?

---

## Design pass v2 (post-rewrite polish)

User feedback after the engine landed. Decisions confirmed:
- Item 2 (too-wide / empty space): **DEFERRED** by user ("we'll get to this later").
- Item 6 (colors): **black seeker, accent markers** — fill/knob/volume go `--ink`;
  loop range + section ticks stay `--accent` so they pop against the black (also fixes item 1).

### Tasks

- [x] **(1) Loop + section markers visible** — section ticks `--line-2` (6%, ghost) → taller `--accent` @55%. Loop range → accent band @25% + solid accent A/B end-cap lines. Loop range now shown in minimized seeker too.
- [x] **(3) ±5s indicator on skip buttons** — back/forward relabelled as pills: icon + `5`.
- [x] **(4) Repeat toggle clarity** — icon-only button → labelled pill `⟳ Repeat` with ink-filled active state (matches every other toggle convention).
- [x] **(5) Spacebar play/pause** — Space in the keyboard effect; guards BUTTON/INPUT/TEXTAREA/SELECT/A/contentEditable so a focused control isn't double-toggled.
- [x] **(6) Black seeker** — fill, knob, volume accent → `--ink`; decode hairline → `--accent`; markers stay accent (see item 1).
- [x] **(7) Re-open buffer latency** — module-level LRU cache of decoded `AudioBuffer` keyed by URL (AudioBuffers are context-independent). Re-opening the same song skips fetch+decode → instant. Capped ~220MB by sample bytes.
- [ ] **(2) Width / spacing** — DEFERRED (user: "we'll get to this later").

Status: design pass v2 IMPLEMENTED — typecheck + lint clean. Live verification pending.

---

## Design pass v3 (transport polish round 2)

- [x] **(3) Repeat no longer glitches/pauses** — `setLoop` updated existing source nodes' `loop`/`loopStart`/`loopEnd` flags in place when the playhead is inside the new window (always true for repeat-song) instead of stop+recreate. Eliminates the ~30ms silent gap that read as a pause. Reschedule only kept for an A/B window set *ahead* of the playhead (a genuine seek).
- [x] **(4) Section markers uniform thickness** — hairline `<div>`s at fractional `left:%` anti-aliased to inconsistent widths. Replaced with one SVG overlay (`shapeRendering="crispEdges"` + non-scaling stroke) → pixel-snapped, identical. Recoloured: sections grey `--muted`, loop band/caps stay rust `--accent` (clearly different).
- [x] **(1) Crisper vertical** — expanded seeker `h-16`→`h-10`, play button `h-14`→`h-12`, section `py-4`→`py-3`, top-row `gap-4`→`gap-3`. Less dead space even with the new labels row.
- [x] **(2) Clickable section labels** — compact grey row under the seeker; each section name seeks to its start, active one highlighted ink. Removed the redundant single accent current-section chip from the meta row.

Status: design pass v3 IMPLEMENTED — typecheck + lint clean. Live verification pending.

---

## Design pass v4 (transport redesign — match target mock)

User compared current transport to a target mock and chose **full match**, with
section names **abbreviated** (full name on hover) to survive songs with many sections.

### Target layout
```
[↺5] (▶) [5↻]   [In][V1][Pre][ Chorus ][V2]…  ← section ruler (proportional, timeline-aligned)
                ███████████●░░░░░░░░░░░░       ← seeker (black fill, A/B letter flags + rust tint)   🔊──80%
2:34 /4:49  ◇Chorus  Press [space] to play     [A-B | A1:18 | B1:56 | ×]  [⟳ Repeat ◯]  SPEED 0.5x…2x  ⌄
```

### Tasks
- [x] **Section ruler** — `renderSectionRuler()`: each section a clickable segment, `left`/`width` ∝ time, 2px gaps, active = rust outline + soft fill + accent-ink, inactive = paper-2 + muted, hover = card. Replaces the flat wrapped text list.
- [x] **Abbreviated labels** — `abbreviateSection()` (Chorus 4→C4, Verse 2→V2, Section 1→S1, Bridge→Br, Intro→In, Outro→Out, …) + known-word map + fallback; full name in `title`.
- [x] **Seeker tweaks** — `renderSeeker(h, showLoop, showSectionTicks)`: ticks OFF in expanded (ruler owns structure), ON in minimized. Rust **A/B letter flag badges** at the loop boundaries.
- [x] **A/B loop pill group** — `A-B` label + ink pills `A m:ss`/`B m:ss` (muted when unset) + `×`. Dropped the repeat-icon prefix.
- [x] **Repeat → toggle switch** — track + knob (ink on / hair off), `⟳ Repeat` label. Icon `Repeat` (loop), retired `Repeat1`.
- [x] **Space hint** — `Press [space] to play/pause` with a styled `<kbd>` keycap (hidden < sm).
- [x] **SPEED label** before the speed chips.
- [x] **◇ section chip** (`Diamond` icon) by the time = current section.
- [x] **Volume → top-right** of the seeker row, plain (speaker + slider + %).
- [x] typecheck + lint clean.

Status: design pass v4 IMPLEMENTED — typecheck + lint clean. Live verification pending.

---

## Design pass v5 (fidelity polish — match the mock's *feel*)

Structure matched but look/feel was far. Fixes:
- [x] **Ruler cards** — soft-grey card look: `bg-[var(--paper-2)]` + hairline `inset 1px var(--line-2)`, font `10px`→`12px` (medium; active semibold), radius `6`→`7`, height `h-7`→`h-8`, segment gap `2`→`3px`. Active = clean `--card` bg + rust ring + accent-ink text (was flat accent-soft). Inactive segments now actually read as cards.
- [x] **Seeker section gaps** — replaced expanded SVG ticks with 3px `--card`-coloured notches *through* the line at each boundary (the "invisible parts" showing section bounds). `renderSeeker` now takes `sectionMarks: 'ticks' | 'gaps' | 'none'` — expanded `gaps`, minimized `ticks`. Gaps align with the ruler's segment gaps.
- [x] **Bottom-right grouping/font** — A/B pills `11`→`12px`, `px-2`→`px-2.5`. Repeat de-chromed (borderless, `13px`). Speeds regrouped under the `SPEED` label in a tight `gap-0.5` cluster; inactive = plain muted text, active = ink pill (was a row of bordered chips). Outer group gap `2`→`3` for cleaner separation.

Status: design pass v5 IMPLEMENTED — typecheck + lint clean. Live verification pending.
