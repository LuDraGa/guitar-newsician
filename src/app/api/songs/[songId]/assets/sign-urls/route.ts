import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { RouteNotFoundError, routeErrorResponse } from '@/lib/http/route-error';
import { createSignedStorageDownloadUrl, parseStorageBucket } from '@/lib/supabase/storage';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import { assetSigningSelect } from '@/server/werecode/selects';
import type { AssetSigningInfo, SignedAssetUrl } from '@/types/werecode-client';

export const dynamic = 'force-dynamic';

const signUrlsSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(20),
  expiresIn: z.number().int().min(60).max(86_400).default(3600),
  download: z.union([z.string().min(1), z.boolean()]).optional(),
});

type RouteContext = {
  params: Promise<{
    songId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const body = signUrlsSchema.parse(await request.json().catch(() => null));
    const assetIds = Array.from(new Set(body.assetIds));
    const { user, supabase } = await getWereCodeRequestContext();

    const { data: assets, error } = await supabase
      .from('assets')
      .select(assetSigningSelect)
      .eq('song_id', songId)
      .eq('owner_id', user.id)
      .in('id', assetIds)
      .returns<AssetSigningInfo[]>();

    if (error) {
      throw error;
    }

    if ((assets ?? []).length !== assetIds.length) {
      throw new RouteNotFoundError('Asset not found', 'asset_not_found');
    }

    const expiresAt = new Date(Date.now() + body.expiresIn * 1000).toISOString();
    const signedUrls: SignedAssetUrl[] = await Promise.all(
      (assets ?? []).map(async (asset) => {
        const signed = await createSignedStorageDownloadUrl({
          bucket: parseStorageBucket(asset.bucket_id),
          objectPath: asset.object_path,
          expiresIn: body.expiresIn,
          download: body.download,
        });

        return {
          assetId: asset.id,
          signedUrl: signed.signedUrl,
          expiresIn: body.expiresIn,
          expiresAt,
        };
      })
    );

    return NextResponse.json({ signedUrls });
  } catch (error) {
    return routeErrorResponse(error, 'Could not sign asset URLs');
  }
}
