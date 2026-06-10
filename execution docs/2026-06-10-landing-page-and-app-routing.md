# Landing page port + `/app` routing + Studio transport section labels

- **Created:** 2026-06-10
- **Branch:** `core-flow-rework`
- **Status:** ✅ **Pass 1 & Pass 2 complete & verified.**
  - **Pass 1** — route move + shell gate + transport restyle. `/`→`/app/library`, gate blurs +
    floats sign-in CTA, transport matches `new_transport.png`.
  - **Pass 2** — deep landing port. `/` now renders the marketing landing (statically prerendered,
    no redirect, no AppShell) from a new idiomatic-TSX feature module `src/features/marketing/`.
    `pnpm typecheck` + `pnpm lint` (0 errors) + `pnpm build` green. Browser-verified: all sections
    render with verbatim copy (hero, 5 value props, 6 features, who-for, 10-item FAQ, contact, final
    CTA, footer); StudioGlimpse hero mock faithful; Coach (Octavia) retrieves from the local KB with
    `kb/*` chips; FAQ "Ask Octavia" reopens the Coach; waitlist modal submits (UI-only) → confirmation
    + spot #; "Open the app" → `/app/library`; mobile stacks/collapses correctly; no hydration
    mismatch (rounded StudioGlimpse/CoverArt derived styles).
- **Delivery:** Phased — Pass 1 (wiring) reviewed/committed before Pass 2 (deep port).

## Goal

Bring the Claude-designed marketing landing (`Newsician/Woodshed.html` + `site-*.jsx`)
into the app as the real home page at `/`, move the product app under `/app/*` behind a
soft login gate, and give the Studio transport's section labels the design's polished look.

## Source material

- Landing design: `Newsician/` — `Woodshed.html` loads `site-data`, `site-shared`,
  `site-hero`, `site-sections`, `site-contact`, `site-waitlist`, `site-chatbot`,
  `site-app` (+ dev-only `tweaks-panel`). React 18 UMD + Babel-standalone, `window.WS`
  / `window.SITE` globals. Tokens in `marketing.css` are identical to `globals.css`.
- Transport target look: `Newsician/screenshots/new_transport.png` and
  `Newsician/transport-bar.jsx` (section map lines 56–111; current-section chip line 252).

## Resolved decisions (from grilling)

| Topic | Decision |
|---|---|
| Integration | **Port** `site-*.jsx` → idiomatic React 19 **TSX** (not static serve). |
| Routing | Landing at `/`; **app routes move to `/app/*`**. |
| Auth | **Soft gate**: blur app + central floating login CTA on `/app/*` when logged out. No middleware. |
| Port styling | **Deep**: rewrite to Tailwind + `globals.css` tokens, drop `marketing.css`. |
| Branding | **Copy verbatim** (Octave / Octavia / woodshed stay). Rename only code artifacts → "marketing/landing". Octave↔WereCode reconciliation deferred. |
| Waitlist | **Port as-is, non-persisting**, with TODO. No backend this pass. |
| Coach (Octavia) | Port as-is — self-contained canned retrieval, no backend. |
| TweaksPanel | **Drop**; hardcode accent `#d97a2b` (rosin) + hero `bench`. |
| Section labels | Restyle **both** the ruler row **and** the time pill to the design. |
| Gate coexistence | Global gate **replaces** the two per-surface `SignInGate`s. |
| Delivery | **Phased**: Pass 1 wiring → review → Pass 2 deep port. |

## Architecture notes (verified)

- No `(app)/layout.tsx`; each app page wraps itself in `<AppShell>`, which **owns
  `SessionProvider`**. → Global gate lives **inside `AppShell`** (one edit, all `/app`
  routes, replaces per-surface gates).
- Route move = rename folder `src/app/(app)/` → `src/app/app/`.
- Fonts already load app-wide via `globals.css` `@import` — no extra wiring for `/`.
- `typedRoutes: true` will fail the build on any stale `/library|/studio|/pipeline` ref — free safety net.

---

## Pass 1 — wiring (fast, low-risk) — ✅ implemented (visual verify in progress)

Move + gate + transport restyle. Reviewable/committable on its own.

### 1a. Route move `(app)` → `/app/*` — ✅
- [x] `git mv src/app/(app)/` → `src/app/app/` (library, studio, studio/[songId], pipeline).
- [x] Repoint internal refs `/library`→`/app/library`, `/studio`→`/app/studio`,
      `/pipeline`→`/app/pipeline`, `/studio/${id}`→`/app/studio/${id}`:
  - [x] `src/components/shell/AppShell.tsx` (nav, logo link, `inSongStudio` prefix, comments)
  - [x] `src/features/library/LibraryClient.tsx` (two card links)
  - [x] `src/features/studio/StudioPicker.tsx` (empty-state link + card link)
  - [x] `src/features/studio/StudioClient.tsx` (back-to-library link)
  - [x] `src/components/shell/CommandSearch.tsx` (router.push + empty-state link)
  - [x] `src/app/api/auth/callback/route.ts` (all 4 redirects → `/app/library`)
  - [x] `src/app/app/pipeline/page.tsx` redirect (→ `/app/library`)
  - [x] `src/app/page.tsx` redirect (→ `/app/library`; landing replaces this in Pass 2)
- [x] `pnpm typecheck` clean + `pnpm build` green; build route table shows `/app/library`,
      `/app/pipeline`, `/app/studio`, `/app/studio/[songId]`.

### 1b. Auth gate in `AppShell` — ✅
- [x] Single soft gate inside `AppShell` (`ShellContent` + `AppAuthGate`): when
      `session.authEnabled && !session.user`, blur content via `filter` (keeps Studio's
      fixed-height flex layout intact) + central floating sign-in CTA overlay.
- [x] Removed `SignInGate` usage in `LibraryClient` + `StudioPicker`; deleted now-dead
      `src/components/auth/SignInGate.tsx` (shell gate is the single source of truth).
- [x] Visual: forced-`locked` shows blurred content + floating CTA (topbar stays crisp);
      reverted → logged-in renders normally (no gate/blur). Dev has `authEnabled:false`, so the
      live gate can't trigger without auth; verified via a temporary force + revert.

### 1c. Studio section labels → design look — ✅
- [x] `renderSectionRuler`: 8.5px bold, `tracking .02em`, `--card-2`/`--faint` inactive,
      `--accent-soft` + bold `--accent-ink` active (`inset 0 0 0 1px --accent`), full names
      with truncation; dropped `abbreviateSection` + `SECTION_ABBREVIATIONS` (now dead).
- [x] Current-section time pill: `Diamond` → `Layers` icon on `chip accent`; removed dead
      `Diamond` import.
- [x] Visual: matches `new_transport.png` — inactive `--card-2`/`--faint` 8.5px bold, active
      `--accent-soft` + `--accent-ink` + accent border (`Chorus 1`), current-section pill shows
      the `lucide-layers` icon on `chip accent`. Backgrounds set inline (see gotcha below).

### Two unblocking fixes made outside the literal Pass 1 checklist
1. **Tailwind source scope** (`src/app/globals.css`): added `source("..")` to the
   `@import "tailwindcss"`. v4 was auto-scanning the whole project root, and a markdown
   execution doc that quotes an arbitrary-value utility JIT-compiled to invalid CSS, 500-ing
   the Turbopack dev server on *every* route (pre-existing; it was already down before this work).
   Scoping detection to `src/` fixes it and stops future docs from breaking dev. (`pnpm build`
   tolerates the bad rule, so prod was unaffected — only dev.)
2. **Section-ruler background via inline style** (`StudioClient.tsx`): globals.css has an
   *unlayered* `button { background: none }` reset. Per CSS cascade-layer rules, unlayered
   declarations beat any `@layer utilities` rule, so a `bg-[var(--card-2)]` utility on a
   `<button>` was overridden to transparent (a `<div>` with the same class worked). Set the
   segment background inline — matching how `Newsician/transport-bar.jsx` does it.

---

## Pass 2 — deep landing port — ✅ implemented & verified

- [x] New `src/features/marketing/` with idiomatic TSX (globals.css tokens + scoped `marketing.css`):
      `MarketingNav`, `MarketingHero` (bench only), `ValueProps`/`Features`/`WhoFor`/`FAQ`
      (`MarketingSections`), `Contact`/`FinalCTA`/`Footer` (`MarketingContact`), `Coach`,
      `WaitlistModal`, `StudioGlimpse`, `MarketingPrimitives` (Pill/Logo/Reveal/CoverArt/EmailCapture/
      SectionHead/HeroAnnot), `MarketingIcon`, and `MarketingLanding` root.
- [x] Content/data module `marketing-content.ts` from `site-data.jsx` (typed `BRAND`, `VALUE_PROPS`,
      `FEATURES`, `WHO`, `ANTI`, `FAQS`, `INSTRUMENTS`/`SKILL_LEVELS`/`HEARD`, `KB`).
- [x] Replaced `src/app/page.tsx` redirect → renders `<MarketingLanding/>` at `/` (no `AppShell`),
      with verbatim `<title>`/`<meta description>`. Statically prerendered (`○ /`).
- [x] Dropped `TweaksPanel`/`EDITMODE`. Hero `bench` and the rosin accent are the committed
      `globals.css` tokens (no runtime `--accent` override; `#d97a2b` ≈ the existing oklch rosin) —
      `HeroDemo` not ported (would be dead code under a hardcoded direction).
- [x] Concierge (Octavia) ported with canned retrieval intact (token-scored KB, no LLM/backend).
      Reframed as the **buyer/customer-facing site concierge** (not the in-product Studio coach):
      `Coach.tsx` → `Concierge.tsx`, `ws-open-coach` → `marketing:open-concierge`, `.coach-panel`/
      `coach-typing` → `.concierge-panel`/`concierge-typing`. In-product "coach" copy (KB answers,
      hero "Ask the coach" tag) stays verbatim — that describes the Studio coach, correctly.
- [x] Concierge guardrails — three-tier handling for queries the KB can't answer:
      (1) out-of-guardrails (piracy/redistribution/reselling, checked before greetings) → firm
      on-brand refusal restating "learn from music you own"; (2) on-topic but unanswered (weak KB
      signal or a domain-lexicon hit) → hand off to the team with a "Talk to the team" button that
      closes the panel and scrolls to `#contact` (+ the team email); (3) off-topic & harmless →
      polite redirect to what it covers. Confident KB hits and general-music answers are unchanged.
- [x] Contact-intent routing: explicit "talk to the devs / a human / the team" now routes to the
      contact tier (CTA button) instead of the off-topic redirect (`wantsHuman` in `Concierge.tsx`).
- [x] Agent-name reconciliation (per user): the product has **two** agents — **Octavia** (the site
      concierge) and **Maestro** (the in-product Studio coach). Renamed every in-product coaching
      reference from "Octavia"/"the coach" → **Maestro** across hero, value props, the flagship
      feature card, FAQ, page metadata, and the concierge KB (`kb/octavia` → `kb/maestro`, plus a new
      `kb/concierge` so "what is Octavia / who's the in-app assistant" answer correctly). Octavia
      stays the concierge widget only. Saved to memory (`octave-agent-names`).
- [x] Waitlist UI ported, non-persisting + explicit `TODO`s (modal + contact form). Modal mounts
      only while open (fresh state on open; avoids `set-state-in-effect`).
- [x] Nav "Open the app" CTA → `/app/library` (typed route; ghost, hidden on mobile so the waitlist
      stays the single accent action per the Rosin Rule).
- [x] Copy verbatim (Octave / Octavia / woodshed); all artifacts named marketing/landing.
- [x] `marketing.css` NOT carried over; only the landing-specific primitives + responsive helpers
      live in a scoped `src/features/marketing/marketing.css` (all selectors under `.marketing`).
      Added the one missing companion token `--live-ink` to `globals.css`.
- [x] Hydration: rounded StudioGlimpse waveform-bar heights and CoverArt ring dims/opacity so the
      browser CSSOM doesn't re-serialize derived floats into an SSR/client mismatch.
- [x] Guards: `pnpm typecheck` + `pnpm lint` (0 errors; added `Newsician/**` to eslint ignores,
      matching the existing `newsician 2/**` design-source ignore) + `pnpm build` all green; browser
      verification passed (see Status).

## Deferred / out of scope

- Octave ↔ WereCode brand reconciliation.
- Real waitlist persistence (Supabase table + RLS + API route).
- Hard middleware auth (redirect-based route protection).
- Auth-aware `/` (logged-in users still see marketing).

## Open risks

- Supabase OAuth dashboard redirect URLs: only the *post-callback internal* redirect
  changes (→ `/app/library`); the provider callback path `/api/auth/callback` is unchanged.
- StudioGlimpse mini-mock is the heaviest single port (bespoke inline styles).
