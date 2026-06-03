import 'server-only';

import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { jsonError } from '@/lib/http/responses';
import { routeErrorResponse } from '@/lib/http/route-error';
import { WERECODE_STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import type { AssetRow, JobRow, Json, SongRow } from '@/types/werecode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = z.object({
  source_url: z.string().url(),
  source_type: z.enum(['youtube', 'youtube_music']).default('youtube'),
  format: z.enum(['m4a', 'opus', 'mp3']).default('m4a'),
  quality: z.enum(['high', 'medium', 'low']).default('high'),
});

type SupabaseClient = Awaited<ReturnType<typeof getWereCodeRequestContext>>['supabase'];

type BackendJobResponse = {
  job_id?: string;
  status?: string;
  message?: string;
};

type BackendJobStatusResponse = {
  status?: {
    state?: string;
    progress?: number;
    message?: string | null;
    error?: string | null;
    result?: {
      song_folder?: string;
      audio_file?: string;
      title?: string | null;
      artist?: string | null;
      duration?: number | null;
      file_size?: number | null;
    } | null;
  };
};

export async function POST(request: NextRequest) {
  try {
    assertLocalYoutubeEnabled();
    const body = requestSchema.parse(await request.json().catch(() => null));
    const { user, supabase } = await getWereCodeRequestContext();
    const song = await createLocalDownloadSong(supabase, user.id, body);
    const job = await createJob(supabase, user.id, song.id, body);

    try {
      const backendJob = await startBackendDownload(body);
      await updateJob(supabase, user.id, job.id, {
        status: 'processing',
        progress: 10,
        message: backendJob.message ?? 'Local backend download started',
        response_payload: {
          backend_job_id: backendJob.job_id ?? null,
        },
      });

      if (!backendJob.job_id) {
        throw new Error('Local backend did not return a job_id');
      }

      const backendStatus = await pollBackendJob(backendJob.job_id);
      const result = backendStatus.status?.result;
      const audioFile = result?.audio_file;
      if (!audioFile) {
        throw new Error('Local backend download completed without an audio file path');
      }

      const audioAsset = await uploadLocalFileAsset(supabase, {
        ownerId: user.id,
        songId: song.id,
        jobId: job.id,
        localPath: audioFile,
        kind: 'source_audio',
        bucket: WERECODE_STORAGE_BUCKETS.sources,
        contentType: contentTypeForPath(audioFile),
        metadata: {
          source_url: body.source_url,
          source_type: body.source_type,
          backend_job_id: backendJob.job_id,
          local_path: audioFile,
        },
      });

      const metadataAsset = await maybeUploadMetadataAsset(supabase, {
        ownerId: user.id,
        songId: song.id,
        jobId: job.id,
        songFolder: result?.song_folder ?? dirname(audioFile),
      });

      const updatedSong = await updateSong(supabase, user.id, song.id, {
        title: result?.title || song.title,
        artist: result?.artist ?? song.artist,
        duration_sec: typeof result?.duration === 'number' ? result.duration : song.duration_sec,
        status: 'ready',
        has_audio: true,
        metadata: {
          ...jsonObject(song.metadata),
          source_audio_required: false,
          local_youtube_download: {
            source_url: body.source_url,
            source_type: body.source_type,
            backend_job_id: backendJob.job_id,
            song_folder: result?.song_folder ?? null,
            audio_file: audioFile,
            completed_at: new Date().toISOString(),
          },
        },
      });
      const updatedJob = await updateJob(supabase, user.id, job.id, {
        status: 'ready',
        progress: 100,
        message: 'Local YouTube download imported',
        response_payload: {
          backend_job_id: backendJob.job_id,
          backend_result: result ?? null,
        },
        completed_at: new Date().toISOString(),
      });

      return NextResponse.json({
        song: updatedSong,
        job: updatedJob,
        assets: [audioAsset, metadataAsset].filter(Boolean),
        lyrics: [],
      });
    } catch (downloadError) {
      await Promise.allSettled([
        updateSong(supabase, user.id, song.id, {
          status: 'failed',
          metadata: {
            ...jsonObject(song.metadata),
            source_audio_required: true,
            local_youtube_download_error: {
              source_url: body.source_url,
              message: downloadError instanceof Error ? downloadError.message : 'Local download failed',
              failed_at: new Date().toISOString(),
            },
          },
        }),
        updateJob(supabase, user.id, job.id, {
          status: 'failed',
          progress: 0,
          message: 'Local YouTube download failed',
          error_message: downloadError instanceof Error ? downloadError.message : 'Local download failed',
          completed_at: new Date().toISOString(),
        }),
      ]);
      throw downloadError;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('yt-dlp')) {
      return jsonError(error.message, {
        status: 502,
        code: 'local_youtube_download_failed',
      });
    }

    return routeErrorResponse(error, 'Could not import local YouTube download');
  }
}

function assertLocalYoutubeEnabled() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD === 'true';
  const localDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
  if (!enabled || !localDev) {
    throw new Error('Local YouTube download is only available in local development with NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD=true');
  }
}

async function startBackendDownload(body: z.infer<typeof requestSchema>) {
  const response = await fetch(`${getLocalBackendUrl()}/api/v1/download`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: body.source_url,
      format: body.format,
      quality: body.quality,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Local backend download failed to start: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as BackendJobResponse;
}

async function pollBackendJob(jobId: string) {
  const timeoutMs = Number(process.env.LOCAL_YOUTUBE_DOWNLOAD_TIMEOUT_MS ?? 10 * 60 * 1000);
  const intervalMs = Number(process.env.LOCAL_YOUTUBE_DOWNLOAD_POLL_MS ?? 2000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${getLocalBackendUrl()}/api/v1/jobs/${jobId}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Local backend job status failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as BackendJobStatusResponse;
    const state = payload.status?.state;
    if (state === 'completed') {
      return payload;
    }
    if (state === 'failed' || state === 'cancelled') {
      throw new Error(payload.status?.error ?? payload.status?.message ?? `Local backend job ${state}`);
    }

    await sleep(intervalMs);
  }

  throw new Error('Timed out waiting for local backend download');
}

function getLocalBackendUrl() {
  return process.env.LOCAL_WERECODE_API_URL ?? 'http://localhost:8001';
}

async function createLocalDownloadSong(
  supabase: SupabaseClient,
  ownerId: string,
  body: z.infer<typeof requestSchema>
) {
  const { data, error } = await supabase
    .from('songs')
    .insert({
      owner_id: ownerId,
      title: titleFallbackForSource(body.source_url),
      source_kind: body.source_type,
      source_url: body.source_url,
      status: 'importing',
      has_audio: false,
      metadata: {
        source_audio_required: true,
        local_youtube_download: {
          source_url: body.source_url,
          source_type: body.source_type,
          requested_at: new Date().toISOString(),
        },
      },
    })
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
  songId: string,
  body: z.infer<typeof requestSchema>
) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      owner_id: ownerId,
      song_id: songId,
      job_type: 'download',
      status: 'processing',
      progress: 5,
      message: 'Starting local backend download',
      request_payload: {
        workflow: 'local_youtube_download',
        ...body,
      },
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

async function updateSong(supabase: SupabaseClient, ownerId: string, songId: string, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('songs')
    .update(values)
    .eq('id', songId)
    .eq('owner_id', ownerId)
    .select('*')
    .single<SongRow>();
  if (error) {
    throw error;
  }

  return data;
}

async function uploadLocalFileAsset(
  supabase: SupabaseClient,
  options: {
    ownerId: string;
    songId: string;
    jobId: string;
    localPath: string;
    kind: string;
    bucket: string;
    contentType: string;
    metadata: Record<string, unknown>;
  }
) {
  const bytes = await readFile(options.localPath);
  const info = await stat(options.localPath);
  const objectPath = [
    options.ownerId,
    options.songId,
    options.kind === 'source_audio' ? 'sources' : 'artifacts',
    options.jobId,
    safeFilename(basename(options.localPath)),
  ].join('/');
  const { error: uploadError } = await supabase.storage.from(options.bucket).upload(objectPath, bytes, {
    contentType: options.contentType,
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      owner_id: options.ownerId,
      song_id: options.songId,
      kind: options.kind,
      bucket_id: options.bucket,
      object_path: objectPath,
      content_type: options.contentType,
      byte_size: info.size,
      metadata: {
        ...options.metadata,
        job_id: options.jobId,
      },
    })
    .select('*')
    .single<AssetRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function maybeUploadMetadataAsset(
  supabase: SupabaseClient,
  options: {
    ownerId: string;
    songId: string;
    jobId: string;
    songFolder: string;
  }
) {
  const metadataPath = join(options.songFolder, 'metadata.json');
  try {
    return await uploadLocalFileAsset(supabase, {
      ownerId: options.ownerId,
      songId: options.songId,
      jobId: options.jobId,
      localPath: metadataPath,
      kind: 'source_metadata',
      bucket: WERECODE_STORAGE_BUCKETS.artifacts,
      contentType: 'application/json',
      metadata: {
        local_path: metadataPath,
      },
    });
  } catch {
    return null;
  }
}

function titleFallbackForSource(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    return url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? 'Untitled import';
  } catch {
    return 'Untitled import';
  }
}

function contentTypeForPath(path: string) {
  switch (extname(path).toLowerCase()) {
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.opus':
      return 'audio/opus';
    case '.m4a':
    case '.mp4':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}

function jsonObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

function safeFilename(filename: string) {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'audio';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
