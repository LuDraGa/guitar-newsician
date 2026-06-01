import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { arrangementManifestSchema, saveArrangementManifest } from '@/server/werecode/product-workflows';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = arrangementManifestSchema.parse(await request.json().catch(() => null));
    const result = await saveArrangementManifest(body);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not save arrangement manifest');
  }
}
