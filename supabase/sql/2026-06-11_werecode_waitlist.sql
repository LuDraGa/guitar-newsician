-- Waitlist signups from the marketing landing.
-- Run this file in the Supabase SQL editor.
--
-- Service-role only: RLS is enabled with no policies, so `authenticated`
-- (granted table privileges by the schema's default privileges) is still
-- denied by RLS, and `anon` has no schema usage at all. The Next.js route
-- handler (/api/waitlist) writes via the service role, which bypasses RLS.

begin;

create table if not exists werecode.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  instrument text,
  skill text,
  song text,
  heard text,
  -- which capture point converted: hero | maestro | final | nav | footer | modal
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists waitlist_signups_set_updated_at on werecode.waitlist_signups;
create trigger waitlist_signups_set_updated_at
  before update on werecode.waitlist_signups
  for each row execute function werecode.set_updated_at();

alter table werecode.waitlist_signups enable row level security;

commit;
