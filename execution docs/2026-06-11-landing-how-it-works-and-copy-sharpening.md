# Landing: How-it-works section + copy sharpening

**Date:** 2026-06-11
**Status:** Complete (verified in dev)
**Scope:** Landing page only (approved: P1 + P2 from the CRO assessment). Backend
work (waitlist persistence, real queue position) explicitly deferred — assume it
exists / build later.

## Why

An external CRO analysis of the landing page surfaced real gaps after filtering
out its misreads (hero already has one CTA; nav links are already same-page
anchors; feature copy is already benefit-phrased) and its doctrine conflicts
(generic "Learn any song faster" headline rejected — keeps the woodshed
headline; no fabricated social proof; no novice-pandering against the
"players, not day one" positioning):

1. **No "how it works" section** — the page jumps from pain (ValueProps) to a
   tool grid (Features) with nothing showing the path through the product.
2. **Hero subhead leads with mechanism, not outcome** — the PRODUCT.md success
   metric ("under your fingers faster than transcribing by ear") never appears.
3. **"Past the basics" is never made concrete** — players can't tell if they
   clear the bar.
4. **Nav "Open the app" competes visually** with the single waitlist CTA (ghost
   pill + icon vs. the intended quiet escape hatch for soft-launch testers).

## Out of scope (deferred)

- **P0 — waitlist/contact persistence.** Submit handlers are still UI-only
  (`WaitlistModal.tsx`, `MarketingContact.tsx` TODOs). The fabricated queue
  position (`#1,100–1,800` random) stays until a real count exists. This is
  the actual conversion bug; tracked for a later pass.
- **P3 — social proof.** Blocked on real material (testers, quotes, counts).

## Plan

| # | Change | File(s) | Status |
|---|--------|---------|--------|
| 1 | `HOW_STEPS` content (3 beats: Bring the song → It comes apart on the bench → Play it in) | `src/features/marketing/marketing-content.ts` | ✅ |
| 2 | `HowItWorks` section component (`id="how"`, mono step numbers, hairline rows) | `src/features/marketing/MarketingSections.tsx` | ✅ |
| 3 | Mount between ValueProps and Features | `src/features/marketing/MarketingLanding.tsx` | ✅ |
| 4 | Hero subhead: outcome-first ("under your fingers faster than transcribing it by ear") | `src/features/marketing/MarketingHero.tsx` | ✅ |
| 5 | Concrete "past the basics" bar (WhoFor bullet + beginners FAQ) | `src/features/marketing/marketing-content.ts` | ✅ |
| 6 | Demote nav "Open the app" from ghost pill to quiet text link (route + label kept) | `src/features/marketing/MarketingNav.tsx` | ✅ |
| 7 | Typecheck + lint | — | ✅ |
| 8 | Visual verification (dev server, hero + new section, mobile) | — | ✅ |

## Design constraints honored

- Headline/tagline untouched ("Take any song to the woodshed").
- Rosin rule: no new accent usage; waitlist pill remains the single accent
  action in the nav.
- Quiet-eyebrow rule: one eyebrow on the new section.
- Mono step numbers (JetBrains Mono via `.mono`), graphite — no ash body copy.
- New section reuses `SectionHead` / `Reveal` primitives; no new CSS.

## Verification results

- `pnpm typecheck` — clean (Node 22 via nvm; shell default Node 18 fails the
  engines check).
- `pnpm lint` — 0 errors; 132 pre-existing warnings, none in
  `src/features/marketing`.
- Dev server visual pass — desktop (1280) and mobile (375): section renders
  between ValueProps ("The gap isn't talent…") and Features ("One song, taken
  all the way apart."), steps stack with hairlines on mobile, nav "Open the
  app" reads as a quiet text link with the waitlist pill as the single accent
  action, zero console warnings/errors.

## Editorial note (user can veto)

Step 2 keeps the "apart" motif, so three adjacent section headlines now ride
it: "the slog of taking a song apart" → "It comes apart on the bench" → "One
song, taken all the way apart." Kept deliberately as brand reinforcement of
the core metaphor; rename step 2 (e.g. "The bench lays it out") if it reads
as repetitive.
