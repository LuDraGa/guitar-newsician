import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { jsonError } from '@/lib/http/responses';
import { routeErrorResponse } from '@/lib/http/route-error';
import { isMaestroEnabled } from '@/lib/flags';
import { sendFeedbackScore } from '@/lib/maestro/client';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  songId: z.string().uuid(),
  // The turn's trace id from the chat response (raw.trace_id).
  traceId: z.string().min(1).max(64),
  verdict: z.enum(['up', 'down']),
  comment: z.string().max(2000).optional(),
  model: z.string().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  if (!isMaestroEnabled()) {
    return jsonError('Maestro is not enabled', { status: 404, code: 'maestro_disabled' });
  }
  try {
    const { songId, traceId, verdict, comment, model } = bodySchema.parse(
      await request.json().catch(() => null)
    );
    const { user, supabase } = await getWereCodeRequestContext();
    await requireOwnedSong(supabase, user.id, songId);

    // Durable record first, through the user-scoped client so RLS is the
    // enforcement path. One verdict per (owner, trace): re-clicking upserts.
    const { error } = await supabase.from('maestro_feedback').upsert(
      {
        owner_id: user.id,
        song_id: songId,
        trace_id: traceId,
        verdict,
        comment: comment ?? null,
        model: model ?? null,
      },
      { onConflict: 'owner_id,trace_id' }
    );
    if (error) {
      throw error;
    }

    // Observability-side copy: the same verdict as a Langfuse score on the
    // trace. Best-effort — a dead agent or unconfigured Langfuse never fails
    // the request.
    let langfuseRecorded = false;
    try {
      const forwarded = await sendFeedbackScore({ traceId, verdict, comment });
      langfuseRecorded = Boolean(forwarded?.langfuse_recorded);
    } catch {
      // Row landed; the score copy is optional.
    }

    return NextResponse.json({ ok: true, langfuseRecorded });
  } catch (error) {
    return routeErrorResponse(error, 'Could not record feedback');
  }
}
