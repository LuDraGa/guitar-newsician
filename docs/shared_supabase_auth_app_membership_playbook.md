# Shared Supabase Auth App Membership Playbook

Use this when multiple apps share one Supabase project and one Google OAuth
provider, but each app has its own schema/data boundary.

## Model

- `auth.users` is the shared identity pool.
- Each app schema owns its own authorization boundary.
- A user is allowed into an app only if that app has an active membership row.
- OAuth provider separation is not required, and in this setup is not available.

Do not use an `auth.users` trigger to create app profiles or app memberships for
every central Supabase user. That gives all sibling-app users an app footprint.

## Database Checklist

Replace `<app_schema>` with the app schema name.

```sql
create table if not exists <app_schema>.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create or replace function <app_schema>.is_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = <app_schema>, public
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from <app_schema>.memberships m
      where m.user_id = p_user_id
        and m.status = 'active'
    );
$$;

alter table <app_schema>.memberships enable row level security;

create policy memberships_owner_select on <app_schema>.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    and status = 'active'
  );
```

For every app-owned table:

```sql
using (
  owner_id = auth.uid()
  and <app_schema>.is_member(auth.uid())
)
with check (
  owner_id = auth.uid()
  and <app_schema>.is_member(auth.uid())
);
```

For profile tables keyed by user id:

```sql
using (
  id = auth.uid()
  and <app_schema>.is_member(auth.uid())
)
with check (
  id = auth.uid()
  and <app_schema>.is_member(auth.uid())
);
```

For app storage buckets, require both path ownership and app membership:

```sql
using (
  bucket_id = '<app-bucket>'
  and auth.uid()::text = split_part(name, '/', 1)
  and <app_schema>.is_member(auth.uid())
)
```

Use the same predicate in `with check` for insert/update policies.

## App Callback Checklist

In the app's OAuth callback route:

1. Exchange the Supabase OAuth code for a session.
2. Read the returned Supabase user.
3. Use the app server's service role client to upsert:
   - `<app_schema>.memberships`
   - `<app_schema>.profiles`, if the app has profiles
4. Redirect into the app.

Do not expose a public `provision_current_user()` RPC that any authenticated
client can call. In a shared project, sibling apps use the same Supabase auth
origin and anon key, so a public self-provision RPC is easy to misuse.

TypeScript shape:

```ts
const { data, error } = await supabase.auth.exchangeCodeForSession(code);

if (error) throw error;
if (!data.user) throw new Error('Missing user after OAuth callback');

await provisionAppUserWithServiceRole(data.user);
```

## Request Context Checklist

Every app API route that touches app data should go through one shared request
context:

```ts
const user = await requireCurrentUser();
const supabase = await createSupabaseServerClient();
await requireAppMembership(supabase, user.id);

return { user, supabase };
```

Generic signed storage routes must also use this context before issuing signed
upload/download URLs.

## Deployment Order

1. Add the membership table, `is_member` function, RLS policy changes, and
   storage policy changes.
2. Remove any `auth.users` trigger that auto-creates app profiles/memberships.
3. Deploy the app callback provisioning code and request-context guard.
4. Run a targeted backfill only for known real app users if needed. Do not
   backfill all `auth.users`.
5. Ask existing users to sign out and sign back in if you skipped backfill.

## Verification

Test with two authenticated users:

- User A is an active member and can read/write only their own app rows.
- User B exists in central Supabase Auth but has no app membership and cannot
  read/write any app rows or app storage objects.
- User B signing into a sibling app does not create membership in this app.
- User B can become a member only by completing this app's intended server-side
  callback/provisioning path.
