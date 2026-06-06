'use client';

import { create } from 'zustand';

import type { MusicXmlPreviewData } from '@/lib/music/musicxml';
import type { AnalysisResultRow, AssetRow, JobRow, LyricsRow, SongRow } from '@/types/werecode';
import type { AssetSummary, JobSummary, SignedAssetUrl, SongSummary, StudioDetail } from '@/types/werecode-client';

type AssetCacheEntry = {
  assets: AssetSummary[];
  loadedAt: number;
};

type StudioCacheEntry = {
  detail: StudioDetail;
  loadedAt: number;
};

type SignedUrlCacheEntry = {
  signedUrl: string;
  expiresAt: number;
};

type MusicXmlPreviewCacheEntry = {
  preview: MusicXmlPreviewData;
  loadedAt: number;
};

type WereCodeDataCacheState = {
  songs: SongSummary[];
  songsLoaded: boolean;
  songsLoadedAt: number | null;
  jobs: JobSummary[];
  jobsLoaded: boolean;
  jobsLoadedAt: number | null;
  jobDetailsById: Record<string, JobRow>;
  assetsBySongId: Record<string, AssetCacheEntry>;
  studioBySongId: Record<string, StudioCacheEntry>;
  signedUrlsByAssetId: Record<string, SignedUrlCacheEntry>;
  musicXmlPreviewsByAssetId: Record<string, MusicXmlPreviewCacheEntry>;
  setSongs: (songs: SongSummary[]) => void;
  upsertSong: (song: SongSummary | SongRow) => void;
  removeSong: (songId: string) => void;
  setJobs: (jobs: JobSummary[]) => void;
  upsertJob: (job: JobSummary | JobRow) => void;
  setJobDetail: (job: JobRow) => void;
  setAssetsForSong: (songId: string, assets: AssetSummary[]) => void;
  upsertAssetForSong: (songId: string, asset: AssetSummary | AssetRow) => void;
  setStudioDetail: (songId: string, detail: StudioDetail) => void;
  patchStudioSong: (song: SongSummary | SongRow) => void;
  upsertStudioAssets: (songId: string, assets: Array<AssetSummary | AssetRow>) => void;
  setStudioLyrics: (songId: string, lyrics: LyricsRow[]) => void;
  setStudioAnalysisResults: (songId: string, analysisResults: AnalysisResultRow[]) => void;
  setSignedAssetUrls: (signedUrls: SignedAssetUrl[]) => void;
  setMusicXmlPreview: (assetId: string, preview: MusicXmlPreviewData) => void;
  clear: () => void;
};

const emptyState = {
  songs: [],
  songsLoaded: false,
  songsLoadedAt: null,
  jobs: [],
  jobsLoaded: false,
  jobsLoadedAt: null,
  jobDetailsById: {},
  assetsBySongId: {},
  studioBySongId: {},
  signedUrlsByAssetId: {},
  musicXmlPreviewsByAssetId: {},
};

export const useWereCodeDataCache = create<WereCodeDataCacheState>((set) => ({
  ...emptyState,
  setSongs: (songs) =>
    set({
      songs: songs.map(toSongSummary).sort(sortSongs),
      songsLoaded: true,
      songsLoadedAt: Date.now(),
    }),
  upsertSong: (song) =>
    set((state) => {
      const summary = toSongSummary(song);
      return {
        songs: upsertById(state.songs, summary).sort(sortSongs),
        songsLoaded: state.songsLoaded,
        songsLoadedAt: state.songsLoadedAt,
        studioBySongId: patchStudioDetail(state.studioBySongId, summary.id, { song: summary }),
      };
    }),
  removeSong: (songId) =>
    set((state) => ({
      songs: state.songs.filter((song) => song.id !== songId),
      songsLoaded: true,
      songsLoadedAt: state.songsLoadedAt ?? Date.now(),
    })),
  setJobs: (jobs) =>
    set({
      jobs: jobs.map(toJobSummary).sort(sortJobs),
      jobsLoaded: true,
      jobsLoadedAt: Date.now(),
    }),
  upsertJob: (job) =>
    set((state) => ({
      jobs: upsertById(state.jobs, toJobSummary(job)).sort(sortJobs),
      jobsLoaded: state.jobsLoaded,
      jobsLoadedAt: state.jobsLoadedAt,
    })),
  setJobDetail: (job) =>
    set((state) => ({
      jobs: upsertById(state.jobs, toJobSummary(job)).sort(sortJobs),
      jobsLoaded: state.jobsLoaded,
      jobsLoadedAt: state.jobsLoadedAt,
      jobDetailsById: {
        ...state.jobDetailsById,
        [job.id]: job,
      },
    })),
  setAssetsForSong: (songId, assets) =>
    set((state) => {
      const summaries = assets.map(toAssetSummary).sort(sortAssets);
      return {
        assetsBySongId: {
          ...state.assetsBySongId,
          [songId]: {
            assets: summaries,
            loadedAt: Date.now(),
          },
        },
        studioBySongId: patchStudioDetail(state.studioBySongId, songId, { assets: summaries }),
      };
    }),
  upsertAssetForSong: (songId, asset) =>
    set((state) => {
      const summary = toAssetSummary(asset);
      const currentEntry = state.assetsBySongId[songId];
      const nextAssets = currentEntry ? upsertById(currentEntry.assets, summary).sort(sortAssets) : null;
      const studioEntry = state.studioBySongId[songId];
      const nextStudioAssets = studioEntry ? upsertById(studioEntry.detail.assets, summary).sort(sortAssets) : null;

      return {
        assetsBySongId: nextAssets
          ? {
              ...state.assetsBySongId,
              [songId]: {
                assets: nextAssets,
                loadedAt: currentEntry!.loadedAt,
              },
            }
          : state.assetsBySongId,
        studioBySongId: nextStudioAssets
          ? patchStudioDetail(state.studioBySongId, songId, { assets: nextStudioAssets })
          : state.studioBySongId,
      };
    }),
  setStudioDetail: (songId, detail) =>
    set((state) => {
      const studioDetail = toStudioDetail(detail);
      return {
        studioBySongId: {
          ...state.studioBySongId,
          [songId]: {
            detail: studioDetail,
            loadedAt: Date.now(),
          },
        },
        songs: upsertById(state.songs, studioDetail.song).sort(sortSongs),
        assetsBySongId: {
          ...state.assetsBySongId,
          [songId]: {
            assets: studioDetail.assets,
            loadedAt: Date.now(),
          },
        },
      };
    }),
  patchStudioSong: (song) =>
    set((state) => {
      const summary = toSongSummary(song);
      return {
        songs: upsertById(state.songs, summary).sort(sortSongs),
        studioBySongId: patchStudioDetail(state.studioBySongId, summary.id, { song: summary }),
      };
    }),
  upsertStudioAssets: (songId, assets) =>
    set((state) => {
      const summaries = assets.map(toAssetSummary);
      const studioEntry = state.studioBySongId[songId];
      const assetEntry = state.assetsBySongId[songId];
      const nextStudioAssets = studioEntry
        ? summaries.reduce((current, asset) => upsertById(current, asset), studioEntry.detail.assets).sort(sortAssets)
        : null;
      const nextAssetSummaries = assetEntry
        ? summaries.reduce((current, asset) => upsertById(current, asset), assetEntry.assets).sort(sortAssets)
        : null;

      return {
        studioBySongId: nextStudioAssets
          ? patchStudioDetail(state.studioBySongId, songId, { assets: nextStudioAssets })
          : state.studioBySongId,
        assetsBySongId: nextAssetSummaries
          ? {
              ...state.assetsBySongId,
              [songId]: {
                assets: nextAssetSummaries,
                loadedAt: assetEntry!.loadedAt,
              },
            }
          : state.assetsBySongId,
      };
    }),
  setStudioLyrics: (songId, lyrics) =>
    set((state) => ({
      studioBySongId: patchStudioDetail(state.studioBySongId, songId, { lyrics }),
    })),
  setStudioAnalysisResults: (songId, analysisResults) =>
    set((state) => ({
      studioBySongId: patchStudioDetail(state.studioBySongId, songId, { analysisResults }),
    })),
  setSignedAssetUrls: (signedUrls) =>
    set((state) => {
      const next = { ...state.signedUrlsByAssetId };
      for (const signedUrl of signedUrls) {
        next[signedUrl.assetId] = {
          signedUrl: signedUrl.signedUrl,
          expiresAt: new Date(signedUrl.expiresAt).getTime(),
        };
      }
      return { signedUrlsByAssetId: next };
    }),
  setMusicXmlPreview: (assetId, preview) =>
    set((state) => ({
      musicXmlPreviewsByAssetId: {
        ...state.musicXmlPreviewsByAssetId,
        [assetId]: {
          preview,
          loadedAt: Date.now(),
        },
      },
    })),
  clear: () => set(emptyState),
}));

export function clearWereCodeDataCache() {
  useWereCodeDataCache.getState().clear();
}

export function getCachedSignedAssetUrl(assetId: string, marginMs = 60_000) {
  const cached = useWereCodeDataCache.getState().signedUrlsByAssetId[assetId];
  if (!cached || cached.expiresAt <= Date.now() + marginMs) {
    return null;
  }

  return cached.signedUrl;
}

export function toSongSummary(song: SongSummary | SongRow): SongSummary {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    source_kind: song.source_kind,
    source_url: song.source_url,
    duration_sec: song.duration_sec,
    status: song.status,
    has_audio: song.has_audio,
    has_normalized_audio: song.has_normalized_audio,
    has_stems: song.has_stems,
    has_analysis: song.has_analysis,
    has_plain_lyrics: song.has_plain_lyrics,
    has_synced_lyrics: song.has_synced_lyrics,
    has_midi: song.has_midi,
    metadata: song.metadata,
    created_at: song.created_at,
    updated_at: song.updated_at,
  };
}

export function toJobSummary(job: JobSummary | JobRow): JobSummary {
  return {
    id: job.id,
    song_id: job.song_id,
    version_id: job.version_id,
    job_type: job.job_type,
    status: job.status,
    progress: job.progress,
    message: job.message,
    error_message: job.error_message,
    modal_endpoint: job.modal_endpoint,
    started_at: job.started_at,
    completed_at: job.completed_at,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

export function toAssetSummary(asset: AssetSummary | AssetRow): AssetSummary {
  return {
    id: asset.id,
    song_id: asset.song_id,
    kind: asset.kind,
    bucket_id: asset.bucket_id,
    object_path: asset.object_path,
    content_type: asset.content_type,
    byte_size: asset.byte_size,
    duration_sec: asset.duration_sec,
    modal_model: asset.modal_model,
    modal_endpoint: asset.modal_endpoint,
    pipeline_version: asset.pipeline_version ?? null,
    created_at: asset.created_at,
  };
}

export function toStudioDetail(detail: StudioDetail): StudioDetail {
  return {
    song: toSongSummary(detail.song),
    assets: detail.assets.map(toAssetSummary).sort(sortAssets),
    analysisResults: detail.analysisResults,
    lyrics: detail.lyrics,
  };
}

function patchStudioDetail(
  entries: Record<string, StudioCacheEntry>,
  songId: string,
  patch: Partial<StudioDetail>
) {
  const current = entries[songId];
  if (!current) {
    return entries;
  }

  return {
    ...entries,
    [songId]: {
      ...current,
      detail: {
        ...current.detail,
        ...patch,
      },
    },
  };
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const index = items.findIndex((current) => current.id === item.id);
  if (index === -1) {
    return [item, ...items];
  }

  const next = items.slice();
  next[index] = item;
  return next;
}

function sortSongs(a: SongSummary, b: SongSummary) {
  return compareDesc(a.updated_at, b.updated_at);
}

function sortJobs(a: JobSummary, b: JobSummary) {
  return compareDesc(a.created_at, b.created_at);
}

function sortAssets(a: AssetSummary, b: AssetSummary) {
  return compareDesc(a.created_at, b.created_at);
}

function compareDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}
