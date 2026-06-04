import 'server-only';

import type { User } from '@supabase/supabase-js';

import { AuthRequiredError } from '@/lib/supabase/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

type WereCodeMembershipClient = Pick<ReturnType<typeof createSupabaseAdminClient>, 'from'>;

export class WereCodeMembershipRequiredError extends AuthRequiredError {
  override readonly code = 'werecode_membership_required';
  override readonly status = 403;

  constructor(message = 'WereCode membership required') {
    super(message);
    this.name = 'WereCodeMembershipRequiredError';
  }
}

export async function provisionWereCodeUser(user: User) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error: membershipError } = await supabase.from('memberships').upsert(
    {
      user_id: user.id,
      status: 'active',
      last_seen_at: now,
    },
    { onConflict: 'user_id' }
  );

  if (membershipError) {
    throw new Error(`Could not provision WereCode membership: ${membershipError.message}`);
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name: getUserMetadataString(user, ['full_name', 'name']) ?? getEmailName(user.email),
      avatar_url: getUserMetadataString(user, ['avatar_url', 'picture']),
      provider: getAppMetadataString(user, 'provider') ?? 'email',
      metadata: {
        app_metadata: user.app_metadata ?? {},
        user_metadata: user.user_metadata ?? {},
      },
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    throw new Error(`Could not provision WereCode profile: ${profileError.message}`);
  }
}

export async function requireWereCodeMembership(supabase: WereCodeMembershipClient, userId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle<{ user_id: string }>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new WereCodeMembershipRequiredError();
  }
}

function getAppMetadataString(user: User, key: string) {
  const value = user.app_metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getUserMetadataString(user: User, keys: string[]) {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

function getEmailName(email: string | undefined) {
  return email?.split('@')[0] || null;
}
