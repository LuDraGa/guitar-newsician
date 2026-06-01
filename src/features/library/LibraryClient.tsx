'use client';

import { AlertCircle, CheckCircle2, Clock3, DownloadCloud, Music2, RefreshCw, Search, UploadCloud, Wand2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

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
  statusClass,
  titleFromFilename,
} from './library-utils';

type WorkflowResult = {
  song?: SongRow;
  job?: JobRow;
};

export function LibraryClient() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'probe' | 'ingest' | null>(null);
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

  async function loadLibrary() {
    setLoading(true);
    setError(null);
    try {
      const [songsPayload, jobsPayload] = await Promise.all([
        fetchJson<{ songs: SongRow[] }>('/api/songs?limit=100'),
        fetchJson<{ jobs: JobRow[] }>('/api/jobs?limit=20'),
      ]);
      setSongs(songsPayload.songs);
      setJobs(jobsPayload.jobs);
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
      const endpoint = mode === 'probe' ? '/api/songs/probe' : localYoutubeEnabled ? '/api/local/youtube-download' : '/api/songs/ingest';
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
          ? 'Probe completed. Check the latest job row for metadata and diagnostics.'
          : localYoutubeEnabled
          ? `Downloaded locally${payload.song?.title ? `: ${payload.song.title}` : ''}`
          : `Source registered${payload.song?.title ? `: ${payload.song.title}` : ''}. Upload audio to run studio workflows.`
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

  async function archiveSong(songId: string) {
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/api/songs/${songId}`, {
        method: 'DELETE',
      });
      setMessage('Song archived');
      await loadLibrary();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Could not archive song');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>, mode: 'probe' | 'ingest') {
    event.preventDefault();
    void submitSource(mode);
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
      await loadLibrary();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload audio');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="muted text-sm">Supabase library</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Songs</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadLibrary()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {localYoutubeEnabled && (
        <div className="surface p-4">
          <form className="grid gap-3 lg:grid-cols-[1fr_auto_auto]" onSubmit={(event) => handleSubmit(event, 'ingest')}>
            <div>
              <label htmlFor="source-url" className="muted mb-2 block text-xs font-medium uppercase">
                Local YouTube Download
              </label>
              <input
                id="source-url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitSource('probe')}
              disabled={Boolean(submitting)}
              className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              Probe
            </button>
            <button
              type="submit"
              disabled={Boolean(submitting)}
              className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-slate-950 hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60"
            >
              <DownloadCloud className="h-4 w-4" />
              {submitting === 'ingest' ? 'Downloading' : 'Download'}
            </button>
          </form>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="surface p-4">
        <form className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto]" onSubmit={uploadAudio}>
          <div>
            <label htmlFor="audio-upload" className="muted mb-2 block text-xs font-medium uppercase">
              Audio Upload
            </label>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="block h-11 w-full rounded-md border border-white/10 bg-black/20 text-sm text-slate-200 file:mr-3 file:h-full file:border-0 file:bg-white/10 file:px-3 file:text-sm file:text-white hover:file:bg-white/15"
            />
          </div>
          <div>
            <label htmlFor="upload-song" className="muted mb-2 block text-xs font-medium uppercase">
              Attach To
            </label>
            <select
              id="upload-song"
              value={uploadSongId}
              onChange={(event) => setUploadSongId(event.target.value)}
              className="h-11 w-full rounded-md border border-white/10 bg-[#0d121b] px-3 text-sm text-white outline-none focus:border-[var(--accent)]"
            >
              <option value="">New song</option>
              {songsNeedingAudio.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="upload-title" className="muted mb-2 block text-xs font-medium uppercase">
              Title
            </label>
            <input
              id="upload-title"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Song title"
              className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label htmlFor="upload-artist" className="muted mb-2 block text-xs font-medium uppercase">
              Artist
            </label>
            <input
              id="upload-artist"
              value={uploadArtist}
              onChange={(event) => setUploadArtist(event.target.value)}
              placeholder="Optional"
              className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {uploading ? 'Uploading' : 'Upload'}
          </button>
        </form>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-[var(--accent-strong)]" />
              <h2 className="font-medium">Library</h2>
              <span className="muted text-sm">{filteredSongs.length}</span>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter songs"
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="muted border-b border-white/10 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Artist</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Assets</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSongs.map((song) => {
                  const issue = getSongIssue(song);

                  return (
                    <tr key={song.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <Link href={`/studio/${song.id}` as Route} className="font-medium text-white hover:text-[var(--accent-strong)]">
                          {song.title}
                        </Link>
                        {song.source_url && <div className="muted mt-1 max-w-[280px] truncate text-xs">{song.source_url}</div>}
                        {issue && <div className="mt-1 max-w-[360px] text-xs text-red-200">{issue}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{song.artist ?? 'Unknown'}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{formatDuration(song.duration_sec)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${statusClass(song.status)}`}>{song.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {[
                            ['audio', song.has_audio],
                            ['norm', song.has_normalized_audio],
                            ['stems', song.has_stems],
                            ['analysis', song.has_analysis],
                            ['lyrics', song.has_plain_lyrics || song.has_synced_lyrics],
                            ['midi', song.has_midi],
                          ].map(([label, active]) => (
                            <span
                              key={label as string}
                              className={`rounded border px-1.5 py-0.5 text-[11px] ${
                                active ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent-strong)]' : 'border-white/10 text-slate-500'
                              }`}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(song.updated_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void archiveSong(song.id)}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                        >
                          Archive
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && filteredSongs.length === 0 && (
            <div className="grid place-items-center px-4 py-14 text-center">
              <div>
                <Music2 className="mx-auto h-10 w-10 text-slate-600" />
                <h3 className="mt-3 font-medium text-slate-200">No songs yet</h3>
                <p className="muted mt-1 text-sm">Ingest a source URL to create the first Supabase-backed song row.</p>
              </div>
            </div>
          )}
        </div>

        <aside className="surface h-fit overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 p-4">
            <Clock3 className="h-4 w-4 text-[var(--accent-strong)]" />
            <h2 className="font-medium">Recent Jobs</h2>
          </div>
          <div className="divide-y divide-white/5">
            {jobs.map((job) => (
              <div key={job.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Wand2 className="h-4 w-4 text-slate-400" />
                      {job.job_type}
                    </div>
                    <div className="muted mt-1 text-xs">{job.modal_endpoint ?? 'Next job'}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs ${statusClass(job.status)}`}>{job.status}</span>
                </div>
                {job.error_message && <p className="mt-2 text-xs text-red-200">{job.error_message}</p>}
                <div className="muted mt-2 flex justify-between text-xs">
                  <span>{Math.round(job.progress)}%</span>
                  <span>{formatDate(job.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
          {!loading && jobs.length === 0 && <div className="muted p-4 text-sm">No jobs recorded yet.</div>}
        </aside>
      </div>
    </section>
  );
}
