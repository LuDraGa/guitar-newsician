# WereCode Shared Auth Membership Boundary

Date: 2026-06-04
Status: Implemented locally; Supabase patch must be run manually.

## Goal

WereCode shares one Supabase project and one Google OAuth provider with other
apps. Supabase Auth remains the central identity pool, but WereCode data access
must be scoped by explicit WereCode membership instead of every user in
`auth.users`.

## Changes

- Added `werecode.memberships` as the app authorization boundary.
- Removed the global `auth.users` trigger/backfill that mirrored every central
  auth user into `werecode.profiles`.
- Added `werecode.is_member(user_id)` and required it in WereCode table RLS and
  WereCode storage bucket policies.
- Provisioned membership/profile rows from the Next OAuth callback after
  `exchangeCodeForSession`.
- Added server-side request context enforcement so WereCode APIs require active
  app membership in addition to central Supabase authentication.
- Updated generic storage signing routes to use the WereCode request context.

## Files

- `supabase/sql/2026-06-04_werecode_membership_boundary.sql`
- `supabase/sql/2026-05-25_werecode_schema.sql`
- `supabase/sql/2026-05-25_werecode_schema_verify.sql`
- `src/app/api/auth/callback/route.ts`
- `src/server/werecode/membership.ts`
- `src/server/werecode/context.ts`
- `src/app/api/storage/sign-upload/route.ts`
- `src/app/api/storage/sign-download/route.ts`
- `docs/shared_supabase_auth_app_membership_playbook.md`

## Deployment Procedure

1. Run `supabase/sql/2026-06-04_werecode_membership_boundary.sql` in the shared
   Supabase project.
2. Confirm production has `SUPABASE_SERVICE_ROLE_KEY`; callback provisioning uses
   the service role after Supabase validates the OAuth code.
3. Deploy the Next app.
4. Sign out and sign back in with Google from the WereCode app to provision the
   current user membership. No broad backfill is included.
5. Run `supabase/sql/2026-05-25_werecode_schema_verify.sql` and confirm no
   non-membership policies are returned by the final "missing is_member" query.

## Notes

- Existing central Supabase users from sibling apps do not become WereCode
  members automatically.
- Existing signed-in WereCode browser sessions may need a fresh Google sign-in
  because membership is created during `/api/auth/callback`.
- Local dev identity remains a local-only bypass and does not require a real
  membership row.
