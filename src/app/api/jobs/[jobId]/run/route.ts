import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { runStoredJob } from '@/server/werecode/modal-workflows';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const result = await runStoredJob(jobId);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not run job');
  }
}
