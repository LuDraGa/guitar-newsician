# Maestro (MusicCoach) — Build Flow & Prep Work

| | |
|---|---|
| **Status** | Direction aligned · grounded against WereCode · prep not started |
| **Date** | 2026-06-14 |
| **Origin** | Design-alignment session over the Maestro POC (`modal_apis/Maestro`) |
| **Home** | WereCode (this repo) — `docs/maestro/` |
| **Framing** | The **flow** to get from the POC to a working coach in WereCode — the non-agentic prep that unblocks the agentic slices. Product view: [maestro-coach-prd.md](maestro-coach-prd.md). Architecture: [maestro-agent-architecture.md](maestro-agent-architecture.md). |

> **Grounded against WereCode (2026-06-14 study).** §§0–3 and 5–6 now reference real `werecode`-schema, feature-flag, route, and `modalFetch` identifiers in this repo. Where a decision is deliberately left for build-start it is marked **⟳ decide-at-build**.

---

## 0. Context — POC → WereCode

The `modal_apis/Maestro` repo is a **rough POC** that worked out the goal and the design alignment for the Maestro / MusicCoach coach. The agent, its stores, and its capabilities are **built here, in WereCode**, reusing the patterns in the architecture doc.

**Correction from the WereCode study (important).** Earlier alignment assumed WereCode already had a *"base LangGraph QA agent"* to reuse. **It does not.** There is **no LLM agent backend** in WereCode — `langgraph` / `langchain` / `openai` / `anthropic` / `deepagents` appear nowhere in `src/` or `backend/`. What exists is: the **scripted** marketing `MaestroChat.tsx`, the **keyword-scored** `Concierge.tsx` (Octavia), and the **static** studio `AICoachDock` (canned suggestions + a non-functional input, explicitly excluded from the product baseline). **The agent is greenfield.** We reuse the POC's DeepAgents *patterns* — fact pack, bounded tools, specialists, trace, confidence model (architecture §8) — not WereCode agent code.

**Where the agent runs (⟳ decide-at-build — don't pre-decide).** WereCode's runtime split is Next/Vercel (UI + orchestration) + Supabase (durable rows + private buckets) + **Modal for all heavy compute, behind the single `modalFetch` chokepoint** (`src/lib/modal/client.ts`) + a dev-only Python backend. The POC stack is Python / DeepAgents. The natural fit is therefore a **Modal-hosted agent service called via `modalFetch`**, orchestrated by a Next `/api/maestro/*` route (mirroring how `analyze` / `separate` jobs already flow) — versus a TS agent inside Next. **Recommended: Modal-hosted**, to match the split and reuse the POC's Python; confirm at build start.

The agentic build (the S1–S5 slices) depends on two pieces of **non-agentic prep**. Both must be sequenced first.

## 1. Prep A — Data Foundation (trusted custom upload + per-stem analysis/MIDI)

**Goal:** give the coach *accurate*, complete, per-part song data to comprehend.

**Why this is needed — and confirmed by WereCode's own baseline.** The coach's comprehension is only as good as its substrate; lossy data poisons every downstream artifact. WereCode's current capability honesty (see `.scratch/current-app-baseline/PRD.md`) rates the auto pipeline exactly where the POC alignment assumed: **full analysis reliable, stem separation "rough," automatic transcription (MIDI / notation) "experimental / effectively absent."** Auto-separation + auto-transcription cannot be the substrate for per-role coaching. So the coach needs a path to ingest **human-verified** stems + per-stem MIDI + per-stem analysis.

### What already exists in WereCode (reuse, don't rebuild)

Grounded in `supabase/sql/2026-05-25_werecode_schema.sql` (the `werecode` schema) + the runtime split in `docs/ARCHITECTURE.md`:

- **`werecode.songs`** — readiness flags `has_audio / has_normalized_audio / has_stems / has_analysis / has_plain_lyrics / has_synced_lyrics / has_midi` + status (`draft/importing/ready/failed/archived`). The Library's chips/dots derive from these.
- **`werecode.assets`** — typed by `kind`. **Per-stem _audio_ is already first-class:** `stem_vocals / stem_drums / stem_bass / stem_other / stem_guitar / stem_piano` + `stems_manifest`. Also `analysis_json`, `midi`, `note_events`, `musicxml`, `tab_musicxml`, `source_audio/midi/musicxml`. Assets live in **3 owner-scoped private buckets** (`werecode-sources` / `werecode-artifacts` / `werecode-previews`) with RLS keyed on `auth.uid()`; each asset can carry `pipeline_version` for staleness.
- **`source_kind`** on songs already includes upload values: `audio_upload`, `midi_upload`, `musicxml_upload` (alongside `manual`, `youtube`, `youtube_music`).
- **`werecode.song_versions.version_kind`** includes `stem`, `analysis`, `transcription`, `midi_edit` — per-artifact versioning hooks already exist.
- **`werecode.jobs`** orchestrates stages (`separate`, `analyze`, `midi_transcribe`, `midi_analyze`, …) through the Modal chokepoint `modalFetch`; `analysis_results`, `lyrics`, `midi_edit_sessions` are first-class rows.

### The precise gaps to build (this is the actual Prep A scope)

1. **No path to _upload trusted stems + per-stem MIDI as sources._** Today stems exist only as **derived** artifacts of the `separate` job, and MIDI only as output of `midi_transcribe`. There is no intake that accepts **user-provided, human-verified** stems + per-stem MIDI and marks them authoritative (bypassing the weak auto pipeline). **Build:** an upload flow + intake that writes uploaded stems/MIDI as assets (to `werecode-sources` as uploaded sources, vs. `werecode-artifacts` for machine-derived) with explicit **provenance** (uploaded-source vs. derived), so the coach knows the data is trustworthy.
2. **Per-stem _analysis_ and per-stem _MIDI_ are not first-class.** The asset `kind` enum has per-stem *audio* but **no per-stem analysis and no per-stem MIDI** — `analysis_json` is full-mix and `midi` / `note_events` are full-track; the `analyze` / `midi_transcribe` jobs are whole-song. The architecture's **role axis** (architecture §4: `time-level × role`) needs analysis + MIDI **per stem/role**. **Build** one of: (a) new asset kinds (`stem_midi_*`, a per-stem analysis kind) + per-stem `analyze` / `midi_transcribe` jobs, or (b) generalize `analysis_results.asset_id` (already a nullable FK to an asset) to carry per-stem analysis rows + add per-stem MIDI assets. **⟳ decide-at-build** — (a) is cleaner for query symmetry with per-stem audio.

### What to upload (custom-upload contract)

full audio · name · artist/group · lyrics *(stored now; lyrics coaching is out of scope — see PRD)* · stems (per-instrument audio) · MIDI full · MIDI stems (per-stem MIDI). Each lands as a `werecode.assets` row (sources in `werecode-sources`, derived/analysis in `werecode-artifacts`) under the owner prefix.

**Definition of done:** a song can be created with uploaded, human-verified per-stem **audio + MIDI + analysis**, stored as owner-scoped assets and queryable per `(song, stem)` the way the POC's fact pack expects (mix + per-stem) — so the Slice-1 `Section × Role` graph has a trustworthy substrate.

## 2. Prep B — Agent UI + Developer Feature Flags

**Goal:** a place to build and exercise the coach during development without exposing it on prod — following WereCode's existing fenced-dev-surface pattern exactly.

### Ground truth: the Pipeline surface is the working template

WereCode already fences a developer-only surface the way Maestro needs:

- **Flag helper** — `isPipelineEnabled()` in `src/lib/flags.ts`: on automatically in local `next dev` (`NODE_ENV === 'development'`) or when `NEXT_PUBLIC_ENABLE_PIPELINE === 'true'`; otherwise hidden everywhere (Vercel preview + prod). One helper gates both nav (client) and route guard (server) so they never disagree.
- **Nav gating** — `src/components/shell/AppShell.tsx` conditionally adds the Pipeline nav item on `isPipelineEnabled()`.
- **Route guard** — `src/app/app/pipeline/page.tsx`: `if (!isPipelineEnabled()) redirect('/app/library')`, then renders `<AppShell><PipelineClient /></AppShell>`.

### What to build (mirror Pipeline)

1. **`isMaestroEnabled()`** in `src/lib/flags.ts` (`NEXT_PUBLIC_ENABLE_MAESTRO === 'true' || NODE_ENV === 'development'`), gating a Maestro nav item in `AppShell.tsx` and a route guard in a new **`src/app/app/maestro/page.tsx`** + a `MaestroClient` feature — the exact shape of `src/app/app/pipeline/page.tsx` + `PipelineClient`.
2. **Built separately from the studio "ask-coach."** That surface is the **static `AICoachDock`** in `src/features/studio/StudioClient.tsx` (toggled by the `werecode:toggle-coach` event / `?coach=1`): canned per-mode suggestions + a non-functional input, and **explicitly excluded from the product baseline**. Maestro is its own flagged surface, **not** a retrofit of that dock. (The marketing `MaestroChat.tsx` / `Concierge.tsx` are scripted landing demos, also not the agent.)
3. **Dev inspection behind the flag** — the comprehension-graph viewer + the agent reasoning trace (PRD stories 27–28) live on the Maestro dev surface, hidden on prod like Pipeline.

**Definition of done:** a developer can drive Maestro end-to-end at `/app/maestro` behind `isMaestroEnabled()`, inspect its stored artifacts + trace, and ship nothing to prod until intended.

## 3. Existing Starting Points (reuse vs. build fresh)

**Reuse from WereCode (confirmed in code):**

- **Data substrate** — the `werecode` schema (songs / assets / jobs / versions / analysis_results), 3 private buckets, RLS, `pipeline_version` staleness, and the `modalFetch` Modal chokepoint. Prep A **extends** this (per-stem analysis/MIDI + trusted upload); it does not replace it.
- **Fenced-dev-surface pattern** — `isPipelineEnabled()` + the `/app/pipeline` page + nav gating. Prep B mirrors it for `/app/maestro`.
- **Doc + issue conventions** — `docs/execution_docs/` for build tracking; `.scratch/<feature>/` for PRDs/issues.

**Reuse from the POC (`modal_apis/Maestro`) — patterns, ported to TS/Modal as needed:**

- `SongFactPackService` (`build` / `ensure_current` / `query` / `_save`, source-hash invalidation, latest + history) — the template for every artifact store (architecture §8).
- The 7 bounded query tools, the 4 specialists + DeepAgents wiring, the `_agent_trace`, and the confidence model (detected vs. teaching key, meter/chord confidence).

**Do NOT reuse (does not exist):** a "base LangGraph QA agent" in WereCode — there isn't one (see §0).

## 4. Sequencing

```
Prep A (data: trusted upload + per-stem analysis/MIDI storage)
Prep B (agent UI /app/maestro + isMaestroEnabled())
        │  both unblock ▼
Slice 1  Section × Role graph + Section-Aware Guitar Briefing   (architecture doc §6)
Slice 2  Phrase/Bar deepening + Learning-path sequencer
Slice 3  Concept Cards / Drill Templates + Drill generator
Slice 4  Learner Model online + Adaptive coaching
Slice 5  Event × Role deepening + Solo-guitar arrangement (capstone)
(Slice 6 deferred: cross-student meta — leave a seam)
```

- **Prep A is the hard dependency for everything** — no accurate per-stem data ⇒ no trustworthy comprehension graph ⇒ no coaching. Do it first.
- **Prep B can proceed in parallel** with Prep A; it's required to *exercise* Slice 1.
- The **minimal store persistence** for the three stores (Theory KB / Comprehension Graph / Learner Model) is introduced *with Slice 1* — as Supabase tables in the `werecode` schema (the POC has none; architecture §3).

## 5. Open Items — Resolved vs. Still Open (post-WereCode study)

**Resolved by the study (now grounded in §§1–3):**

- ✅ Backend track/stem/analysis **data model + storage** — `werecode` schema + buckets; per-stem *audio* exists, per-stem *analysis/MIDI* is the gap (§1).
- ✅ **Feature-flag mechanism** — `isPipelineEnabled()` pattern; mirror as `isMaestroEnabled()` (§2).
- ✅ Studio **ask-coach** — the static `AICoachDock`; Maestro is a separate surface (§2).
- ✅ Base **LangGraph QA agent** — **does not exist**; the agent is greenfield (§0, §3).
- ✅ Where these **docs** live — `docs/maestro/` (canonical) + `.scratch/maestro-coach/` pointer (this move).

**Still open (⟳ decide-at-build, not now):**

- ⟳ **Agent runtime** — Modal-hosted Python (via `modalFetch`) vs. TS-in-Next (§0). Recommended: Modal.
- ⟳ **Per-stem modeling** — new `stem_midi_*` + per-stem analysis asset kinds vs. generalizing `analysis_results.asset_id` (§1).
- ⟳ **Store persistence** — the three stores as Supabase tables in the `werecode` schema, introduced with Slice 1 (architecture §3).

## 6. Status Tracker

| Item | Status | Notes |
|---|---|---|
| Product PRD | ✅ Done | `docs/maestro/maestro-coach-prd.md` (+ `.scratch/maestro-coach/` pointer) |
| Architecture & alignment doc | ✅ Done | `docs/maestro/maestro-agent-architecture.md` |
| Build-flow doc (this) | ✅ Grounded | §§0–3 grounded against WereCode code |
| WereCode study | ✅ Done | Schema, flags, agent-absence, runtime split confirmed |
| Docs ported to WereCode | ✅ Done | `docs/maestro/` + `.scratch/maestro-coach/` + `docs/README.md` pointer |
| Prep A — trusted stem/MIDI upload | ⬜ Not started | Hard dependency for all slices |
| Prep A — per-stem analysis/MIDI storage | ⬜ Not started | New asset kinds/jobs or generalized `analysis_results` |
| Prep B — agent UI (`/app/maestro`) | ⬜ Not started | Mirror `/app/pipeline` |
| Prep B — `isMaestroEnabled()` flag | ⬜ Not started | Mirror `isPipelineEnabled()` |
| Slice 1 — Section briefing | ⬜ Not started | Tracer bullet; introduces store persistence |
| Slices 2–5 | ⬜ Not started | Per roadmap |
| Slice 6 — cross-student meta | ⬜ Deferred | Seam only |
