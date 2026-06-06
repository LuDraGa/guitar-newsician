export type StemSeparationArtifactFormat = 'flac' | 'wav';

export const DEFAULT_STEM_SEPARATION_ARTIFACT_FORMAT: StemSeparationArtifactFormat = 'flac';
export const STEM_SEPARATION_WAV_DURATION_LIMIT_SEC = 270;

export function getStemSeparationDurationLimitWarning(
  durationSec: number | null | undefined,
  outputFormat: StemSeparationArtifactFormat = 'wav'
) {
  if (outputFormat !== 'wav') {
    return null;
  }

  if (!Number.isFinite(durationSec) || durationSec === null || durationSec === undefined) {
    return null;
  }

  if (durationSec <= STEM_SEPARATION_WAV_DURATION_LIMIT_SEC) {
    return null;
  }

  return `Stem separation is limited to tracks ${formatLimitDuration(STEM_SEPARATION_WAV_DURATION_LIMIT_SEC)} or shorter while WAV stems use Supabase Free storage. This track is ${formatLimitDuration(durationSec)}.`;
}

export function estimateStereoWavBytes(durationSec: number) {
  const sampleRate = 44_100;
  const channels = 2;
  const bytesPerSample = 2;
  const wavHeaderBytes = 44;

  return Math.ceil(durationSec * sampleRate * channels * bytesPerSample + wavHeaderBytes);
}

export function stemSeparationContentType(format: StemSeparationArtifactFormat) {
  return format === 'flac' ? 'audio/flac' : 'audio/wav';
}

function formatLimitDuration(durationSec: number) {
  const totalSeconds = Math.max(0, Math.round(durationSec));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
