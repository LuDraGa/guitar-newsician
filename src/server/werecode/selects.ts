export const songSummarySelect = [
  'id',
  'title',
  'artist',
  'album',
  'source_kind',
  'source_url',
  'duration_sec',
  'status',
  'has_audio',
  'has_normalized_audio',
  'has_stems',
  'has_analysis',
  'has_plain_lyrics',
  'has_synced_lyrics',
  'has_midi',
  'metadata',
  'created_at',
  'updated_at',
].join(',');

export const jobSummarySelect = [
  'id',
  'song_id',
  'version_id',
  'job_type',
  'status',
  'progress',
  'message',
  'error_message',
  'modal_endpoint',
  'started_at',
  'completed_at',
  'created_at',
  'updated_at',
].join(',');

export const assetSummarySelect = [
  'id',
  'song_id',
  'kind',
  'bucket_id',
  'object_path',
  'content_type',
  'byte_size',
  'duration_sec',
  'modal_model',
  'modal_endpoint',
  'created_at',
].join(',');

export const assetSigningSelect = [
  'id',
  'song_id',
  'bucket_id',
  'object_path',
].join(',');
