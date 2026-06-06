-- Re-runnable pipeline stages: version-stamped supersede (replace-in-place).
-- Additive + idempotent. Legacy rows backfill to is_current=true / pipeline_version=null,
-- so previously-processed songs read as stale (null != latest) and can be re-run.

alter table werecode.assets
  add column if not exists pipeline_version text;

alter table werecode.assets
  add column if not exists is_current boolean not null default true;

alter table werecode.analysis_results
  add column if not exists is_current boolean not null default true;

-- Fast "current output for this song/stage" lookups (skip-if-fresh, staleness, supersede).
create index if not exists assets_song_kind_current_idx
  on werecode.assets (song_id, kind)
  where is_current;

create index if not exists analysis_results_song_current_idx
  on werecode.analysis_results (song_id)
  where is_current;
