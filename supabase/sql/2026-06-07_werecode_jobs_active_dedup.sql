-- WereCode: deduplicate in-flight workflow jobs.
--
-- Run once against the existing Supabase project after
-- `2026-05-25_werecode_schema.sql`. Prevents a second queued/processing job of
-- the same (song, stage) from being created while one is still in flight, so a
-- double-click, a second tab, or a reload-then-retry converges on the existing
-- run instead of launching a duplicate (and duplicately-billed) Modal job.
-- Application code (`workflowContext`) pre-checks for an active job; this index
-- is the race backstop for the gap between that read and the insert.
--
-- song_id is nullable, and Postgres treats NULLs as distinct in a unique index,
-- so song-less jobs (e.g. download/probe) are intentionally NOT deduped here.

begin;

-- Resolve any pre-existing duplicate in-flight jobs before enforcing uniqueness,
-- otherwise the index creation would fail. Keep the most recent queued/processing
-- job per (song, stage); cancel the older duplicates.
update werecode.jobs j
set status = 'cancelled',
    message = coalesce(j.message, 'Superseded by a newer in-flight job (dedup migration)'),
    completed_at = coalesce(j.completed_at, now()),
    updated_at = now()
where j.status in ('queued', 'processing')
  and j.song_id is not null
  and exists (
    select 1
    from werecode.jobs k
    where k.song_id = j.song_id
      and k.job_type = j.job_type
      and k.status in ('queued', 'processing')
      and (k.created_at > j.created_at or (k.created_at = j.created_at and k.id > j.id))
  );

create unique index if not exists jobs_active_stage_dedup_idx
  on werecode.jobs (song_id, job_type)
  where status in ('queued', 'processing');

commit;
