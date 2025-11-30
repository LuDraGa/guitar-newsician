// Studio component shared types and interfaces

export type StemType = 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'other'

export type VisualizerView = 'waveform' | 'spectrogram' | 'equalizer'

export type OverlayType = 'beats' | 'chords' | 'sections'

export interface StemState {
  type: StemType
  muted: boolean
  solo: boolean
  volume: number // 0-1
}

export interface PlaybackState {
  isPlaying: boolean
  currentTime: number // seconds
  duration: number // seconds
  speed: number // 0.5 - 2.0
  loopEnabled: boolean
  loopStart: number | null // seconds
  loopEnd: number | null // seconds
  metronomeEnabled: boolean
  masterVolume: number // 0-1
  maxVolume: number // 0-1, overall limiter
}

export interface VisualizerState {
  view: VisualizerView
  overlays: Set<OverlayType>
}

export interface LyricsState {
  autoScroll: boolean
  offset: number // milliseconds, can be negative
}

export interface LyricLine {
  timestamp: number // seconds
  text: string
}
