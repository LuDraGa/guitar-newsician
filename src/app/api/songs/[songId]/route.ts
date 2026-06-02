import { NextRequest, NextResponse } from 'next/server';

import { RouteNotFoundError, routeErrorResponse } from '@/lib/http/route-error';
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
    const { user, supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .eq('owner_id', user.id)
      .maybeSingle<SongRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new RouteNotFoundError('Song not found', 'song_not_found');
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
    const { user, supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase
      .from('songs')
      .update(body)
      .eq('id', songId)
      .eq('owner_id', user.id)
      .select('*')
      .maybeSingle<SongRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new RouteNotFoundError('Song not found', 'song_not_found');
    }

    return NextResponse.json({ song: data });
  } catch (error) {
    return routeErrorResponse(error, 'Could not update song');
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const { user, supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase
      .from('songs')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', songId)
      .eq('owner_id', user.id)
      .select('*')
      .maybeSingle<SongRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new RouteNotFoundError('Song not found', 'song_not_found');
    }

    return NextResponse.json({ song: data });
  } catch (error) {
    return routeErrorResponse(error, 'Could not archive song');
  }
}
