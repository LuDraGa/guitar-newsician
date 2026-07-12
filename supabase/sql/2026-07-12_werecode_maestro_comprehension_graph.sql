-- Maestro durable Comprehension Graph (brief-drill lane, map ticket #2).
-- Run this file in the Supabase SQL editor.
--
-- One row per (song, node_type, region_key, pack_key, graph_version): the
-- Section×Role brief node `brief_region` computed for that region against that
-- fact-pack identity. Invalidation is a key miss, not a deletion — a rebuilt
-- pack yields a new pack_key, so stale rows simply never match again and stay
-- as history (cleanup deferred). Writes go through the service role (same
-- trust model as the fact pack); RLS guards the future user-scoped read path
-- (#3) from day one — same owner shape as werecode.maestro_feedback.

begin;

create table if not exists werecode.maestro_comprehension_graph (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references werecode.songs(id) on delete cascade,
  -- 'section_role_brief' now; phrase/bar node types arrive with later rungs.
  node_type text not null,
  -- Canonical region from resolved section indexes, e.g. 'sections:1,2' — so
  -- "the chorus" / "CHORUS" / an index that resolve alike share one node.
  region_key text not null,
  -- Fact-pack identity 'v<version>|<created_at>' (the _agent_cache_key tail):
  -- version + created_at so a same-version re-analysis busts too.
  pack_key text not null,
  -- COMPREHENSION_GRAPH_VERSION — the node-schema version, NOT FACT_PACK_VERSION.
  graph_version int not null,
  -- The full brief node (data + evidence + confidence + interpretation).
  node jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The lookup key; the service upserts on it so a concurrent race converges.
  unique (song_id, node_type, region_key, pack_key, graph_version)
);

create index if not exists maestro_comprehension_graph_owner_idx
  on werecode.maestro_comprehension_graph(owner_id, created_at desc);
create index if not exists maestro_comprehension_graph_song_idx
  on werecode.maestro_comprehension_graph(song_id, created_at desc);

drop trigger if exists maestro_comprehension_graph_set_updated_at on werecode.maestro_comprehension_graph;
create trigger maestro_comprehension_graph_set_updated_at
  before update on werecode.maestro_comprehension_graph
  for each row execute function werecode.set_updated_at();

alter table werecode.maestro_comprehension_graph enable row level security;

drop policy if exists maestro_comprehension_graph_owner_all on werecode.maestro_comprehension_graph;
create policy maestro_comprehension_graph_owner_all on werecode.maestro_comprehension_graph
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
