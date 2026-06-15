import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { jsonError } from '@/lib/http/responses';
import { routeErrorResponse } from '@/lib/http/route-error';
import { isMaestroEnabled } from '@/lib/flags';
import { buildFactPack, MaestroAgentError } from '@/lib/maestro/client';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({ songId: z.string().uuid() });

// POST /api/maestro/fact-pack — (re)build and persist a song's fact pack.
// GET of a built pack lives at /api/maestro/fact-pack/[songId].
export async function POST(request: NextRequest) {
  if (!isMaestroEnabled()) {
    return jsonError('Maestro is not enabled', { status: 404, code: 'maestro_disabled' });
  }
  try {
    const { songId } = bodySchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    // Enforce ownership at the Next boundary even though the agent reads via the
    // service-role key: the local service is owner-agnostic, this gate is not.
    await requireOwnedSong(supabase, user.id, songId);

    const pack = await buildFactPack(songId);
    return NextResponse.json({ factPack: pack });
  } catch (error) {
    if (error instanceof MaestroAgentError) {
      return jsonError(error.message, { status: error.status, code: 'maestro_agent_error', details: error.detail });
    }
    return routeErrorResponse(error, 'Could not build the fact pack');
  }
}
