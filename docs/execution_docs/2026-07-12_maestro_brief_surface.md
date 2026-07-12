# Maestro — Ticket #3: Brief surface (structured node in sandbox)

**Status:** BUILT + LIVE-VERIFIED (2026-07-12) — awaiting the user's commit ask.
**Ticket:** [maestro-brief-drill 03](https://github.com/LuDraGa/guitar-newsician/issues/3) · map [#6](https://github.com/LuDraGa/guitar-newsician/issues/6)
**Branch:** `maestro/agent-buildout`
**Blast radius:** Next/TS only (`src/features/maestro/`). Zero Python changes, zero new routes, zero schema.
**Sources:** PRD (`.scratch/maestro-brief-drill/PRD.md`) · #2 exec doc (node shape, `source` seam) · `MaestroClient.tsx` (trace/JsonViewer/stale-banner patterns)

## What this slice is

Render the stored Comprehension Graph brief node as **structured comprehension**
in the Maestro sandbox: when a turn called `brief_region`, the chat shows the
node as per-section cards — mix story vs guitar focus, per-part rows with
status/confidence, hedges and abstentions, a fresh-vs-recalled badge, and a
freshness note when the underlying pack has changed. The structure comes from
the **node in the turn's trace** (which IS the stored node — `ensure_current`
returns the persisted row on recall), never from the loop's prose.

## The read-path decision (deferred here by #2)

**Render from the chat trace; add no new read endpoint.** `brief_region`'s tool
action already carries the full node in `trace.actions[].response.content`
(JSON-parsed by `_parse_json_maybe`). So:

- No new `:8000` route, no new `/api/maestro/*` route → **Seam C gating is
  inherited by construction** (the page redirects unless `isMaestroEnabled()`;
  every existing API route is gated).
- A chat-free graph browser (pick region → `GET /graph/...`) is **deferred**
  until a real need; #4's drill reads the graph server-side via
  `query`/`ensure_current`, not HTTP.

## Design

### New file — `src/features/maestro/BriefCard.tsx`

- `extractBriefNodes(trace)` — pure: walk `trace.actions`, keep tool responses
  whose content is an object with `node_type === 'section_role_brief'`; skip
  error nodes (unknown region — the prose already answers honestly).
- `<BriefCard node currentPack factPackStatus onOpen>` renders one node:
  - **Header:** region labels + section indexes; **source badge** —
    `computed_fresh` → "Fresh" / `graph_recall` → "Recalled" (story-14 seam,
    test 5 visible in the UI); overall + identity confidence chips; pack
    identity (`v{pack_version}`).
  - **Freshness note** (amber, `AlertTriangle`, the stale-banner pattern) when
    the node's pack identity (`pack_version` + `pack_created_at`) ≠ the
    currently loaded pack's, OR `factPackStatus.stale` — "the song/pack changed
    since this brief".
  - **Summary:** `interpretation.summary`.
  - **Per-section card:** human label (`section` kind preferred) + time range;
    **Mix** = `mix_story`; **Guitar focus** = `guitar_focus`; **hedges** +
    **abstentions** listed explicitly (never dropped).
  - **Per-part rows (the role axis):** label · role · tags · status chip
    (`active` / `silent` / `unmeasured_here` / `unanalyzable`) ·
    `generic_label` flag · confidence. Click a row → the existing slide-over
    drawer with `JsonViewer` of the full part row — **per-claim evidence paths
    + confidence inspectable** (test 3). Header button opens the whole node in
    the drawer.
- Section entries with flags render them; parts are never dropped from the
  table (mirrors the formula's no-silent-drop rule, test 2).

### Wiring — `MaestroClient.tsx`

Assistant messages render `extractBriefNodes(message.trace)` as cards **above
the prose** (structure first, narration second), passing `setDrawer`,
`factPack`, `factPackStatus`. No other behavior changes.

## Acceptance-criteria mapping

| Criterion | Where |
|---|---|
| stored node renders structured per-role (test 4) | `BriefCard` per-section parts rows from `node.data` |
| per-claim evidence + confidence visible (test 3) | confidence chips inline + drawer `JsonViewer` per part row |
| freshness indicator on pack change | pack-identity mismatch + `factPackStatus.stale` → amber note (status pattern) |
| `isMaestroEnabled()` + Seam C | no new routes; page + API gating unchanged |

## Gate

- `pnpm typecheck` + `pnpm lint` (no frontend test runner exists; the repo's
  deterministic gate for TS is tsc+eslint).
- `cd maestro && uv run pytest` — untouched, run to confirm still green.
- **Live try-it (user runs `pnpm dev` + `:8000`):**
  1. "Brief the chorus for a guitarist." → card renders: sections, mix vs
     guitar focus, parts rows with the 3 generic Guitars + 3 Organs hedged,
     badge **Fresh**.
  2. Same ask, new conversation → same structured card, badge **Recalled**.
  3. Rebuild the fact pack → the old card shows the freshness note; re-ask →
     **Fresh** again.

## Progress log

- 2026-07-12 — claimed #3 on the map (assignment took after user approval);
  context loaded (PRD, #2 exec doc, `MaestroClient.tsx`, `brief.py`,
  `comprehension_graph.py`, trace shape in `agent.py`); read-path decision
  drafted (trace-driven, no new routes); plan written — **approved**.
- 2026-07-12 (same session) — **implemented + gate green + live-verified.**
  Files: `src/features/maestro/BriefCard.tsx` (new — `extractBriefNodes` +
  `BriefCard`), `MaestroClient.tsx` (cards render above the assistant prose,
  wired to `setDrawer` / `factPack` / `factPackStatus`). Gate: `pnpm
  typecheck` + `pnpm lint` clean; `cd maestro && uv run pytest` 114/114 (no
  Python change). **Agent-driven live try-it** (user's `pnpm dev` + `:8000`,
  chat seat nano, seeded Track00001), all three legs:
  1. **Recall** — "Brief the chorus for a guitarist." → one `brief_region`
     call, card **Recalled** · conf low · identity low · v6, keyed
     `v6|2026-07-12T11:43:29Z`; 4 chorus section cards (#1/#4/#5/#6), **40
     part rows = 10 parts × 4 sections (no silent drop)**, 12 hedges + 8
     abstentions rendered; ⚠ generic-label markers on the 3 Guitars + 3
     Organs; part-row click → drawer JsonViewer showing per-claim
     `evidence`/`confidence` (`activity.evidence:
     song_fact_pack.midi.stems[].activity_by_section`, `identity_confidence:
     low`, `generic_label: true`). Turn $0.0058 / 9.9s, nano-only. The card
     also survived a full page reload from the persisted conversation.
  2. **Freshness** — fact-pack Rebuild → the existing card grew the amber
     note "The fact pack was rebuilt after this brief — re-ask to refresh
     it." live, no reload (node key ≠ the reloaded pack identity).
  3. **Fresh** — new conversation, same ask → card **Fresh**, node keyed to
     the new pack (`v6|2026-07-12T16:37:13Z`), no freshness note; runtime
     shows the `gpt-5.5` judgment call (15,416 tok / 28.3s) between the nano
     calls; turn $0.1366 / 38.3s vs the recall's $0.0058 / 9.9s — the
     fresh-vs-recall economics visible from the surface. Browser console
     clean.
  - **Next:** user's commit ask → commit + push → resolution comment + close
    #3 → map Decisions-so-far + handoff pointer updates.
- 2026-07-12 (same session) — **design iteration on user feedback** ("should
  be collapsible, more design thought for comprehension, check what's
  missing"), grounded in PRODUCT.md/DESIGN.md via `/impeccable` (product
  register):
  - **Collapsible everywhere, native `<details>`:** the whole card (latest
    turn open, older turns render collapsed via `defaultOpen`), each section
    (first open, repeat-choruses collapsed behind an informative summary line
    "chorus #4 · 1:12–1:38 · 10/10 parts active"), parts behind "10 parts · 6
    generically labeled", hedges/abstentions behind "3 hedges · 2 unknowns".
  - **Hierarchy:** header (region "chorus ×4" + Fresh/Recalled + conf-low +
    pack-changed chips) → summary → **new meta chip row** (teaching key,
    detected-key conflict, bpm, judged-by model, pack version — key/tempo and
    the judge model were missing from the first cut) → sections (Mix then
    Guitar focus, `.label` keys) → **new per-section chords meta** ("26 chords
    · conf medium · truncated →" opens the section in the drawer) → part rows
    sorted active → flagged → silent (all still listed; no silent drop).
  - **Design-system fixes:** `surface-flat` instead of a nested shadowed card;
    Ember `chip warn` (not rosin) for staleness/low-confidence/generic flags;
    verdigris text for `active` status; mono `tnum` on every time/count/bpm;
    "conf high" noise dropped from rows (only low/medium show inline; full
    per-claim detail stays in the drawer); no em dashes in copy.
  - **Found + fixed a repo gotcha instance:** the unlayered `button { font:
    inherit; color: inherit }` reset in `globals.css` beats Tailwind's utility
    layer, so `text-[11px]`/text-color utilities are dead on ALL buttons
    (latent app-wide; MaestroClient's small text buttons render 16px ink
    today). The card's two text buttons set size/color inline.
  - Re-gated (tsc + eslint clean) and **re-verified live**: Fresh card with
    meta chips + first-section-open; older Recalled card shows "pack changed"
    chip + Ember note; hedges/parts disclosures render; console clean.
