import 'server-only';

import type { User } from '@supabase/supabase-js';

import { requireCurrentUser } from '@/lib/supabase/auth';
import { isWereCodeDevIdentityEnabled } from '@/lib/supabase/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

export async function getWereCodeRequestContext(): Promise<{
  user: User;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdminClient>;
}> {
  const user = await requireCurrentUser();
  const supabase = isWereCodeDevIdentityEnabled() ? createSupabaseAdminClient() : await createSupabaseServerClient();

  return { user, supabase };
}
