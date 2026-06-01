export type WaveformData = {
  peaks: Float32Array;
  length: number;
  duration: number;
  sampleRate: number;
};

export type DetailedWaveformData = {
  min: Float32Array;
  max: Float32Array;
  duration: number;
};

export type SpectrogramData = {
  data: number[][];
  frequencyBinCount: number;
  duration: number;
  sampleRate: number;
};
