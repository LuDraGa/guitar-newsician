export interface MusicXMLData {
  musicxml: string
  measures: number
  key: string
  time_signature: string
  tempo?: number
}

export interface SheetMusicNote {
  id: string
  pitch: string  // e.g., "C#4", "Bb5"
  duration: string  // VexFlow format: "q", "h", "w", "8", "16"
  measure: number
  beat: number
  x: number  // Canvas coordinates for click detection
  y: number
}

export interface SheetMusicSection {
  start: number  // measure number
  end: number
  startTime: number  // in seconds
  endTime: number
}
