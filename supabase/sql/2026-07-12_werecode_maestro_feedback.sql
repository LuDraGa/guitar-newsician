-- Maestro per-turn user feedback (traceability lane, map ticket #8).
-- Run this file in the Supabase SQL editor.
--
-- One row per (owner, trace): a thumbs verdict + optional comment tied to the
-- turn's trace id (Langfuse trace when enabled, local uuid otherwise). The Next
-- route (/api/maestro/feedback) upserts via the user-scoped client, so RLS is
-- the enforcement path — same owner shape as werecode.songs.

begin;

create table if not exists werecode.maestro_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references werecode.songs(id) on delete cascade,
  -- The turn's trace id from the agent response (raw.trace_id).
  trace_id text not null,
  verdict text not null check (verdict in ('up', 'down')),
  comment text,
  -- The model that produced the judged answer, for slicing feedback by model.
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Re-clicking updates the verdict/comment instead of stacking rows.
  unique (owner_id, trace_id)
);

create index if not exists maestro_feedback_owner_created_idx
  on werecode.maestro_feedback(owner_id, created_at desc);
create index if not exists maestro_feedback_song_idx
  on werecode.maestro_feedback(song_id, created_at desc);

drop trigger if exists maestro_feedback_set_updated_at on werecode.maestro_feedback;
create trigger maestro_feedback_set_updated_at
  before update on werecode.maestro_feedback
  for each row execute function werecode.set_updated_at();

alter table werecode.maestro_feedback enable row level security;

drop policy if exists maestro_feedback_owner_all on werecode.maestro_feedback;
create policy maestro_feedback_owner_all on werecode.maestro_feedback
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
  );

commit;
