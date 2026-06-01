import { createBrowserAudioContext } from '@/lib/music/waveform/audio-context';
import type { DetailedWaveformData, WaveformData } from '@/lib/music/waveform/types';

export async function extractWaveform(audioUrl: string, samplesPerPixel = 512): Promise<WaveformData> {
  const audioContext = createBrowserAudioContext();

  try {
    const audioBuffer = await decodeAudioUrl(audioContext, audioUrl);
    const channelData = audioBuffer.getChannelData(0);
    const peakCount = Math.ceil(channelData.length / samplesPerPixel);
    const peaks = new Float32Array(peakCount);

    for (let index = 0; index < peakCount; index += 1) {
      const start = index * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      let max = 0;

      for (let sample = start; sample < end; sample += 1) {
        max = Math.max(max, Math.abs(channelData[sample]));
      }

      peaks[index] = max;
    }

    return {
      peaks,
      length: peakCount,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
    };
  } finally {
    await audioContext.close();
  }
}

export async function extractDetailedWaveform(audioUrl: string, width: number): Promise<DetailedWaveformData> {
  const audioContext = createBrowserAudioContext();

  try {
    const audioBuffer = await decodeAudioUrl(audioContext, audioUrl);
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(channelData.length / width));
    const min = new Float32Array(width);
    const max = new Float32Array(width);

    for (let index = 0; index < width; index += 1) {
      const start = index * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      let minValue = Infinity;
      let maxValue = -Infinity;

      for (let sample = start; sample < end; sample += 1) {
        const value = channelData[sample];
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }

      min[index] = minValue === Infinity ? 0 : minValue;
      max[index] = maxValue === -Infinity ? 0 : maxValue;
    }

    return {
      min,
      max,
      duration: audioBuffer.duration,
    };
  } finally {
    await audioContext.close();
  }
}

async function decodeAudioUrl(audioContext: AudioContext, audioUrl: string) {
  const response = await fetch(audioUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch audio file: ${response.statusText}`);
  }

  return audioContext.decodeAudioData(await response.arrayBuffer());
}
