import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import { createJobSchema } from '@/server/werecode/schemas';
import type { JobRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
    const songId = searchParams.get('songId');
    const status = searchParams.get('status');
    const { supabase } = await getWereCodeRequestContext();

    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(limit);

    if (songId) {
      query = query.eq('song_id', songId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.returns<JobRow[]>();

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
