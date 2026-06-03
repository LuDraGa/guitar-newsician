export type MusicXmlNotePreview = {
  id: string;
  pitch: string;
  midi: number | null;
  duration: number | null;
  durationBeats: number | null;
  type: string | null;
  rest: boolean;
  chord: boolean;
};

export type MusicXmlMeasurePreview = {
  number: string;
  notes: MusicXmlNotePreview[];
};

export type MusicXmlPreviewData = {
  title: string | null;
  partCount: number;
  measureCount: number;
  noteCount: number;
  restCount: number;
  divisions: number;
  key: string | null;
  timeSignature: string | null;
  measures: MusicXmlMeasurePreview[];
};

export type GuitarTabPosition = {
  stringNumber: number;
  stringName: string;
  fret: number;
};

const fifthsToKey = new Map<number, string>([
  [-7, 'Cb'],
  [-6, 'Gb'],
  [-5, 'Db'],
  [-4, 'Ab'],
  [-3, 'Eb'],
  [-2, 'Bb'],
  [-1, 'F'],
  [0, 'C'],
  [1, 'G'],
  [2, 'D'],
  [3, 'A'],
  [4, 'E'],
  [5, 'B'],
  [6, 'F#'],
  [7, 'C#'],
]);

const guitarTuning = [
  { stringNumber: 1, stringName: 'E4', midi: 64 },
  { stringNumber: 2, stringName: 'B3', midi: 59 },
  { stringNumber: 3, stringName: 'G3', midi: 55 },
  { stringNumber: 4, stringName: 'D3', midi: 50 },
  { stringNumber: 5, stringName: 'A2', midi: 45 },
  { stringNumber: 6, stringName: 'E2', midi: 40 },
] as const;

export function parseMusicXmlPreview(source: string): MusicXmlPreviewData {
  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];

  if (parserError) {
    throw new Error(parserError.textContent?.trim() || 'MusicXML could not be parsed');
  }

  const parts = Array.from(document.getElementsByTagName('part'));
  const primaryPart = parts[0] ?? null;
  const measureElements = primaryPart ? Array.from(primaryPart.getElementsByTagName('measure')) : [];
  const divisions = readNumber(document, 'divisions') ?? 1;
  const measures = measureElements.map((measure, measureIndex) => parseMeasure(measure, measureIndex, divisions));
  const allNotes = measures.flatMap((measure) => measure.notes);

  return {
    title: readTitle(document),
    partCount: parts.length,
    measureCount: measureElements.length,
    noteCount: allNotes.filter((note) => !note.rest).length,
    restCount: allNotes.filter((note) => note.rest).length,
    divisions,
    key: readKey(document),
    timeSignature: readTimeSignature(document),
    measures,
  };
}

export function estimateGuitarTabPosition(midi: number): GuitarTabPosition | null {
  const matches = guitarTuning
    .map((string) => ({
      stringNumber: string.stringNumber,
      stringName: string.stringName,
      fret: midi - string.midi,
    }))
    .filter((position) => position.fret >= 0 && position.fret <= 24)
    .sort((left, right) => left.fret - right.fret || left.stringNumber - right.stringNumber);

  return matches[0] ?? null;
}

function parseMeasure(measure: Element, measureIndex: number, divisions: number): MusicXmlMeasurePreview {
  const notes = Array.from(measure.getElementsByTagName('note')).map((note, noteIndex) =>
    parseNote(note, measureIndex, noteIndex, divisions)
  );

  return {
    number: measure.getAttribute('number') ?? String(measureIndex + 1),
    notes,
  };
}

function parseNote(note: Element, measureIndex: number, noteIndex: number, divisions: number): MusicXmlNotePreview {
  const rest = Boolean(note.getElementsByTagName('rest')[0]);
  const chord = Boolean(note.getElementsByTagName('chord')[0]);
  const duration = readNumber(note, 'duration');
  const type = readText(note, 'type');
  const pitch = rest ? null : readPitch(note);

  return {
    id: `${measureIndex}-${noteIndex}`,
    pitch: pitch?.label ?? 'Rest',
    midi: pitch?.midi ?? null,
    duration,
    durationBeats: duration === null ? null : duration / Math.max(divisions, 1),
    type,
    rest,
    chord,
  };
}

function readPitch(note: Element): { label: string; midi: number } | null {
  const pitch = note.getElementsByTagName('pitch')[0];
  if (!pitch) {
    return null;
  }

  const step = readText(pitch, 'step');
  const octave = readNumber(pitch, 'octave');
  const alter = readNumber(pitch, 'alter') ?? 0;
  if (!step || octave === null) {
    return null;
  }

  const accidental = accidentalLabel(alter);
  const label = `${step}${accidental}${octave}`;
  const midi = pitchToMidi(step, alter, octave);

  return { label, midi };
}

function readTitle(document: Document) {
  return (
    readText(document.documentElement, 'work-title') ??
    readText(document.documentElement, 'movement-title') ??
    readText(document.documentElement, 'part-name')
  );
}

function readKey(document: Document) {
  const fifths = readNumber(document, 'fifths');
  const mode = readText(document.documentElement, 'mode');
  if (fifths === null) {
    return null;
  }

  const key = fifthsToKey.get(fifths) ?? `${fifths} fifths`;
  return mode ? `${key} ${mode}` : key;
}

function readTimeSignature(document: Document) {
  const beats = readText(document.documentElement, 'beats');
  const beatType = readText(document.documentElement, 'beat-type');
  return beats && beatType ? `${beats}/${beatType}` : null;
}

function readText(parent: Element, tagName: string) {
  return parent.getElementsByTagName(tagName)[0]?.textContent?.trim() || null;
}

function readNumber(parent: Element | Document, tagName: string) {
  const text = parent.getElementsByTagName(tagName)[0]?.textContent?.trim();
  if (!text) {
    return null;
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function pitchToMidi(step: string, alter: number, octave: number) {
  const semitones: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  return (octave + 1) * 12 + (semitones[step.toUpperCase()] ?? 0) + alter;
}

function accidentalLabel(alter: number) {
  if (alter > 0) {
    return '#'.repeat(alter);
  }
  if (alter < 0) {
    return 'b'.repeat(Math.abs(alter));
  }

  return '';
}
