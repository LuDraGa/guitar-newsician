# Maestro — Query Playbook (the user's experience)

> **Living doc + target-state spec.** For a representative spread of queries, this is **what the learner experiences**: the workflow running, the tools/activity surfaced, the answer, and the **cited references** behind it. Its companion, [maestro-task-resolution.md](maestro-task-resolution.md), traces the *same queries* step-by-step in internal/domain terms (harness · capabilities · tools · stores · invariants). Same query numbers in both — read them side by side.
>
> **This is target-state**, not all-built. Each entry tags its **build state**. Today only baseline reactive retrieval (Q1-shaped) exists; the rest specify how it *should* feel as the axes land.
>
> **Created:** 2026-06-27. **Owner:** Maestro build. Grounded in [maestro-domain-model.md](maestro-domain-model.md).

---

## How to read each entry

- **The ask** — what the learner types (or does, for proactive).
- **Stance** — Answer · Clarify · Abstain-and-point · Refuse-in-role (Maestro *never* fabricates).
- **What the learner sees** — the surfaced experience: progress/activity, HITL prompts, the answer.
- **Citations** — the typed provenance behind the answer. **Flag-gated on the UI** — hidden for most learners, visible to power users / testers. Source types: `musical-concept` · `song-data` · `learner/env` · `external`.

---

## Q1 — "What key is this song in, and is it consistent across the parts?"

**Stance:** Answer · **Build state:** ✅ today (baseline)

**What the learner sees:**
- A brief activity flicker (the Runtime rail shows a key lookup + a parts check — no ten-stem dump).
- The answer: *"One global key — G major (teaching), though the detected key leans E minor (its relative), so confidence is moderate. The parts share it; the bass is monophonic so I read it from its pitch content rather than a chord label, and it agrees."*

**Citations (flag on):**
- `song-data` — teaching_key=G major, detected_key=E minor (conflict, moderate confidence); bass stem dominant pitch-classes.
- `musical-concept` — relative major/minor (G / Em share a key signature).

---

## Q2 — "Walk me through the chorus — what's happening, and what should I focus on as a guitarist?"

**Stance:** Answer · **Build state:** 🎯 target (Slice 1)

**What the learner sees:**
- A short staged progress: *reading the section → interpreting → checking.*
- A section brief: what's happening musically, each instrument's role, and **the guitar's job here** ("the rhythm guitar holds the IV-I drive; you carry the lift, not the melody"), with a visible **confidence** note where the analysis is thin.

**Citations (flag on):**
- `song-data` — chorus section bounds, per-part activity, chord roots, dynamics (crest → "fuller than the verse").
- `musical-concept` — the IV-I plagal motion named as the "lift."

---

## Q3 — "This chorus gives me the same lift as [Song B]'s chorus — why, and how do I get it on guitar?"

**Stance:** Answer *(or Abstain-and-point if Song B isn't analyzed)* · **Build state:** 🎯 target (cross-song)

**What the learner sees (happy path):**
- Progress shows **two songs being read and compared**, then a synthesis.
- *"Both lifts come from the same device: a IV→I plagal motion under a register jump in the lead. On guitar you reproduce it by [voicing move], not by chasing the vocal."*

**What the learner sees (Song B not in Songbook) — Abstain-and-point:**
- *"I don't have an analysis of [Song B] to compare against. Add it to your Songbook and I'll line the two choruses up directly."* No invented comparison.

**Citations (flag on):**
- `song-data` — this song's chorus harmony/dynamics; **[Song B]'s** chorus harmony/dynamics.
- `musical-concept` — plagal cadence; register/voicing as a "lift" mechanism.

---

## Q4 — "I keep botching the bridge transition — fix my practice setup so I can nail it."

**Stance:** Clarify (if needed) → Answer-by-acting · **Build state:** 🎯 target (agency, [ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md))

**What the learner sees:**
- *(If ambiguous)* a quick clarify: *"You mean the bars going into the bridge (around 0:32)?"*
- A **proposal before anything changes** (mandatory HITL): *"I'll slow bars 33–36 to 70%, loop them, and solo the rhythm guitar so the change is audible. Apply?"* — with **Apply / Modify / Cancel.**
- On Apply: the player reconfigures; a one-line confirmation; an **undo** affordance.

**Citations (flag on):**
- `learner/env` — repeated failed attempts at bars 33–36; current playback state.
- `song-data` — the transition's chord change + difficulty; which stem is the rhythm guitar.

*Every effectful step is logged (action · rationale · sources · your decision · outcome · undo) per [ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md).*

---

## Q5 — *(no prompt)* learner loops bars 33–36 four times at reduced tempo

**Stance:** Answer (proactive cue) · **Build state:** 🎯 target (initiative)

**What the learner sees:**
- A **minimal, dismissible** nudge — one line, ghost-text style, not a wall of text: *"That change borrows the IV-minor — feel the b6 in the top voice. Want a slow-down drill?"*
- It does **not** bombard: rate-limited, easy to dismiss, augments rather than interrupts.

**Citations (flag on):**
- `learner/env` — the repeat-loop activity signal.
- `song-data` / `musical-concept` — the borrowed-chord color at that bar.

---

## Q6 — "Write me lyrics for a third verse."

**Stance:** Refuse-in-role · **Build state:** ✅ today (guardrail)

**What the learner sees:**
- An honest, in-role decline with direction: *"That's outside what I do — I coach the guitar performance of this song. I can help you play the existing verses' changes or arrange them for solo guitar."* No fabricated lyrics.

**Citations (flag on):** none — nothing was asserted about the song.

---

## Q7 — "What exact fingering did the original guitarist use in the solo?"

**Stance:** Abstain-and-point · **Build state:** 🎯 target (evidence limit)

**What the learner sees:**
- A clear line between what the evidence supports and what it doesn't: *"I can't know the original fingering — I have the notes and pitch range, not the hand position. Here are two plausible fingerings for this range and why each works; a tab transcription would confirm the real one."*

**Citations (flag on):**
- `song-data` — solo stem note range / pitch content.
- `musical-concept` — position/fingering options for that range on guitar.
- *(named gap)* — no performance-fingering source exists; flagged, not faked.

---

## Coverage

| Query | Axis exercised | Stance | Interaction |
|---|---|---|---|
| Q1 | depth (answer) | Answer | reactive turn |
| Q2 | depth (brief) | Answer | reactive turn |
| Q3 | scope (cross-song) | Answer / Abstain | reactive turn |
| Q4 | agency (operate) | Clarify → act | reactive + HITL |
| Q5 | initiative (proactive) | Answer | proactive cue |
| Q6 | scope guardrail | Refuse-in-role | reactive turn |
| Q7 | evidence limit | Abstain-and-point | reactive turn |
