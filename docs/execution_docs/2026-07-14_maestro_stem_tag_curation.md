# Execution Doc: Stem identity curation — the role axis briefs consume

**Date**: 2026-07-14
**Status**: In Progress
**Owner**: LuDraGa (agent-driven)
**Ticket**: [#9 Stem-tag editing UI](https://github.com/LuDraGa/guitar-newsician/issues/9) · Map: [#6 maestro-cohort-ready](https://github.com/LuDraGa/guitar-newsician/issues/6)
**Branch**: `maestro/agent-buildout`

## Objective

Let a learner curate a stem's identity — its **label** and its **tags** — from the Studio
mixer, and make that curation actually reach Maestro: the edit must invalidate the fact
pack, which re-keys the Comprehension Graph, which makes the next brief/drill speak in
lead-vs-rhythm instead of hedging on three identical "Guitar"s.

## Context

#7's live duel and #1's brief both landed on the same wall: the seed's three guitars carry
a generic `Guitar` label and **no tags**, so the agent cannot tell lead from rhythm. #1
shipped the honest response — a whole-identity twin hedge (`brief.py:200-215`) that refuses
to assign a role it cannot justify — and pointed here. Section × Role briefs consume exactly
this axis, so the axis has to be curatable.

### What the code says (read before planning)

- **Identity lives in `assets.metadata`**, not a column: `{id, role, label, tags}`, written by
  the single canonical writer `createStemMetadata` (`src/lib/music/stem-metadata.ts:122`) on
  upload (`LibraryClient.tsx:1652`) and on Modal separation (`modal-workflows.ts:419`).
- **The agent already reads exactly that**: `list_stems` → `_stem_info` → the pack's parts
  roster (`werecode_data.py:95-118`), and the twin hedge keys on the whole `(role, label, tags)`
  tuple (`brief.py:215`). So editing metadata is the right write — no new agent plumbing.

### The finding that shapes this ticket

**A tag edit is invisible to Maestro today.** `SongFactPackService.ensure_current`
(`fact_pack.py:73`) rebuilds only when `asset_checksums` moves — and that is
`assets.checksum_sha256`, a hash of the **audio bytes**. Editing `metadata` never touches it.
The staleness chip is blind the same way: `dependency_signature` = those checksums + analysis
row signatures.

So a naive edit UI would be a lie: the learner marks a guitar "lead", the pack stays cached,
`pack_key` (`v{version}|{created_at}`, `comprehension_graph.py:37`) never moves, and the warm
graph nodes keep serving the old hedged identities forever.

**Closing that gap is part of #9, not a follow-up.** Fold a per-stem identity hash into the
assets fingerprint → an edit moves the fingerprint → the pack rebuilds → new `created_at` →
new `pack_key` → the graph nodes **key-miss and recompute**. That is #2's rule exactly:
invalidation is a key miss, never a deletion; the old rows stay as history. It costs no MIDI
download — the fingerprint is metadata-only, so `status()` stays a cheap poll.

### The second wrinkle: curated tags must not be overwritten by derived ones

Both readers backfill tags from pipeline guesses — `inst_class`, `midi_program_name`,
`plugin_name` (TS `getStemInfo:172-180`, Python `_stem_info:503-517`). A user who *removes* a
tag that happens to be derived would watch it reappear on the next read. So curation must be
**marked** (`stem_identity_curated: true`) and, when marked, both readers trust the stored
list and skip the derived backfill. Mirrored in both languages or the surface lies again.

## Decisions (user, 2026-07-14)

- **Surface**: Studio mixer stem rows — the identity line (`StudioClient.tsx:1394`) already
  renders `label · tags`; make it editable in place. Real product surface, PRODUCT/DESIGN apply.
- **Edit scope**: **label + tags**. Role stays fixed (changing it moves the asset `kind` —
  bigger blast radius, ruled out of this ticket).
- **Vocabulary**: a small controlled chip set the agent's prompts can lean on, **plus** a
  free-text escape hatch.

## Plan

### A. Write path (Next/Supabase, RLS by existing policy)

- [ ] `PATCH /api/songs/[songId]/assets/[assetId]` — new route, mirroring the POST pattern
      (`getWereCodeRequestContext` + `requireOwnedSong`, user client, `owner_id` filter). No new
      table → no new RLS; `assets` RLS already keys on `owner_id`.
- [ ] `updateStemIdentitySchema` (zod, `server/werecode/schemas.ts`): `label?` (1–60 chars),
      `tags?` (≤8, each 1–24 chars). Reject non-stem-audio kinds.
- [ ] Rewrite identity through the **one canonical writer** (`createStemMetadata`), merging over
      the existing metadata so the mirrored keys (`stem`, `stem_id`, `stem_label`, `stem_tags`,
      `role`) never drift. Stamp `stem_identity_curated: true` + `stem_identity_curated_at`.
- [ ] Apply to **every asset sharing the stem's `stem_id`** (audio + `stem_midi_*` + per-stem
      analysis), because identity is the stem's, not one asset's.

### B. Curation-aware readers (both languages, same rule)

- [ ] TS `getStemInfo`: when `stem_identity_curated`, tags = stored list only (no `inst_class` /
      `midi_program_name` / `plugin_name` backfill).
- [ ] Python `_stem_info` (`werecode_data.py:503`): same rule, mirrored.
- [ ] `SUGGESTED_STEM_TAGS` in `stem-metadata.ts` — guitar-first controlled vocabulary
      (lead, rhythm, clean, distorted, acoustic, solo, riff, fills…), one source of truth.

### C. Invalidation seam (the finding)

- [ ] `WereCodeSongData.asset_checksums` gains `identity:<stem_id>` → hash of `role|label|tags`.
      One change reaches **both** consumers: `ensure_current` (rebuild) and `dependency_signature`
      → `status()` (the staleness chip).
- [ ] `_asset_change_reason` gets an `identity:` branch → "You renamed or retagged <stem>."
      instead of the meaningless "Updated asset: identity."
- [ ] Consequence, accepted: adding a fingerprint key makes every **existing** pack look stale
      once → exactly one rebuild per song on first `ensure_current`. Seed-only today.

### D. Studio UI (DESIGN.md primitives)

- [ ] `StemIdentityEditor.tsx` — inline editor on the stem row: label input, controlled tag chips
      (toggle), free-text add, Save/Cancel. Chips = Maple Shade pill + Rosin selected.
- [ ] **Repo gotcha (memory + #3):** the unlayered `button { background: none }` reset beats
      Tailwind bg utilities — set chip backgrounds inline or via the existing `.chip` / `.pill`
      classes.
- [ ] Optimistic local asset update on save; honest note that Maestro will re-study the song.

### E. Gates

- [ ] `cd maestro && uv run pytest` — deterministic, no live LLM. New tests: identity edit moves
      `asset_checksums`; `ensure_current` rebuilds on a retag; `status()` reports a retag reason;
      a graph node stored under the old `pack_key` is **not** recalled after a retag (key miss).
- [ ] `pnpm typecheck` + `pnpm lint`.
- [ ] **Live try-it (user, HITL)**: retag the seed's three guitars (Lead / Rhythm / Clean), then
      ask Maestro to brief the chorus. Expect: the twin hedge is **gone**, the brief names lead vs
      rhythm, and the node comes back `computed_fresh` under a **new** `pack_key` — not recalled.

## Non-goals

- Role re-assignment (would rewrite the asset `kind`).
- Preserving curation across a **re-separation** (that mints new assets, so curation resets) —
  worth a caution in the UI, not a fix here.

## Progress Log

### 2026-07-14 — Plan

**Action**: Read the identity path end to end (TS writers/readers, Python pack + graph),
grilled the three open decisions with the user.
**Result**: Plan above. The ticket's real content turned out to be the invalidation seam, not
the form: without it the edit UI would be cosmetic.
**Notes**: Approved by user.

### 2026-07-15 — Built (A–E, awaiting live verify)

**Action**: Implemented all five parts.

- **A. Write path** — `PATCH /api/songs/[songId]/assets/[assetId]` (new). Owner-scoped
  (`getWereCodeRequestContext` + `requireOwnedSong`), stem-audio kinds only, rewrites identity
  through `createStemMetadata`, and lands on every asset sharing the stem's `stem_id`. Drops the
  identity keys (incl. the legacy top-level `tags`) before merging, so no stale copy can
  out-vote the new identity on read. `updateStemIdentitySchema` in `server/werecode/schemas.ts`.
- **B. Curation-aware readers** — `stem_identity_curated` now marks a human's answer; both
  `getStemInfo` (TS) and `_stem_info` (Python) then trust the stored tags and skip the
  `inst_class` / `midi_program_name` / `plugin_name` backfill. `SUGGESTED_STEM_TAGS` (guitar-first)
  added as the one vocabulary source.
- **C. Invalidation seam** — `asset_checksums` gained `identity:<stem_id>` → `_identity_hash`
  (sha256 of role|label|tags, order/case-insensitive). Reaches both `ensure_current` (rebuild) and
  `dependency_signature` → `status()`. `_asset_change_reason` gained an `identity:` branch.
- **D. Studio UI** — `StemIdentityEditor.tsx`; a pencil control on each stem row opens it inline.
  Chips use the repo's tokens (`--line`/`--card`/`--ink`), backgrounds set inline (the unlayered
  `button { background: none }` reset).
- **E. Gates** — **172/172 pytest** (163 → 172; 9 new in `tests/test_stem_identity.py` covering all
  four seams), `pnpm typecheck` clean, `pnpm lint` clean.

**Result**: Green on every deterministic gate. Live try-it pending (user runs the servers).
**Notes**: The key-miss test is the one that proves the ticket: same audio checksum, moved
identity hash → rebuilt pack → new `pack_key` → the warm node is re-derived while the pre-retag
node **stays in the table as history**.
