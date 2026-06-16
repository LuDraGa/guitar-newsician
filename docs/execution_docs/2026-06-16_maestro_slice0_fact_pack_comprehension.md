# Maestro — Slice 0: fact-pack comprehension (the Prep A → Slice 1 bridge)

| | |
|---|---|
| **Date** | 2026-06-16 |
| **Status** | 🟢 Building — data-core (0.1 / 0.2 / 0.4 + `get_stems`) + **0.2b** (pitch-class content) + **Fact Pack Freshness** committed (`e3b9647`); **0.3** (retrieval discipline) committed + live-verified (`e10e793`); **0.5** (seeded overview in the cacheable system prefix + pack-keyed agent cache + `cached_tokens` in the trace) **committed + live-verified, 43/43 pytest green** (first-message overview answered with ~0 tool calls). Next: 0.6 prompt + parts specialist. |
| **Branch** | `maestro/agent-buildout` |
| **Owner** | Claude (Opus 4.8) |
| **Grounds on** | [maestro-coach-prd.md](../maestro/maestro-coach-prd.md) · [maestro-agent-architecture.md](../maestro/maestro-agent-architecture.md) · [maestro-build-flow.md](../maestro/maestro-build-flow.md) |
| **Follows** | [2026-06-14_maestro-baseline-build.md](2026-06-14_maestro-baseline-build.md) (A+B+C committed) · the four pre-req substrate docs (stem metadata, per-stem analysis controls, trusted upload, fact-pack current rows) |

---

## Why this slice exists (the diagnosis)

The user's report: the base agent **(a) doesn't use all the stem information** to answer, and **(b) filters/extracts poorly** — it either over-pulls (large, unrelated context) or under-pulls (misses the high-value detail). Tracing the data path (adapter → fact-pack build → query tools → agent context → prompt) confirms both, with concrete origins:

**Doesn't use stem info**
1. **The adapter drops the precise stem identity Prep A just built.** `createStemMetadata` ([stem-metadata.ts](../../src/lib/music/stem-metadata.ts)) writes a nested `stem` object + `stem_label`/`stem_tags` (so "Lead Guitar" ≠ "Rhythm Guitar" ≠ "Synth Pad"). But `list_stems` ([werecode_data.py:91](../../maestro/maestro_agent/werecode_data.py)) reads only `inst_class/role/program_num/plugin_name/integrated_loudness` — **never `label`, `tags`, or the nested `stem`**. The substrate landed; the adapter ignores it.
2. **Per-stem analysis is flattened to counts.** `_stem_summary` ([fact_pack.py:149](../../maestro/maestro_agent/fact_pack.py)) reduces each stem's analysis to `status/keys/tempo/key/chord_progression_count` — the stem's *own* chord progression and sections are computed and thrown away.
3. **No stem-first tool or specialist.** Stems are reachable only via `get_midi_tracks` (MIDI-framed) and `get_song_slice`. No `get_stem(id)`; the 4 specialists are structure/harmony/rhythm/midi.
4. **Prompt never says stems carry their own key/tempo/chords/loudness/identity** — only "per-stem MIDI" ([agent.py:44](../../maestro/maestro_agent/agent.py)).
5. **`basic_stats` analyzer ignored at build** — present in `analysis_keys`, never read by `_build_pack`.

**Poor filtering/extraction**
- **Over-pull:** `get_midi_tracks` dumps *all* stems every call; `get_song_slice` is a kitchen sink (tempo+key+sections+bars+chords+**all** stems); `get_bar_grid` with no range returns every bar.
- **Under-pull:** no Section×Role cross ("which instruments play in section N" — the *time × role* axis the architecture names); no per-stem detail; no focused dominant-chord/key-candidate view.
- **Root cause:** the agent starts **blind** — no compact song overview is seeded, so it explores everything or stops too early.

## How this maps onto the PRD ladder

The PRD's capability ladder is **Baseline (answer) → S1 brief → S2 sequence → S3 drill → S4 adapt → S5 arrange**; the architecture's compounding contract is *deepen the graph · add a verb · introduce a primitive · hit a store milestone*. Slice 1 builds the **`Section × Role`** graph by a *"deterministic rollup of the fact pack into nodes, then an LLM interpretation step"* (architecture §6).

**Therefore the fact pack is Slice 1's rollup source.** If it drops stem identity, flattens per-stem analysis, and has no Section×Role cross, the `Section × Role` graph is lossy from node zero. Prep A delivered the *storage* substrate (per-stem audio/MIDI/analysis kinds); it did **not** make the fact pack *consume* it. That consumption is this slice.

So **Slice 0 is the honest completion of the Baseline rung** — make the coach *answer per-part* truthfully — and it is the **direct precursor to Slice 1**: the deterministic `Section × Role` data Slice 1 needs lands here, in the fact pack, before Slice 1 lifts it into a versioned, interpreted, inspectable graph store.

> **Why "Slice 0" and not pure infra.** The architecture forbids horizontal infra-only slices. Each sub-slice below ships a **visibly better answer** (per-part identity, per-part chords, section activity) — a better *answering* baseline, which Slice 1 turns into *briefing*. Blast radius is tight: **only the `maestro/` Python package + its tests.** No Next/Supabase schema changes (Prep A already landed them). Runtime stays local Python (Modal promotion remains a deferred transport swap).

---

## Slice 0 — sub-slices (each independently shippable + testable, no live LLM in tests)

> Each obeys a mini-contract: *reads the existing substrate → emits a truer fact-pack view → a tool/answer the previous step couldn't give.* Seam A = artifact/adapter tests; Seam B = agent-wiring/pure-function tests (architecture §9).

### 0.1 — Stem identity flows end-to-end *(fixes "doesn't use stem info" #1)*
- `list_stems` reads the nested `stem` object + `stem_label`/`stem_tags`, mirroring `getStemInfo` precedence (nested → top-level → kind). Surface `label`, `tags`, `stem_id`.
- Carry `label`/`tags` through `_stem_summary` and `_stem_tool_summary`.
- **Better answer:** names "Lead Guitar" vs "Rhythm Guitar" on a multi-guitar song.
- **Seam A:** adapter returns `label`/`tags` from a fake multi-guitar asset set.

### 0.2 — Per-stem analysis becomes queryable *(fixes #2; adds the missing drill-down tool)*
- `_stem_summary` keeps the stem's own bounded chord progression + key + tempo + sections — not just `chord_progression_count`.
- New tool **`get_stem(stem_id)`** → one part's full detail (identity + MIDI summary + its analysis).
- **Better answer:** "does the bass follow the mix's chords?"
- **Seam A:** stem analysis detail preserved through build. **Seam B:** `get_stem` registered; returns bounded detail; unknown id → graceful error.

### 0.3 — Roster + retrieval discipline *(fixes over-pull)*
- New tool **`get_stems()`** → lightweight roster (id/label/role/has_midi/has_analysis/loudness), no heavy detail.
- `get_song_slice` / `get_midi_tracks` stop dumping all stem summaries by default (reference the roster; drill via `get_stem`).
- **Better behavior:** smaller payloads on stem-agnostic questions; trace shows roster→drill.
- **Seam B:** slice/midi-tracks default payloads no longer embed every per-stem summary.

### 0.4 — Section × Role activity *(fixes under-pull; the Slice 1 precursor)*
- New tool **`get_section_activity(section_index | start_sec,end_sec)`** → which stems are active + each part's compact summary in that window (from per-stem MIDI note density / loudness over the section span).
- This is the **deterministic `Section × Role` rollup** Slice 1 will persist as graph nodes.
- **Better answer:** "which instruments play in the chorus, and what's the guitar doing there?" in one focused call.
- **Seam A:** activity rollup from fake per-stem MIDI + sections. **Seam B:** tool registered + bounded.

### 0.5 — Seeded song overview *(fixes the blind-start root cause)*
- Build a compact overview (duration · tempo+conf · key teaching/detected+conflict · section count · **stem roster w/ label+role+has_midi+has_analysis+loudness** · available analyses · overall confidence).
- **Inject it into the stable system prefix** (folded into the agent's `system_prompt` at creation), *not* re-sent per turn — so it rides the OpenAI prompt cache (see caching decision). Volatile history/question stay at the tail.
- **Better behavior:** answers "what do you know about this song?" with zero tool calls; far fewer exploratory calls on focused questions.
- **Seam B:** overview assembled deterministically from a pack fixture; agent-creation includes it; the agent cache key carries the fact-pack version so a rebuild refreshes it.

### 0.6 — Prompt + parts specialist *(fixes #3, #4; routes per-part questions)*
- System prompt: stems carry their own identity/key/tempo/chords/loudness; teach **stem-first discipline** (roster → drill into the relevant stem; scope by time range; compare across stems only when asked).
- Add a **`parts_agent`** (arrangement/role) specialist using `get_stems`/`get_stem`/`get_section_activity`; reframe `midi_agent`.
- **Seam B:** parts specialist registered with the expected tools; routing description present.

### 0.7 — *(optional)* surface `basic_stats` *(fixes #5)*
- Read `basic_stats` at build for mix loudness/dynamics; expose via overview + `get_song_slice`.
- **Seam A:** basic_stats fields land in the pack when present; absent → no crash.

### 0.8 — Next-step CTAs in the chat window *(new feature — small-model suggestion strip)*
> The one sub-slice that crosses into Next/TS. Depends on **0.5** (the overview is what makes suggestions song-specific instead of generic). A *live* affordance (architecture §2), not a persisted artifact — and a thin precursor to **S2**'s durable, difficulty-ranked learning path.

- After each assistant answer, a **small/cheap model** (default `gpt-5.4-nano`, regardless of the answer model) proposes **2–3 short next-step prompts**, rendered as clickable **CTA chips** beneath the answer. Clicking one sends it as the next user message (reuse the existing send handler; the workbench already pre-wires static prompts — this makes them dynamic + grounded).
- **Grounded + threaded:** the suggester is fed the seeded **song overview (0.5)** + the **last turn** (question + answer), so suggestions are about *this* song and follow the conversation — never generic trivia. They are *nudges*, not claims (they assert no facts).
- **Cheap + isolated seam:** new agent endpoint **`POST /suggestions`** (cheap model, bounded output: ≤3 items of `{label, prompt}`, short) → Next route **`POST /api/maestro/suggestions`** (`isMaestroEnabled()`-gated, auth + `requireOwnedSong`, proxies via `maestroFetch`). Mirrors the existing `/chat` seam exactly; Modal-later is the same transport swap.
- **Stage-aware:** at Slice 0 the suggestions are comprehension follow-ups ("Compare the bass and guitar chords", "What's active in the chorus?"); S2 later replaces this live nudge with a durable sequenced path.
- **Better experience:** the learner is never staring at a blank box wondering what to ask; the coach proposes the next rung — progressive disclosure (PRD principle) made tangible at near-zero cost.
- **Seam B:** suggestion-prompt assembly is a pure function over `(overview, last_turn)`; output parsing bounds to ≤3 items and drops malformed entries. **Seam C:** `/api/maestro/suggestions` route gated (404 off) + proxies. **UI:** `pnpm typecheck` / `pnpm lint`. Wrap impure `Date.now()/randomUUID` in module helpers (the workbench's existing `react-hooks/purity` constraint).

---

## Slice 1 — Section × Role briefing (the next real coaching verb; shown to confirm Slice 0 sets it up)

Per architecture §6, unchanged in intent — recorded here only to prove Slice 0 compounds correctly:

- **Graph/artifact:** `Section × Role` nodes, each `data + evidence + confidence + interpretation`. **Deterministic rollup reads Slice 0's `get_section_activity` + stem identity + per-stem analysis**, then an LLM interpretation step annotates each node.
- **Store milestone:** introduce the **Comprehension Graph** store as a `werecode` table, persisted/versioned/hash-invalidated by **reusing the fact-pack pattern** (`build`/`ensure_current`/`query`/`source_hashes`).
- **New verb:** *briefs* — per section: what's happening · each instrument's role · what the guitarist should focus on · confidence/evidence.
- **Primitive:** prompt-chaining (comprehend → select nodes → brief → check).
- **DoD (architecture):** the agent teaches from a stored, inspectable Section×Role understanding instead of answering from flat facts.
- **Tests:** Seam A (graph service build/ensure_current/invalidate vs fake analysis) · Seam B (briefing wiring + node-selection) · Seam C (Next `/api/maestro/*` graph/briefing route + `maestroFetch`/`modalFetch` mock).

## S2–S5 (sketch — already specified in architecture §6; confirms the trajectory)

| # | Slice | Graph layer added | Verb | Primitive | Store milestone |
|---|---|---|---|---|---|
| 2 | Learning-path sequencer | + `Phrase / Bar` (transitions, difficulty) | *sequences* | routing+decompose; parallel section sub-plans | minimal self-reported learner profile may enter here |
| 3 | Drill generator | + Concept Cards, Drill Templates | *generates* | orchestrator–workers; parallel sectioning | Theory KB seeded |
| 4 | Adaptive personalization | **Learner Model online** (dialogue-fed) | *adapts* | evaluator–optimizer + memory | Learner Model store |
| 5 | Solo-guitar arrangement (capstone) | + `Event × Role` (lead/fills, voicings) | *arranges* | hierarchical orchestrator | reuses all prior artifacts |
| (6) | Cross-student meta | — | *self-improves* | instrumentation + LLM-judge | **deferred — seam only** |

---

## Sequencing & dependencies

```
Slice 0 (this doc)
  Track 1 — comprehension core (maestro/ Python only)
    0.1 stem identity ─┐
    0.2 per-stem detail ├─ 0.3 roster/discipline ─┐
    0.4 section×role ───┘                          ├─ 0.5 overview ─ 0.6 prompt/specialist ─(0.7 basic_stats)
                                                    │
  Track 2 — chat-window UX (Next/TS + cheap endpoint)│
    0.8 next-step CTAs ──────────── depends on 0.5 ──┘
                                                    ▼
Slice 1 — lift 0.4's deterministic Section×Role data into the Comprehension Graph store + brief verb
Slices 2–5 — per architecture §6 (S2 replaces 0.8's live nudge with a durable sequenced path)
```

- **0.1/0.2/0.4 are the data-truth core** (they make the fact pack carry the role axis); **0.3/0.5/0.6 are the retrieval-discipline layer**; **0.8 is the only UI-crossing piece** and rides on 0.5.
- Recommended build order: **0.1 → 0.2 → 0.4 → 0.3 → 0.5 → 0.6 → 0.8**, verifying on the seeded song after the data-core (0.1/0.2/0.4), after discipline (0.5/0.6), and after 0.8 in the workbench.

## Decisions (proposed — confirm at build)
1. **Track 1 (0.1–0.7) lives entirely in `maestro/`** (adapter, fact_pack, agent, tests). No schema/Next changes; Prep A already shipped the kinds. **Track 2 (0.8)** is the only UI-crossing piece (MaestroClient + one route + the seam + a cheap agent endpoint). — *keeps the data work's blast radius tight; isolates the one TS change.*
2. **`get_section_activity` is deterministic** (note density / loudness over section spans), not an LLM pass — it is the rollup input Slice 1's graph build consumes. — *artifact-first discipline (architecture §10.1).*
3. **Overview (0.5) is injected per turn, not persisted** — a cheap derived view of the current fact pack, regenerated each request. **CTA suggestions (0.8) are also live, not persisted.** — *"would this be the same next session?" → no → compute live.*
4. **The CTA suggester always uses the cheap model** (`gpt-5.4-nano`), decoupled from the answer model — a typo on the answer model can't make suggestions expensive; cost stays negligible per turn.
5. **Validation is inspection-based, not a formal eval harness** — the live try-it prompt set (below) is judged by eye, honoring architecture §7's deferral of the LLM-judge/eval pipeline. Leave the eval seam; don't build it.
6. **Runtime stays local Python**; Modal promotion deferred (transport swap, no route changes) — consistent with the baseline doc.
7. **0.7 (basic_stats) is optional** and last — widest touch on the build payload.
8. **Prompt caching is preserved and made visible.** OpenAI auto-caches the static prompt prefix (≥1024 tokens) — already true for the DeepAgents system prompt. So: (a) the 0.5 overview goes in the **stable system prefix**, not per-turn messages; (b) the `_agent_cache` key gains the **fact-pack version** so the cached prefix stays correct across rebuilds; (c) volatile content (history, question, the 0.8 last-turn) stays at the tail / in the separate cheap CTA call; (d) the usage observer records **`cached_tokens`** so the trace proves cache hits. *Trim the static prompt where free* (exclude DeepAgents default file tools + general-purpose subagent — the baseline doc's noted polish) so even cached tokens are fewer.

## Trying it out — stage-wise prompt examples
Paste each into `/app/maestro` against the seeded multi-stem song (`efcbb636-…-366b`, BabySlakh Track00001) and inspect the answer + the Runtime trace. This is the **try-it harness**: every sub-slice ships a prompt that *fails or fumbles before and lands after*.

| Stage | Try-it prompt | Before → After (what to look for) |
|---|---|---|
| **0.1** | "List the stems in this song and name each one specifically." | lumps both guitars as "guitar" → distinct **labels** ("Lead Guitar", "Rhythm Guitar") + tags |
| **0.2** | "What chords does the bass play, and do they match the song's main progression?" | "I only have a chord count" → pulls the **bass stem's own progression** via `get_stem` and compares |
| **0.3** | "What key is the song in?" *(stem-agnostic)* | trace shows `get_song_slice`/`get_midi_tracks` **dumping all 10 stems** → roster-only / `get_key`, **no stem dump**, smaller payload |
| **0.4** | "Which instruments play in the chorus, and what should I focus on as a guitarist there?" | guesses or pulls everything → one **`get_section_activity`** call: active stems + the guitar's part in that window |
| **0.5** | *(first message of any session)* "What do you know about this song?" | 2–3 exploratory tool calls to discover basics → answers from the **seeded overview**, ~0–1 tool calls |
| **0.6** | "Compare what the lead guitar and rhythm guitar are doing across the song." | `midi_agent` fumbles the role split → routes to **`parts_agent`**, `get_stems` → `get_stem` per guitar |
| **0.8** | *(after any answer)* — don't type; look beneath it | static/no follow-ups → **2–3 grounded CTA chips** ("Show the chord progression", "What's the guitar doing in the chorus?"); clicking continues the thread |
| **S1** | "Brief me on the chorus." | flat-fact answer → structured **section briefing** (what's happening · each instrument's role · guitarist focus · confidence) from the stored Section×Role graph |

## Testing feasibility (two tiers)
**Tier 1 — deterministic `pytest` (no live LLM, CI-safe).** Extend `maestro/tests/` per sub-slice — Seam A (adapter/fact-pack shape, persistence, invalidation) + Seam B (tool/specialist wiring, pure assembly fns) + Seam C (0.8's Next route gating, mocked seam). Run `cd maestro && uv run pytest` after each sub-slice.

**Tier 2 — live try-it (real model, manual, inspection-based — no script).** The prompt table above, run by hand in `/app/maestro` on the seeded song; the user also validates against an actual guitar. No automated try-it script and no LLM-judge (respects §7) — the workbench's answer + Runtime trace (now incl. `cached_tokens`) is the inspection surface. Verify after the data-core (0.1/0.2/0.4), after discipline (0.5/0.6), and after 0.8.

**TS checks:** `pnpm typecheck` / `pnpm lint` only when 0.8's UI/route is touched (Track 1 needs none).

## Status tracker

| Item | Status | Notes |
|---|---|---|
| Diagnosis | ✅ | over/under-pull + dropped stem identity, with file:line origins |
| Slice plan grounded vs PRD/architecture | ✅ | Slice 0 = Prep A → Slice 1 bridge |
| 0.1 stem identity | ✅ | `_stem_info` port in `werecode_data.py`; `list_stems` surfaces id/label/role/tags; carried through `_stem_summary` + `_stem_tool_summary` |
| 0.2 per-stem detail + `get_stem` | ✅ | `_stem_summary` keeps stem chords (≤64) + sections; new `get_stem(id)` query + tool |
| 0.2b per-section pitch-class content | ✅ | `note_activity_by_window` accumulates a 12-bin PC histogram + dominant PCs; surfaced per section (`get_section_activity` parts) and as a stem-level `pitch_class_profile` (`get_stem`); `FACT_PACK_VERSION`→4. Makes "does the bass follow the progression?" answerable with no per-stem analysis |
| Fact Pack Freshness | ✅ (built) | inserted before 0.3 from the 0.2b live finding (re-analysis didn't invalidate the pack). Staleness signal + chat banner/confirm — see [2026-06-16_maestro_fact_pack_freshness.md](2026-06-16_maestro_fact_pack_freshness.md). `FACT_PACK_VERSION`→5. Awaiting live try-it. |
| 0.3 roster + discipline | ✅ | `get_stems()` roster shipped with the data-core; **default-dump trimmed** — `get_midi_tracks` keeps `all_src` + a roster (`stems`) + drill hint, `get_song_slice` swaps the full dump for a `parts` roster (all parts, `has_midi` visible) + hint. Shared `_stem_roster_entry`; dead `_stem_tool_summary` removed. No `FACT_PACK_VERSION` bump (query-shape only). |
| 0.4 `get_section_activity` | ✅ | `note_activity_by_window` (merge_tracks) → per-section rollup stored in pack; `get_section_activity` query + tool; `FACT_PACK_VERSION`→3 |
| 0.5 seeded overview | ✅ | `build_song_overview`/`render_song_overview` (pure) fold a compact overview (duration · tempo+conf · key teaching/detected+conflict · section count · parts roster reusing `_stem_roster_entry` · available analyses · overall confidence) into the **stable `system_prompt`** at agent creation (rides the prompt cache; volatile history/question stay at the tail). `_agent_cache` keyed by **(song, model, pack version + created_at)** so a rebuild busts the stale baked-in overview; no-pack songs use a `nopack` sentinel. `cached_tokens` (`prompt_tokens_details.cached_tokens`) surfaced in the usage observer record + `summarize`. **No `FACT_PACK_VERSION` bump** (overview is a derived live view; no stored-pack fields added). **Live-verified** (2026-06-17): first-message overview answered with ~0 tool calls; `cached_tokens > 0` to eyeball on a 2nd turn. |
| 0.6 prompt + parts specialist | ⬜ | stem-first discipline; `parts_agent` |
| 0.7 basic_stats | ⬜ | optional |
| 0.8 next-step CTAs | ⬜ | cheap-model suggestion strip; Next/TS + `/api/maestro/suggestions`; rides on 0.5 |
| Tests (Seam A/B) — data-core + 0.2b + 0.3 + 0.5 | ✅ | `tests/test_slice0_comprehension.py`: identity precedence, MIDI bucketing, roster/detail/activity views, 0.2b PC histogram / dominant-PC ranking / stem PC profile / surfacing, 0.3 roster-shape assertions (no default dump on `get_midi_tracks`/`get_song_slice`), + 0.5 `build_song_overview` field-by-field / `render_song_overview` (conflict, missing key, agreeing key) / `_agent_cache_key` identity. `tests/test_usage_observer.py`: `cached_tokens` from dict + object details, absent → None, `summarize` totals it. **43/43** with `test_fact_pack_freshness.py`. |
| Try-it (stage prompts) | 🟡 | live + inspection-based. **0.3 ✅ verified** (2026-06-17): "what key… separate for diff instruments" → trace = `get_key` + `get_stems` (roster), **no `get_song_slice`/`get_midi_tracks` 10-stem dump**, honest "one global key, can drill a stem" answer. **0.5 ✅ verified** (2026-06-17): first-message "What do you know about this song?" → overview verbatim (duration/tempo+conf/12 sections/key conflict/10-stem roster), **~0 tool calls**. Data-core/0.2b still to re-confirm on the guitar; `cached_tokens` to eyeball on a 2nd turn. |
| Slice 1 — Section×Role briefing | ⬜ | next coaching verb; lifts 0.4 into a store |

## Progress log

### 2026-06-16 — data-core (0.1 / 0.2 / 0.4) built, pytest green
- **0.1** `werecode_data.py`: added the `getStemInfo` Python port (`_stem_info` + helpers) and rewired `list_stems` to surface `id/label/role/tags`. Works on both old seeds (label derived from `inst_class`) and new uploads (explicit `stem_label`).
- **0.2** `fact_pack.py`: `_stem_summary` now keeps each stem's own bounded chord progression (≤64) + sections + key/tempo, not just a count. New `get_stem(stem_id)` query + agent tool returns one part's full detail.
- **0.4** `midi.py`: `note_activity_by_window` walks the merged track stream (global tempo) and buckets note onsets into section windows. `_build_pack` computes sections first and stores `activity_by_section` per stem. New `get_section_activity(section_index|range)` query + tool. `FACT_PACK_VERSION`→3 forces a clean rebuild of the seeded pack.
- **agent.py**: registered `get_stems` / `get_stem` / `get_section_activity` (10 tools total; verified via `describe_tools`).
- **Tests**: `uv run pytest` → **14 passed**. No live LLM.
- **Caching note**: untouched this batch (prefix unchanged); the 0.5 overview + cache-key + `cached_tokens` work lands with the discipline layer.
- **Next**: await live try-it on the seeded song, then 0.3 trim → 0.5 overview → 0.6 prompt/specialist → 0.8 CTAs.

### 2026-06-16 — live finding: bass with MIDI but no per-stem analysis → expose pitch-class content (0.2b)
- **Try-it 0.2** ("what chords does the bass play, do they match the progression?") behaved correctly but hit a data gap: 0.1 named the stem "Bass" ✅, the agent called `get_stem(S03)` ✅, and it stayed honest (no bluff) ✅ — but the bass stem has **MIDI without per-stem chord analysis** (only 2/10 seeded stems are analyzed), and `_compact_midi_summary` **drops the note events** (`notes_sample_omitted`), so the bass's actual notes (≈ the chord roots) are unreachable. The agent even offered a "note-to-chord" path that would fail because the notes aren't in any tool output.
- **Fix (0.2b — completes 0.2/0.4 for the no-analysis case, deterministic):** accumulate a 12-bin **pitch-class histogram** in `note_activity_by_window`; surface **dominant pitch classes per section** (and a stem-level PC profile) in `activity_by_section` + `get_stem`. Then "does the bass follow the progression?" is answerable by comparing bass dominant-PC-per-section to the mix chord roots, with no per-stem analysis. 0.6's prompt will instruct the agent to use it.
- **Status:** ✅ **built (approved), 20/20 pytest green — awaiting live try-it.**

### 2026-06-16 — 0.2b built, pytest 20/20 green
- **`midi.py`**: `note_activity_by_window` now accumulates a per-window 12-bin `pc_counts` (`pitch % 12`) and emits `pitch_class_histogram` + `dominant_pitch_classes` (new shared helper `dominant_pitch_classes(histogram, top_n=3)` — count desc, then PC index for determinism, zero bins dropped; sharp-spelled names via `PITCH_CLASS_NAMES`, index is the comparison key).
- **`fact_pack.py`**: histogram/dominant flow through `_stem_activity_by_section` (already `**act`). `_stem_summary` computes a stem-level `pitch_class_profile` (new helper `_stem_pitch_class_profile` sums the section histograms → aggregate dominant PCs + note_count). `get_section_activity` part summaries gain `dominant_pitch_classes` (top-3 only, not the full 12 bins — token-conscious); `get_stem`'s `_stem_detail` surfaces `pitch_class_profile` (and the full per-section histograms ride along in `activity_by_section`). `FACT_PACK_VERSION`→**4** (forces a clean rebuild of the seeded pack on next query).
- **Tests**: +6 in `test_slice0_comprehension.py` — per-window histogram + tie-ordering, `dominant_pitch_classes` ranking/cap/empty, `_stem_pitch_class_profile` sum + empty, and Seam-B surfacing on `get_stem` / `get_section_activity`. `uv run pytest` → **20 passed**. No live LLM. No new agent tools; no schema/Next changes.
- **Deferred to 0.6 (flagged, not done):** the `get_stem` / `get_section_activity` tool *descriptions* and the system prompt still don't explicitly name the new pitch-class fields — the data is now in the tool JSON (discoverable), but the explicit "compare bass dominant PCs to the chord roots" instruction lands with 0.6's stem-first prompt. Worth watching in the live try-it: if the agent doesn't reach for it unprompted, that confirms the 0.6 nudge is needed.
- **Next**: ⏸ live try-it on the seeded song (restart the local agent first — `FACT_PACK_VERSION` bumped, so the pack rebuilds on next query), then 0.3 trim → 0.5 overview → 0.6 prompt/specialist → 0.8 CTAs (Ask→Explain→Approve→Implement for those).

### 2026-06-17 — 0.3 retrieval discipline built, pytest 34/34 green
- **Diagnosis recap:** `get_midi_tracks` and `get_song_slice` each embedded a full `_stem_tool_summary` (identity + full MIDI tool summary + analysis block) for *every* stem on *every* call — the over-pull on stem-agnostic questions (e.g. "what key is the song in?").
- **`fact_pack.py`:** new shared `_stem_roster_entry(stem)` (8 identity-only fields: `stem_id/label/role/tags/is_drum/has_midi/has_analysis/integrated_loudness`). `get_stems` refactored onto it (no behavior change). `get_midi_tracks` now returns `all_src` (the genuine *mix* MIDI summary, kept) + `stem_count` + a `stems` roster + a drill `hint`; the per-stem MIDI/analysis dump is gone. `get_song_slice` swaps its `midi_tracks` full dump for a `parts` roster — **all** parts, `has_midi` distinguishing which carry MIDI (design call) — + a `hint` pointing to `get_section_activity`/`get_stem`. Dead `_stem_tool_summary` removed.
- **Naming decision (user):** the slice's per-part slot is `parts` (musical word that sits beside tempo/key/chords, consistent with `get_section_activity`'s `parts`/`all_parts`); the stem/MIDI-framed tools keep `stems`. Both `midi_tracks` and a bare `stems` read wrong inside a musical-passage view.
- **`agent.py`:** updated only the `get_midi_tracks` + `get_song_slice` tool docstrings to describe roster-and-drill (the deeper system-prompt + `midi_agent` stem-first rework stays scoped to 0.6, keeping 0.3's blast radius tight).
- **Tests:** +3 Seam B in `test_slice0_comprehension.py` — roster shape on `get_midi_tracks` (keeps `all_src`, no per-stem `midi`/`analysis`), `parts` roster on `get_song_slice` (all parts, `has_midi` visible, musical facts retained, old `midi_tracks` key gone), and a shared-shape check across the three roster tools. `uv run pytest` → **34 passed**. No live LLM. **No `FACT_PACK_VERSION` bump** — query-shape change only; the stored pack is unchanged, so no rebuild.
- **Local agent restarted** on `:8000` (health OK, new code loaded) for live try-it.
- **Next**: ⏸ live try-it (0.3 prompt: "What key is the song in?" → trace should show **no 10-stem dump** — `get_key`/roster only). Then **0.5 overview** (cache-friendly system-prefix injection, surface `cached_tokens`) → 0.6 prompt/parts specialist → 0.8 CTAs. Carry the approved 0.6 framing (trust pitch-class content over chord labels for bass/monophonic parts; name the new PC fields in tool descriptions).

### 2026-06-17 — 0.3 verified live; the trace also pre-confirms the 0.6 nudge
- **0.3 ✅ (user ran it on the seeded song).** Query: *"What key is the song in? can be separate for diff instruments."* Runtime trace = **`get_key` → `get_stems` (roster) → final** — exactly the roster-and-drill discipline; **no `get_song_slice`/`get_midi_tracks` 10-stem dump** (the pre-0.3 over-pull). The agent answered honestly (G minor detected vs Bb minor teaching, key_conflict surfaced) and, for the per-instrument ask, said the pack carries one global key and **offered to drill a specific stem** rather than fabricating per-stem keys. (Model in trace: `gpt-5.4-nano`, user's per-request override.)
- **0.6 signal (as predicted in the 0.2b log):** asked for per-instrument keys, the agent *gestured* at "what key/scale it implies locally from its harmony activity" but did **not** actually drill `get_stem` and read the per-section `dominant_pitch_classes` / `pitch_class_profile` unprompted — it framed that as a follow-up. The PC data is present in the tool JSON but undiscovered without an explicit instruction. → **confirms 0.6 must (a) name the pitch-class fields in the `get_stem`/`get_section_activity` tool descriptions and (b) instruct: for per-part/monophonic key questions, drill the stem and compare dominant PCs to the mix chord roots.** Logged so 0.6 closes it.
- **Note:** I will not auto-launch the `:8000` backend again — the user runs it themselves (a background launch here was killed → "Maestro agent unreachable"; user restarted it). After any `maestro/` change I'll just remind them to restart it.
- **Next**: await go-ahead on **0.5 — seeded song overview** (Ask→Explain→Approve→Implement). 0.3 is ready to commit when asked.

### 2026-06-17 — 0.5 seeded overview built, pytest 43/43 green
- **Why:** the agent started *blind* (decision/diagnosis root cause — no compact song context until exploratory tool calls). 0.5 seeds that context into the **stable system prefix** so "what do you know about this song?" needs zero tool calls and focused questions start from the known cast.
- **`fact_pack.py`:** two pure functions (no I/O, no new tool). `build_song_overview(pack)` selects a compact view — duration · tempo+confidence · teaching/detected key + `key_conflict` · section count · overall confidence · available mix analyses · **parts roster reusing `_stem_roster_entry`** (so the overview never diverges from `get_stems`). `render_song_overview(overview)` emits a dense, deterministic-field-order Markdown block (one-line summary, a key-conflict reconciliation line, a parts table with midi/analysis ✓/· + loudness) + a "scope to the roster, then drill" instruction. Helpers `_render_key_line` / `_fmt_seconds` / `_fmt_num`.
- **`agent.py`:** `SYSTEM_PROMPT_TEMPLATE` gains an `{overview_block}` slot; `create_agent_runner(..., pack=None)` folds the rendered overview in **at creation** (rides OpenAI's prompt cache — not re-sent per turn) via `_overview_block` (best-effort; a malformed/absent pack → "" → still-functional agent). `invoke_agent` fetches the current pack once (`_safe_overview_pack` → `ensure_current`, catching `FactPackUnavailable`/`FileNotFoundError` → None) and keys the cache via `_agent_cache_key(song, model, pack)` = `song|model|v{version}|{created_at}` (or `song|model|nopack`). **Decision honored beyond the literal handoff:** keyed on **version + created_at**, not just `FACT_PACK_VERSION`, because the constant alone wouldn't bust a *same-version content rebuild* (a re-analysis) — created_at changes on every `_build_pack`, so the baked-in overview "stays correct across rebuilds" (decision #8's stated goal). Approved by the user before implementing.
- **`llm.py`:** `MaestroUsageObserver` now reads `prompt_tokens_details.cached_tokens` (dict + object forms) into each record and totals it in `summarize` → the Runtime trace's `usage`/`usage_calls` prove prompt-cache hits on turn 2+.
- **Tests:** +5 in `test_slice0_comprehension.py` (overview assembly + render variants + cache-key identity) and a new `test_usage_observer.py` (+4: cached_tokens dict/object/absent + summarize total). `uv run pytest` → **43 passed**. No live LLM. **No `FACT_PACK_VERSION` bump** — the overview is a derived live view; no stored-pack fields added, so no rebuild needed (the existing v5 pack already carries everything the overview reads).
- **Scope held:** the DeepAgents static-prompt trim and the `midi_agent`/stem-first prompt rework + 0.6 pitch-class nudges remain deferred to **0.6**. No Next/TS change (the trace is inspected raw; a UI line for `cached_tokens` is optional later polish).
- **Next**: ⏸ live try-it — **restart the local agent** (no `FACT_PACK_VERSION` bump, so no pack rebuild, but the process must reload the new code). 0.5 prompt: *(first message of a session)* "What do you know about this song?" → expect a confident answer from the seeded overview with **~0 tool calls**; then a second turn to inspect **`cached_tokens` > 0** in the trace. Then **0.6 prompt + parts specialist** (carry the pitch-class nudge framing). 0.5 ready to commit when asked.

### 2026-06-17 — 0.5 live-verified; tool-role audit sharpens 0.6 scope
- **0.5 ✅ (user ran it).** First-message "What do you know about this song?" on the seeded song returned the overview verbatim — duration 190.4s · tempo 82.7 BPM (medium) · 12 sections · overall medium · the **Bb-minor-teaching vs G-minor-detected conflict** · the **10-stem parts roster** — with **~0 tool calls**. The blind-start root cause is closed. `cached_tokens > 0` on a 2nd turn still to eyeball (the prefix is now stable + pack-keyed, so it should cache). Committed this session.
- **Tool-role audit (drives 0.6).** The overview is an *index* (cheap whole-song scalars + roster + the key *headline*); every depth tool is untouched, but three roles shift:
  - **`get_stems` is now largely redundant** — the overview's parts roster IS `_stem_roster_entry`'s output, in-context every turn. Residual value: `tags`/`is_drum` (which `render_song_overview`'s table does *not* show) + the `nopack` degraded-mode fallback. → 0.6: **demote** (repoint docstring: "the roster is already in your overview; call only to refresh after a change, or for tags"; decide whether to render `tags` in the prefix) or drop. **Recommend demote** — cheap safety net, deletion buys little and loses the fallback.
  - **`get_key` role sharpens** — its headline (teaching/detected/conflict) now lives in the prefix; it becomes the *evidence* drill (strength, candidate scores, dominant chords, chosen-key reason). 0.6 prompt: don't re-call it just to restate the key.
  - **`get_midi_tracks` narrows** — its roster is duplicated by the overview; only the mix-level `all_src` MIDI summary is unique. Folds into the `midi_agent` stem-first repoint already on 0.6's list.
  - **0.6 prompt nudge:** tell the agent the **roster + key headline are already known** (don't re-fetch to restate). Pairs with the pitch-class nudge ("for per-part/monophonic key questions, drill `get_stem` and compare its `dominant_pitch_classes` to the mix chord roots; reconcile teaching-vs-detected first").
- **Doc handover done; next session starts at 0.6.**
