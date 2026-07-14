import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { createStemMetadata, getStemInfo, isStemAudioKind } from '@/lib/music/stem-metadata';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';
import { updateStemIdentitySchema } from '@/server/werecode/schemas';
import type { AssetRow, Json } from '@/types/werecode';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    songId: string;
    assetId: string;
  }>;
};

// Identity keys `createStemMetadata` owns. Everything else on the asset's
// metadata (loudness, inst_class, program numbers…) is preserved untouched;
// these are dropped first so a stale copy can never out-vote the new identity
// on read — `getStemInfo` also reads the legacy top-level `tags`.
const IDENTITY_KEYS = ['stem', 'stem_id', 'stem_role', 'stem_label', 'stem_tags', 'role', 'tags', 'label'] as const;

/**
 * Curate a stem's identity: its display label and its tags (the finer-than-role
 * axis — "lead", "rhythm", "clean" — that Maestro's Section × Role briefs read to
 * tell one guitar from another).
 *
 * The write lands on *every* asset sharing the stem's `stem_id` (audio, per-stem
 * MIDI, per-stem analysis), because the identity belongs to the stem, not to one
 * asset. It moves `metadata` only — never the audio checksum — which is why the
 * agent side hashes stem identity into the fact pack's fingerprint separately.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { songId, assetId } = await context.params;
    const body = updateStemIdentitySchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    await requireOwnedSong(supabase, user.id, songId);

    const { data: assets, error: listError } = await supabase
      .from('assets')
      .select('*')
      .eq('song_id', songId)
      .eq('owner_id', user.id)
      .returns<AssetRow[]>();

    if (listError) {
      throw listError;
    }

    const target = (assets ?? []).find((asset) => asset.id === assetId);
    if (!target) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (!isStemAudioKind(target.kind)) {
      return NextResponse.json({ error: 'Only stem audio assets carry a curatable identity' }, { status: 400 });
    }

    const current = getStemInfo(target);
    const label = body.label ?? current.label;
    const tags = body.tags ?? current.tags;
    const curatedAt = new Date().toISOString();

    const siblings = (assets ?? []).filter((asset) => getStemInfo(asset).id === current.id);
    const updated: AssetRow[] = [];

    for (const asset of siblings) {
      const metadata = (asset.metadata ?? {}) as Record<string, Json>;
      const extra = Object.fromEntries(
        Object.entries(metadata).filter(([key]) => !IDENTITY_KEYS.includes(key as (typeof IDENTITY_KEYS)[number])),
      ) as Record<string, Json>;

      const { data, error } = await supabase
        .from('assets')
        .update({
          metadata: createStemMetadata({
            id: current.id,
            role: getStemInfo(asset).role,
            label,
            tags,
            source: typeof metadata.stem_source === 'string' ? metadata.stem_source : null,
            curated: true,
            curatedAt,
            extra,
          }),
        })
        .eq('id', asset.id)
        .eq('owner_id', user.id)
        .select('*')
        .single<AssetRow>();

      if (error) {
        throw error;
      }
      updated.push(data);
    }

    const asset = updated.find((row) => row.id === assetId) ?? target;
    return NextResponse.json({ asset, assets: updated });
  } catch (error) {
    return routeErrorResponse(error, 'Could not update stem identity');
  }
}
