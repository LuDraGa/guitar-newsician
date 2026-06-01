import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import { createSongSchema } from '@/server/werecode/schemas';
import type { SongRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
    const status = searchParams.get('status');
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const { supabase } = await getWereCodeRequestContext();

    let query = supabase.from('songs').select('*').order('updated_at', { ascending: false }).limit(limit);

    if (status) {
      query = query.eq('status', status);
    } else if (!includeArchived) {
      query = query.neq('status', 'archived');
    }

    const { data, error } = await query.returns<SongRow[]>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ songs: data ?? [] });
  } catch (error) {
    return routeErrorResponse(error, 'Could not list songs');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createSongSchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    const { data, error } = await supabase
      .from('songs')
      .insert({
        ...body,
        owner_id: user.id,
      })
      .select('*')
      .single<SongRow>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ song: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Could not create song');
  }
}
