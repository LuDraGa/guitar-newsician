import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';
import { createJobSchema } from '@/server/werecode/schemas';
import { jobSummarySelect } from '@/server/werecode/selects';
import type { JobRow } from '@/types/werecode';
import type { JobSummary } from '@/types/werecode-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
    const songId = searchParams.get('songId');
    const status = searchParams.get('status');
    const includePayloads = searchParams.get('includePayloads') === 'true';
    const { user, supabase } = await getWereCodeRequestContext();

    let query = supabase
      .from('jobs')
      .select(includePayloads ? '*' : jobSummarySelect)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (songId) {
      await requireOwnedSong(supabase, user.id, songId);
      query = query.eq('song_id', songId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.returns<Array<JobRow | JobSummary>>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    return routeErrorResponse(error, 'Could not list jobs');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createJobSchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    if (body.song_id) {
      await requireOwnedSong(supabase, user.id, body.song_id);
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        ...body,
        owner_id: user.id,
      })
      .select('*')
      .single<JobRow>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ job: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Could not create job');
  }
}
