'use client';

import { formatTime } from '@/lib/music/lrc';
import { getNoteColor, getPitchRange, type MidiNote, type MidiParsedData } from '@/lib/music/midi';
import type { DetailedWaveformData } from '@/lib/music/waveform';

export function WaveformPanel({
  waveform,
  error,
  selectedSection,
}: {
  waveform: DetailedWaveformData | null;
  error: string | null;
  selectedSection: { start: number; end: number } | null;
}) {
  if (error) {
    return <EmptyPanel text={error} />;
  }

  if (!waveform) {
    return <EmptyPanel text="No waveform is available yet." />;
  }

  const bars = compactWaveform(waveform, 180);
  const selectedStart = selectedSection ? (selectedSection.start / waveform.duration) * 180 : null;
  const selectedWidth =
    selectedSection && waveform.duration > 0
      ? Math.max(1, ((selectedSection.end - selectedSection.start) / waveform.duration) * 180)
      : null;

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <svg viewBox="0 0 180 72" className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Audio waveform">
        {selectedStart !== null && selectedWidth !== null && (
          <rect x={selectedStart} y="0" width={selectedWidth} height="72" fill="rgba(94, 224, 194, 0.18)" />
        )}
        {bars.map((bar) => (
          <line
            key={bar.x}
            x1={bar.x}
            x2={bar.x}
            y1={36 - bar.height}
            y2={36 + bar.height}
            stroke="var(--accent-strong)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="muted mt-2 flex justify-between text-xs">
        <span>0:00</span>
        <span>{formatTime(waveform.duration)}</span>
      </div>
    </div>
  );
}

export function PianoPanel({
  midiData,
  error,
  selectedSection,
  onSelectSection,
}: {
  midiData: MidiParsedData | null;
  error: string | null;
  selectedSection: { start: number; end: number } | null;
  onSelectSection: (section: { start: number; end: number }) => void;
}) {
  if (error) {
    return <EmptyPanel text={error} />;
  }

  if (!midiData) {
    return <EmptyPanel text="No MIDI asset is available yet." />;
  }

  const range = getPitchRange(midiData.notes);
  const pitchSpan = Math.max(1, range.max - range.min);
  const timelineWidth = Math.max(720, midiData.duration * 96);

  return (
    <div className="overflow-x-auto rounded-md border border-white/10 bg-black/20">
      <div className="relative h-80" style={{ width: `${timelineWidth}px` }}>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:96px_20px]" />
        {selectedSection && (
          <div
            className="absolute top-0 h-full bg-[var(--accent)]/10"
            style={{
              left: `${(selectedSection.start / midiData.duration) * timelineWidth}px`,
              width: `${Math.max(2, ((selectedSection.end - selectedSection.start) / midiData.duration) * timelineWidth)}px`,
            }}
          />
        )}
        {midiData.notes.map((note, index) => (
          <MidiNoteBlock
            key={`${note.pitch}-${note.time}-${index}`}
            note={note}
            rangeMin={range.min}
            pitchSpan={pitchSpan}
            duration={midiData.duration}
            timelineWidth={timelineWidth}
            onSelectSection={onSelectSection}
          />
        ))}
      </div>
      <div className="muted flex justify-between border-t border-white/10 px-3 py-2 text-xs">
        <span>{formatTime(0)}</span>
        <span>
          {midiData.tempo.toFixed(0)} BPM - {midiData.timeSignature.join('/')}
        </span>
        <span>{formatTime(midiData.duration)}</span>
      </div>
    </div>
  );
}

function MidiNoteBlock({
  note,
  rangeMin,
  pitchSpan,
  duration,
  timelineWidth,
  onSelectSection,
}: {
  note: MidiNote;
  rangeMin: number;
  pitchSpan: number;
  duration: number;
  timelineWidth: number;
  onSelectSection: (section: { start: number; end: number }) => void;
}) {
  const left = (note.time / duration) * timelineWidth;
  const width = Math.max(4, (note.duration / duration) * timelineWidth);
  const bottom = ((note.pitch - rangeMin) / pitchSpan) * 290 + 8;

  return (
    <button
      type="button"
      title={`${note.pitchName} ${formatTime(note.time)}`}
      onClick={() => onSelectSection({ start: note.time, end: note.time + Math.max(note.duration, 0.25) })}
      className="absolute h-2 rounded-sm opacity-90 outline-none ring-offset-0 hover:opacity-100 focus:ring-1 focus:ring-white"
      style={{
        left,
        bottom,
        width,
        background: getNoteColor(note.pitch),
      }}
    />
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-400">{text}</div>;
}

function compactWaveform(waveform: DetailedWaveformData, width: number) {
  const step = Math.max(1, Math.floor(waveform.max.length / width));
  const bars: Array<{ x: number; height: number }> = [];

  for (let index = 0; index < width; index += 1) {
    const sourceIndex = Math.min(index * step, waveform.max.length - 1);
    const amplitude = Math.max(Math.abs(waveform.min[sourceIndex] ?? 0), Math.abs(waveform.max[sourceIndex] ?? 0));
    bars.push({
      x: index,
      height: Math.max(1, amplitude * 34),
    });
  }

  return bars;
}
