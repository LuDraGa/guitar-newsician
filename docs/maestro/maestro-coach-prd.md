# Maestro (MusicCoach) — Product PRD

| | |
|---|---|
| **Status** | Aligned on design · pre-implementation |
| **Date** | 2026-06-14 |
| **Origin** | Design-alignment session over the Maestro POC (`modal_apis/Maestro`) |
| **Home** | WereCode (this repo) — `docs/maestro/`; also staged at `.scratch/maestro-coach/PRD.md` for `/to-issues` |
| **Framing** | **PRODUCT** — *what* Maestro is and *why* it matters to a learner. Internals (stores, graph, agent topology) live in [maestro-agent-architecture.md](maestro-agent-architecture.md). The build/prep flow lives in [maestro-build-flow.md](maestro-build-flow.md). |
| **Builds on** | The current-app baseline ([`.scratch/current-app-baseline/PRD.md`](../../.scratch/current-app-baseline/PRD.md)), whose story 55 defers Maestro to "a later PRD." This is that later PRD. |

---

## Problem Statement

A guitar learner who wants to play a specific song has no structured, personal way to get there. Tabs and tutorials are generic, one-size-fits-all, and disconnected from how a person actually learns a song: they don't tell you *what to focus on*, *in what order*, or *at what difficulty for your level*. They don't separate "what the guitar should play" from "everything happening in the full mix." They don't adapt when you're confused, don't remember your level between sessions, and can't take a dense multi-instrument recording and hand you something playable on one guitar.

Maestro today (the POC) can *answer questions* about a song — its key, chords, sections, tempo, MIDI parts — but it **answers; it does not teach**. It doesn't sequence concepts, set goals, generate practice, adapt to a learner, or build an arrangement. The gap is the difference between a reference tool and a coach.

## Solution

Maestro is a **guitar-learning coach** that turns a song's pre-computed musical analysis into **personalized, structured coaching**. Instead of answering trivia from flat facts, it teaches from a stored, inspectable understanding of the song — and it gets progressively more capable as a coach over time.

The learner experiences Maestro as a coach that:

- **Briefs** the song section by section — what's happening, who's doing what, and *what you as a guitarist should care about here*.
- **Sequences** what to learn first, with honest difficulty estimates and flagged trouble spots.
- **Generates** focused practice material for the hard parts, and can simplify chords to get you playing sooner.
- **Adapts** to you — your level, your pace, your recurring doubts — re-explaining a concept a different way when it doesn't land, and revealing complexity progressively.
- **Arranges** the full multi-instrument song into a single-guitar version, from an easy first pass up to an embellished fingerstyle arrangement, reusing everything you already learned.

Crucially, Maestro is **honest**: it surfaces how confident it is and what evidence backs a claim, because real music analysis is uncertain.

## Who Maestro Is For (Actors)

- **Primary — the guitar learner.** Wants to *play this song*, at their level, with a clear path and a coach that adapts.
- **Secondary — the developer/operator.** Builds and evolves the coach behind developer feature flags; needs to inspect the coach's stored understanding and reasoning, and to feed it high-quality song data.

## Product Capabilities (the coach's progression)

Maestro grows as a coach. Each capability is *more coach-like* than the last and reuses the ones before it. Today's baseline is the bottom rung.

| Stage | The coach can… | What the learner gets |
|---|---|---|
| **Baseline (today)** | *answer* | Correct answers about key / chords / sections / tempo / MIDI parts |
| **1 — Section briefing** | *brief* | A section-by-section guitar briefing: what's happening, each instrument's role, what to focus on, and the confidence behind it |
| **2 — Learning path** | *sequence* | An ordered, difficulty-ranked "what to learn first," with trouble spots flagged |
| **3 — Drills** | *generate* | Targeted practice exercises for specific hard parts; chord simplification (e.g. C7→C) |
| **4 — Adaptive coaching** | *adapt* | Teaching tuned to the learner's level, pace, prior experience, and doubts; progressive disclosure |
| **5 — Solo-guitar arrangement** | *arrange* | The whole song rearranged for one guitar, easy → embellished, reusing earlier learning |

## User Stories

**Section briefing**
1. As a guitar learner, I want the song broken into its sections (intro/verse/chorus/bridge), so I can see its overall shape before I start.
2. As a guitar learner, I want each section explained in terms of what's musically happening, so I understand the song instead of just memorizing finger positions.
3. As a guitar learner, I want to know which instrument is doing what in each section, so I can tell the guitar's job apart from the rest of the mix.
4. As a guitar learner, I want the coach to tell me what *I as a guitarist* should focus on in each section, so I spend effort where it matters.
5. As a guitar learner, I want to see how confident the coach is and what evidence it's based on, so I know when to trust it and when to double-check.

**Learning path / sequencing**
6. As a guitar learner, I want to be told what to learn first, so I'm not overwhelmed by the whole song at once.
7. As a guitar learner, I want a difficulty estimate per part, so I can plan my practice realistically.
8. As a guitar learner, I want the hard transitions flagged (e.g. a tricky change at a specific bar), so I can prepare for them.
9. As a guitar learner, I want an ordered path from easiest to hardest, so each step builds on the last.

**Drills / practice material**
10. As a guitar learner, I want a focused exercise for a specific hard part, so I can drill it in isolation.
11. As a guitar learner, I want drills that let me loop a few bars or take them slowly, so I can build the part gradually.
12. As a guitar learner, I want the coach to simplify a chord when I'm starting (C7→C, G7→G), so I can play the song sooner.
13. As a guitar learner, I want to progress from simplified to full voicings once the rhythm and feel are solid, so I keep improving without losing momentum.

**Adaptive coaching**
14. As a guitar learner, I want the coach to remember my level and goals, so I don't re-explain myself each session.
15. As a guitar learner, I want the coach to adapt to my pace, since I learn some things faster than others.
16. As a guitar learner, when I'm confused, I want the same concept re-explained a different way, so it finally clicks.
17. As a guitar learner, I want the coach to teach using things I already know ("like a blues turnaround"), so new ideas connect to my experience.
18. As a guitar learner, I want complexity revealed progressively as I'm ready, so I'm never buried in detail I can't use yet.
19. As a guitar learner, I want the coach to notice my recurring doubts and mistakes from our conversation, so it can target my weak spots.

**Solo-guitar arrangement**
20. As a guitar learner, I want the full multi-instrument song turned into a single-guitar arrangement, so I can play the whole piece myself.
21. As a guitar learner, I want the arrangement offered from easy to embellished, so I can grow into the full version.
22. As a guitar learner, I want the arrangement to reuse the chords and lead lines I already learned, so my earlier practice pays off.
23. As a guitar learner, I want expressive lead fills woven between the chords, so my playing sounds fuller and more musical.

**Trust & experience**
24. As a guitar learner, I want the coach to teach from one consistent understanding of the song, so its advice doesn't contradict itself between questions.
25. As a guitar learner, I want to ask plain-language follow-ups ("why does this chord feel tense?"), so I can learn by curiosity.
26. As a guitar learner, I want the coach to admit uncertainty when the analysis is ambiguous, so I'm not misled by overconfident answers.

**Developer / operator**
27. As a developer, I want new coach capabilities behind feature flags, so I can build and test them without exposing them on prod.
28. As a developer, I want to inspect the coach's stored understanding and its reasoning trace, so I can debug and improve its teaching.
29. As a developer, I want to upload custom, high-quality song data (stems, MIDI, per-part analysis), so the coach works from accurate material instead of lossy auto-transcription.

## Product Principles

- **Teaches from understanding, not flat facts.** Coaching is grounded in a stored, inspectable comprehension of the song that stays consistent across questions.
- **Personalized.** The coach knows this learner — level, goals, pace, prior experience, recurring doubts — and tailors what and how it teaches.
- **Honest about confidence.** Music analysis is uncertain and sometimes conflicting; the coach surfaces confidence and evidence rather than bluffing.
- **Guitar-first.** It always distinguishes *"what should I play on guitar here"* from *"what's happening in the full mix."*
- **Progressive disclosure.** Complexity is revealed at the learner's pace — easy chords before embellishments, one section before the whole arrangement.
- **Compounding.** Every capability builds on the ones before it; earlier learning (chords, structure, lead lines) is reused in later stages, up to the final arrangement.

## Out of Scope

- **Lyrics / sing-along coaching.** Finding lyric–chord transitions and singing while playing is a deliberate later add-on, not in the current plan.
- **Listening to the learner play.** Maestro does **not** ingest the learner's audio or MIDI performance. The "learner loop" is driven by the **dialogue** — the learner's queries, doubts, issues, and flaws expressed in conversation — not by grading a live performance.
- **Cross-student self-improvement (meta-layer).** The coach getting better at teaching *across all students* is a desired end-state but deferred; it depends on instrumentation + evaluation + LLM-as-judge that we are intentionally leaving out for now.
- **Building the analysis / transcription pipeline.** Maestro consumes *pre-computed* analysis and aligned MIDI. Producing that data (and the custom-upload path that makes it accurate) is prep work, covered in the build-flow doc — not a Maestro coaching capability.

## What Success Looks Like

The first and defining success: **the coach stops answering from flat facts and starts teaching from a stored, inspectable, section-and-role understanding of the song.** From there, each stage is "won" when the coach demonstrably does something the previous stage could not — sequence a path, generate a drill, adapt to a learner, arrange for solo guitar — while reusing what came before.

## Further Notes

- Maestro began as a single-track **Q&A analyst** (the POC). This PRD describes its intended evolution into a coach; the baseline Q&A is the foundation the first capability builds on, not a throwaway.
- The capability stages map to a concrete, testable **vertical-slice roadmap** (S1–S5 + deferred meta) in the architecture doc. Each slice ships a visibly better coach.
- This PRD is also staged at [`.scratch/maestro-coach/PRD.md`](../../.scratch/maestro-coach/PRD.md) (a thin pointer) so it can be sliced into issues with `/to-issues` alongside other feature PRDs.
