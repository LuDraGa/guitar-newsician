# Execution Doc: Landing Page Alignment

**Date**: 2026-06-16
**Status**: In Progress
**Owner**: Codex

## Objective

Reach shared product, narrative, and design alignment before rebuilding the Octave landing page.

## Context

The current landing page is structurally useful but misses the desired positioning. It frames Octave as a workstation or bench for taking songs apart, while the intended story is more alive: Maestro is an AI music coach that understands a song deeply and guides a learner from hearing it to playing it on guitar.

The alignment source is the Gemini chat in `/Users/abhiroopprasad/Downloads/Octave-Guitar-Learning-AI-Coach (1).md`, plus the existing Maestro product docs under `docs/maestro/`.

## Plan

- [x] Establish the narrative hierarchy between Octave and Maestro.
- [x] Document the deferred hero-media direction.
- [x] Resolve the hero experience maturity stance.
- [x] Resolve the hero tone direction.
- [x] Resolve the hero emotional priority.
- [x] Resolve the learner's starting desire.
- [x] Resolve the hero promise structure.
- [x] Resolve the primary audience.
- [x] Resolve the guitar-first stance.
- [x] Resolve the hero copy direction.
- [x] Resolve the landing-page flow.
- [x] Resolve the waitlist segmentation and CTA direction.
- [x] Resolve artifact/songbook role.
- [x] Resolve the no-performance-recording personalization boundary.
- [x] Resolve product concierge role.
- [x] Resolve final conversion emotion.
- [x] Convert the aligned direction into implementation tasks.
- [x] Implement a Maestro-led hero with a code-rendered aspirational proof mock for the future prerecorded video.
- [x] Reorder the page so Maestro leads before the songbook/artifact proof section.
- [x] Keep stems, chords, tab, lyrics, sheet music, and MIDI/piano-roll visible as reusable songbook surfaces.
- [x] Add Maestro capability bands for decoding, guitar path, practice, arrangement, and feel transformation.
- [x] Replace strong public personalization claims with structured guidance from song evidence and user questions.
- [x] Align Octavia as a product-only concierge in site copy and knowledge-base answers.
- [x] Add dual access tracks for active beta shaping and release-ready access.
- [x] Verify with `pnpm typecheck`, `pnpm lint`, and `pnpm build` under Node 22.20.0.
- [x] Browser-verify the redesigned landing page.

## Progress Log

### 2026-06-16 14:08

**Action**: Captured the first settled narrative decision.
**Result**: `CONTEXT.md` now defines Octave as the system and Maestro as the AI music coach / narrative protagonist.
**Notes**: Avoid presenting Maestro as a generic chatbot, assistant, or fallback help feature.

---

### 2026-06-16 14:08

**Action**: Captured the deferred hero-media direction.
**Result**: The landing hero should eventually show Maestro actively working on a song through a prerecorded hero video or highly produced demo sequence.
**Notes**: The user expects this to be explored later with the HeyGen / Hyperframes workflow. Do not block current alignment on producing that asset now.

---

### 2026-06-16 14:10

**Action**: Captured the hero maturity stance.
**Result**: The hero may present aspirational proof of the intended Maestro experience, while beta/product maturity honesty belongs in the waitlist and access framing.
**Notes**: The page should sell the destination experience without pretending every future capability is already polished in production.

---

### 2026-06-16 14:11

**Action**: Captured the hero tone direction.
**Result**: Hero copy should feel like a musician's invitation into an intelligent session, not a SaaS utility promise.
**Notes**: Avoid flat constructions like "upload a song, get tabs and coaching." Maestro should read as a rigorous AI musician-coach in the room.

---

### 2026-06-16 14:12

**Action**: Captured the landing-page narrative flow.
**Result**: The page should move from the learner's desire, to Maestro studying the song, to musical evidence appearing, to guided practice, to arrangement/mood transformation, and finally to a segmented access choice.
**Notes**: Feature sections should earn their place by supporting this story rather than appearing as a generic capability list.

---

### 2026-06-16 14:13

**Action**: Captured the hero emotional priority.
**Result**: The first screen should lead with wonder, then immediately support it with trust.
**Notes**: The hero should not primarily sell speed, ease, or productivity. It should make the visitor feel the song is about to open up in front of them, then prove rigor through concrete musical artifacts.

---

### 2026-06-16 14:14

**Action**: Captured the learner's starting desire.
**Result**: The hero should start from the specific pull of hearing a song and wishing to play it too, demystify it, and experience it better through musical understanding.
**Notes**: "A song you love" is too generic, but "feel it by playing it" is too sentimental. The direction is closer to an earworm plus aspiration: the listener wants Maestro to help them understand what is happening in the music and bring that understanding onto guitar.

---

### 2026-06-16 14:15

**Action**: Captured the play-vs-understanding tension.
**Result**: "Understand" should not become the whole hook. Most players are first pulled by wanting to play the song; Maestro's deep understanding is the reason that path feels rigorous, personal, and credible.
**Notes**: Final hierarchy: playing is the desire; understanding is the differentiator; Maestro is the guide that connects them.

---

### 2026-06-16 14:16

**Action**: Captured the two-beat hero promise.
**Result**: The hero should first name the desire to play the song the learner keeps hearing, then immediately explain that Maestro understands the music deeply enough to guide them there.
**Notes**: This prevents "understanding" from becoming academic while still differentiating Octave from tab sites and DAW-like tools.

---

### 2026-06-16 14:17

**Action**: Captured the primary audience.
**Result**: The page should speak primarily to guitar players past the basics: learners who can play some chords and have enough context for notes, chords, tab/sheet music, and multi-instrument arrangements to make sense.
**Notes**: This is not a hard cutoff. Avoid clinical exclusion copy; imply readiness through the scenarios and product language.

---

### 2026-06-16 14:18

**Action**: Captured the guitar-first stance.
**Result**: The landing page should be explicitly guitar-first. Octave may understand the whole recording, but the primary promise is helping the guitarist play it.
**Notes**: Avoid broad "music AI for every instrument" positioning. Other instruments are context for guitar learning and arrangement.

---

### 2026-06-16 14:19

**Action**: Corrected the Duolingo/gamification stance.
**Result**: Avoid mascot, streak, and cute lesson-app flavor, but do not reject progression mechanics. Progressive learning-based gamification may belong if it creates real-time improvement inside a high-friction practice loop.
**Notes**: Duolingo remains useful as inspiration for guided progression, not as a brand style or superficial engagement layer.

---

### 2026-06-16 14:20

**Action**: Captured the public progression framing.
**Result**: The page should frame progression as Maestro choosing the next best musical move for this learner and this song, not as a fixed syllabus or generic step ladder.
**Notes**: This reinforces Maestro as a strong coach: it knows whether to simplify a voicing, isolate rhythm, loop a transition, explain harmony, or move toward an arrangement.

---

### 2026-06-16 14:21

**Action**: Captured the personalization source.
**Result**: Personalization should be framed as Maestro learning from the learner's questions and doubts around the current song first, with broader cross-song profile/history becoming more important later.
**Notes**: Avoid making personalization sound like settings, a skill-level dropdown, or a mature profile-memory system as the primary current hook.

---

### 2026-06-16 14:22

**Action**: Captured the proof style for personalization.
**Result**: Show personalization through concrete learner questions, but make the examples broad and ambitious enough to cover analysis, theory, arrangement, practice strategy, instrument role, and mood transformation.
**Notes**: Avoid a narrow set of entry-level troubleshooting prompts; that undersells Maestro's range.

---

### 2026-06-16 14:23

**Action**: Captured Maestro's public capability bands.
**Result**: Present Maestro's range through capability bands rather than a random prompt wall: decode the song, find the guitar path, practice intelligently, arrange the music, and shape the feel.
**Notes**: The bands should support example questions across beginner-to-advanced musical thinking without turning the landing page into a comprehensive feature catalog.

---

### 2026-06-16 14:24

**Action**: Captured the role of feel transformation.
**Result**: Treat mood/feel transformation as a late-page capstone or wow moment, not as an equal everyday feature in the hero.
**Notes**: The visitor should first believe Maestro understands and can arrange the song; only then should the page show it reshaping the feel through guitar arrangement.

---

### 2026-06-16 14:32

**Action**: Captured batch alignment answers for the landing redesign.
**Result**: The page direction is now Maestro-led, narrative, guitar-first, premium/minimal, and honest about product maturity primarily through FAQ/access framing.
**Notes**: The user approved the narrative arc, capability bands, late feel-transformation wow moment, two-track waitlist, and prerecorded hero video direction with an aspirational mock fallback.

---

### 2026-06-16 14:32

**Action**: Captured the artifact/songbook role.
**Result**: Stems, chords, tabs, lyrics, sheet music, and MIDI/piano roll must remain visible first-class surfaces. They are trust evidence, but also the user's songbook: material to revisit, repeat, play from, and ask further questions about after Maestro has taught the song.
**Notes**: Do not force-feed Maestro as the only way to use Octave. Maestro helps the learner understand and chunk these artifacts, but the artifacts remain directly useful.

---

### 2026-06-16 14:32

**Action**: Captured the personalization/maturity boundary.
**Result**: Do not foreground a personalization claim for now. Without recording the user's playing, "personalized coach" can create the wrong expectation that Maestro listens to and grades performance.
**Notes**: Instead, say that Maestro understands the music deeply and teaches it in a structured, proactive way. Subtly make clear Octave does not replace a music teacher; it is valuable for self-learners and for teachers guiding students.

---

### 2026-06-16 14:32

**Action**: Captured the product concierge role.
**Result**: Keep Octavia as the product-only concierge, but align its content and guardrails with the new positioning.
**Notes**: Octavia must not compete with Maestro. It answers product questions; Maestro is the in-product music coach.

---

### 2026-06-16 14:32

**Action**: Captured the final conversion emotion.
**Result**: The landing page should end on exclusivity and premium quality, not broad urgency or generic partnership language.
**Notes**: The design should be reshaped toward minimalist premium quality to support that emotion.

---

### 2026-06-16 14:34

**Action**: Closed the conceptual alignment pass.
**Result**: Hero copy direction is resolved at the strategic level: Maestro-led invitation, two-beat desire plus rigor, aspirational proof, and premium minimalist tone. Exact copy remains an implementation artifact.
**Notes**: Next useful step is converting the brief into a concrete page skeleton, draft copy, and redesign tasks.

---

### 2026-06-16 17:04

**Action**: Implemented the first landing-page redesign pass.
**Result**: The public page now leads with Maestro, uses an aspirational Maestro session mock in the hero, reorders the flow to Maestro before songbook proof, keeps the core artifacts visible, adds capability bands, adds the late feel-transformation callout, and ends with separate beta-shaping and release-access tracks.
**Notes**: Updated metadata, visible page copy, footer/nav labels, waitlist CTA copy, and Octavia's local product knowledge base. Removed public "personalized coach" framing that could imply performance recording; the FAQ now states that Maestro does not record or grade the learner's playing today.

---

### 2026-06-16 17:04

**Action**: Ran implementation checks.
**Result**: `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed using Node 22.20.0.
**Notes**: The default shell Node was 18.20.3 and the bundled Codex Node was 24.14.0; both were rejected by the repo's strict `22.x` engine, so the checks were run with `/Users/abhiroopprasad/.nvm/versions/node/v22.20.0/bin` at the front of `PATH`.

---

### 2026-06-16 17:04

**Action**: Browser-verified the redesigned landing page on the local dev server.
**Result**: Desktop hero, Maestro section, songbook section, and dual-track access section rendered without console errors or horizontal overflow. Mobile viewport also had no horizontal overflow; the concierge launcher was tightened to icon-only on mobile so it does not cover hero copy.
**Notes**: The dev server required running outside the sandbox because binding `0.0.0.0:3000` failed with `EPERM` inside the sandbox.

---

## Decisions Made

1. **Decision**: Maestro leads the landing-page story; Octave is the system that powers the experience.
   - **Rationale**: The user's intended emotional center is not generic analysis, stems, or tabs. It is an AI music coach that understands a song deeply enough to guide, explain, practice, arrange, and reshape it for guitar.
   - **Alternatives Considered**: Lead with Octave as an audio-analysis workstation; lead with feature lists; present Maestro only as a mid-page support feature.

2. **Decision**: Treat the hero media as a future produced asset, not as a blocker for this alignment pass.
   - **Rationale**: A video/demo can best show Maestro doing something active, but the exact media production path belongs to a later HeyGen / Hyperframes pass.
   - **Alternatives Considered**: Static Studio screenshot, abstract hero art, or a fully interactive hero demo built immediately.

3. **Decision**: The hero sells the intended experience as aspirational proof; beta honesty is handled later in the page.
   - **Rationale**: The landing page needs emotional force and a clear product destination, but the product is still being shaped. Separating aspiration from access framing keeps the top of page compelling without misleading early users.
   - **Alternatives Considered**: Only show current production capability; make the entire page caveat-heavy; hide the beta reality until after signup.

4. **Decision**: Use a musician-session tone for the hero and core copy.
   - **Rationale**: The intended product feels like entering a focused musical session with a rigorous AI coach, not using a generic SaaS utility that emits tabs.
   - **Alternatives Considered**: Direct feature-led SaaS copy; DAW/workstation language; gamified streak-app language.

5. **Decision**: Structure the landing page as a narrative arc from desire to access choice.
   - **Rationale**: The current page has useful sections but does not make the features feel inevitable. A story-led flow turns stems, tabs, rhythm, coaching, and arrangement into evidence of Maestro's understanding.
   - **Alternatives Considered**: Feature grid first; current hero -> bench -> coach -> FAQ flow; waitlist-first minimal launch page.

6. **Decision**: The hero's first emotional job is wonder, followed immediately by trust.
   - **Rationale**: The product's strongest pull is the feeling that an AI musician can understand a loved song and guide the learner into playing it. Concrete artifacts and capability proof should quickly make that wonder credible.
   - **Alternatives Considered**: Lead with relief from manual learning; lead with trust through technical proof; lead with speed or ease.

7. **Decision**: The hero starts from the learner wanting to demystify and experience the song better through guitar.
   - **Rationale**: The page should not reduce the desire to "learn a song faster," but it should also avoid over-sentimental language. The stronger emotional truth is hearing music and wanting Maestro to reveal what is happening so the learner can understand and play it.
   - **Alternatives Considered**: "A song you love"; "a song stuck in your head"; "feel it by playing it"; purely practical "learn any song" framing.

8. **Decision**: Lead the hero with the desire to play; use Maestro's musical understanding as the differentiator.
   - **Rationale**: Most players are not initially pulled by abstract understanding. They want to get the song onto the instrument. Understanding matters because it makes the path more rigorous, adaptive, and musically satisfying than tabs alone.
   - **Alternatives Considered**: Make "understand" the central hero verb; lead with "learn"; lead with emotional "feel" language.

9. **Decision**: Use a two-beat hero promise.
   - **Rationale**: The first beat creates desire by naming the song the learner wants to play. The second beat builds trust by explaining that Maestro's musical understanding is what guides the path.
   - **Alternatives Considered**: One-line tagline only; feature-led subhead; technical proof before desire.

10. **Decision**: Target players past the basics as the primary audience.
   - **Rationale**: Octave assumes the learner has enough musical context to benefit from chords, tabs, sheet music, instrument roles, and arrangements, without requiring professional skill.
   - **Alternatives Considered**: Absolute beginners; pro musicians; all musicians equally.

11. **Decision**: Keep the landing page guitar-first.
   - **Rationale**: A sharp guitar promise gives the page focus. The full recording still matters because Maestro needs to understand instrument roles, harmony, melody, and rhythm in context.
   - **Alternatives Considered**: Generic music AI; equal positioning for vocals, bass, drums, and keys.

12. **Decision**: Separate progression mechanics from superficial gamification.
   - **Rationale**: Music practice is high friction, so real-time improvement, progressive learning, and visible mastery can create value. Mascot, streak, and cute lesson-app language would distort the brand.
   - **Alternatives Considered**: Reject all gamification; adopt Duolingo-style brand cues directly.

13. **Decision**: Present progression as Maestro's next best move.
   - **Rationale**: A great coach does not force a fixed curriculum onto every learner. Maestro should appear to understand the song and the learner well enough to choose the next useful musical action.
   - **Alternatives Considered**: Fixed learning ladder; explicit gamification language; generic practice checklist.

14. **Decision**: Frame personalization as song-dialogue context first, profile history later.
   - **Rationale**: Maestro adapts through the learner's questions, doubts, and progress on the song. Broader learner history is valuable, but should not be the main public proof point until it is more mature.
   - **Alternatives Considered**: Profile settings; explicit preference customization; primary cross-song memory positioning.

15. **Decision**: Demonstrate personalization through learner questions with a wide capability range.
   - **Rationale**: Concrete questions make adaptation credible, but basic examples alone make Maestro look like a beginner helper. The prompt range should show sophisticated musician-coach judgment.
   - **Alternatives Considered**: Abstract "personalized AI" claims; only entry-level questions; only technical feature proof.

16. **Decision**: Structure Maestro's breadth as capability bands.
   - **Rationale**: Bands show range without a prompt wall. They also let the page move from understanding the song to guitar path, practice, arrangement, and feel.
   - **Alternatives Considered**: One long prompt gallery; one generic Maestro chat demo; exhaustive feature matrix.

17. **Decision**: Use feel transformation as a late-page wow moment.
   - **Rationale**: Asking Maestro to change a song's mood through the guitar part is powerful, but it needs prior proof of music understanding and arrangement capability to feel credible.
   - **Alternatives Considered**: Lead the hero with mood transformation; present it as a routine feature beside stems and tabs; omit it until after launch.

18. **Decision**: Keep musical artifacts visible as songbook surfaces and trust proof.
   - **Rationale**: Octave is not only a Maestro conversation. Stems, chords, tabs, lyrics, sheet music, and MIDI/piano roll are the materials the learner comes back to for repetition, playing, review, and further questions.
   - **Alternatives Considered**: Hide artifacts behind Maestro; present artifacts only as technical proof; lead with artifacts as the whole product.

19. **Decision**: Avoid a public personalization claim for now.
   - **Rationale**: Without recording the user's playing, "personalized coach" can imply performance listening/grading. The stronger current claim is that Maestro understands the music deeply and teaches it in a structured, proactive way.
   - **Alternatives Considered**: Lead with personalized AI coach; imply performance feedback; make profile memory the main differentiator.

20. **Decision**: Position Octave as a complement to teachers, not a replacement.
   - **Rationale**: Octave is valuable for self-learners and for music teachers guiding students, but claiming to replace teachers would set the wrong expectation and weaken trust.
   - **Alternatives Considered**: Teacher replacement positioning; self-learner-only positioning.

21. **Decision**: Keep Octavia as a product-only concierge and align its guardrails.
   - **Rationale**: Octavia can help visitors understand the product, but the page must preserve the distinction between product concierge and in-product music coach.
   - **Alternatives Considered**: Remove Octavia; blur Octavia with Maestro; leave current content unchanged.

22. **Decision**: End on premium exclusivity.
   - **Rationale**: The waitlist should feel like access to a carefully shaped, high-quality musical room, not a generic SaaS signup funnel.
   - **Alternatives Considered**: Urgency; partnership/co-builder emotion only; broad open signup.

## References

- [CONTEXT.md](../../CONTEXT.md)
- [Maestro product PRD](../maestro/maestro-coach-prd.md)
- `/Users/abhiroopprasad/Downloads/Octave-Guitar-Learning-AI-Coach (1).md`
