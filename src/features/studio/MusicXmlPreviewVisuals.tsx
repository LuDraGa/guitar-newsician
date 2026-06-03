'use client';

import { useMemo } from 'react';

import {
  estimateGuitarTabPosition,
  type GuitarTabPosition,
  type MusicXmlMeasurePreview,
  type MusicXmlNotePreview,
  type MusicXmlPreviewData,
} from '@/lib/music/musicxml';

export function PreviewMetrics({ preview }: { preview: MusicXmlPreviewData }) {
  const metrics = [
    ['Title', preview.title ?? 'Untitled score'],
    ['Parts', preview.partCount],
    ['Measures', preview.measureCount],
    ['Notes', preview.noteCount],
    ['Rests', preview.restCount],
    ['Key', preview.key ?? '--'],
    ['Time', preview.timeSignature ?? '--'],
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <div className="muted text-xs uppercase tracking-wide">{label}</div>
          <div className="mt-1 truncate text-sm text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function SheetPreview({ preview }: { preview: MusicXmlPreviewData }) {
  const notes = useMemo(() => flattenNotes(preview.measures).slice(0, 56), [preview.measures]);
  const pitchedNotes = notes.filter((note) => !note.rest && note.midi !== null);

  if (notes.length === 0) {
    return <EmptyPreview text="No notes were found in this score." />;
  }

  const pitchValues = pitchedNotes.map((note) => note.midi ?? 60);
  const minPitch = Math.min(...pitchValues, 52);
  const maxPitch = Math.max(...pitchValues, 84);
  const pitchSpan = Math.max(1, maxPitch - minPitch);
  const width = Math.max(760, notes.length * 34 + 72);

  return (
    <div className="overflow-x-auto rounded-md border border-white/10 bg-slate-950/70 p-3">
      <svg width={width} height="170" role="img" aria-label="Sheet music preview">
        {[0, 1, 2, 3, 4].map((line) => (
          <line
            key={line}
            x1="28"
            x2={width - 24}
            y1={52 + line * 14}
            y2={52 + line * 14}
            stroke="rgba(226,232,240,0.45)"
            strokeWidth="1"
          />
        ))}
        <text x="32" y="35" fill="rgba(226,232,240,0.72)" fontSize="12">
          {preview.title ?? 'Score'}
        </text>
        {notes.map((note, index) => {
          const x = 54 + index * 32;
          if (note.rest || note.midi === null) {
            return (
              <g key={note.id}>
                <rect x={x - 6} y="76" width="12" height="10" rx="2" fill="rgba(148,163,184,0.7)" />
                <text x={x - 7} y="120" fill="rgba(148,163,184,0.75)" fontSize="10">
                  R
                </text>
              </g>
            );
          }

          const y = 122 - ((note.midi - minPitch) / pitchSpan) * 86;
          return (
            <g key={note.id}>
              <ellipse cx={x} cy={y} rx="8" ry="5" fill="var(--accent-strong)" transform={`rotate(-18 ${x} ${y})`} />
              <line x1={x + 8} x2={x + 8} y1={y} y2={Math.max(36, y - 36)} stroke="var(--accent-strong)" strokeWidth="1.5" />
              <text x={x - 10} y="150" fill="rgba(226,232,240,0.75)" fontSize="10">
                {note.pitch}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TabPreview({ preview }: { preview: MusicXmlPreviewData }) {
  const tabNotes = useMemo(
    () =>
      flattenNotes(preview.measures)
        .filter((note) => !note.rest && note.midi !== null)
        .map((note) => ({ note, position: estimateGuitarTabPosition(note.midi ?? 0) }))
        .filter((entry): entry is { note: MusicXmlNotePreview; position: GuitarTabPosition } => Boolean(entry.position))
        .slice(0, 48),
    [preview.measures]
  );

  if (tabNotes.length === 0) {
    return <EmptyPreview text="No guitar-range notes were found in this score." />;
  }

  const width = Math.max(760, tabNotes.length * 34 + 88);

  return (
    <div className="overflow-x-auto rounded-md border border-white/10 bg-slate-950/70 p-3">
      <svg width={width} height="164" role="img" aria-label="Guitar tablature preview">
        {[1, 2, 3, 4, 5, 6].map((stringNumber) => {
          const y = stringY(stringNumber);
          const stringName = stringNameForNumber(stringNumber);

          return (
            <g key={stringNumber}>
              <text x="18" y={y + 4} fill="rgba(226,232,240,0.72)" fontSize="12">
                {stringName}
              </text>
              <line x1="50" x2={width - 22} y1={y} y2={y} stroke="rgba(226,232,240,0.45)" strokeWidth="1" />
            </g>
          );
        })}
        {tabNotes.map(({ note, position }, index) => {
          const x = 70 + index * 32;
          const y = stringY(position.stringNumber);
          const fretLabel = String(position.fret);
          const labelWidth = fretLabel.length > 1 ? 18 : 14;

          return (
            <g key={note.id}>
              <rect x={x - labelWidth / 2} y={y - 10} width={labelWidth} height="18" rx="4" fill="var(--accent-strong)" />
              <text x={x} y={y + 4} fill="#020617" fontSize="12" fontWeight="700" textAnchor="middle">
                {fretLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function MeasureNoteList({ measures }: { measures: MusicXmlMeasurePreview[] }) {
  const visibleMeasures = measures.slice(0, 10);

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {visibleMeasures.map((measure) => (
        <div key={measure.number} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <div className="muted text-xs uppercase tracking-wide">Measure {measure.number}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {measure.notes.slice(0, 24).map((note) => (
              <span
                key={note.id}
                className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-slate-200"
                title={durationLabel(note)}
              >
                {note.pitch}
              </span>
            ))}
            {measure.notes.length === 0 && <span className="muted text-xs">Empty</span>}
            {measure.notes.length > 24 && <span className="muted px-1 py-1 text-xs">+{measure.notes.length - 24}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyPreview({ text }: { text: string }) {
  return <div className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-400">{text}</div>;
}

function flattenNotes(measures: MusicXmlMeasurePreview[]) {
  return measures.flatMap((measure) => measure.notes);
}

function durationLabel(note: MusicXmlNotePreview) {
  if (note.type) {
    return note.type;
  }
  if (note.durationBeats !== null) {
    return `${formatNumber(note.durationBeats)} beat${note.durationBeats === 1 ? '' : 's'}`;
  }

  return 'Unknown duration';
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function stringY(stringNumber: number) {
  return 24 + (stringNumber - 1) * 22;
}

function stringNameForNumber(stringNumber: number) {
  return ['E', 'B', 'G', 'D', 'A', 'E'][stringNumber - 1] ?? 'E';
}
