import 'server-only';

import { z } from 'zod';

import { modalFetch } from '@/lib/modal/client';
import {
  WERECODE_STORAGE_BUCKETS,
  type WereCodeStorageBucket,
  createSignedStorageDownloadUrl,
  createSignedStorageUploadUrl,
} from '@/lib/supabase/storage';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import { lookupLyrics, type LyricsLookupResult } from '@/server/werecode/lyrics-lookup';
import type { AssetKind, AssetRow, JobRow, JobType, Json, LyricsRow, SongRow } from '@/types/werecode';

type SupabaseClient = Awaited<ReturnType<typeof getWereCodeRequestContext>>['supabase'];

type Diagnostic = {
  stage?: string;
  message?: string;
  level?: string;
  details?: Json;
};

type ArtifactMetadata = {
  kind?: string;
  uploaded?: boolean;
  uri?: string | null;
  mime_type?: string | null;
  duration_sec?: number | null;
  format?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
};

type ModalResponse = {
  status?: string;
  artifacts?: Record<string, ArtifactMetadata>;
  artifact?: ArtifactMetadata | null;
  diagnostics?: Diagnostic[];
  [key: string]: unknown;
};

type OutputSpec = {
  key: string;
  kind: AssetKind;
  bucket: WereCodeStorageBucket;
  objectPath: string;
  contentType?: string;
};

type LyricsResolution = {
  lyrics: LyricsRow[];
  syncedLyrics: LyricsRow | null;
  plainLyrics: LyricsRow | null;
  lookup: LyricsLookupResult | null;
  responsePayload: Record<string, unknown>;
};

const sourceAssetInputSchema = z
  .object({
    input_url: z.string().url().optional(),
    source_asset_id: z.string().uuid().optional(),
  })
  .refine((body) => Boolean(body.input_url || body.source_asset_id), {
    message: 'Provide input_url or source_asset_id',
    path: ['input_url'],
  });

export const analyzeWorkflowSchema = sourceAssetInputSchema.extend({
  song_id: z.string().uuid(),
  analyzers: z
    .array(
      z.enum([
        'basic_stats',
        'tempo',
        'key',
        'chords',
        'structure',
        'tempo_beats',
        'tonal_key',
        'structure_msaf',
      ])
    )
    .optional(),
  preset: z.enum(['quick', 'full', 'production', 'chord', 'structure']).optional(),
  transpose_to: z.string().trim().min(1).optional(),
  is_stem: z.boolean().optional(),
});

export const separateWorkflowSchema = sourceAssetInputSchema.extend({
  song_id: z.string().uuid(),
  stems: z
    .array(z.enum(['vocals', 'guitar', 'bass', 'drums', 'piano', 'accompaniment', 'other']))
    .default(['vocals', 'drums', 'bass', 'other', 'guitar', 'piano']),
  model: z.enum(['htdemucs', 'htdemucs_ft', 'htdemucs_6s', 'mdx_extra']).default('htdemucs_6s'),
  shifts: z.number().int().min(0).max(20).default(2),
});

export const lyricsAlignWorkflowSchema = sourceAssetInputSchema.extend({
  song_id: z.string().uuid(),
  known_lyrics: z.string().optional(),
  language: z.string().trim().min(1).optional(),
  force_modal_alignment: z.boolean().default(false),
});

export const lyricsFetchWorkflowSchema = z.object({
  song_id: z.string().uuid(),
  allow_unsynced: z.boolean().default(true),
});

export const midiTranscribeWorkflowSchema = sourceAssetInputSchema.extend({
  song_id: z.string().uuid(),
  stem_name: z.string().trim().min(1).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  force_retranscribe: z.boolean().optional(),
});

export async function runStoredJob(jobId: string) {
  const { user, supabase } = await getWereCodeRequestContext();
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('owner_id', user.id)
    .single<JobRow>();

  if (error) {
    throw error;
  }

  const payload = assertRecord(job.request_payload);
  const workflow = typeof payload.workflow === 'string' ? payload.workflow : job.job_type;

  switch (workflow) {
    case 'analyze':
      return runAnalyzeWorkflow(analyzeWorkflowSchema.parse(payload), job);
    case 'separate':
      return runSeparateWorkflow(separateWorkflowSchema.parse(payload), job);
    case 'lyrics_align':
      return runLyricsAlignWorkflow(lyricsAlignWorkflowSchema.parse(payload), job);
    case 'lyrics_fetch':
      return runLyricsFetchWorkflow(lyricsFetchWorkflowSchema.parse(payload), job);
    case 'midi_transcribe':
      return runMidiTranscribeWorkflow(midiTranscribeWorkflowSchema.parse(payload), job);
    default:
      throw new Error(`Stored job workflow is not implemented in Next yet: ${workflow}`);
  }
}

export async function runAnalyzeWorkflow(input: z.infer<typeof analyzeWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('analyze', '/analyze/music', input, existingJob);
  const outputSpecs = [
    jsonOutput(context.userId, input.song_id, context.job.id, 'analysis', 'analysis_json', 'analysis.json'),
  ];
  const inputUrl = await resolveInputUrl(context.supabase, input, context.userId, input.song_id);
  const output_upload_urls = await createUploadUrlMap(outputSpecs);

  const result = await runJobWithModal({
    supabase: context.supabase,
    job: context.job,
    endpoint: '/analyze/music',
    payload: {
      input_url: inputUrl,
      output_upload_urls,
      analyzers: input.analyzers,
      preset: input.preset,
      transpose_to: input.transpose_to,
      is_stem: input.is_stem,
      job_id: context.job.id,
    },
    outputSpecs,
    songId: input.song_id,
  });
  const analysisResults =
    result.job.status === 'ready'
      ? await persistAnalysisResults(context.supabase, context.userId, input.song_id, result)
      : [];

  return {
    ...result,
    analysisResults,
  };
}

export async function runSeparateWorkflow(input: z.infer<typeof separateWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('separate', '/separate', input, existingJob);
  const outputSpecs = input.stems.map((stem) => ({
    key: stem,
    kind: stemToAssetKind(stem),
    bucket: WERECODE_STORAGE_BUCKETS.artifacts,
    objectPath: buildObjectPath(context.userId, input.song_id, 'artifacts', context.job.id, 'stems', `${stem}.wav`),
    contentType: 'audio/wav',
  }));
  const inputUrl = await resolveInputUrl(context.supabase, input, context.userId, input.song_id);
  const output_upload_urls = await createUploadUrlMap(outputSpecs);

  return runJobWithModal({
    supabase: context.supabase,
    job: context.job,
    endpoint: '/separate',
    payload: {
      input_url: inputUrl,
      output_upload_urls,
      stems: input.stems,
      model: input.model,
      shifts: input.shifts,
      job_id: context.job.id,
    },
    outputSpecs,
    songId: input.song_id,
  });
}

export async function runLyricsAlignWorkflow(input: z.infer<typeof lyricsAlignWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('lyrics_align', '/lyrics/align', input, existingJob);
  let knownLyrics = input.known_lyrics;

  if (!input.force_modal_alignment) {
    const lyricsResolution = await resolveLyricsLocally({
      supabase: context.supabase,
      ownerId: context.userId,
      songId: input.song_id,
      job: context.job,
      allowUnsynced: true,
    });

    if (lyricsResolution.syncedLyrics) {
      const job = await completeJobWithSyncedLyrics(context.supabase, context.userId, context.job, lyricsResolution);
      return {
        job,
        assets: [],
        modal: lyricsResolution.responsePayload,
        lyrics: lyricsResolution.syncedLyrics,
        lyricsLookup: lyricsResolution.responsePayload,
      };
    }

    knownLyrics = knownLyrics ?? lyricsResolution.plainLyrics?.content ?? undefined;
  }

  const outputSpecs = [
    jsonOutput(context.userId, input.song_id, context.job.id, 'lyrics_alignment', 'lyrics_alignment', 'lyrics_alignment.json'),
  ];
  const inputUrl = await resolveInputUrl(context.supabase, input, context.userId, input.song_id);
  const output_upload_urls = await createUploadUrlMap(outputSpecs);

  const result = await runJobWithModal({
    supabase: context.supabase,
    job: context.job,
    endpoint: '/lyrics/align',
    payload: {
      input_url: inputUrl,
      output_upload_urls,
      known_lyrics: knownLyrics,
      language: input.language,
      job_id: context.job.id,
    },
    outputSpecs,
    songId: input.song_id,
  });
  const lyrics =
    result.job.status === 'ready'
      ? await persistAlignedLyrics(context.supabase, context.userId, input.song_id, result)
      : null;

  return {
    ...result,
    lyrics,
  };
}

export async function runLyricsFetchWorkflow(input: z.infer<typeof lyricsFetchWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('lyrics_fetch', null, input, existingJob);
  await updateJob(context.supabase, context.userId, context.job.id, {
    status: 'processing',
    progress: 10,
    started_at: new Date().toISOString(),
    message: 'Checking LRCLIB for synced lyrics',
    modal_endpoint: null,
  });

  const lyricsResolution = await resolveLyricsLocally({
    supabase: context.supabase,
    ownerId: context.userId,
    songId: input.song_id,
    job: context.job,
    allowUnsynced: input.allow_unsynced,
  });
  const hasLyrics = lyricsResolution.lyrics.length > 0;
  const job = await updateJob(context.supabase, context.userId, context.job.id, {
    status: 'ready',
    progress: 100,
    message: hasLyrics ? 'Lyrics lookup completed' : 'No lyrics found',
    response_payload: lyricsResolution.responsePayload as Json,
    diagnostics: [],
    completed_at: new Date().toISOString(),
  });

  return {
    job,
    lyrics: lyricsResolution.lyrics,
    lyricsLookup: lyricsResolution.responsePayload,
  };
}

export async function runMidiTranscribeWorkflow(input: z.infer<typeof midiTranscribeWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('midi_transcribe', '/midi/transcribe', input, existingJob);
  const outputSpecs: OutputSpec[] = [
    {
      key: 'midi',
      kind: 'midi',
      bucket: WERECODE_STORAGE_BUCKETS.artifacts,
      objectPath: buildObjectPath(context.userId, input.song_id, 'artifacts', context.job.id, 'audio.mid'),
      contentType: 'audio/midi',
    },
    jsonOutput(context.userId, input.song_id, context.job.id, 'note_events', 'note_events', 'note_events.json'),
  ];
  const inputUrl = await resolveInputUrl(context.supabase, input, context.userId, input.song_id);
  const output_upload_urls = await createUploadUrlMap(outputSpecs);

  return runJobWithModal({
    supabase: context.supabase,
    job: context.job,
    endpoint: '/midi/transcribe',
    payload: {
      input_url: inputUrl,
      output_upload_urls,
      stem_name: input.stem_name,
      params: input.params,
      force_retranscribe: input.force_retranscribe,
      job_id: context.job.id,
    },
    outputSpecs,
    songId: input.song_id,
  });
}

async function resolveLyricsLocally(options: {
  supabase: SupabaseClient;
  ownerId: string;
  songId: string;
  job: JobRow;
  allowUnsynced: boolean;
}): Promise<LyricsResolution> {
  await updateJob(options.supabase, options.ownerId, options.job.id, {
    status: 'processing',
    progress: 15,
    started_at: options.job.started_at ?? new Date().toISOString(),
    message: 'Checking existing synced lyrics',
  });

  const [existingSynced, existingPlain] = await Promise.all([
    findExistingSyncedLyrics(options.supabase, options.ownerId, options.songId),
    findExistingPlainLyrics(options.supabase, options.ownerId, options.songId),
  ]);

  if (existingSynced) {
    return {
      lyrics: [existingSynced, existingPlain].filter((row): row is LyricsRow => Boolean(row)),
      syncedLyrics: existingSynced,
      plainLyrics: existingPlain,
      lookup: null,
      responsePayload: {
        status: 'skipped',
        skipped_modal: true,
        reason: 'existing_synced_lyrics',
        lyrics: summarizeLyricsRows([existingSynced, existingPlain].filter((row): row is LyricsRow => Boolean(row))),
      },
    };
  }

  const song = await getOwnedSong(options.supabase, options.ownerId, options.songId);
  await updateJob(options.supabase, options.ownerId, options.job.id, {
    progress: 25,
    message: 'Checking LRCLIB for synced lyrics',
  });

  const lookup = await lookupLyrics({
    title: song.title,
    artist: song.artist,
    album: song.album,
    durationSec: song.duration_sec,
    allowUnsynced: options.allowUnsynced,
  });
  const persistedLyrics = lookup.attempted && lookup.response ? await persistLocalLookupLyrics(options.supabase, {
    ownerId: options.ownerId,
    songId: options.songId,
    jobId: options.job.id,
    lookup: lookup.response,
  }) : [];
  const syncedLyrics = persistedLyrics.find((row) => row.lyrics_type === 'lrc') ?? null;
  const plainLyrics = persistedLyrics.find((row) => row.lyrics_type === 'plain') ?? existingPlain;
  const lyrics = [...persistedLyrics];
  if (existingPlain && !lyrics.some((row) => row.id === existingPlain.id)) {
    lyrics.push(existingPlain);
  }

  return {
    lyrics,
    syncedLyrics,
    plainLyrics,
    lookup,
    responsePayload: {
      status: syncedLyrics ? 'skipped' : persistedLyrics.length > 0 ? 'ready' : 'not_found',
      skipped_modal: Boolean(syncedLyrics),
      reason: syncedLyrics
        ? 'lrclib_synced_lyrics_found'
        : persistedLyrics.length > 0
          ? 'lrclib_plain_lyrics_found'
          : 'lyrics_not_found',
      lyrics_lookup: summarizeLyricsLookup(lookup),
      lyrics: summarizeLyricsRows(lyrics),
    },
  };
}

async function completeJobWithSyncedLyrics(
  supabase: SupabaseClient,
  ownerId: string,
  job: JobRow,
  lyricsResolution: LyricsResolution
) {
  const reason = lyricsResolution.responsePayload.reason;
  return updateJob(supabase, ownerId, job.id, {
    status: 'ready',
    progress: 100,
    message:
      reason === 'existing_synced_lyrics'
        ? 'Synced lyrics already available; skipped Modal alignment'
        : 'Synced lyrics fetched locally; skipped Modal alignment',
    modal_endpoint: null,
    response_payload: lyricsResolution.responsePayload as Json,
    diagnostics: [],
    completed_at: new Date().toISOString(),
  });
}

async function workflowContext(jobType: JobType, endpoint: string | null, requestPayload: unknown, existingJob?: JobRow) {
  const { user, supabase } = await getWereCodeRequestContext();

  if (existingJob) {
    if (existingJob.owner_id !== user.id) {
      throw new Error('Stored job does not belong to the current user');
    }
    if (existingJob.job_type !== jobType) {
      throw new Error(`Stored job type ${existingJob.job_type} cannot run ${jobType}`);
    }

    return { userId: user.id, supabase, job: existingJob };
  }

  const songId = getSongId(requestPayload);
  if (songId) {
    await assertOwnedSong(supabase, user.id, songId);
  }

  const job = await createJob(supabase, user.id, {
    song_id: songId,
    job_type: jobType,
    modal_endpoint: endpoint,
    request_payload: {
      workflow: jobType,
      ...(assertRecord(requestPayload) as Record<string, unknown>),
    },
  });

  return { userId: user.id, supabase, job };
}

async function runJobWithModal(options: {
  supabase: SupabaseClient;
  job: JobRow;
  endpoint: string;
  payload: Record<string, unknown>;
  outputSpecs?: OutputSpec[];
  songId?: string;
}) {
  await updateJob(options.supabase, options.job.owner_id, options.job.id, {
    status: 'processing',
    progress: 10,
    started_at: new Date().toISOString(),
    modal_endpoint: options.endpoint,
  });

  const modal = await modalFetch<ModalResponse>(options.endpoint, {
    method: 'POST',
    body: JSON.stringify(options.payload),
  });
  const modalStatus = modal.status ?? 'ready';
  const ready = modalStatus === 'ready' || modalStatus === 'skipped';
  const pending = modalStatus === 'accepted' || modalStatus === 'processing';
  const failed = !ready && !pending;

  if (failed && options.outputSpecs?.length) {
    await cleanupOutputSpecs(options.supabase, options.outputSpecs);
  }
  const assets = ready && options.outputSpecs?.length
    ? await createAssetRows(options.supabase, {
        ownerId: options.job.owner_id,
        songId: options.songId ?? options.job.song_id,
        job: options.job,
        outputSpecs: options.outputSpecs,
        modal,
      })
    : [];
  if (ready && assets.length > 0 && (options.songId ?? options.job.song_id)) {
    await updateSongReadiness(options.supabase, options.job.owner_id, options.songId ?? options.job.song_id!, assets);
  }

  const updatedJob = await updateJob(options.supabase, options.job.owner_id, options.job.id, {
    status: ready ? 'ready' : pending ? 'processing' : 'failed',
    progress: ready ? 100 : pending ? 50 : 0,
    message: ready ? 'Modal job completed' : pending ? 'Modal job is still processing' : 'Modal job failed',
    error_message: failed ? firstDiagnosticMessage(modal.diagnostics) : null,
    response_payload: modal as Json,
    diagnostics: (modal.diagnostics ?? []) as Json,
    completed_at: pending ? null : new Date().toISOString(),
  });

  return {
    job: updatedJob,
    assets,
    modal,
  };
}

async function cleanupOutputSpecs(supabase: SupabaseClient, outputSpecs: OutputSpec[]) {
  const byBucket = new Map<WereCodeStorageBucket, string[]>();
  for (const spec of outputSpecs) {
    const paths = byBucket.get(spec.bucket) ?? [];
    paths.push(spec.objectPath);
    byBucket.set(spec.bucket, paths);
  }

  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, objectPaths]) => {
      const { error } = await supabase.storage.from(bucket).remove(objectPaths);
      if (error) {
        // Cleanup should not mask the original Modal failure.
        console.warn(`Could not clean failed Modal outputs from ${bucket}: ${error.message}`);
      }
    })
  );
}

async function createJob(
  supabase: SupabaseClient,
  ownerId: string,
  values: {
    song_id?: string | null;
    version_id?: string | null;
    job_type: JobType;
    modal_endpoint?: string | null;
    request_payload?: unknown;
  }
) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      owner_id: ownerId,
      song_id: values.song_id ?? null,
      version_id: values.version_id ?? null,
      job_type: values.job_type,
      modal_endpoint: values.modal_endpoint ?? null,
      request_payload: values.request_payload ?? {},
    })
    .select('*')
    .single<JobRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function assertOwnedSong(supabase: SupabaseClient, ownerId: string, songId: string) {
  const { error } = await supabase
    .from('songs')
    .select('id')
    .eq('id', songId)
    .eq('owner_id', ownerId)
    .single();

  if (error) {
    throw error;
  }
}

async function getOwnedSong(supabase: SupabaseClient, ownerId: string, songId: string) {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', songId)
    .eq('owner_id', ownerId)
    .single<SongRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function findExistingSyncedLyrics(supabase: SupabaseClient, ownerId: string, songId: string) {
  const { data, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('song_id', songId)
    .eq('owner_id', ownerId)
    .in('lyrics_type', ['lrc', 'alignment_json'])
    .not('content', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<LyricsRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function findExistingPlainLyrics(supabase: SupabaseClient, ownerId: string, songId: string) {
  const { data, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('song_id', songId)
    .eq('owner_id', ownerId)
    .eq('lyrics_type', 'plain')
    .not('content', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<LyricsRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function persistLocalLookupLyrics(
  supabase: SupabaseClient,
  options: {
    ownerId: string;
    songId: string;
    jobId: string;
    lookup: {
      plain_lyrics?: string | null;
      synced_lyrics?: string | null;
      sources?: string[];
      sources_tried?: string[];
    };
  }
) {
  const rows = [];
  const source = sourceForLocalLookup(options.lookup);
  const metadata = {
    job_id: options.jobId,
    provider_sources: options.lookup.sources ?? [],
    sources_tried: options.lookup.sources_tried ?? [],
    fetched_at: new Date().toISOString(),
  };

  if (options.lookup.plain_lyrics?.trim()) {
    rows.push({
      owner_id: options.ownerId,
      song_id: options.songId,
      lyrics_type: 'plain',
      source,
      content: options.lookup.plain_lyrics,
      asset_id: null,
      metadata,
    });
  }

  if (options.lookup.synced_lyrics?.trim()) {
    rows.push({
      owner_id: options.ownerId,
      song_id: options.songId,
      lyrics_type: 'lrc',
      source,
      content: options.lookup.synced_lyrics,
      asset_id: null,
      metadata,
    });
  }

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('lyrics')
    .upsert(rows, { onConflict: 'song_id,lyrics_type' })
    .select('*')
    .returns<LyricsRow[]>();

  if (error) {
    throw error;
  }

  await updateSongLyricsFlags(supabase, options.ownerId, options.songId, data ?? []);
  return data ?? [];
}

async function updateSongLyricsFlags(supabase: SupabaseClient, ownerId: string, songId: string, lyrics: LyricsRow[]) {
  const patch: Record<string, boolean> = {};
  if (lyrics.some((row) => row.lyrics_type === 'plain')) {
    patch.has_plain_lyrics = true;
  }
  if (lyrics.some((row) => row.lyrics_type === 'lrc' || row.lyrics_type === 'alignment_json')) {
    patch.has_synced_lyrics = true;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  const { error } = await supabase.from('songs').update(patch).eq('id', songId).eq('owner_id', ownerId);
  if (error) {
    throw error;
  }
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

async function createAssetRows(
  supabase: SupabaseClient,
  options: {
    ownerId: string;
    songId?: string | null;
    job: JobRow;
    outputSpecs: OutputSpec[];
    modal: ModalResponse;
  }
) {
  const rows = options.outputSpecs.map((spec) => {
    const artifact = options.modal.artifacts?.[spec.key] ?? (spec.key === 'midi' ? options.modal.artifact ?? undefined : undefined);

    if (!artifact?.uploaded) {
      return null;
    }

    return {
      owner_id: options.ownerId,
      song_id: options.songId ?? null,
      version_id: options.job.version_id,
      kind: spec.kind,
      bucket_id: spec.bucket,
      object_path: spec.objectPath,
      content_type: artifact?.mime_type ?? spec.contentType ?? null,
      byte_size: readByteSize(artifact),
      duration_sec: artifact?.duration_sec ?? null,
      modal_model: artifact?.model ?? null,
      modal_endpoint: options.job.modal_endpoint,
      metadata: {
        job_id: options.job.id,
        modal_artifact: artifact ?? null,
      },
    };
  }).filter((row) => row !== null);

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('assets').insert(rows).select('*').returns<AssetRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function updateSongReadiness(supabase: SupabaseClient, ownerId: string, songId: string, assets: AssetRow[]) {
  const patch: Record<string, boolean> = {};
  for (const asset of assets) {
    if (asset.kind === 'source_audio') {
      patch.has_audio = true;
    }
    if (asset.kind === 'normalized_audio') {
      patch.has_normalized_audio = true;
    }
    if (asset.kind.startsWith('stem_')) {
      patch.has_stems = true;
    }
    if (asset.kind === 'analysis_json') {
      patch.has_analysis = true;
    }
    if (asset.kind === 'lyrics_plain') {
      patch.has_plain_lyrics = true;
    }
    if (asset.kind === 'lyrics_lrc' || asset.kind === 'lyrics_alignment') {
      patch.has_synced_lyrics = true;
    }
    if (asset.kind === 'midi' || asset.kind === 'note_events') {
      patch.has_midi = true;
    }
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  const { error } = await supabase.from('songs').update(patch).eq('id', songId).eq('owner_id', ownerId);
  if (error) {
    throw error;
  }
}

async function persistAnalysisResults(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  result: { assets: AssetRow[]; modal: ModalResponse }
) {
  const analyses = assertRecord(result.modal.analyses);
  const assetId = result.assets.find((asset) => asset.kind === 'analysis_json')?.id ?? null;
  const rows = Object.entries(analyses)
    .filter(([name]) => name !== '_meta')
    .map(([name, value]) => {
      const payload = assertRecord(value);
      return {
        owner_id: ownerId,
        song_id: songId,
        asset_id: assetId,
        analyzer_name: name,
        analyzer_version: typeof payload.version === 'string' ? payload.version : null,
        ok: typeof payload.ok === 'boolean' ? payload.ok : true,
        elapsed_sec: typeof payload.elapsed_sec === 'number' ? payload.elapsed_sec : null,
        error: typeof payload.error === 'string' ? payload.error : null,
        data: value ?? {},
      };
    });

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('analysis_results').insert(rows).select('*');
  if (error) {
    throw error;
  }

  return data ?? [];
}

async function persistAlignedLyrics(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  result: { assets: AssetRow[]; modal: ModalResponse }
) {
  const payload = {
    language: result.modal.language ?? null,
    transcript: result.modal.transcript ?? '',
    lines: Array.isArray(result.modal.lines) ? result.modal.lines : [],
  };

  const { data, error } = await supabase
    .from('lyrics')
    .upsert(
      {
        owner_id: ownerId,
        song_id: songId,
        lyrics_type: 'alignment_json',
        source: 'modal:/lyrics/align',
        content: JSON.stringify(payload),
        asset_id: result.assets.find((asset) => asset.kind === 'lyrics_alignment')?.id ?? null,
        metadata: {
          model: result.assets.find((asset) => asset.kind === 'lyrics_alignment')?.modal_model ?? null,
        },
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

  return data;
}

async function resolveInputUrl(
  supabase: SupabaseClient,
  input: { input_url?: string; source_asset_id?: string },
  ownerId: string,
  songId: string
) {
  if (input.input_url) {
    return input.input_url;
  }

  if (!input.source_asset_id) {
    throw new Error('Missing source asset id');
  }

  const { data: asset, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', input.source_asset_id)
    .eq('owner_id', ownerId)
    .eq('song_id', songId)
    .single<AssetRow>();

  if (error) {
    throw error;
  }

  const signed = await createSignedStorageDownloadUrl({
    bucket: asset.bucket_id as WereCodeStorageBucket,
    objectPath: asset.object_path,
    expiresIn: 3600,
  });

  return signed.signedUrl;
}

async function createUploadUrlMap(outputSpecs: OutputSpec[]) {
  const entries = await Promise.all(
    outputSpecs.map(async (spec) => {
      const upload = await createSignedStorageUploadUrl({
        bucket: spec.bucket,
        objectPath: spec.objectPath,
        upsert: true,
      });

      return [spec.key, upload.signedUrl] as const;
    })
  );

  return Object.fromEntries(entries);
}

function jsonOutput(
  ownerId: string,
  songId: string,
  jobId: string,
  key: string,
  kind: AssetKind,
  filename: string
): OutputSpec {
  return {
    key,
    kind,
    bucket: WERECODE_STORAGE_BUCKETS.artifacts,
    objectPath: buildObjectPath(ownerId, songId, 'artifacts', jobId, filename),
    contentType: 'application/json',
  };
}

function buildObjectPath(...parts: string[]) {
  return parts.flatMap((part) => part.split('/')).filter(Boolean).join('/');
}

function stemToAssetKind(stem: string): AssetKind {
  if (stem === 'accompaniment') {
    return 'stem_other';
  }

  return `stem_${stem}` as AssetKind;
}

function getSongId(value: unknown) {
  const record = assertRecord(value);
  return typeof record.song_id === 'string' ? record.song_id : null;
}

function sourceForLocalLookup(lookup: { sources?: string[] }) {
  return lookup.sources?.length ? lookup.sources.join(', ') : 'lyrics_lookup';
}

function summarizeLyricsLookup(lookup: LyricsLookupResult | null) {
  if (!lookup) {
    return {
      attempted: false,
      reason: 'existing_synced_lyrics',
    };
  }

  if (!lookup.attempted) {
    return lookup;
  }

  return {
    attempted: true,
    error: lookup.error,
    success: Boolean(lookup.response?.success),
    message: lookup.response?.message ?? null,
    has_synced_lyrics: Boolean(lookup.response?.has_synced_lyrics),
    has_plain_lyrics: Boolean(lookup.response?.has_plain_lyrics),
    sources: lookup.response?.sources ?? [],
    sources_tried: lookup.response?.sources_tried ?? [],
  };
}

function summarizeLyricsRows(rows: LyricsRow[]) {
  return rows.map((row) => ({
    id: row.id,
    lyrics_type: row.lyrics_type,
    source: row.source,
  }));
}

function assertRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readByteSize(artifact: ArtifactMetadata | undefined) {
  const value = artifact?.metadata?.byte_size;
  return typeof value === 'number' ? value : null;
}

function firstDiagnosticMessage(diagnostics: Diagnostic[] | undefined) {
  return diagnostics?.find((diagnostic) => diagnostic.level === 'error')?.message ?? diagnostics?.[0]?.message ?? 'Modal job failed';
}
