# Landing Page Immersive Rebuild — Execution Doc

**Date:** 2026-06-11
**Status:** PHASE 1 COMPLETE (user-verified in browser) — Phase 2 in progress
**Scope:** `src/features/marketing/*` only. The app (Library/Studio) keeps the light Luthier's Bench system untouched.

## Problem statement (from review)

The current landing page has the right ideas conceptually but fails on four fronts:

1. **Brand:** reads as "Claude colors." Root cause found during grilling: the page
   *faithfully implements* DESIGN.md tokens — warm cream Spruce + amber Rosin +
   grotesk type is itself near-identical to Anthropic's brand. Not a drift; a
   palette-level resemblance.
2. **Copy:** verbose, diffuse attention, complex language hurting reach, unclear
   core message, eyebrow + clever-sentence header template ("FAQ" / "The things
   people ask first"), feature-first instead of user/problem-first, confusing
   two-agent (Maestro/Octavia) story.
3. **Scroll:** 8 stacked sections with heavy overlap (ValueProps ≈ Features),
   too much scroll, too little conversion. Waitlist persistence is a TODO stub —
   signups currently go nowhere.
4. **Immersion:** a silent, static page for a music product. Wanted: motion,
   music, visual composition, tactile feel.

## Decisions (locked)

| # | Branch | Decision |
|---|--------|----------|
| 1 | Brand root | **Landing-only palette divergence.** DESIGN.md stays authoritative for the app; the landing gets its own scoped token set. |
| 2 | Landing identity | **"Lamplit bench at night."** Dark Ebony/Rosewood field, warm lamplight pools, Rosin reads as varnish/lamplight against dark, Verdigris glows. Same luthier concept, inverted time of day. Entering the app = lights come on. |
| 3 | Core message | **Problem-first hero: the gap.** "You can play. So why can't you play *that song*?" → resolution lands immediately after. Zero feature nouns in the headline. |
| 4 | Structure | **5 scenes:** ① Hero (gap → promise + email) ② The Bench (one immersive scroll scene absorbing ValueProps + Features: song comes apart as you scroll) ③ Maestro (own short scene) ④ Who it's for + FAQ (~5 collapsible items) ⑤ Final CTA. Contact collapses into footer. |
| 5 | Agent story | **Maestro only** in marketing copy. Octavia demoted: chat widget says "Ask about Octave," reveals her name only conversationally. No disambiguation copy anywhere. |
| 6 | Copy register | **Plain words, musician warmth.** Grade 6–8, short sentences, one idea per line. Headers either say the thing or label the section — never eyebrow + witty sentence stacked. Keep concrete musician words (stems, loop, key, capo); cut literary metaphor constructions. |
| 7 | Motion stack | **GSAP only** (ScrollTrigger + timelines + useGSAP). No Framer Motion. `prefers-reduced-motion` via `gsap.matchMedia`. |
| 8 | Sound model | **Narrative soundscape, not a demo widget.** Sound that exposes the app experience as a story + tactile UI sound design (subtle interaction sounds after opt-in). No interactive stem-player demo. |
| 9 | Audio sync | **Scroll-reactive mix.** One song plays continuously after opt-in; scroll position drives Web Audio gain/rate nodes via ScrollTrigger — vocals drop out as stems visually peel, tempo audibly slows at the transport beat. |
| 10 | Audio asset | **Own/owned recording run through Octave's real pipeline.** The stems heard are actual product output (honest proof + dogfood). |
| 11 | Visual material | **Filmed atmosphere footage** (hands on strings, lamplit rooms) as the primary visual. Product-proof video deferred: a separate HeyGen-hyperframes product film comes later, once more product is built; the page reserves a slot for it. |
| 12 | Footage source | **Curated stock (3–5 clips), graded hard** into one warm-lamplight-on-near-black look. Commercial licenses verified. |
| 13 | Conversion | **Persistent + 3 moments.** Sticky nav waitlist pill; inline single-field email at hero, end of Maestro scene, final CTA. Submit = joined instantly; instrument/skill questions become optional one-tap follow-up on the success state. Wire real persistence (stub = 0% conversion). |
| 14 | Fallbacks | **Same story, lighter staging.** Mobile: dark identity + copy + soundscape kept; no pinned scrub (in-view reveals), poster frames/short muted loops instead of heavy video. Reduced-motion: fully static composition, sound still available. One codebase, three intensities via `gsap.matchMedia`. |
| 15 | Sequencing | **Three shippable phases** (below). |

## Phases

### Phase 1 — the page reads and converts  `[x] DONE 2026-06-11`
- [x] Landing-scoped dark token set (lamplit-bench palette) in `marketing.css` — re-declares the shared tokens under `.marketing` so every globals.css primitive re-themes itself; lamplight pools + faint grain on the field; accent pill carries dark ink for contrast on dark
- [x] Restructure 8 sections → 5 scenes: Hero → TheBench (moves + capabilities, absorbs ValueProps/Features/HowItWorks) → MaestroScene (chat exchange mock + mid-page capture) → FitAndFaq → FinalCTA; Contact folded into footer (`#contact`)
- [x] Full copy rewrite in `marketing-content.ts`: problem-first hero ("You can play. So why can't you play that song?"), plain register, direct headers, Maestro-only agent story, FAQ 10 → 5
- [x] Octavia demoted in `Concierge.tsx`: launcher/header/placeholder say "Ask about Octave"; name reveals only via kb/concierge when asked
- [x] Conversion: sticky nav pill + 3 inline captures (hero / maestro / final), each joins instantly; optional profile questions moved to the modal success state; fake queue number dropped (honesty over theater)
- [x] Waitlist persistence wired: `werecode.waitlist_signups` (RLS on, service-role only — run `supabase/sql/2026-06-11_werecode_waitlist.sql` in the SQL editor), `POST /api/waitlist` (zod + admin client, upsert-on-email merges follow-up details), client in `waitlist-client.ts`
- [x] Slot reserved for future HeyGen product film (comment in TheBench)
- [x] Page metadata updated to the new register

### Phase 2 — it moves  `[ ] not started`
- [ ] GSAP + ScrollTrigger scene system (pinned, scrubbed bench scene; in-view reveals elsewhere)
- [ ] Curate + license 3–5 stock clips; unify with one aggressive grade; poster-frame/muted-loop mobile variants
- [ ] Live-feeling micro-detail layer (ticking mono transport, status chips) consistent with the two-signal rule
- [ ] `gsap.matchMedia` tiers: desktop full / mobile lighter / reduced-motion static

### Phase 3 — it sounds  `[ ] not started`
- [ ] Produce the song: owned recording → Octave pipeline → stems exported
- [ ] Sound opt-in moment (single elegant "hear it" affordance; everything user-initiated)
- [ ] Web Audio engine: stem gain/rate nodes driven by scroll position, musical between beats
- [ ] Tactile UI sounds (post-opt-in only, very quiet, anti-toy)
- [ ] Mobile: tap-to-enable, same scroll-reactive gains

## Constraints carried over

- WCAG AA on the dark field (4.5:1 body, labeled status, never color alone)
- `prefers-reduced-motion` respected on every animation
- Anti-references still binding: no gamified toy, no generic AI SaaS, no sterile dashboard — and the dark field must not drift into "generic dark music app"
- DESIGN.md "never dark mode" remains app doctrine; landing divergence is a deliberate, documented exception (consider a DESIGN.md addendum section once shipped)

## Open items (small, resolve during phases)

- Exact hero lines + per-scene copy (draft for review at start of Phase 1)
- Which 5 FAQs survive
- The specific song (must be owned; needs stems that separate well)
- Stock footage shortlist + license check
- Analytics events for the 3 capture points (`marketing-events.ts` exists)
- Sound opt-in affordance design

## Status log

- 2026-06-11 — Grill session complete; 15 decisions locked; doc created. Awaiting approval to begin Phase 1.
- 2026-06-11 — Phase 1 shipped and user-verified in the browser: dark lamplit theme, 5-scene restructure, full copy rewrite, Octavia demoted, waitlist persisted end-to-end. NOTE: the Supabase SQL file must be run manually in the SQL editor before production signups will save. Disk hit 100% mid-work (one write failed); freed ~2.2GB by deleting the project's `.next`. Typecheck + lint clean. Phase 2 begun.
