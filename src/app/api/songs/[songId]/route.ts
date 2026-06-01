import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/http/responses';
import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import { updateSongSchema } from '@/server/werecode/schemas';
import type { SongRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    songId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const { supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase.from('songs').select('*').eq('id', songId).single<SongRow>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ song: data });
  } catch (error) {
    return routeErrorResponse(error, 'Could not get song');
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const body = updateSongSchema.parse(await request.json().catch(() => null));
    const { supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase.from('songs').update(body).eq('id', songId).select('*').single<SongRow>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ song: data });
  } catch (error) {
    return routeErrorResponse(error, 'Could not update song');
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const { supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase
      .from('songs')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', songId)
      .select('*')
      .single<SongRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return jsonError('Song not found', { status: 404, code: 'song_not_found' });
    }

    return NextResponse.json({ song: data });
  } catch (error) {
    return routeErrorResponse(error, 'Could not archive song');
  }
}
