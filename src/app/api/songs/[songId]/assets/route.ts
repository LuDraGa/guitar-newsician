import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { assertUserStoragePath, parseStorageBucket } from '@/lib/supabase/storage';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';
import { createAssetSchema } from '@/server/werecode/schemas';
import type { AssetRow } from '@/types/werecode';

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
      .from('assets')
      .select('*')
      .eq('song_id', songId)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .returns<AssetRow[]>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ assets: data ?? [] });
  } catch (error) {
    return routeErrorResponse(error, 'Could not list assets');
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const body = createAssetSchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    await requireOwnedSong(supabase, user.id, songId);

    const bucket = parseStorageBucket(body.bucket_id);
    const objectPath = assertUserStoragePath(user.id, body.object_path);
    const { data, error } = await supabase
      .from('assets')
      .insert({
        ...body,
        bucket_id: bucket,
        object_path: objectPath,
        song_id: songId,
        owner_id: user.id,
      })
      .select('*')
      .single<AssetRow>();

    if (error) {
      throw error;
    }

    return NextResponse.json({ asset: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Could not create asset');
  }
}
