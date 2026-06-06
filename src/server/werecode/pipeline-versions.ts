/**
 * Pipeline stage version registry.
 *
 * One version string per re-runnable stage. Bump the string whenever the
 * backend/Modal model, weights, or default params for that stage change — that
 * bump is the *only* staleness signal the app needs. Any song whose current
 * output carries an older `pipeline_version` (or null, for pre-versioning runs)
 * is then surfaced as "a newer model is available — re-run".
 *
 * Importable from both client and server (no `server-only`): the Studio computes
 * staleness in the browser, the workflows stamp + supersede on the server.
 */
import type { AssetKind } from '@/types/werecode';

export type PipelineStage = 'separate' | 'analyze' | 'midi_transcribe' | 'lyrics_align';

export type PipelineStageInfo = {
  /** Bump on any model/param change for this stage. */
  version: string;
  /** Human label for the staleness banner. */
  label: string;
  /** Workflow API path used to re-run this stage. */
  endpoint: string;
};

export const PIPELINE_VERSIONS: Record<PipelineStage, PipelineStageInfo> = {
  separate: {
    version: '2026-06-htdemucs_6s.r1',
    label: 'Stem separation',
    endpoint: '/api/workflows/separate',
  },
  analyze: {
    version: '2026-06-msaf.r1',
    label: 'Analysis',
    endpoint: '/api/workflows/analyze',
  },
  midi_transcribe: {
    version: '2026-06-basicpitch.r1',
    label: 'MIDI transcription',
    endpoint: '/api/workflows/midi/transcribe',
  },
  lyrics_align: {
    version: '2026-06-whisperx.r1',
    label: 'Lyrics alignment',
    endpoint: '/api/workflows/lyrics/align',
  },
};

/**
 * Representative current-asset kinds that carry a stage's `pipeline_version`.
 * Staleness and supersede operate on these kinds.
 */
export const STAGE_ASSET_KINDS: Record<PipelineStage, AssetKind[]> = {
  separate: ['stem_vocals', 'stem_drums', 'stem_bass', 'stem_other', 'stem_guitar', 'stem_piano'],
  analyze: ['analysis_json'],
  midi_transcribe: ['midi', 'note_events'],
  lyrics_align: ['lyrics_alignment'],
};

export function pipelineVersionFor(stage: PipelineStage): string {
  return PIPELINE_VERSIONS[stage].version;
}

/**
 * Full analyzer set for the analyze stage — mirrors the live registry in
 * `backend/app/analyzers/music_analysis.py` (ANALYZERS).
 *
 * The Studio's first-pass "Analyze" uses the cheap `quick` preset
 * (basic_stats / tempo_beats / tonal_key). A deliberate re-run requests this
 * full set so the heavier `chords` and `structure_msaf` are included too.
 */
export const ANALYZE_FULL_ANALYZERS = [
  'basic_stats',
  'tempo_beats',
  'tonal_key',
  'chords',
  'structure_msaf',
] as const;

const ASSET_KIND_TO_STAGE: ReadonlyMap<AssetKind, PipelineStage> = (() => {
  const map = new Map<AssetKind, PipelineStage>();
  for (const stage of Object.keys(STAGE_ASSET_KINDS) as PipelineStage[]) {
    for (const kind of STAGE_ASSET_KINDS[stage]) {
      map.set(kind, stage);
    }
  }
  return map;
})();

export function stageForAssetKind(kind: AssetKind): PipelineStage | null {
  return ASSET_KIND_TO_STAGE.get(kind) ?? null;
}

export type StalenessInput = { kind: AssetKind; pipeline_version: string | null };

/** Stable display order for stage controls. */
const STAGE_ORDER: PipelineStage[] = ['separate', 'analyze', 'midi_transcribe', 'lyrics_align'];

export type StageStatus = {
  stage: PipelineStage;
  /** True when the current output predates the latest registry version. */
  isStale: boolean;
};

function currentVersionByStage(assets: StalenessInput[]): Map<PipelineStage, string | null> {
  const map = new Map<PipelineStage, string | null>();
  for (const asset of assets) {
    const stage = stageForAssetKind(asset.kind);
    if (!stage) {
      continue;
    }
    // Assets arrive newest-first, so the first seen per stage is the current one.
    if (!map.has(stage)) {
      map.set(stage, asset.pipeline_version);
    }
  }
  return map;
}

/**
 * Given the *current* assets for a song (already filtered to is_current), return
 * every stage that has a completed output — each flagged stale or not. Stages with
 * no output are omitted (nothing to re-run). Re-run is always offered for completed
 * stages; staleness is just an extra "newer model available" hint.
 */
export function computeStageStatuses(assets: StalenessInput[]): StageStatus[] {
  const byStage = currentVersionByStage(assets);
  return STAGE_ORDER.filter((stage) => byStage.has(stage)).map((stage) => ({
    stage,
    isStale: byStage.get(stage) !== PIPELINE_VERSIONS[stage].version,
  }));
}

/** Subset of {@link computeStageStatuses} that are stale. */
export function computeStaleStages(assets: StalenessInput[]): PipelineStage[] {
  return computeStageStatuses(assets)
    .filter((status) => status.isStale)
    .map((status) => status.stage);
}
