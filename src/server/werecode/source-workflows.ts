import 'server-only';

import { z } from 'zod';

import { getWereCodeRequestContext } from '@/server/werecode/context';
import type { JobRow, Json, SongRow, SourceKind } from '@/types/werecode';

type SupabaseClient = Awaited<ReturnType<typeof getWereCodeRequestContext>>['supabase'];

const sourceTypeSchema = z.enum(['youtube', 'youtube_music', 'audio_url', 'file_url']);

export const probeSongSchema = z.object({
  source_url: z.string().url(),
  source_type: sourceTypeSchema.default('youtube'),
});

export const ingestSongSchema = z.object({
  source_url: z.string().url(),
  source_type: sourceTypeSchema.default('youtube'),
  title: z.string().trim().min(1).optional(),
  artist: z.string().trim().min(1).optional(),
  album: z.string().trim().min(1).optional(),
  format: z.enum(['m4a', 'opus', 'mp3', 'wav']).default('m4a'),
  quality: z.enum(['high', 'medium', 'low']).default('high'),
  fetch_lyrics: z.boolean().default(false),
});

export async function probeSong(input: z.infer<typeof probeSongSchema>) {
  const { user, supabase } = await getWereCodeRequestContext();
  const body = probeSongSchema.parse(input);
  const responsePayload = {
    status: 'ready',
    source_url: body.source_url,
    source_type: body.source_type,
    title: titleFallbackForSource(body.source_url),
    diagnostics: [],
  };
  const job = await createJob(supabase, user.id, {
    job_type: 'probe',
    request_payload: {
      workflow: 'probe',
      ...body,
    },
  });
  const updatedJob = await updateJob(supabase, user.id, job.id, {
    status: 'ready',
    progress: 100,
    message: 'Source URL parsed by Next',
    response_payload: responsePayload,
    diagnostics: [],
    completed_at: new Date().toISOString(),
  });

  return {
    job: updatedJob,
    source: responsePayload,
  };
}

export async function ingestSong(input: z.infer<typeof ingestSongSchema>) {
  const { user, supabase } = await getWereCodeRequestContext();
  const body = ingestSongSchema.parse(input);
  const existingSong = await findExistingSourceSong(supabase, user.id, body.source_url);
  const song = existingSong
    ? await updateRegisteredSong(supabase, existingSong, body)
    : await createRegisteredSong(supabase, user.id, body);

  const responsePayload = {
    status: 'ready',
    source_url: body.source_url,
    source_type: body.source_type,
    requires_source_audio_upload: !song.has_audio,
    message: 'Source URL registered. Upload source audio before running analysis, stems, karaoke, or MIDI.',
  };
  const job = await createJob(supabase, user.id, {
    song_id: song.id,
    job_type: 'download',
    request_payload: {
      workflow: 'source_register',
      ...body,
    },
  });
  const updatedJob = await updateJob(supabase, user.id, job.id, {
    status: 'ready',
    progress: 100,
    message: responsePayload.message,
    response_payload: responsePayload,
    diagnostics: [],
    completed_at: new Date().toISOString(),
  });

  return {
    job: updatedJob,
    assets: [],
    modal: null,
    song,
  };
}

async function findExistingSourceSong(supabase: SupabaseClient, ownerId: string, sourceUrl: string) {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('source_url', sourceUrl)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<SongRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function createRegisteredSong(
  supabase: SupabaseClient,
  ownerId: string,
  body: z.infer<typeof ingestSongSchema>
) {
  const { data, error } = await supabase
    .from('songs')
    .insert({
      owner_id: ownerId,
      title: body.title ?? titleFallbackForSource(body.source_url),
      artist: body.artist ?? null,
      album: body.album ?? null,
      source_kind: sourceKindForSourceType(body.source_type),
      source_url: body.source_url,
      status: 'draft',
      has_audio: false,
      metadata: {
        source_registration: body,
        source_audio_required: true,
        source_registered_at: new Date().toISOString(),
      },
    })
    .select('*')
    .single<SongRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateRegisteredSong(
  supabase: SupabaseClient,
  song: SongRow,
  body: z.infer<typeof ingestSongSchema>
) {
  const { data, error } = await supabase
    .from('songs')
    .update({
      title: body.title ?? song.title,
      artist: body.artist ?? song.artist,
      album: body.album ?? song.album,
      source_kind: sourceKindForSourceType(body.source_type),
      status: song.has_audio ? song.status : 'draft',
      metadata: {
        ...jsonObject(song.metadata),
        source_registration: body,
        source_audio_required: !song.has_audio,
        source_registered_at: new Date().toISOString(),
      },
    })
    .eq('id', song.id)
    .eq('owner_id', song.owner_id)
    .select('*')
    .single<SongRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function createJob(
  supabase: SupabaseClient,
  ownerId: string,
  values: {
    song_id?: string | null;
    job_type: 'probe' | 'download';
    request_payload?: unknown;
  }
) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      owner_id: ownerId,
      song_id: values.song_id ?? null,
      job_type: values.job_type,
      modal_endpoint: null,
      request_payload: values.request_payload ?? {},
    })
    .select('*')
    .single<JobRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateJob(supabase: SupabaseClient, ownerId: string, jobId: string, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('jobs')
    .update(values)
    .eq('id', jobId)
    .eq('owner_id', ownerId)
    .select('*')
    .single<JobRow>();

  if (error) {
    throw error;
  }

  return data;
}

function sourceKindForSourceType(sourceType: z.infer<typeof sourceTypeSchema>): SourceKind {
  if (sourceType === 'youtube_music') {
    return 'youtube_music';
  }
  if (sourceType === 'youtube') {
    return 'youtube';
  }

  return 'audio_upload';
}

function titleFallbackForSource(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    return url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? 'Untitled import';
  } catch {
    return 'Untitled import';
  }
}

function jsonObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}
