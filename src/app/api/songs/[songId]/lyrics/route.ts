import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';
import type { LyricsRow } from '@/types/werecode';

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
    await requireOwnedSong(supabase, user.id, songId);

    const { data, error } = await supabase
      .from('lyrics')
      .select('*')
      .eq('song_id', songId)
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .returns<LyricsRow[]>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ lyrics: data ?? [] });
  } catch (error) {
    return routeErrorResponse(error, 'Could not list lyrics');
  }
}
