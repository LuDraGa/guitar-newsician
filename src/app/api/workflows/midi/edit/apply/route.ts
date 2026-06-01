import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { applyMidiEditManifest, midiEditApplySchema } from '@/server/werecode/product-workflows';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = midiEditApplySchema.parse(await request.json().catch(() => null));
    const result = await applyMidiEditManifest(body);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not apply MIDI edit manifest');
  }
}
