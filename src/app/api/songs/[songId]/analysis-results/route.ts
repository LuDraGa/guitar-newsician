import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import type { AnalysisResultRow } from '@/types/werecode';

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
    const { data, error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('song_id', songId)
      .order('created_at', { ascending: false })
      .returns<AnalysisResultRow[]>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ analysisResults: data ?? [] });
  } catch (error) {
    return routeErrorResponse(error, 'Could not list analysis results');
  }
}
