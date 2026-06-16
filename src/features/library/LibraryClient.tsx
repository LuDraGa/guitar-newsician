'use client';

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  DownloadCloud,
  Grid3X3,
  List,
  Loader2,
  Music2,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useSession } from '@/components/auth/session-context';
import { CoverArt, PillIcon, ReadinessChips, StatusDot } from '@/components/werecode/WereCodePrimitives';
import { toJobSummary, toSongSummary, useWereCodeDataCache } from '@/lib/client-cache/werecode-data-cache';
import { deleteStoredStudioDetail } from '@/lib/client-cache/studio-detail-store';
import {
  createStemMetadata,
  inferStemRoleFromText,
  stemAudioKindFromRole,
  stemMidiKindFromRole,
  type StemRole,
} from '@/lib/music/stem-metadata';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { AssetKind, AssetRow, JobRow, Json, SongRow } from '@/types/werecode';
import type { SongSummary } from '@/types/werecode-client';
import {
  fetchJson,
  formatDate,
  formatDuration,
  getSongIssue,
  inferSourceType,
  readAudioDuration,
  safeFilename,
  titleFromFilename,
} from './library-utils';

type WorkflowResult = {
  song?: SongRow;
  job?: JobRow;
};

type LibraryView = 'grid' | 'list';
type IntakeMode = 'upload' | 'dataset' | null;

type UploadProgressState = {
  id: string;
  songId: string | null;
  mode: 'audio' | 'dataset';
  title: string;
  artist: string;
  fileName: string;
  progress: number;
  stage: string;
  status: 'uploading' | 'failed';
  files?: UploadFileProgressState[];
};

type UploadFileProgressState = {
  id: string;
  label: string;
  detail: string;
  status: 'queued' | 'signing' | 'hashing' | 'uploading' | 'saving' | 'ready' | 'failed';
  error?: string;
};

type ParsedStemMetadata = {
  stem_id: string;
  inst_class: string | null;
  is_drum: boolean;
  midi_program_name?: string;
  program_num?: number;
  plugin_name?: string;
  integrated_loudness?: number;
};

type StemUploadPlan = {
  stemId: string;
  role: StemRole;
  label: string;
  tags: string[];
  metadata: ParsedStemMetadata;
  audioFile: File | null;
  midiFile: File | null;
};

type UploadFileStage = UploadFileProgressState['status'];

export function LibraryClient() {
  const { session } = useSession();
  const songs = useWereCodeDataCache((state) => state.songs);
  const songsLoaded = useWereCodeDataCache((state) => state.songsLoaded);
  const setCachedSongs = useWereCodeDataCache((state) => state.setSongs);
  const upsertCachedSong = useWereCodeDataCache((state) => state.upsertSong);
  const removeCachedSong = useWereCodeDataCache((state) => state.removeSong);
  const upsertCachedJob = useWereCodeDataCache((state) => state.upsertJob);
  const [localYoutubeUrl, setLocalYoutubeUrl] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<LibraryView>('grid');
  const [intakeMode, setIntakeMode] = useState<IntakeMode>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!songsLoaded);
  const [localDownloading, setLocalDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadSongId, setUploadSongId] = useState('');
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [datasetMixFile, setDatasetMixFile] = useState<File | null>(null);
  const [datasetMidiFile, setDatasetMidiFile] = useState<File | null>(null);
  const [datasetStemAudioFiles, setDatasetStemAudioFiles] = useState<File[]>([]);
  const [datasetStemMidiFiles, setDatasetStemMidiFiles] = useState<File[]>([]);
  const [datasetMetadataFile, setDatasetMetadataFile] = useState<File | null>(null);
  const [datasetTitle, setDatasetTitle] = useState('');
  const [datasetArtist, setDatasetArtist] = useState('');
  const [datasetInputKey, setDatasetInputKey] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SongSummary | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const localYoutubeEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD === 'true';
  const sessionResolved = session !== null;
  const locked = Boolean(session && session.authEnabled && !session.user);

  const filteredSongs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return songs;
    }

    return songs.filter((song) =>
      [song.title, song.artist, song.album, song.source_url].some((value) => value?.toLowerCase().includes(normalized))
    );
  }, [query, songs]);

  const songsNeedingAudio = useMemo(() => songs.filter((song) => !song.has_audio), [songs]);
  const readyCount = useMemo(() => songs.filter((song) => song.status === 'ready').length, [songs]);
  const visibleSongs = uploadProgress?.songId
    ? filteredSongs.filter((song) => song.id !== uploadProgress.songId)
    : filteredSongs;

  const loadLibrary = useCallback(async (options: { force?: boolean } = {}) => {
    if (!options.force && useWereCodeDataCache.getState().songsLoaded) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const songsPayload = await fetchJson<{ songs: SongSummary[] }>('/api/songs?limit=100');
      setCachedSongs(songsPayload.songs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load library');
    } finally {
      setLoading(false);
    }
  }, [setCachedSongs]);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('authError');
    if (!authError) {
      return;
    }

    window.history.replaceState(null, '', window.location.pathname);
    const timer = window.setTimeout(() => setError(authError), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!sessionResolved || locked) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadLibrary();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [sessionResolved, locked, loadLibrary]);

  async function downloadLocalYoutube(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = localYoutubeUrl.trim();
    if (!trimmedUrl) {
      setError('Paste a YouTube or YouTube Music URL first');
      return;
    }

    setLocalDownloading(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await fetchJson<WorkflowResult>('/api/local/youtube-download', {
        method: 'POST',
        body: JSON.stringify({
          source_url: trimmedUrl,
          source_type: inferSourceType(trimmedUrl),
          format: 'm4a',
          quality: 'high',
        }),
      });

      if (payload.job?.status === 'failed') {
        setError(payload.job.error_message ?? 'Local YouTube download failed');
      } else {
        setMessage(`Downloaded locally${payload.song?.title ? `: ${payload.song.title}` : ''}`);
        setLocalYoutubeUrl('');
      }

      if (payload.song) {
        upsertCachedSong(toSongSummary(payload.song));
      }
      if (payload.job) {
        upsertCachedJob(toJobSummary(payload.job));
      }
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Could not download from local YouTube backend'
      );
    } finally {
      setLocalDownloading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setUploadFile(file);
    if (file && !uploadTitle) {
      setUploadTitle(titleFromFilename(file.name));
    }
  }

  function handleDatasetMixChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setDatasetMixFile(file);
    if (file && !datasetTitle && file.name.toLowerCase() !== 'mix.wav') {
      setDatasetTitle(titleFromFilename(file.name));
    }
  }

  function handleDatasetMidiChange(event: ChangeEvent<HTMLInputElement>) {
    setDatasetMidiFile(event.target.files?.[0] ?? null);
  }

  function handleDatasetStemAudioChange(event: ChangeEvent<HTMLInputElement>) {
    setDatasetStemAudioFiles(filesFromInput(event));
  }

  function handleDatasetStemMidiChange(event: ChangeEvent<HTMLInputElement>) {
    setDatasetStemMidiFiles(filesFromInput(event));
  }

  function handleDatasetMetadataChange(event: ChangeEvent<HTMLInputElement>) {
    setDatasetMetadataFile(event.target.files?.[0] ?? null);
  }

  async function uploadAudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setError('Choose an audio file first');
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);
    const targetSong = uploadSongId ? (songs.find((item) => item.id === uploadSongId) ?? null) : null;
    const displayTitle = uploadTitle.trim() || targetSong?.title || titleFromFilename(uploadFile.name);
    const displayArtist = uploadArtist.trim() || targetSong?.artist || 'Unknown artist';
    const uploadId = createUploadId();

    setIntakeMode(null);
    setUploadProgress({
      id: uploadId,
      songId: targetSong?.id ?? null,
      mode: 'audio',
      title: displayTitle,
      artist: displayArtist,
      fileName: uploadFile.name,
      progress: 6,
      stage: 'Preparing audio',
      status: 'uploading',
    });

    const updateUploadProgress = (progress: number, stage: string) => {
      setUploadProgress((current) =>
        current?.id === uploadId ? { ...current, progress, stage, status: 'uploading' } : current
      );
    };

    try {
      updateUploadProgress(14, 'Reading audio length');
      const durationSec = await readAudioDuration(uploadFile).catch(() => null);
      updateUploadProgress(24, targetSong ? 'Preparing library item' : 'Creating library item');
      const songPayload = targetSong
        ? { song: targetSong }
        : await fetchJson<{ song: SongRow }>('/api/songs', {
            method: 'POST',
            body: JSON.stringify({
              title: displayTitle,
              artist: uploadArtist.trim() || null,
              source_kind: 'audio_upload',
              duration_sec: durationSec,
              metadata: {
                original_file_name: uploadFile.name,
                content_type: uploadFile.type || 'application/octet-stream',
              },
            }),
          });

      updateUploadProgress(38, 'Reserving storage');
      const objectName = `${Date.now()}-${safeFilename(uploadFile.name)}`;
      const signedUpload = await fetchJson<{
        bucket: string;
        objectPath: string;
        token: string;
      }>('/api/storage/sign-upload', {
        method: 'POST',
        body: JSON.stringify({
          bucket: 'werecode-sources',
          pathParts: [songPayload.song.id, 'sources', objectName],
          upsert: false,
        }),
      });

      updateUploadProgress(58, 'Uploading audio');
      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(signedUpload.bucket)
        .uploadToSignedUrl(signedUpload.objectPath, signedUpload.token, uploadFile, {
          contentType: uploadFile.type || 'application/octet-stream',
          // Source audio is immutable per object path, so let the browser disk
          // cache hold it long-term. Combined with stable signed-URL reuse
          // (sessionStorage), replays after a reload skip Supabase entirely.
          cacheControl: '31536000',
        });

      if (uploadError) {
        throw uploadError;
      }

      updateUploadProgress(82, 'Saving source asset');
      await fetchJson(`/api/songs/${songPayload.song.id}/assets`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'source_audio',
          bucket_id: signedUpload.bucket,
          object_path: signedUpload.objectPath,
          content_type: uploadFile.type || 'application/octet-stream',
          byte_size: uploadFile.size,
          duration_sec: durationSec,
          metadata: {
            original_file_name: uploadFile.name,
          },
        }),
      });

      updateUploadProgress(92, 'Finishing library item');
      const updatedSongPayload = await fetchJson<{ song: SongRow }>(`/api/songs/${songPayload.song.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(uploadTitle.trim() ? { title: uploadTitle.trim() } : {}),
          ...(uploadArtist.trim() ? { artist: uploadArtist.trim() } : {}),
          ...(durationSec !== null ? { duration_sec: durationSec } : {}),
          status: 'ready',
          has_audio: true,
          metadata: {
            ...(targetSong &&
            targetSong.metadata &&
            typeof targetSong.metadata === 'object' &&
            !Array.isArray(targetSong.metadata)
              ? targetSong.metadata
              : {}),
            source_audio_required: false,
            source_audio_uploaded_at: new Date().toISOString(),
            source_audio_upload: {
              original_file_name: uploadFile.name,
              content_type: uploadFile.type || 'application/octet-stream',
              byte_size: uploadFile.size,
            },
          },
        }),
      });

      updateUploadProgress(100, 'Ready');
      setMessage(`Uploaded ${displayTitle}`);
      setUploadFile(null);
      setUploadTitle('');
      setUploadArtist('');
      setUploadSongId('');
      setUploadInputKey((current) => current + 1);
      setIntakeMode(null);
      upsertCachedSong(toSongSummary(updatedSongPayload.song));
      window.setTimeout(() => {
        setUploadProgress((current) => (current?.id === uploadId ? null : current));
      }, 700);
    } catch (uploadError) {
      setUploadProgress((current) =>
        current?.id === uploadId
          ? {
              ...current,
              progress: Math.max(current.progress, 96),
              stage: 'Upload failed',
              status: 'failed',
            }
          : current
      );
      setIntakeMode('upload');
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload audio');
    } finally {
      setUploading(false);
    }
  }

  async function uploadDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceMidiFromStemSelection = !datasetMidiFile
      ? datasetStemMidiFiles.find((file) => stemIdFromFile(file).toLowerCase() === 'all_src') ?? null
      : null;
    const fullMidiFile = datasetMidiFile ?? sourceMidiFromStemSelection;
    const stemMidiFiles = datasetStemMidiFiles.filter((file) => file !== sourceMidiFromStemSelection);
    const selectedFiles = [
      datasetMixFile,
      fullMidiFile,
      datasetMetadataFile,
      ...datasetStemAudioFiles,
      ...stemMidiFiles,
    ].filter((file): file is File => Boolean(file));

    if (selectedFiles.length === 0) {
      setError('Choose at least one dataset file');
      return;
    }
    if (!datasetMixFile && datasetStemAudioFiles.length === 0) {
      setError('Choose a mix audio file or at least one stem audio file');
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);
    const uploadId = createUploadId();
    const metadataText = datasetMetadataFile ? await datasetMetadataFile.text().catch(() => '') : '';
    const parsedStemMetadata = parseBabySlakhStemMetadata(metadataText);
    const stemPlan = prepareStemUploadPlan(datasetStemAudioFiles, stemMidiFiles, parsedStemMetadata);
    const displayTitle =
      datasetTitle.trim() || inferDatasetTitle(datasetMixFile, datasetMetadataFile, stemPlan) || 'Trusted dataset';
    const displayArtist = datasetArtist.trim() || 'Unknown artist';
    const uploadFiles = buildDatasetUploadFileStatuses({
      mixFile: datasetMixFile,
      fullMidiFile,
      metadataFile: datasetMetadataFile,
      stems: stemPlan,
    });
    const totalAssets = uploadFiles.length;

    setIntakeMode(null);
    setUploadProgress({
      id: uploadId,
      songId: null,
      mode: 'dataset',
      title: displayTitle,
      artist: displayArtist,
      fileName: formatFileCount(totalAssets),
      progress: 5,
      stage: 'Preparing dataset',
      status: 'uploading',
      files: uploadFiles,
    });

    const updateUploadProgress = (progress: number, stage: string) => {
      setUploadProgress((current) =>
        current?.id === uploadId ? { ...current, progress, stage, status: 'uploading' } : current
      );
    };
    const updateUploadFile = (
      fileId: string,
      patch: Partial<Pick<UploadFileProgressState, 'status' | 'error'>>
    ) => {
      setUploadProgress((current) => {
        if (current?.id !== uploadId || !current.files) {
          return current;
        }

        const files = current.files.map((file) => (file.id === fileId ? { ...file, ...patch } : file));
        const readyCount = files.filter((file) => file.status === 'ready').length;
        const failed = files.some((file) => file.status === 'failed');
        const progress = Math.min(88, 22 + Math.round((readyCount / Math.max(files.length, 1)) * 64));

        return {
          ...current,
          files,
          progress: failed ? Math.max(current.progress, progress) : progress,
          stage: uploadFileProgressSummary(files),
        };
      });
    };
    const runTrackedUpload = async <T,>(
      fileId: string,
      task: (onStage: (stage: UploadFileStage) => void) => Promise<T>
    ) => {
      updateUploadFile(fileId, { status: 'signing', error: undefined });
      try {
        const result = await task((stage) => updateUploadFile(fileId, { status: stage }));
        updateUploadFile(fileId, { status: 'ready' });
        return result;
      } catch (uploadError) {
        updateUploadFile(fileId, {
          status: 'failed',
          error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
        });
        throw uploadError;
      }
    };

    try {
      updateUploadProgress(10, 'Reading mix length');
      const durationSec = datasetMixFile ? await readAudioDuration(datasetMixFile).catch(() => null) : null;
      updateUploadProgress(18, 'Creating library item');
      const songPayload = await fetchJson<{ song: SongRow }>('/api/songs', {
        method: 'POST',
        body: JSON.stringify({
          title: displayTitle,
          artist: datasetArtist.trim() || null,
          source_kind: datasetMixFile || datasetStemAudioFiles.length > 0 ? 'audio_upload' : 'midi_upload',
          duration_sec: durationSec,
          metadata: {
            trusted_upload: true,
            source_audio_required: !datasetMixFile,
            dataset_upload: {
              format: metadataText.includes('stems:') ? 'babyslakh' : 'multi_asset',
              file_count: totalAssets,
              mix_file_name: datasetMixFile?.name ?? null,
              source_midi_file_name: fullMidiFile?.name ?? null,
              metadata_file_name: datasetMetadataFile?.name ?? null,
              stem_audio_count: datasetStemAudioFiles.length,
              stem_midi_count: stemMidiFiles.length,
              uploaded_at: new Date().toISOString(),
            },
          },
        }),
      });
      const songId = songPayload.song.id;
      setUploadProgress((current) => (current?.id === uploadId ? { ...current, songId } : current));

      const uploadTasks: Array<Promise<unknown>> = [];
      if (datasetMixFile) {
        uploadTasks.push(
          runTrackedUpload('mix', (onStage) =>
            uploadTrustedAsset({
              songId,
              file: datasetMixFile,
              kind: 'source_audio',
              area: 'sources',
              durationSec,
              onStage,
              metadata: {
                provenance: 'uploaded',
                trusted_upload: true,
                upload_source: 'library_dataset',
                role: 'mix',
                original_file_name: datasetMixFile.name,
              },
            })
          )
        );
      }

      if (fullMidiFile) {
        uploadTasks.push(
          runTrackedUpload('source-midi', (onStage) =>
            uploadTrustedAsset({
              songId,
              file: fullMidiFile,
              kind: 'source_midi',
              area: 'sources',
              onStage,
              metadata: {
                provenance: 'uploaded',
                trusted_upload: true,
                upload_source: 'library_dataset',
                role: 'all_src',
                original_file_name: fullMidiFile.name,
              },
            })
          )
        );
      }

      if (datasetMetadataFile) {
        uploadTasks.push(
          runTrackedUpload('metadata', (onStage) =>
            uploadTrustedAsset({
              songId,
              file: datasetMetadataFile,
              kind: 'source_metadata',
              area: 'sources/metadata',
              onStage,
              metadata: {
                provenance: 'uploaded',
                trusted_upload: true,
                upload_source: 'library_dataset',
                original_file_name: datasetMetadataFile.name,
                parsed_stem_count: parsedStemMetadata.size,
              },
            })
          )
        );
      }

      for (const stem of stemPlan) {
        if (!stem.audioFile && !stem.midiFile) {
          continue;
        }
        uploadTasks.push(
          (async () => {
            let stemAudioAsset: AssetRow | null = null;
            if (stem.audioFile) {
              try {
                stemAudioAsset = await runTrackedUpload(`stem-audio:${stem.stemId}`, (onStage) =>
                  uploadTrustedAsset({
                    songId,
                    file: stem.audioFile!,
                    kind: stemAudioKindFromRole(stem.role),
                    area: 'sources/stems',
                    onStage,
                    metadata: {
                      ...stemUploadMetadata(stem),
                      original_file_name: stem.audioFile!.name,
                    },
                  })
                );
              } catch (uploadError) {
                if (stem.midiFile) {
                  updateUploadFile(`stem-midi:${stem.stemId}`, {
                    status: 'failed',
                    error: 'Skipped because stem audio failed',
                  });
                }
                throw uploadError;
              }
            }

            if (!stem.midiFile) {
              return;
            }

            await runTrackedUpload(`stem-midi:${stem.stemId}`, (onStage) =>
              uploadTrustedAsset({
                songId,
                file: stem.midiFile!,
                kind: stemMidiKindFromRole(stem.role),
                area: 'sources/stem-midi',
                sourceAssetId: stemAudioAsset?.id ?? null,
                onStage,
                metadata: {
                  ...stemUploadMetadata(stem),
                  original_file_name: stem.midiFile!.name,
                },
              })
            );
          })()
        );
      }

      const uploadResults = await Promise.allSettled(uploadTasks);
      const failedUploads = uploadResults.filter((result) => result.status === 'rejected');
      if (failedUploads.length > 0) {
        const firstReason = failedUploads[0]?.reason;
        const firstMessage = firstReason instanceof Error ? firstReason.message : 'Upload failed';
        throw new Error(`${failedUploads.length} file upload${failedUploads.length === 1 ? '' : 's'} failed: ${firstMessage}`);
      }

      updateUploadProgress(92, 'Finishing library item');
      const updatedSongPayload = await fetchJson<{ song: SongRow }>(`/api/songs/${songId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          duration_sec: durationSec,
          status: 'ready',
          has_audio: Boolean(datasetMixFile),
          has_stems: stemPlan.some((stem) => Boolean(stem.audioFile)),
          has_midi: Boolean(fullMidiFile || stemPlan.some((stem) => Boolean(stem.midiFile))),
          metadata: {
            ...(songPayload.song.metadata &&
            typeof songPayload.song.metadata === 'object' &&
            !Array.isArray(songPayload.song.metadata)
              ? songPayload.song.metadata
              : {}),
            source_audio_required: !datasetMixFile,
            dataset_uploaded_at: new Date().toISOString(),
          },
        }),
      });

      updateUploadProgress(100, 'Ready');
      setMessage(`Uploaded ${displayTitle}`);
      setDatasetMixFile(null);
      setDatasetMidiFile(null);
      setDatasetStemAudioFiles([]);
      setDatasetStemMidiFiles([]);
      setDatasetMetadataFile(null);
      setDatasetTitle('');
      setDatasetArtist('');
      setDatasetInputKey((current) => current + 1);
      setIntakeMode(null);
      upsertCachedSong(toSongSummary(updatedSongPayload.song));
      window.setTimeout(() => {
        setUploadProgress((current) => (current?.id === uploadId ? null : current));
      }, 900);
    } catch (datasetError) {
      setUploadProgress((current) =>
        current?.id === uploadId
          ? {
              ...current,
              progress: Math.max(current.progress, 96),
              stage: 'Upload failed',
              status: 'failed',
            }
          : current
      );
      setIntakeMode('dataset');
      setError(datasetError instanceof Error ? datasetError.message : 'Could not upload dataset');
    } finally {
      setUploading(false);
    }
  }

  async function deleteSong(song: SongSummary) {
    setDeletingSongId(song.id);
    setError(null);
    setMessage(null);

    try {
      await fetchJson<{ song: SongRow }>(`/api/songs/${song.id}`, {
        method: 'DELETE',
      });
      removeCachedSong(song.id);
      void deleteStoredStudioDetail(song.id);
      setDeleteTarget(null);
      setMessage(`Deleted ${song.title}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete song');
    } finally {
      setDeletingSongId(null);
    }
  }

  if (!sessionResolved) {
    return (
      <section className="wc-rise mx-auto max-w-[1180px] py-24">
        <div className="surface grid min-h-[300px] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--faint)]" />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="wc-rise mx-auto max-w-[1180px] pb-16">
        <header className="pb-7 pt-10">
          <div className="label mb-4">
            Your library - {songs.length} songs - {readyCount} ready
          </div>
          <h1 className="display max-w-[900px] text-[clamp(48px,7vw,92px)]">
            Every song, <span className="text-[var(--faint)]">learnable.</span>
          </h1>
          <p className="mt-5 max-w-[440px] text-[17px] leading-7 text-[var(--muted)]">
            Drop a track in and WereCode separates the stems, syncs the lyrics, and writes the tab so you can just play.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => setIntakeMode('upload')} className="pill">
              <PillIcon>
                <UploadCloud className="h-3.5 w-3.5" />
              </PillIcon>
              Upload audio
            </button>
            <button type="button" onClick={() => setIntakeMode('dataset')} className="pill ghost">
              <PillIcon>
                <UploadCloud className="h-3.5 w-3.5" />
              </PillIcon>
              Upload stems/MIDI
            </button>
          </div>
        </header>

        {localYoutubeEnabled && (
          <section className="surface mb-5 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="label mb-2">Local dev only</div>
                <h2 className="font-semibold">YouTube download</h2>
              </div>
              <span className="chip accent">backend required</span>
            </div>
            <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={downloadLocalYoutube}>
              <input
                value={localYoutubeUrl}
                onChange={(event) => setLocalYoutubeUrl(event.target.value)}
                placeholder="YouTube or YouTube Music URL"
                className="wc-input h-11 px-4 text-sm"
              />
              <button type="submit" disabled={localDownloading} className="pill sm">
                <PillIcon>
                  <DownloadCloud className="h-3.5 w-3.5" />
                </PillIcon>
                {localDownloading ? 'Downloading' : 'Download'}
              </button>
            </form>
          </section>
        )}

        {intakeMode === 'upload' && (
          <section className="surface mb-5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="label mb-2">Upload audio</div>
                <h2 className="font-semibold">Attach a playable source</h2>
              </div>
              <button
                type="button"
                onClick={() => setIntakeMode(null)}
                className="iconbtn"
                aria-label="Close upload audio"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]" onSubmit={uploadAudio}>
              <input
                key={uploadInputKey}
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="h-11 w-full rounded-full bg-[var(--paper)] px-4 py-2 text-sm text-[var(--muted)] shadow-[inset_0_0_0_1.5px_var(--line)] file:mr-3 file:h-7 file:rounded-full file:border-0 file:bg-[var(--ink)] file:px-3 file:text-sm file:font-medium file:text-[var(--paper)]"
              />
              <div className="relative min-w-0">
                <select
                  id="upload-song"
                  value={uploadSongId}
                  onChange={(event) => setUploadSongId(event.target.value)}
                  className="wc-input h-11 appearance-none px-4 pr-10 text-sm"
                  aria-label="Attach audio to song"
                >
                  <option value="">New song</option>
                  {songsNeedingAudio.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              </div>
              <input
                id="upload-title"
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="Song title"
                className="wc-input h-11 px-4 text-sm"
              />
              <input
                id="upload-artist"
                value={uploadArtist}
                onChange={(event) => setUploadArtist(event.target.value)}
                placeholder="Artist"
                className="wc-input h-11 px-4 text-sm"
              />
              <button type="submit" disabled={uploading} className="pill ghost sm md:w-fit">
                <PillIcon>
                  <UploadCloud className="h-3.5 w-3.5" />
                </PillIcon>
                {uploading ? 'Uploading' : 'Upload'}
              </button>
            </form>
          </section>
        )}

        {intakeMode === 'dataset' && (
          <section className="surface mb-5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="label mb-2">Trusted dataset</div>
                <h2 className="font-semibold">Upload mix, stems, and MIDI</h2>
              </div>
              <button
                type="button"
                onClick={() => setIntakeMode(null)}
                className="iconbtn"
                aria-label="Close dataset upload"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="grid gap-4" onSubmit={uploadDataset}>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  id="dataset-title"
                  value={datasetTitle}
                  onChange={(event) => setDatasetTitle(event.target.value)}
                  placeholder="Song title"
                  className="wc-input h-11 px-4 text-sm"
                />
                <input
                  id="dataset-artist"
                  value={datasetArtist}
                  onChange={(event) => setDatasetArtist(event.target.value)}
                  placeholder="Artist"
                  className="wc-input h-11 px-4 text-sm"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <DatasetFileInput
                  key={`mix-${datasetInputKey}`}
                  id="dataset-mix-upload"
                  label="Mix audio"
                  accept="audio/*"
                  onChange={handleDatasetMixChange}
                />
                <DatasetFileInput
                  key={`midi-${datasetInputKey}`}
                  id="dataset-midi-upload"
                  label="Full MIDI"
                  accept=".mid,.midi,audio/midi"
                  onChange={handleDatasetMidiChange}
                />
                <DatasetFileInput
                  key={`stem-audio-${datasetInputKey}`}
                  id="dataset-stem-audio-upload"
                  label={`Stem audio${datasetStemAudioFiles.length ? ` (${datasetStemAudioFiles.length})` : ''}`}
                  accept="audio/*"
                  multiple
                  onChange={handleDatasetStemAudioChange}
                />
                <DatasetFileInput
                  key={`stem-midi-${datasetInputKey}`}
                  id="dataset-stem-midi-upload"
                  label={`Stem MIDI${datasetStemMidiFiles.length ? ` (${datasetStemMidiFiles.length})` : ''}`}
                  accept=".mid,.midi,audio/midi"
                  multiple
                  onChange={handleDatasetStemMidiChange}
                />
                <DatasetFileInput
                  key={`metadata-${datasetInputKey}`}
                  id="dataset-metadata-upload"
                  label="Metadata YAML"
                  accept=".yaml,.yml,text/yaml,text/x-yaml"
                  onChange={handleDatasetMetadataChange}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{datasetMixFile ? 'mix ready' : 'mix optional'}</span>
                <span className="chip">{datasetMidiFile ? 'full MIDI ready' : 'full MIDI optional'}</span>
                <span className="chip">{datasetStemAudioFiles.length} stem audio</span>
                <span className="chip">{datasetStemMidiFiles.length} stem MIDI</span>
                <span className="chip">{datasetMetadataFile ? 'metadata ready' : 'metadata optional'}</span>
                <div className="flex-1" />
                <button type="submit" disabled={uploading} className="pill sm">
                  <PillIcon>
                    <UploadCloud className="h-3.5 w-3.5" />
                  </PillIcon>
                  {uploading ? 'Uploading' : 'Upload bundle'}
                </button>
              </div>
            </form>
          </section>
        )}

        {message && (
          <div className="chip live mb-4 min-h-11 w-full justify-start rounded-[12px] px-4">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="chip danger mb-4 min-h-11 w-full justify-start rounded-[12px] px-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1 sm:max-w-[380px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search songs and artists"
              className="wc-input h-[46px] pl-11 pr-4 text-sm"
            />
          </div>
          <div className="flex-1" />
          <button type="button" onClick={() => void loadLibrary({ force: true })} disabled={loading} className="pill ghost sm">
            <PillIcon>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </PillIcon>
            Refresh
          </button>
          <div className="segment bg-[var(--card)] shadow-[inset_0_0_0_1.5px_var(--line)]">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={view === 'grid' ? 'on' : 'text-[var(--muted)]'}
            >
              <Grid3X3 className="mr-2 h-4 w-4" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={view === 'list' ? 'on' : 'text-[var(--muted)]'}
            >
              <List className="mr-2 h-4 w-4" />
              List
            </button>
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {uploadProgress && <UploadProgressCard upload={uploadProgress} />}
            {visibleSongs.map((song) => (
              <SongCard key={song.id} song={song} onRequestDelete={setDeleteTarget} />
            ))}
          </div>
        ) : (
          <div className="surface overflow-hidden">
            {uploadProgress && <UploadProgressRow upload={uploadProgress} last={visibleSongs.length === 0} />}
            {visibleSongs.map((song, index) => (
              <SongListRow
                key={song.id}
                song={song}
                last={index === visibleSongs.length - 1}
                onRequestDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}

        {!loading && visibleSongs.length === 0 && !uploadProgress && (
          <div className="surface grid min-h-72 place-items-center px-6 py-14 text-center">
            <div>
              <Music2 className="mx-auto h-11 w-11 text-[var(--faint)]" />
              <h3 className="display mt-4 text-2xl">No songs yet</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                Upload audio to create the first song in your library.
              </p>
            </div>
          </div>
        )}
      </section>

      {deleteTarget && (
        <DeleteSongDialog
          song={deleteTarget}
          deleting={deletingSongId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteSong(deleteTarget)}
        />
      )}
    </>
  );
}

function DatasetFileInput({
  id,
  label,
  accept,
  multiple = false,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label htmlFor={id} className="grid min-w-0 gap-2 text-sm font-semibold text-[var(--ink)]">
      <span className="truncate">{label}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="h-11 w-full rounded-full bg-[var(--paper)] px-4 py-2 text-sm text-[var(--muted)] shadow-[inset_0_0_0_1.5px_var(--line)] file:mr-3 file:h-7 file:rounded-full file:border-0 file:bg-[var(--ink)] file:px-3 file:text-sm file:font-medium file:text-[var(--paper)]"
      />
    </label>
  );
}

function SongCard({ song, onRequestDelete }: { song: SongSummary; onRequestDelete: (song: SongSummary) => void }) {
  const issue = getSongIssue(song);

  return (
    <article className="surface group relative flex min-h-[206px] flex-col text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
      <Link href={`/app/studio/${song.id}` as Route} className="flex flex-1 flex-col gap-4 p-[18px] pr-14">
        <div className="flex items-center gap-3">
          <CoverArt id={song.id} size={58} />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{song.title}</div>
            <div className="mt-1 truncate text-sm text-[var(--muted)]">{song.artist ?? 'Unknown artist'}</div>
          </div>
        </div>

        <ReadinessChips items={songReadiness(song)} />

        {issue && (
          <p className="line-clamp-2 rounded-[10px] bg-[oklch(0.55_0.16_28_/_0.09)] p-3 text-xs leading-5 text-[var(--danger)]">
            {issue}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <StatusDot status={song.status} />
          <span className="mono text-xs text-[var(--faint)]">
            {formatDuration(song.duration_sec)} - {formatDate(song.updated_at)}
          </span>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onRequestDelete(song)}
        className="iconbtn absolute right-3 top-3 h-9 w-9 opacity-70 hover:text-[var(--danger)] hover:opacity-100"
        aria-label={`Delete ${song.title}`}
        title="Delete song"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  );
}

function SongListRow({
  song,
  last,
  onRequestDelete,
}: {
  song: SongSummary;
  last: boolean;
  onRequestDelete: (song: SongSummary) => void;
}) {
  const issue = getSongIssue(song);

  return (
    <div
      className={`grid items-center gap-3 px-5 py-4 text-left transition hover:bg-[var(--card-2)] md:grid-cols-[1fr_auto] ${
        last ? '' : 'border-b border-[var(--line-2)]'
      }`}
    >
      <Link
        href={`/app/studio/${song.id}` as Route}
        className="grid min-w-0 items-center gap-4 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(220px,1fr)_auto_auto]"
      >
        <CoverArt id={song.id} size={44} />
        <div className="min-w-0">
          <div className="truncate font-bold">{song.title}</div>
          <div className="mt-1 truncate text-sm text-[var(--muted)]">{song.artist ?? 'Unknown artist'}</div>
          {issue && <div className="mt-1 max-w-[460px] truncate text-xs text-[var(--danger)]">{issue}</div>}
        </div>
        <div className="hidden md:block">
          <ReadinessChips items={songReadiness(song)} />
        </div>
        <StatusDot status={song.status} />
        <span className="mono min-w-16 text-right text-xs text-[var(--faint)]">
          {formatDuration(song.duration_sec)}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onRequestDelete(song)}
        className="iconbtn h-9 w-9 justify-self-end hover:text-[var(--danger)]"
        aria-label={`Delete ${song.title}`}
        title="Delete song"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function UploadProgressCard({ upload }: { upload: UploadProgressState }) {
  return (
    <article className="surface flex min-h-[206px] flex-col gap-4 p-[18px] text-left opacity-80 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex items-center gap-3">
        <UploadProgressCover upload={upload} size={58} />
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-[var(--muted)]">{upload.title}</div>
          <div className="mt-1 truncate text-sm text-[var(--faint)]">{upload.artist}</div>
        </div>
      </div>

      <ReadinessChips
        items={
          upload.mode === 'dataset'
            ? [
                { label: 'Audio', ready: false },
                { label: 'Stems', ready: false },
                { label: 'MIDI', ready: false },
                { label: 'Analysis', ready: false },
              ]
            : [
                { label: 'Audio', ready: false },
                { label: 'Stems', ready: false },
                { label: 'Lyrics', ready: false },
              ]
        }
      />

      <UploadProgressMeter upload={upload} />
    </article>
  );
}

function UploadProgressRow({ upload, last }: { upload: UploadProgressState; last: boolean }) {
  return (
    <div
      className={`grid items-center gap-3 px-5 py-4 text-left opacity-80 md:grid-cols-[1fr_auto] ${
        last ? '' : 'border-b border-[var(--line-2)]'
      }`}
    >
      <div className="grid min-w-0 items-center gap-4 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(220px,1fr)_auto_auto]">
        <UploadProgressCover upload={upload} size={44} />
        <div className="min-w-0">
          <div className="truncate font-bold text-[var(--muted)]">{upload.title}</div>
          <div className="mt-1 truncate text-sm text-[var(--faint)]">{upload.artist}</div>
        </div>
        <div className="hidden md:block">
          <UploadProgressMeter upload={upload} compact />
        </div>
        <StatusDot
          status={upload.status === 'failed' ? 'failed' : 'importing'}
          label={upload.status === 'failed' ? 'Failed' : 'Uploading'}
        />
        <span className="mono min-w-16 text-right text-xs text-[var(--faint)]">{upload.progress}%</span>
      </div>
      <span className="chip justify-self-end">{upload.status === 'failed' ? 'stopped' : 'pending'}</span>
    </div>
  );
}

function UploadProgressCover({ upload, size }: { upload: UploadProgressState; size: number }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <CoverArt id={upload.id} size={size} className="opacity-45 saturate-0" />
      <span className="absolute inset-0 grid place-items-center rounded-[12px] bg-[oklch(0.2_0.006_60_/_0.18)]">
        <Loader2 className={`h-5 w-5 text-[var(--paper)] ${upload.status === 'failed' ? '' : 'animate-spin'}`} />
      </span>
    </span>
  );
}

function UploadProgressMeter({ upload, compact = false }: { upload: UploadProgressState; compact?: boolean }) {
  return (
    <div className={compact ? 'min-w-0' : 'mt-auto'}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span
          className={`truncate text-xs font-semibold ${upload.status === 'failed' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}
        >
          {upload.stage}
        </span>
        <span className="mono shrink-0 text-xs text-[var(--faint)]">{upload.progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--paper-2)] shadow-[inset_0_0_0_1px_var(--line-2)]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${upload.status === 'failed' ? 'bg-[var(--danger)]' : 'bg-[var(--ink)]'}`}
          style={{ width: `${upload.progress}%` }}
        />
      </div>
      {!compact && <div className="mt-2 truncate text-xs text-[var(--faint)]">{upload.fileName}</div>}
      {!compact && upload.files && upload.files.length > 0 && <UploadFileProgressList files={upload.files} />}
    </div>
  );
}

function UploadFileProgressList({ files }: { files: UploadFileProgressState[] }) {
  return (
    <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
      {files.map((file) => (
        <div
          key={file.id}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] bg-[var(--paper)] px-3 py-2 shadow-[inset_0_0_0_1px_var(--line-2)]"
        >
          <span className={`h-2 w-2 rounded-full ${uploadFileStatusDotClass(file.status)}`} />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-[var(--ink)]">{file.label}</span>
            <span className="block truncate text-[11px] text-[var(--faint)]">{file.error ?? file.detail}</span>
          </span>
          <span className={`mono text-[10px] font-semibold uppercase ${uploadFileStatusTextClass(file.status)}`}>
            {uploadFileStatusLabel(file.status)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DeleteSongDialog({
  song,
  deleting,
  onCancel,
  onConfirm,
}: {
  song: SongSummary;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[oklch(0.2_0.006_60_/_0.28)] px-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-song-title"
        aria-describedby="delete-song-description"
        className="surface w-full max-w-[420px] p-5 shadow-[var(--shadow-pop)]"
      >
        <div className="mb-4 flex items-start gap-3">
          <CoverArt id={song.id} size={48} />
          <div className="min-w-0">
            <div className="label mb-2">Delete song</div>
            <h2 id="delete-song-title" className="truncate text-xl font-bold">
              {song.title}
            </h2>
            <p id="delete-song-description" className="mt-2 text-sm leading-6 text-[var(--muted)]">
              This removes the song from your library.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={deleting} className="pill ghost sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="pill sm bg-[var(--danger)] !text-[var(--paper)]"
          >
            {deleting ? 'Deleting' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function createUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `upload-${Date.now()}`;
}

function buildDatasetUploadFileStatuses({
  mixFile,
  fullMidiFile,
  metadataFile,
  stems,
}: {
  mixFile: File | null;
  fullMidiFile: File | null;
  metadataFile: File | null;
  stems: StemUploadPlan[];
}): UploadFileProgressState[] {
  const files: UploadFileProgressState[] = [];
  if (mixFile) {
    files.push(createUploadFileProgress('mix', 'Mix audio', mixFile.name));
  }
  if (fullMidiFile) {
    files.push(createUploadFileProgress('source-midi', 'Full MIDI', fullMidiFile.name));
  }
  if (metadataFile) {
    files.push(createUploadFileProgress('metadata', 'Metadata YAML', metadataFile.name));
  }
  for (const stem of stems) {
    if (stem.audioFile) {
      files.push(createUploadFileProgress(`stem-audio:${stem.stemId}`, `${stem.label} audio`, stem.audioFile.name));
    }
    if (stem.midiFile) {
      files.push(createUploadFileProgress(`stem-midi:${stem.stemId}`, `${stem.label} MIDI`, stem.midiFile.name));
    }
  }
  return files;
}

function createUploadFileProgress(id: string, label: string, detail: string): UploadFileProgressState {
  return {
    id,
    label,
    detail,
    status: 'queued',
  };
}

function uploadFileProgressSummary(files: UploadFileProgressState[]) {
  const ready = files.filter((file) => file.status === 'ready').length;
  const failed = files.filter((file) => file.status === 'failed').length;
  const active = files.filter((file) => ['signing', 'hashing', 'uploading', 'saving'].includes(file.status)).length;

  if (failed > 0) {
    return `${failed} failed - ${ready}/${files.length} uploaded`;
  }
  if (active > 0) {
    return `${active} active - ${ready}/${files.length} uploaded`;
  }
  return `${ready}/${files.length} uploaded`;
}

function uploadFileStatusLabel(status: UploadFileProgressState['status']) {
  if (status === 'ready') {
    return 'done';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return status;
}

function uploadFileStatusDotClass(status: UploadFileProgressState['status']) {
  if (status === 'ready') {
    return 'bg-[var(--live)]';
  }
  if (status === 'failed') {
    return 'bg-[var(--danger)]';
  }
  if (status === 'queued') {
    return 'bg-[var(--faint)]';
  }
  return 'bg-[var(--accent)]';
}

function uploadFileStatusTextClass(status: UploadFileProgressState['status']) {
  if (status === 'ready') {
    return 'text-[var(--live-ink)]';
  }
  if (status === 'failed') {
    return 'text-[var(--danger)]';
  }
  return 'text-[var(--muted)]';
}

async function uploadTrustedAsset({
  songId,
  file,
  kind,
  area,
  metadata,
  durationSec,
  sourceAssetId,
  onStage,
}: {
  songId: string;
  file: File;
  kind: AssetKind;
  area: string;
  metadata: Record<string, Json>;
  durationSec?: number | null;
  sourceAssetId?: string | null;
  onStage?: (stage: UploadFileStage) => void;
}) {
  const objectName = `${Date.now()}-${createUploadId()}-${safeFilename(file.name)}`;
  onStage?.('signing');
  const signedUpload = await fetchJson<{
    bucket: string;
    objectPath: string;
    token: string;
  }>('/api/storage/sign-upload', {
    method: 'POST',
    body: JSON.stringify({
      bucket: 'werecode-sources',
      pathParts: [songId, area, objectName],
      upsert: false,
    }),
  });
  const contentType = file.type || contentTypeForFile(file.name);
  onStage?.('hashing');
  const checksumSha256 = await sha256File(file);
  const supabase = getSupabaseBrowserClient();
  onStage?.('uploading');
  const { error: uploadError } = await supabase.storage
    .from(signedUpload.bucket)
    .uploadToSignedUrl(signedUpload.objectPath, signedUpload.token, file, {
      contentType,
      cacheControl: '31536000',
    });

  if (uploadError) {
    throw uploadError;
  }

  onStage?.('saving');
  const payload = await fetchJson<{ asset: AssetRow }>(`/api/songs/${songId}/assets`, {
    method: 'POST',
    body: JSON.stringify({
      kind,
      bucket_id: signedUpload.bucket,
      object_path: signedUpload.objectPath,
      content_type: contentType,
      byte_size: file.size,
      duration_sec: durationSec ?? null,
      checksum_sha256: checksumSha256,
      source_asset_id: sourceAssetId ?? null,
      metadata,
    }),
  });

  return payload.asset;
}

function filesFromInput(event: ChangeEvent<HTMLInputElement>) {
  return Array.from(event.target.files ?? []);
}

function parseBabySlakhStemMetadata(yamlText: string) {
  const stems = new Map<string, ParsedStemMetadata>();
  let inStems = false;
  let current: ParsedStemMetadata | null = null;

  for (const line of yamlText.split(/\r?\n/)) {
    if (/^stems:\s*$/.test(line)) {
      inStems = true;
      continue;
    }
    if (!inStems) {
      continue;
    }
    if (/^\S/.test(line)) {
      break;
    }

    const stemHeader = line.match(/^\s+(S\d+):\s*$/);
    if (stemHeader) {
      if (current) {
        stems.set(current.stem_id, current);
      }
      current = { stem_id: stemHeader[1], inst_class: null, is_drum: false };
      continue;
    }
    if (!current) {
      continue;
    }

    const property = line.match(/^\s+([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (!property) {
      continue;
    }

    const key = property[1];
    const rawValue = unquoteYamlScalar(property[2]);
    if (key === 'inst_class') {
      current.inst_class = rawValue || null;
    } else if (key === 'is_drum') {
      current.is_drum = rawValue.toLowerCase() === 'true';
    } else if (key === 'midi_program_name') {
      current.midi_program_name = rawValue || undefined;
    } else if (key === 'program_num') {
      const value = Number(rawValue);
      if (Number.isFinite(value)) {
        current.program_num = value;
      }
    } else if (key === 'plugin_name') {
      current.plugin_name = rawValue || undefined;
    } else if (key === 'integrated_loudness') {
      const value = Number(rawValue);
      if (Number.isFinite(value)) {
        current.integrated_loudness = value;
      }
    }
  }

  if (current) {
    stems.set(current.stem_id, current);
  }

  return stems;
}

function prepareStemUploadPlan(
  audioFiles: File[],
  midiFiles: File[],
  metadataByStemId: Map<string, ParsedStemMetadata>
) {
  const byStemId = new Map<string, StemUploadPlan>();
  const ensurePlan = (stemId: string, fileName: string) => {
    const existing = byStemId.get(stemId);
    if (existing) {
      return existing;
    }

    const metadata = metadataByStemId.get(stemId) ?? { stem_id: stemId, inst_class: null, is_drum: false };
    const role = inferStemRoleFromText(metadata.inst_class, metadata.is_drum) ?? inferStemRoleFromText(fileName) ?? 'other';
    const plan: StemUploadPlan = {
      stemId,
      role,
      label: stemLabelFromUpload(metadata, stemId, fileName),
      tags: stemTagsFromUpload(metadata, stemId, role),
      metadata,
      audioFile: null,
      midiFile: null,
    };
    byStemId.set(stemId, plan);
    return plan;
  };

  for (const file of audioFiles) {
    ensurePlan(stemIdFromFile(file), file.name).audioFile = file;
  }
  for (const file of midiFiles) {
    ensurePlan(stemIdFromFile(file), file.name).midiFile = file;
  }

  return Array.from(byStemId.values()).sort((a, b) => a.stemId.localeCompare(b.stemId));
}

function stemUploadMetadata(stem: StemUploadPlan): Record<string, Json> {
  const extra: Record<string, Json> = {
    provenance: 'uploaded',
    trusted_upload: true,
    upload_source: 'library_dataset',
    inst_class: stem.metadata.inst_class,
    is_drum: stem.metadata.is_drum,
  };
  if (stem.metadata.midi_program_name) {
    extra.midi_program_name = stem.metadata.midi_program_name;
  }
  if (typeof stem.metadata.program_num === 'number') {
    extra.program_num = stem.metadata.program_num;
  }
  if (stem.metadata.plugin_name) {
    extra.plugin_name = stem.metadata.plugin_name;
  }
  if (typeof stem.metadata.integrated_loudness === 'number') {
    extra.integrated_loudness = stem.metadata.integrated_loudness;
  }

  return createStemMetadata({
    id: stem.stemId,
    role: stem.role,
    label: stem.label,
    tags: stem.tags,
    source: 'uploaded',
    extra,
  });
}

function stemLabelFromUpload(metadata: ParsedStemMetadata, stemId: string, fileName: string) {
  return (
    titleizeStemText(metadata.inst_class) ??
    titleizeStemText(metadata.midi_program_name) ??
    titleizeStemText(metadata.plugin_name) ??
    titleizeStemText(titleFromFilename(fileName)) ??
    stemId
  );
}

function stemTagsFromUpload(metadata: ParsedStemMetadata, stemId: string, role: StemRole) {
  return [
    stemId,
    role,
    metadata.inst_class,
    metadata.is_drum ? 'drums' : null,
    metadata.midi_program_name,
    typeof metadata.program_num === 'number' ? `program:${metadata.program_num}` : null,
    metadata.plugin_name,
  ].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

function titleizeStemText(value: string | null | undefined) {
  const cleaned = value?.trim();
  if (!cleaned) {
    return null;
  }
  return cleaned
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stemIdFromFile(file: File) {
  return file.name.replace(/\.[^.]+$/, '');
}

function inferDatasetTitle(mixFile: File | null, metadataFile: File | null, stemPlan: StemUploadPlan[]) {
  if (mixFile && mixFile.name.toLowerCase() !== 'mix.wav') {
    return titleFromFilename(mixFile.name);
  }
  if (metadataFile && 'webkitRelativePath' in metadataFile) {
    const relativePath = String(metadataFile.webkitRelativePath);
    const [folder] = relativePath.split('/').filter(Boolean);
    if (folder) {
      return folder;
    }
  }
  if (stemPlan[0]?.stemId) {
    return `Dataset ${stemPlan[0].stemId}`;
  }
  return null;
}

function unquoteYamlScalar(value: string) {
  return value.trim().replace(/^["']|["']$/g, '');
}

function contentTypeForFile(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (lower.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  if (lower.endsWith('.m4a')) {
    return 'audio/mp4';
  }
  if (lower.endsWith('.flac')) {
    return 'audio/flac';
  }
  if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
    return 'audio/midi';
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'text/yaml';
  }
  return 'application/octet-stream';
}

async function sha256File(file: File) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }

  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function formatFileCount(count: number) {
  return `${count} file${count === 1 ? '' : 's'}`;
}

function songReadiness(song: SongSummary) {
  return [
    { label: 'Audio', ready: song.has_audio },
    { label: 'Stems', ready: song.has_stems },
    { label: 'Lyrics', ready: song.has_plain_lyrics || song.has_synced_lyrics },
    { label: 'Karaoke', ready: song.has_synced_lyrics },
    { label: 'MIDI', ready: song.has_midi },
    { label: 'Analysis', ready: song.has_analysis },
  ];
}
