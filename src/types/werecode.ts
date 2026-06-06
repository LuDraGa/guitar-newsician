export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SourceKind = 'manual' | 'youtube' | 'youtube_music' | 'audio_upload' | 'midi_upload' | 'musicxml_upload';

export type SongStatus = 'draft' | 'importing' | 'ready' | 'failed' | 'archived';

export type SongVersionKind =
  | 'source'
  | 'normalized'
  | 'stem'
  | 'transcription'
  | 'analysis'
  | 'lyrics'
  | 'midi_edit'
  | 'manual_edit';

export type SongVersionStatus = 'draft' | 'processing' | 'ready' | 'failed' | 'archived';

export type AssetKind =
  | 'source_audio'
  | 'source_video'
  | 'source_metadata'
  | 'source_midi'
  | 'source_musicxml'
  | 'normalized_audio'
  | 'preview_audio'
  | 'stem_vocals'
  | 'stem_drums'
  | 'stem_bass'
  | 'stem_other'
  | 'stem_guitar'
  | 'stem_piano'
  | 'stems_manifest'
  | 'analysis_json'
  | 'lyrics_plain'
  | 'lyrics_lrc'
  | 'lyrics_alignment'
  | 'midi'
  | 'note_events'
  | 'musicxml'
  | 'tab_musicxml'
  | 'waveform_json'
  | 'spectrogram_image'
  | 'midi_edit_manifest';

export type JobType =
  | 'download'
  | 'probe'
  | 'normalize'
  | 'convert'
  | 'separate'
  | 'analyze'
  | 'lyrics_fetch'
  | 'lyrics_align'
  | 'midi_transcribe'
  | 'midi_analyze'
  | 'midi_to_musicxml'
  | 'midi_edit_propose'
  | 'midi_edit_apply';

export type JobStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled';
export type LyricsType = 'plain' | 'lrc' | 'alignment_json';
export type MidiEditStatus = 'proposed' | 'approved' | 'rejected' | 'applied' | 'failed';
export type WereCodeStorageBucket = 'werecode-sources' | 'werecode-artifacts' | 'werecode-previews';

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type SongRow = {
  id: string;
  owner_id: string;
  title: string;
  artist: string | null;
  album: string | null;
  source_kind: SourceKind;
  source_url: string | null;
  duration_sec: number | null;
  status: SongStatus;
  has_audio: boolean;
  has_normalized_audio: boolean;
  has_stems: boolean;
  has_analysis: boolean;
  has_plain_lyrics: boolean;
  has_synced_lyrics: boolean;
  has_midi: boolean;
  metadata: Json;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetRow = {
  id: string;
  song_id: string | null;
  version_id: string | null;
  owner_id: string;
  kind: AssetKind;
  bucket_id: WereCodeStorageBucket | string;
  object_path: string;
  content_type: string | null;
  byte_size: number | null;
  duration_sec: number | null;
  checksum_sha256: string | null;
  source_asset_id: string | null;
  modal_model: string | null;
  modal_endpoint: string | null;
  pipeline_version: string | null;
  is_current: boolean;
  metadata: Json;
  created_at: string;
};

export type AnalysisResultRow = {
  id: string;
  song_id: string;
  asset_id: string | null;
  owner_id: string;
  analyzer_name: string;
  analyzer_version: string | null;
  ok: boolean;
  elapsed_sec: number | null;
  error: string | null;
  data: Json;
  is_current: boolean;
  created_at: string;
};

export type LyricsRow = {
  id: string;
  song_id: string;
  owner_id: string;
  lyrics_type: LyricsType;
  source: string | null;
  content: string | null;
  asset_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  song_id: string | null;
  version_id: string | null;
  owner_id: string;
  job_type: JobType;
  status: JobStatus;
  progress: number;
  message: string | null;
  error_message: string | null;
  modal_endpoint: string | null;
  request_payload: Json;
  response_payload: Json;
  diagnostics: Json;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MidiEditSessionRow = {
  id: string;
  song_id: string;
  owner_id: string;
  source_midi_asset_id: string | null;
  output_midi_asset_id: string | null;
  stem_name: string | null;
  section_start_sec: number | null;
  section_end_sec: number | null;
  issue_description: string | null;
  status: MidiEditStatus;
  proposed_changes: Json;
  verification: Json;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};
