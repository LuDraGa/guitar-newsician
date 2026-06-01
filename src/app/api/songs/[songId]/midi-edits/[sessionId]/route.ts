import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { updateMidiEditSession, updateMidiEditSessionSchema } from '@/server/werecode/product-workflows';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    songId: string;
    sessionId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { songId, sessionId } = await context.params;
    const body = updateMidiEditSessionSchema.parse(await request.json().catch(() => null));
    const session = await updateMidiEditSession(songId, sessionId, body);

    return NextResponse.json({ session });
  } catch (error) {
    return routeErrorResponse(error, 'Could not update MIDI edit session');
  }
}
