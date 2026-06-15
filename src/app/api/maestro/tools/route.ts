import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/http/responses';
import { routeErrorResponse } from '@/lib/http/route-error';
import { isMaestroEnabled } from '@/lib/flags';
import { getMaestroTools, MaestroAgentError } from '@/lib/maestro/client';
import { getWereCodeRequestContext } from '@/server/werecode/context';

export const dynamic = 'force-dynamic';

// GET /api/maestro/tools — the agent's bounded tool catalog (name/description/
// params) for the workbench Tools panel. Not song-scoped; just gated to authed
// users behind the Maestro flag.
export async function GET() {
  if (!isMaestroEnabled()) {
    return jsonError('Maestro is not enabled', { status: 404, code: 'maestro_disabled' });
  }
  try {
    await getWereCodeRequestContext();
    const result = await getMaestroTools();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MaestroAgentError) {
      return jsonError(error.message, { status: error.status, code: 'maestro_agent_error', details: error.detail });
    }
    return routeErrorResponse(error, 'Could not load tools');
  }
}
