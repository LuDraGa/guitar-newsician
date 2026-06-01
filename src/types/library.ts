import type { Json } from '@/types/werecode';

export type LibrarySong = {
  song_id: string;
  song_folder: string;
  title: string;
  artist: string;
  duration?: number;
  download_date?: string;
  audio_file: string;
  converted_file: string | null;
  analysis_file: string | null;
  stems_folder: string | null;
  stem_files: Record<string, string>;
  lyrics_file: string | null;
  synced_lyrics_file: string | null;
  has_audio: boolean;
  has_converted: boolean;
  has_analysis: boolean;
  has_stems: boolean;
  has_stem_analysis: boolean;
  has_lyrics: boolean;
  has_synced_lyrics: boolean;
  metadata: {
    title?: string;
    artist?: string;
    duration?: number;
    download_date?: string;
    webpage_url?: string;
    thumbnail?: string;
    video_id?: string;
    [key: string]: Json | undefined;
  };
};

export type ViewMode = 'table' | 'cards';

export type DownloadRequest = {
  url: string;
  format?: 'm4a' | 'opus' | 'mp3';
  quality?: 'high' | 'medium' | 'low';
};
