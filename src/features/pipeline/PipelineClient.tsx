'use client';

import { Activity, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Database, DownloadCloud, RefreshCw, Search, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CoverArt, PillIcon, statusChipClass, StatusDot } from '@/components/werecode/WereCodePrimitives';
import type { AssetRow, JobRow, SongRow } from '@/types/werecode';
import { assetLabel, fetchJson, formatBytes, formatDate, signDownload } from '@/features/studio/studio-utils';

type PipelineTab = 'jobs' | 'assets';
type FilterOption = { value: string; label: string; meta?: string };

const NO_SONG_FILTER = '__no_song__';

export function PipelineClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null);
  const [tab, setTab] = useState<PipelineTab>('jobs');
  const [query, setQuery] = useState('');
  const [songFilters, setSongFilters] = useState<string[]>([]);
  const [jobTypeFilters, setJobTypeFilters] = useState<string[]>([]);
  const [endpointFilters, setEndpointFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetLoading, setAssetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsPayload, songsPayload] = await Promise.all([
        fetchJson<{ jobs: JobRow[] }>('/api/jobs?limit=100'),
        fetchJson<{ songs: SongRow[] }>('/api/songs?limit=100'),
      ]);

      setJobs(jobsPayload.jobs);
      setSongs(songsPayload.songs);
      setSelectedJob((current) => jobsPayload.jobs.find((job) => job.id === current?.id) ?? jobsPayload.jobs[0] ?? null);
      setSelectedSongId((current) => current || jobsPayload.jobs.find((job) => job.song_id)?.song_id || songsPayload.songs[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssets = useCallback(async (songId: string) => {
    if (!songId) {
      setAssets([]);
      setSelectedAsset(null);
      return;
    }

    setAssetLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<{ assets: AssetRow[] }>(`/api/songs/${songId}/assets`);
      setAssets(payload.assets);
      setSelectedAsset((current) => payload.assets.find((asset) => asset.id === current?.id) ?? payload.assets[0] ?? null);
    } catch (loadError) {
      setAssets([]);
      setSelectedAsset(null);
      setError(loadError instanceof Error ? loadError.message : 'Could not load assets');
    } finally {
      setAssetLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPipeline();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPipeline]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAssets(selectedSongId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAssets, selectedSongId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedSong = useMemo(() => songs.find((song) => song.id === selectedSongId) ?? null, [selectedSongId, songs]);
  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const normalizedQuery = query.trim().toLowerCase();
  const hasActiveFilters = songFilters.length + jobTypeFilters.length + endpointFilters.length + statusFilters.length > 0;

  const songFilterOptions = useMemo<FilterOption[]>(() => {
    const ids = new Set<string>();
    for (const song of songs) {
      ids.add(song.id);
    }
    for (const job of jobs) {
      ids.add(songFilterValue(job.song_id));
    }
    for (const asset of assets) {
      ids.add(songFilterValue(asset.song_id));
    }

    return Array.from(ids)
      .map((value) => {
        if (value === NO_SONG_FILTER) {
          return { value, label: 'No song' };
        }
        const song = songById.get(value);
        return {
          value,
          label: song?.title ?? `Song ${value.slice(0, 8)}`,
          meta: song?.artist ?? undefined,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [assets, jobs, songById, songs]);

  const jobTypeFilterOptions = useMemo<FilterOption[]>(
    () =>
      uniqueSorted(jobs.map((job) => job.job_type)).map((value) => ({
        value,
        label: formatJobType(value),
      })),
    [jobs]
  );

  const endpointFilterOptions = useMemo<FilterOption[]>(
    () =>
      uniqueSorted([...jobs.map((job) => endpointFilterValue(job.modal_endpoint)), ...assets.map((asset) => endpointFilterValue(asset.modal_endpoint))]).map(
        (value) => ({
          value,
          label: formatEndpoint(value),
        })
      ),
    [assets, jobs]
  );

  const statusFilterOptions = useMemo<FilterOption[]>(
    () =>
      uniqueSorted(jobs.map((job) => job.status)).map((value) => ({
        value,
        label: formatJobType(value),
      })),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const songValue = songFilterValue(job.song_id);
      const endpointValue = endpointFilterValue(job.modal_endpoint);
      const song = job.song_id ? songById.get(job.song_id) : null;

      return (
        selectionMatches(songFilters, songValue) &&
        selectionMatches(jobTypeFilters, job.job_type) &&
        selectionMatches(endpointFilters, endpointValue) &&
        selectionMatches(statusFilters, job.status) &&
        textMatches(normalizedQuery, [
          job.id,
          job.job_type,
          job.status,
          endpointValue,
          job.message,
          job.error_message,
          song?.title,
          song?.artist,
        ])
      );
    });
  }, [endpointFilters, jobTypeFilters, jobs, normalizedQuery, songById, songFilters, statusFilters]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const songValue = songFilterValue(asset.song_id);
      const endpointValue = endpointFilterValue(asset.modal_endpoint);
      const song = asset.song_id ? songById.get(asset.song_id) : null;

      return (
        selectionMatches(songFilters, songValue) &&
        selectionMatches(endpointFilters, endpointValue) &&
        textMatches(normalizedQuery, [
          asset.id,
          asset.kind,
          asset.content_type,
          asset.bucket_id,
          asset.object_path,
          endpointValue,
          asset.modal_model,
          song?.title,
          song?.artist,
        ])
      );
    });
  }, [assets, endpointFilters, normalizedQuery, songById, songFilters]);

  async function openAsset(asset: AssetRow) {
    setError(null);
    setMessage(null);
    try {
      const signed = await signDownload(asset);
      window.open(signed, '_blank', 'noopener,noreferrer');
      setMessage('Signed URL opened in a new tab');
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : 'Could not sign asset URL');
    }
  }

  const activeJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'processing').length;

  return (
    <section className="wc-rise mx-auto flex max-w-[1180px] flex-col">
      <header className="pb-6 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="label mb-3">Diagnostics - Next + Supabase + Modal</div>
            <h1 className="display text-[clamp(36px,5vw,58px)]">Pipeline</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Inspect workflow jobs, request payloads, storage assets, and signed downloads without leaving the app runtime.
            </p>
          </div>
        </div>
      </header>

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

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Jobs" value={String(jobs.length)} detail={`${activeJobs} active`} icon={<Activity className="h-4 w-4" />} />
        <MetricCard label="Assets" value={String(assets.length)} detail={selectedSong?.title ?? 'Select a song'} icon={<Database className="h-4 w-4" />} />
        <MetricCard label="Selected" value={selectedJob?.job_type ?? 'None'} detail={selectedJob?.id ?? 'No job selected'} icon={<Wand2 className="h-4 w-4" />} />
      </div>

      <div className="mb-5 grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1 sm:max-w-[360px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${tab}`}
              className="wc-input h-10 pl-11 pr-4 text-sm"
            />
          </div>
          <button type="button" onClick={() => void loadPipeline()} disabled={loading} className="pill ghost sm">
            <PillIcon>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </PillIcon>
            Refresh
          </button>
          <div className="flex-1" />
          <div className="segment bg-[var(--card)] shadow-[inset_0_0_0_1.5px_var(--line)]">
            <button
              type="button"
              onClick={() => {
                setTab('jobs');
                setQuery('');
              }}
              className={tab === 'jobs' ? 'on' : 'text-[var(--muted)]'}
            >
              Jobs
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('assets');
                setQuery('');
              }}
              className={tab === 'assets' ? 'on' : 'text-[var(--muted)]'}
            >
              Assets
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectFilter label="Song" options={songFilterOptions} selected={songFilters} onToggle={(value) => setSongFilters((current) => toggleFilterValue(current, value))} />
          <MultiSelectFilter label="Job" options={jobTypeFilterOptions} selected={jobTypeFilters} onToggle={(value) => setJobTypeFilters((current) => toggleFilterValue(current, value))} />
          <MultiSelectFilter label="Endpoint" options={endpointFilterOptions} selected={endpointFilters} onToggle={(value) => setEndpointFilters((current) => toggleFilterValue(current, value))} />
          <MultiSelectFilter label="Status" options={statusFilterOptions} selected={statusFilters} onToggle={(value) => setStatusFilters((current) => toggleFilterValue(current, value))} />
          <label className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--card)] px-3 shadow-[inset_0_0_0_1px_var(--line)]">
            <span className="label text-[10px]">Assets</span>
            <select
              value={selectedSongId}
              onChange={(event) => setSelectedSongId(event.target.value)}
              className="min-w-40 bg-transparent text-sm font-bold outline-none"
              aria-label="Asset song"
            >
              <option value="">No song selected</option>
              {songs.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title}
                </option>
              ))}
            </select>
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSongFilters([]);
                setJobTypeFilters([]);
                setEndpointFilters([]);
                setStatusFilters([]);
              }}
              className="chip danger relative z-30"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-[560px] gap-5 xl:grid-cols-[1fr_380px]">
        <section className="surface overflow-hidden">
          {tab === 'jobs' ? (
            <JobList
              jobs={filteredJobs}
              songById={songById}
              nowMs={nowMs}
              selectedJob={selectedJob}
              loading={loading}
              onSelect={(job) => {
                setSelectedJob(job);
                if (job.song_id) {
                  setSelectedSongId(job.song_id);
                }
              }}
            />
          ) : (
            <AssetList
              assets={filteredAssets}
              selectedAsset={selectedAsset}
              loading={assetLoading}
              onSelect={setSelectedAsset}
            />
          )}
        </section>

        <aside className="surface overflow-hidden">
          {tab === 'jobs' ? (
            <JobDetail job={selectedJob} selectedSong={selectedSong} nowMs={nowMs} />
          ) : (
            <AssetDetail asset={selectedAsset} selectedSong={selectedSong} onOpenAsset={(asset) => void openAsset(asset)} />
          )}
        </aside>
      </div>
    </section>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="surface flex items-center justify-between gap-4 p-5">
      <div>
        <div className="label mb-2">{label}</div>
        <div className="display max-w-[220px] truncate text-2xl">{value}</div>
        <div className="mono mt-1 truncate text-xs text-[var(--faint)]">{detail}</div>
      </div>
      <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--card-2)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--line-2)]">
        {icon}
      </span>
    </div>
  );
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const selectedCount = selected.length;

  return (
    <details className="group relative">
      <summary
        className={`inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-sm font-bold shadow-[inset_0_0_0_1px_var(--line)] [&::-webkit-details-marker]:hidden ${
          selectedCount > 0 ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--card)] text-[var(--ink)]'
        }`}
      >
        <span className="label text-[10px] text-current opacity-70">{label}</span>
        <span>{selectedCount > 0 ? `${selectedCount} selected` : 'All'}</span>
      </summary>
      <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-72 rounded-[16px] bg-[var(--card)] p-2 shadow-[var(--shadow-pop)]">
        <div className="max-h-72 overflow-y-auto pr-1">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={`mb-1 flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-sm last:mb-0 ${
                  checked ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'hover:bg-[var(--card-2)]'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{option.label}</span>
                  {option.meta && <span className="mt-1 block truncate text-xs text-[var(--muted)]">{option.meta}</span>}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.value)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </label>
            );
          })}
          {options.length === 0 && <div className="px-3 py-2 text-sm text-[var(--muted)]">No options yet</div>}
        </div>
      </div>
    </details>
  );
}

function JobList({
  jobs,
  songById,
  nowMs,
  selectedJob,
  loading,
  onSelect,
}: {
  jobs: JobRow[];
  songById: Map<string, SongRow>;
  nowMs: number;
  selectedJob: JobRow | null;
  loading: boolean;
  onSelect: (job: JobRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[660px]">
      <div className="label grid grid-cols-[minmax(180px,1.35fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(112px,0.8fr)_80px] gap-3 border-b border-[var(--line-2)] px-5 py-3 text-[10px]">
        <span>Job</span>
        <span>Endpoint</span>
        <span>Status</span>
        <span>Started</span>
        <span>Duration</span>
      </div>
      <div>
        {jobs.map((job) => (
          <button
            key={job.id}
            type="button"
            onClick={() => onSelect(job)}
            className="grid w-full grid-cols-[minmax(180px,1.35fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(112px,0.8fr)_80px] items-center gap-3 border-b border-[var(--line-2)] px-5 py-4 text-left last:border-b-0 hover:bg-[var(--card-2)]"
            style={selectedJob?.id === job.id ? { boxShadow: 'inset 3px 0 0 var(--accent)', background: 'var(--card-2)' } : undefined}
          >
            <span className="min-w-0">
              <span className="mono block truncate text-sm font-bold">{job.job_type}</span>
              <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                {songLabel(songById, job.song_id)} · {job.id}
              </span>
            </span>
            <span className="mono truncate text-[11px] text-[var(--muted)]">{job.modal_endpoint ?? 'next'}</span>
            <span>
              <StatusDot status={job.status} />
              {job.status === 'processing' && (
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[var(--paper-2)]">
                  <span className="block h-full bg-[var(--accent)]" style={{ width: `${job.progress}%` }} />
                </span>
              )}
            </span>
            <span className="mono truncate text-[11px] text-[var(--faint)]" title={job.started_at ?? undefined}>
              {formatJobStarted(job)}
            </span>
            <span className="mono text-[11px] font-bold text-[var(--muted)]">{formatJobDuration(job, nowMs)}</span>
          </button>
        ))}
      </div>
      {!loading && jobs.length === 0 && <div className="p-5 text-sm text-[var(--muted)]">No jobs match this filter.</div>}
      </div>
    </div>
  );
}

function AssetList({
  assets,
  selectedAsset,
  loading,
  onSelect,
}: {
  assets: AssetRow[];
  selectedAsset: AssetRow | null;
  loading: boolean;
  onSelect: (asset: AssetRow) => void;
}) {
  return (
    <>
      <div className="label grid grid-cols-[1.6fr_1fr_auto] gap-3 border-b border-[var(--line-2)] px-5 py-3 text-[10px]">
        <span>Asset</span>
        <span>Type</span>
        <span>Size</span>
      </div>
      <div>
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => onSelect(asset)}
            className="grid w-full grid-cols-[1.6fr_1fr_auto] items-center gap-3 border-b border-[var(--line-2)] px-5 py-4 text-left last:border-b-0 hover:bg-[var(--card-2)]"
            style={selectedAsset?.id === asset.id ? { boxShadow: 'inset 3px 0 0 var(--accent)', background: 'var(--card-2)' } : undefined}
          >
            <span className="min-w-0">
              <span className="mono block truncate text-sm font-bold">{assetLabel(asset.kind)}</span>
              <span className="mono mt-1 block truncate text-[11px] text-[var(--faint)]">{asset.object_path}</span>
            </span>
            <span className="mono truncate text-[11px] text-[var(--muted)]">{asset.content_type ?? '--'}</span>
            <span className="mono text-[11px] text-[var(--faint)]">{formatBytes(asset.byte_size)}</span>
          </button>
        ))}
      </div>
      {!loading && assets.length === 0 && <div className="p-5 text-sm text-[var(--muted)]">No assets match this filter.</div>}
    </>
  );
}

function JobDetail({ job, selectedSong, nowMs }: { job: JobRow | null; selectedSong: SongRow | null; nowMs: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="label mb-2">Job payload</div>
          <h2 className="font-semibold">{job?.job_type ?? 'No job selected'}</h2>
        </div>
        {job && <span className={statusChipClass(job.status)}>{job.status}</span>}
      </div>
      {selectedSong && (
        <div className="mb-4 flex items-center gap-3 rounded-[12px] bg-[var(--card-2)] p-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
          <CoverArt id={selectedSong.id} size={38} title={selectedSong.title} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{selectedSong.title}</div>
            <div className="truncate text-xs text-[var(--muted)]">{selectedSong.artist ?? 'Unknown artist'}</div>
          </div>
        </div>
      )}
      {job?.error_message && (
        <div className="chip danger mb-4 min-h-10 w-full justify-start rounded-[12px] px-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{job.error_message}</span>
        </div>
      )}
      {job ? (
        <JobPayloadExplorer job={job} nowMs={nowMs} />
      ) : (
        <div className="mono min-h-0 flex-1 rounded-[12px] bg-[var(--paper)] p-4 text-xs leading-6 text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-2)]">
          Select a job to inspect its payload.
        </div>
      )}
    </div>
  );
}

function JobPayloadExplorer({ job, nowMs }: { job: JobRow; nowMs: number }) {
  const metadata = {
    id: job.id,
    song_id: job.song_id,
    version_id: job.version_id,
    type: job.job_type,
    status: job.status,
    progress: job.progress,
    endpoint: job.modal_endpoint ?? 'next',
    message: job.message,
    error: job.error_message,
    started_at: job.started_at,
    completed_at: job.completed_at,
    duration: formatJobDuration(job, nowMs),
  };

  return (
    <div className="mono min-h-0 flex-1 overflow-auto rounded-[12px] bg-[var(--paper)] p-3 text-xs leading-6 text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line-2)]">
      <JsonSection key={`${job.id}-metadata`} title="metadata" value={metadata} defaultOpen />
      <JsonSection key={`${job.id}-request`} title="request_payload" value={job.request_payload} defaultOpen />
      <JsonSection key={`${job.id}-response`} title="response_payload" value={job.response_payload} />
      <JsonSection key={`${job.id}-diagnostics`} title="diagnostics" value={job.diagnostics} />
    </div>
  );
}

function JsonSection({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-2 min-w-max rounded-[10px] bg-[var(--card)] shadow-[inset_0_0_0_1px_var(--line-2)] last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />}
        <span className="font-bold text-[var(--ink)]">{title}</span>
        <span className="text-[var(--faint)]">{jsonSummary(value)}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--line-2)] py-2">
          <JsonNode value={value} path={title} depth={0} defaultExpandedDepth={1} />
        </div>
      )}
    </section>
  );
}

function JsonNode({
  name,
  nameKind,
  value,
  path,
  depth,
  defaultExpandedDepth,
}: {
  name?: string;
  nameKind?: 'property' | 'index';
  value: unknown;
  path: string;
  depth: number;
  defaultExpandedDepth: number;
}) {
  const entries = getJsonEntries(value);
  const expandable = entries !== null;
  const [open, setOpen] = useState(depth < defaultExpandedDepth);
  const indent = `${depth * 16}px`;

  if (!expandable) {
    return (
      <div className="flex min-w-max whitespace-nowrap px-3" style={{ paddingLeft: indent }}>
        <span className="inline-block w-5" />
        <JsonName name={name} kind={nameKind} />
        <JsonPrimitive value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const openToken = isArray ? '[' : '{';
  const closeToken = isArray ? ']' : '}';
  const empty = entries.length === 0;

  return (
    <>
      <div className="flex min-w-max whitespace-nowrap px-3" style={{ paddingLeft: indent }}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={empty}
          className="mr-1 grid h-6 w-4 place-items-center text-[var(--muted)] disabled:opacity-25"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${name ?? path}`}
          aria-expanded={open}
        >
          {open && !empty ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <JsonName name={name} kind={nameKind} />
        <span className="text-[var(--muted)]">{openToken}</span>
        {!open && (
          <>
            <span className="px-1 text-[var(--faint)]">{jsonSummary(value)}</span>
            <span className="text-[var(--muted)]">{closeToken}</span>
          </>
        )}
        {open && empty && <span className="text-[var(--muted)]">{closeToken}</span>}
      </div>
      {open &&
        !empty &&
        entries.map(([key, childValue]) => (
          <JsonNode
            key={`${path}.${key}`}
            name={key}
            nameKind={isArray ? 'index' : 'property'}
            value={childValue}
            path={`${path}.${key}`}
            depth={depth + 1}
            defaultExpandedDepth={defaultExpandedDepth}
          />
        ))}
      {open && !empty && (
        <div className="min-w-max whitespace-nowrap px-3 text-[var(--muted)]" style={{ paddingLeft: indent }}>
          <span className="inline-block w-5" />
          {closeToken}
        </div>
      )}
    </>
  );
}

function JsonName({ name, kind }: { name?: string; kind?: 'property' | 'index' }) {
  if (!name) {
    return null;
  }

  return (
    <span className={kind === 'index' ? 'mr-1 text-[var(--faint)]' : 'mr-1 text-[var(--accent-ink)]'}>
      {kind === 'index' ? name : JSON.stringify(name)}:
    </span>
  );
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-[var(--faint)]">null</span>;
  }

  if (typeof value === 'string') {
    return <span className="text-[var(--live)]">{JSON.stringify(value)}</span>;
  }

  if (typeof value === 'number') {
    return <span className="text-[var(--accent-ink)]">{String(value)}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-[var(--warn)]">{String(value)}</span>;
  }

  if (typeof value === 'undefined') {
    return <span className="text-[var(--faint)]">undefined</span>;
  }

  return <span className="text-[var(--muted)]">{JSON.stringify(value)}</span>;
}

function AssetDetail({
  asset,
  selectedSong,
  onOpenAsset,
}: {
  asset: AssetRow | null;
  selectedSong: SongRow | null;
  onOpenAsset: (asset: AssetRow) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="label mb-2">Asset detail</div>
          <h2 className="font-semibold">{asset ? assetLabel(asset.kind) : 'No asset selected'}</h2>
        </div>
      </div>
      {selectedSong && (
        <div className="mb-4 flex items-center gap-3 rounded-[12px] bg-[var(--card-2)] p-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
          <CoverArt id={selectedSong.id} size={38} title={selectedSong.title} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{selectedSong.title}</div>
            <div className="truncate text-xs text-[var(--muted)]">{selectedSong.artist ?? 'Unknown artist'}</div>
          </div>
        </div>
      )}
      {asset ? (
        <div className="grid gap-4">
          <DetailRow label="Kind" value={asset.kind} />
          <DetailRow label="MIME" value={asset.content_type ?? '--'} />
          <DetailRow label="Size" value={formatBytes(asset.byte_size)} />
          <DetailRow label="Created" value={formatDate(asset.created_at)} />
          <div>
            <div className="label mb-2">Storage path</div>
            <code className="mono block break-all rounded-[12px] bg-[var(--paper)] p-4 text-xs leading-6 shadow-[inset_0_0_0_1px_var(--line-2)]">
              {asset.object_path}
            </code>
          </div>
          <button type="button" onClick={() => onOpenAsset(asset)} className="pill w-fit">
            <PillIcon>
              <DownloadCloud className="h-3.5 w-3.5" />
            </PillIcon>
            Signed URL
          </button>
        </div>
      ) : (
        <div className="text-sm text-[var(--muted)]">Select an asset to inspect its storage metadata.</div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line-2)] pb-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="mono text-right font-semibold">{value}</span>
    </div>
  );
}

function toggleFilterValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function selectionMatches(selected: string[], value: string) {
  return selected.length === 0 || selected.includes(value);
}

function textMatches(query: string, values: Array<string | null | undefined>) {
  return !query || values.some((value) => value?.toLowerCase().includes(query));
}

function formatJobStarted(job: JobRow) {
  return job.started_at ? formatDate(job.started_at) : '--';
}

function formatJobDuration(job: JobRow, nowMs: number) {
  const startedMs = parseTimeMs(job.started_at);
  if (startedMs === null) {
    return '--';
  }

  const completedMs = parseTimeMs(job.completed_at);
  const updatedMs = parseTimeMs(job.updated_at);
  const endedMs = completedMs ?? (job.status === 'processing' ? nowMs : updatedMs);

  if (endedMs === null) {
    return '--';
  }

  return formatDurationMs(Math.max(0, endedMs - startedMs));
}

function parseTimeMs(value: string | null) {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function formatDurationMs(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 1) {
    return '<1s';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function getJsonEntries(value: unknown): Array<[string, unknown]> | null {
  if (Array.isArray(value)) {
    return value.map((item, index) => [String(index), item]);
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>);
  }

  return null;
}

function jsonSummary(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }

  if (value !== null && typeof value === 'object') {
    const count = Object.keys(value as Record<string, unknown>).length;
    return `${count} key${count === 1 ? '' : 's'}`;
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => formatJobType(a).localeCompare(formatJobType(b)));
}

function songFilterValue(songId: string | null) {
  return songId ?? NO_SONG_FILTER;
}

function endpointFilterValue(endpoint: string | null) {
  return endpoint ?? 'next';
}

function songLabel(songById: Map<string, SongRow>, songId: string | null) {
  if (!songId) {
    return 'No song';
  }
  return songById.get(songId)?.title ?? `Song ${songId.slice(0, 8)}`;
}

function formatEndpoint(value: string) {
  if (value === 'next') {
    return 'Next route';
  }
  return value.replace(/^\/api\/workflows\//, '').replace(/[_-]/g, ' ');
}

function formatJobType(value: string) {
  return value.replace(/[_-]/g, ' ');
}
