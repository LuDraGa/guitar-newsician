import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/http/responses';
import { routeErrorResponse } from '@/lib/http/route-error';
import { isMaestroEnabled } from '@/lib/flags';
import { getFactPack, MaestroAgentError } from '@/lib/maestro/client';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ songId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!isMaestroEnabled()) {
    return jsonError('Maestro is not enabled', { status: 404, code: 'maestro_disabled' });
  }
  try {
    const { songId } = await context.params;
    const { user, supabase } = await getWereCodeRequestContext();
    await requireOwnedSong(supabase, user.id, songId);

    const pack = await getFactPack(songId);
    return NextResponse.json({ factPack: pack });
  } catch (error) {
    if (error instanceof MaestroAgentError) {
      return jsonError(error.message, { status: error.status, code: 'maestro_agent_error', details: error.detail });
    }
    return routeErrorResponse(error, 'Could not load the fact pack');
  }
}
