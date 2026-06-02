import { NextRequest, NextResponse } from 'next/server';

import { RouteNotFoundError, routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import { updateJobSchema } from '@/server/werecode/schemas';
import type { JobRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const { user, supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('owner_id', user.id)
      .maybeSingle<JobRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new RouteNotFoundError('Job not found', 'job_not_found');
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    return routeErrorResponse(error, 'Could not get job');
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = updateJobSchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase
      .from('jobs')
      .update(body)
      .eq('id', jobId)
      .eq('owner_id', user.id)
      .select('*')
      .maybeSingle<JobRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new RouteNotFoundError('Job not found', 'job_not_found');
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    return routeErrorResponse(error, 'Could not update job');
  }
}
