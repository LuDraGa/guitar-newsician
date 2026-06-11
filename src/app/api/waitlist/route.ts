import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { routeErrorResponse } from '@/lib/http/route-error';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const optionalField = z.string().trim().max(200).optional();

const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().max(320).email(),
  source: optionalField,
  name: optionalField,
  instrument: optionalField,
  skill: optionalField,
  song: optionalField,
  heard: optionalField,
});

const OPTIONAL_KEYS = ['source', 'name', 'instrument', 'skill', 'song', 'heard'] as const;

export async function POST(request: NextRequest) {
  try {
    const body = waitlistSchema.parse(await request.json().catch(() => null));

    // Only send the columns this call actually provides, so a follow-up
    // (email + optional profile) merges into the existing row instead of
    // blanking the fields it omits.
    const row: Record<string, string> = { email: body.email };
    for (const key of OPTIONAL_KEYS) {
      const value = body[key];
      if (value) {
        row[key] = value;
      }
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from('waitlist_signups').upsert(row, { onConflict: 'email' });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error, 'Could not join the waitlist');
  }
}
