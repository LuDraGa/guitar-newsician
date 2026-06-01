import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import {
  createMidiEditSession,
  createMidiEditSessionSchema,
  listMidiEditSessions,
} from '@/server/werecode/product-workflows';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    songId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const sessions = await listMidiEditSessions(songId);

    return NextResponse.json({ sessions });
  } catch (error) {
    return routeErrorResponse(error, 'Could not list MIDI edit sessions');
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const body = createMidiEditSessionSchema.parse(await request.json().catch(() => null));
    const session = await createMidiEditSession(songId, body);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Could not create MIDI edit session');
  }
}
