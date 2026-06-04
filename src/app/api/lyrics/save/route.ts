import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { routeErrorResponse } from '@/lib/http/route-error';
import { getWereCodeRequestContext, requireOwnedSong } from '@/server/werecode/context';
import type { SongRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';

const saveLyricsSchema = z.object({
  song_id: z.string().uuid(),
  lyrics_type: z.enum(['plain', 'lrc', 'alignment_json']).default('plain'),
  source: z.string().trim().min(1).default('user'),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: NextRequest) {
  try {
    const body = saveLyricsSchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    await requireOwnedSong(supabase, user.id, body.song_id);

    const { data, error } = await supabase
      .from('lyrics')
      .upsert(
        {
          ...body,
          owner_id: user.id,
          asset_id: null,
        },
        {
          onConflict: 'song_id,lyrics_type',
        }
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const songPatch =
      body.lyrics_type === 'plain'
        ? { has_plain_lyrics: true }
        : body.lyrics_type === 'lrc' || body.lyrics_type === 'alignment_json'
          ? { has_synced_lyrics: true }
          : {};

    let updatedSong: SongRow | null = null;
    if (Object.keys(songPatch).length > 0) {
      const { data: song, error: songError } = await supabase
        .from('songs')
        .update(songPatch)
        .eq('id', body.song_id)
        .eq('owner_id', user.id)
        .select('*')
        .maybeSingle<SongRow>();
      if (songError) {
        throw songError;
      }
      updatedSong = song;
    }

    return NextResponse.json({ lyrics: data, song: updatedSong });
  } catch (error) {
    return routeErrorResponse(error, 'Could not save lyrics');
  }
}
