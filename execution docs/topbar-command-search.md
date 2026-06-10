# Topbar command search ("Quick open")

## Problem

The global topbar Search button in `src/components/shell/AppShell.tsx` had no
`onClick` — inert on every page (Library, Studio, Pipeline).

## Decision

Wire it into a **global, navigational command palette**, not a duplicate of
Library's inline filter (`src/features/library/LibraryClient.tsx` already owns
that). The palette searches the user's songs and jumps to a song's Studio
(`/studio/[songId]`).

Grounded in PRODUCT.md / DESIGN.md (the "Luthier's Bench" system):

- **Dialog, not heavy modal** — centered `role="dialog"` on a Maple `wc-pop`
  card with `--shadow-pop` + hairline outline, over the subtle scrim/blur the
  existing `DeleteSongDialog` already uses. Product register, "one calm move at
  a time."
- **Rosin discipline** — active row uses `--accent-soft` (Rosin Soft), the
  selection-highlight use DESIGN explicitly sanctions. Focus ring is the shared
  2px Rosin outline.
- **Reuse primitives** — `CoverArt`, `StatusDot`, `useWereCodeDataCache`.
- **a11y** — Esc closes + restores focus, ↑/↓ wrap-navigate, Enter opens;
  `combobox`/`listbox` + `aria-activedescendant`; `wc-pop` is already
  reduced-motion-gated in `globals.css`.

## Implementation notes

- New component: `src/components/shell/CommandSearch.tsx`. Renders BOTH the
  topbar trigger (`iconbtn`) and the overlay, so state stays encapsulated;
  `AppShell` just drops `<CommandSearch />` where the dead button was.
- **⌘K / Ctrl+K** global open, registered in the **capture** phase with
  `stopImmediatePropagation()` + `preventDefault()`. This is required: the
  lyrics editor in `StudioClient.tsx` (~line 3188) listens for a *bare* `k`
  (no modifier check) to stamp a line, so without capture-phase interception
  ⌘K over the editor would both open the palette and stamp a lyric.
- Lazy-load `/api/songs?limit=100` on first open when the cache is cold (mirrors
  `StudioPicker` guard). Inlined a tiny fetch to avoid a `shell -> features`
  layering import.
- Filter predicate matches Library's: title / artist / album / source_url,
  case-insensitive. Empty query shows recents (cache is already sorted
  `updated_at` desc) under a single quiet eyebrow.
- **Active-row highlight is an inline `style`, not a Tailwind `bg-[var(...)]`
  class.** The result rows are `<button>`s, and globals.css has an *unlayered*
  `button { background: none }` reset. Tailwind utilities live in
  `@layer utilities`; per CSS cascade-layer rules an unlayered declaration beats
  any layered one regardless of specificity, so `bg-[var(--accent-soft)]` was
  silently overridden to transparent. Verified in-browser (computed
  `rgba(0,0,0,0)`), then switched to `style={{ background: ... }}` which wins.
  `onMouseMove` promotes a hovered row to active, so the single Rosin-soft
  treatment covers pointer + keyboard.

## Status

- [x] Read AppShell, DESIGN.md, PRODUCT.md, primitives, data cache, Library,
      StudioPicker, globals tokens, Studio key handlers
- [x] `CommandSearch.tsx` component
- [x] Wire into `AppShell.tsx` (replace dead button, drop unused `Search` import)
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] Browser verification (open via click + ⌘K, search, arrow/enter nav, Esc)
