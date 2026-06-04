import { NextResponse } from 'next/server';

import { RouteNotFoundError, routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import { assetSummarySelect, songSummarySelect } from '@/server/werecode/selects';
import type { AnalysisResultRow, LyricsRow } from '@/types/werecode';
import type { AssetSummary, SongSummary, StudioDetail } from '@/types/werecode-client';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    songId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const { user, supabase } = await getWereCodeRequestContext();

    const { data: song, error: songError } = await supabase
      .from('songs')
      .select(songSummarySelect)
      .eq('id', songId)
      .eq('owner_id', user.id)
      .maybeSingle<SongSummary>();

    if (songError) {
      throw songError;
    }

    if (!song) {
      throw new RouteNotFoundError('Song not found', 'song_not_found');
    }

    const [assetsResult, analysisResult, lyricsResult] = await Promise.all([
      supabase
        .from('assets')
        .select(assetSummarySelect)
        .eq('song_id', songId)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .returns<AssetSummary[]>(),
      supabase
        .from('analysis_results')
        .select('*')
        .eq('song_id', songId)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .returns<AnalysisResultRow[]>(),
      supabase
        .from('lyrics')
        .select('*')
        .eq('song_id', songId)
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .returns<LyricsRow[]>(),
    ]);

    if (assetsResult.error) {
      throw assetsResult.error;
    }
    if (analysisResult.error) {
      throw analysisResult.error;
    }
    if (lyricsResult.error) {
      throw lyricsResult.error;
    }

    const detail: StudioDetail = {
      song,
      assets: assetsResult.data ?? [],
      analysisResults: analysisResult.data ?? [],
      lyrics: lyricsResult.data ?? [],
    };

    return NextResponse.json(detail);
  } catch (error) {
    return routeErrorResponse(error, 'Could not load studio');
  }
}
