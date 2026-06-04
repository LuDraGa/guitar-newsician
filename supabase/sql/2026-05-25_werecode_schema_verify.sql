-- WereCode Supabase schema smoke checks.
-- Run after `2026-05-25_werecode_schema.sql`.

select
  schema_name
from information_schema.schemata
where schema_name = 'werecode';

select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'werecode'
order by table_name;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname in ('werecode', 'storage')
  and (
    schemaname = 'werecode'
    or policyname like 'werecode_%'
  )
order by schemaname, tablename, policyname;

select
  id,
  name,
  public,
  file_size_limit
from storage.buckets
where id in ('werecode-sources', 'werecode-artifacts', 'werecode-previews')
order by id;

select
  user_id,
  status,
  joined_at,
  last_seen_at
from werecode.memberships
order by joined_at desc
limit 20;

select
  id,
  email,
  provider,
  created_at
from werecode.profiles
order by created_at desc
limit 20;

select
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
from pg_policies
where schemaname in ('werecode', 'storage')
  and tablename <> 'memberships'
  and (
    schemaname = 'werecode'
    or policyname like 'werecode_%'
  )
  and (
    coalesce(qual, '') not like '%is_member%'
    and coalesce(with_check, '') not like '%is_member%'
  )
order by schemaname, tablename, policyname;
