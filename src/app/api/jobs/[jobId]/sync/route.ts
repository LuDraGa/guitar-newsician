import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { finalizeStoredJob } from '@/server/werecode/modal-workflows';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

// Advance one async job: poll the Modal gateway for its spawned call and finalize
// it when the call has settled. Client-driven (the Studio reconnect poll calls
// this per active job); user-session scoped, so no service-role is involved.
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const result = await finalizeStoredJob(jobId);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not sync job');
  }
}
