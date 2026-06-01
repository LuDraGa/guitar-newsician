import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import type { JobRow, SongRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);
    const includeJobs = searchParams.get('includeJobs') !== 'false';
    const { user, supabase } = await getWereCodeRequestContext();

    const songsQuery = supabase
      .from('songs')
      .select('*')
      .eq('owner_id', user.id)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(limit)
      .returns<SongRow[]>();

    if (!includeJobs) {
      const { data: songs, error } = await songsQuery;
      if (error) {
        throw error;
      }

      return NextResponse.json({ songs: songs ?? [] });
    }

    const [songsResult, jobsResult] = await Promise.all([
      songsQuery,
      supabase
        .from('jobs')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
        .returns<JobRow[]>(),
    ]);

    if (songsResult.error) {
      throw songsResult.error;
    }
    if (jobsResult.error) {
      throw jobsResult.error;
    }

    return NextResponse.json({
      songs: songsResult.data ?? [],
      jobs: jobsResult.data ?? [],
    });
  } catch (error) {
    return routeErrorResponse(error, 'Could not load library');
  }
}
