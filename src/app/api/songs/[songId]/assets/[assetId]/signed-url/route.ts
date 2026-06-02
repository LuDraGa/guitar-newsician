import { NextRequest, NextResponse } from 'next/server';

import { RouteNotFoundError, routeErrorResponse } from '@/lib/http/route-error';
import { parseStorageBucket, createSignedStorageDownloadUrl } from '@/lib/supabase/storage';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import type { AssetRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    songId: string;
    assetId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { songId, assetId } = await context.params;
    const { searchParams } = new URL(request.url);
    const expiresIn = Math.min(Math.max(Number(searchParams.get('expiresIn') ?? 3600), 60), 86_400);
    const download = searchParams.get('download');
    const { user, supabase } = await getWereCodeRequestContext();

    const { data: asset, error } = await supabase
      .from('assets')
      .select('*')
      .eq('song_id', songId)
      .eq('id', assetId)
      .eq('owner_id', user.id)
      .maybeSingle<AssetRow>();

    if (error) {
      throw error;
    }

    if (!asset) {
      throw new RouteNotFoundError('Asset not found', 'asset_not_found');
    }

    const signed = await createSignedStorageDownloadUrl({
      bucket: parseStorageBucket(asset.bucket_id),
      objectPath: asset.object_path,
      expiresIn,
      download: download === null ? undefined : download || true,
    });

    return NextResponse.json({
      asset,
      expiresIn,
      ...signed,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Could not sign asset URL');
  }
}
