import { Midi } from '@tonejs/midi';

export type MidiNote = {
  pitch: number;
  pitchName: string;
  time: number;
  duration: number;
  velocity: number;
};

export type MidiParsedData = {
  notes: MidiNote[];
  duration: number;
  tempo: number;
  timeSignature: [number, number];
};

export async function parseMidiUrl(midiUrl: string, init?: RequestInit): Promise<MidiParsedData> {
  const response = await fetch(midiUrl, {
    cache: 'no-store',
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch MIDI file: ${response.statusText}`);
  }

  return parseMidiArrayBuffer(await response.arrayBuffer());
}

export function parseMidiArrayBuffer(arrayBuffer: ArrayBuffer): MidiParsedData {
  const midi = new Midi(arrayBuffer);
  const notes = midi.tracks
    .flatMap((track) =>
      track.notes.map((note) => ({
        pitch: note.midi,
        pitchName: note.name,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
      }))
    )
    .sort((a, b) => a.time - b.time);

  return {
    notes,
    duration: midi.duration,
    tempo: midi.header.tempos[0]?.bpm ?? 120,
    timeSignature: toTimeSignatureTuple(midi.header.timeSignatures[0]?.timeSignature),
  };
}

export function getPitchRange(notes: MidiNote[]): { min: number; max: number } {
  if (notes.length === 0) {
    return { min: 60, max: 72 };
  }

  const pitches = notes.map((note) => note.pitch);

  return {
    min: Math.min(...pitches),
    max: Math.max(...pitches),
  };
}

export function midiToFrequency(midi: number): number {
  return 2 ** ((midi - 69) / 12) * 440;
}

export function getNoteColor(pitch: number): string {
  const colors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
  ] as const;

  return colors[pitch % 12];
}

function toTimeSignatureTuple(timeSignature?: number[]): [number, number] {
  return [timeSignature?.[0] ?? 4, timeSignature?.[1] ?? 4];
}
