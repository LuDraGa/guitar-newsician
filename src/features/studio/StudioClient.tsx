'use client';

import {
  Activity,
  AlertCircle,
  AudioLines,
  FileMusic,
  ListMusic,
  Loader2,
  Music2,
  RefreshCw,
  Scissors,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AnalysisResultRow, AssetRow, JobRow, LyricsRow, SongRow } from '@/types/werecode';
import { assetLabel, fetchJson, formatBytes, formatDate, signDownload, statusClass } from './studio-utils';

type WorkflowResult = {
  job?: JobRow;
  assets?: AssetRow[];
  song?: SongRow;
};

export function StudioClient({ initialSongId }: { initialSongId?: string }) {
  const [songId, setSongId] = useState(initialSongId ?? '');
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [song, setSong] = useState<SongRow | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResultRow[]>([]);
  const [lyrics, setLyrics] = useState<LyricsRow[]>([]);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const latestAssetsByKind = useMemo(() => {
    const map = new Map<string, AssetRow>();
    for (const asset of assets) {
      if (!map.has(asset.kind)) {
        map.set(asset.kind, asset);
      }
    }
    return map;
  }, [assets]);

  const sourceAsset =
    latestAssetsByKind.get('normalized_audio') ??
    latestAssetsByKind.get('source_audio') ??
    latestAssetsByKind.get('preview_audio');
  const vocalAsset = latestAssetsByKind.get('stem_vocals');
  const plainLyrics = useMemo(() => lyrics.find((item) => item.lyrics_type === 'plain'), [lyrics]);
  const syncedLyrics = useMemo(() => lyrics.find((item) => item.lyrics_type === 'lrc' || item.lyrics_type === 'alignment_json'), [lyrics]);

  const loadStudio = useCallback(async (nextSongId: string) => {
    setLoading(true);
    setError(null);
    try {
      const songsPayload = await fetchJson<{ songs: SongRow[] }>('/api/songs?limit=100');
      setSongs(songsPayload.songs);

      const selectedSongId = nextSongId || songsPayload.songs[0]?.id || '';
      setSongId(selectedSongId);

      if (!selectedSongId) {
        setSong(null);
        setAssets([]);
        setJobs([]);
        setAnalysisResults([]);
        setLyrics([]);
        setLyricsDraft('');
        setAudioUrl(null);
        return;
      }

      const [songPayload, assetsPayload, jobsPayload, analysisPayload, lyricsPayload] = await Promise.all([
        fetchJson<{ song: SongRow }>(`/api/songs/${selectedSongId}`),
        fetchJson<{ assets: AssetRow[] }>(`/api/songs/${selectedSongId}/assets`),
        fetchJson<{ jobs: JobRow[] }>(`/api/jobs?songId=${selectedSongId}&limit=30`),
        fetchJson<{ analysisResults: AnalysisResultRow[] }>(`/api/songs/${selectedSongId}/analysis-results`),
        fetchJson<{ lyrics: LyricsRow[] }>(`/api/songs/${selectedSongId}/lyrics`),
      ]);

      setSong(songPayload.song);
      setAssets(assetsPayload.assets);
      setJobs(jobsPayload.jobs);
      setAnalysisResults(analysisPayload.analysisResults);
      setLyrics(lyricsPayload.lyrics);
      setLyricsDraft(lyricsPayload.lyrics.find((item) => item.lyrics_type === 'plain')?.content ?? '');

      const playableAsset =
        assetsPayload.assets.find((asset) => asset.kind === 'preview_audio') ??
        assetsPayload.assets.find((asset) => asset.kind === 'normalized_audio') ??
        assetsPayload.assets.find((asset) => asset.kind === 'source_audio');

      if (playableAsset) {
        const signed = await signDownload(playableAsset);
        setAudioUrl(signed);
      } else {
        setAudioUrl(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load studio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStudio(initialSongId ?? '');
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialSongId, loadStudio]);

  async function runWorkflow(name: string, endpoint: string, payload: Record<string, unknown>) {
    if (!song) {
      setError('Select a song first');
      return;
    }

    setRunning(name);
    setError(null);
    setMessage(null);

    try {
      const result = await fetchJson<WorkflowResult>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          song_id: song.id,
          ...payload,
        }),
      });
      const jobStatus = result.job?.status;
      setMessage(
        jobStatus === 'processing'
          ? `${name} is still processing`
          : jobStatus === 'failed'
          ? `${name} failed`
          : `${name} completed${result.assets?.length ? ` with ${result.assets.length} artifact(s)` : ''}`
      );
      await loadStudio(song.id);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : `${name} failed`);
    } finally {
      setRunning(null);
    }
  }

  async function openAsset(asset: AssetRow) {
    setError(null);
    try {
      const signed = await signDownload(asset);
      window.open(signed, '_blank', 'noopener,noreferrer');
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : 'Could not sign asset URL');
    }
  }

  async function savePlainLyrics() {
    if (!song) {
      setError('Select a song first');
      return;
    }

    setRunning('Save lyrics');
    setError(null);
    setMessage(null);

    try {
      await fetchJson('/api/lyrics/save', {
        method: 'POST',
        body: JSON.stringify({
          song_id: song.id,
          lyrics_type: 'plain',
          source: 'user',
          content: lyricsDraft,
        }),
      });
      setMessage('Lyrics saved');
      await loadStudio(song.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save lyrics');
    } finally {
      setRunning(null);
    }
  }

  const actions = [
    {
      id: 'analysis',
      label: 'Analyze',
      icon: Activity,
      disabled: !sourceAsset,
      run: () =>
        sourceAsset &&
        runWorkflow('Analysis', '/api/workflows/analyze', {
          source_asset_id: sourceAsset.id,
          preset: 'quick',
        }),
    },
    {
      id: 'stems',
      label: 'Stems',
      icon: Scissors,
      disabled: !sourceAsset,
      run: () =>
        sourceAsset &&
        runWorkflow('Stem separation', '/api/workflows/separate', {
          source_asset_id: sourceAsset.id,
          stems: ['vocals', 'drums', 'bass', 'other'],
          model: 'htdemucs_6s',
          shifts: 2,
        }),
    },
    {
      id: 'lyrics_align',
      label: 'Karaoke',
      icon: ListMusic,
      disabled: !(vocalAsset ?? sourceAsset),
      run: () =>
        (vocalAsset ?? sourceAsset) &&
        runWorkflow('Lyrics alignment', '/api/workflows/lyrics/align', {
          source_asset_id: (vocalAsset ?? sourceAsset)!.id,
          known_lyrics: plainLyrics?.content ?? undefined,
        }),
    },
    {
      id: 'midi',
      label: 'MIDI',
      icon: FileMusic,
      disabled: !(sourceAsset ?? vocalAsset),
      run: () =>
        (sourceAsset ?? vocalAsset) &&
        runWorkflow('MIDI transcription', '/api/workflows/midi/transcribe', {
          source_asset_id: (sourceAsset ?? vocalAsset)!.id,
          stem_name: vocalAsset ? 'vocals' : undefined,
        }),
    },
  ];

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="muted text-sm">Studio orchestration</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{song?.title ?? 'Studio'}</h1>
          {song && <p className="muted mt-1 text-sm">{song.artist ?? 'Unknown artist'}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={songId}
            onChange={(event) => void loadStudio(event.target.value)}
            className="h-10 min-w-64 rounded-md border border-white/10 bg-[#0d121b] px-3 text-sm text-white outline-none focus:border-[var(--accent)]"
          >
            <option value="">Select song</option>
            {songs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadStudio(songId)}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!song && !loading ? (
        <div className="surface grid place-items-center px-4 py-16 text-center">
          <div>
            <Music2 className="mx-auto h-10 w-10 text-slate-600" />
            <h2 className="mt-3 text-lg font-medium">No song selected</h2>
            <p className="muted mt-1 text-sm">Create or ingest a song from the library before running studio workflows.</p>
            <Link
              href="/library"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-slate-950 hover:bg-[var(--accent-strong)]"
            >
              Open Library
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-5">
            <div className="surface p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AudioLines className="h-4 w-4 text-[var(--accent-strong)]" />
                  <h2 className="font-medium">Playback Source</h2>
                </div>
                {song && <span className={`rounded-md border px-2 py-1 text-xs ${statusClass(song.status)}`}>{song.status}</span>}
              </div>
              {audioUrl ? (
                <audio src={audioUrl} controls className="w-full" />
              ) : (
                <div className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p>No playable audio asset is available yet.</p>
                  <Link href="/library" className="mt-2 inline-flex text-[var(--accent-strong)] hover:text-[var(--accent)]">
                    Upload source audio
                  </Link>
                </div>
              )}
            </div>

            <div className="surface p-4">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" />
                <h2 className="font-medium">Workflow Actions</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => void action.run()}
                      disabled={action.disabled || Boolean(running)}
                      className="flex h-12 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {running === action.label ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-white/10 p-4">
                <h2 className="font-medium">Assets</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="muted border-b border-white/10 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Kind</th>
                      <th className="px-4 py-3 font-medium">Format</th>
                      <th className="px-4 py-3 font-medium">Size</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id} className="border-b border-white/5">
                        <td className="px-4 py-3 font-medium text-white">{assetLabel(asset.kind)}</td>
                        <td className="px-4 py-3 text-slate-300">{asset.content_type ?? '--'}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{formatBytes(asset.byte_size)}</td>
                        <td className="px-4 py-3 text-slate-300">{asset.modal_model ?? '--'}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(asset.created_at)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void openAsset(asset)}
                            className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-100 hover:bg-white/10"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!loading && assets.length === 0 && <div className="muted p-4 text-sm">No assets recorded for this song yet.</div>}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="surface p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-medium">Analysis</h2>
                  <span className="muted text-xs">{analysisResults.length} result(s)</span>
                </div>
                <div className="grid gap-3">
                  {analysisResults.slice(0, 6).map((result) => (
                    <div key={result.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-white">{result.analyzer_name}</div>
                        <span className={`rounded-md border px-2 py-1 text-xs ${result.ok ? statusClass('ready') : statusClass('failed')}`}>
                          {result.ok ? 'ok' : 'failed'}
                        </span>
                      </div>
                      {result.error && <p className="mt-2 text-xs text-red-200">{result.error}</p>}
                      <pre className="muted mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {!loading && analysisResults.length === 0 && <div className="muted text-sm">Run Analyze to populate Supabase analysis results.</div>}
                </div>
              </div>

              <div className="surface p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-medium">Lyrics</h2>
                  {syncedLyrics && <span className={`rounded-md border px-2 py-1 text-xs ${statusClass('ready')}`}>synced</span>}
                </div>
                <textarea
                  value={lyricsDraft}
                  onChange={(event) => setLyricsDraft(event.target.value)}
                  placeholder="Paste lyrics here. Karaoke alignment can use this as known lyrics."
                  className="min-h-48 w-full resize-y rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent)]"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="muted text-xs">
                    {syncedLyrics ? `Latest synced source: ${syncedLyrics.source ?? 'unknown'}` : 'No synced lyrics yet'}
                  </div>
                  <button
                    type="button"
                    onClick={() => void savePlainLyrics()}
                    disabled={Boolean(running)}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="surface h-fit overflow-hidden">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-medium">Song Jobs</h2>
            </div>
            <div className="divide-y divide-white/5">
              {jobs.map((job) => (
                <div key={job.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{job.job_type}</div>
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
            {!loading && jobs.length === 0 && <div className="muted p-4 text-sm">No jobs for this song yet.</div>}
          </aside>
        </div>
      )}
    </section>
  );
}
