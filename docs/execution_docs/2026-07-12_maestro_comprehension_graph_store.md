# Maestro — Ticket #2: Durable Comprehension Graph store

**Status:** RESOLVED (2026-07-12) — committed + pushed, #2 closed on the map.
**114/114 pytest green**, SQL applied by the user, `:8000` restarted, all three
try-it legs passed (fresh `computed_fresh` $0.158/53s with the `gpt-5.5`
judgment → recall `graph_recall` **$0.005/10s, no judgment call, 31× cheaper**
→ rebuild busts → `computed_fresh` again; table holds history + current,
`status()` reads 2/1). Frontier advanced to #3 + #4 + #9.
**Ticket:** [maestro-brief-drill 02](https://github.com/LuDraGa/guitar-newsician/issues/2) · map [#6](https://github.com/LuDraGa/guitar-newsician/issues/6)
**Branch:** `maestro/agent-buildout`
**Blast radius:** first persistence layer — one new `werecode` table (RLS day one, per the map). Everything else stays in `maestro/`.
**Sources:** PRD · architecture §4/§6 (fact-pack pattern) · #1's exec doc · `supabase/sql/2026-07-12_werecode_maestro_feedback.sql` (RLS template)

## What this slice is

Make #1's ephemeral node durable: `brief_region` writes its Section×Role node to
a per-song Comprehension Graph; re-asking a **warm** region serves the stored
node — **no second judgment pass** — and the trace shows `source: graph_recall`
instead of `computed_fresh`. A fact-pack rebuild invalidates naturally (the
lookup keys on pack identity, so stale rows simply never match). Population
stays lazy per region.

## Design

### The table — `werecode.maestro_comprehension_graph`

New SQL file `supabase/sql/2026-07-12_werecode_maestro_comprehension_graph.sql`
(user runs it in the Supabase SQL editor — a HITL step before live verify):

```sql
create table werecode.maestro_comprehension_graph (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references werecode.songs(id) on delete cascade,
  node_type text not null,          -- 'section_role_brief' now; phrase/bar later
  region_key text not null,         -- canonical region: 'sections:1,4,5,6'
  pack_key text not null,           -- 'v6|<created_at>' — the _agent_cache_key tail
  graph_version int not null,       -- COMPREHENSION_GRAPH_VERSION (node schema)
  node jsonb not null,              -- the full brief node
  created_at / updated_at timestamptz,
  unique (song_id, node_type, region_key, pack_key, graph_version)
);
-- + owner/song indexes, set_updated_at trigger, RLS enable,
--   owner_all policy (owner_id = auth.uid() AND werecode.is_member(auth.uid()))
--   — the exact maestro_feedback shape.
```

### Locked decisions (user-revised 2026-07-12)

1. **Per-region node grain**, with the **#4 seam made explicit**: one row per
   queried region (the tracer discipline); `ensure_current(song_id, region,
   interpret)` and `query(song_id, region)` are **the composition point #4's
   drill calls directly** — drill fills a cold region through this service
   (brief's formula + judgment), NEVER a parallel rollup. "Brief section 4"
   after a chorus brief recomputes (accepted); revisit grain at #4 when drill's
   real read pattern exists — a `graph_version` bump makes remigration cheap.
2. **Stale rows stay as history** (fact-pack pattern): new `pack_key` → old
   rows simply never match. No deletes, no `is_current` flag; cleanup deferred.
3. **Read path for the #3 surface deferred to #3** — #2 ships store + recall
   only; the node already rides the chat trace for inspection.

Key decisions:

- **Invalidation = key miss, not deletion.** The fact-pack pattern: new pack →
  new `pack_key` → lookup misses → recompute + new row. Old rows become history
  (cleanup deferred). `pack_key` reuses the `_agent_cache_key` identity
  (version + created_at) so a same-version re-analysis busts too.
- **Canonical `region_key` from resolved section indexes** — "the chorus" /
  "CHORUS" / "3" that resolve to the same sections converge on one node. Pure
  function over `resolve_region`'s output.
- **`graph_version` is the node-schema version** (own constant, NOT
  `FACT_PACK_VERSION`) — bumping it orphans old-shape rows the same way.
- **Failed judgment is never persisted** — an `interpretation.status !=
  "ok"` node returns fresh but doesn't cache the failure; next ask retries.
- **Service-role writes** (same trust model as the fact pack); RLS protects the
  future user-scoped read path from day one.

### New module — `maestro/maestro_agent/comprehension_graph.py`

`ComprehensionGraphService(fact_pack)` mirroring `SongFactPackService`:

| Method | What it does |
|---|---|
| `build(song_id, region, interpret)` | compute via `build_brief_node` + persist (skip persist on error/failed judgment) |
| `ensure_current(song_id, region, interpret)` | **the brief_region path**: resolve region → `region_key` → lookup `(song, node_type, region_key, pack_key, graph_version)` → hit: return stored node with `source: "graph_recall"` (interpret never invoked); miss: `build` → `source: "computed_fresh"` |
| `query(song_id, region)` | read-only lookup (no compute) — #4's drill will use it |
| `status(song_id)` | node count + how many match the current pack key (freshness view) |

Adapter additions in `werecode_data.py` (the only two data methods):
`get_graph_node(...)` + `save_graph_node(...)` (upsert on the unique key — a
concurrent race converges instead of erroring). **No product CRUD.**

### Wiring (`agent.py`)

`brief_region`'s body swaps `build_brief_node(pack, ...)` for
`graph.ensure_current(song_id, region, interpreter)` (service built lazily in
the tool body — introspection never touches data). Docstring gains the recall
sentence. Story-14 trace: the node's `source` field rides the tool span — a
recalled turn also visibly lacks the `brief-judgment` generation and its ~$0.14.

## Tests (Seam A/B, no live LLM, fake adapter)

`maestro/tests/test_comprehension_graph.py` — in-memory fake for the two
adapter methods; #1's `_pack()` fixture pattern; counting stub interpreter.

- build → persist: row keyed `(song, node_type, region_key, pack_key, graph_version)`; node round-trips.
- ensure_current twice → interpret called ONCE; second node `source: graph_recall` (test 5).
- pack rebuild (new created_at, same version) → miss → recompute (`computed_fresh`, interpret count 2).
- `graph_version` bump → miss → recompute.
- region canonicalization: "the chorus" / "CHORUS" → same `region_key` → recall.
- failed judgment (`status: unavailable`) → returned but NOT persisted; next ask retries.
- unknown region → error, nothing saved.
- Seam B: `brief_region` docstring names recall; registration intact; `region_key` pure-function tests.

Gate: `cd maestro && uv run pytest`. No `FACT_PACK_VERSION` bump.

## Acceptance-criteria mapping

| Criterion | Where |
|---|---|
| service mirrors fact-pack interface; persisted + own version constant | `ComprehensionGraphService` + `COMPREHENSION_GRAPH_VERSION` |
| cache key (song, region, pack version) busts on rebuild | `pack_key` (version+created_at, the `_agent_cache_key` pattern) + rebuild test |
| re-ask serves from graph, no second interpretation; trace fresh-vs-cached | `ensure_current` hit path + `source` field + Seam A test; live: recalled turn has no `brief-judgment` span |
| Seam A build → persist → invalidate, no LLM | test file above |
| no Python product CRUD; one `werecode` table only | two adapter methods + one SQL file |

## Live try-it (after user runs the SQL + restarts `:8000`)

1. "Brief the chorus for a guitarist." → fresh: `source: computed_fresh`, `brief-judgment` span present, row lands in the table.
2. Same ask again (new conversation) → recall: `source: graph_recall`, **no judgment span**, turn cost ≈ nano-only, fast.
3. `POST /fact-pack/build` (rebuild → new pack identity) → same ask → recomputes fresh.

## Implementation checklist (next session)

1. `supabase/sql/2026-07-12_werecode_maestro_comprehension_graph.sql` (template: the feedback SQL).
2. `maestro/maestro_agent/comprehension_graph.py` — service + `COMPREHENSION_GRAPH_VERSION = 1` + pure `region_key`.
3. `werecode_data.py` — `get_graph_node` / `save_graph_node` (upsert on the unique key).
4. `agent.py` — `brief_region` body → `ensure_current`; docstring gains recall sentence.
5. `maestro/tests/test_comprehension_graph.py` — the Seam A/B list above.
6. Gate green → **user runs the SQL + restarts `:8000`** → live try-it (fresh → recall → rebuild) → commit + push → resolve #2 on the map.

## Progress log

- 2026-07-12 — plan drafted; revised with the user (grain / stale rows / read
  path — see Locked decisions) and **approved**. Implementation deliberately
  deferred to a fresh session (user call). GitHub claim on #2 skipped —
  assignment was permission-denied on #1; same constraint.
- 2026-07-12 (second session) — **implemented per the checklist; 114/114 pytest
  green.** Claim on #2 succeeded this time (assignment took). Files landed:
  1. `supabase/sql/2026-07-12_werecode_maestro_comprehension_graph.sql` — the
     table + indexes + `set_updated_at` trigger + RLS `owner_all` policy, the
     exact `maestro_feedback` shape. **NOT yet applied — HITL step.**
  2. `maestro/maestro_agent/comprehension_graph.py` —
     `ComprehensionGraphService` (`build / ensure_current / query / status`),
     `COMPREHENSION_GRAPH_VERSION = 1`, pure `region_key(section_indexes)` →
     `'sections:1,2'` + `pack_key(pack)` → `'v6|<created_at>'`.
  3. `werecode_data.py` — `get_graph_node` (exact-key read of `node`),
     `save_graph_node` (upsert on the unique key so a concurrent race
     converges), **+ `list_graph_node_meta`** (see deviations).
  4. `agent.py` — `brief_region` body → `graph.ensure_current(...)` (service
     built lazily in the tool body; introspection never touches data);
     docstring gained the recall sentence (`graph_recall`, no second
     interpretation pass, rebuild recomputes).
  5. `maestro/tests/test_comprehension_graph.py` — 13 Seam A/B tests: the
     spec's list (persist round-trip · interpret-once/recall · rebuild bust ·
     `graph_version` bust · canonicalization convergence · failed judgment not
     persisted + retry · unknown region saves nothing) **+ query read-only +
     status counts + pure key tests**. In-memory `_FakeGraphData` deep-copies
     both ways so aliasing can't hide; reuses #1's `_pack()` fixture.
  - **Deviations from the locked spec (both small, flagged for the resolution
    comment):** (a) the adapter grew a **third** graph method,
    `list_graph_node_meta(song_id)` — `status()` needs a count and an
    exact-key read can't produce one; key columns only, the `node` jsonb never
    crosses the wire, still zero product CRUD. (b) a persisted or recalled
    node now carries **`ephemeral: False`** (the flag was #1's "not yet
    durable" marker; leaving it `True` on a stored row would lie) — error /
    failed-judgment nodes keep `ephemeral: True` and are never persisted.
    `brief.py` docstrings updated to match (#2 no longer "future").
  - **Next:** the two HITL steps (SQL + `:8000` restart) → live try-it
    (fresh → recall → rebuild) → commit + push → resolve #2.
- 2026-07-12 (same session) — **LIVE-VERIFIED.** User applied the SQL in the
  Supabase editor + restarted `:8000`; agent-driven try-it against the live
  service (seeded song, chat seat pinned to `openai/gpt-5.4-nano` for
  comparability with #1's baselines — the env default seat is currently
  `gpt-5.5`; `brief_model` stays `gpt-5.5` regardless):
  1. **Fresh** — "Brief the chorus for a guitarist." → one `brief_region`
     call, node `source: computed_fresh`, `ephemeral: false`, region resolved
     to `sections:1,4,5,6` (the spec's literal example key); usage shows the
     `gpt-5.5` judgment ($0.152 of the $0.158 turn), 53s; **row landed** with
     `pack_key v6|2026-06-17T10:46:08Z`.
  2. **Recall** — same ask, new conversation → `source: graph_recall`,
     **no `gpt-5.5` call in usage** (nano-only), **$0.005 vs $0.158 = 31×
     cheaper, 10s vs 53s**; node content matches (same section indexes).
  3. **Rebuild bust** — `POST /fact-pack/build` → same v6, new
     `created_at 2026-07-12T11:43:29Z` (the same-version case `pack_key` was
     built for) → re-ask → `computed_fresh` again ($0.086 — judgment re-ran on
     a warm prompt cache), node keyed to the new pack identity.
  - Table after: **2 rows, same `region_key`, two `pack_key`s** — old row is
    history, not deleted; `status()` reads `node_count 2 / current_node_count
    1` with the new key current. Acceptance criteria all observed live.
  - **Awaiting the user's commit ask** → commit + push → resolve #2 on the map.
