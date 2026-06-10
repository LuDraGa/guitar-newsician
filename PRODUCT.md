# Product

## Register

product

## Users

Musicians learning songs. They arrive at an instrument or a desk with an
existing recording they want to play, and they want to take it apart to learn
it. Skill is mixed: confident players sit alongside people who can't transcribe
by ear, and the "Ask coach" affordance exists to lower the floor for the latter.

The job on any given screen: isolate the parts that matter, follow the
chords / lyrics / notation, understand how the song is built (key, tempo,
structure), and play along.

## Product Purpose

Turn any song into a workbench. WereCode ingests a track, then layers on
analysis (key, tempo, chords, structure), stem separation, lyrics alignment,
and MIDI transcription, and brings it all into a Studio where a musician can
isolate parts, read notation / lyrics / chords, navigate by song structure, and
play along on a shared-clock Web Audio transport.

Heavy compute (models, ffmpeg) runs on Modal; durable data, auth, and private
storage live in Supabase; Next/Vercel owns the product surface and
orchestration.

Success: a musician goes from "I want to play this song" to actually playing it,
faster and with less friction than transcribing by ear.

## Brand Personality

Calm, precise, warm. A tactile instrument with quiet confidence: exact where it
counts, human everywhere else. The mono, tabular-numeric transport and timecodes
earn trust through precision; the warm paper, soft shadows, and physical pill /
chip controls lower the intimidation of doing real musical work.

Voice: a knowledgeable musician friend who respects you. Not a salesperson, not
a drill sergeant, not a cheerleader. Specific and plainspoken about what the
product does.

## Anti-references

This should NOT look or feel like any of these:

1. **Cluttered legacy DAW** — Pro Tools / Ableton wall-of-knobs density. Gray,
   intimidating, engineer-only.
2. **Toy / gamified app** — cartoonish, badge-heavy, Duolingo-style
   gamification that trivializes the craft.
3. **Generic AI SaaS** — purple gradients, glass cards, the hero-metric
   template, "supercharge your workflow" copy.
4. **Sterile corporate dashboard** — cold navy-and-gray enterprise tool;
   soulless data grids.

## Design Principles

1. **The instrument disappears.** The song is the subject. Chrome recedes so
   attention stays on the music; content (waveforms, stems, notation, lyrics) is
   loud, UI is quiet.
2. **Exact where it counts, warm everywhere else.** Tabular mono precision in
   the transport and timecodes earns trust. Paper, soft shadows, and tactile
   controls carry the warmth that lowers intimidation. Neither alone is the
   brand; the tension between them is.
3. **Lower the intimidation of taking a song apart.** A learner should never
   feel like they walked into a pro studio they don't belong in. Progressive
   disclosure over wall-of-controls; the workbench reveals depth as it's needed.
4. **One calm move at a time.** A clear primary action per surface, no competing
   loud elements, and status that's legible at a glance (chips, status dots, the
   live color).
5. **Respect the craft.** A real tool for real musicians. Restraint and quality
   over novelty or gamification; never talk down to the user.

## Accessibility & Inclusion

Target **WCAG AA, plus audio-domain care**:

- 4.5:1 contrast for body text, 3:1 for large text; full keyboard navigation;
  visible focus (the existing accent focus ring).
- `prefers-reduced-motion` is respected on every animation (already the baseline
  in `globals.css`).
- **Never rely on color alone** to distinguish stems, regions, or song sections;
  pair color with label, shape, or position.
- Audio and playback state (playing, live, loading, muted/soloed) is exposed as
  text/label, not just a color or icon.
