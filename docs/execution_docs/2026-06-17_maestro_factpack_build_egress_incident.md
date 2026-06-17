# Incident Brief — Maestro SongFactPack build/status Supabase egress

| | |
|---|---|
| **Date** | 2026-06-17 |
| **Branch** | `maestro/agent-buildout` |
| **Scope** | `maestro/` Python only (no schema/Next changes) |
| **Status** | 🟢 #1 + #2 implemented (66/66 pytest green) — awaiting agent restart + live verify. Minor follow-ups (MIDI double-parse, double `get_song`) deferred. |

# Problem & Impact

SongFactPack **build** and **status()** are slow. Cost is Supabase **egress** (JSON `data` blob transfer), not LLM inference and not round-trip count.

- **Build over-fetch.** `_analysis_for_assets` ([werecode_data.py:210](../../maestro/maestro_agent/werecode_data.py)) selects every current `analysis_results` row's full `data` blob for the song, then filters by `asset_id` in Python. It runs once for the mix (`get_mix_analysis`) plus once per analyzed stem (`get_stem_analysis` from `_stem_summary`, [fact_pack.py:223](../../maestro/maestro_agent/fact_pack.py)). For `A` current analysis rows and `S` analyzed stems, the build transfers ≈ `(1 + S) × Σ(all A blobs)` bytes — O(N²)-shaped in stem count. Prior fact-pack rows (the largest blobs) cross the wire on every call despite being discarded (no `asset_id`).
- **Status over-fetch.** `get_latest_fact_pack` ([werecode_data.py:267](../../maestro/maestro_agent/werecode_data.py)) does `select("data")` — pulls the entire latest fact-pack blob to read 3 scalar fields (`version`, `created_at`, `dependency_fingerprint`). Fired on every song-select ([MaestroClient.tsx:296](../../src/features/maestro/MaestroClient.tsx)).
- **Acute trigger.** `FACT_PACK_VERSION` 5→6 ([fact_pack.py:35](../../maestro/maestro_agent/fact_pack.py)) makes `ensure_current` force-rebuild every song's pack once — the macro-cache that normally skips the build is invalidated this cycle.
- **Blast radius.** Egress scales with `stems × analysis-coverage × build-frequency` plus a full-pack pull per status poll. Mild on the seed (2/10 stems analyzed); severe once songs are fully analyzed.

# Root Cause / Debug

1. **N+1 + select-all-then-filter-in-Python** — `_analysis_for_assets` has no server-side `asset_id` filter and no single-fetch/index; called `1+S` times per build.
2. **No `data` projection on status** — `get_latest_fact_pack` selects `data` for 3 fields.
3. **Missing analysis cache** — only `_assets` is process-cached ([werecode_data.py:76](../../maestro/maestro_agent/werecode_data.py)); `analysis_results` is refetched every call.
4. **Double `get_song`** — called in `_build_pack` and again in `get_mix_analysis` for `duration_sec`; uncached.
5. **Stem MIDI parsed twice** — `summarize_midi_bytes` + `note_activity_by_window` ([fact_pack.py:213](../../maestro/maestro_agent/fact_pack.py), [:219](../../maestro/maestro_agent/fact_pack.py)). CPU, not egress.
6. **Verify item** — `save_fact_pack` ([werecode_data.py:255](../../maestro/maestro_agent/werecode_data.py)) does not set `is_current`; if prior fact-pack rows stay `is_current=true` they bloat every `where is_current` scan.

Precedent: `analysis_signatures` ([werecode_data.py:143](../../maestro/maestro_agent/werecode_data.py)) already projects 4 columns and excludes `data` — the correct pattern, not applied to `_analysis_for_assets` or `get_latest_fact_pack`.

# Goal

A fact-pack build issues one `analysis_results` fetch per song (not `1+S`), each query transfers only the rows/columns consumed, and `status()` reads version/created_at/fingerprint without pulling the pack `data` — with `pytest` green and no `FACT_PACK_VERSION` bump.

# Proposed Solution

- **`_analysis_for_assets`** — fetch the song's current analysis rows **once**, index by `asset_id` in memory, resolve mix + all stems from the map; add server-side `.in_("asset_id", list(asset_ids))` and exclude `SYNTHETIC_ANALYZERS` server-side so prior fact packs never transfer. Back it with a process-lived `_analysis_cache[song_id]` invalidated on `save_fact_pack`.
- **`get_latest_fact_pack` / `status()`** — add a metadata read that projects `analyzer_version,created_at,data->dependency_fingerprint` (PostgREST JSON-arrow); keep the full `select("data")` only on the build/`ensure_current`/`query` path.
- **Minor** — cache the `get_song` row (kill the double-fetch); parse each stem MIDI once and feed both summary + activity.
- **Measure** — wrap build + each query in elapsed timing for one instrumented run to confirm the dominant query before/after.

# Task

Implement the egress fixes scoped to `maestro/maestro_agent/werecode_data.py` (+ `fact_pack.py` for the MIDI single-parse and status metadata read). Single-fetch/index + server-side `.in_`/synthetic-exclusion in `_analysis_for_assets`; projected metadata read for `status()`; process-cache analysis rows with save-time invalidation. Preserve the `ensure_current` `source_hashes`+version macro-cache and the staleness signal semantics. No schema or Next/TS changes; no `FACT_PACK_VERSION` bump. Add Seam-A `pytest` coverage (single-query build, projected status, cache invalidation); `cd maestro && uv run pytest` green. Confirm before/after with the instrumented timing run. Ask → Explain → Approve → Implement.

---

## Implemented (2026-06-17) — #1 + #2

**#1 — single-fetch analysis index** ([werecode_data.py](../../maestro/maestro_agent/werecode_data.py))
- New `_analysis_cache[song_id]` (mirrors `_asset_cache`); `_current_analyses` fetches the song's current non-synthetic analysis rows **once** and indexes by `asset_id`; `_fetch_current_analysis_rows` excludes `SYNTHETIC_ANALYZERS` server-side via `.not_.in_("analyzer_name", …)` so prior fact-pack blobs (the biggest rows) never cross the wire.
- `_analysis_for_assets` now resolves mix + every stem from the in-memory map → `(1 + analyzed-stems)`× full-blob pulls collapse to **1**.
- Pure `_index_analyses_by_asset` (drops synthetic + asset-less rows) — Seam-A unit-tested directly.
- `save_fact_pack` pops `_analysis_cache[song_id]` (build = natural refresh point).

**#2 — projected status read** ([werecode_data.py](../../maestro/maestro_agent/werecode_data.py) + [fact_pack.py](../../maestro/maestro_agent/fact_pack.py))
- New `get_latest_fact_pack_meta` selects `pack_version:data->version, pack_created_at:data->created_at, dependency_fingerprint:data->dependency_fingerprint` (PostgREST JSON-path) and normalizes to `{version, created_at, dependency_fingerprint}` — never the whole `data` blob. `status()` reads this instead of `get_latest_fact_pack`; full pack still loads on the build/query path. Output semantics byte-identical (same fields, same source).

**Tests:** `tests/test_werecode_data_egress.py` (+7) — index grouping/exclusion/empty, single-fetch build (mix + 2 stems = 1 fetch; synthetic excluded), missing-stem no-extra-fetch, meta projection select-string + normalization + empty. `tests/test_fact_pack_freshness.py` `_FakeData` switched to `get_latest_fact_pack_meta` only (a regression to the full read would `AttributeError`). **`cd maestro && uv run pytest` → 66 passed.** No `FACT_PACK_VERSION` bump.

**Restart required:** the `:8000` process holds stale code — `cd maestro && uv run uvicorn maestro_agent.app:app --port 8000`. No pack rebuild (no version bump).

**Deferred (minor, not #1/#2):** parse each stem MIDI once ([fact_pack.py:213](../../maestro/maestro_agent/fact_pack.py)/[:219](../../maestro/maestro_agent/fact_pack.py)); cache the double `get_song` in the build; verify `is_current` on stale fact-pack rows.
