# PRD: Marketing landing at `/`, app under `/app/*` behind a soft gate, Studio transport section labels

Status: ready-for-agent

> Companion working doc: `execution docs/2026-06-10-landing-page-and-app-routing.md`
> (live checklist + verified architecture notes). Source design material lives in `Newsician/`
> (`Woodshed.html`, `site-*.jsx`, `transport-bar.jsx`, `screenshots/new_transport.png`).

## Problem Statement

Today, hitting the app at `/` immediately redirects to `/library` — there is no front
door. A prospective user lands straight inside the product with no explanation of what it
is, who it's for, or why they'd want it. Separately, the product app and any future
marketing live in the same flat route space, and access control is inconsistent: each
surface (Library, Studio picker) renders its own ad-hoc sign-in gate, so the
logged-out experience is fragmented. Finally, the Studio transport already shows song
sections, but the section labels don't match the polished, legible treatment from the
committed design — the active section doesn't read as clearly as it should.

## Solution

Give the product a real front door and a clean front-of-house / back-of-house split:

- The **marketing landing** (the Claude-designed page in `Newsician/`) becomes the home
  page at `/`, server-rendered as idiomatic React, freely browsable with no login.
- The **product app** moves under `/app/*` (`/app/library`, `/app/studio`,
  `/app/studio/[songId]`, `/app/pipeline`).
- A **single soft auth gate** covers all `/app/*` surfaces: when logged out, the app
  content is blurred and a central floating login CTA invites sign-in. Logged-in users
  see the app normally. The landing has no gate.
- The **Studio transport section labels** (the section ruler row and the current-section
  pill by the time readout) are restyled to match the design — quiet inactive labels,
  an accent-highlighted active section, full names, and a cohesive current-section chip.

Delivered in two phases: **Pass 1 (wiring)** = route move + gate + transport restyle;
**Pass 2 (deep port)** = rewrite the landing into the app's component/styling system.

## User Stories

1. As a first-time visitor, I want `/` to show a marketing landing instead of redirecting into the app, so I understand the product before committing.
2. As a visitor, I want the landing served as a fast, server-rendered page (not compiled in my browser), so it loads instantly and can be indexed.
3. As a visitor, I want a hero that frames the product's promise, so I grasp the value in seconds.
4. As a visitor, I want value-prop, features, who-it's-for, and FAQ sections, so I can evaluate whether the product fits me.
5. As a visitor, I want to ask the in-page Coach (Octavia) questions about the product, so I can get answers without leaving the page.
6. As a visitor, I want to submit my email to a waitlist and see a confirmation, so I feel I've registered interest (capture is intentionally non-persisting in this pass).
7. As a visitor, I want a clear call-to-action that takes me into the app, so I can start using it.
8. As a visitor on a phone, I want the landing to be fully responsive, so it reads well on any device.
9. As a visitor, I want the landing to use the committed design system (Luthier's Bench tokens, Schibsted/Hanken/JetBrains type), so it feels like one coherent product.
10. As a returning user, I want the product app to live under `/app/*`, so the marketing site and the workbench are clearly separated.
11. As a user, I want every in-app link (top nav, library cards, command search, the Studio back-to-library link) to keep working after the move, so navigation is never broken.
12. As a user who signs in, I want to be returned to `/app/library` after the auth callback, so I arrive at my workbench.
13. As a user, I want `/app/pipeline` to redirect sensibly when the feature is disabled, so I'm never stranded.
14. As a logged-out user hitting any `/app/*` route, I want the app content blurred behind a central floating login CTA, so it's obvious I must sign in to proceed.
15. As a logged-out user, I want one consistent gate across all app surfaces rather than a different gate per page, so the experience is coherent.
16. As a logged-in user, I want app routes to render normally with no gate or blur, so I'm never interrupted.
17. As a visitor on `/`, I want no login gate at all, so marketing is freely browsable.
18. As a player in the Studio, I want the transport's section ruler to clearly show the song's sections, so I can read the song's structure at a glance.
19. As a player, I want the currently-playing section highlighted with the design's accent treatment (soft accent fill, bold accent-ink text, accent border), so I always know where I am.
20. As a player, I want inactive section labels to sit quietly (card/faint styling, small bold type), so the active one stands out.
21. As a player, I want section names shown in full, truncating only when a segment is too narrow, so labels stay readable.
22. As a player, I want the current-section pill next to the time readout to match the design (layers icon, accent chip), so the transport feels finished and cohesive.
23. As a player, I want clicking a section label to still seek to that section, so navigation behavior is preserved.
24. As a maintainer, I want the landing's code artifacts named for "marketing/landing" and never "woodshed", so the codebase naming is unambiguous.
25. As a maintainer, I want the marketing copy preserved verbatim (Octave / Octavia / "take it to the woodshed"), so we don't prematurely commit to an Octave↔WereCode brand decision.
26. As a maintainer, I want the in-browser design "tweaks panel" dropped and the committed accent/hero hardcoded, so no dev-only tooling ships to production.
27. As the implementing agent, I want the route move guarded by typecheck and build, so any stale route reference fails fast.
28. As the implementing agent, I want the work phased (wiring, then deep port), so structural changes can be reviewed before the large landing rewrite lands.
29. As a reviewer, I want Pass 1 to be independently reviewable and committable, so I'm not handed one enormous diff.

## Implementation Decisions

**Phasing.** Two passes. Pass 1 is pure wiring/restyle (route move, auth gate, transport
labels) and is committable on its own. Pass 2 is the deep landing port.

**Routing.**
- The product app moves from the unprefixed `(app)` route group to a real `/app`
  URL segment, yielding `/app/library`, `/app/studio`, `/app/studio/[songId]`,
  `/app/pipeline`.
- All internal route references are repointed: the app shell's nav and logo link, the
  Library client's cards, the Studio picker, the Studio client's back-to-library link,
  command search, the auth callback's post-sign-in redirect (now `/app/library`), and the
  pipeline disabled-redirect (now `/app/library`).
- `typedRoutes` is on, so any missed reference is a compile error — this is the primary
  guard for the move.

**Auth gate.**
- The app shell module already owns the session provider and wraps every app page. The
  soft gate lives there: when there is no session, render the app content blurred with a
  centered floating login CTA; when authenticated, render normally.
- The gate is presentational only — no middleware, no redirect-based protection.
- The two existing per-surface sign-in gates (Library, Studio picker) are removed; the
  shell-level gate is the single source of truth.

**Landing (Pass 2).**
- The `Newsician/site-*.jsx` sources (currently React 18 UMD + Babel-standalone using
  `window.WS` / `window.SITE` globals) are rewritten as idiomatic React (App Router)
  components in a new marketing feature module, styled with Tailwind + the existing
  `globals.css` design tokens. `marketing.css` is not carried over (its tokens already
  exist in `globals.css`); any genuinely bespoke styling (animations, the Studio-glimpse
  mock, complex gradients) is reproduced with arbitrary Tailwind values or scoped CSS.
- The landing renders at `/` (replacing the redirect) and does **not** mount the app shell.
- Component inventory to port: nav, hero, value-props, features, who-for, FAQ, contact,
  final CTA, footer, Coach (Octavia) widget, waitlist modal, and the Studio-glimpse hero mock.
- The Coach is ported with its simulated local-knowledge-base retrieval intact (no LLM,
  no backend).
- The waitlist modal is ported with its UI and confirmation state, but submission is
  **non-persisting** (left with an explicit TODO). No table, RLS, or API route in this pass.
- The dev-only tweaks panel and its EDIT-MODE block are dropped; the committed accent
  (`#d97a2b`, "rosin") and hero direction (`bench`) are hardcoded.
- Marketing copy is preserved verbatim; only code identifiers are renamed to
  "marketing/landing".
- The landing's "enter the app" CTA points to `/app/library`.

**Studio transport section labels.**
- The Studio client's section ruler is restyled to the design: small bold tight labels,
  quiet card/faint styling for inactive segments, soft-accent fill with bold accent-ink
  text and an inset accent border for the active segment, and full section names that
  truncate only when a segment is too narrow (the current explicit abbreviation step is
  dropped). Click-to-seek behavior is unchanged.
- The current-section pill beside the time readout adopts the design: the layers icon
  replaces the current diamond icon, on the existing accent chip styling.

**Fonts / tokens.** No new font wiring — `globals.css` already imports the full
Schibsted/Hanken/JetBrains set and defines all the tokens the design uses.

## Testing Decisions

This repo has **no test framework and no existing tests**, so there is no prior art or
test seam to reuse, and standing up a runner is out of scope for this pass. A good test
here verifies externally observable behavior (a route resolves, a gate shows/hides, a
label reads correctly), never implementation details.

The seam this PRD commits to is the one that already exists plus visual verification:

- **Route integrity (automated, highest existing seam):** `pnpm typecheck` (with
  `typedRoutes`) and `pnpm build` must pass. Because every internal link is a typed route,
  the type checker is a complete guard that the `/app/*` move left no dangling reference and
  introduced no route collision. This is the primary, decisive check for Pass 1's routing.
- **Auth gate (visual/behavioral):** with the preview tooling, confirm a logged-out
  `/app/*` route shows the blurred content + central floating login CTA, and a logged-in
  session renders the app with no gate; confirm `/` shows the landing with no gate.
- **Transport section labels (visual):** compare the running Studio transport against
  `Newsician/screenshots/new_transport.png` — inactive labels quiet, active section
  accent-highlighted, full names, current-section pill with the layers icon.
- **Landing (visual, Pass 2):** confirm `/` renders all sections, the Coach answers from
  its local KB, the waitlist modal opens and shows its confirmation, and the layout is
  responsive; compare against the `Newsician/screenshots/` design captures.

If automated coverage is wanted later, a Playwright smoke suite (route reachability, gate
visibility, landing render) is the natural addition — filed as a follow-up, not built here.

## Out of Scope

- **Octave ↔ WereCode brand reconciliation** — copy stays verbatim; the canonical brand is a
  separate decision.
- **Real waitlist persistence** — no Supabase table, RLS, or API route this pass; the modal
  is UI-only.
- **Hard auth** — no middleware or redirect-based route protection; the gate is presentational.
- **Auth-aware `/`** — logged-in users still see the marketing landing; no auto-skip into the app.
- **A test framework / automated suite** — relying on existing type/build guards + visual
  verification; a Playwright smoke suite is a deferred follow-up.

## Further Notes

- Verified architecture facts that de-risk the work: there is no `(app)/layout.tsx` (each
  app page wraps itself in the app shell, which owns the session provider — the clean home
  for the gate); the route move is a folder rename from the `(app)` group to a real `app`
  segment; the marketing tokens are identical to `globals.css`.
- Supabase OAuth dashboard config is unaffected — only the *post-callback internal* redirect
  target changes (to `/app/library`); the provider callback path is unchanged.
- The Studio-glimpse hero mock is the single heaviest port in Pass 2 (bespoke inline styles).
- The user repeatedly chose the more thorough option over the quick one during planning;
  treat "do it properly and idiomatically" as the through-line, the "minimal comprehension"
  phrasing in the original ask notwithstanding.
