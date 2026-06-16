# Maestro — Fact Pack Freshness (stale detection + chat-window signal)

| | |
|---|---|
| **Date** | 2026-06-16 |
| **Status** | 🟢 Built — backend + UI done, **31/31 pytest · typecheck · lint green**; awaiting live try-it (not committed) |
| **Branch** | `maestro/agent-buildout` |
| **Owner** | Claude (Opus 4.8) |
| **Slots into** | [2026-06-16_maestro_slice0_fact_pack_comprehension.md](2026-06-16_maestro_slice0_fact_pack_comprehension.md) — a new sub-slice, built **before 0.3** (live-try-it finding from 0.2b) |

---

## Why this exists (the live finding)

During the 0.2b live try-it, the user re-ran per-stem analysis (multi-guitar + bass). The agent only picked up the new analysis because the `FACT_PACK_VERSION` 4 bump forced a rebuild — **not** because the pack noticed its inputs changed.

Root cause: `ensure_current` ([fact_pack.py](../../maestro/maestro_agent/fact_pack.py)) only rebuilds when an **asset checksum** changes (`source_hashes` = `asset_checksums`, *assets only*) or the version bumps. But per-stem analysis is read from `analysis_results` **rows** ([werecode_data.py](../../maestro/maestro_agent/werecode_data.py)) anchored to a `stem_analysis_json` asset. **A re-analysis writes a new row against the same asset → no asset-checksum change → `ensure_current` never notices → the agent serves a stale pack.**

The user's mental model (correct): *a rebuild is required when a part the fact pack depends on updates* — and they want that **surfaced** in the chat window with a choice to update or skip, not a silent slow rebuild.

## Design (approved)

A clean separation between **detection** (a cheap read-only signal) and **action** (the existing rebuild), so the chat path's behaviour doesn't change and "skip" is the default:

- **`ensure_current` stays as-is** — assets + version auto-rebuild backstop (covers new uploads + format bumps). Re-analysis is *not* added to its trigger, so the chat keeps answering from the current pack = "skip by default", no surprise slow rebuilds.
- **A dependency fingerprint** is stored in the pack at build, covering everything it reads: asset checksums **+** the identity (version + `created_at`) of the current, non-synthetic `analysis_results` rows (mix + per-stem). This makes a re-analysis detectable even when no asset checksum changes.
- **A cheap, read-only `status(song_id)`** recomputes the current fingerprint from **metadata only** (no MIDI download, no rebuild) and diffs it against the stored one → `{ has_pack, stale, version, current_version, built_at, reasons[] }`.
- **Update** reuses the rebuild path that already exists end-to-end: `buildPack()` → `POST /api/maestro/fact-pack` → `/fact-pack/build` → `fact_pack.build`.

### UX (approved: **Both**)
- **Always-on banner** above the chat whenever `status.stale` — names what changed (`reasons`), offers **Update** (rebuild + re-check) and **Dismiss**.
- **Blocking confirm at send** — sending while stale (and not yet acknowledged) opens **Update & send** / **Skip**. "Skip" sets an ack so it stops nagging for that staleness; "Update & send" rebuilds then sends. A successful Update clears ack + dismiss.

### Decisions
1. **Detection ≠ action.** Fingerprint + `status` are read-only; `ensure_current`'s rebuild trigger is unchanged. — *keeps the hot chat path fast and predictable; makes "skip" free.*
2. **Fingerprint covers analysis rows, not just assets** (version + `created_at` of current non-synthetic `analysis_results`). — *the actual gap; robust whether or not re-analysis happens to change an asset checksum.*
3. **`status` is metadata-only** (no MIDI, no build). — *cheap enough to call on song-select and after each turn.*
4. **`FACT_PACK_VERSION` 4 → 5** so every pack rebuilds once and gains `dependency_fingerprint`; `status` has a legacy fallback (source_hashes + version) for any pack built before the field existed.
5. **Reuse the existing build seam for Update** — no new rebuild endpoint.
6. **Auto-rebuild backstop for true asset changes (uploads) stays.** Only re-analysis becomes "stale → you choose". *(Flagged to the user; change later if they want all staleness manual-only.)*

## Sub-tasks

| # | Task | Layer | Seam |
|---|---|---|---|
| F.1 | `dependency_signature` (assets + analysis-row signatures) on the data adapter | `werecode_data.py` | A |
| F.2 | Store `dependency_fingerprint` in the pack at build; `FACT_PACK_VERSION`→5 | `fact_pack.py` | A |
| F.3 | `SongFactPackService.status()` + pure `_fingerprint_reasons` diff | `fact_pack.py` | A/B |
| F.4 | `GET /fact-pack/{song_id}/status` route | `app.py` | B |
| F.5 | `getFactPackStatus` + type in the transport client | `src/lib/maestro/client.ts` | C |
| F.6 | `GET /api/maestro/fact-pack/[songId]/status` (gated + owned) | `src/app/api/maestro/...` | C |
| F.7 | MaestroClient: fetch status; always-on banner; blocking send confirm; Update wiring | `src/features/maestro/MaestroClient.tsx` | UI |

## Testing
- **Tier 1 pytest (no live LLM):** Seam A — `_fingerprint_reasons` pure diff (stale on version/`created_at`/asset change, fresh when identical; legacy fallback when no stored fingerprint). Seam B — `status()` assembly over a fake adapter (has_pack / stale / reasons bounded). Run `cd maestro && uv run pytest`.
- **TS:** `pnpm typecheck` / `pnpm lint` for the route + client + MaestroClient.
- **Tier 2 live try-it (user, inspection):** re-run a stem's analysis → banner appears with a reason → blocking confirm on send → Update rebuilds and clears it; Skip answers from the current pack. (User runs `pnpm dev`; do not launch a preview.)

## Status tracker

| Item | Status | Notes |
|---|---|---|
| Diagnosis + design approved | ✅ | detection≠action; fingerprint covers analysis rows; UX = Both; build now (before 0.3) |
| F.1 dependency_signature | ✅ | `analysis_signatures` (version+created_at of current non-synthetic rows, keyed `stem:<id>:<analyzer>` / `mix:<analyzer>`) + `dependency_signature` in `werecode_data.py` |
| F.2 store fingerprint + version→5 | ✅ | pack stores `dependency_fingerprint`; `FACT_PACK_VERSION`→5 |
| F.3 status() + reasons diff | ✅ | `SongFactPackService.status()` (read-only, no build) + pure `_fingerprint_reasons` (dedupes per scope, caps at 6) |
| F.4 status route (agent) | ✅ | `GET /fact-pack/{song_id}/status` in `app.py` |
| F.5 client helper + type | ✅ | `getFactPackStatus` + snake→camel mapping in `src/lib/maestro/client.ts`; client-safe `MaestroFactPackStatus` in `src/types/werecode-client.ts` |
| F.6 Next status route | ✅ | `GET /api/maestro/fact-pack/[songId]/status` — `isMaestroEnabled()` gate + `requireOwnedSong` |
| F.7 MaestroClient UI (banner + send confirm) | ✅ | always-on stale banner (Update) + blocking send confirm (Update & send / Skip & send); ack keyed to reasons; status refetched on select / build / turn / manual refresh |
| pytest (Seam A/B) | ✅ | `tests/test_fact_pack_freshness.py` — 11 tests; full suite **31 passed** |
| typecheck / lint | ✅ | `pnpm typecheck` + `pnpm lint` clean (Node 22) |
| Seam C (Next route test) | ⬜ | no Next route tests exist in the repo (sibling fact-pack routes have none); route mirrors them 1:1 — deferred for consistency, covered by typecheck/lint |
| Live try-it | ✅ | verified in the UI: v4→v5 banner on first load; after re-analyzing a stem the banner named the real changes ("The mix analysis was re-run. Stem S03 was re-analyzed."). Stem id is read live (not hardcoded). |
| Watch-item | 🟡 | re-analyzing one stem also surfaced "mix analysis re-run" — confirm the pipeline intends to refresh a current mix `analysis_json` row on stem analysis (expected) vs. over-reporting. Low priority. |

## Progress log

### 2026-06-16 — sub-slice opened
- Live 0.2b try-it surfaced the staleness gap; design approved (detection≠action, fingerprint over analysis rows, UX = always-on banner + blocking send confirm, build before 0.3). Doc created; implementing F.1→F.7.

### 2026-06-16 — built, 31/31 pytest · typecheck · lint green
- **Backend (`maestro/`)**: `werecode_data.analysis_signatures` + `dependency_signature` (assets + current non-synthetic analysis-row identities); pack now stores `dependency_fingerprint`; `FACT_PACK_VERSION`→5. `SongFactPackService.status()` is read-only (no MIDI, no build) and diffs stored vs current via the pure `_fingerprint_reasons` (per-scope dedupe, 6-reason cap, legacy-pack fallback to the version check). New `GET /fact-pack/{song_id}/status`. `ensure_current` deliberately **unchanged** (assets+version backstop) so re-analysis is "skip by default".
- **Frontend (`src/`)**: `getFactPackStatus` transport helper (snake→camel) + client-safe `MaestroFactPackStatus` type; gated `GET /api/maestro/fact-pack/[songId]/status`. MaestroClient: always-on stale banner with an **Update** button; `send` is now guarded — a stale, unacknowledged pack opens a blocking **Update & send / Skip & send** confirm; the ack is keyed to the staleness reasons so a *new* change re-prompts; status is refetched on song-select, after a build, after each turn, and on manual refresh. Reused the existing build seam for Update (no new rebuild endpoint).
- **Tests**: `tests/test_fact_pack_freshness.py` (11) — pure fingerprint diff (reanalysis / new+updated assets / mix re-run / dedupe / cap / missing-stored) + `status()` assembly (no-pack, fresh, reanalysis-without-asset-change, version mismatch). Full suite **31 passed**. `pnpm typecheck` + `pnpm lint` clean on Node 22.
- **Seam C**: no Next route tests exist in the repo; the new route mirrors the sibling fact-pack route 1:1, so deferred for consistency (typecheck/lint cover it).
- **Next**: ⏸ live try-it (restart the agent — version→5 forces one rebuild, so the first load shows a "format changed" stale banner; clicking Update clears it). Then 0.3 trim → 0.5 → 0.6 → 0.8.

### 2026-06-16 — live try-it ✅ (verified in the UI)
- User restarted the agent and exercised the banner: (1) first load showed **"Maestro's analysis format changed (v4 → v5)"** (the one-time version bump); (2) after re-analyzing a stem the banner correctly named the live changes — **"The mix analysis was re-run. Stem S03 was re-analyzed."** Stem id is read from the re-analyzed asset's metadata (not hardcoded). The detection + naming path works end to end.
- **Watch-item (not a blocker):** a single-stem re-analysis also reported "mix analysis re-run" — almost certainly because the analysis pipeline refreshes a current mix `analysis_json` row when a stem is analyzed (so its `created_at` moves and the fingerprint honestly flags it). Confirm that's intended before treating it as noise.
- **Status:** Freshness sub-slice **complete & verified**; ready to commit. Resume at 0.3 trim next.
