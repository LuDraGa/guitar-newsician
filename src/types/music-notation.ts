export type MusicXmlData = {
  musicxml: string;
  measures: number;
  key: string;
  time_signature: string;
  tempo?: number;
};

export type SheetMusicNote = {
  id: string;
  pitch: string;
  duration: string;
  measure: number;
  beat: number;
  x: number;
  y: number;
};

export type SheetMusicSection = {
  start: number;
  end: number;
  startTime: number;
  endTime: number;
};
