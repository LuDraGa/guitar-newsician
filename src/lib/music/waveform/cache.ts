import { extractDetailedWaveform, extractWaveform } from '@/lib/music/waveform/extract';
import { extractSpectrogramData } from '@/lib/music/waveform/spectrogram';
import type { DetailedWaveformData, SpectrogramData, WaveformData } from '@/lib/music/waveform/types';

const waveformCache = new Map<string, WaveformData>();
const detailedWaveformCache = new Map<string, DetailedWaveformData>();
const spectrogramCache = new Map<string, SpectrogramData>();

export async function getCachedWaveform(audioUrl: string, samplesPerPixel = 512): Promise<WaveformData> {
  const cacheKey = `${audioUrl}:${samplesPerPixel}`;
  const cached = waveformCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const waveform = await extractWaveform(audioUrl, samplesPerPixel);
  waveformCache.set(cacheKey, waveform);

  return waveform;
}

export async function getCachedDetailedWaveform(audioUrl: string, width: number): Promise<DetailedWaveformData> {
  const cacheKey = `${audioUrl}:${width}`;
  const cached = detailedWaveformCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const waveform = await extractDetailedWaveform(audioUrl, width);
  detailedWaveformCache.set(cacheKey, waveform);

  return waveform;
}

export async function getCachedSpectrogramData(
  audioUrl: string,
  targetWidth = 300,
  fftSize = 2048
): Promise<SpectrogramData> {
  const cacheKey = `${audioUrl}:${targetWidth}:${fftSize}`;
  const cached = spectrogramCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const spectrogram = await extractSpectrogramData(audioUrl, targetWidth, fftSize);
  spectrogramCache.set(cacheKey, spectrogram);

  return spectrogram;
}

export function clearWaveformCache() {
  waveformCache.clear();
  detailedWaveformCache.clear();
  spectrogramCache.clear();
}
