import 'server-only';

import { z } from 'zod';

import {
  DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT,
  estimateStereoWavBytes,
  getStemSeparationDurationLimitWarning,
  stemSeparationContentType,
  type StemSeparationArtifactFormat,
} from '@/lib/audio/stem-separation-limits';
import { RouteNotFoundError, WorkflowConflictError } from '@/lib/http/route-error';
import { modalFetch } from '@/lib/modal/client';
import { deriveStudioOverviewData } from '@/lib/music/analysis-overview';
import {
  WERECODE_STORAGE_BUCKETS,
  type WereCodeStorageBucket,
  createSignedStorageDownloadUrl,
  createSignedStorageUploadUrl,
} from '@/lib/supabase/storage';
import { getWereCodeRequestContext, requireOwnedSong, type WereCodeSupabaseClient } from '@/server/werecode/context';
import { lookupLyrics, type LyricsLookupResult } from '@/server/werecode/lyrics-lookup';
import { PIPELINE_VERSIONS, STAGE_ASSET_KINDS, type PipelineStage } from '@/server/werecode/pipeline-versions';
import type { AnalysisResultRow, AssetKind, AssetRow, JobRow, JobType, Json, LyricsRow, SongRow } from '@/types/werecode';

type SupabaseClient = WereCodeSupabaseClient;

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
  call_id?: string | null;
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
  expectedFormat?: StemSeparationArtifactFormat;
};

type LyricsResolution = {
  lyrics: LyricsRow[];
  syncedLyrics: LyricsRow | null;
  plainLyrics: LyricsRow | null;
  song: SongRow | null;
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
    .array(z.enum(['basic_stats', 'tempo', 'key', 'chords', 'structure', 'tempo_beats', 'tonal_key', 'structure_msaf']))
    .optional(),
  preset: z.enum(['quick', 'full', 'production', 'chord', 'structure']).optional(),
  transpose_to: z.string().trim().min(1).optional(),
  is_stem: z.boolean().optional(),
  force: z.boolean().optional(),
});

export const separateWorkflowSchema = sourceAssetInputSchema.extend({
  song_id: z.string().uuid(),
  stems: z
    .array(z.enum(['vocals', 'guitar', 'bass', 'drums', 'piano', 'accompaniment', 'other']))
    .default(['vocals', 'drums', 'bass', 'other', 'guitar', 'piano']),
  model: z.enum(['htdemucs', 'htdemucs_ft', 'htdemucs_6s', 'mdx_extra']).default('htdemucs_6s'),
  shifts: z.number().int().min(0).max(20).default(2),
  output_format: z.enum(['flac', 'wav']).default(DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT),
  force: z.boolean().optional(),
});

export const lyricsAlignWorkflowSchema = sourceAssetInputSchema.extend({
  song_id: z.string().uuid(),
  known_lyrics: z.string().optional(),
  language: z.string().trim().min(1).optional(),
  force_modal_alignment: z.boolean().default(false),
  force: z.boolean().optional(),
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
  force: z.boolean().optional(),
});

export async function runStoredJob(jobId: string) {
  const { user, supabase } = await getWereCodeRequestContext();
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('owner_id', user.id)
    .maybeSingle<JobRow>();

  if (error) {
    throw error;
  }

  if (!job) {
    throw new RouteNotFoundError('Job not found', 'job_not_found');
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

// Option 2 (async): toggled by env so the default (and local dev) stays synchronous.
function modalAsyncEnabled(): boolean {
  const value = process.env.WERECODE_MODAL_ASYNC;
  return value === '1' || value === 'true';
}

// Poll the gateway for a spawned Modal call. Returns the original endpoint's
// ModalResponse (as `result`) once the call has settled, else `{ status: 'processing' }`.
async function pollModalJob(callId: string): Promise<{ status: string; result?: ModalResponse }> {
  return modalFetch<{ status: string; result?: ModalResponse }>(`/jobs/${encodeURIComponent(callId)}`, {
    method: 'GET',
  });
}

type FinalizeSpec = {
  outputSpecs?: OutputSpec[];
  songId?: string | null;
  pipelineStage?: PipelineStage | null;
};

function parseFinalizeSpec(value: unknown): FinalizeSpec {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    outputSpecs: Array.isArray(record.outputSpecs) ? (record.outputSpecs as OutputSpec[]) : undefined,
    songId: typeof record.songId === 'string' ? record.songId : null,
    pipelineStage: (record.pipelineStage as PipelineStage | null) ?? null,
  };
}

// Single-finalizer claim: only one poller may finalize a given job. Re-claimable
// after 2 min so a crashed finalize can be retried. Two narrow updates avoid a
// PostgREST `or()` over a timestamp value.
async function claimJobFinalize(supabase: SupabaseClient, ownerId: string, jobId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const fresh = await supabase
    .from('jobs')
    .update({ finalize_claimed_at: now })
    .eq('id', jobId)
    .eq('owner_id', ownerId)
    .eq('status', 'processing')
    .is('finalize_claimed_at', null)
    .select('id');
  if (fresh.error) {
    throw fresh.error;
  }
  if ((fresh.data?.length ?? 0) > 0) {
    return true;
  }

  const stale = await supabase
    .from('jobs')
    .update({ finalize_claimed_at: now })
    .eq('id', jobId)
    .eq('owner_id', ownerId)
    .eq('status', 'processing')
    .lt('finalize_claimed_at', staleBefore)
    .select('id');
  if (stale.error) {
    throw stale.error;
  }
  return (stale.data?.length ?? 0) > 0;
}

// Advance one async job: poll the gateway for its spawned Modal call and, once the
// call has settled, finalize it (create assets, persist stage data, flip status)
// via the shared finalizeJobFromModal. Client-driven and user-session scoped.
export async function finalizeStoredJob(jobId: string) {
  const { user, supabase } = await getWereCodeRequestContext();
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('owner_id', user.id)
    .maybeSingle<JobRow>();

  if (error) {
    throw error;
  }
  if (!job) {
    throw new RouteNotFoundError('Job not found', 'job_not_found');
  }

  const idle = { job, song: null as SongRow | null, assets: [] as AssetRow[] };
  if (job.status !== 'processing' || !job.modal_call_id) {
    return idle;
  }

  const polled = await pollModalJob(job.modal_call_id);
  const polledStatus = polled.status ?? 'processing';
  if (polledStatus === 'processing' || polledStatus === 'accepted') {
    return idle;
  }

  if (!(await claimJobFinalize(supabase, user.id, job.id))) {
    return idle;
  }

  const spec = parseFinalizeSpec(job.finalize_spec);
  const modalResult: ModalResponse = polled.result ?? { status: polledStatus };

  return finalizeJobFromModal({
    supabase,
    job,
    modal: modalResult,
    outputSpecs: spec.outputSpecs,
    songId: spec.songId ?? undefined,
    pipelineStage: spec.pipelineStage ?? undefined,
  });
}

export async function runAnalyzeWorkflow(input: z.infer<typeof analyzeWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('analyze', '/analyze/music', input, existingJob);

  const fresh = await maybeSkipIfFresh(context, input.song_id, 'analyze', input.force, existingJob);
  if (fresh) {
    return { ...fresh, analysisResults: [] };
  }

  const outputSpecs = [
    jsonOutput(context.userId, input.song_id, context.job.id, 'analysis', 'analysis_json', 'analysis.json'),
  ];
  const inputUrl = await resolveInputUrl(context.supabase, input, context.userId, input.song_id);
  const output_upload_urls = await createUploadUrlMap(outputSpecs);

  // Stage persistence (persistAnalysisResults) is centralized in finalizeJobFromModal,
  // so the result already carries analysisResults for both sync and async paths.
  return runJobWithModal({
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
    pipelineStage: 'analyze',
  });
}

export async function runSeparateWorkflow(input: z.infer<typeof separateWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('separate', '/separate', input, existingJob);

  const fresh = await maybeSkipIfFresh(context, input.song_id, 'separate', input.force, existingJob);
  if (fresh) {
    return fresh;
  }

  const song = await requireOwnedSong(context.supabase, context.userId, input.song_id);
  const inputAsset = await resolveInputAssetDuration(context.supabase, input, context.userId, input.song_id);
  const durationSec = inputAsset?.duration_sec ?? song.duration_sec;
  const durationWarning = getStemSeparationDurationLimitWarning(durationSec, input.output_format);

  if (durationWarning) {
    return skipSeparateForDurationGuard(context, input, durationSec, durationWarning);
  }

  const outputSpecs = input.stems.map((stem) => ({
    key: stem,
    kind: stemToAssetKind(stem),
    bucket: WERECODE_STORAGE_BUCKETS.artifacts,
    objectPath: buildObjectPath(
      context.userId,
      input.song_id,
      'artifacts',
      context.job.id,
      'stems',
      `${stem}.${input.output_format}`
    ),
    contentType: stemSeparationContentType(input.output_format),
    expectedFormat: input.output_format,
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
      output_format: input.output_format,
      job_id: context.job.id,
    },
    outputSpecs,
    songId: input.song_id,
    pipelineStage: 'separate',
  });
}

async function resolveInputAssetDuration(
  supabase: SupabaseClient,
  input: { source_asset_id?: string },
  ownerId: string,
  songId: string
) {
  if (!input.source_asset_id) {
    return null;
  }

  const { data, error } = await supabase
    .from('assets')
    .select('duration_sec')
    .eq('id', input.source_asset_id)
    .eq('owner_id', ownerId)
    .eq('song_id', songId)
    .maybeSingle<{ duration_sec: number | null }>();

  if (error) {
    throw error;
  }

  return data;
}

async function skipSeparateForDurationGuard(
  context: { supabase: SupabaseClient; userId: string; job: JobRow },
  input: z.infer<typeof separateWorkflowSchema>,
  durationSec: number | null | undefined,
  durationWarning: string
) {
  const estimatedBytesPerStem =
    typeof durationSec === 'number' && Number.isFinite(durationSec) ? estimateStereoWavBytes(durationSec) : null;

  const diagnostics: Diagnostic[] = [
    {
      level: 'error',
      stage: 'separate_duration_guard',
      message: durationWarning,
      details: {
        duration_sec: durationSec ?? null,
        output_format: input.output_format,
        stem_count: input.stems.length,
        estimated_wav_bytes_per_stem: estimatedBytesPerStem,
        estimated_wav_bytes_total: estimatedBytesPerStem !== null ? estimatedBytesPerStem * input.stems.length : null,
      } as unknown as Json,
    },
  ];

  const modal: ModalResponse = {
    status: 'failed',
    diagnostics,
    skipped_modal: true,
  };

  const job = await updateJob(context.supabase, context.job.owner_id, context.job.id, {
    status: 'failed',
    progress: 0,
    message: 'Stem separation skipped before Modal',
    error_message: durationWarning,
    response_payload: modal as unknown as Json,
    diagnostics: diagnostics as unknown as Json,
    completed_at: new Date().toISOString(),
  });

  return {
    job,
    song: null,
    assets: [] as AssetRow[],
    modal,
  };
}

export async function runLyricsAlignWorkflow(input: z.infer<typeof lyricsAlignWorkflowSchema>, existingJob?: JobRow) {
  const context = await workflowContext('lyrics_align', '/lyrics/align', input, existingJob);

  const fresh = await maybeSkipIfFresh(context, input.song_id, 'lyrics_align', input.force, existingJob);
  if (fresh) {
    return { ...fresh, lyrics: null };
  }

  let knownLyrics = input.known_lyrics;

  // A deliberate re-run (force) goes straight to Modal alignment with the new model,
  // skipping the local LRCLIB short-circuit.
  if (!input.force_modal_alignment && !input.force) {
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
        song: lyricsResolution.song,
        assets: [],
        modal: lyricsResolution.responsePayload,
        lyrics: lyricsResolution.syncedLyrics,
        lyricsLookup: lyricsResolution.responsePayload,
      };
    }

    knownLyrics = knownLyrics ?? lyricsResolution.plainLyrics?.content ?? undefined;
  }

  const outputSpecs = [
    jsonOutput(
      context.userId,
      input.song_id,
      context.job.id,
      'lyrics_alignment',
      'lyrics_alignment',
      'lyrics_alignment.json'
    ),
  ];
  const inputUrl = await resolveInputUrl(context.supabase, input, context.userId, input.song_id);
  const output_upload_urls = await createUploadUrlMap(outputSpecs);

  // Stage persistence (persistAlignedLyrics) is centralized in finalizeJobFromModal,
  // so the result already carries lyrics for both sync and async paths.
  return runJobWithModal({
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
    pipelineStage: 'lyrics_align',
  });
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
    song: lyricsResolution.song,
    lyrics: lyricsResolution.lyrics,
    lyricsLookup: lyricsResolution.responsePayload,
  };
}

export async function runMidiTranscribeWorkflow(
  input: z.infer<typeof midiTranscribeWorkflowSchema>,
  existingJob?: JobRow
) {
  const context = await workflowContext('midi_transcribe', '/midi/transcribe', input, existingJob);

  const forceMidi = input.force || input.force_retranscribe;
  const fresh = await maybeSkipIfFresh(context, input.song_id, 'midi_transcribe', forceMidi, existingJob);
  if (fresh) {
    return fresh;
  }

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
    pipelineStage: 'midi_transcribe',
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
      song: null,
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
  const persisted =
    lookup.attempted && lookup.response
      ? await persistLocalLookupLyrics(options.supabase, {
          ownerId: options.ownerId,
          songId: options.songId,
          jobId: options.job.id,
          lookup: lookup.response,
        })
      : { lyrics: [], song: null };
  const persistedLyrics = persisted.lyrics;
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
    song: persisted.song,
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

async function workflowContext(
  jobType: JobType,
  endpoint: string | null,
  requestPayload: unknown,
  existingJob?: JobRow
) {
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
    await requireOwnedSong(supabase, user.id, songId);

    // Dedup guard: never start a second run of the same stage for a song while one
    // is still queued/processing. Stops a double-click, a second tab, or a
    // reload-then-retry from launching a duplicate (and duplicately-billed) Modal
    // job. The partial unique index `jobs_active_stage_dedup_idx` is the race
    // backstop for the window between this read and the insert below.
    const active = await findActiveJob(supabase, user.id, songId, jobType);
    if (active) {
      throw workflowConflict(jobType);
    }
  }

  let job: JobRow;
  try {
    job = await createJob(supabase, user.id, {
      song_id: songId,
      job_type: jobType,
      modal_endpoint: endpoint,
      request_payload: {
        workflow: jobType,
        ...(assertRecord(requestPayload) as Record<string, unknown>),
      },
    });
  } catch (error) {
    // Lost the race against a concurrent enqueue of the same stage — the partial
    // unique index rejected the duplicate. Surface it as a conflict, not a 500.
    if (songId && isUniqueViolation(error)) {
      const active = await findActiveJob(supabase, user.id, songId, jobType);
      if (active) {
        throw workflowConflict(jobType);
      }
    }
    throw error;
  }

  return { userId: user.id, supabase, job };
}

type WorkflowJobContext = { supabase: SupabaseClient; userId: string; job: JobRow };

/**
 * Skip-if-fresh guard for re-runnable stages. Returns an existing-output result
 * when the song already has a current output for `stage` stamped with the latest
 * pipeline version — unless the caller forces a re-run or this is a stored-job
 * replay (`existingJob`), both of which always run. Returns null when work is needed.
 */
async function maybeSkipIfFresh(
  context: WorkflowJobContext,
  songId: string,
  stage: PipelineStage,
  force: boolean | undefined,
  existingJob: JobRow | undefined
) {
  if (force || existingJob) {
    return null;
  }

  const current = await findCurrentStageAssets(context.supabase, context.userId, songId, STAGE_ASSET_KINDS[stage]);
  const target = PIPELINE_VERSIONS[stage].version;
  if (current.length === 0 || !current.some((asset) => asset.pipeline_version === target)) {
    return null;
  }

  const job = await updateJob(context.supabase, context.userId, context.job.id, {
    status: 'ready',
    progress: 100,
    message: `${PIPELINE_VERSIONS[stage].label} already up to date (${target})`,
    response_payload: {
      status: 'skipped',
      reason: 'already_current',
      pipeline_version: target,
    } as Json,
    diagnostics: [],
    completed_at: new Date().toISOString(),
  });

  return {
    job,
    song: null as SongRow | null,
    assets: current,
    modal: { status: 'skipped' } as ModalResponse,
  };
}

async function findCurrentStageAssets(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  kinds: AssetKind[]
): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('song_id', songId)
    .eq('is_current', true)
    .in('kind', kinds)
    .returns<AssetRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function supersedePriorStageAssets(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  kinds: AssetKind[]
) {
  const { error } = await supabase
    .from('assets')
    .update({ is_current: false })
    .eq('owner_id', ownerId)
    .eq('song_id', songId)
    .eq('is_current', true)
    .in('kind', kinds);

  if (error) {
    throw error;
  }
}

async function runJobWithModal(options: {
  supabase: SupabaseClient;
  job: JobRow;
  endpoint: string;
  payload: Record<string, unknown>;
  outputSpecs?: OutputSpec[];
  songId?: string;
  pipelineStage?: PipelineStage;
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
    // Async (Option 2): ask the gateway to spawn the work and return immediately.
    // When the flag is off the header is absent and the gateway runs synchronously
    // exactly as today.
    ...(modalAsyncEnabled() ? { headers: { 'x-werecode-async': '1' } } : {}),
  });

  return finalizeJobFromModal({
    supabase: options.supabase,
    job: options.job,
    modal,
    outputSpecs: options.outputSpecs,
    songId: options.songId,
    pipelineStage: options.pipelineStage,
  });
}

// Terminal half of a Modal-backed job: validate artifacts, supersede prior stage
// outputs, create asset rows, update song readiness, and write the final job row.
// Extracted from runJobWithModal so it can run from either the synchronous path
// (today) or a Modal completion callback (Phase 2), using whichever Supabase client
// the caller supplies — the user-session client today, a service-role client from
// the callback (no user session on a Modal callback).
async function finalizeJobFromModal(options: {
  supabase: SupabaseClient;
  job: JobRow;
  modal: ModalResponse;
  outputSpecs?: OutputSpec[];
  songId?: string;
  pipelineStage?: PipelineStage;
}) {
  let modal = options.modal;

  if (options.outputSpecs?.length && ((modal.status ?? 'ready') === 'ready' || modal.status === 'skipped')) {
    const artifactFormatDiagnostics = validateModalArtifactFormats(options.outputSpecs, modal);
    if (artifactFormatDiagnostics.length > 0) {
      modal = {
        ...modal,
        status: 'failed',
        diagnostics: [...(modal.diagnostics ?? []), ...artifactFormatDiagnostics],
      };
    }
  }

  const modalStatus = modal.status ?? 'ready';
  const ready = modalStatus === 'ready' || modalStatus === 'skipped';
  const pending = modalStatus === 'accepted' || modalStatus === 'processing';
  const failed = !ready && !pending;

  if (failed && options.outputSpecs?.length) {
    await cleanupOutputSpecs(options.supabase, options.outputSpecs);
  }
  const targetSongId = options.songId ?? options.job.song_id;
  // Replace-in-place: a successful re-run supersedes the prior current outputs for
  // this stage (soft-archive via is_current=false) before the new ones are inserted
  // as current. Keeps exactly one current set per (song, stage) and avoids duplicates.
  if (ready && options.outputSpecs?.length && options.pipelineStage && targetSongId) {
    await supersedePriorStageAssets(
      options.supabase,
      options.job.owner_id,
      targetSongId,
      STAGE_ASSET_KINDS[options.pipelineStage]
    );
  }
  const assets =
    ready && options.outputSpecs?.length
      ? await createAssetRows(options.supabase, {
          ownerId: options.job.owner_id,
          songId: targetSongId,
          job: options.job,
          outputSpecs: options.outputSpecs,
          modal,
          pipelineVersion: options.pipelineStage ? PIPELINE_VERSIONS[options.pipelineStage].version : null,
        })
      : [];
  const song =
    ready && assets.length > 0 && (options.songId ?? options.job.song_id)
      ? await updateSongReadiness(
          options.supabase,
          options.job.owner_id,
          options.songId ?? options.job.song_id!,
          assets
        )
      : null;

  const updatedJob = await updateJob(options.supabase, options.job.owner_id, options.job.id, {
    status: ready ? 'ready' : pending ? 'processing' : 'failed',
    progress: ready ? 100 : pending ? 50 : 0,
    message: ready ? 'Modal job completed' : pending ? 'Modal job is still processing' : 'Modal job failed',
    error_message: failed ? firstDiagnosticMessage(modal.diagnostics) : null,
    response_payload: modal as Json,
    diagnostics: (modal.diagnostics ?? []) as Json,
    completed_at: pending ? null : new Date().toISOString(),
    // Async (Option 2): when Modal only accepted the spawn, stash the call id and
    // the spec the later poll/finalize needs to resume this job.
    ...(pending
      ? {
          modal_call_id: typeof modal.call_id === 'string' ? modal.call_id : null,
          finalize_spec: {
            outputSpecs: options.outputSpecs ?? [],
            songId: options.songId ?? null,
            pipelineStage: options.pipelineStage ?? null,
          } as unknown as Json,
        }
      : {}),
  });

  // Stage-specific persistence is centralized here (keyed by pipelineStage) so the
  // synchronous path and the async poll/finalize path produce identical results.
  const analysisResults =
    ready && targetSongId && options.pipelineStage === 'analyze'
      ? await persistAnalysisResults(options.supabase, options.job.owner_id, targetSongId, { assets, modal })
      : [];
  const lyrics =
    ready && targetSongId && options.pipelineStage === 'lyrics_align'
      ? await persistAlignedLyrics(options.supabase, options.job.owner_id, targetSongId, { assets, modal })
      : null;

  return {
    job: updatedJob,
    song,
    assets,
    modal,
    analysisResults,
    lyrics,
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

// A stage is "in flight" while its job is queued or processing; that is the
// window during which a duplicate trigger must be refused.
async function findActiveJob(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  jobType: JobType
): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('song_id', songId)
    .eq('job_type', jobType)
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<JobRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function workflowConflict(jobType: JobType): WorkflowConflictError {
  return new WorkflowConflictError(`A ${jobType.replaceAll('_', ' ')} job is already running for this song.`);
}

async function getOwnedSong(supabase: SupabaseClient, ownerId: string, songId: string) {
  return requireOwnedSong(supabase, ownerId, songId);
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
): Promise<{ lyrics: LyricsRow[]; song: SongRow | null }> {
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
    return { lyrics: [], song: null };
  }

  const { data, error } = await supabase
    .from('lyrics')
    .upsert(rows, { onConflict: 'song_id,lyrics_type' })
    .select('*')
    .returns<LyricsRow[]>();

  if (error) {
    throw error;
  }

  const song = await updateSongLyricsFlags(supabase, options.ownerId, options.songId, data ?? []);
  return { lyrics: data ?? [], song };
}

async function updateSongLyricsFlags(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  lyrics: LyricsRow[]
): Promise<SongRow | null> {
  const patch: Record<string, boolean> = {};
  if (lyrics.some((row) => row.lyrics_type === 'plain')) {
    patch.has_plain_lyrics = true;
  }
  if (lyrics.some((row) => row.lyrics_type === 'lrc' || row.lyrics_type === 'alignment_json')) {
    patch.has_synced_lyrics = true;
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('songs')
    .update(patch)
    .eq('id', songId)
    .eq('owner_id', ownerId)
    .select('*')
    .maybeSingle<SongRow>();
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

async function createAssetRows(
  supabase: SupabaseClient,
  options: {
    ownerId: string;
    songId?: string | null;
    job: JobRow;
    outputSpecs: OutputSpec[];
    modal: ModalResponse;
    pipelineVersion?: string | null;
  }
) {
  const rows = options.outputSpecs
    .map((spec) => {
      const artifact =
        options.modal.artifacts?.[spec.key] ??
        (spec.key === 'midi' ? (options.modal.artifact ?? undefined) : undefined);

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
        pipeline_version: options.pipelineVersion ?? null,
        is_current: true,
        metadata: {
          job_id: options.job.id,
          modal_artifact: artifact ?? null,
        },
      };
    })
    .filter((row) => row !== null);

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('assets').insert(rows).select('*').returns<AssetRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function updateSongReadiness(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  assets: AssetRow[]
): Promise<SongRow | null> {
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
    return null;
  }

  const { data, error } = await supabase
    .from('songs')
    .update(patch)
    .eq('id', songId)
    .eq('owner_id', ownerId)
    .select('*')
    .maybeSingle<SongRow>();
  if (error) {
    throw error;
  }

  return data;
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
        is_current: true,
      };
    });

  if (rows.length === 0) {
    return [];
  }

  // Derive the compact studio_overview summary from the fresh analyzer rows and
  // persist it alongside them. Cold /api/studio reads only this one small row
  // instead of every heavy analyzer envelope. It is excluded from the response
  // below so the live post-run client keeps deriving from the full rows it has.
  const overviewData = deriveStudioOverviewData(rows as unknown as AnalysisResultRow[]);
  const rowsToInsert = [
    ...rows,
    {
      owner_id: ownerId,
      song_id: songId,
      asset_id: assetId,
      analyzer_name: 'studio_overview',
      analyzer_version: null,
      ok: true,
      elapsed_sec: null,
      error: null,
      data: overviewData as unknown as Json,
      is_current: true,
    },
  ];

  // Replace-in-place: soft-archive prior analyzer rows for this song before
  // inserting the fresh set as current (mirrors asset supersede).
  const { error: supersedeError } = await supabase
    .from('analysis_results')
    .update({ is_current: false })
    .eq('owner_id', ownerId)
    .eq('song_id', songId)
    .eq('is_current', true);
  if (supersedeError) {
    throw supersedeError;
  }

  const { data, error } = await supabase.from('analysis_results').insert(rowsToInsert).select('*');
  if (error) {
    throw error;
  }

  return (data ?? []).filter((row) => row.analyzer_name !== 'studio_overview');
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
    .maybeSingle<AssetRow>();

  if (error) {
    throw error;
  }

  if (!asset) {
    throw new RouteNotFoundError('Asset not found', 'asset_not_found');
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
  return parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/');
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

function validateModalArtifactFormats(outputSpecs: OutputSpec[], modal: ModalResponse): Diagnostic[] {
  const mismatches = outputSpecs
    .map((spec) => {
      const expectedFormat = spec.expectedFormat;
      const artifact = modal.artifacts?.[spec.key] ?? (spec.key === 'midi' ? modal.artifact ?? undefined : undefined);

      if (!expectedFormat || !artifact?.uploaded || artifactMatchesExpectedFormat(artifact, expectedFormat)) {
        return null;
      }

      return {
        key: spec.key,
        expected_format: expectedFormat,
        expected_mime_type: spec.contentType ?? null,
        actual_format: artifact.format ?? null,
        actual_mime_type: artifact.mime_type ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (mismatches.length === 0) {
    return [];
  }

  return [
    {
      level: 'error',
      stage: 'separate_artifact_format',
      message: 'Modal returned stem artifacts in a different format than WereCode requested.',
      details: {
        mismatches,
      } as unknown as Json,
    },
  ];
}

function artifactMatchesExpectedFormat(artifact: ArtifactMetadata, expectedFormat: StemSeparationArtifactFormat) {
  const actualFormat = artifact.format?.toLowerCase() ?? null;
  const actualMime = artifact.mime_type?.split(';')[0]?.trim().toLowerCase() ?? null;

  if (actualFormat === expectedFormat) {
    return true;
  }

  if (expectedFormat === 'flac') {
    return actualMime === 'audio/flac' || actualMime === 'audio/x-flac';
  }

  return actualMime === 'audio/wav' || actualMime === 'audio/x-wav' || actualMime === 'audio/wave';
}

function firstDiagnosticMessage(diagnostics: Diagnostic[] | undefined) {
  return (
    diagnostics?.find((diagnostic) => diagnostic.level === 'error')?.message ??
    diagnostics?.[0]?.message ??
    'Modal job failed'
  );
}
