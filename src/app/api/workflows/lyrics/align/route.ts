import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { lyricsAlignWorkflowSchema, runLyricsAlignWorkflow } from '@/server/werecode/modal-workflows';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = lyricsAlignWorkflowSchema.parse(await request.json().catch(() => null));
    const result = await runLyricsAlignWorkflow(body);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not align lyrics');
  }
}
