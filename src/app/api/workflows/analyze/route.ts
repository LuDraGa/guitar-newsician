import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { analyzeWorkflowSchema, runAnalyzeWorkflow } from '@/server/werecode/modal-workflows';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = analyzeWorkflowSchema.parse(await request.json().catch(() => null));
    const result = await runAnalyzeWorkflow(body);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not run music analysis');
  }
}
