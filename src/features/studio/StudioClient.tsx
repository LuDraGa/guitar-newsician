'use client';

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DownloadCloud,
  FileMusic,
  Flag,
  GripVertical,
  Guitar,
  Layers,
  ListMusic,
  Loader2,
  Mic,
  Music2,
  Pause,
  Play,
  Repeat,
  RefreshCw,
  Save,
  Scissors,
  Send,
  Sheet,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CoverArt, PillIcon, StatusDot } from '@/components/werecode/WereCodePrimitives';
import {
  getCachedSignedAssetUrl,
  toAssetSummary,
  toSongSummary,
  toStudioDetail,
  useWereCodeDataCache,
} from '@/lib/client-cache/werecode-data-cache';
import {
  STUDIO_DETAIL_TTL_MS,
  getStoredStudioDetail,
  putStoredStudioDetail,
} from '@/lib/client-cache/studio-detail-store';
import {
  DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT,
  getStemSeparationDurationLimitWarning,
} from '@/lib/audio/stem-separation-limits';
import {
  activeChordIndex,
  buildSongFacts,
  deriveChordEvents,
  deriveSectionSegments,
  type SectionSegment,
} from '@/lib/music/analysis-overview';
import { parseLrc } from '@/lib/music/lrc';
import { createBrowserAudioContext } from '@/lib/music/waveform/audio-context';
import { ANALYZE_FULL_ANALYZERS, computeStageStatuses } from '@/server/werecode/pipeline-versions';
import type { AnalysisResultRow, AssetRow, JobRow, LyricsRow, SongRow } from '@/types/werecode';
import type { AssetSummary, SongSummary, StudioDetail } from '@/types/werecode-client';
import { PitchShift } from 'tone/build/esm/effect/PitchShift.js';
import { setContext as setToneContext } from 'tone/build/esm/core/Global.js';
import { connect as connectToneAudioNodes } from 'tone/build/esm/core/context/ToneAudioNode.js';
import { MusicXmlPreviewPanel } from './MusicXmlPreviewPanel';
import { StudioPicker } from './StudioPicker';
import { fetchJson, formatBytes, signDownloads } from './studio-utils';

type WorkflowResult = {
  job?: JobRow;
  assets?: AssetRow[];
  song?: SongRow;
  analysisResults?: AnalysisResultRow[];
  lyrics?: LyricsRow[] | LyricsRow | null;
  lyricsLookup?: {
    skipped_modal?: boolean;
    reason?: string;
  };
};

type SaveLyricsResult = {
  song?: SongRow | null;
  lyrics?: LyricsRow;
};

type StudioTab = 'karaoke' | 'guitar' | 'lyrics';
type AnalyzeDepth = 'quick' | 'full';
type GuitarMode = 'chords' | 'sheet' | 'tab';
type LyricDisplayLine = { id: string; timestamp: number | null; text: string };
type StemMixState = { level: number; muted: boolean; solo: boolean };
type StemPlaybackSource = { id: string; kind: AssetSummary['kind']; url: string; level: number; muted: boolean; solo: boolean };
type SeekCommand = { id: number; time: number };
type PlaybackCommand = { id: number; action: 'toggle' };
type EditorLyricLine = { id: string; time: number | null; text: string };
type EditorLyricsSavePayload = {
  plainContent: string;
  lrcContent: string | null;
};
type StemLevelPreviewDetail = { assetId: string; level: number };

const stemLevelPreviewEvent = 'werecode:stem-level-preview';
const stemKindSet = new Set(['stem_vocals', 'stem_drums', 'stem_bass', 'stem_other', 'stem_guitar', 'stem_piano']);
const stemKindOrder = ['stem_vocals', 'stem_guitar', 'stem_bass', 'stem_drums', 'stem_piano', 'stem_other'];
const defaultStemLevels: Record<string, number> = {
  stem_vocals: 82,
  stem_guitar: 72,
  stem_bass: 64,
  stem_drums: 58,
  stem_piano: 62,
  stem_other: 70,
};
const stemColors: Record<string, string> = {
  stem_vocals: '#c8752d',
  stem_guitar: '#0f9b72',
  stem_bass: '#5d7bd6',
  stem_drums: '#c95f5f',
  stem_piano: '#8f70d5',
  stem_other: '#a36bb1',
};
const studioTabs = [
  ['karaoke', 'Karaoke', Mic],
  ['guitar', 'Guitar learner', Guitar],
  ['lyrics', 'Lyrics editor', Type],
] as const;
const guitarModes = [
  ['chords', 'Chords', Music2],
  ['tab', 'Tab', Guitar],
  ['sheet', 'Sheet', Sheet],
] as const;
// Even-spaced playback-speed stops. The speed slider maps its 0..N-1 index onto
// these values, so the stops sit at equal notches and 1× lands dead-centre as home.
const SPEED_STOPS = [0.5, 0.75, 1, 1.5, 1.75, 2] as const;
const VOLUME_MAX = 150;

export function StudioClient({ initialSongId }: { initialSongId?: string }) {
  const upsertCachedJob = useWereCodeDataCache((state) => state.upsertJob);
  const upsertCachedAssetForSong = useWereCodeDataCache((state) => state.upsertAssetForSong);
  const setCachedStudioDetail = useWereCodeDataCache((state) => state.setStudioDetail);
  const patchCachedStudioSong = useWereCodeDataCache((state) => state.patchStudioSong);
  const upsertCachedStudioAssets = useWereCodeDataCache((state) => state.upsertStudioAssets);
  const setCachedStudioLyrics = useWereCodeDataCache((state) => state.setStudioLyrics);
  const setCachedStudioAnalysisResults = useWereCodeDataCache((state) => state.setStudioAnalysisResults);
  const setCachedSignedAssetUrls = useWereCodeDataCache((state) => state.setSignedAssetUrls);
  const [songId, setSongId] = useState(initialSongId ?? '');
  const [song, setSong] = useState<SongSummary | null>(null);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResultRow[]>([]);
  const [lyrics, setLyrics] = useState<LyricsRow[]>([]);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [stemUrls, setStemUrls] = useState<Record<string, string>>({});
  const [stemMix, setStemMix] = useState<Record<string, StemMixState>>({});
  const [stemSignError, setStemSignError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<ReadonlySet<string>>(() => new Set<string>());
  // Stages observed as still in flight on the server (e.g. a job started before a
  // reload, or in another tab). Merged with the local `running` set so the UI
  // reflects work it did not itself start; server-seeded, never touched by
  // begin/finishStage.
  const [reconnectingStages, setReconnectingStages] = useState<ReadonlySet<string>>(() => new Set<string>());
  // Bumped after an async enqueue to (re)start the job poll, so an in-session async
  // job is advanced even though nothing was active at mount.
  const [jobPollNonce, setJobPollNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<StudioTab>('karaoke');
  const [analyzeDepth, setAnalyzeDepth] = useState<AnalyzeDepth>('full');
  const [coachOpen, setCoachOpen] = useState(false);
  const [transportMinimized, setTransportMinimized] = useState(false);
  const [transportTime, setTransportTime] = useState(0);
  const [transportPlaying, setTransportPlaying] = useState(false);
  const [seekCommand, setSeekCommand] = useState<SeekCommand | null>(null);
  const [playbackCommand, setPlaybackCommand] = useState<PlaybackCommand | null>(null);

  const latestAssetsByKind = useMemo(() => {
    const map = new Map<string, AssetSummary>();
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
  const noteEventsAsset = latestAssetsByKind.get('note_events');
  const musicXmlAsset = latestAssetsByKind.get('musicxml') ?? latestAssetsByKind.get('tab_musicxml');
  const tabAsset = latestAssetsByKind.get('tab_musicxml');
  const plainLyrics = useMemo(() => findLatestPlainLyrics(lyrics), [lyrics]);
  const syncedLyrics = useMemo(() => findActiveSyncedLyrics(lyrics, plainLyrics), [lyrics, plainLyrics]);
  const stemAssets = useMemo(
    () => assets.filter((asset) => stemKindSet.has(asset.kind)).sort((a, b) => stemKindOrder.indexOf(a.kind) - stemKindOrder.indexOf(b.kind)),
    [assets]
  );
  const playableStemAssets = useMemo(() => dedupeLatestStemAssets(stemAssets), [stemAssets]);
  const stageStatuses = useMemo(
    () => computeStageStatuses(assets.map((asset) => ({ kind: asset.kind, pipeline_version: asset.pipeline_version ?? null }))),
    [assets]
  );
  const staleStages = useMemo(
    () => new Set(stageStatuses.filter((status) => status.isStale).map((status) => status.stage)),
    [stageStatuses]
  );
  const lyricLines = useMemo(() => deriveLyricLines(syncedLyrics, plainLyrics), [plainLyrics, syncedLyrics]);
  const sectionSegments = useMemo(() => deriveSectionSegments(analysisResults), [analysisResults]);
  const facts = useMemo(() => buildSongFacts(song, analysisResults), [song, analysisResults]);
  const stemSeparationWarning = useMemo(
    () => getStemSeparationDurationLimitWarning(sourceAsset?.duration_sec ?? song?.duration_sec, DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT),
    [song?.duration_sec, sourceAsset?.duration_sec]
  );
  const stemPlaybackSources = useMemo(
    () =>
      playableStemAssets
        .map((asset) => {
          const url = stemUrls[asset.id];
          if (!url) {
            return null;
          }
          const mix = stemMix[asset.id] ?? defaultStemMix(asset);
          return {
            id: asset.id,
            kind: asset.kind,
            url,
            level: mix.level,
            muted: mix.muted,
            solo: mix.solo,
          };
        })
        .filter((source): source is StemPlaybackSource => Boolean(source)),
    [playableStemAssets, stemMix, stemUrls]
  );
  const signablePlaybackAssets = useMemo(() => {
    const unique = new Map<string, AssetSummary>();
    const playbackAssets = playableStemAssets.length > 0 ? playableStemAssets : [sourceAsset];
    for (const asset of playbackAssets) {
      if (asset) {
        unique.set(asset.id, asset);
      }
    }
    return Array.from(unique.values());
  }, [playableStemAssets, sourceAsset]);

  const requestTransportSeek = useCallback((time: number) => {
    const target = Math.max(0, time);
    setTransportTime(target);
    setSeekCommand({ id: Date.now(), time: target });
  }, []);

  const requestPlaybackToggle = useCallback(() => {
    setPlaybackCommand({ id: Date.now(), action: 'toggle' });
  }, []);

  const changeTab = useCallback((nextTab: StudioTab) => {
    setTab(nextTab);
    setTransportMinimized(nextTab === 'lyrics');
  }, []);

  const updateStemMix = useCallback(
    (assetId: string, patch: Partial<StemMixState>) => {
      const asset = stemAssets.find((item) => item.id === assetId);
      setStemMix((current) => ({
        ...current,
        [assetId]: {
          ...(asset ? defaultStemMix(asset) : { level: 82, muted: false, solo: false }),
          ...current[assetId],
          ...patch,
        },
      }));
    },
    [stemAssets]
  );

  const previewStemLevel = useCallback((assetId: string, level: number) => {
    window.dispatchEvent(new CustomEvent<StemLevelPreviewDetail>(stemLevelPreviewEvent, { detail: { assetId, level } }));
  }, []);

  const soloStem = useCallback(
    (assetId: string) => {
      setStemMix((current) => {
        const currentSolo = current[assetId]?.solo ?? false;
        const next: Record<string, StemMixState> = {};
        for (const asset of stemAssets) {
          next[asset.id] = {
            ...defaultStemMix(asset),
            ...current[asset.id],
            solo: asset.id === assetId ? !currentSolo : false,
          };
        }
        return next;
      });
    },
    [stemAssets]
  );

  const applyStudioDetail = useCallback((detail: StudioDetail) => {
    const nextDetail = toStudioDetail(detail);
    setSong(nextDetail.song);
    setAssets(nextDetail.assets);
    setAnalysisResults(nextDetail.analysisResults);
    setLyrics(nextDetail.lyrics);
    setLyricsDraft(nextDetail.lyrics.find((item) => item.lyrics_type === 'plain')?.content ?? '');
    setStemMix((current) => ensureStemMix(nextDetail.assets, current));
  }, []);

  useEffect(() => {
    if (!songId || signablePlaybackAssets.length === 0) {
      const timer = window.setTimeout(() => {
        setAudioUrl(null);
        setStemUrls({});
        setStemSignError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      async function resolveSignedUrls() {
        const urlByAssetId = new Map<string, string>();
        const missingAssetIds: string[] = [];

        for (const asset of signablePlaybackAssets) {
          const cached = getCachedSignedAssetUrl(asset.id);
          if (cached) {
            urlByAssetId.set(asset.id, cached);
          } else {
            missingAssetIds.push(asset.id);
          }
        }

        if (missingAssetIds.length > 0) {
          const signedUrls = await signDownloads(songId, missingAssetIds);
          if (cancelled) {
            return;
          }
          setCachedSignedAssetUrls(signedUrls);
          for (const signedUrl of signedUrls) {
            urlByAssetId.set(signedUrl.assetId, signedUrl.signedUrl);
          }
        }

        if (cancelled) {
          return;
        }

        const nextStemUrls: Record<string, string> = {};
        for (const asset of playableStemAssets) {
          const url = urlByAssetId.get(asset.id);
          if (url) {
            nextStemUrls[asset.id] = url;
          }
        }

        setAudioUrl(sourceAsset ? urlByAssetId.get(sourceAsset.id) ?? null : null);
        setStemUrls(nextStemUrls);
        setStemSignError(null);
      }

      void resolveSignedUrls().catch((signError) => {
        if (!cancelled) {
          setAudioUrl(null);
          setStemUrls({});
          setStemSignError(signError instanceof Error ? signError.message : 'Could not sign playback audio');
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [playableStemAssets, setCachedSignedAssetUrls, signablePlaybackAssets, songId, sourceAsset]);

  // Tracks the most recently requested song so an awaited IndexedDB/network
  // result is discarded if the user navigated to a different song meanwhile.
  const loadRequestRef = useRef<string | null>(null);
  // Last-seen set of server-active stages, so a poll tick can detect when a
  // reconnected job settled and pull its fresh artifacts exactly once.
  const prevActiveStagesRef = useRef<ReadonlySet<string>>(new Set<string>());
  // Job ids whose /sync advance is in flight, so overlapping poll ticks don't
  // double-fire (the server also single-finalizes via an atomic claim).
  const syncingJobsRef = useRef<Set<string>>(new Set<string>());

  const persistActiveStudioDetail = useCallback((targetSongId: string) => {
    const detail = useWereCodeDataCache.getState().studioBySongId[targetSongId]?.detail;
    if (detail) {
      void putStoredStudioDetail(targetSongId, detail);
    }
  }, []);

  const loadStudio = useCallback(
    async (nextSongId: string, options?: { force?: boolean }) => {
      setError(null);
      const selectedSongId = nextSongId;
      loadRequestRef.current = selectedSongId;
      setSongId(selectedSongId);

      if (!selectedSongId) {
        setSong(null);
        setAssets([]);
        setAnalysisResults([]);
        setLyrics([]);
        setLyricsDraft('');
        setAudioUrl(null);
        setStemUrls({});
        setStemMix({});
        setStemSignError(null);
        setLoading(false);
        return;
      }

      const force = options?.force ?? false;

      // 1) Warm in-session cache — instant, no await.
      const liveDetail = force ? null : useWereCodeDataCache.getState().studioBySongId[selectedSongId]?.detail;
      if (liveDetail) {
        applyStudioDetail(liveDetail);
        setLoading(false);
        return;
      }

      // 2) Durable IndexedDB tier — survives reload. Paint immediately when
      //    present; revalidate over the network only when stale or forced.
      let paintedFromDisk = false;
      if (!force) {
        const stored = await getStoredStudioDetail(selectedSongId).catch(() => null);
        if (loadRequestRef.current !== selectedSongId) {
          return;
        }
        if (stored) {
          setCachedStudioDetail(selectedSongId, stored.detail);
          applyStudioDetail(stored.detail);
          setLoading(false);
          paintedFromDisk = true;
          if (Date.now() - stored.loadedAt < STUDIO_DETAIL_TTL_MS) {
            return;
          }
        }
      }

      // 3) Network. Show the spinner only when nothing was painted from disk.
      if (!paintedFromDisk) {
        setLoading(true);
      }
      try {
        const detail = await fetchJson<StudioDetail>(`/api/studio/${selectedSongId}`);
        if (loadRequestRef.current !== selectedSongId) {
          return;
        }
        setCachedStudioDetail(selectedSongId, detail);
        applyStudioDetail(detail);
        persistActiveStudioDetail(selectedSongId);
      } catch (loadError) {
        if (loadRequestRef.current !== selectedSongId) {
          return;
        }
        // A failed background revalidation keeps the disk copy on screen.
        if (!paintedFromDisk) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load studio');
        }
      } finally {
        if (loadRequestRef.current === selectedSongId) {
          setLoading(false);
        }
      }
    },
    [applyStudioDetail, persistActiveStudioDetail, setCachedStudioDetail]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStudio(initialSongId ?? '');
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialSongId, loadStudio]);

  // Reload reconnect: reflect any workflow that was still queued/processing on the
  // server (started before a reload, or in another tab) and poll until it settles,
  // then pull the fresh artifacts. Bounded; stops once nothing is active. Phase 2
  // replaces this poll with a Supabase Realtime subscription on `jobs`.
  useEffect(() => {
    if (!songId) {
      // No song selected: leave the stale set in place (the memo below ignores it
      // when there is no song; the next song's first poll overwrites it).
      prevActiveStagesRef.current = new Set<string>();
      return;
    }

    const jobTypeToStage: Record<string, string> = {
      analyze: 'Analysis',
      separate: 'Stem separation',
      lyrics_fetch: 'Lyrics fetch',
      lyrics_align: 'Lyrics alignment',
      midi_transcribe: 'MIDI transcription',
    };

    let cancelled = false;
    let timer: number | undefined;
    let ticks = 0;
    const MAX_TICKS = 120; // ~8 min ceiling at 4s — guards a job that never settles.
    const POLL_MS = 4000;

    prevActiveStagesRef.current = new Set<string>();

    const syncJob = async (jobId: string) => {
      if (syncingJobsRef.current.has(jobId)) {
        return;
      }
      syncingJobsRef.current.add(jobId);
      try {
        // Advance one async job server-side: poll the Modal gateway and finalize
        // when ready. No-ops for synchronous jobs (no Modal call id); the next poll
        // tick reflects the new status.
        await fetchJson(`/api/jobs/${jobId}/sync`, { method: 'POST' });
      } catch {
        // Best-effort; the next tick retries.
      } finally {
        syncingJobsRef.current.delete(jobId);
      }
    };

    const poll = async () => {
      let active: Set<string>;
      try {
        const payload = await fetchJson<{ jobs: Array<{ id: string; job_type: string; status: string }> }>(
          `/api/jobs?songId=${songId}&limit=20`
        );
        if (cancelled) {
          return;
        }
        const activeJobs = payload.jobs.filter((job) => job.status === 'queued' || job.status === 'processing');
        active = new Set(
          activeJobs.map((job) => jobTypeToStage[job.job_type]).filter((stage): stage is string => Boolean(stage))
        );
        // Drive async completion: ask the server to advance each in-flight job.
        for (const job of activeJobs) {
          void syncJob(job.id);
        }
      } catch {
        // Best-effort: keep the prior view and retry next tick.
        if (!cancelled && ticks < MAX_TICKS) {
          ticks += 1;
          timer = window.setTimeout(() => void poll(), POLL_MS);
        }
        return;
      }

      const prev = prevActiveStagesRef.current;
      const settled = [...prev].some((stage) => !active.has(stage));
      prevActiveStagesRef.current = active;
      setReconnectingStages(active);
      if (settled) {
        // A reconnected job finished — pull its artifacts into the bundle.
        void loadStudio(songId, { force: true });
      }

      if (!cancelled && active.size > 0 && ticks < MAX_TICKS) {
        ticks += 1;
        timer = window.setTimeout(() => void poll(), POLL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [songId, loadStudio, jobPollNonce]);

  useEffect(() => {
    const onToggleCoach = () => setCoachOpen((open) => !open);
    window.addEventListener('werecode:toggle-coach', onToggleCoach);
    return () => window.removeEventListener('werecode:toggle-coach', onToggleCoach);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('coach') === '1') {
      const timer = window.setTimeout(() => setCoachOpen(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  // Per-stage run tracking: stages run concurrently, so we track the set of
  // in-flight stage names instead of a single "is anything running" flag. Each
  // stage's controls disable only while that stage itself is running.
  const beginStage = (name: string) =>
    setRunning((current) => {
      if (current.has(name)) {
        return current;
      }
      const next = new Set(current);
      next.add(name);
      return next;
    });
  const finishStage = (name: string) =>
    setRunning((current) => {
      if (!current.has(name)) {
        return current;
      }
      const next = new Set(current);
      next.delete(name);
      return next;
    });

  async function runWorkflow(name: string, endpoint: string, payload: Record<string, unknown>) {
    if (!song) {
      setError('Select a song first');
      return;
    }

    beginStage(name);
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
      const nextSongId = song.id;
      if (result.song) {
        const songSummary = toSongSummary(result.song);
        setSong(songSummary);
        patchCachedStudioSong(songSummary);
      }
      if (result.job) {
        upsertCachedJob(result.job);
      }
      const assetSummaries = (result.assets ?? []).map(toAssetSummary);
      if (assetSummaries.length > 0) {
        const nextAssets = mergeById(assets, assetSummaries).sort(sortAssetsByCreatedAt);
        setAssets(nextAssets);
        upsertCachedStudioAssets(nextSongId, assetSummaries);
        for (const asset of assetSummaries) {
          if (asset.song_id) {
            upsertCachedAssetForSong(asset.song_id, asset);
          }
        }
        setStemMix((current) => ensureStemMix(nextAssets, current));
      }
      if (result.analysisResults?.length) {
        const nextAnalysisResults = mergeById(analysisResults, result.analysisResults).sort(sortAnalysisResultsByCreatedAt);
        setAnalysisResults(nextAnalysisResults);
        setCachedStudioAnalysisResults(nextSongId, nextAnalysisResults);
      }
      const incomingLyrics = normalizeLyricsPayload(result.lyrics);
      if (incomingLyrics.length > 0) {
        const nextLyrics = mergeById(lyrics, incomingLyrics).sort(sortLyricsByUpdatedAt);
        setLyrics(nextLyrics);
        setCachedStudioLyrics(nextSongId, nextLyrics);
        const nextPlainLyrics = nextLyrics.find((item) => item.lyrics_type === 'plain');
        if (nextPlainLyrics) {
          setLyricsDraft(nextPlainLyrics.content ?? '');
        }
      }
      // Mirror the patched bundle to the durable tier so a reload reflects the
      // workflow result without re-reading from Supabase.
      persistActiveStudioDetail(nextSongId);

      if (jobStatus === 'failed') {
        setError(result.job?.error_message ?? `${name} failed`);
        setMessage(null);
      } else {
        setMessage(
          jobStatus === 'processing'
            ? `${name} is still processing`
            : `${name} completed${result.assets?.length ? ` with ${result.assets.length} artifact(s)` : ''}`
        );
      }

      if (jobStatus === 'processing') {
        // Async enqueue accepted by Modal: keep this stage shown busy (it would
        // otherwise flicker idle when the fast enqueue resolves) and (re)start the
        // job poll so it is advanced to completion mid-session.
        setReconnectingStages((current) => {
          if (current.has(name)) {
            return current;
          }
          const next = new Set(current);
          next.add(name);
          return next;
        });
        setJobPollNonce((nonce) => nonce + 1);
      }
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : `${name} failed`);
    } finally {
      finishStage(name);
    }
  }

  async function openAsset(asset: AssetSummary) {
    setError(null);
    try {
      if (!asset.song_id) {
        throw new Error('Asset is not attached to a song');
      }
      let signed = getCachedSignedAssetUrl(asset.id);
      if (!signed) {
        const [signedAssetUrl] = await signDownloads(asset.song_id, [asset.id]);
        if (!signedAssetUrl) {
          throw new Error('Could not sign asset URL');
        }
        setCachedSignedAssetUrls([signedAssetUrl]);
        signed = signedAssetUrl.signedUrl;
      }
      window.open(signed, '_blank', 'noopener,noreferrer');
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : 'Could not sign asset URL');
    }
  }

  async function savePlainLyrics(payload?: EditorLyricsSavePayload) {
    if (!song) {
      setError('Select a song first');
      return;
    }

    beginStage('Save lyrics');
    setError(null);
    setMessage(null);

    try {
      const savedRows: LyricsRow[] = [];
      const plainContent = payload?.plainContent ?? lyricsDraft;
      const plainResult = await fetchJson<SaveLyricsResult>('/api/lyrics/save', {
        method: 'POST',
        body: JSON.stringify({
          song_id: song.id,
          lyrics_type: 'plain',
          source: 'user',
          content: plainContent,
        }),
      });

      if (plainResult.lyrics) {
        savedRows.push(plainResult.lyrics);
      }

      const lrcContent = payload?.lrcContent;
      const lrcResult = lrcContent
        ? await fetchJson<SaveLyricsResult>('/api/lyrics/save', {
            method: 'POST',
            body: JSON.stringify({
              song_id: song.id,
              lyrics_type: 'lrc',
              source: 'user:lyrics-editor',
              content: lrcContent,
            }),
          })
        : null;

      if (lrcResult?.lyrics) {
        savedRows.push(lrcResult.lyrics);
      }

      const updatedSong = lrcResult?.song ?? plainResult.song;
      if (updatedSong) {
        const songSummary = toSongSummary(updatedSong);
        setSong(songSummary);
        patchCachedStudioSong(songSummary);
      }
      if (savedRows.length > 0) {
        const nextLyrics = mergeById(lyrics, savedRows).sort(sortLyricsByUpdatedAt);
        setLyrics(nextLyrics);
        setCachedStudioLyrics(song.id, nextLyrics);
        setLyricsDraft(plainResult.lyrics?.content ?? plainContent);
      }
      persistActiveStudioDetail(song.id);
      setMessage('Lyrics saved');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save lyrics');
      throw saveError;
    } finally {
      finishStage('Save lyrics');
    }
  }

  const workflowActions = {
    analyze: (options?: { force?: boolean; analyzers?: readonly string[] }) => {
      // Depth toggle drives the analyzer set: full sends the explicit list
      // (incl. chords + structure); quick uses the cheap preset.
      const analyzers = options?.analyzers ?? (analyzeDepth === 'full' ? ANALYZE_FULL_ANALYZERS : undefined);
      return (
        sourceAsset &&
        runWorkflow('Analysis', '/api/workflows/analyze', {
          source_asset_id: sourceAsset.id,
          ...(analyzers ? { analyzers } : { preset: 'quick' }),
          ...(options?.force ? { force: true } : {}),
        })
      );
    },
    stems: (options?: { force?: boolean }) =>
      sourceAsset &&
      runWorkflow('Stem separation', '/api/workflows/separate', {
        source_asset_id: sourceAsset.id,
        stems: ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano'],
        model: 'htdemucs_6s',
        shifts: 2,
        output_format: DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT,
        ...(options?.force ? { force: true } : {}),
      }),
    lyricsFetch: () => runWorkflow('Lyrics fetch', '/api/workflows/lyrics/fetch', {}),
    lyricsAlign: (options?: { force?: boolean }) =>
      (vocalAsset ?? sourceAsset) &&
      runWorkflow('Lyrics alignment', '/api/workflows/lyrics/align', {
        source_asset_id: (vocalAsset ?? sourceAsset)!.id,
        known_lyrics: (plainLyrics?.content ?? lyricsDraft) || undefined,
        ...(options?.force ? { force: true } : {}),
      }),
    midi: (options?: { force?: boolean }) =>
      (sourceAsset ?? vocalAsset) &&
      runWorkflow('MIDI transcription', '/api/workflows/midi/transcribe', {
        source_asset_id: (sourceAsset ?? vocalAsset)!.id,
        stem_name: vocalAsset ? 'vocals' : undefined,
        ...(options?.force ? { force: true } : {}),
      }),
    musicXml: () =>
      noteEventsAsset &&
      runWorkflow('MusicXML conversion', '/api/workflows/midi/convert-musicxml', {
        note_events_asset_id: noteEventsAsset.id,
        title: song?.title,
      }),
  };

  // Union of locally in-flight stages and server-observed in-flight stages; this
  // is the busy-state every stage control reads from.
  const runningStages = useMemo(
    () =>
      !songId || reconnectingStages.size === 0
        ? running
        : new Set<string>([...running, ...reconnectingStages]),
    [running, reconnectingStages, songId]
  );

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-visible pb-0 md:overflow-hidden">
      {!song && !loading ? (
        <StudioPicker />
      ) : (
        <div className="relative flex min-h-0 flex-1 gap-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <SongHeader
              song={song}
              songId={songId}
              facts={facts}
              loading={loading}
              onRefresh={() => void loadStudio(songId, { force: true })}
            />

            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <StudioModeTabs activeTab={tab} onChange={changeTab} />
              {sourceAsset && (
                <AnalysisControl
                  depth={analyzeDepth}
                  onDepthChange={setAnalyzeDepth}
                  hasAnalysis={analysisResults.length > 0}
                  stale={staleStages.has('analyze')}
                  running={runningStages}
                  onRun={() => void workflowActions.analyze()}
                  onRerun={() => void workflowActions.analyze({ force: true })}
                />
              )}
            </div>

            <div className="mb-3 min-h-[26px]">
              {(message || error) && (
                <span className={`chip ${error ? 'danger' : 'live'}`}>
                  {error ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                  {error ?? message}
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1">
              {tab === 'karaoke' && (
                <KaraokeProductView
                  currentTime={transportTime}
                  lyrics={lyricLines}
                  syncedLyrics={syncedLyrics}
                  plainLyrics={plainLyrics}
                  stemAssets={playableStemAssets}
                  stemMix={stemMix}
                  stemUrls={stemUrls}
                  stemSignError={stemSignError}
                  sourceAsset={sourceAsset}
                  stemSeparationWarning={stemSeparationWarning}
                  analysisResults={analysisResults}
                  running={runningStages}
                  onUpdateStemMix={updateStemMix}
                  onPreviewStemLevel={previewStemLevel}
                  onSoloStem={soloStem}
                  onOpenAsset={(asset) => void openAsset(asset)}
                  onRunStems={() => void workflowActions.stems()}
                  onRunAnalyze={() => void workflowActions.analyze()}
                  onFetchLyrics={() => void workflowActions.lyricsFetch()}
                  onAlignLyrics={() => void workflowActions.lyricsAlign()}
                  onEditLyrics={() => changeTab('lyrics')}
                  onSeekLyric={(time) => requestTransportSeek(time - 0.35)}
                  stemsStale={staleStages.has('separate')}
                  onRerunStems={() => void workflowActions.stems({ force: true })}
                  lyricsStale={staleStages.has('lyrics_align')}
                  onRerunLyrics={() => void workflowActions.lyricsAlign({ force: true })}
                />
              )}
              {tab === 'guitar' && (
                <GuitarLearnerView
                  currentTime={transportTime}
                  musicXmlAsset={musicXmlAsset}
                  tabAsset={tabAsset}
                  noteEventsAsset={noteEventsAsset}
                  sourceAsset={sourceAsset}
                  running={runningStages}
                  onOpenAsset={(asset) => void openAsset(asset)}
                  onRunMidi={() => void workflowActions.midi()}
                  onRunMusicXml={() => void workflowActions.musicXml()}
                  midiStale={staleStages.has('midi_transcribe')}
                  onRerunMidi={() => void workflowActions.midi({ force: true })}
                />
              )}
              {tab === 'lyrics' && (
                <LyricsEditorProductView
                  key={`${song?.id ?? 'song'}:${syncedLyrics?.id ?? 'no-sync'}:${syncedLyrics?.updated_at ?? ''}:${plainLyrics?.id ?? 'no-plain'}:${plainLyrics?.updated_at ?? ''}`}
                  lyricsDraft={lyricsDraft}
                  syncedLyrics={syncedLyrics}
                  plainLyrics={plainLyrics}
                  currentTime={transportTime}
                  playing={transportPlaying}
                  running={runningStages}
                  onLyricsDraftChange={setLyricsDraft}
                  onSave={savePlainLyrics}
                  onFetchLyrics={() => void workflowActions.lyricsFetch()}
                  onAlignLyrics={() => void workflowActions.lyricsAlign()}
                  onSeek={(time) => requestTransportSeek(time - 0.35)}
                  onTogglePlayback={requestPlaybackToggle}
                  canAlign={Boolean(vocalAsset ?? sourceAsset)}
                  lyricsStale={staleStages.has('lyrics_align')}
                  onRerunLyrics={() => void workflowActions.lyricsAlign({ force: true })}
                />
              )}
            </div>
            <div className="mt-4 shrink-0">
              <TransportCard
                song={song}
                audioUrl={audioUrl}
                stemSources={stemPlaybackSources}
                seekCommand={seekCommand}
                playbackCommand={playbackCommand}
                minimized={transportMinimized}
                onMinimizedChange={setTransportMinimized}
                onTimeChange={setTransportTime}
                onPlayingChange={setTransportPlaying}
                sections={sectionSegments}
                analyzing={runningStages.has('Analysis')}
                onRunAnalyze={sourceAsset ? () => void workflowActions.analyze() : undefined}
              />
            </div>
          </div>

          {coachOpen && (
            <AICoachDock
              context={tab}
              song={song}
              syncedLyrics={syncedLyrics}
              musicXmlAsset={musicXmlAsset}
              onClose={() => setCoachOpen(false)}
            />
          )}
        </div>
      )}
    </section>
  );
}

function SongHeader({
  song,
  songId,
  facts,
  loading,
  onRefresh,
}: {
  song: SongSummary | null;
  songId: string;
  facts: Array<[string, string]>;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(300px,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/app/library" className="iconbtn shrink-0" title="Back to library">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <CoverArt id={song?.id ?? songId} size={52} />
        <div className="min-w-0">
          <h1 className="display truncate text-[26px]">{song?.title ?? 'Studio'}</h1>
          <div className="mt-1 truncate text-[13.5px] text-[var(--muted)]">{song ? song.artist ?? 'Unknown artist' : 'Select a song'}</div>
        </div>
      </div>

      <div className="hidden flex-wrap items-center justify-end gap-4 md:flex">
        <button
          type="button"
          onClick={onRefresh}
          disabled={!songId || loading}
          className="iconbtn h-9 w-9"
          aria-label="Refresh studio"
          title="Refresh studio"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
        {facts.map(([label, value]) => (
          <div key={label} className="border-l border-[var(--line)] pl-4 text-right">
            <div className="label text-[9.5px]">{label}</div>
            <div className="mono mt-1 text-sm font-bold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudioModeTabs({ activeTab, onChange }: { activeTab: StudioTab; onChange: (tab: StudioTab) => void }) {
  return (
    <div className="flex min-w-0">
      <div className="flex max-w-full flex-wrap items-center gap-2" role="tablist" aria-label="Studio mode">
        {studioTabs.map(([id, label, Icon]) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-bold transition ${
                active
                  ? 'shadow-none'
                  : 'bg-transparent text-[var(--muted)] shadow-[inset_0_0_0_1.5px_var(--line)] hover:bg-[var(--card)] hover:text-[var(--ink)]'
              }`}
              style={active ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === 'lyrics' && <span className="chip accent min-h-[18px] px-2 text-[10px]">flagship</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Quiet-by-default stage run/re-run button. Flips to an accent "new model"
// treatment (soft fill + pulse dot) only when the current output is stale.
function PipelineActionButton({
  label,
  idleIcon,
  busy,
  stale,
  disabled,
  onClick,
  title,
}: {
  label: string;
  idleIcon: ReactNode;
  busy: boolean;
  stale: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="pill ghost sm"
      style={stale && !busy ? { background: 'var(--accent-soft)', boxShadow: 'none', color: 'var(--accent-ink)' } : undefined}
    >
      <PillIcon>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : idleIcon}</PillIcon>
      {label}
      {stale && !busy && <span className="pulse h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden />}
    </button>
  );
}

// Studio-level Analysis control: depth segment + a single run/re-run action.
// Lives on the mode-tabs row because analysis feeds the transport, chords, and facts.
function AnalysisControl({
  depth,
  onDepthChange,
  hasAnalysis,
  stale,
  running,
  onRun,
  onRerun,
}: {
  depth: AnalyzeDepth;
  onDepthChange: (depth: AnalyzeDepth) => void;
  hasAnalysis: boolean;
  stale: boolean;
  running: ReadonlySet<string>;
  onRun: () => void;
  onRerun: () => void;
}) {
  const busy = running.has('Analysis');
  return (
    <div className="flex items-center gap-2.5">
      <span className="label">Analysis</span>
      <div
        className="segment"
        role="group"
        aria-label="Analysis depth"
        style={{ background: 'var(--card)', boxShadow: 'inset 0 0 0 1.5px var(--line)', padding: 4 }}
      >
        {(['quick', 'full'] as const).map((value) => {
          const active = depth === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onDepthChange(value)}
              className={`capitalize ${active ? 'on' : ''}`}
              style={active ? { background: 'var(--ink)', color: 'var(--paper)', height: 30 } : { color: 'var(--muted)', height: 30 }}
              title={value === 'quick' ? 'Quick: tempo, key, basics (fast)' : 'Full: adds chords + structure (slower)'}
            >
              {value}
            </button>
          );
        })}
      </div>
      <PipelineActionButton
        label={busy ? 'Analyzing' : hasAnalysis ? 'Re-run' : 'Analyze'}
        idleIcon={hasAnalysis ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        busy={busy}
        stale={stale && hasAnalysis}
        disabled={running.has('Analysis')}
        onClick={hasAnalysis ? onRerun : onRun}
        title={
          hasAnalysis
            ? stale
              ? `Newer analysis model available — re-run (${depth})`
              : `Re-run analysis (${depth})`
            : `Run ${depth} analysis`
        }
      />
    </div>
  );
}

function KaraokeProductView({
  currentTime,
  lyrics,
  syncedLyrics,
  plainLyrics,
  stemAssets,
  stemMix,
  stemUrls,
  stemSignError,
  sourceAsset,
  stemSeparationWarning,
  analysisResults,
  running,
  onUpdateStemMix,
  onPreviewStemLevel,
  onSoloStem,
  onOpenAsset,
  onRunStems,
  onRunAnalyze,
  onFetchLyrics,
  onAlignLyrics,
  onEditLyrics,
  onSeekLyric,
  stemsStale,
  onRerunStems,
  lyricsStale,
  onRerunLyrics,
}: {
  currentTime: number;
  lyrics: LyricDisplayLine[];
  syncedLyrics: LyricsRow | undefined;
  plainLyrics: LyricsRow | undefined;
  stemAssets: AssetSummary[];
  stemMix: Record<string, StemMixState>;
  stemUrls: Record<string, string>;
  stemSignError: string | null;
  sourceAsset: AssetSummary | undefined;
  stemSeparationWarning: string | null;
  analysisResults: AnalysisResultRow[];
  running: ReadonlySet<string>;
  onUpdateStemMix: (assetId: string, patch: Partial<StemMixState>) => void;
  onPreviewStemLevel: (assetId: string, level: number) => void;
  onSoloStem: (assetId: string) => void;
  onOpenAsset: (asset: AssetSummary) => void;
  onRunStems: () => void;
  onRunAnalyze: () => void;
  onFetchLyrics: () => void;
  onAlignLyrics: () => void;
  onEditLyrics: () => void;
  onSeekLyric: (time: number) => void;
  stemsStale: boolean;
  onRerunStems: () => void;
  lyricsStale: boolean;
  onRerunLyrics: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.55fr)]">
        <div className="grid min-h-[360px] gap-4 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_76px]">
          <StemsPanel
            stemAssets={stemAssets}
            stemMix={stemMix}
            stemUrls={stemUrls}
            stemSignError={stemSignError}
            sourceAsset={sourceAsset}
            stemSeparationWarning={stemSeparationWarning}
            running={running}
            onUpdateStemMix={onUpdateStemMix}
            onPreviewStemLevel={onPreviewStemLevel}
            onSoloStem={onSoloStem}
            onOpenAsset={onOpenAsset}
            onRunStems={onRunStems}
            stale={stemsStale}
            onRerun={onRerunStems}
          />
          <CurrentChordPanel currentTime={currentTime} analysisResults={analysisResults} running={running} onRunAnalyze={onRunAnalyze} />
        </div>
        <LyricsPane
          currentTime={currentTime}
          lines={lyrics}
          syncedLyrics={syncedLyrics}
          plainLyrics={plainLyrics}
          running={running}
          onFetchLyrics={onFetchLyrics}
          onAlignLyrics={onAlignLyrics}
          onEditLyrics={onEditLyrics}
          onSeekLyric={onSeekLyric}
          lyricsStale={lyricsStale}
          onRerunLyrics={onRerunLyrics}
        />
      </div>
    </div>
  );
}

function StemsPanel({
  stemAssets,
  stemMix,
  stemUrls,
  stemSignError,
  sourceAsset,
  stemSeparationWarning,
  running,
  onUpdateStemMix,
  onPreviewStemLevel,
  onSoloStem,
  onOpenAsset,
  onRunStems,
  stale,
  onRerun,
}: {
  stemAssets: AssetSummary[];
  stemMix: Record<string, StemMixState>;
  stemUrls: Record<string, string>;
  stemSignError: string | null;
  sourceAsset: AssetSummary | undefined;
  stemSeparationWarning: string | null;
  running: ReadonlySet<string>;
  onUpdateStemMix: (assetId: string, patch: Partial<StemMixState>) => void;
  onPreviewStemLevel: (assetId: string, level: number) => void;
  onSoloStem: (assetId: string) => void;
  onOpenAsset: (asset: AssetSummary) => void;
  onRunStems: () => void;
  stale: boolean;
  onRerun: () => void;
}) {
  const anySolo = Object.values(stemMix).some((state) => state.solo);

  return (
    <section className="surface flex min-h-[278px] flex-col overflow-hidden p-4 lg:min-h-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--muted)]" />
          <h2 className="font-bold">Stems</h2>
        </div>
        {stemAssets.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="chip">{Object.keys(stemUrls).length === stemAssets.length ? 'live mix' : 'signing'}</span>
            <PipelineActionButton
              label="Re-run"
              idleIcon={<RefreshCw className="h-3.5 w-3.5" />}
              busy={running.has('Stem separation')}
              stale={stale}
              disabled={!sourceAsset || running.has('Stem separation') || Boolean(stemSeparationWarning)}
              onClick={onRerun}
              title={stale ? 'Newer stem model available — re-separate' : 'Re-separate stems with the latest model'}
            />
          </div>
        )}
      </div>
      {stemSignError && <div className="chip danger mb-2 w-fit">{stemSignError}</div>}
      {stemSeparationWarning && <div className="chip danger mb-2 w-fit">{stemSeparationWarning}</div>}

      {stemAssets.length > 0 ? (
        <div className="grid flex-1 content-center gap-1.5">
          {stemAssets.map((asset) => {
            const state = stemMix[asset.id] ?? defaultStemMix(asset);
            const isMuted = state.muted;
            const isSolo = state.solo;
            const silenced = isMuted || (anySolo && !isSolo);
            const level = state.level;
            const color = stemColors[asset.kind] ?? 'var(--accent)';
            return (
              <div key={asset.id} className={`grid grid-cols-[86px_1fr_auto] items-center gap-3 ${silenced ? 'opacity-45' : ''}`}>
                <button type="button" onClick={() => onOpenAsset(asset)} className="min-w-0 text-left">
                  <span className="flex items-center gap-2 truncate text-[13px] font-bold leading-4">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                    {stemLabel(asset.kind)}
                  </span>
                  <span className="mono block text-[9px] leading-3 text-[var(--faint)]">{formatBytes(asset.byte_size)}</span>
                </button>
                <div className="relative h-6">
                  <StemLevelControl
                    assetId={asset.id}
                    label={stemLabel(asset.kind)}
                    level={level}
                    color={color}
                    silenced={silenced}
                    onPreview={(nextLevel) => onPreviewStemLevel(asset.id, nextLevel)}
                    onChange={(nextLevel) => onUpdateStemMix(asset.id, { level: nextLevel })}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateStemMix(asset.id, { muted: !isMuted })}
                    aria-label={`Mute ${stemLabel(asset.kind)}`}
                    aria-pressed={isMuted}
                    data-active={isMuted || undefined}
                    className={`grid h-7 w-7 place-items-center rounded-[8px] text-xs font-black ${
                      isMuted
                        ? 'bg-[var(--danger)] text-white shadow-[0_0_0_2px_oklch(0.55_0.16_28_/_0.18)]'
                        : 'bg-[var(--paper-2)] text-[var(--faint)]'
                    }`}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => onSoloStem(asset.id)}
                    aria-label={`Solo ${stemLabel(asset.kind)}`}
                    aria-pressed={isSolo}
                    data-active={isSolo || undefined}
                    className={`grid h-7 w-7 place-items-center rounded-[8px] text-xs font-black ${
                      isSolo
                        ? 'bg-[var(--accent)] text-white shadow-[0_0_0_2px_var(--accent-soft)]'
                        : 'bg-[var(--paper-2)] text-[var(--faint)]'
                    }`}
                    title="Solo"
                  >
                    S
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Scissors className="h-6 w-6" />}
          title="Stems not extracted"
          desc="Separate this track into vocals, guitar, bass, drums, and other parts to mix or isolate practice layers."
          ctas={[
            {
              label: running.has('Stem separation') ? 'Extracting' : 'Extract stems',
              icon: running.has('Stem separation') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />,
              disabled: !sourceAsset || running.has('Stem separation') || Boolean(stemSeparationWarning),
              onClick: onRunStems,
            },
          ]}
        />
      )}
    </section>
  );
}

function StemLevelControl({
  assetId,
  label,
  level,
  color,
  silenced,
  onPreview,
  onChange,
}: {
  assetId: string;
  label: string;
  level: number;
  color: string;
  silenced: boolean;
  onPreview: (level: number) => void;
  onChange: (level: number) => void;
}) {
  const trackRef = useRef<HTMLButtonElement | null>(null);
  const draggingRef = useRef(false);
  const draftLevelRef = useRef(level);
  const [draftLevel, setDraftLevel] = useState(level);

  useEffect(() => {
    if (!draggingRef.current) {
      draftLevelRef.current = level;
      setDraftLevel(level);
    }
  }, [level]);

  const previewLevel = useCallback(
    (nextLevel: number) => {
      const clamped = Math.min(100, Math.max(0, nextLevel));
      draftLevelRef.current = clamped;
      setDraftLevel(clamped);
      onPreview(clamped);
    },
    [onPreview]
  );

  const commitLevel = useCallback(
    (nextLevel: number) => {
      const clamped = Math.min(100, Math.max(0, nextLevel));
      draftLevelRef.current = clamped;
      setDraftLevel(clamped);
      onPreview(clamped);
      onChange(clamped);
    },
    [onChange, onPreview]
  );

  const commitDraft = useCallback(() => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    onChange(draftLevelRef.current);
  }, [onChange]);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) {
        return;
      }
      const rect = track.getBoundingClientRect();
      const next = Math.round(((clientX - rect.left) / rect.width) * 100);
      previewLevel(next);
    },
    [previewLevel]
  );

  return (
    <button
      ref={trackRef}
      type="button"
      role="slider"
      aria-label={`${label} level`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={draftLevel}
      data-stem-id={assetId}
      data-stem-level={draftLevel}
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.buttons > 0) {
          updateFromClientX(event.clientX);
        }
      }}
      onPointerUp={commitDraft}
      onPointerCancel={commitDraft}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          commitLevel(draftLevel - 5);
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          commitLevel(draftLevel + 5);
        } else if (event.key === 'Home') {
          event.preventDefault();
          commitLevel(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          commitLevel(100);
        }
      }}
      className="absolute inset-0 cursor-pointer rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <span className="absolute inset-y-[11px] left-0 right-0 overflow-hidden rounded-full bg-[var(--paper-2)]">
        <span className="block h-full" style={{ width: `${silenced ? 0 : draftLevel}%`, background: color, opacity: 0.55 }} />
      </span>
      <span
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_2px_8px_oklch(0.3_0.02_55_/_0.18)]"
        style={{
          left: `${draftLevel}%`,
          background: color,
          opacity: silenced ? 0.45 : 1,
        }}
      />
    </button>
  );
}

function CurrentChordPanel({
  currentTime,
  analysisResults,
  running,
  onRunAnalyze,
}: {
  currentTime: number;
  analysisResults: AnalysisResultRow[];
  running: ReadonlySet<string>;
  onRunAnalyze: () => void;
}) {
  const chordEvents = useMemo(() => deriveChordEvents(analysisResults), [analysisResults]);
  const currentIndex = useMemo(() => activeChordIndex(chordEvents, currentTime), [chordEvents, currentTime]);
  const currentChord = currentIndex >= 0 ? chordEvents[currentIndex] : null;
  const nextChord = chordEvents.find((event, index) => index > currentIndex && event.chord !== currentChord?.chord) ?? null;
  const hasAnalysis = analysisResults.length > 0;

  return (
    <section className="surface flex h-[76px] items-center justify-between gap-4 px-5">
      {chordEvents.length > 0 ? (
        <div className="flex min-w-0 items-center gap-4">
          <span className="label shrink-0">Now</span>
          <span className="display min-w-[58px] truncate text-[34px]">{currentChord?.chord ?? '--'}</span>
          {nextChord && <span className="truncate text-base font-bold text-[var(--faint)]">to {nextChord.chord}</span>}
          <span className="chip live hidden sm:inline-flex">chords</span>
        </div>
      ) : !hasAnalysis ? (
        <div className="flex items-center gap-3">
          <span className="label">Chords</span>
          <button type="button" onClick={onRunAnalyze} disabled={running.has('Analysis')} className="pill ghost sm">
            <PillIcon>
              {running.has('Analysis') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
            </PillIcon>
            Detect chords
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-3">
          <span className="label shrink-0">Chords</span>
          <span className="chip accent">analysis ready</span>
          <span className="truncate text-sm font-semibold text-[var(--muted)]">No timed chord track found</span>
        </div>
      )}
      <SlidersHorizontal className="h-5 w-5 shrink-0 text-[var(--muted)]" />
    </section>
  );
}

function LyricsPane({
  currentTime,
  lines,
  syncedLyrics,
  plainLyrics,
  running,
  onFetchLyrics,
  onAlignLyrics,
  onEditLyrics,
  onSeekLyric,
  lyricsStale,
  onRerunLyrics,
}: {
  currentTime: number;
  lines: LyricDisplayLine[];
  syncedLyrics: LyricsRow | undefined;
  plainLyrics: LyricsRow | undefined;
  running: ReadonlySet<string>;
  onFetchLyrics: () => void;
  onAlignLyrics: () => void;
  onEditLyrics: () => void;
  onSeekLyric: (time: number) => void;
  lyricsStale: boolean;
  onRerunLyrics: () => void;
}) {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const activeIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const timestamp = lines[i].timestamp;
      if (timestamp !== null && currentTime >= timestamp) {
        index = i;
      }
    }
    return index;
  }, [currentTime, lines]);

  useEffect(() => {
    if (!autoScroll || activeIndex < 0) {
      return;
    }

    const container = scrollRef.current;
    const activeLine = activeLineRef.current;
    if (!container || !activeLine) {
      return;
    }

    if (activeIndex <= 1) {
      if (container.scrollTop > 0) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const activeCenter = activeLine.offsetTop + activeLine.clientHeight / 2;
    const currentCenter = activeCenter - container.scrollTop;
    const upperFocus = container.clientHeight * 0.28;
    const lowerFocus = container.clientHeight * 0.52;

    if (currentCenter >= upperFocus && currentCenter <= lowerFocus) {
      return;
    }

    const targetFocus = container.clientHeight * 0.42;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const top = Math.min(maxScrollTop, Math.max(0, activeCenter - targetFocus));
    container.scrollTo({ top, behavior: 'smooth' });
  }, [activeIndex, autoScroll]);

  const stateLabel = syncedLyrics
    ? syncedLyrics.lyrics_type === 'lrc'
      ? '.lrc synced'
      : 'alignment synced'
    : plainLyrics
      ? '.txt not timed'
      : 'No lyrics';

  return (
    <section className="surface relative flex min-h-[320px] flex-col overflow-hidden lg:min-h-0">
      {lines.length > 0 && (
        <>
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-[1] h-16 bg-gradient-to-b from-[var(--card)] to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1] h-20 bg-gradient-to-t from-[var(--card)] to-transparent" />
        </>
      )}
      <div className="absolute left-4 right-4 top-3 z-[2] flex items-center justify-between gap-3">
        <span className={syncedLyrics ? 'chip live' : plainLyrics ? 'chip' : 'chip danger'}>
          {syncedLyrics && <Check className="h-3 w-3" />}
          {stateLabel}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {syncedLyrics && lines.length > 0 && (
            <button
              type="button"
              onClick={() => setAutoScroll((enabled) => !enabled)}
              className={`chip ${autoScroll ? 'on' : ''}`}
              aria-pressed={autoScroll}
            >
              <Layers className="h-3.5 w-3.5" />
              Auto-scroll {autoScroll ? 'on' : 'off'}
            </button>
          )}
          {syncedLyrics && (
            <PipelineActionButton
              label="Re-sync"
              idleIcon={<ListMusic className="h-3.5 w-3.5" />}
              busy={running.has('Lyrics alignment')}
              stale={lyricsStale}
              disabled={running.has('Lyrics alignment')}
              onClick={onRerunLyrics}
              title={lyricsStale ? 'Newer alignment model available — re-sync' : 'Re-sync lyrics with the latest model'}
            />
          )}
          {plainLyrics && !syncedLyrics && (
            <button type="button" onClick={onAlignLyrics} disabled={running.has('Lyrics alignment')} className="pill sm">
              <PillIcon>
                {running.has('Lyrics alignment') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListMusic className="h-3.5 w-3.5" />}
              </PillIcon>
              Sync
            </button>
          )}
        </div>
      </div>
      {lines.length > 0 ? (
        <div ref={scrollRef} className="h-full overflow-y-auto px-6 pb-20 pt-14">
          {lines.map((line, index) => {
            const active = index === activeIndex;
            const past = activeIndex >= 0 && index < activeIndex;
            return (
              <button
                ref={active ? activeLineRef : undefined}
                key={line.id}
                type="button"
                data-lyric-time={line.timestamp ?? undefined}
                data-seek-target={line.timestamp !== null ? Math.max(0, line.timestamp - 0.35) : undefined}
                onClick={() => {
                  if (line.timestamp !== null) {
                    onSeekLyric(line.timestamp);
                  }
                }}
                className="display mx-auto block w-fit max-w-full px-4 py-1 text-center transition"
                title={line.timestamp !== null ? `Seek to ${formatSeconds(line.timestamp)}` : undefined}
                style={{
                  fontSize: active ? 'clamp(22px,2vw,30px)' : 'clamp(17px,1.45vw,22px)',
                  lineHeight: 1.14,
                  color: active ? 'var(--ink)' : past ? 'var(--faint)' : 'var(--muted)',
                  opacity: active ? 1 : past ? 0.68 : 0.52,
                }}
              >
                {renderLyricWords(line.text)}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Type className="h-6 w-6" />}
          title="No lyrics yet"
          desc="Fetch lyrics from the provider, or write and time them in the editor."
          ctas={[
            {
              label: running.has('Lyrics fetch') ? 'Fetching' : 'Fetch lyrics',
              icon: running.has('Lyrics fetch') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />,
              disabled: running.has('Lyrics fetch'),
              onClick: onFetchLyrics,
            },
            { label: 'Create in editor', icon: <Type className="h-3.5 w-3.5" />, onClick: onEditLyrics, variant: 'ghost' },
          ]}
        />
      )}
    </section>
  );
}

type EngineLoop = { start: number; end: number } | null;
type EngineSource = { id: string; url: string };

const ORIGINAL_SOURCE_ID = '__original__';
const PITCH_CORRECTION_WINDOW_SECONDS = 0.1;
const RATE_CHANGE_DUCK_SECONDS = 0.012;
const RATE_CHANGE_SETTLE_SECONDS = 0.075;
const RATE_CHANGE_FADE_IN_SECONDS = 0.035;
const RATE_CHANGE_SILENT_GAIN = 0.0001;

function pitchCorrectionSemitones(rate: number) {
  return -12 * Math.log2(rate);
}

function setPitchCorrection(pitchShift: PitchShift, semitones: number) {
  pitchShift.pitch = semitones;
}

function wrapLoopOffset(offset: number, loop: NonNullable<EngineLoop>) {
  const length = loop.end - loop.start;
  if (length <= 0) {
    return loop.start;
  }
  return loop.start + ((((offset - loop.start) % length) + length) % length);
}

function clampPlaybackOffset(offset: number, loop: EngineLoop, duration: number) {
  if (loop && loop.end > loop.start) {
    return Math.min(Math.max(offset, loop.start), loop.end - 0.001);
  }
  return Math.max(0, Math.min(offset, duration || offset));
}

function normalizePlaybackPosition(pos: number, loop: EngineLoop, duration: number) {
  if (loop && loop.end > loop.start && pos >= loop.end) {
    return wrapLoopOffset(pos, loop);
  }
  if (!loop && duration > 0 && pos > duration) {
    return duration;
  }
  return pos;
}

/**
 * Sample-accurate multi-stem transport built on a single AudioContext clock.
 *
 * Every stem is decoded to an AudioBuffer and scheduled against one shared
 * `ctx.currentTime` anchor, so the stems can never drift relative to each other.
 * Playback speed still uses AudioBufferSourceNode.playbackRate for reliable
 * clocking and loop behavior. A warmed Tone.PitchShift sits in each source path
 * and applies the inverse correction, so rate-only changes can update in place
 * without rebuilding the DSP window. Per-stem gain feeds a master gain (0-1.5,
 * so >100% boost is possible) into a soft limiter so the boost stays loud
 * without hard-clipping.
 */
/**
 * Module-level cache of decoded PCM keyed by source URL. `AudioBuffer`s are not bound
 * to the `AudioContext` that decoded them, so re-opening the same song reuses them —
 * no re-fetch, no re-decode → playback is ready instantly on revisit (the slow part is
 * `decodeAudioData` over multi-MB FLAC). Bounded by total sample bytes (LRU eviction)
 * so memory stays in check across songs.
 */
const decodedBufferCache = new Map<string, AudioBuffer>();
let decodedBufferCacheBytes = 0;
const DECODED_CACHE_MAX_BYTES = 220 * 1024 * 1024; // ≈ one 4-stem, ~4-min song

function audioBufferBytes(buffer: AudioBuffer) {
  return buffer.length * buffer.numberOfChannels * 4; // f32 samples
}

function cacheDecodedBuffer(url: string, buffer: AudioBuffer) {
  if (decodedBufferCache.has(url)) {
    // Refresh LRU recency without touching the byte total.
    decodedBufferCache.delete(url);
    decodedBufferCache.set(url, buffer);
    return;
  }
  decodedBufferCache.set(url, buffer);
  decodedBufferCacheBytes += audioBufferBytes(buffer);
  while (decodedBufferCacheBytes > DECODED_CACHE_MAX_BYTES && decodedBufferCache.size > 1) {
    const oldestKey: string | undefined = decodedBufferCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    const oldest = decodedBufferCache.get(oldestKey);
    decodedBufferCache.delete(oldestKey);
    if (oldest) {
      decodedBufferCacheBytes -= audioBufferBytes(oldest);
    }
  }
}

function usePlaybackEngine(engineSources: EngineSource[], fallbackDuration: number) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const rateTransitionGainRef = useRef<GainNode | null>(null);
  const buffersRef = useRef(new Map<string, AudioBuffer>());
  const gainNodesRef = useRef(new Map<string, GainNode>());
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const pitchShiftNodesRef = useRef(new Set<PitchShift>());
  const desiredGainRef = useRef(new Map<string, number>());
  const masterVolumeRef = useRef(0.8);
  const rateRef = useRef(1);
  const loopRef = useRef<EngineLoop>(null);
  const startCtxTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const pausedOffsetRef = useRef(0);
  const playingRef = useRef(false);
  const durationRef = useRef(fallbackDuration);
  const rafRef = useRef<number | null>(null);
  const pendingPitchCorrectionTimerRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [decodedCount, setDecodedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);

  const totalCount = engineSources.length;
  const signature = useMemo(() => engineSources.map((source) => `${source.id}::${source.url}`).join('|'), [engineSources]);

  // Reset transport state the instant the stem set changes (React's "adjust state
  // during render" pattern) so the decode effect can stay purely imperative.
  const [renderedSignature, setRenderedSignature] = useState(signature);
  if (renderedSignature !== signature) {
    setRenderedSignature(signature);
    setReady(false);
    setDecodedCount(0);
    setPlaying(false);
    setTime(0);
    setDuration(fallbackDuration);
  }

  const computePosition = useCallback(() => {
    if (!playingRef.current) {
      return pausedOffsetRef.current;
    }
    const ctx = ctxRef.current;
    if (!ctx) {
      return pausedOffsetRef.current;
    }
    const elapsed = Math.max(0, ctx.currentTime - startCtxTimeRef.current) * rateRef.current;
    const pos = startOffsetRef.current + elapsed;
    return normalizePlaybackPosition(pos, loopRef.current, durationRef.current);
  }, []);

  const resetRateTransitionGain = useCallback(() => {
    const ctx = ctxRef.current;
    const node = rateTransitionGainRef.current;
    if (!ctx || !node) {
      return;
    }
    node.gain.cancelScheduledValues(ctx.currentTime);
    node.gain.setValueAtTime(1, ctx.currentTime);
  }, []);

  const scheduleRateTransitionDuck = useCallback((ctx: AudioContext, switchTime: number) => {
    const node = rateTransitionGainRef.current;
    if (!node) {
      return;
    }
    const now = ctx.currentTime;
    const fadeOutEnd = now + RATE_CHANGE_DUCK_SECONDS;
    const fadeInStart = switchTime + RATE_CHANGE_SETTLE_SECONDS;
    const fadeInEnd = fadeInStart + RATE_CHANGE_FADE_IN_SECONDS;
    try {
      node.gain.cancelAndHoldAtTime(now);
    } catch {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
    }
    node.gain.linearRampToValueAtTime(RATE_CHANGE_SILENT_GAIN, fadeOutEnd);
    node.gain.setValueAtTime(RATE_CHANGE_SILENT_GAIN, fadeInStart);
    node.gain.linearRampToValueAtTime(1, fadeInEnd);
  }, []);

  const clearPendingPitchCorrection = useCallback(() => {
    if (pendingPitchCorrectionTimerRef.current != null) {
      window.clearTimeout(pendingPitchCorrectionTimerRef.current);
      pendingPitchCorrectionTimerRef.current = null;
    }
  }, []);

  const schedulePitchCorrectionAt = useCallback(
    (ctx: AudioContext, switchTime: number, semitones: number) => {
      clearPendingPitchCorrection();
      const delayMs = Math.max(0, (switchTime - ctx.currentTime) * 1000);
      pendingPitchCorrectionTimerRef.current = window.setTimeout(() => {
        pendingPitchCorrectionTimerRef.current = null;
        for (const pitchShift of pitchShiftNodesRef.current) {
          setPitchCorrection(pitchShift, semitones);
        }
      }, delayMs);
    },
    [clearPendingPitchCorrection]
  );

  const stopSources = useCallback(() => {
    clearPendingPitchCorrection();
    resetRateTransitionGain();
    for (const source of sourcesRef.current) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
      try {
        source.disconnect();
      } catch {
        // already disconnected
      }
    }
    sourcesRef.current.clear();
    for (const pitchShift of pitchShiftNodesRef.current) {
      pitchShift.dispose();
    }
    pitchShiftNodesRef.current.clear();
  }, [clearPendingPitchCorrection, resetRateTransitionGain]);

  const startSourcesAt = useCallback(
    (offset: number) => {
      const ctx = ctxRef.current;
      if (!ctx || buffersRef.current.size === 0) {
        return;
      }
      stopSources();
      const startOffset = clampPlaybackOffset(offset, loopRef.current, durationRef.current);
      // Tiny shared look-ahead so every source begins on the exact same clock instant.
      const when = ctx.currentTime + 0.03;
      startCtxTimeRef.current = when;
      startOffsetRef.current = startOffset;

      const loop = loopRef.current;
      const pitchCorrection = pitchCorrectionSemitones(rateRef.current);
      for (const [id, buffer] of buffersRef.current) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rateRef.current;
        if (loop && loop.end > loop.start) {
          source.loop = true;
          source.loopStart = loop.start;
          source.loopEnd = loop.end;
        }
        const gain = gainNodesRef.current.get(id);
        if (gain) {
          const pitchShift = new PitchShift({
            pitch: pitchCorrection,
            windowSize: PITCH_CORRECTION_WINDOW_SECONDS,
            delayTime: 0,
            feedback: 0,
            wet: 1,
          });
          connectToneAudioNodes(source, pitchShift);
          pitchShift.connect(gain);
          pitchShiftNodesRef.current.add(pitchShift);
        }
        source.onended = () => {
          sourcesRef.current.delete(source);
          try {
            source.disconnect();
          } catch {
            // already disconnected
          }
        };
        source.start(when, startOffset);
        sourcesRef.current.add(source);
      }
    },
    [stopSources]
  );

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startRaf = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }
    const loop = () => {
      const pos = computePosition();
      if (!loopRef.current && durationRef.current > 0 && pos >= durationRef.current) {
        stopSources();
        playingRef.current = false;
        setPlaying(false);
        pausedOffsetRef.current = durationRef.current;
        setTime(durationRef.current);
        rafRef.current = null;
        return;
      }
      setTime(pos);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [computePosition, stopSources]);

  const play = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx || buffersRef.current.size === 0) {
      return;
    }
    try {
      await ctx.resume();
    } catch {
      // resume can reject if the context was closed mid-flight
    }
    let offset = pausedOffsetRef.current;
    if (durationRef.current > 0 && offset >= durationRef.current - 0.05) {
      offset = 0;
    }
    playingRef.current = true;
    startSourcesAt(offset);
    setPlaying(true);
    startRaf();
  }, [startRaf, startSourcesAt]);

  const pause = useCallback(() => {
    if (!playingRef.current) {
      return;
    }
    pausedOffsetRef.current = computePosition();
    stopSources();
    playingRef.current = false;
    setPlaying(false);
    stopRaf();
    setTime(pausedOffsetRef.current);
  }, [computePosition, stopRaf, stopSources]);

  const toggle = useCallback(async () => {
    if (playingRef.current) {
      pause();
    } else {
      await play();
    }
  }, [pause, play]);

  const seek = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(durationRef.current || next, next));
      pausedOffsetRef.current = target;
      if (playingRef.current) {
        startSourcesAt(target);
      }
      setTime(target);
    },
    [startSourcesAt]
  );

  const nudge = useCallback(
    (delta: number) => {
      seek(computePosition() + delta);
    },
    [computePosition, seek]
  );

  const setRate = useCallback(
    (rate: number) => {
      const oldRate = rateRef.current;
      const pos = computePosition();
      rateRef.current = rate;
      if (playingRef.current) {
        const ctx = ctxRef.current;
        if (!ctx || sourcesRef.current.size === 0) {
          startSourcesAt(pos);
          return;
        }
        const now = ctx.currentTime;
        const switchTime = now + RATE_CHANGE_DUCK_SECONDS;
        const switchOffset = normalizePlaybackPosition(pos + oldRate * RATE_CHANGE_DUCK_SECONDS, loopRef.current, durationRef.current);
        startCtxTimeRef.current = switchTime;
        startOffsetRef.current = switchOffset;
        scheduleRateTransitionDuck(ctx, switchTime);
        for (const source of sourcesRef.current) {
          source.playbackRate.cancelScheduledValues(now);
          source.playbackRate.setValueAtTime(oldRate, now);
          source.playbackRate.setValueAtTime(rate, switchTime);
        }
        const pitchCorrection = pitchCorrectionSemitones(rate);
        schedulePitchCorrectionAt(ctx, switchTime, pitchCorrection);
      }
    },
    [computePosition, schedulePitchCorrectionAt, scheduleRateTransitionDuck, startSourcesAt]
  );

  const setMasterVolume = useCallback((value: number) => {
    masterVolumeRef.current = value;
    const ctx = ctxRef.current;
    const node = masterGainRef.current;
    if (ctx && node) {
      node.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
    }
  }, []);

  const setStemGain = useCallback((id: string, value: number) => {
    desiredGainRef.current.set(id, value);
    const ctx = ctxRef.current;
    const node = gainNodesRef.current.get(id);
    if (ctx && node) {
      node.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
    }
  }, []);

  const setLoop = useCallback(
    (loop: EngineLoop) => {
      const normalized = loop && loop.end > loop.start ? loop : null;
      if (!playingRef.current) {
        loopRef.current = normalized;
        return;
      }
      // Source nodes are one-shot; restarting from the live playhead rebuilds
      // native loop flags without disturbing the shared transport position.
      const pos = computePosition();
      loopRef.current = normalized;
      startSourcesAt(pos);
    },
    [computePosition, startSourcesAt]
  );

  useEffect(() => {
    let cancelled = false;
    playingRef.current = false;
    stopRaf();
    pausedOffsetRef.current = 0;
    durationRef.current = fallbackDuration;

    if (engineSources.length === 0) {
      stopSources();
      buffersRef.current.clear();
      gainNodesRef.current.clear();
      if (ctxRef.current) {
        void ctxRef.current.close().catch(() => undefined);
        ctxRef.current = null;
      }
      masterGainRef.current = null;
      rateTransitionGainRef.current = null;
      return;
    }

    const ctx = createBrowserAudioContext();
    ctxRef.current = ctx;
    setToneContext(ctx);
    const master = ctx.createGain();
    master.gain.value = masterVolumeRef.current;
    const rateTransitionGain = ctx.createGain();
    rateTransitionGain.gain.value = 1;
    // Soft limiter: lets master boost past 100% stay loud without harsh digital clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(rateTransitionGain);
    rateTransitionGain.connect(limiter);
    limiter.connect(ctx.destination);
    masterGainRef.current = master;
    rateTransitionGainRef.current = rateTransitionGain;
    buffersRef.current = new Map();
    gainNodesRef.current = new Map();
    sourcesRef.current = new Set();
    pitchShiftNodesRef.current = new Set();

    let settled = 0;
    let decoded = 0;
    let maxDuration = 0;

    for (const source of engineSources) {
      const cached = decodedBufferCache.get(source.url);
      const decodePromise: Promise<AudioBuffer> = cached
        ? Promise.resolve(cached)
        : fetch(source.url)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Failed to fetch stem audio: ${response.status}`);
              }
              return response.arrayBuffer();
            })
            .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer));

      decodePromise
        .then((audioBuffer) => {
          cacheDecodedBuffer(source.url, audioBuffer);
          if (cancelled || ctxRef.current !== ctx) {
            return;
          }
          buffersRef.current.set(source.id, audioBuffer);
          const gain = ctx.createGain();
          gain.gain.value = desiredGainRef.current.get(source.id) ?? 0;
          gain.connect(master);
          gainNodesRef.current.set(source.id, gain);
          maxDuration = Math.max(maxDuration, audioBuffer.duration);
          durationRef.current = Math.max(durationRef.current, maxDuration);
          setDuration((current) => Math.max(current, maxDuration, fallbackDuration));
          decoded += 1;
          setDecodedCount(decoded);
        })
        .catch(() => {
          // A single stem failing to decode shouldn't sink the whole mix.
        })
        .finally(() => {
          if (cancelled || ctxRef.current !== ctx) {
            return;
          }
          settled += 1;
          if (settled === engineSources.length) {
            setReady(decoded > 0);
          }
        });
    }

    return () => {
      cancelled = true;
      stopRaf();
      stopSources();
      buffersRef.current.clear();
      gainNodesRef.current.clear();
      if (ctxRef.current === ctx) {
        void ctx.close().catch(() => undefined);
        ctxRef.current = null;
        masterGainRef.current = null;
        rateTransitionGainRef.current = null;
      }
    };
    // Only the stem set (ids + urls) should trigger a full decode/teardown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    if (fallbackDuration > durationRef.current) {
      durationRef.current = fallbackDuration;
      setDuration((current) => Math.max(current, fallbackDuration));
    }
  }, [fallbackDuration]);

  const playable = decodedCount > 0;

  return {
    ready,
    playable,
    decodedCount,
    totalCount,
    duration,
    playing,
    time,
    play,
    pause,
    toggle,
    seek,
    nudge,
    setRate,
    setMasterVolume,
    setStemGain,
    setLoop,
  };
}

// Circular-arrow skip button with the jump amount baked into the centre of the
// glyph (matches the reference transport). Tap = ±5s; hold-to-scrub is handled by
// the global arrow-key handler, not this button.
function TransportSkipButton({
  dir,
  seconds,
  disabled,
  onClick,
}: {
  dir: 1 | -1;
  seconds: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const back = dir < 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="iconbtn shrink-0 disabled:opacity-45"
      style={{ width: 42, height: 42 }}
      aria-label={`${back ? 'Back' : 'Forward'} ${seconds} seconds`}
      title={`${back ? 'Back' : 'Forward'} ${seconds}s (${back ? '←' : '→'} tap, hold to scrub)`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {back ? (
          <>
            <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
            <path d="M3 4.2V9h4.8" />
          </>
        ) : (
          <>
            <path d="M20.5 12a8.5 8.5 0 1 1-2.7-6.2" />
            <path d="M21 4.2V9h-4.8" />
          </>
        )}
        <text x="12" y="15.4" fontSize="8.2" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none" style={{ fontFamily: 'var(--font-mono)' }}>
          {seconds}
        </text>
      </svg>
    </button>
  );
}

function TransportCard({
  song,
  audioUrl,
  stemSources,
  seekCommand,
  playbackCommand,
  minimized,
  onMinimizedChange,
  onTimeChange,
  onPlayingChange,
  sections,
  analyzing,
  onRunAnalyze,
}: {
  song: SongSummary | null;
  audioUrl: string | null;
  stemSources: StemPlaybackSource[];
  seekCommand: SeekCommand | null;
  playbackCommand: PlaybackCommand | null;
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  onTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  sections: SectionSegment[];
  analyzing: boolean;
  onRunAnalyze?: () => void;
}) {
  const engineSources = useMemo<EngineSource[]>(() => {
    if (stemSources.length > 0) {
      return stemSources.map((source) => ({ id: source.id, url: source.url }));
    }
    if (audioUrl) {
      return [{ id: ORIGINAL_SOURCE_ID, url: audioUrl }];
    }
    return [];
  }, [audioUrl, stemSources]);

  const fallbackDuration = song?.duration_sec ?? 0;
  const {
    ready: engineReady,
    decodedCount,
    totalCount,
    duration,
    playing,
    time,
    toggle,
    seek,
    nudge,
    setRate: setEngineRate,
    setMasterVolume: setEngineMasterVolume,
    setStemGain,
    setLoop: setEngineLoop,
  } = usePlaybackEngine(engineSources, fallbackDuration);

  const stemSourcesRef = useRef(stemSources);
  const anySoloRef = useRef(false);
  const sentTimeRef = useRef(-1);
  const handledSeekCommandIdRef = useRef<number | null>(null);
  const handledPlaybackCommandIdRef = useRef<number | null>(null);
  const [rate, setRate] = useState(1);
  const [masterVolume, setMasterVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [repeatSong, setRepeatSong] = useState(false);

  const hasStemPlayback = stemSources.length > 0;
  const hasLoop = loopStart !== null || loopEnd !== null;
  const anySolo = stemSources.some((source) => source.solo);
  const stemMixSignature = useMemo(
    () => stemSources.map((source) => `${source.id}:${source.level}:${source.muted ? 1 : 0}:${source.solo ? 1 : 0}`).join('|'),
    [stemSources]
  );
  const preparingPlayback = totalCount > 0 && !engineReady;
  const hasPlayableAudio = engineReady;
  const playbackModeLabel = hasStemPlayback ? 'Stems mix' : 'Original';
  const playButtonLabel = preparingPlayback ? 'Preparing playback' : playing ? 'Pause' : 'Play';
  const currentSection = sections.find((section) => time >= section.start && time < section.end);

  const effectiveLoop = useMemo<EngineLoop>(() => {
    if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
      return { start: loopStart, end: loopEnd };
    }
    if (repeatSong && duration > 0) {
      return { start: 0, end: duration };
    }
    return null;
  }, [duration, loopEnd, loopStart, repeatSong]);

  useEffect(() => {
    onPlayingChange(playing);
  }, [onPlayingChange, playing]);

  useEffect(() => {
    // Drive the seeker at 60Hz locally, but only push time upstream ~20Hz so the
    // heavier lyric/chord panels don't re-render on every animation frame.
    if (!playing || Math.abs(time - sentTimeRef.current) >= 0.05) {
      sentTimeRef.current = time;
      onTimeChange(time);
    }
  }, [onTimeChange, playing, time]);

  useEffect(() => {
    stemSourcesRef.current = stemSources;
    anySoloRef.current = anySolo;
  }, [anySolo, stemSources]);

  useEffect(() => {
    setEngineRate(rate);
  }, [rate, setEngineRate]);

  useEffect(() => {
    // Mute drives the engine to silence but leaves `masterVolume` intact, so a second
    // click restores the exact level the user had dialled in.
    setEngineMasterVolume((muted ? 0 : masterVolume) / 100);
  }, [masterVolume, muted, setEngineMasterVolume]);

  useEffect(() => {
    setEngineLoop(effectiveLoop);
  }, [effectiveLoop, setEngineLoop]);

  useEffect(() => {
    if (hasStemPlayback) {
      for (const source of stemSources) {
        setStemGain(source.id, getStemVolume(source, anySolo));
      }
    } else if (audioUrl) {
      setStemGain(ORIGINAL_SOURCE_ID, 1);
    }
  }, [anySolo, audioUrl, hasStemPlayback, setStemGain, stemMixSignature, stemSources]);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<StemLevelPreviewDetail>).detail;
      if (!detail || typeof detail.assetId !== 'string' || typeof detail.level !== 'number') {
        return;
      }
      const source = stemSourcesRef.current.find((item) => item.id === detail.assetId);
      if (!source) {
        return;
      }
      setStemGain(detail.assetId, getStemVolume({ ...source, level: detail.level }, anySoloRef.current));
    };

    window.addEventListener(stemLevelPreviewEvent, handlePreview);
    return () => window.removeEventListener(stemLevelPreviewEvent, handlePreview);
  }, [setStemGain]);

  useEffect(() => {
    if (!seekCommand || handledSeekCommandIdRef.current === seekCommand.id) {
      return;
    }
    handledSeekCommandIdRef.current = seekCommand.id;
    seek(seekCommand.time);
  }, [seek, seekCommand]);

  useEffect(() => {
    if (!playbackCommand || handledPlaybackCommandIdRef.current === playbackCommand.id) {
      return;
    }
    handledPlaybackCommandIdRef.current = playbackCommand.id;
    if (playbackCommand.action === 'toggle') {
      void toggle();
    }
  }, [playbackCommand, toggle]);

  useEffect(() => {
    // Arrow keys scrub the transport: a quick tap jumps ±5s, holding scrubs
    // continuously with a pace that accelerates the longer the key is held.
    const TAP_MS = 160;
    const BASE_RATE = 5; // seconds of audio per real second at the start of a hold
    const MAX_RATE = 45;
    const RAMP_MS = 2500;
    let direction = 0;
    let pressStart = 0;
    let lastFrame = 0;
    let raf: number | null = null;
    let moved = false;

    const frame = (now: number) => {
      const held = now - pressStart;
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      if (held >= TAP_MS) {
        const ramp = Math.min(1, (held - TAP_MS) / RAMP_MS);
        const velocity = BASE_RATE + (MAX_RATE - BASE_RATE) * ramp * ramp;
        nudge(direction * velocity * dt);
        moved = true;
      }
      raf = requestAnimationFrame(frame);
    };

    const directionOf = (key: string) => (key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing = !!target && (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable);

      if (event.code === 'Space' || event.key === ' ') {
        // Space toggles play/pause — but let a focused control run its own native
        // Space (button click, range, select) so we never double-fire.
        if (typing || tag === 'BUTTON' || tag === 'SELECT' || tag === 'A') {
          return;
        }
        event.preventDefault();
        void toggle();
        return;
      }

      if (typing) {
        return;
      }
      const next = directionOf(event.key);
      if (next === 0) {
        return;
      }
      event.preventDefault();
      if (event.repeat || direction !== 0) {
        return;
      }
      direction = next;
      pressStart = performance.now();
      lastFrame = pressStart;
      moved = false;
      raf = requestAnimationFrame(frame);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const released = directionOf(event.key);
      if (released === 0 || released !== direction) {
        return;
      }
      const held = performance.now() - pressStart;
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      if (held < TAP_MS && !moved) {
        nudge(direction * 5);
      }
      direction = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
    };
  }, [nudge, toggle]);

  function setLoopStartAtPlayhead() {
    const nextStart = Math.min(time, Math.max(0, (duration || time) - 0.5));
    setLoopStart(nextStart);
    if (loopEnd !== null && loopEnd <= nextStart) {
      setLoopEnd(null);
    }
  }

  function setLoopEndAtPlayhead() {
    if (loopStart === null) {
      const nextStart = Math.max(0, time - 1);
      setLoopStart(nextStart);
      setLoopEnd(Math.max(time, nextStart + 0.5));
      return;
    }
    setLoopEnd(Math.max(time, loopStart + 0.5));
  }

  function clearLoop() {
    setLoopStart(null);
    setLoopEnd(null);
  }

  // Volume: muting drops the displayed fill to 0 without forgetting the dialled
  // level. The track gradient and the 100% detent both scale against VOLUME_MAX so
  // the above-unity boost headroom stays reachable.
  const displayVolume = muted ? 0 : masterVolume;
  const volumeFillPercent = (displayVolume / VOLUME_MAX) * 100;
  const volumeUnityPercent = (100 / VOLUME_MAX) * 100;
  const loopActive = loopStart !== null && loopEnd !== null && loopEnd > loopStart;
  const loopLength = loopActive ? formatSeconds(loopEnd - loopStart) : null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const loopRange =
    loopStart !== null && loopEnd !== null && loopEnd > loopStart && duration > 0
      ? (() => {
          const left = Math.min(100, Math.max(0, (loopStart / duration) * 100));
          const width = Math.min(100 - left, Math.max(0, ((loopEnd - loopStart) / duration) * 100));
          return { left, width };
        })()
      : null;

  function renderSectionRuler() {
    if (duration <= 0 || sections.length === 0) {
      return null;
    }
    return (
      <div className="relative h-4 w-full">
        {sections.map((section, index) => {
          const left = Math.min(100, Math.max(0, (section.start / duration) * 100));
          const width = Math.min(100 - left, Math.max(0, ((section.end - section.start) / duration) * 100));
          if (width <= 0) {
            return null;
          }
          const active = currentSection === section;
          return (
            <button
              key={index}
              type="button"
              onClick={() => seek(section.start)}
              title={`${section.name} · ${formatSeconds(section.start)}`}
              className={`absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-[5px] px-1 transition ${
                active
                  ? 'shadow-[inset_0_0_0_1px_var(--accent)]'
                  : 'shadow-[inset_0_0_0_1px_var(--line-2)]'
              }`}
              // Background is set inline, not via a `bg-[...]` utility: globals.css has an
              // unlayered `button { background: none }` reset that, per the cascade-layer
              // rules, overrides any layered Tailwind background utility on a <button>.
              style={{
                left: `${left}%`,
                width: `calc(${width}% - 2px)`,
                background: active ? 'var(--accent-soft)' : 'var(--card-2)',
              }}
            >
              <span
                className={`truncate text-[8.5px] font-bold leading-none tracking-[0.02em] ${
                  active ? 'text-[var(--accent-ink)]' : 'text-[var(--faint)]'
                }`}
              >
                {section.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderSeeker(heightClass: string, showLoopRange: boolean, sectionMarks: 'ticks' | 'gaps' | 'none') {
    const fillPercent = progress * 100;
    const loopEndPercent = loopRange ? loopRange.left + loopRange.width : 0;
    return (
      <div className={`relative flex ${heightClass} flex-1 items-center`}>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--hair)]">
          {showLoopRange && loopRange && (
            <div
              className="pointer-events-none absolute inset-y-0 bg-[var(--accent)] opacity-25"
              style={{ left: `${loopRange.left}%`, width: `${loopRange.width}%` }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[var(--ink)]"
            style={{ width: `${fillPercent}%` }}
          />
          {sectionMarks === 'gaps' &&
            duration > 0 &&
            sections.map((section, index) =>
              section.start <= 0 ? null : (
                // Tiny panel-coloured notch through the line at each section boundary —
                // reads as the line "breaking" into sections without adding clutter.
                <div
                  key={index}
                  className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-[var(--card)]"
                  style={{ left: `${Math.min(100, (section.start / duration) * 100)}%` }}
                />
              )
            )}
          {preparingPlayback && totalCount > 0 && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 h-[2px] bg-[var(--accent)] transition-[width] duration-200"
              style={{ width: `${(decodedCount / totalCount) * 100}%` }}
            />
          )}
        </div>
        {sectionMarks === 'ticks' && duration > 0 && sections.length > 0 && (
          // One SVG overlay with crispEdges + non-scaling stroke so every section
          // tick snaps to the pixel grid and renders identical thickness — a row of
          // fractionally-positioned hairline <div>s anti-aliases to inconsistent widths.
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            aria-hidden
          >
            {sections.map((section, index) => {
              if (section.start <= 0) {
                return null;
              }
              const x = Math.min(100, (section.start / duration) * 100);
              return (
                <line
                  key={index}
                  x1={x}
                  x2={x}
                  y1={32}
                  y2={68}
                  stroke="var(--muted)"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  shapeRendering="crispEdges"
                />
              );
            })}
          </svg>
        )}
        {showLoopRange && loopRange && (
          <>
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]"
              style={{ left: `${loopRange.left}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]"
              style={{ left: `${loopEndPercent}%` }}
            />
            <span
              className="pointer-events-none absolute top-0 z-10 flex h-[15px] min-w-[15px] -translate-x-1/2 items-center justify-center rounded-[4px] bg-[var(--accent)] px-1 text-[9px] font-bold leading-none text-white"
              style={{ left: `${loopRange.left}%` }}
            >
              A
            </span>
            <span
              className="pointer-events-none absolute top-0 z-10 flex h-[15px] min-w-[15px] -translate-x-1/2 items-center justify-center rounded-[4px] bg-[var(--accent)] px-1 text-[9px] font-bold leading-none text-white"
              style={{ left: `${loopEndPercent}%` }}
            >
              B
            </span>
          </>
        )}
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ink)] shadow-[var(--shadow-card)] ring-2 ring-[var(--paper)]"
          style={{ left: `${fillPercent}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={time}
          onChange={(event) => seek(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Seek playback"
        />
      </div>
    );
  }

  return (
    <section className="surface shrink-0 px-5 py-3">
      {/* Top line — one source of truth, shown identically whether expanded or collapsed. */}
      <div className="flex items-center gap-3">
        <TransportSkipButton dir={-1} seconds={5} disabled={!hasPlayableAudio} onClick={() => nudge(-5)} />
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!hasPlayableAudio}
          className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] shadow-[var(--shadow-card)] disabled:opacity-45"
          aria-label={playButtonLabel}
        >
          {preparingPlayback ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <TransportSkipButton dir={1} seconds={5} disabled={!hasPlayableAudio} onClick={() => nudge(5)} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {renderSectionRuler()}
          {renderSeeker('h-8', true, 'gaps')}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            className="iconbtn h-8 w-8 shrink-0"
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted || displayVolume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <div className="relative flex h-3.5 w-24 items-center">
            <input
              type="range"
              min={0}
              max={VOLUME_MAX}
              step={1}
              value={displayVolume}
              onChange={(event) => {
                setMasterVolume(Number(event.target.value));
                if (muted) {
                  setMuted(false);
                }
              }}
              className="transport-range absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
              style={{
                background: `linear-gradient(to right, var(--ink) 0 ${volumeFillPercent}%, var(--hair) ${volumeFillPercent}% 100%)`,
              }}
              aria-label="Master volume"
            />
            {/* unity (100%) detent — a quiet tick under the track so the boost ceiling is findable */}
            <div
              className="pointer-events-none absolute bottom-[-3px] h-1.5 w-[2px] -translate-x-1/2 rounded-full bg-[var(--faint)]"
              style={{ left: `${volumeUnityPercent}%` }}
              aria-hidden
            />
          </div>
          <span className="mono tnum w-10 text-right text-[11px] font-semibold text-[var(--muted)]">{displayVolume}%</span>
        </div>
        <button
          type="button"
          onClick={() => onMinimizedChange(!minimized)}
          className="iconbtn h-9 w-9 shrink-0"
          aria-label={minimized ? 'Expand playback' : 'Minimize playback'}
          title={minimized ? 'Expand playback' : 'Minimize playback'}
        >
          {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Detail row — position, context, and the practice controls. Hidden when collapsed. */}
      {!minimized && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="mono text-sm font-bold">{formatSeconds(time)}</span>
            <span className="text-xs text-[var(--faint)]">/ {formatSeconds(duration || song?.duration_sec || 0)}</span>
            {currentSection ? (
              <span className="chip accent inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {currentSection.name}
              </span>
            ) : sections.length === 0 && onRunAnalyze ? (
              <button
                type="button"
                onClick={onRunAnalyze}
                disabled={analyzing}
                className="chip accent inline-flex items-center gap-1 disabled:opacity-50"
                style={{ cursor: analyzing ? 'default' : 'pointer' }}
                title="Run analysis to detect song sections (verse, chorus, bridge)"
              >
                <Wand2 className="h-3 w-3" />
                {analyzing ? 'Analyzing…' : 'Run analysis for sections'}
              </button>
            ) : null}
            <span className={`chip ${hasStemPlayback && engineReady ? 'live' : ''}`}>{playbackModeLabel}</span>
            {hasPlayableAudio && (
              <span className="hidden items-center gap-1 text-[11px] text-[var(--faint)] sm:inline-flex">
                Press
                <kbd className="rounded-[4px] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line)]">
                  space
                </kbd>
                to {playing ? 'pause' : 'play'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* A–B loop — accent-soft when both ends are set; length shown quietly, times in clean mono */}
            <div
              className="flex items-center gap-0.5 rounded-full px-1.5 py-1 transition-[background,box-shadow] duration-200"
              style={{
                background: loopActive ? 'var(--accent-soft)' : 'var(--card-2)',
                boxShadow: loopActive ? 'inset 0 0 0 1px var(--accent)' : 'inset 0 0 0 1px var(--line-2)',
              }}
            >
              {loopLength && (
                <span className="mono tnum px-1.5 text-[11px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
                  {loopLength}
                </span>
              )}
              <LoopPointButton
                marker="A"
                value={loopStart}
                disabled={!hasPlayableAudio}
                onClick={setLoopStartAtPlayhead}
                title="Set loop start to playhead (A)"
              />
              <LoopPointButton
                marker="B"
                value={loopEnd}
                disabled={!hasPlayableAudio}
                onClick={setLoopEndAtPlayhead}
                title="Set loop end to playhead (B)"
              />
              {hasLoop && (
                <button
                  type="button"
                  onClick={clearLoop}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Clear loop"
                  title="Clear loop"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Repeat — icon-only toggle; the fill itself is the on/off signal (ink fill + accent glyph) */}
            <button
              type="button"
              onClick={() => setRepeatSong((value) => !value)}
              className={`iconbtn h-8 w-8 shrink-0 ${repeatSong ? 'on' : ''}`}
              aria-label="Repeat song"
              aria-pressed={repeatSong}
              title={repeatSong ? 'Repeat song: on' : 'Repeat song: off'}
            >
              <Repeat className="h-4 w-4" style={repeatSong ? { color: 'var(--accent)' } : undefined} />
            </button>
            {/* Speed — segmented control, matching the Analysis depth toggle above for consistency */}
            <div
              className="flex items-center gap-0.5 rounded-full px-1.5 py-1 transition-[background,box-shadow] duration-200"
              role="group"
              aria-label="Playback speed"
              style={{ background: 'var(--card-2)', boxShadow: 'inset 0 0 0 1px var(--line-2)' }}
            >
              {SPEED_STOPS.map((stop) => {
                const active = rate === stop;
                return (
                  <button
                    key={stop}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRate(stop)}
                    className={`flex items-center rounded-full px-2 py-1 transition ${
                      active ? 'text-[11px] font-semibold' : 'text-[10px] font-medium'
                    }`}
                    style={
                      active
                        ? { background: 'var(--ink)', color: 'var(--paper)' }
                        : { color: 'var(--muted)' }
                    }
                  >
                    {stop % 1 === 0 ? stop.toFixed(1) : String(stop)}
                    {/* Swapped to opacity-55 to perfectly match the Loop A/B marker */}
                    <span className="opacity-55 font-semibold">×</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Single A/B loop-point button: a faint marker letter beside a clean mono timestamp,
// or a quiet "Set A/B" prompt when the point isn't placed yet.
function LoopPointButton({
  marker,
  value,
  disabled,
  onClick,
  title,
}: {
  marker: 'A' | 'B';
  value: number | null;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  const set = value !== null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1 rounded-full px-2 py-1 transition disabled:opacity-45"
      style={set ? { background: 'var(--ink)', color: 'var(--paper)' } : { color: 'var(--muted)' }}
    >
      <span className="text-[10px] font-semibold opacity-55">{marker}</span>
      {set ? (
        <span className="mono tnum text-[11px] font-semibold">{formatSeconds(value)}</span>
      ) : (
        <span className="text-[11px] font-medium">Set</span>
      )}
    </button>
  );
}

function GuitarLearnerView({
  currentTime,
  musicXmlAsset,
  tabAsset,
  noteEventsAsset,
  sourceAsset,
  running,
  onOpenAsset,
  onRunMidi,
  onRunMusicXml,
  midiStale,
  onRerunMidi,
}: {
  currentTime: number;
  musicXmlAsset: AssetSummary | undefined;
  tabAsset: AssetSummary | undefined;
  noteEventsAsset: AssetSummary | undefined;
  sourceAsset: AssetSummary | undefined;
  running: ReadonlySet<string>;
  onOpenAsset: (asset: AssetSummary) => void;
  onRunMidi: () => void;
  onRunMusicXml: () => void;
  midiStale: boolean;
  onRerunMidi: () => void;
}) {
  const [mode, setMode] = useState<GuitarMode>('chords');

  return (
    <div className="flex h-auto min-h-0 flex-col gap-4 md:h-full">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {guitarModes.map(([id, label, Icon]) => (
          <button
            key={id as GuitarMode}
            type="button"
            onClick={() => setMode(id as GuitarMode)}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${
              mode === id
                ? 'shadow-none'
                : 'bg-[var(--card)] text-[var(--muted)] shadow-[inset_0_0_0_1.5px_var(--line)] hover:text-[var(--ink)]'
            }`}
            style={mode === id ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
        <div className="flex-1" />
        <PipelineActionButton
          label={noteEventsAsset ? 'Re-run MIDI' : 'MIDI'}
          idleIcon={<FileMusic className="h-3.5 w-3.5" />}
          busy={running.has('MIDI transcription')}
          stale={midiStale}
          disabled={!sourceAsset || running.has('MIDI transcription')}
          onClick={noteEventsAsset ? onRerunMidi : onRunMidi}
          title={
            noteEventsAsset
              ? midiStale
                ? 'Newer MIDI model available — re-transcribe'
                : 'Re-transcribe MIDI with the latest model'
              : 'Transcribe MIDI from this track'
          }
        />
        <button type="button" onClick={onRunMusicXml} disabled={!noteEventsAsset || running.has('MusicXML conversion')} className="pill ghost sm">
          <PillIcon>
            {running.has('MusicXML conversion') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sheet className="h-3.5 w-3.5" />}
          </PillIcon>
          MusicXML
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {mode === 'chords' && <ChordPracticePanel currentTime={currentTime} />}
        {mode === 'sheet' && (
          <MusicXmlPreviewPanel
            title="Sheet Music"
            asset={musicXmlAsset}
            fallback="No MusicXML score is available yet."
            mode="sheet"
            onOpenAsset={onOpenAsset}
          />
        )}
        {mode === 'tab' && (
          <MusicXmlPreviewPanel
            title="Tablature"
            asset={tabAsset ?? musicXmlAsset}
            fallback="No tab artifact is available yet."
            mode="tab"
            estimatedFromScore={!tabAsset && Boolean(musicXmlAsset)}
            onOpenAsset={onOpenAsset}
          />
      )}
      </div>
    </div>
  );
}

function ChordPracticePanel({ currentTime }: { currentTime: number }) {
  const chords = ['D', 'G', 'Bm', 'A', 'Em'];
  const progression = ['D', 'G', 'Bm', 'A', 'Em', 'G', 'D', 'Em', 'A', 'G', 'D', 'Bm', 'A'];
  const activeProgressionIndex = Math.max(0, Math.min(progression.length - 1, Math.floor(currentTime / 8) % progression.length));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        <span className="chip accent">Practice shapes</span>
        <span className="chip">Fingerstyle</span>
        <span className="chip">Loop-friendly</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {chords.map((chord, index) => (
          <div
            key={chord}
            className="surface w-[122px] p-3 text-center"
            style={index === 0 ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
          >
            <div className="display mb-1.5 text-[22px]">{chord}</div>
            <svg viewBox="0 0 88 104" className="mx-auto h-[104px] w-[88px]" aria-hidden="true">
              <rect x="14" y="15" width="60" height="3" rx="1.5" fill="currentColor" />
              {[0, 1, 2, 3].map((fret) => (
                <line key={fret} x1="14" y1={30 + fret * 18} x2="74" y2={30 + fret * 18} stroke="currentColor" opacity="0.22" />
              ))}
              {[0, 1, 2, 3, 4, 5].map((string) => (
                <line key={string} x1={14 + string * 12} y1="15" x2={14 + string * 12} y2="88" stroke="currentColor" opacity="0.22" />
              ))}
              {[0, 2, 4].map((dot, i) => (
                <circle key={i} cx={26 + dot * 8} cy={44 + i * 16} r="6" fill={index === 0 ? 'var(--accent)' : 'var(--ink)'} />
              ))}
            </svg>
          </div>
        ))}
      </div>
      <div>
        <div className="label mb-3">Progression</div>
        <div className="surface flex flex-wrap gap-2 p-4">
          {progression.map((chord, index) => {
            const active = index === activeProgressionIndex;
            return (
              <span
                key={`${chord}-${index}`}
                className={`display grid h-11 min-w-14 place-items-center rounded-[10px] px-3 text-[17px] ${
                  active ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-card)]' : 'bg-[var(--card-2)] text-[var(--ink)]'
                }`}
              >
                {chord}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LyricsEditorProductView({
  lyricsDraft,
  syncedLyrics,
  plainLyrics,
  currentTime,
  playing,
  running,
  onLyricsDraftChange,
  onSave,
  onFetchLyrics,
  onAlignLyrics,
  onSeek,
  onTogglePlayback,
  canAlign,
  lyricsStale,
  onRerunLyrics,
}: {
  lyricsDraft: string;
  syncedLyrics: LyricsRow | undefined;
  plainLyrics: LyricsRow | undefined;
  currentTime: number;
  playing: boolean;
  running: ReadonlySet<string>;
  onLyricsDraftChange: (value: string) => void;
  onSave: (payload: EditorLyricsSavePayload) => Promise<void>;
  onFetchLyrics: () => void;
  onAlignLyrics: () => void;
  onSeek: (time: number) => void;
  onTogglePlayback: () => void;
  canAlign: boolean;
  lyricsStale: boolean;
  onRerunLyrics: () => void;
}) {
  const initialLines = useMemo(() => buildEditorLyricLines(syncedLyrics, plainLyrics, lyricsDraft), [lyricsDraft, plainLyrics, syncedLyrics]);
  const [lines, setLines] = useState<EditorLyricLine[]>(() => initialLines);
  const [cursor, setCursor] = useState(() => Math.max(0, initialLines.findIndex((line) => line.time === null)));
  const [dirty, setDirty] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());

  const cursorIndex = Math.max(0, Math.min(lines.length - 1, cursor));
  const activeIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const time = lines[i].time;
      if (time !== null && currentTime + offsetMs / 1000 >= time) {
        index = i;
      }
    }
    return index;
  }, [currentTime, lines, offsetMs]);

  const issues = useMemo(() => {
    const next: Array<{ index: number; message: string }> = [];
    let previous = -Infinity;
    lines.forEach((line, index) => {
      if (!line.text.trim()) {
        next.push({ index, message: `Line ${index + 1} has no text` });
      }
      if (line.time !== null) {
        if (line.time < previous) {
          next.push({ index, message: `Line ${index + 1} timestamp is earlier than the line above` });
        }
        previous = line.time;
      }
    });
    const untimed = lines.filter((line) => line.time === null).length;
    if (untimed > 0) {
      next.push({ index: -1, message: `${untimed} line${untimed === 1 ? '' : 's'} still need a timestamp` });
    }
    return next;
  }, [lines]);

  const timedCount = lines.filter((line) => line.time !== null).length;
  const percentTimed = lines.length > 0 ? Math.round((timedCount / lines.length) * 100) : 0;

  const replaceLines = useCallback(
    (next: EditorLyricLine[]) => {
      setLines(next);
      setDirty(true);
      onLyricsDraftChange(editorLinesToPlain(next));
    },
    [onLyricsDraftChange]
  );

  const updateLine = useCallback(
    (index: number, patch: Partial<EditorLyricLine>) => {
      replaceLines(lines.map((line, currentIndex) => (currentIndex === index ? { ...line, ...patch } : line)));
    },
    [lines, replaceLines]
  );

  const addLine = useCallback(
    (index: number) => {
      const next = [...lines];
      next.splice(index + 1, 0, { id: `new-${Date.now()}`, time: null, text: '' });
      replaceLines(next);
      setCursor(index + 1);
    },
    [lines, replaceLines]
  );

  const deleteLine = useCallback(
    (index: number) => {
      const next = lines.filter((_, currentIndex) => currentIndex !== index);
      replaceLines(next.length > 0 ? next : [{ id: `new-${Date.now()}`, time: null, text: '' }]);
      setCursor(Math.max(0, index - 1));
    },
    [lines, replaceLines]
  );

  const stampLine = useCallback(() => {
    if (lines.length === 0) {
      return;
    }
    const next = lines.map((line, index) => (index === cursorIndex ? { ...line, time: roundTime(currentTime) } : line));
    replaceLines(next);
    setCursor(Math.min(lines.length - 1, cursorIndex + 1));
  }, [currentTime, cursorIndex, lines, replaceLines]);

  const saveEditorDraft = useCallback(async () => {
    const content = editorLinesToPlain(lines);
    const lrcContent = lines.some((line) => line.time !== null) ? editorLinesToLrc(lines, offsetMs) : null;
    onLyricsDraftChange(content);
    try {
      await onSave({ plainContent: content, lrcContent });
      setSavedAt(new Date());
      setDirty(false);
    } catch {
      // The parent save handler owns the user-visible error message.
    }
  }, [lines, offsetMs, onLyricsDraftChange, onSave]);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }
    const target = playing && activeIndex >= 0 ? activeIndex : cursorIndex;
    const row = rowRefs.current.get(target);
    const list = listRef.current;
    if (!row || !list) {
      return;
    }
    const top = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
    list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [activeIndex, autoScroll, cursorIndex, playing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveEditorDraft();
        return;
      }
      if (typing) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        onTogglePlayback();
      } else if (event.key === 'Enter' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        stampLine();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((current) => Math.min(lines.length - 1, current + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((current) => Math.max(0, current - 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lines.length, onTogglePlayback, saveEditorDraft, stampLine]);

  return (
    <div className="grid h-auto min-h-0 gap-4 md:h-full lg:grid-cols-[minmax(0,1fr)_320px]">
      {showImport && (
        <ImportLyricsModal
          initialText={editorLinesToLrc(lines, offsetMs)}
          onClose={() => setShowImport(false)}
          onImport={(nextLines) => {
            replaceLines(nextLines);
            setCursor(Math.max(0, nextLines.findIndex((line) => line.time === null)));
          }}
        />
      )}
      <section className="surface flex min-h-0 flex-col overflow-hidden md:h-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-2)] p-5">
          <div className="flex items-center gap-3">
            <Type className="h-5 w-5 text-[var(--muted)]" />
            <h2 className="font-bold">Sync editor</h2>
            <span className="chip">{percentTimed}% timed</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoScroll((enabled) => !enabled)}
              className={`iconbtn ${autoScroll ? 'bg-[var(--ink)] text-[var(--paper)]' : ''}`}
              title="Auto-scroll"
              aria-pressed={autoScroll}
            >
              <Layers className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setShowImport(true)} className="pill ghost sm">
              <PillIcon>
                <Upload className="h-3.5 w-3.5" />
              </PillIcon>
              Import
            </button>
            <button type="button" onClick={() => void saveEditorDraft()} disabled={running.has('Save lyrics')} className="pill sm">
              <PillIcon>
                {running.has('Save lyrics') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </PillIcon>
              {dirty ? 'Save' : 'Saved'}
              <span className="mono opacity-60">⌘S</span>
            </button>
          </div>
        </div>

        <div ref={listRef} className="min-h-[320px] flex-1 overflow-y-auto p-3 md:min-h-0">
          {lines.length > 0 ? (
            lines.map((line, index) => {
              const selected = index === cursorIndex;
              const active = index === activeIndex && playing;
              const hasIssue = issues.some((issue) => issue.index === index);
              return (
                <div
                  key={line.id}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(index, node);
                    } else {
                      rowRefs.current.delete(index);
                    }
                  }}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === index) {
                      return;
                    }
                    const next = [...lines];
                    const [moving] = next.splice(dragIndex, 1);
                    next.splice(index, 0, moving);
                    replaceLines(next);
                    setDragIndex(null);
                  }}
                  onClick={() => setCursor(index)}
                  className={`grid grid-cols-[22px_116px_1fr_auto] items-center gap-2 rounded-[10px] px-2 py-2 transition ${
                    active ? 'bg-[var(--accent-soft)]' : selected ? 'shadow-[inset_0_0_0_1.5px_var(--accent)]' : ''
                  } ${dragIndex === index ? 'opacity-45' : ''}`}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-[var(--hair)]" />
                  <TimestampControl
                    value={line.time}
                    active={active}
                    onSeek={() => {
                      if (line.time !== null) {
                        onSeek(line.time);
                      }
                    }}
                    onChange={(time) => updateLine(index, { time })}
                  />
                  <input
                    value={line.text}
                    onFocus={() => setCursor(index)}
                    onChange={(event) => updateLine(index, { text: event.target.value })}
                    placeholder="Lyric line..."
                    className="min-w-0 rounded-[8px] border-0 bg-transparent px-2 py-1 text-[15px] font-medium outline-none focus:bg-[var(--paper)]"
                  />
                  <div className="flex items-center gap-1">
                    {hasIssue && <AlertCircle className="h-4 w-4 text-[var(--warn)]" />}
                    <button type="button" onClick={() => addLine(index)} className="iconbtn h-7 w-7" title="Add line below">
                      <span className="text-lg leading-none">+</span>
                    </button>
                    <button type="button" onClick={() => deleteLine(index)} className="iconbtn h-7 w-7" title="Delete line">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={<Type className="h-6 w-6" />}
              title="No lyrics yet"
              desc="Fetch lyrics from the provider, or import plain text or .lrc content."
              ctas={[
                {
                  label: running.has('Lyrics fetch') ? 'Fetching' : 'Fetch lyrics',
                  icon: running.has('Lyrics fetch') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />,
                  disabled: running.has('Lyrics fetch'),
                  onClick: onFetchLyrics,
                },
                { label: 'Import', icon: <Upload className="h-3.5 w-3.5" />, onClick: () => setShowImport(true), variant: 'ghost' },
              ]}
            />
          )}
          {lines.length > 0 && (
            <button
              type="button"
              onClick={() => addLine(lines.length - 1)}
              className="mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-bold text-[var(--faint)]"
            >
              <span className="text-lg leading-none">+</span>
              Add line
            </button>
          )}
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-4 pb-1">
        <section className="surface p-5">
          <div className="label mb-3">How to sync</div>
          <div className="grid gap-3 text-sm">
            <GuideRow icon={<Play className="h-4 w-4" />} text="Press Space to play" />
            <GuideRow icon={<Flag className="h-4 w-4" />} text="Hit Enter on the beat each line starts" />
            <GuideRow icon={<ChevronRight className="h-4 w-4" />} text="Fine-tune with the nudgers" />
            <GuideRow icon={<GripVertical className="h-4 w-4" />} text="Drag to reorder lines" />
          </div>
        </section>
        <section className="surface p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="label">Validation</div>
            {issues.length > 0 && <span className="chip accent">{issues.length}</span>}
          </div>
          {issues.length === 0 ? (
            <span className="chip live">
              <Check className="h-3 w-3" />
              Clean
            </span>
          ) : (
            <div className="grid gap-2">
              {issues.slice(0, 5).map((issue) => (
                <button
                  key={`${issue.index}-${issue.message}`}
                  type="button"
                  onClick={() => issue.index >= 0 && setCursor(issue.index)}
                  className="surface-flat flex gap-2 p-3 text-left text-sm text-[var(--warn)]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {issue.message}
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="surface p-5">
          <div className="label mb-3">Offset & draft</div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="label">Lyric offset</span>
            <div className="flex items-center gap-1 rounded-full bg-[var(--card-2)] p-1">
              <button
                type="button"
                onClick={() => setOffsetMs((value) => value - 50)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--ink)]"
                title="-50 ms"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="mono min-w-16 text-center text-sm font-bold">{offsetMs} ms</span>
              <button
                type="button"
                onClick={() => setOffsetMs((value) => value + 50)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--ink)]"
                title="+50 ms"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line-2)] pt-4">
            <span className="text-sm text-[var(--muted)]">
              {savedAt ? (
                <>
                  Draft saved <span className="mono">{savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              ) : (
                'No draft saved yet'
              )}
            </span>
            <button type="button" onClick={() => downloadEditorLrc(lines, offsetMs, 'lyrics.lrc')} className="pill ghost sm">
              <PillIcon>
                <DownloadCloud className="h-3.5 w-3.5" />
              </PillIcon>
              .lrc
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={onFetchLyrics} disabled={running.has('Lyrics fetch')} className="pill ghost sm w-full">
              <PillIcon>
                {running.has('Lyrics fetch') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
              </PillIcon>
              Fetch lyrics
            </button>
            <button
              type="button"
              onClick={syncedLyrics ? onRerunLyrics : onAlignLyrics}
              disabled={!canAlign || running.has('Lyrics alignment')}
              className="pill sm w-full"
              title={
                syncedLyrics
                  ? lyricsStale
                    ? 'Newer alignment model available — re-align'
                    : 'Re-align lyrics with the latest model'
                  : 'Auto-align lyrics to the audio'
              }
            >
              <PillIcon>
                {running.has('Lyrics alignment') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListMusic className="h-3.5 w-3.5" />}
              </PillIcon>
              {syncedLyrics ? 'Re-align' : 'Auto-align'}
              {lyricsStale && syncedLyrics && !running.has('Lyrics alignment') && (
                <span className="pulse h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden />
              )}
            </button>
          </div>
        </section>
        </div>
      </aside>
    </div>
  );
}

function TimestampControl({
  value,
  active,
  onSeek,
  onChange,
}: {
  value: number | null;
  active: boolean;
  onSeek: () => void;
  onChange: (time: number | null) => void;
}) {
  if (value === null) {
    return <span className="mono min-w-[86px] text-center text-xs font-bold text-[var(--faint)]">--:--.--</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(roundTime(value - 0.1))}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--ink)]"
        title="-100 ms"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSeek}
        className={`mono min-w-[70px] rounded-[7px] px-1 py-0.5 text-center text-xs font-bold ${active ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : ''}`}
        title="Seek here"
      >
        {formatTimestamp(value)}
      </button>
      <button
        type="button"
        onClick={() => onChange(roundTime(value + 0.1))}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--ink)]"
        title="+100 ms"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function GuideRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--card-2)] text-[var(--muted)]">{icon}</span>
      <span className="font-medium">{text}</span>
    </div>
  );
}

function ImportLyricsModal({
  initialText,
  onClose,
  onImport,
}: {
  initialText: string;
  onClose: () => void;
  onImport: (lines: EditorLyricLine[]) => void;
}) {
  const [text, setText] = useState(initialText);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[oklch(0.2_0.01_60_/_0.35)] p-6 backdrop-blur-sm" onClick={onClose}>
      <section className="surface w-[min(620px,100%)] p-6 shadow-[var(--shadow-pop)]" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="display text-2xl">Import lyrics</h3>
          <button type="button" onClick={onClose} className="iconbtn" aria-label="Close import">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
          Paste plain lyrics, one line each, or a timestamped .lrc file. Timecodes are detected automatically.
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-56 w-full resize-y rounded-[12px] border-0 bg-[var(--paper)] p-4 font-mono text-sm leading-6 outline-none shadow-[inset_0_0_0_1.5px_var(--line)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="pill ghost sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onImport(parseEditorLyricInput(text));
              onClose();
            }}
            className="pill sm"
          >
            <PillIcon>
              <Check className="h-3.5 w-3.5" />
            </PillIcon>
            Import
          </button>
        </div>
      </section>
    </div>
  );
}

function AICoachDock({
  context,
  song,
  syncedLyrics,
  musicXmlAsset,
  onClose,
}: {
  context: StudioTab;
  song: SongSummary | null;
  syncedLyrics: LyricsRow | undefined;
  musicXmlAsset: AssetSummary | undefined;
  onClose: () => void;
}) {
  const suggestions = {
    karaoke: [
      {
        tag: 'Timing',
        text: syncedLyrics ? 'Synced lyrics are ready. Review the chorus against the vocal stem before exporting.' : 'Fetch or write lyrics, then align them against the vocal stem.',
        action: syncedLyrics ? 'Review timing' : 'Prepare lyrics',
      },
      { tag: 'Practice', text: 'Loop the hardest phrase and drop playback speed until it feels stable.', action: 'Loop slow' },
    ],
    guitar: [
      {
        tag: 'Notation',
        text: musicXmlAsset ? 'Score output is ready for inspection in Sheet or Tab mode.' : 'Run MIDI and MusicXML to produce practice notation.',
        action: musicXmlAsset ? 'Open score' : 'Build notation',
      },
      { tag: 'Technique', text: 'Start with chord shapes, then move to tab once the progression is under your fingers.', action: 'Show shapes' },
    ],
    lyrics: [
      { tag: 'Sync', text: 'Save plain lyrics first, then use Karaoke alignment to generate timed lines.', action: 'Sync draft' },
      { tag: 'Cleanup', text: 'Keep repeated chorus lines in full text for now so timing stays explicit.', action: 'Review repeats' },
    ],
  } satisfies Record<StudioTab, Array<{ tag: string; text: string; action: string }>>;

  return (
    <aside
      className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-[var(--radius)] bg-[var(--card)] shadow-[var(--shadow-card)]"
      style={{ width: 'clamp(280px, 24vw, 360px)' }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line-2)] p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--ink)] text-[var(--paper)]">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-bold">Coach</h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--live)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--live)]" />
              watching this session
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="iconbtn" aria-label="Close coach">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {song && (
          <div className="mb-4 flex items-center gap-3 rounded-[12px] bg-[var(--card-2)] p-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <CoverArt id={song.id} size={38} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{song.title}</div>
              <div className="truncate text-xs text-[var(--muted)]">{song.artist ?? 'Unknown artist'}</div>
            </div>
            <div className="ml-auto">
              <StatusDot status={song.status} />
            </div>
          </div>
        )}
        <div className="label mb-3">Noticed just now</div>
        <div className="grid gap-3">
          {suggestions[context].map((suggestion) => (
            <div key={suggestion.tag} className="surface-flat p-4">
              <div className="chip accent mb-3">{suggestion.tag}</div>
              <p className="text-sm leading-6">{suggestion.text}</p>
              <button type="button" className="pill sm mt-4 w-full">
                <PillIcon>
                  <Sparkles className="h-3.5 w-3.5" />
                </PillIcon>
                {suggestion.action}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--line-2)] p-4">
        <div className="flex items-center gap-2 rounded-full bg-[var(--paper)] py-1 pl-4 pr-1 shadow-[inset_0_0_0_1.5px_var(--line)]">
          <input
            placeholder="Ask about timing, theory, technique"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--faint)]"
          />
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)]" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  ctas,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  ctas: Array<{ label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; variant?: 'ghost' }>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="mb-2 grid h-14 w-14 place-items-center rounded-[14px] bg-[var(--card-2)] text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-2)]">
        {icon}
      </span>
      <h3 className="display text-2xl">{title}</h3>
      <p className="max-w-xs text-sm leading-6 text-[var(--muted)]">{desc}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {ctas.map((cta) => (
          <button key={cta.label} type="button" onClick={cta.onClick} disabled={cta.disabled} className={`pill sm ${cta.variant ?? ''}`}>
            <PillIcon>{cta.icon}</PillIcon>
            {cta.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ensureStemMix(assets: AssetSummary[], current: Record<string, StemMixState>) {
  const next: Record<string, StemMixState> = {};
  for (const asset of assets.filter((item) => stemKindSet.has(item.kind))) {
    next[asset.id] = {
      ...defaultStemMix(asset),
      ...current[asset.id],
    };
  }
  return next;
}

function dedupeLatestStemAssets(stemAssets: AssetSummary[]) {
  const byKind = new Map<string, AssetSummary>();
  for (const asset of stemAssets) {
    const current = byKind.get(asset.kind);
    if (!current || assetCreatedAtMs(asset) > assetCreatedAtMs(current)) {
      byKind.set(asset.kind, asset);
    }
  }
  return Array.from(byKind.values()).sort((a, b) => stemKindOrder.indexOf(a.kind) - stemKindOrder.indexOf(b.kind));
}

function assetCreatedAtMs(asset: AssetSummary) {
  const value = new Date(asset.created_at).getTime();
  return Number.isFinite(value) ? value : 0;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const nextById = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    nextById.set(item.id, item);
  }
  return Array.from(nextById.values());
}

function normalizeLyricsPayload(value: WorkflowResult['lyrics']) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function sortAssetsByCreatedAt(a: AssetSummary, b: AssetSummary) {
  return compareIsoDesc(a.created_at, b.created_at);
}

function sortAnalysisResultsByCreatedAt(a: AnalysisResultRow, b: AnalysisResultRow) {
  return compareIsoDesc(a.created_at, b.created_at);
}

function sortLyricsByUpdatedAt(a: LyricsRow, b: LyricsRow) {
  return compareIsoDesc(a.updated_at, b.updated_at);
}

function compareIsoDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function defaultStemMix(asset: AssetSummary): StemMixState {
  return {
    level: defaultStemLevels[asset.kind] ?? 82,
    muted: false,
    solo: false,
  };
}

function stemLabel(kind: string) {
  return kind.replace('stem_', '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderLyricWords(text: string) {
  return text.split(/(\s+)/).map((part, index) =>
    part.trim() ? (
      <span key={`${part}-${index}`} data-lyric-word="true">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function findLatestPlainLyrics(lyrics: LyricsRow[]) {
  return lyrics
    .filter((item) => item.lyrics_type === 'plain')
    .sort(sortLyricsByUpdatedAt)[0];
}

function findActiveSyncedLyrics(lyrics: LyricsRow[], plainLyrics: LyricsRow | undefined) {
  const plainUpdatedAt = getLyricsUpdatedAt(plainLyrics);
  const candidates = lyrics
    .filter((item) => item.lyrics_type === 'lrc' || item.lyrics_type === 'alignment_json')
    .sort(sortLyricsByUpdatedAt);

  for (const candidate of candidates) {
    const candidateUpdatedAt = getLyricsUpdatedAt(candidate);
    const isCurrent = plainUpdatedAt === null || candidateUpdatedAt === null || candidateUpdatedAt >= plainUpdatedAt;
    if (isCurrent && parseSyncedLyricsRow(candidate).length > 0) {
      return candidate;
    }
  }

  return undefined;
}

function getLyricsUpdatedAt(lyrics: LyricsRow | undefined) {
  if (!lyrics) {
    return null;
  }

  const value = new Date(lyrics.updated_at).getTime();
  return Number.isFinite(value) ? value : null;
}

function getStemVolume(source: StemPlaybackSource, anySolo: boolean) {
  if (source.muted || (anySolo && !source.solo)) {
    return 0;
  }
  return Math.min(1, Math.max(0, source.level / 100));
}

function buildEditorLyricLines(
  syncedLyrics: LyricsRow | undefined,
  plainLyrics: LyricsRow | undefined,
  lyricsDraft: string
): EditorLyricLine[] {
  if (syncedLyrics?.lyrics_type === 'lrc' && syncedLyrics.content) {
    const lrcLines = parseEditorLyricInput(syncedLyrics.content);
    if (lrcLines.length > 0) {
      return lrcLines;
    }
  }

  const displayLines = deriveLyricLines(syncedLyrics, plainLyrics);
  if (displayLines.length > 0) {
    return displayLines.map((line, index) => ({
      id: line.id || `line-${index}`,
      time: line.timestamp,
      text: line.text,
    }));
  }

  return parseEditorLyricInput(lyricsDraft);
}

function parseEditorLyricInput(text: string): EditorLyricLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, index) => {
      const line = raw.trim();
      if (!line) {
        return null;
      }
      const untimedMatch = line.match(/^\[--:--(?:[.:]--)?\]\s*(.*)$/);
      if (untimedMatch) {
        return { id: `plain-${index}`, time: null, text: untimedMatch[1].trim() };
      }
      const match = line.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d+))?\]\s*(.*)$/);
      if (!match) {
        return { id: `plain-${index}`, time: null, text: line };
      }
      const fractionalSeconds = match[3] ? Number(`0.${match[3]}`) : 0;
      const time = Number(match[1]) * 60 + Number(match[2]) + fractionalSeconds;
      return { id: `import-${index}`, time: roundTime(time), text: match[4].trim() };
    })
    .filter((line): line is EditorLyricLine => Boolean(line));
}

function editorLinesToPlain(lines: EditorLyricLine[]) {
  return lines.map((line) => line.text).join('\n');
}

function editorLinesToLrc(lines: EditorLyricLine[], offsetMs: number) {
  return lines
    .map((line) => {
      const shifted = line.time === null ? null : Math.max(0, line.time - offsetMs / 1000);
      const timestamp = shifted === null ? '[--:--.--]' : `[${formatTimestamp(shifted)}]`;
      return `${timestamp} ${line.text}`;
    })
    .join('\n');
}

function downloadEditorLrc(lines: EditorLyricLine[], offsetMs: number, filename: string) {
  const blob = new Blob([editorLinesToLrc(lines, offsetMs)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function roundTime(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function formatTimestamp(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const centiseconds = Math.floor((safe % 1) * 100);
  return `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function deriveLyricLines(syncedLyrics: LyricsRow | undefined, plainLyrics: LyricsRow | undefined): LyricDisplayLine[] {
  if (syncedLyrics) {
    const syncedLines = parseSyncedLyricsRow(syncedLyrics);
    if (syncedLines.length > 0) {
      return syncedLines;
    }
  }

  if (plainLyrics?.content) {
    return plainLyrics.content
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ id: `plain-${index}`, timestamp: null, text }));
  }

  return [];
}

function parseSyncedLyricsRow(syncedLyrics: LyricsRow): LyricDisplayLine[] {
  if (syncedLyrics.lyrics_type === 'lrc' && syncedLyrics.content) {
    return parseLrc(syncedLyrics.content).map((line, index) => ({
      id: `lrc-${syncedLyrics.id}-${index}`,
      timestamp: line.timestamp,
      text: line.text,
    }));
  }

  if (syncedLyrics.lyrics_type === 'alignment_json' && syncedLyrics.content) {
    return parseAlignmentLyrics(syncedLyrics.content);
  }

  return [];
}

function parseAlignmentLyrics(content: string): LyricDisplayLine[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    const candidate =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'lines' in parsed
        ? (parsed as { lines?: unknown }).lines
        : parsed;
    if (!Array.isArray(candidate)) {
      return [];
    }
    return candidate
      .map((line, index) => {
        if (!line || typeof line !== 'object') {
          return null;
        }
        const objectLine = line as { text?: unknown; start?: unknown; time?: unknown; timestamp?: unknown };
        const text = typeof objectLine.text === 'string' ? objectLine.text : '';
        const rawTime = objectLine.start ?? objectLine.time ?? objectLine.timestamp;
        const timestamp = typeof rawTime === 'number' ? rawTime : null;
        return text ? { id: `aligned-${index}`, timestamp, text } : null;
      })
      .filter((line): line is LyricDisplayLine => Boolean(line));
  } catch {
    return [];
  }
}

// Analysis derivations (sections, chords, key/tempo, song facts) live in
// `@/lib/music/analysis-overview` — shared with the server-side `studio_overview`
// summary so the on-screen render and the stored summary can never drift.

function formatSeconds(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  return `${minutes}:${wholeSeconds.toString().padStart(2, '0')}`;
}
