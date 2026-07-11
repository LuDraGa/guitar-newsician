# Maestro — Task Resolution Map (what Maestro uses, step by step)

> **Living doc + expectation-alignment spec.** For the same queries as the [Query Playbook](maestro-query-playbook.md), this traces **exactly what Maestro uses internally** to solve each one — in the locked domain vocabulary ([maestro-domain-model.md](maestro-domain-model.md)): which **capabilities** (and family), which **workflow** (curated/emergent), which **tools** (retrieval/operator) over which **stores**, which **harness** primitives, and which **invariants** fire. Read it next to the Playbook (same query numbers) to see outside-view ↔ inside-view.
>
> **Target-state**, tagged per entry. Each step is labeled by bucket: **[H]** harness · **[C]** capability · **[T]** tool · **[S]** store. **Tags use:** WHAT=capability, HOW=harness, WITH-WHAT=tools+stores.
>
> **Created:** 2026-06-27. **Owner:** Maestro build.

---

## Resolution template

Each entry: **Classification** (axis · capability+family · workflow type · interaction) → **Steps** (bucket-tagged) → **Invariants** (grounding · citation · stance · guardrail) → **Build state.**

---

## Q1 — Key consistency across parts  ·  ↔ [Playbook Q1](maestro-query-playbook.md#q1--what-key-is-this-song-in-and-is-it-consistent-across-the-parts)

**Classification:** depth=answer · `key/harmony` read (song-domain) · workflow = **single reactive retrieval** · reactive turn.

**Steps:**
1. **[H]** ReAct loop receives the turn; the seeded overview (cached prefix) already holds the key headline + parts roster → no re-fetch.
2. **[C]** the QnA node scopes to the roster, decides the bass needs its own read (monophonic).
3. **[T·retrieval]** `get_key` → **[S]** fact pack (teaching/detected/conflict/confidence).
4. **[T·retrieval]** `get_stem(bass)` → **[S]** fact pack (`dominant_pitch_classes`) to confirm against chord roots.
5. **[H]** usage trace records both reads (→ citations).

**Invariants:** grounding ← key fields + bass pitch content; citation ← the two reads + the relative-key concept; stance = **Answer**; guardrail = n/a (read-only).
**Build state:** ✅ today.

---

## Q2 — Brief the chorus  ·  ↔ [Playbook Q2](maestro-query-playbook.md#q2--walk-me-through-the-chorus--whats-happening-and-what-should-i-focus-on-as-a-guitarist)

**Classification:** depth=brief · `brief` (song-domain) · workflow = **curated chain** (comprehend → interpret → check) · reactive turn.

**Steps:**
1. **[H·chaining]** the curated brief chain-runner starts (generic; the same runner serves drill/arrange later).
2. **[C]** `brief` = a **formula over `{Section, Role}` + judgment**.
3. **[T·retrieval]** `get_section_activity` + `get_stem` for the chorus → **[S]** Comprehension Graph (Section×Role nodes: `data + evidence + confidence + interpretation`).
4. **[C]** interpretation step turns nodes → guitar-facing brief (role split, the "lift," the guitar's job).
5. **[H·evaluator]** the chain's **check** step verifies claims trace to node evidence before returning.

**Invariants:** grounding ← node `evidence`; citation ← section/part/chord/dynamics nodes + the plagal concept; stance = **Answer** with surfaced **confidence**; guardrail = n/a.
**Build state:** 🎯 Slice 1 (first store + first curated chain).

---

## Q3 — "Lifts like [Song B]'s chorus"  ·  ↔ [Playbook Q3](maestro-query-playbook.md#q3--this-chorus-gives-me-the-same-lift-as-song-bs-chorus--why-and-how-do-i-get-it-on-guitar)

**Classification:** scope=cross-song · composes `brief`/comparison (song-domain) · workflow = **emergent (retrieval-only)** · reactive turn.

**Steps:**
1. **[H]** no curated path covers "compare two songs' choruses" → Maestro authors an **emergent workflow** from primitives.
2. **[H·guard]** emergent over **retrieval only** → low-risk lane (no HITL needed; evaluator required).
3. **[T·retrieval]** read **[S]** this song's chorus nodes **and** **[S]** Song B's graph.
   - **If Song B store is absent →** stance flips to **Abstain-and-point**; emit "add it to your Songbook," stop. *(No fabricated comparison.)*
4. **[H·aggregation]** diff harmony/dynamics/arrangement → isolate the shared device.
5. **[C]** translate the device to a guitar move (reuse of the brief/arrange judgment).
6. **[H·evaluator]** runtime evaluator checks the comparison is grounded (it skipped pre-testing).

**Invariants:** grounding ← both songs' nodes + the named concept; citation ← `song-data` ×2 + `musical-concept`; stance = **Answer | Abstain-and-point**; guardrail = retrieval-only emergent (safe lane).
**Build state:** 🎯 target (needs cross-song scope + emergent composition).

---

## Q4 — "Fix my practice setup for the bridge"  ·  ↔ [Playbook Q4](maestro-query-playbook.md#q4--i-keep-botching-the-bridge-transition--fix-my-practice-setup-so-i-can-nail-it)

**Classification:** agency=operate · **cross-domain** (learner × song × environment) · workflow = **emergent × operator** · reactive + **HITL**.

**Steps:**
1. **[C·learner-domain]** read the struggle signal → **[S]** Learner Context / activity; if the target transition is ambiguous, stance = **Clarify** first.
2. **[T·retrieval]** **[S]** song graph → the transition's bars, chord change, which stem is rhythm guitar.
3. **[H]** author an **emergent workflow** chaining **operator** tools: set-tempo(70%) → loop(33–36) → solo(rhythm-gtr).
4. **[H·guard — ADR-0001]** emergent **× operator** → **mandatory HITL**: emit a crisp proposal; **block** on Apply/Modify/Cancel.
5. **[T·operator]** on Apply only, execute each effectful step → **[S]** environment (player) state.
6. **[H·instrumentation]** log each step: action · rationale · sources · HITL decision · outcome · **undo handle**.

**Invariants:** grounding ← struggle signal + transition node; citation ← `learner/env` + `song-data`; stance = **Clarify → act**; guardrail = **HITL + logging ([ADR-0001](../adr/0001-emergent-operator-workflows-hitl.md))**.
**Build state:** 🎯 target (the headline agency milestone; gated).

---

## Q5 — Proactive cue on a repeated hard loop  ·  ↔ [Playbook Q5](maestro-query-playbook.md#q5--no-prompt-learner-loops-bars-3336-four-times-at-reduced-tempo)

**Classification:** initiative=proactive · **attention policy** (learner-domain capability) invoking a dialed-down `brief` · workflow = curated micro-chain · **proactive cue**.

**Steps:**
1. **[H]** *no prompt.* The **practice-signal stream** ([S] activity) trips a threshold (loop ×4 at low tempo).
2. **[H·budget]** restraint check: is there cue budget (rate-limit) and is the floor of usefulness met? If not → **stay silent** (the model can't self-restrain — this is harness).
3. **[C·learner-domain]** the **attention policy** decides *what* is most worth surfacing here.
4. **[C]** invokes `brief` at **minimum intensity** (one node, one line) — the verb is reused; only the **intensity budget** changed (a harness setting, not the capability shrinking itself).
5. **[H]** render as a dismissible cue; record the dismissal/accept signal back to [S] Learner Context.

**Invariants:** grounding ← the one node behind the line; citation ← `learner/env` + `song-data`; stance = **Answer (minimal)**; guardrail = **budget/restraint** (anti-bombard).
**Build state:** 🎯 target (needs the activity-signal stream + attention policy).

---

## Q6 — "Write a third verse"  ·  ↔ [Playbook Q6](maestro-query-playbook.md#q6--write-me-lyrics-for-a-third-verse)

**Classification:** scope guardrail · **no capability invoked** · workflow = none · reactive turn.

**Steps:**
1. **[H·guard]** scope check against the **role model**: lyric generation is out of role (and an explicit product non-goal).
2. **[C]** stance = **Refuse-in-role**: decline honestly + redirect to an in-role offer (play/arrange the existing changes).

**Invariants:** grounding ← n/a (nothing asserted); citation ← none; stance = **Refuse-in-role**; guardrail = **role boundary** (the cheapest, most important one).
**Build state:** ✅ today (behavioral).

---

## Q7 — "Exact original fingering?"  ·  ↔ [Playbook Q7](maestro-query-playbook.md#q7--what-exact-fingering-did-the-original-guitarist-use-in-the-solo)

**Classification:** evidence limit · `midi/playability` read (song-domain) · workflow = single retrieval · reactive turn.

**Steps:**
1. **[T·retrieval]** **[S]** solo stem note range / pitch content.
2. **[H]** evidence check: notes ✅ available; hand-position/performance-fingering ❌ no source.
3. **[C]** stance = **Abstain-and-point** on the unknowable part; *still helpful* — offer grounded plausible fingerings for the range + a **lookout** ("a tab would confirm").

**Invariants:** grounding ← note range (what's known) vs the **named gap** (what isn't); citation ← `song-data` + `musical-concept` + the explicit no-source flag; stance = **Abstain-and-point**; guardrail = honesty over bluff.
**Build state:** 🎯 target (the honesty pattern; partially expressible today).

---

## What this map proves (expectation alignment)

- **Every step lands in exactly one bucket** (H / C / T / S). Nothing needed a new kind of thing — the vocabulary covers real resolutions end to end.
- **The risk lane is always explicit:** retrieval-only emergent (Q3) is safe; emergent × operator (Q4) is HITL-gated; proactive (Q5) is budget-gated; out-of-role (Q6) is refused. The guardrail is named at the step where it bites.
- **Grounding + citation are mechanical, not aspirational:** every asserted claim names the `[S]` it came from, which is what the flag-gated citation surface renders.
- **Curated vs emergent is visible per query:** Q2 runs a *curated* chain; Q3/Q4 *author* one at runtime. A recurrent emergent shape (e.g. cross-song chorus compare) is a **promotion** candidate → curated capability.
