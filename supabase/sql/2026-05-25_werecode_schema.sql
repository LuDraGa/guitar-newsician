-- WereCode Supabase schema.
-- Project: https://olquywzupxszttgiptco.supabase.co
--
-- Run this whole file in the Supabase SQL editor.
-- It creates an isolated `werecode` schema, owner-scoped RLS policies,
-- auth user profile mirroring, durable job tables, and private storage buckets.

begin;

create schema if not exists werecode;

create extension if not exists pgcrypto with schema extensions;

create or replace function werecode.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists werecode.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  provider text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists werecode.songs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text,
  album text,
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'youtube', 'youtube_music', 'audio_upload', 'midi_upload', 'musicxml_upload')),
  source_url text,
  duration_sec numeric,
  status text not null default 'draft'
    check (status in ('draft', 'importing', 'ready', 'failed', 'archived')),
  has_audio boolean not null default false,
  has_normalized_audio boolean not null default false,
  has_stems boolean not null default false,
  has_analysis boolean not null default false,
  has_plain_lyrics boolean not null default false,
  has_synced_lyrics boolean not null default false,
  has_midi boolean not null default false,
  metadata jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists werecode.song_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references werecode.songs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Main',
  version_kind text not null default 'source'
    check (version_kind in ('source', 'normalized', 'stem', 'transcription', 'analysis', 'lyrics', 'midi_edit', 'manual_edit')),
  parent_version_id uuid references werecode.song_versions(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'ready', 'failed', 'archived')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists werecode.assets (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references werecode.songs(id) on delete cascade,
  version_id uuid references werecode.song_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null
    check (
      kind in (
        'source_audio',
        'source_video',
        'source_metadata',
        'source_midi',
        'source_musicxml',
        'normalized_audio',
        'preview_audio',
        'stem_vocals',
        'stem_drums',
        'stem_bass',
        'stem_other',
        'stem_guitar',
        'stem_piano',
        'stems_manifest',
        'analysis_json',
        'lyrics_plain',
        'lyrics_lrc',
        'lyrics_alignment',
        'midi',
        'note_events',
        'musicxml',
        'tab_musicxml',
        'waveform_json',
        'spectrogram_image',
        'midi_edit_manifest'
      )
    ),
  bucket_id text not null
    check (bucket_id in ('werecode-sources', 'werecode-artifacts', 'werecode-previews')),
  object_path text not null,
  content_type text,
  byte_size bigint,
  duration_sec numeric,
  checksum_sha256 text,
  source_asset_id uuid references werecode.assets(id) on delete set null,
  modal_model text,
  modal_endpoint text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create table if not exists werecode.jobs (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references werecode.songs(id) on delete cascade,
  version_id uuid references werecode.song_versions(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null
    check (
      job_type in (
        'download',
        'probe',
        'normalize',
        'convert',
        'separate',
        'analyze',
        'lyrics_fetch',
        'lyrics_align',
        'midi_transcribe',
        'midi_analyze',
        'midi_to_musicxml',
        'midi_edit_propose',
        'midi_edit_apply'
      )
    ),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'ready', 'failed', 'cancelled')),
  progress numeric not null default 0 check (progress >= 0 and progress <= 100),
  message text,
  error_message text,
  modal_endpoint text,
  request_payload jsonb not null default '{}',
  response_payload jsonb not null default '{}',
  diagnostics jsonb not null default '[]',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists werecode.analysis_results (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references werecode.songs(id) on delete cascade,
  asset_id uuid references werecode.assets(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  analyzer_name text not null,
  analyzer_version text,
  ok boolean not null default true,
  elapsed_sec numeric,
  error text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists werecode.lyrics (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references werecode.songs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  lyrics_type text not null check (lyrics_type in ('plain', 'lrc', 'alignment_json')),
  source text,
  content text,
  asset_id uuid references werecode.assets(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id, lyrics_type)
);

create table if not exists werecode.midi_edit_sessions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references werecode.songs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_midi_asset_id uuid references werecode.assets(id) on delete set null,
  output_midi_asset_id uuid references werecode.assets(id) on delete set null,
  stem_name text,
  section_start_sec numeric,
  section_end_sec numeric,
  issue_description text,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'applied', 'failed')),
  proposed_changes jsonb not null default '[]',
  verification jsonb not null default '{}',
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on werecode.profiles(email);
create index if not exists songs_owner_updated_idx on werecode.songs(owner_id, updated_at desc);
create index if not exists songs_owner_status_idx on werecode.songs(owner_id, status, updated_at desc);
create index if not exists versions_song_created_idx on werecode.song_versions(song_id, created_at desc);
create index if not exists assets_song_kind_idx on werecode.assets(song_id, kind);
create index if not exists assets_owner_kind_idx on werecode.assets(owner_id, kind, created_at desc);
create index if not exists jobs_owner_status_idx on werecode.jobs(owner_id, status, created_at desc);
create index if not exists jobs_song_created_idx on werecode.jobs(song_id, created_at desc);
create index if not exists analysis_song_analyzer_idx on werecode.analysis_results(song_id, analyzer_name);
create index if not exists lyrics_song_type_idx on werecode.lyrics(song_id, lyrics_type);
create index if not exists midi_edit_song_created_idx on werecode.midi_edit_sessions(song_id, created_at desc);

drop trigger if exists set_profiles_updated_at on werecode.profiles;
create trigger set_profiles_updated_at
before update on werecode.profiles
for each row execute function werecode.set_updated_at();

drop trigger if exists set_songs_updated_at on werecode.songs;
create trigger set_songs_updated_at
before update on werecode.songs
for each row execute function werecode.set_updated_at();

drop trigger if exists set_song_versions_updated_at on werecode.song_versions;
create trigger set_song_versions_updated_at
before update on werecode.song_versions
for each row execute function werecode.set_updated_at();

drop trigger if exists set_jobs_updated_at on werecode.jobs;
create trigger set_jobs_updated_at
before update on werecode.jobs
for each row execute function werecode.set_updated_at();

drop trigger if exists set_lyrics_updated_at on werecode.lyrics;
create trigger set_lyrics_updated_at
before update on werecode.lyrics
for each row execute function werecode.set_updated_at();

drop trigger if exists set_midi_edit_sessions_updated_at on werecode.midi_edit_sessions;
create trigger set_midi_edit_sessions_updated_at
before update on werecode.midi_edit_sessions
for each row execute function werecode.set_updated_at();

create or replace function werecode.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = werecode, public
as $$
begin
  insert into werecode.profiles (
    id,
    email,
    display_name,
    avatar_url,
    provider,
    metadata
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    jsonb_build_object(
      'app_metadata', coalesce(new.raw_app_meta_data, '{}'::jsonb),
      'user_metadata', coalesce(new.raw_user_meta_data, '{}'::jsonb)
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    provider = excluded.provider,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_werecode on auth.users;
create trigger on_auth_user_created_werecode
after insert on auth.users
for each row execute function werecode.handle_new_user();

insert into werecode.profiles (
  id,
  email,
  display_name,
  avatar_url,
  provider,
  metadata
)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  ),
  coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
  jsonb_build_object(
    'app_metadata', coalesce(u.raw_app_meta_data, '{}'::jsonb),
    'user_metadata', coalesce(u.raw_user_meta_data, '{}'::jsonb)
  )
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  provider = excluded.provider,
  metadata = excluded.metadata,
  updated_at = now();

alter table werecode.profiles enable row level security;
alter table werecode.songs enable row level security;
alter table werecode.song_versions enable row level security;
alter table werecode.assets enable row level security;
alter table werecode.jobs enable row level security;
alter table werecode.analysis_results enable row level security;
alter table werecode.lyrics enable row level security;
alter table werecode.midi_edit_sessions enable row level security;

create or replace function werecode.current_user_owns_song(p_song_id uuid)
returns boolean
language sql
stable
security definer
set search_path = werecode, public
as $$
  select p_song_id is null
    or exists (
      select 1
      from werecode.songs s
      where s.id = p_song_id
        and s.owner_id = auth.uid()
    );
$$;

create or replace function werecode.current_user_owns_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = werecode, public
as $$
  select p_version_id is null
    or exists (
      select 1
      from werecode.song_versions v
      where v.id = p_version_id
        and v.owner_id = auth.uid()
    );
$$;

create or replace function werecode.current_user_owns_asset(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = werecode, public
as $$
  select p_asset_id is null
    or exists (
      select 1
      from werecode.assets a
      where a.id = p_asset_id
        and a.owner_id = auth.uid()
    );
$$;

drop policy if exists profiles_owner_select on werecode.profiles;
create policy profiles_owner_select on werecode.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_owner_update on werecode.profiles;
create policy profiles_owner_update on werecode.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists songs_owner_all on werecode.songs;
create policy songs_owner_all on werecode.songs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists song_versions_owner_all on werecode.song_versions;
create policy song_versions_owner_all on werecode.song_versions
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(parent_version_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(parent_version_id)
  );

drop policy if exists assets_owner_all on werecode.assets;
create policy assets_owner_all on werecode.assets
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
    and werecode.current_user_owns_asset(source_asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
    and werecode.current_user_owns_asset(source_asset_id)
  );

drop policy if exists jobs_owner_all on werecode.jobs;
create policy jobs_owner_all on werecode.jobs
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_version(version_id)
  );

drop policy if exists analysis_results_owner_all on werecode.analysis_results;
create policy analysis_results_owner_all on werecode.analysis_results
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  );

drop policy if exists lyrics_owner_all on werecode.lyrics;
create policy lyrics_owner_all on werecode.lyrics
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(asset_id)
  );

drop policy if exists midi_edit_sessions_owner_all on werecode.midi_edit_sessions;
create policy midi_edit_sessions_owner_all on werecode.midi_edit_sessions
  for all to authenticated
  using (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(source_midi_asset_id)
    and werecode.current_user_owns_asset(output_midi_asset_id)
  )
  with check (
    owner_id = auth.uid()
    and werecode.current_user_owns_song(song_id)
    and werecode.current_user_owns_asset(source_midi_asset_id)
    and werecode.current_user_owns_asset(output_midi_asset_id)
  );

grant usage on schema werecode to authenticated, service_role;
grant all on all tables in schema werecode to authenticated, service_role;
grant all on all functions in schema werecode to authenticated, service_role;
alter default privileges in schema werecode grant all on tables to authenticated, service_role;
alter default privileges in schema werecode grant all on functions to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('werecode-sources', 'werecode-sources', false, 2147483648),
  ('werecode-artifacts', 'werecode-artifacts', false, 2147483648),
  ('werecode-previews', 'werecode-previews', false, 524288000)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists werecode_sources_owner_select on storage.objects;
create policy werecode_sources_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_sources_owner_insert on storage.objects;
create policy werecode_sources_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_sources_owner_update on storage.objects;
create policy werecode_sources_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
  )
  with check (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_sources_owner_delete on storage.objects;
create policy werecode_sources_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'werecode-sources'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_artifacts_owner_select on storage.objects;
create policy werecode_artifacts_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_artifacts_owner_insert on storage.objects;
create policy werecode_artifacts_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_artifacts_owner_update on storage.objects;
create policy werecode_artifacts_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
  )
  with check (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_artifacts_owner_delete on storage.objects;
create policy werecode_artifacts_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'werecode-artifacts'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_previews_owner_select on storage.objects;
create policy werecode_previews_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_previews_owner_insert on storage.objects;
create policy werecode_previews_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_previews_owner_update on storage.objects;
create policy werecode_previews_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
  )
  with check (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists werecode_previews_owner_delete on storage.objects;
create policy werecode_previews_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'werecode-previews'
    and auth.uid()::text = split_part(name, '/', 1)
  );

commit;
