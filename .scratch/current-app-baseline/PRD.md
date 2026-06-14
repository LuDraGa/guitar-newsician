# PRD: WereCode current app — clean product baseline

Status: ready-for-agent

> A canonical, capability-honest description of what WereCode is **today**, across
> Library, Studio, and the marketing landing, with developer surfaces fenced off.
> This is a baseline spec (the PRD the current app already implements, cleaned up),
> not a new feature build. Strategic and visual ground truth live in `PRODUCT.md`,
> `DESIGN.md`, and `docs/ARCHITECTURE.md`.

## Problem Statement

A musician past the basics wants to learn a specific recording they own. By ear,
that means transcribing chords, finding the key and tempo, picking parts out of a
dense mix, working out the words, and slowing down the hard bars by hand. It is
slow, and the floor is high enough that intermediate players stall on songs they
could otherwise play.

Separately, the product's own story has drifted out of step with what it does.
The marketing landing leads with a personalized AI coach ("Maestro") as if it
were a shipped, central capability, while inside the Studio that coach is a static
placeholder. Capability quality is uneven and undocumented: the full analysis is
genuinely good, stem separation is weak, and automatic transcription effectively
does not work, yet all three are presented as if equally finished. Developer-only
surfaces (the Pipeline inspector) sit in the same route space as the product.
There is no single, honest description of what WereCode actually delivers right
now, which makes every downstream decision (what to promise, what to fix, what to
build next) harder than it should be.

## Solution

From the musician's perspective: WereCode turns a song you own into a workbench.
You bring a recording; WereCode analyzes it (key, tempo, chords, structure),
separates it into stems, syncs the lyrics, and lays out notation, then drops all
of it into a Studio where you isolate parts, slow passages without changing pitch,
loop the bars that fight you, read chords/tab/sheet, and play along on a single
shared clock.

From the product's perspective, this PRD states that workbench cleanly and
honestly:

- **One canonical surface map.** Library (intake + organize), Studio (the
  workbench, in three modes), and the public landing — described as they actually
  behave today.
- **Capability honesty.** Full analysis is presented as reliable; stem separation
  is presented as available-but-rough; automatic transcription (MIDI/notation) is
  presented as experimental/effectively absent. No surface implies a capability is
  more finished than it is.
- **The coach is repositioned, not shipped.** The in-Studio Coach dock and the
  landing's AI-coach scene are **out of the product baseline**. Maestro survives as
  a single, forward-looking idea: a coach that will help a player learn the music
  and guide them through the Studio. **How it works and what it does are
  deliberately undefined here** and will be specified in a later PRD.
- **Developer surfaces are fenced.** The Pipeline inspector is explicitly a
  developer tool, gated behind a feature flag, never part of the musician product.

## User Stories

### Intake & Library

1. As a learner, I want to upload an audio file I own, so that I can start taking a song apart without hunting for a stream.
2. As a learner, I want the upload to show staged progress (preparing, reading length, reserving storage, uploading, finishing), so that I can trust a large file is actually moving.
3. As a learner, I want a title and artist inferred from the filename and editable before I commit, so that my library stays tidy with minimal typing.
4. As a learner, I want to attach audio to a song entry that is still missing its source, so that I can complete a previously created item rather than duplicate it.
5. As a learner, I want every song to appear as a card or list row with cover art, title, artist, duration, and last-updated time, so that I can scan my library at a glance.
6. As a learner, I want a deterministic generated cover when there is no real artwork, so that songs stay visually distinct instead of becoming a wall of gray placeholders.
7. As a learner, I want readiness chips on each song (Audio, Stems, Lyrics, Karaoke, MIDI, Analysis), so that I know what has been produced before I open the Studio.
8. As a learner, I want a status indicator (Draft, Importing, Ready, Failed, Archived) shown as a labeled dot, so that I understand a song's state without relying on color alone.
9. As a learner, I want to search my library by title, artist, album, or source, so that I can find a song quickly in a large collection.
10. As a learner, I want to switch between grid and list views, so that I can browse the way I prefer.
11. As a learner, I want to refresh the library on demand, so that I can pull the latest state after work finishes elsewhere.
12. As a learner, I want to delete a song behind a confirmation dialog, so that I do not lose work by accident.
13. As a learner, I want a clear empty state prompting me to upload my first track, so that a new library tells me what to do next.
14. As a learner, I want a song that is missing its playable source to surface that issue plainly on its card, so that I know why it will not open in the Studio yet.

### Analysis (reliable today)

15. As a learner, I want WereCode to detect the song's key and tempo, so that I can set my instrument and count before I play.
16. As a learner, I want to see the chord I am on now and what is coming next as the song plays, so that I can follow the progression in time. (The chord track comes from the full analysis and updates with the playhead as a current/next readout; chords are **not** laid out over bars/measures today.)
17. As a learner, I want the song's structure (intro, verse, chorus, bridge, etc.) detected, so that I can navigate by section instead of by raw time.
18. As a learner, I want to choose a quick or full analysis depth, so that I can trade speed for completeness when I want to.
19. As a learner, I want to re-run analysis when it is stale or wrong, so that I can refresh results after changing the source.

### Stems (available, rough today)

20. As a learner, I want the mix separated into stems (vocals, guitar, bass, drums, piano, other), so that I can hear the part I am learning on its own.
21. As a learner, I want to solo, mute, and set the level of each stem, so that I can build the exact balance I want to practice against.
22. As a learner, I want to preview a stem's level as I drag it, so that I can mix by ear.
23. As a learner, I want to be warned when a track is long enough to risk the stem-separation limits, so that I am not surprised by a failed or truncated job.
24. As a learner, I want to re-run stem separation when it is stale, so that I can refresh the stems after the source or processing pipeline changes. (Stem readiness is a single Separated / not-yet flag — there is no per-stem quality score; the "rough" caveat is an editorial honesty constraint, not a UI signal.)

### Lyrics & Karaoke

25. As a learner, I want lyrics fetched for a song, so that I do not have to type them out myself.
26. As a learner, I want lyrics aligned to the recording so they scroll in time (karaoke), so that I never lose my place while playing.
27. As a learner, I want to edit lyrics in a dedicated editor, so that I can fix wrong words or missing lines.
28. As a learner, I want to set or correct the timing of individual lines, so that the karaoke view stays in sync after I edit.
29. As a learner, I want my lyric edits to persist, so that the fix sticks the next time I open the song.
30. As a learner, I want to jump playback to a tapped lyric line, so that I can practice a specific phrase immediately.

### Notation & Guitar learner (experimental today)

31. As a guitarist, I want a Guitar learner mode with chords, tab, and sheet sub-views, so that I can read the part in whichever form suits me.
32. As a guitarist, I want a Chords practice view with chord-shape diagrams, so that I can drill shapes. (Today this sub-mode renders placeholder shapes and a placeholder progression on a fixed timer, not the song's analyzed chords — a known gap; the real, analysis-driven chord readout lives in story 16.)
33. As a guitarist, I want tab and standard notation rendered from the transcription when it exists, so that I can read the part note for note.
34. As a learner, I want notation surfaces to be honest when transcription has not produced usable output, so that I am guided to what does work instead of staring at an empty score.

### Transport & practice

35. As a learner, I want a single transport with play/pause and seek that drives the source and all stems on one shared clock, so that nothing drifts out of sync.
36. As a learner, I want to slow a passage down without changing its pitch, so that I can learn fast parts at a manageable speed.
37. As a learner, I want fixed, evenly spaced speed stops from 0.5× to 2× with 1× as home, so that speed changes are predictable and easy to return from.
38. As a learner, I want to adjust playback volume beyond unity, so that I can hear a quiet part clearly.
39. As a learner, I want song sections shown as markers on the transport, so that I can scrub to the chorus or bridge directly.
40. As a learner, I want the active section to read clearly as I play, so that I always know where I am in the song.
41. As a learner, I want time, tempo, and counts shown in tabular monospace, so that the readout never jitters or reflows while it ticks.
42. As a learner, I want the transport to minimize when I am editing lyrics, so that the editor has room without losing transport control.

### Studio navigation

43. As a learner, I want to open any ready song straight into its Studio from the library, so that intake and practice feel like one flow.
44. As a learner, I want a song picker when I open the Studio without a specific song, so that I can choose what to work on.
45. As a learner, I want three clear Studio modes (Karaoke, Guitar learner, Lyrics editor) on a mode switcher, so that I can move between ways of working on the same song.
46. As a learner, I want a per-song header with cover, title, artist, and key facts (key/tempo/duration), so that the essentials are always visible.
47. As a learner, I want Studio work I have done to be cached, so that reopening a song is fast and does not re-fetch everything.
48. As a learner, I want a command palette (Cmd/Ctrl+K) to search my songs and jump into a song's Studio, so that I can navigate without going back to the library.

### Landing & waitlist

49. As a prospective user, I want a public landing page that explains what WereCode does, who it is for, and roughly what it will cost, so that I can decide whether to join.
50. As a prospective user, I want the landing to describe the real workbench (stems, chords, tab, lyrics, notation, speed/loop/key), so that my expectations match the product.
51. As a prospective user, I want to join a waitlist with my email inline, so that I can sign up with minimal friction.
52. As a prospective user, I want optional profile questions (instrument, skill level, how I heard about it) after joining, so that I can share more if I want to without being forced.
53. As a prospective user, I want a site concierge that answers questions about the product (and a little general music theory), so that I can get answers without leaving the page.
54. As a visitor, I want the concierge to stay focused on the product and name itself (Octavia) only if I ask, so that the page is helpful without being gimmicky.

### Maestro (forward-looking — not shipped in this baseline)

55. As a learner, I want a coach ("Maestro") that helps me learn the music and guides me through the Studio, so that I have a knowledgeable musician's help when I get stuck. (Direction only; how it works and what it does are intentionally undefined in this PRD and will be specified separately.)

### Developer / Pipeline (feature-flagged, not part of the product)

56. As a developer, I want a Pipeline inspector listing jobs and assets, so that I can debug the processing pipeline locally.
57. As a developer, I want to filter jobs by song, job type, endpoint, and status, so that I can find a specific run.
58. As a developer, I want to inspect a job's request, response, and diagnostics, so that I can see why a stage succeeded or failed.
59. As a developer, I want the Pipeline route auto-enabled in local `next dev` and hidden everywhere else unless explicitly turned on, so that it never leaks into the musician product.
60. As a developer, I want a local-only YouTube download intake behind its own flag, so that I can seed test songs in development without a production download path.

### Cross-cutting

61. As a logged-out visitor, I want the product app behind a soft auth gate while the public landing stays open, so that I can browse the pitch freely but sign in to use the workbench.
62. As any user, I want long-running work (separation, analysis, alignment, transcription) to run as tracked jobs with progress and clear failure messages, so that I am never left guessing whether something is still working.
63. As any user, I want a stage to be marked stale when its inputs change, so that I know when to re-run rather than trusting old output.
64. As any user, I want every status conveyed by a text label as well as color, so that the interface works for me regardless of color perception.
65. As any user, I want animations to respect reduced-motion preferences, so that the product is comfortable to use.

## Implementation Decisions

### Runtime split (as built)

- **Next/Vercel** owns the product surface and orchestration: UI routes, Supabase
  auth/session handling, song/asset/job/lyrics/edit/arrangement state, signed
  storage URLs, and the workflow routes under `/api/workflows/*`.
- **Supabase** owns durable rows (the `werecode` schema), Google-authenticated
  users, owner-scoped RLS, and three private buckets (`werecode-sources`,
  `werecode-artifacts`, `werecode-previews`).
- **Modal** owns heavy compute only (analysis, separation, lyrics alignment, MIDI
  transcription, MusicXML conversion).
- **Local Python backend** is development-only and exists solely for YouTube
  download; it must not grow product CRUD, analysis, stems, lyrics, MIDI, AI
  editing, storage, or auth (those belong to Next/Supabase or Modal).

### Surface map

- `/` — marketing landing (public, no gate).
- `/app/library` — Library.
- `/app/studio` — Studio picker; `/app/studio/[songId]` — per-song Studio.
- `/app/pipeline` — developer-only Pipeline inspector (flagged).
- A single soft auth gate covers `/app/*`; the landing is never gated. Auth is
  governed by `NEXT_PUBLIC_AUTH_ENABLED`, with a dev-identity path for local work.

### Data model (as built)

- A **song** carries denormalized readiness flags (`has_audio`,
  `has_normalized_audio`, `has_stems`, `has_analysis`, `has_plain_lyrics`,
  `has_synced_lyrics`, `has_midi`) and a status (`draft` / `importing` / `ready` /
  `failed` / `archived`). The Library's readiness chips and status dots derive
  directly from these.
- **Assets** are typed by `kind` (source/normalized/preview audio; per-stem audio
  and a stems manifest; `analysis_json`; plain/LRC/alignment lyrics; `midi`,
  `note_events`, `musicxml`, `tab_musicxml`; waveform/spectrogram). Each asset can
  carry a `pipeline_version`, which drives staleness.
- **Jobs** track every long-running stage (`download`, `probe`, `normalize`,
  `convert`, `separate`, `analyze`, `lyrics_fetch`, `lyrics_align`,
  `midi_transcribe`, `midi_analyze`, `midi_to_musicxml`, `midi_edit_*`) with
  status, progress, message, request/response payloads, and diagnostics.
- **Analysis results**, **lyrics rows** (plain / LRC / alignment), and **MIDI edit
  sessions** are first-class rows. Versioning is tracked via song-version kinds and
  per-asset `pipeline_version`.

### Workflow orchestration (as built)

- Next creates a job, signs the storage URLs it needs, calls Modal through a single
  chokepoint (`modalFetch`), persists the returned artifacts to Supabase Storage,
  and updates the Supabase rows. Jobs can run async and be advanced by polling;
  stages started before a reload (or in another tab) are reconciled into the
  Studio's busy state so the UI reflects work it did not itself start.
- **Stage staleness** is computed by comparing an asset's `pipeline_version`
  against the current pipeline version for its stage; stale stages surface a
  re-run affordance.

### Capability status (must be reflected honestly in copy and empty states)

- **Full analysis (key, tempo, chords, structure): reliable.** Presented as the
  dependable core.
- **Stem separation: available but rough.** Presented as usable for isolating a
  part, not as clean studio stems; quality caveats are acceptable to state.
- **Automatic transcription (MIDI → tab/sheet notation): experimental /
  effectively absent.** Notation surfaces must degrade gracefully and must not
  imply finished, accurate transcription. Where transcription has not produced
  usable output, the Guitar learner mode guides the player to what does work
  (chords, stems, structure) instead of presenting an empty or misleading score.

### Studio (as built)

- Three modes via a mode switcher: **Karaoke** (synced lyrics + stems mix),
  **Guitar learner** (chords / tab / sheet sub-modes), **Lyrics editor** (edit +
  time lines). All three operate on the same loaded song.
- A **shared-clock Web Audio transport** drives the source and all active stems
  together. Speed changes are **pitch-preserving** and snap to fixed, evenly spaced
  stops (`0.5, 0.75, 1, 1.5, 1.75, 2`) with 1× centered as home; volume extends
  past unity. Section markers come from analysis. Every time/tempo/count is set in
  tabular monospace so the readout never reflows.
- The **stems mixer** exposes solo / mute / level per stem with live level preview.
  Stem readiness is a single binary flag (`has_stems`); there is no per-stem
  quality score. Separation can be re-run when its stage is stale, parallel to
  analysis.
- **Chords: detection is solid, rendering is partial.** The full analysis produces
  a timed chord track. The Studio surfaces it as a **current/next-chord readout**
  that follows the playhead in the Karaoke view (and says so plainly when analysis
  exists but yields no timed chord track). Chords are **not** laid out over
  bars/measures. Separately, the Guitar learner's **Chords** sub-mode renders
  **placeholder** chord-shape diagrams and a placeholder progression on a fixed
  timer — not the song's analyzed chords. Both are known gaps to close in a later
  PRD, not part of this baseline.

### The coach: present in code, out of the product baseline

- A static **Coach dock** exists in the Studio code today (per-mode canned
  suggestions and a non-functional input), and the landing carries a dedicated
  AI-coach scene. **Both are excluded from this baseline.** The coach is not
  productized here: the Studio is described and shipped without it, and the
  landing does not claim a working AI coach.
- **Maestro** is retained only as a forward-looking concept — a coach that helps a
  player learn the music and guides them through the Studio. Its mechanics and
  scope are intentionally left undefined and deferred to a future PRD.

### Landing (as built, minus the coach claim)

- Server-rendered marketing page with hero, the bench (what the workbench does),
  fit + FAQ, and a final CTA; contact folds into the footer. Waitlist capture
  writes to Supabase and supports an inline email step plus optional profile
  questions. A client-side **concierge** answers product questions from a small
  keyword-scored knowledge base and reveals its name (Octavia) only on request.
- The AI-coach scene's claims are removed from the capability story; the page sells
  the real workbench (stems, chords, tab, lyrics, notation, speed/loop/key).

### Feature flags & naming

- **Pipeline** is gated by `isPipelineEnabled()` — on automatically in local
  `next dev`, otherwise only when `NEXT_PUBLIC_ENABLE_PIPELINE=true`. The nav item
  and the route guard read the same helper so they never disagree.
- **Local YouTube download** is gated by
  `NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD` and is development-only.
- **Naming:** the product is **WereCode** across the repo and architecture; the
  public site brands as **Octave**. WereCode is the canonical product name in this
  PRD; Octave is noted as the marketing name. The inconsistency is documented, not
  resolved here.

## Testing Decisions

A good test here asserts **external behavior at a seam**, never implementation
detail: given an input request or audio/analysis fixture, assert on the response,
the persisted rows/assets, or the rendered output — not on private functions,
internal state shape, or call order. Tests should survive a refactor that keeps
behavior constant.

**There is no test runner in the repo today** (no Vitest/Jest, no test files, no
test script). This PRD therefore _names the seams a suite should attach to_ and
recommends a runner, but does **not** scope writing tests or introducing the
harness — that is a separate initiative.

Seams, highest first:

1. **`modalFetch` (the single Modal chokepoint).** Mocking it lets the workflow
   orchestration be exercised end to end without GPU calls — the highest-value
   boundary for testing separation/analysis/alignment/transcription flows and their
   job + asset side effects.
2. **`/api/workflows/*` and `/api/songs` · `/api/jobs` route handlers.** The server
   seam for orchestration and CRUD. The Supabase client is injected via the
   per-request WereCode context, so it can be substituted with a fake for
   row/asset assertions.
3. **Pure domain libraries** — analysis overview (chord/section derivation), the
   pipeline-version staleness computation, LRC parsing, MIDI and MusicXML helpers,
   and the Library/Studio utility functions. These are I/O-free and the cheapest,
   most stable place to start.
4. **Feature components** (Library and Studio clients) via a component testing
   library with `fetch` mocked — lowest priority, for the interaction flows that
   pure functions cannot cover.

Recommended runner: **Vitest** (fits the Next + TypeScript toolchain). Prior art:
none exists in-repo yet, so the first ring should model the pure-library seam
(deterministic, no mocks), then move outward to `modalFetch`-mocked route tests.

## Out of Scope

- **Shipping the AI coach.** The static Coach dock and the landing's AI-coach scene
  are excluded; Maestro is a forward-looking concept only. Its mechanics belong to
  a later PRD.
- **Fixing capability quality.** Improving stem-separation quality and building
  real, accurate MIDI/notation transcription are acknowledged gaps, not work scoped
  here. This PRD only requires that the surfaces _describe_ those capabilities
  honestly.
- **Introducing the test harness.** Per the decision above, this PRD documents
  seams only.
- **Resolving the WereCode/Octave naming split**, pricing/billing, new instrument
  coverage beyond what exists, a production (non-local) download path, and any
  redesign of the committed "Luthier's Bench" design system.
- **The local Python backend's scope.** It stays development-only for YouTube
  download and must not absorb product responsibilities.

## Further Notes

- **Capability honesty is the throughline.** Wherever a surface (landing copy,
  Studio empty states, readiness chips) implies a capability, it must match
  reality: analysis dependable, stems rough, transcription experimental/absent.
  This is the single most load-bearing editorial constraint in the PRD.
- **Maestro, deliberately vague.** The one Maestro mention is intentional and
  minimal: a coach that helps you learn the music and guides you through the
  Studio. Resist specifying triggers, surfaces, or actions here — that is the next
  PRD's job.
- **Developer surfaces stay fenced.** The Pipeline inspector and local YouTube
  download are real and useful, but they are developer tooling behind flags, never
  part of the musician product. Keep them visible to developers and invisible to
  users.
- **Grounding docs.** `PRODUCT.md` (the why — users, purpose, brand, principles),
  `DESIGN.md` (the how-it-looks — the Luthier's Bench system), and
  `docs/ARCHITECTURE.md` (the runtime split) are the upstream sources of truth this
  baseline must stay consistent with.
- **Next step.** This baseline can be sliced into independently buildable issues
  with `/to-issues` once the surface map and capability framing are agreed.
