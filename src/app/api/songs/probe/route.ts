import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { probeSong, probeSongSchema } from '@/server/werecode/source-workflows';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = probeSongSchema.parse(await request.json().catch(() => null));
    const result = await probeSong(body);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not probe song source');
  }
}
