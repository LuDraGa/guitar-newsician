'use client';

import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, DownloadCloud, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CoverArt, PillIcon, statusChipClass, StatusDot } from '@/components/werecode/WereCodePrimitives';
import { toJobSummary, useWereCodeDataCache } from '@/lib/client-cache/werecode-data-cache';
import { getStemInfo, stemDisplayLabel } from '@/lib/music/stem-metadata';
import type { JobRow } from '@/types/werecode';
import type { AssetSummary, JobSummary, SongSummary } from '@/types/werecode-client';
import { assetLabel, fetchJson, formatBytes, formatDate, signDownload } from '@/features/studio/studio-utils';

type PipelineTab = 'jobs' | 'assets';
type FilterOption = { value: string; label: string; meta?: string };
type JobSyncResult = { job: JobRow; assets?: AssetSummary[] | null };
type JobTargetContext = {
  type: 'stem' | 'source';
  label: string;
  listLabel: string;
  copyValue: string;
  sourceAssetId: string;
  asset: AssetSummary | null;
  metadata: Record<string, string | null>;
};

const NO_SONG_FILTER = '__no_song__';
const emptyAssetSummaries: AssetSummary[] = [];
const ACTIVE_JOB_POLL_MS = 4000;
const ACTIVE_JOB_MAX_TICKS = 120;

export function PipelineClient() {
  const jobs = useWereCodeDataCache((state) => state.jobs);
  const jobsLoaded = useWereCodeDataCache((state) => state.jobsLoaded);
  const songs = useWereCodeDataCache((state) => state.songs);
  const songsLoaded = useWereCodeDataCache((state) => state.songsLoaded);
  const assetsBySongId = useWereCodeDataCache((state) => state.assetsBySongId);
  const jobDetailsById = useWereCodeDataCache((state) => state.jobDetailsById);
  const setCachedJobs = useWereCodeDataCache((state) => state.setJobs);
  const setCachedSongs = useWereCodeDataCache((state) => state.setSongs);
  const setCachedJobDetail = useWereCodeDataCache((state) => state.setJobDetail);
  const setCachedAssetsForSong = useWereCodeDataCache((state) => state.setAssetsForSong);
  const upsertCachedAssetForSong = useWereCodeDataCache((state) => state.upsertAssetForSong);
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [tab, setTab] = useState<PipelineTab>('jobs');
  const [query, setQuery] = useState('');
  const [songFilters, setSongFilters] = useState<string[]>([]);
  const [jobTypeFilters, setJobTypeFilters] = useState<string[]>([]);
  const [endpointFilters, setEndpointFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(!(jobsLoaded && songsLoaded));
  const [assetLoading, setAssetLoading] = useState(false);
  const [jobDetailLoadingId, setJobDetailLoadingId] = useState<string | null>(null);
  const [jobDetailError, setJobDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const syncingJobsRef = useRef(new Set<string>());

  const selectedAssetCache = selectedSongId ? assetsBySongId[selectedSongId] : undefined;
  const assets = selectedAssetCache?.assets ?? emptyAssetSummaries;
  const selectedJobDetail = selectedJob ? (jobDetailsById[selectedJob.id] ?? null) : null;
  const selectedJobId = selectedJob?.id ?? null;
  const assetById = useMemo(() => {
    const map = new Map<string, AssetSummary>();
    for (const entry of Object.values(assetsBySongId)) {
      for (const asset of entry.assets) {
        map.set(asset.id, asset);
      }
    }
    return map;
  }, [assetsBySongId]);
  const jobTargetsById = useMemo(() => {
    const map = new Map<string, JobTargetContext>();
    for (const [jobId, detail] of Object.entries(jobDetailsById)) {
      const target = buildJobTargetContext(detail, assetById);
      if (target) {
        map.set(jobId, target);
      }
    }
    return map;
  }, [assetById, jobDetailsById]);

  const cacheJobDetail = useCallback((job: JobRow) => {
    setCachedJobDetail(job);
    setSelectedJob((current) => (current?.id === job.id ? toJobSummary(job) : current));
  }, [setCachedJobDetail]);

  const syncActiveJobs = useCallback(async () => {
    const activeJobs = useWereCodeDataCache.getState().jobs.filter(isActiveJob);
    const settledSongIds = new Set<string>();
    let touched = false;

    await Promise.all(
      activeJobs.map(async (job) => {
        if (syncingJobsRef.current.has(job.id)) {
          return;
        }

        syncingJobsRef.current.add(job.id);
        try {
          const payload = await fetchJson<JobSyncResult>(`/api/jobs/${job.id}/sync`, { method: 'POST' });
          cacheJobDetail(payload.job);
          touched = true;
          if (payload.job.song_id && !isActiveJob(payload.job)) {
            settledSongIds.add(payload.job.song_id);
          }
          for (const asset of payload.assets ?? []) {
            if (asset.song_id) {
              upsertCachedAssetForSong(asset.song_id, asset);
            }
          }
        } catch {
          // Best-effort diagnostics poll. The next tick or manual refresh retries.
        } finally {
          syncingJobsRef.current.delete(job.id);
        }
      })
    );

    return { touched, settledSongIds };
  }, [cacheJobDetail, upsertCachedAssetForSong]);

  const loadPipeline = useCallback(async (options: { force?: boolean } = {}) => {
    const cache = useWereCodeDataCache.getState();
    if (!options.force && cache.jobsLoaded && cache.songsLoaded) {
      setSelectedJob((current) => current ?? cache.jobs[0] ?? null);
      setSelectedSongId(
        (current) => current || cache.jobs.find((job) => job.song_id)?.song_id || cache.songs[0]?.id || ''
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const shouldLoadJobs = options.force || !cache.jobsLoaded;
      const shouldLoadSongs = options.force || !cache.songsLoaded;
      const [jobsPayload, songsPayload] = await Promise.all([
        shouldLoadJobs
          ? fetchJson<{ jobs: JobSummary[] }>('/api/jobs?limit=100')
          : Promise.resolve({ jobs: cache.jobs }),
        shouldLoadSongs
          ? fetchJson<{ songs: SongSummary[] }>('/api/songs?limit=100')
          : Promise.resolve({ songs: cache.songs }),
      ]);

      if (shouldLoadJobs) {
        setCachedJobs(jobsPayload.jobs);
      }
      if (shouldLoadSongs) {
        setCachedSongs(songsPayload.songs);
      }
      setSelectedJob((current) => jobsPayload.jobs.find((job) => job.id === current?.id) ?? jobsPayload.jobs[0] ?? null);
      setSelectedSongId((current) => current || jobsPayload.jobs.find((job) => job.song_id)?.song_id || songsPayload.songs[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load pipeline');
    } finally {
      setLoading(false);
    }
  }, [setCachedJobs, setCachedSongs]);

  const loadAssets = useCallback(async (songId: string, options: { force?: boolean } = {}) => {
    if (!songId) {
      setSelectedAsset(null);
      return;
    }

    const cached = useWereCodeDataCache.getState().assetsBySongId[songId];
    if (!options.force && cached) {
      setSelectedAsset((current) => cached.assets.find((asset) => asset.id === current?.id) ?? cached.assets[0] ?? null);
      setAssetLoading(false);
      return;
    }

    setAssetLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<{ assets: AssetSummary[] }>(`/api/songs/${songId}/assets?view=summary`);
      setCachedAssetsForSong(songId, payload.assets);
      setSelectedAsset((current) => payload.assets.find((asset) => asset.id === current?.id) ?? payload.assets[0] ?? null);
    } catch (loadError) {
      setSelectedAsset(null);
      setError(loadError instanceof Error ? loadError.message : 'Could not load assets');
    } finally {
      setAssetLoading(false);
    }
  }, [setCachedAssetsForSong]);

  const loadJobDetail = useCallback(async (jobId: string, options: { force?: boolean } = {}) => {
    if (!options.force && useWereCodeDataCache.getState().jobDetailsById[jobId]) {
      setJobDetailError(null);
      return;
    }

    setJobDetailLoadingId(jobId);
    setJobDetailError(null);
    try {
      const payload = await fetchJson<{ job: JobRow }>(`/api/jobs/${jobId}`);
      setCachedJobDetail(payload.job);
      setSelectedJob((current) => (current?.id === payload.job.id ? toJobSummary(payload.job) : current));
    } catch (loadError) {
      setJobDetailError(loadError instanceof Error ? loadError.message : 'Could not load job detail');
    } finally {
      setJobDetailLoadingId((current) => (current === jobId ? null : current));
    }
  }, [setCachedJobDetail]);

  const refreshPipeline = useCallback(async () => {
    await loadPipeline({ force: true });
    const syncResult = await syncActiveJobs();
    if (selectedSongId) {
      await loadAssets(selectedSongId, { force: true });
    }
    for (const songId of syncResult.settledSongIds) {
      if (songId && songId !== selectedSongId) {
        await loadAssets(songId, { force: true });
      }
    }
    if (selectedJob) {
      await loadJobDetail(selectedJob.id, { force: true });
    }
  }, [loadAssets, loadJobDetail, loadPipeline, selectedJob, selectedSongId, syncActiveJobs]);

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
    if (!selectedJobId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadJobDetail(selectedJobId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadJobDetail, selectedJobId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!jobsLoaded) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let ticks = 0;

    const poll = async () => {
      if (cancelled) {
        return;
      }

      const activeJobs = useWereCodeDataCache.getState().jobs.filter(isActiveJob);
      if (activeJobs.length === 0 || ticks >= ACTIVE_JOB_MAX_TICKS) {
        return;
      }

      ticks += 1;
      const result = await syncActiveJobs();
      if (cancelled) {
        return;
      }

      if (selectedSongId && result.settledSongIds.has(selectedSongId)) {
        void loadAssets(selectedSongId, { force: true });
      }

      if (useWereCodeDataCache.getState().jobs.some(isActiveJob)) {
        timer = window.setTimeout(() => void poll(), ACTIVE_JOB_POLL_MS);
      }
    };

    timer = window.setTimeout(() => void poll(), 0);

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [jobsLoaded, loadAssets, selectedSongId, syncActiveJobs]);

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

  async function openAsset(asset: AssetSummary) {
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
  const selectedItemLabel = tab === 'jobs'
    ? selectedJob ? formatJobType(selectedJob.job_type) : 'None'
    : selectedAsset ? assetLabel(selectedAsset.kind) : 'None';
  const selectedItemDetail = tab === 'jobs' ? selectedJob?.id : selectedAsset?.id;

  return (
    <section className="wc-rise flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto py-3 lg:overflow-hidden">
      <header className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="label mb-1">Diagnostics - Next + Supabase + Modal</div>
            <h1 className="display truncate text-[26px] leading-none">Pipeline</h1>
          </div>
          <span className="chip shrink-0">dev</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto xl:justify-center">
          <PipelineStat label="Jobs" value={String(jobs.length)} />
          <PipelineStat label="Active" value={String(activeJobs)} />
          <PipelineStat label="Assets" value={String(assets.length)} title={selectedSong?.title ?? undefined} />
          <PipelineStat label="Selected" value={selectedItemLabel} title={selectedItemDetail ?? selectedItemLabel} wide />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:w-[300px] sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${tab}`}
              className="wc-input h-9 pl-9 pr-3 text-[13px]"
            />
          </div>
          <button
            type="button"
            onClick={() => void refreshPipeline()}
            disabled={loading}
            className="iconbtn h-9 w-9 rounded-full bg-[var(--card)] shadow-[inset_0_0_0_1px_var(--line)]"
            aria-label="Refresh pipeline"
            title="Refresh pipeline"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
      </header>

      {message && (
        <div className="chip live min-h-9 shrink-0 justify-start rounded-[12px] px-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="chip danger min-h-9 shrink-0 justify-start rounded-[12px] px-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative z-20 flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap">
        <MultiSelectFilter label="Song" options={songFilterOptions} selected={songFilters} onToggle={(value) => setSongFilters((current) => toggleFilterValue(current, value))} />
        <MultiSelectFilter label="Job" options={jobTypeFilterOptions} selected={jobTypeFilters} onToggle={(value) => setJobTypeFilters((current) => toggleFilterValue(current, value))} />
        <MultiSelectFilter label="Endpoint" options={endpointFilterOptions} selected={endpointFilters} onToggle={(value) => setEndpointFilters((current) => toggleFilterValue(current, value))} />
        <MultiSelectFilter label="Status" options={statusFilterOptions} selected={statusFilters} onToggle={(value) => setStatusFilters((current) => toggleFilterValue(current, value))} />
        <label className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--card)] px-3 shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="label text-[10px]">Assets</span>
          <select
            value={selectedSongId}
            onChange={(event) => setSelectedSongId(event.target.value)}
            className="w-44 max-w-[42vw] truncate bg-transparent text-xs font-bold outline-none"
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
            className="chip danger relative z-30 h-9 shrink-0"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="grid min-h-[620px] gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="surface flex min-h-0 flex-col overflow-hidden">
          {tab === 'jobs' ? (
            <JobList
              jobs={filteredJobs}
              songById={songById}
              jobTargetsById={jobTargetsById}
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

        <aside className="surface flex min-h-0 flex-col overflow-hidden">
          {tab === 'jobs' ? (
            <JobDetail
              job={selectedJob}
              jobDetail={selectedJobDetail}
              detailLoading={Boolean(selectedJob && jobDetailLoadingId === selectedJob.id)}
              detailError={jobDetailError}
              selectedSong={selectedSong}
              target={selectedJob ? jobTargetsById.get(selectedJob.id) ?? null : null}
              nowMs={nowMs}
            />
          ) : (
            <AssetDetail asset={selectedAsset} selectedSong={selectedSong} onOpenAsset={(asset) => void openAsset(asset)} />
          )}
        </aside>
      </div>
    </section>
  );
}

function PipelineStat({ label, value, title, wide = false }: { label: string; value: string; title?: string; wide?: boolean }) {
  return (
    <span
      className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-[var(--card)] px-3 shadow-[inset_0_0_0_1px_var(--line)] ${wide ? 'max-w-[230px]' : ''}`}
      title={title}
    >
      <span className="label text-[9px]">{label}</span>
      <span className="mono truncate text-xs font-bold text-[var(--ink)]">
        {value}
      </span>
    </span>
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
    <details className="group relative shrink-0">
      <summary
        className={`inline-flex h-9 cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-bold shadow-[inset_0_0_0_1px_var(--line)] [&::-webkit-details-marker]:hidden ${
          selectedCount > 0 ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--card)] text-[var(--ink)]'
        }`}
      >
        <span className="label text-[10px] text-current opacity-70">{label}</span>
        <span>{selectedCount > 0 ? `${selectedCount} selected` : 'All'}</span>
      </summary>
      <div className="absolute left-0 top-[calc(100%+8px)] z-20 hidden w-72 rounded-[16px] bg-[var(--card)] p-2 shadow-[var(--shadow-pop)] group-open:block max-md:static max-md:mt-2 max-md:w-[calc(100vw-32px)]">
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
  jobTargetsById,
  nowMs,
  selectedJob,
  loading,
  onSelect,
}: {
  jobs: JobSummary[];
  songById: Map<string, SongSummary>;
  jobTargetsById: Map<string, JobTargetContext>;
  nowMs: number;
  selectedJob: JobSummary | null;
  loading: boolean;
  onSelect: (job: JobSummary) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[760px]">
          <div className="label sticky top-0 z-10 grid grid-cols-[minmax(210px,1.35fr)_minmax(112px,0.8fr)_minmax(116px,0.8fr)_minmax(128px,0.8fr)_80px] gap-3 border-b border-[var(--line-2)] bg-[var(--card)] px-4 py-2.5 text-[10px]">
            <span>Job</span>
            <span>Endpoint</span>
            <span>Status</span>
            <span>Started</span>
            <span>Duration</span>
          </div>
          <div>
            {jobs.map((job) => {
              const target = jobTargetsById.get(job.id) ?? null;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelect(job)}
                  className="grid w-full grid-cols-[minmax(210px,1.35fr)_minmax(112px,0.8fr)_minmax(116px,0.8fr)_minmax(128px,0.8fr)_80px] items-center gap-3 border-b border-[var(--line-2)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--card-2)]"
                  style={selectedJob?.id === job.id ? { boxShadow: 'inset 3px 0 0 var(--accent)', background: 'var(--card-2)' } : undefined}
                >
                  <span className="min-w-0">
                    <span className="mono block truncate text-[13px] font-bold">{job.job_type}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                      {[songLabel(songById, job.song_id), target?.listLabel, job.id].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="mono truncate text-[11px] text-[var(--muted)]">{job.modal_endpoint ?? 'next'}</span>
                  <span>
                    <StatusDot status={job.status} />
                    {job.status === 'processing' && (
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--paper-2)]">
                        <span className="block h-full bg-[var(--accent)]" style={{ width: `${job.progress}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="mono truncate text-[11px] text-[var(--faint)]" title={job.started_at ?? undefined}>
                    {formatJobStarted(job)}
                  </span>
                  <span className="mono text-[11px] font-bold text-[var(--muted)]">{formatJobDuration(job, nowMs)}</span>
                </button>
              );
            })}
          </div>
          {!loading && jobs.length === 0 && <div className="p-4 text-sm text-[var(--muted)]">No jobs match this filter.</div>}
        </div>
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
  assets: AssetSummary[];
  selectedAsset: AssetSummary | null;
  loading: boolean;
  onSelect: (asset: AssetSummary) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[620px]">
          <div className="label sticky top-0 z-10 grid grid-cols-[minmax(250px,1.6fr)_minmax(150px,1fr)_96px] gap-3 border-b border-[var(--line-2)] bg-[var(--card)] px-4 py-2.5 text-[10px]">
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
                className="grid w-full grid-cols-[minmax(250px,1.6fr)_minmax(150px,1fr)_96px] items-center gap-3 border-b border-[var(--line-2)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--card-2)]"
                style={selectedAsset?.id === asset.id ? { boxShadow: 'inset 3px 0 0 var(--accent)', background: 'var(--card-2)' } : undefined}
              >
                <span className="min-w-0">
                  <span className="mono block truncate text-[13px] font-bold">{assetLabel(asset.kind)}</span>
                  <span className="mono mt-0.5 block truncate text-[11px] text-[var(--faint)]">{asset.object_path}</span>
                </span>
                <span className="mono truncate text-[11px] text-[var(--muted)]">{asset.content_type ?? '--'}</span>
                <span className="mono text-[11px] text-[var(--faint)]">{formatBytes(asset.byte_size)}</span>
              </button>
            ))}
          </div>
          {!loading && assets.length === 0 && <div className="p-4 text-sm text-[var(--muted)]">No assets match this filter.</div>}
        </div>
      </div>
    </div>
  );
}

function JobDetail({
  job,
  jobDetail,
  detailLoading,
  detailError,
  selectedSong,
  target,
  nowMs,
}: {
  job: JobSummary | null;
  jobDetail: JobRow | null;
  detailLoading: boolean;
  detailError: string | null;
  selectedSong: SongSummary | null;
  target: JobTargetContext | null;
  nowMs: number;
}) {
  const fullPayload = job ? buildJobCopyPayload(job, jobDetail, nowMs, target) : null;
  const jobDuration = job ? formatJobDuration(job, nowMs) : null;
  const songLabelText = selectedSong
    ? selectedSong.artist
      ? `${selectedSong.title} - ${selectedSong.artist}`
      : selectedSong.title
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-2 shrink-0 border-b border-[var(--line-2)] pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="label">Job payload</span>
              {job ? (
                <>
                  <span className="min-w-0 truncate text-base font-semibold">{job.job_type}</span>
                  {jobDuration && <span className="mono text-[11px] font-bold text-[var(--muted)]">{jobDuration}</span>}
                </>
              ) : (
                <span className="text-base font-semibold">No job selected</span>
              )}
              {job && <span className={`${statusChipClass(job.status)} shrink-0`}>{job.status}</span>}
            </div>
          </div>
          {fullPayload && <CopyJsonButton label="Copy full payload" value={fullPayload} />}
        </div>
        {selectedSong && songLabelText && (
          <div className="mt-2 grid gap-1.5">
            <CopyTextRow label="Song" value={songLabelText} />
            {target && <CopyTextRow label={target.type === 'stem' ? 'Stem' : 'Source'} value={target.copyValue} />}
            <CopyTextRow label="Song ID" value={selectedSong.id} mono />
          </div>
        )}
        {job?.error_message && (
          <div
            className="mt-2 flex h-7 items-center gap-2 rounded-[10px] bg-[oklch(0.55_0.16_28_/_0.1)] px-2.5 text-xs font-semibold text-[var(--danger)]"
            title={job.error_message}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.error_message}</span>
          </div>
        )}
      </div>
      {job ? (
        <JobPayloadExplorer job={job} jobDetail={jobDetail} detailLoading={detailLoading} detailError={detailError} target={target} nowMs={nowMs} />
      ) : (
        <div className="mono min-h-0 flex-1 rounded-[12px] bg-[var(--paper)] p-4 text-xs leading-6 text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-2)]">
          Select a job to inspect its payload.
        </div>
      )}
    </div>
  );
}

function JobPayloadExplorer({
  job,
  jobDetail,
  detailLoading,
  detailError,
  target,
  nowMs,
}: {
  job: JobSummary;
  jobDetail: JobRow | null;
  detailLoading: boolean;
  detailError: string | null;
  target: JobTargetContext | null;
  nowMs: number;
}) {
  const metadata = buildJobMetadata(job, nowMs, target);

  return (
    <div className="mono flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 text-xs leading-5 text-[var(--ink)]">
      <JsonSection key={`${job.id}-metadata`} title="metadata" value={metadata} defaultOpen />
      {jobDetail ? (
        <>
          <JsonSection key={`${job.id}-request`} title="request_payload" value={jobDetail.request_payload} />
          <JsonSection key={`${job.id}-response`} title="response_payload" value={jobDetail.response_payload} />
          <JsonSection key={`${job.id}-diagnostics`} title="diagnostics" value={jobDetail.diagnostics} />
        </>
      ) : (
        <div className="rounded-[12px] bg-[var(--paper)] px-3 py-2.5 text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-2)]">
          {detailError ?? (detailLoading ? 'Loading payload…' : 'Payload not loaded.')}
        </div>
      )}
    </div>
  );
}

function CopyTextRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copied = copyState === 'copied';
  const failed = copyState === 'failed';

  async function copyValue() {
    try {
      await writeTextToClipboard(value);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 1600);
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      className={`grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-2 rounded-[10px] bg-[var(--paper)] px-2.5 py-1.5 text-left shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors hover:bg-[var(--card-2)] ${
        copied ? 'text-[var(--accent-ink)]' : failed ? 'text-[var(--danger)]' : ''
      }`}
      title={`Copy ${label.toLowerCase()}`}
    >
      <span className="label pt-0.5 text-[8px] leading-none">{label}</span>
      <span className={`min-w-0 break-words text-[11px] font-bold leading-4 ${mono ? 'mono' : ''}`}>{value}</span>
      <span className="shrink-0 pt-0.5 text-[10px] font-bold text-[var(--faint)]">
        {copied ? 'Copied' : failed ? 'Failed' : 'Copy'}
      </span>
    </button>
  );
}

function buildJobMetadata(job: JobSummary, nowMs: number, target: JobTargetContext | null) {
  return {
    id: job.id,
    song_id: job.song_id,
    version_id: job.version_id,
    type: job.job_type,
    status: job.status,
    progress: job.progress,
    ...(target ? { target: target.metadata } : {}),
    message: job.message,
    error: job.error_message,
    started_at: job.started_at,
    completed_at: job.completed_at,
    duration: formatJobDuration(job, nowMs),
  };
}

function buildJobCopyPayload(job: JobSummary, jobDetail: JobRow | null, nowMs: number, target: JobTargetContext | null) {
  return {
    metadata: buildJobMetadata(job, nowMs, target),
    request_payload: jobDetail?.request_payload ?? null,
    response_payload: jobDetail?.response_payload ?? null,
    diagnostics: jobDetail?.diagnostics ?? null,
  };
}

function buildJobTargetContext(jobDetail: JobRow | null, assetById: Map<string, AssetSummary>): JobTargetContext | null {
  const requestPayload = asRecord(jobDetail?.request_payload);
  const sourceAssetId = cleanString(requestPayload?.source_asset_id);
  if (!sourceAssetId) {
    return null;
  }

  const asset = assetById.get(sourceAssetId) ?? null;
  const isStemTarget = requestPayload?.is_stem === true || asset?.kind.startsWith('stem_') === true;
  if (isStemTarget) {
    const stemInfo = asset ? getStemInfo(asset) : null;
    const label = asset ? stemDisplayLabel(asset) : `Stem asset ${sourceAssetId}`;
    const role = stemInfo?.role ?? null;
    const assetKind = asset?.kind ?? null;
    const copyValue = assetKind ? `${label} · ${assetKind} · ${sourceAssetId}` : `${label} · ${sourceAssetId}`;

    return {
      type: 'stem',
      label,
      listLabel: `Stem: ${label}`,
      copyValue,
      sourceAssetId,
      asset,
      metadata: {
        type: 'stem',
        label,
        role,
        source_asset_id: sourceAssetId,
        asset_kind: assetKind,
        object_path: asset?.object_path ?? null,
      },
    };
  }

  const label = asset ? assetLabel(asset.kind) : `Source asset ${sourceAssetId}`;
  return {
    type: 'source',
    label,
    listLabel: `Source: ${label}`,
    copyValue: asset ? `${label} · ${asset.kind} · ${sourceAssetId}` : `${label}`,
    sourceAssetId,
    asset,
    metadata: {
      type: 'source',
      label,
      role: null,
      source_asset_id: sourceAssetId,
      asset_kind: asset?.kind ?? null,
      object_path: asset?.object_path ?? null,
    },
  };
}

function CopyJsonButton({ label, value }: { label: string; value: unknown }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyValue() {
    try {
      await writeTextToClipboard(formatCopyPayload(value));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 1600);
  }

  const copied = copyState === 'copied';
  const failed = copyState === 'failed';

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={copyValue}
        className={`iconbtn h-8 w-8 rounded-[10px] ${
          copied
            ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
            : failed
              ? 'bg-[oklch(0.55_0.16_28_/_0.1)] text-[var(--danger)]'
              : 'bg-transparent'
        }`}
        aria-label={copied ? 'Copied' : failed ? 'Copy failed' : label}
        title={copied ? 'Copied' : failed ? 'Copy failed' : label}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : failed ? <AlertCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      {copyState !== 'idle' && (
        <span
          className={`pointer-events-none absolute right-0 top-[calc(100%+5px)] z-30 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold shadow-[var(--shadow-pop)] ${
            copied ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--danger)] text-[var(--paper)]'
          }`}
        >
          {copied ? 'Copied' : 'Copy failed'}
        </span>
      )}
    </span>
  );
}

function JsonSection({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[12px] bg-[var(--paper)] shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-1.5 py-2.5 text-left transition-colors hover:bg-[var(--card-2)]"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />}
          <span className="truncate font-bold text-[var(--ink)]">{title}</span>
          <span className="shrink-0 text-[var(--faint)]">{jsonSummary(value)}</span>
        </button>
        <CopyJsonButton label={`Copy ${title}`} value={value} />
      </div>
      {open && (
        <div className="max-h-80 overflow-auto border-t border-[var(--line-2)] py-2">
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
      <div className="flex px-3" style={{ paddingLeft: indent }}>
        <span className="inline-block w-5 shrink-0" />
        <JsonName name={name} kind={nameKind} />
        <span className="min-w-0 flex-1">
          <JsonPrimitive value={value} />
        </span>
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
    <span className={`mr-1 shrink-0 ${kind === 'index' ? 'text-[var(--faint)]' : 'text-[var(--accent-ink)]'}`}>
      {kind === 'index' ? name : JSON.stringify(name)}:
    </span>
  );
}

const STRING_PREVIEW = 140;
const STRING_STEP = 100;

function JsonString({ value }: { value: string }) {
  const [limit, setLimit] = useState(STRING_PREVIEW);
  const length = value.length;
  const isLong = length > STRING_PREVIEW;
  const effectiveLimit = isLong ? Math.min(limit, length) : length;
  const truncated = isLong && effectiveLimit < length;
  const shown = value.slice(0, effectiveLimit);
  const remaining = length - effectiveLimit;

  return (
    <span className="block min-w-0">
      <span className="whitespace-pre-wrap break-words text-[var(--live)]">
        {`"${shown}${truncated ? '…' : ''}"`}
      </span>
      {isLong && (
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-tight">
          {truncated && (
            <button
              type="button"
              onClick={() => setLimit((current) => Math.min(length, Math.max(current, effectiveLimit) + STRING_STEP))}
              className="rounded-full bg-[var(--card-2)] px-2 py-0.5 font-bold text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors hover:bg-[var(--accent-soft)]"
            >
              +{Math.min(STRING_STEP, remaining)} more
            </button>
          )}
          {truncated && (
            <button
              type="button"
              onClick={() => setLimit(length)}
              className="rounded-full px-2 py-0.5 font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              Show all
            </button>
          )}
          {!truncated && (
            <button
              type="button"
              onClick={() => setLimit(STRING_PREVIEW)}
              className="rounded-full px-2 py-0.5 font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              Less
            </button>
          )}
          <span className="text-[var(--faint)]">{length.toLocaleString()} chars</span>
        </span>
      )}
    </span>
  );
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-[var(--faint)]">null</span>;
  }

  if (typeof value === 'string') {
    return <JsonString value={value} />;
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
  asset: AssetSummary | null;
  selectedSong: SongSummary | null;
  onOpenAsset: (asset: AssetSummary) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-3 shrink-0 border-b border-[var(--line-2)] pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label mb-1">Asset detail</div>
            <h2 className="truncate text-base font-semibold">{asset ? assetLabel(asset.kind) : 'No asset selected'}</h2>
            {asset && <div className="mono mt-1 truncate text-[11px] text-[var(--faint)]">{asset.id}</div>}
          </div>
        </div>
        {selectedSong && (
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <CoverArt id={selectedSong.id} size={24} title={selectedSong.title} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{selectedSong.title}</div>
              <div className="truncate text-[11px] text-[var(--muted)]">{selectedSong.artist ?? 'Unknown artist'}</div>
            </div>
          </div>
        )}
      </div>
      {asset ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3">
            <DetailRow label="Kind" value={asset.kind} />
            <DetailRow label="MIME" value={asset.content_type ?? '--'} />
            <DetailRow label="Size" value={formatBytes(asset.byte_size)} />
            <DetailRow label="Created" value={formatDate(asset.created_at)} />
            <div>
              <div className="label mb-2">Storage path</div>
              <code className="mono block break-all rounded-[12px] bg-[var(--paper)] p-3 text-xs leading-5 shadow-[inset_0_0_0_1px_var(--line-2)]">
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
        </div>
      ) : (
        <div className="min-h-0 flex-1 text-sm text-[var(--muted)]">Select an asset to inspect its storage metadata.</div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line-2)] pb-2 text-sm">
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

function isActiveJob(job: Pick<JobSummary, 'status'> | Pick<JobRow, 'status'>) {
  return job.status === 'queued' || job.status === 'processing';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatJobStarted(job: JobSummary) {
  return job.started_at ? formatDate(job.started_at) : '--';
}

function formatJobDuration(job: JobSummary, nowMs: number) {
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

function formatCopyPayload(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

async function writeTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the selection-based copy path for embedded browsers.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) {
      throw new Error('Copy command failed');
    }
  } finally {
    document.body.removeChild(textarea);
  }
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

function songLabel(songById: Map<string, SongSummary>, songId: string | null) {
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
