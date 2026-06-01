import { z } from 'zod';

export const sourceKindSchema = z.enum([
  'manual',
  'youtube',
  'youtube_music',
  'audio_upload',
  'midi_upload',
  'musicxml_upload',
]);

export const songStatusSchema = z.enum(['draft', 'importing', 'ready', 'failed', 'archived']);

export const assetKindSchema = z.enum([
  'source_audio',
  'source_video',
  'source_metadata',
  'source_midi',
  'source_musicxml',
  'normalized_audio',
  'preview_audio',
  'stem_vocals',
  'stem_drums',
  'stem_bass',
  'stem_other',
  'stem_guitar',
  'stem_piano',
  'stems_manifest',
  'analysis_json',
  'lyrics_plain',
  'lyrics_lrc',
  'lyrics_alignment',
  'midi',
  'note_events',
  'musicxml',
  'tab_musicxml',
  'waveform_json',
  'spectrogram_image',
  'midi_edit_manifest',
]);

export const jobTypeSchema = z.enum([
  'download',
  'probe',
  'normalize',
  'convert',
  'separate',
  'analyze',
  'lyrics_fetch',
  'lyrics_align',
  'midi_transcribe',
  'midi_analyze',
  'midi_to_musicxml',
  'midi_edit_propose',
  'midi_edit_apply',
]);

export const jobStatusSchema = z.enum(['queued', 'processing', 'ready', 'failed', 'cancelled']);

export const jsonRecordSchema = z.record(z.string(), z.unknown());

export const createSongSchema = z.object({
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1).nullable().optional(),
  album: z.string().trim().min(1).nullable().optional(),
  source_kind: sourceKindSchema.default('manual'),
  source_url: z.string().trim().url().nullable().optional(),
  duration_sec: z.number().nonnegative().nullable().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const updateSongSchema = createSongSchema
  .partial()
  .extend({
    status: songStatusSchema.optional(),
    has_audio: z.boolean().optional(),
    has_normalized_audio: z.boolean().optional(),
    has_stems: z.boolean().optional(),
    has_analysis: z.boolean().optional(),
    has_plain_lyrics: z.boolean().optional(),
    has_synced_lyrics: z.boolean().optional(),
    has_midi: z.boolean().optional(),
    archived_at: z.string().datetime().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one song field to update',
  });

export const createAssetSchema = z.object({
  version_id: z.string().uuid().nullable().optional(),
  kind: assetKindSchema,
  bucket_id: z.string().min(1),
  object_path: z.string().min(1),
  content_type: z.string().min(1).nullable().optional(),
  byte_size: z.number().int().nonnegative().nullable().optional(),
  duration_sec: z.number().nonnegative().nullable().optional(),
  checksum_sha256: z.string().min(1).nullable().optional(),
  source_asset_id: z.string().uuid().nullable().optional(),
  modal_model: z.string().min(1).nullable().optional(),
  modal_endpoint: z.string().min(1).nullable().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const createJobSchema = z.object({
  song_id: z.string().uuid().nullable().optional(),
  version_id: z.string().uuid().nullable().optional(),
  job_type: jobTypeSchema,
  message: z.string().nullable().optional(),
  modal_endpoint: z.string().min(1).nullable().optional(),
  request_payload: jsonRecordSchema.default({}),
});

export const updateJobSchema = z
  .object({
    status: jobStatusSchema.optional(),
    progress: z.number().min(0).max(100).optional(),
    message: z.string().nullable().optional(),
    error_message: z.string().nullable().optional(),
    modal_endpoint: z.string().min(1).nullable().optional(),
    response_payload: jsonRecordSchema.optional(),
    diagnostics: z.array(z.unknown()).optional(),
    started_at: z.string().datetime().nullable().optional(),
    completed_at: z.string().datetime().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one job field to update',
  });
