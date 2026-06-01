'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getSupabaseBrowserEnv, getWereCodeSchema } from '@/lib/supabase/env';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, publishableKey } = getSupabaseBrowserEnv();

    browserClient = createBrowserClient(url, publishableKey, {
      db: {
        schema: getWereCodeSchema(),
      },
    });
  }

  return browserClient;
}
