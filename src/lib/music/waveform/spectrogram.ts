import { createBrowserAudioContext } from '@/lib/music/waveform/audio-context';
import type { SpectrogramData } from '@/lib/music/waveform/types';

export async function extractSpectrogramData(
  audioUrl: string,
  targetWidth = 300,
  fftSize = 2048
): Promise<SpectrogramData> {
  const audioContext = createBrowserAudioContext();

  try {
    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch audio file: ${response.statusText}`);
    }

    const audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
    const channelData = audioBuffer.getChannelData(0);
    const hopSize = Math.max(1, Math.floor(channelData.length / targetWidth));
    const frequencyBinCount = fftSize / 2;
    const data: number[][] = [];

    for (let frameIndex = 0; frameIndex < targetWidth; frameIndex += 1) {
      const start = frameIndex * hopSize;

      if (start >= channelData.length) {
        break;
      }

      data.push(createMagnitudeFrame(channelData, start, fftSize, frequencyBinCount));
    }

    return {
      data,
      frequencyBinCount,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
    };
  } finally {
    await audioContext.close();
  }
}

function createMagnitudeFrame(channelData: Float32Array, start: number, fftSize: number, frequencyBinCount: number) {
  const frame = new Float32Array(fftSize);

  for (let index = 0; index < fftSize && start + index < channelData.length; index += 1) {
    const windowValue = 0.54 - 0.46 * Math.cos((2 * Math.PI * index) / fftSize);
    frame[index] = channelData[start + index] * windowValue;
  }

  return approximateMagnitudes(frame, fftSize, frequencyBinCount);
}

function approximateMagnitudes(frame: Float32Array, fftSize: number, frequencyBinCount: number) {
  const magnitudes = new Array<number>(frequencyBinCount).fill(0);
  const binStep = Math.max(1, Math.floor(frequencyBinCount / 80));

  for (let bin = 0; bin < frequencyBinCount; bin += binStep) {
    let real = 0;
    let imaginary = 0;

    for (let sample = 0; sample < Math.min(fftSize, 512); sample += 1) {
      const angle = (2 * Math.PI * bin * sample) / fftSize;
      real += frame[sample] * Math.cos(angle);
      imaginary += frame[sample] * Math.sin(angle);
    }

    const magnitude = Math.sqrt(real * real + imaginary * imaginary);
    magnitudes[bin] = magnitude;

    for (let fill = 1; fill < binStep && bin + fill < frequencyBinCount; fill += 1) {
      magnitudes[bin + fill] = magnitude;
    }
  }

  return magnitudes;
}
