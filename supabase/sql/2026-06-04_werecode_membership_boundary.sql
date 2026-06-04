-- WereCode app-membership boundary for a shared Supabase Auth project.
--
-- Run this once against the existing Supabase project after the original
-- `2026-05-25_werecode_schema.sql` setup. This patch intentionally does not
-- backfill memberships from auth.users. WereCode membership is provisioned only
-- by the WereCode app server after a successful OAuth callback.

begin;

create table if not exists werecode.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists memberships_status_idx on werecode.memberships(status, joined_at desc);

drop trigger if exists on_auth_user_created_werecode on auth.users;
drop function if exists werecode.handle_new_user();

alter table werecode.memberships enable row level security;

create or replace function werecode.is_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = werecode, public
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from werecode.memberships m
      where m.user_id = p_user_id
        and m.status = 'active'
    );
$$;

drop policy if exists memberships_owner_select on werecode.memberships;
create policy memberships_owner_select on werecode.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    and status = 'active'
  );

drop policy if exists profiles_owner_select on werecode.profiles;
create policy profiles_owner_select on werecode.profiles
  for select to authenticated
  using (
    id = auth.uid()
    and werecode.is_member(auth.uid())
  );

drop policy if exists profiles_owner_update on werecode.profiles;
create policy profiles_owner_update on werecode.profiles
  for update to authenticated
  using (
    id = auth.uid()
    and werecode.is_member(auth.uid())
  )
  with check (
    id = auth.uid()
    and werecode.is_member(auth.uid())
  );

drop policy if exists songs_owner_all on werecode.songs;
create policy songs_owner_all on werecode.songs
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
  );

drop policy if exists song_versions_owner_all on werecode.song_versions;
create policy song_versions_owner_all on werecode.song_versions
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(parent_version_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(parent_version_id)
  );

drop policy if exists assets_owner_all on werecode.assets;
create policy assets_owner_all on werecode.assets
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
    and werecode.current_user_owns_asset(source_asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
    and werecode.current_user_owns_asset(source_asset_id)
  );

drop policy if exists jobs_owner_all on werecode.jobs;
create policy jobs_owner_all on werecode.jobs
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
  );

drop policy if exists analysis_results_owner_all on werecode.analysis_results;
create policy analysis_results_owner_all on werecode.analysis_results
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  );

drop policy if exists lyrics_owner_all on werecode.lyrics;
create policy lyrics_owner_all on werecode.lyrics
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  );

drop policy if exists midi_edit_sessions_owner_all on werecode.midi_edit_sessions;
create policy midi_edit_sessions_owner_all on werecode.midi_edit_sessions
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(source_midi_asset_id)
    and werecode.current_user_owns_asset(output_midi_asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.is_member(auth.uid())
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(source_midi_asset_id)
    and werecode.current_user_owns_asset(output_midi_asset_id)
  );

grant usage on schema werecode to authenticated, service_role;
grant all on all tables in schema werecode to authenticated, service_role;
grant all on all functions in schema werecode to authenticated, service_role;
alter default privileges in schema werecode grant all on tables to authenticated, service_role;
alter default privileges in schema werecode grant all on functions to authenticated, service_role;

drop policy if exists werecode_sources_owner_select on storage.objects;
create policy werecode_sources_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_sources_owner_insert on storage.objects;
create policy werecode_sources_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_sources_owner_update on storage.objects;
create policy werecode_sources_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  )
  with check (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_sources_owner_delete on storage.objects;
create policy werecode_sources_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_artifacts_owner_select on storage.objects;
create policy werecode_artifacts_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_artifacts_owner_insert on storage.objects;
create policy werecode_artifacts_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_artifacts_owner_update on storage.objects;
create policy werecode_artifacts_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  )
  with check (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_artifacts_owner_delete on storage.objects;
create policy werecode_artifacts_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_previews_owner_select on storage.objects;
create policy werecode_previews_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_previews_owner_insert on storage.objects;
create policy werecode_previews_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_previews_owner_update on storage.objects;
create policy werecode_previews_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  )
  with check (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

drop policy if exists werecode_previews_owner_delete on storage.objects;
create policy werecode_previews_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
    and werecode.is_member(auth.uid())
  );

commit;
