import type { AnalysisResultRow, AssetRow, JobRow, LyricsRow, SongRow } from './werecode';

export type SongSummary = Pick<
  SongRow,
  | 'id'
  | 'title'
  | 'artist'
  | 'album'
  | 'source_kind'
  | 'source_url'
  | 'duration_sec'
  | 'status'
  | 'has_audio'
  | 'has_normalized_audio'
  | 'has_stems'
  | 'has_analysis'
  | 'has_plain_lyrics'
  | 'has_synced_lyrics'
  | 'has_midi'
  | 'metadata'
  | 'created_at'
  | 'updated_at'
>;

export type JobSummary = Pick<
  JobRow,
  | 'id'
  | 'song_id'
  | 'version_id'
  | 'job_type'
  | 'status'
  | 'progress'
  | 'message'
  | 'error_message'
  | 'modal_endpoint'
  | 'started_at'
  | 'completed_at'
  | 'created_at'
  | 'updated_at'
>;

export type AssetSummary = Pick<
  AssetRow,
  | 'id'
  | 'song_id'
  | 'kind'
  | 'bucket_id'
  | 'object_path'
  | 'content_type'
  | 'byte_size'
  | 'duration_sec'
  | 'modal_model'
  | 'modal_endpoint'
  | 'created_at'
>;

export type AssetSigningInfo = Pick<AssetRow, 'id' | 'song_id' | 'bucket_id' | 'object_path'>;

export type SignedAssetUrl = {
  assetId: string;
  signedUrl: string;
  expiresIn: number;
  expiresAt: string;
};

export type StudioDetail = {
  song: SongSummary;
  assets: AssetSummary[];
  analysisResults: AnalysisResultRow[];
  lyrics: LyricsRow[];
};
