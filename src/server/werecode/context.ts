import 'server-only';

import type { User } from '@supabase/supabase-js';

import { RouteNotFoundError } from '@/lib/http/route-error';
import { requireCurrentUser } from '@/lib/supabase/auth';
import { isWereCodeDevIdentityEnabled } from '@/lib/supabase/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import type { SongRow } from '@/types/werecode';

export type WereCodeSupabaseClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | ReturnType<typeof createSupabaseAdminClient>;

export async function getWereCodeRequestContext(): Promise<{
  user: User;
  supabase: WereCodeSupabaseClient;
}> {
  const user = await requireCurrentUser();
  const supabase = isWereCodeDevIdentityEnabled() ? createSupabaseAdminClient() : await createSupabaseServerClient();

  return { user, supabase };
}

export async function requireOwnedSong(supabase: WereCodeSupabaseClient, ownerId: string, songId: string) {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', songId)
    .eq('owner_id', ownerId)
    .maybeSingle<SongRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new RouteNotFoundError('Song not found', 'song_not_found');
  }

  return data;
}
