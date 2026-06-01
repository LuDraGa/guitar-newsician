import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { getSupabaseBrowserEnv, getSupabaseServiceRoleKey, getWereCodeSchema } from '@/lib/supabase/env';

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseBrowserEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    db: {
      schema: getWereCodeSchema(),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Route Handlers can.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  const { url } = getSupabaseBrowserEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    db: {
      schema: getWereCodeSchema(),
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
