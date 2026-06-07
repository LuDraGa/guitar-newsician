import { NextResponse } from 'next/server';

import { RouteNotFoundError, routeErrorResponse } from '@/lib/http/route-error';
import { expandStudioOverview } from '@/lib/music/analysis-overview';
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

    const [assetsResult, overviewResult, lyricsResult] = await Promise.all([
      supabase
        .from('assets')
        .select(assetSummarySelect)
        .eq('song_id', songId)
        .eq('owner_id', user.id)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .returns<AssetSummary[]>(),
      // Compact path: read only the small studio_overview summary row.
      supabase
        .from('analysis_results')
        .select('data')
        .eq('song_id', songId)
        .eq('owner_id', user.id)
        .eq('analyzer_name', 'studio_overview')
        .eq('is_current', true)
        .maybeSingle<{ data: unknown }>(),
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
    if (overviewResult.error) {
      throw overviewResult.error;
    }
    if (lyricsResult.error) {
      throw lyricsResult.error;
    }

    let analysisResults: AnalysisResultRow[];
    if (overviewResult.data?.data) {
      // Expand the summary into the synthetic analyzer rows the client derives from.
      analysisResults = expandStudioOverview(songId, overviewResult.data.data);
    } else {
      // Legacy songs analyzed before the studio_overview contract: fall back to
      // the full analyzer rows so they still render (slimmed once re-analyzed).
      const legacy = await supabase
        .from('analysis_results')
        .select('*')
        .eq('song_id', songId)
        .eq('owner_id', user.id)
        .eq('is_current', true)
        .neq('analyzer_name', 'studio_overview')
        .order('created_at', { ascending: false })
        .returns<AnalysisResultRow[]>();
      if (legacy.error) {
        throw legacy.error;
      }
      analysisResults = legacy.data ?? [];
    }

    const detail: StudioDetail = {
      song,
      assets: assetsResult.data ?? [],
      analysisResults,
      lyrics: lyricsResult.data ?? [],
    };

    return NextResponse.json(detail);
  } catch (error) {
    return routeErrorResponse(error, 'Could not load studio');
  }
}
