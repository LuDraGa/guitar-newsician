import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { jsonError } from '@/lib/http/responses';
import { routeErrorResponse } from '@/lib/http/route-error';
import { isMaestroEnabled } from '@/lib/flags';
import { chatWithMaestro, MaestroAgentError } from '@/lib/maestro/client';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  songId: z.string().uuid(),
  message: z.string().min(1, 'message is required'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(64)
    .default([]),
});

export async function POST(request: NextRequest) {
  if (!isMaestroEnabled()) {
    return jsonError('Maestro is not enabled', { status: 404, code: 'maestro_disabled' });
  }
  try {
    const { songId, message, history } = bodySchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    await requireOwnedSong(supabase, user.id, songId);

    const result = await chatWithMaestro({ songId, message, history });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MaestroAgentError) {
      return jsonError(error.message, { status: error.status, code: 'maestro_agent_error', details: error.detail });
    }
    return routeErrorResponse(error, 'Could not reach Maestro');
  }
}
