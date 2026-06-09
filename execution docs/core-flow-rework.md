# Execution Doc — Core-flow rework

**Status:** Complete (verified locally)
**Started:** 2026-06-09
**Owner:** abhiroop

## Goal

Make the WereCode shell read as **Library is home → pick a song → Studio is the
workbench**, with Pipeline as a dev-only tool and auth as an honest, legible gate.
Grounded in `PRODUCT.md` / `DESIGN.md` (Luthier's Bench system). No backend/API
or schema changes.

## Approved decisions (from shape brief)

1. **Signed-out (auth on):** Library renders its shell but content is a **locked
   state** with a Rosin `Sign in with Google` CTA. Studio surfaces mirror it.
2. **Profile (signed in):** topbar **avatar/initials pill → popover** (name ·
   email · Sign out). Popover, not modal.
3. **Studio entry:** Studio **stays in nav**; bare `/studio` shows a **song
   picker** (not the dead "No song selected" shell). `/` still → Library, so
   Studio is never the default surface. **Ask coach** renders only inside a
   song's Studio (`/studio/[songId]`), not globally.
4. **Pipeline:** dev-only flag `isPipelineEnabled()` =
   `NEXT_PUBLIC_ENABLE_PIPELINE === 'true' || NODE_ENV === 'development'`.
   Nav item hidden when off; `/pipeline` route server-guards + redirects to
   `/library` when off.

### Asserted defaults
- Signed-out Studio mirrors Library's locked state (not a redirect).
- Profile menu = name · email · Sign out only (no settings link yet).
- Picker reuses Library's song-fetch + card vocabulary, not a new data path.

## Task checklist

- [x] T1. `lib/flags.ts` — `isPipelineEnabled()` (client-safe).
- [x] T2. Pipeline gating — nav item conditional + `pipeline/page.tsx` server guard/redirect.
- [x] T3. AppShell — dynamic nav items; `Ask coach` only in song-studio; mount profile menu via SessionProvider.
- [x] T4. AuthButton → avatar/initials pill + popover (name · email · Sign out); on-brand; signed-out = clear Sign in pill.
- [x] T5. Library locked state — session-aware; Rosin sign-in CTA; copy per brief.
- [x] T6. Studio song picker — replace no-song branch in `StudioClient.tsx`; reuse Library data + card; empty state.
- [x] T7. `.env.example` — document `NEXT_PUBLIC_ENABLE_PIPELINE`.
- [x] T8. Verify — `pnpm typecheck` clean, changed files lint clean, browser-checked all flows.

## Files

New:
- `src/lib/flags.ts`
- `src/components/auth/session-context.tsx` (SessionProvider + useSession; owns signIn/signOut)
- `src/components/auth/SignInGate.tsx`
- `src/features/studio/StudioPicker.tsx`

Edited:
- `src/components/shell/AppShell.tsx`
- `src/components/auth/AuthButton.tsx`
- `src/features/studio/StudioClient.tsx` (no-song branch → `<StudioPicker/>`)
- `src/app/(app)/pipeline/page.tsx`
- `src/features/library/LibraryClient.tsx`
- `src/app/globals.css` (`.wc-avatar`, `.wc-pop`, `.wc-menu-item`, reduced-motion guard)
- `.env.example`

## Changelog / notes

- Shared **SessionProvider** in AppShell is the single source of session truth; AuthButton, Library
  lock, and Studio picker all read it (one `/api/auth/session` fetch, one `signIn`).
- `Ask coach` now renders only on `/studio/<id>`; bare `/studio` is the picker; `/` still → Library.
  Layout class `wc-content-studio` (fixed-height workbench) is keyed on `inSongStudio` so the picker
  scrolls like a normal page.
- Locked state only triggers when `authEnabled && !user`. Local dev uses dev-identity (user present),
  so the gate is reasoned + typecheck-verified, not visually exercised locally. Same for pipeline
  hidden-when-off (local `next dev` keeps it on).
- Verified in `next dev`: Library, profile popover, Studio picker, song workbench + contextual coach,
  Pipeline route — no console errors.
- Follow-ups (out of scope, not done): topbar Search icon is still inert; a true signed-out redirect
  gate (middleware) was intentionally not added — chose inline locked state per the brief.

## Copy (draft)

- Locked Library: **"Your library lives behind a sign-in."** / "WereCode keeps
  each musician's songs private. Sign in to open yours." → `Sign in with Google`
- Picker header: **"Open a song"** / "Pick a track to take to the bench."
- Picker empty: "No songs yet — import one in your Library."

## Changelog / notes

- (pending)
