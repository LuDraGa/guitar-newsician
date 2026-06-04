'use client';

import {
  AlertCircle,
  CheckCircle2,
  DownloadCloud,
  Grid3X3,
  List,
  Music2,
  Plus,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import { CoverArt, PillIcon, ReadinessChips, StatusDot } from '@/components/werecode/WereCodePrimitives';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { JobRow, SongRow } from '@/types/werecode';
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
type IntakeMode = 'source' | 'upload' | null;

export function LibraryClient() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [localYoutubeUrl, setLocalYoutubeUrl] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<LibraryView>('grid');
  const [intakeMode, setIntakeMode] = useState<IntakeMode>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'probe' | 'ingest' | null>(null);
  const [localDownloading, setLocalDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadSongId, setUploadSongId] = useState('');
  const localYoutubeEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD === 'true';

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

  async function loadLibrary() {
    setLoading(true);
    setError(null);
    try {
      const songsPayload = await fetchJson<{ songs: SongRow[] }>('/api/songs?limit=100');
      setSongs(songsPayload.songs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load library');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('authError');
    if (authError) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    const timer = window.setTimeout(() => {
      void loadLibrary().finally(() => {
        if (authError) {
          setError(authError);
        }
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function submitSource(mode: 'probe' | 'ingest') {
    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl) {
      setError('Paste a YouTube, YouTube Music, or signed audio URL first');
      return;
    }

    setSubmitting(mode);
    setError(null);
    setMessage(null);

    try {
      const endpoint = mode === 'probe' ? '/api/songs/probe' : '/api/songs/ingest';
      const payload = await fetchJson<WorkflowResult>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          source_url: trimmedUrl,
          source_type: inferSourceType(trimmedUrl),
          format: 'm4a',
          quality: 'high',
        }),
      });

      if (payload.job?.status === 'failed') {
        setError(payload.job.error_message ?? `${mode} failed`);
      }

      setMessage(
        payload.job?.status === 'failed'
          ? null
          : mode === 'probe'
            ? 'Source checked. You can add it when you are ready.'
            : `Song added${payload.song?.title ? `: ${payload.song.title}` : ''}. Upload source audio to unlock the studio.`
      );

      if (mode === 'ingest') {
        setSourceUrl('');
      }

      await loadLibrary();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Could not ${mode} source`);
    } finally {
      setSubmitting(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>, mode: 'probe' | 'ingest') {
    event.preventDefault();
    void submitSource(mode);
  }

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

      await loadLibrary();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download from local YouTube backend');
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

  async function uploadAudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setError('Choose an audio file first');
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const durationSec = await readAudioDuration(uploadFile).catch(() => null);
      const targetSong = uploadSongId ? songs.find((item) => item.id === uploadSongId) ?? null : null;
      const songPayload = targetSong
        ? { song: targetSong }
        : await fetchJson<{ song: SongRow }>('/api/songs', {
            method: 'POST',
            body: JSON.stringify({
              title: uploadTitle.trim() || titleFromFilename(uploadFile.name),
              artist: uploadArtist.trim() || null,
              source_kind: 'audio_upload',
              duration_sec: durationSec,
              metadata: {
                original_file_name: uploadFile.name,
                content_type: uploadFile.type || 'application/octet-stream',
              },
            }),
          });

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

      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(signedUpload.bucket)
        .uploadToSignedUrl(signedUpload.objectPath, signedUpload.token, uploadFile, {
          contentType: uploadFile.type || 'application/octet-stream',
        });

      if (uploadError) {
        throw uploadError;
      }

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

      await fetchJson(`/api/songs/${songPayload.song.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(uploadTitle.trim() ? { title: uploadTitle.trim() } : {}),
          ...(uploadArtist.trim() ? { artist: uploadArtist.trim() } : {}),
          ...(durationSec !== null ? { duration_sec: durationSec } : {}),
          status: 'ready',
          has_audio: true,
          metadata: {
            ...(targetSong && targetSong.metadata && typeof targetSong.metadata === 'object' && !Array.isArray(targetSong.metadata)
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

      setMessage(`Uploaded ${songPayload.song.title}`);
      setUploadFile(null);
      setUploadTitle('');
      setUploadArtist('');
      setUploadSongId('');
      setIntakeMode(null);
      await loadLibrary();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload audio');
    } finally {
      setUploading(false);
    }
  }

  return (
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
          <button type="button" onClick={() => setIntakeMode('source')} className="pill">
            <PillIcon>
              <Plus className="h-3.5 w-3.5" />
            </PillIcon>
            Add a song
          </button>
          <button type="button" onClick={() => setIntakeMode('upload')} className="pill ghost">
            <PillIcon>
              <UploadCloud className="h-3.5 w-3.5" />
            </PillIcon>
            Upload audio
          </button>
        </div>
      </header>

      {intakeMode === 'source' && (
        <section className="surface mb-5 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="label mb-2">Add a song</div>
              <h2 className="font-semibold">Start from a source URL</h2>
            </div>
            <button type="button" onClick={() => setIntakeMode(null)} className="iconbtn" aria-label="Close add song">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={(event) => handleSubmit(event, 'ingest')}>
            <input
              id="source-url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="YouTube, YouTube Music, or signed audio URL"
              className="wc-input h-11 px-4 text-sm"
            />
            <button type="button" onClick={() => void submitSource('probe')} disabled={Boolean(submitting)} className="pill ghost sm">
              <PillIcon>
                <Search className="h-3.5 w-3.5" />
              </PillIcon>
              Probe
            </button>
            <button type="submit" disabled={Boolean(submitting)} className="pill sm">
              <PillIcon>
                <DownloadCloud className="h-3.5 w-3.5" />
              </PillIcon>
              {submitting === 'ingest' ? 'Adding' : 'Add'}
            </button>
          </form>
        </section>
      )}

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
            <button type="button" onClick={() => setIntakeMode(null)} className="iconbtn" aria-label="Close upload audio">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]" onSubmit={uploadAudio}>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="h-11 w-full rounded-full bg-[var(--paper)] px-4 py-2 text-sm text-[var(--muted)] shadow-[inset_0_0_0_1.5px_var(--line)] file:mr-3 file:h-7 file:rounded-full file:border-0 file:bg-[var(--ink)] file:px-3 file:text-sm file:font-medium file:text-[var(--paper)]"
            />
            <select
              id="upload-song"
              value={uploadSongId}
              onChange={(event) => setUploadSongId(event.target.value)}
              className="wc-input h-11 px-4 text-sm"
              aria-label="Attach audio to song"
            >
              <option value="">New song</option>
              {songsNeedingAudio.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title}
                </option>
              ))}
            </select>
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
        <div className="segment bg-[var(--card)] shadow-[inset_0_0_0_1.5px_var(--line)]">
          <button type="button" onClick={() => setView('grid')} className={view === 'grid' ? 'on' : 'text-[var(--muted)]'}>
            <Grid3X3 className="mr-2 h-4 w-4" />
            Grid
          </button>
          <button type="button" onClick={() => setView('list')} className={view === 'list' ? 'on' : 'text-[var(--muted)]'}>
            <List className="mr-2 h-4 w-4" />
            List
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {filteredSongs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          {filteredSongs.map((song, index) => (
            <SongListRow key={song.id} song={song} last={index === filteredSongs.length - 1} />
          ))}
        </div>
      )}

      {!loading && filteredSongs.length === 0 && (
        <div className="surface grid min-h-72 place-items-center px-6 py-14 text-center">
          <div>
            <Music2 className="mx-auto h-11 w-11 text-[var(--faint)]" />
            <h3 className="display mt-4 text-2xl">No songs yet</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
              Add a source or upload audio to create the first song in your library.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function SongCard({ song }: { song: SongRow }) {
  const issue = getSongIssue(song);

  return (
    <Link
      href={`/studio/${song.id}` as Route}
      className="surface flex min-h-[206px] flex-col gap-4 p-[18px] text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-center gap-3">
        <CoverArt id={song.id} size={58} />
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{song.title}</div>
          <div className="mt-1 truncate text-sm text-[var(--muted)]">{song.artist ?? 'Unknown artist'}</div>
        </div>
      </div>

      <ReadinessChips items={songReadiness(song)} />

      {issue && <p className="line-clamp-2 rounded-[10px] bg-[oklch(0.55_0.16_28_/_0.09)] p-3 text-xs leading-5 text-[var(--danger)]">{issue}</p>}

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <StatusDot status={song.status} />
        <span className="mono text-xs text-[var(--faint)]">
          {formatDuration(song.duration_sec)} - {formatDate(song.updated_at)}
        </span>
      </div>
    </Link>
  );
}

function SongListRow({ song, last }: { song: SongRow; last: boolean }) {
  const issue = getSongIssue(song);

  return (
    <Link
      href={`/studio/${song.id}` as Route}
      className={`grid items-center gap-4 px-5 py-4 text-left transition hover:bg-[var(--card-2)] md:grid-cols-[auto_1.4fr_1fr_auto_auto] ${
        last ? '' : 'border-b border-[var(--line-2)]'
      }`}
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
      <span className="mono min-w-16 text-right text-xs text-[var(--faint)]">{formatDuration(song.duration_sec)}</span>
    </Link>
  );
}

function songReadiness(song: SongRow) {
  return [
    { label: 'Audio', ready: song.has_audio },
    { label: 'Stems', ready: song.has_stems },
    { label: 'Lyrics', ready: song.has_plain_lyrics || song.has_synced_lyrics },
    { label: 'Karaoke', ready: song.has_synced_lyrics },
    { label: 'MIDI', ready: song.has_midi },
    { label: 'Analysis', ready: song.has_analysis },
  ];
}
