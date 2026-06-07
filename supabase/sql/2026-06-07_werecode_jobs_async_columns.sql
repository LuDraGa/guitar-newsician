-- WereCode: async (poll-based) workflow support columns on jobs.
--
-- Run once after `2026-06-07_werecode_jobs_active_dedup.sql`. Backs Option 2
-- (Modal spawn + Next poll): when async is enabled, the gateway spawns the heavy
-- work and returns a Modal call id immediately; Next stores it here, plus the
-- spec it needs to finalize the job later, plus a single-finalizer claim. All
-- columns are nullable and additive, so existing synchronous jobs and the default
-- (flag-off) path are unaffected.

begin;

alter table werecode.jobs
  add column if not exists modal_call_id text,
  add column if not exists finalize_spec jsonb,
  add column if not exists finalize_claimed_at timestamptz;

-- Helps a future server-side sweep find in-flight async jobs cheaply (unused by
-- the client-driven poll, harmless to have now).
create index if not exists jobs_finalize_pending_idx
  on werecode.jobs (status, finalize_claimed_at)
  where status = 'processing' and modal_call_id is not null;

commit;
