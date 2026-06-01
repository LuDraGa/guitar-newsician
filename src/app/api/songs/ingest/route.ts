import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { ingestSong, ingestSongSchema } from '@/server/werecode/source-workflows';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = ingestSongSchema.parse(await request.json().catch(() => null));
    const result = await ingestSong(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Could not ingest song');
  }
}
