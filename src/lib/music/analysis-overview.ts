import type { AnalysisResultRow } from '@/types/werecode';
import type { SongSummary } from '@/types/werecode-client';

// Single source of truth for turning raw analyzer rows into the compact shapes
// the Studio renders (named sections, chord events, key/tempo facts). Both the
// client (live render) and the server (the persisted `studio_overview` summary
// that slims cold `/api/studio` reads) import these, so the stored summary and
// the on-screen render can never drift. Pure module — no React, no server-only.

export type SectionSegment = { start: number; end: number; name: string };
export type ChordEvent = { time: number; endTime: number | null; chord: string };

// Compact summary stored as a single `studio_overview` analysis row and expanded
// back into synthetic analyzer rows on read (see expandStudioOverview).
export type StudioOverviewData = {
  mapped_segments: unknown[];
  chords: ChordEvent[];
  key: string | null;
  scale: string | null;
  bpm: number | null;
};

// Pull the live `structure_msaf` row and turn its mapped_segments into named,
// playhead-comparable spans. The analyzer envelope is stored whole, so the
// segments live at row.data.data.mapped_segments (see persistAnalysisResults).
export function deriveSectionSegments(analysisResults: AnalysisResultRow[]): SectionSegment[] {
  const row =
    analysisResults.find((result) => result.analyzer_name === 'structure_msaf' && result.ok && result.is_current) ??
    analysisResults.find((result) => result.analyzer_name === 'structure_msaf' && result.ok);
  if (!row || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    return [];
  }
  const inner = (row.data as Record<string, unknown>).data;
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
    return [];
  }
  const rawSegments = (inner as Record<string, unknown>).mapped_segments;
  if (!Array.isArray(rawSegments)) {
    return [];
  }

  const parsed = rawSegments
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const start = typeof record.start_sec === 'number' ? record.start_sec : null;
      const end = typeof record.end_sec === 'number' ? record.end_sec : null;
      const section = typeof record.section === 'string' ? record.section.trim().toLowerCase() : '';
      // Drop non-finite spans and degenerate slivers so they never flash as active.
      if (start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.5) {
        return null;
      }
      return { start, end, section };
    })
    .filter((entry): entry is { start: number; end: number; section: string } => entry !== null)
    .sort((a, b) => a.start - b.start);

  return nameSectionSegments(parsed);
}

// Naming rules: generic "section" → Intro/Outro by position (else "Section N");
// real types (verse/chorus/bridge…) get a 1/2 suffix only when that type recurs.
function nameSectionSegments(segments: { start: number; end: number; section: string }[]): SectionSegment[] {
  const isGeneric = (section: string) => !section || section === 'section';
  const typeCounts = new Map<string, number>();
  for (const seg of segments) {
    if (!isGeneric(seg.section)) {
      typeCounts.set(seg.section, (typeCounts.get(seg.section) ?? 0) + 1);
    }
  }
  const midGenericCount = segments.filter((seg, i) => isGeneric(seg.section) && i !== 0 && i !== segments.length - 1).length;

  const runningIndex = new Map<string, number>();
  let midGenericIndex = 0;

  return segments.map((seg, index) => {
    let name: string;
    if (isGeneric(seg.section)) {
      if (index === 0) {
        name = 'Intro';
      } else if (index === segments.length - 1) {
        name = 'Outro';
      } else {
        midGenericIndex += 1;
        name = midGenericCount > 1 ? `Section ${midGenericIndex}` : 'Section';
      }
    } else {
      const title = seg.section.charAt(0).toUpperCase() + seg.section.slice(1);
      if ((typeCounts.get(seg.section) ?? 0) > 1) {
        const n = (runningIndex.get(seg.section) ?? 0) + 1;
        runningIndex.set(seg.section, n);
        name = `${title} ${n}`;
      } else {
        name = title;
      }
    }
    return { start: seg.start, end: seg.end, name };
  });
}

export function deriveChordEvents(analysisResults: AnalysisResultRow[]): ChordEvent[] {
  const events = analysisResults
    .filter((result) => result.ok)
    .flatMap((result) => collectChordEvents(result.data, 0))
    .filter((event) => Number.isFinite(event.time) && event.time >= 0 && event.chord);
  const seen = new Set<string>();

  return events
    .sort((a, b) => a.time - b.time)
    .filter((event) => {
      const key = `${event.time.toFixed(2)}:${event.chord}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function collectChordEvents(value: unknown, depth: number): ChordEvent[] {
  if (depth > 5 || value === null || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    const direct = value.map((item) => chordEventFromUnknown(item)).filter((event): event is ChordEvent => Boolean(event));
    if (direct.length > 0) {
      return direct;
    }
    return value.flatMap((item) => collectChordEvents(item, depth + 1));
  }

  const record = value as Record<string, unknown>;
  const direct = chordEventFromRecord(record);
  if (direct) {
    return [direct];
  }

  const prioritizedKeys = ['chords', 'chord_track', 'chordTrack', 'chord_events', 'chordEvents', 'events', 'segments'];
  const prioritized = prioritizedKeys.flatMap((key) => collectChordEvents(record[key], depth + 1));
  if (prioritized.length > 0) {
    return prioritized;
  }

  return Object.values(record).flatMap((entry) => collectChordEvents(entry, depth + 1));
}

function chordEventFromUnknown(value: unknown) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? chordEventFromRecord(value as Record<string, unknown>) : null;
}

function chordEventFromRecord(record: Record<string, unknown>): ChordEvent | null {
  const chord = readChordLabel(record);
  const time = readNumber(record, ['time', 'start', 'start_sec', 'start_time', 'timestamp', 'onset']);
  if (!chord || time === null) {
    return null;
  }

  return {
    chord,
    time,
    endTime: readNumber(record, ['end', 'end_sec', 'end_time', 'stop', 'stop_sec']),
  };
}

function readChordLabel(record: Record<string, unknown>) {
  for (const key of ['chord', 'chord_name', 'symbol', 'label']) {
    const value = record[key];
    if (typeof value === 'string' && isChordLike(value)) {
      return normalizeChordLabel(value);
    }
  }

  const root = typeof record.root === 'string' ? record.root.trim() : '';
  const quality = typeof record.quality === 'string' ? record.quality.trim() : '';
  const combined = `${root}${quality}`;
  return isChordLike(combined) ? normalizeChordLabel(combined) : null;
}

function isChordLike(value: string) {
  const trimmed = value.trim();
  return /^(?:N\.?C\.?|no chord|[A-G](?:#|b|♭|♯)?(?::?(?:m|min|maj|dim|aug|sus|add|dom|ø|o|\+|-)?[0-9#b♭♯+\-/()]*)?)$/i.test(trimmed);
}

function normalizeChordLabel(value: string) {
  const trimmed = value.trim();
  return /^no chord$/i.test(trimmed) ? 'N.C.' : trimmed.replaceAll('♭', 'b').replaceAll('♯', '#');
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function activeChordIndex(events: ChordEvent[], currentTime: number) {
  let active = -1;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const nextTime = events[index + 1]?.time ?? Infinity;
    const endTime = event.endTime ?? nextTime;
    if (currentTime >= event.time && currentTime < endTime) {
      active = index;
      break;
    }
    if (currentTime >= event.time) {
      active = index;
    }
  }
  return active;
}

export function buildSongFacts(song: SongSummary | null, analysisResults: AnalysisResultRow[] = []): Array<[string, string]> {
  const metadata =
    song?.metadata && typeof song.metadata === 'object' && !Array.isArray(song.metadata)
      ? (song.metadata as Record<string, unknown>)
      : {};
  // Manual metadata (rarely set) wins; otherwise fall back to the live analyzer
  // rows the run already loads. Tuning/Capo have no analyzer, so they stay
  // static placeholders.
  const analyzed = deriveKeyTempo(analysisResults);
  const key = readMetadata(metadata, ['key', 'musical_key']) ?? analyzed.key ?? '--';
  const tempo = readMetadata(metadata, ['tempo', 'bpm', 'tempo_bpm']) ?? analyzed.tempo;
  const tuning = readMetadata(metadata, ['tuning']) ?? 'Standard';
  const capo = readMetadata(metadata, ['capo']) ?? 'None';

  return [
    ['Key', key],
    ['Tempo', tempo ? `${tempo} BPM` : '-- BPM'],
    ['Tuning', tuning],
    ['Capo', capo],
  ];
}

// Pull current key/tempo straight from the analyzer rows. As with the structure
// and chord derivations, the analyzer envelope is stored whole, so the useful
// fields live at row.data.data (see persistAnalysisResults).
function deriveKeyTempo(analysisResults: AnalysisResultRow[]): { key: string | null; tempo: string | null } {
  const tonal = readAnalyzerData(analysisResults, 'tonal_key');
  const rawKey = typeof tonal?.key === 'string' ? tonal.key.trim() : '';
  const rawScale = typeof tonal?.scale === 'string' ? tonal.scale.trim() : '';
  const key = rawKey ? (rawScale ? `${rawKey} ${rawScale}` : rawKey) : null;

  const beats = readAnalyzerData(analysisResults, 'tempo_beats');
  const rawBpm = typeof beats?.bpm === 'number' && Number.isFinite(beats.bpm) ? beats.bpm : null;
  const tempo = rawBpm !== null ? String(Math.round(rawBpm)) : null;

  return { key, tempo };
}

function readAnalyzerData(analysisResults: AnalysisResultRow[], name: string): Record<string, unknown> | null {
  const row =
    analysisResults.find((result) => result.analyzer_name === name && result.ok && result.is_current) ??
    analysisResults.find((result) => result.analyzer_name === name && result.ok);
  if (!row || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    return null;
  }
  const inner = (row.data as Record<string, unknown>).data;
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
    return null;
  }
  return inner as Record<string, unknown>;
}

function readMetadata(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.round(value));
    }
  }
  return null;
}

// --- Server-side compact summary contract -------------------------------------

// Derive the small `studio_overview` payload from the full analyzer rows at
// analyze write-time. Stores the raw structure segments and the already-extracted
// chord events plus key/scale/bpm — everything the cold-load render needs, none
// of the heavy per-frame analyzer envelopes.
export function deriveStudioOverviewData(analysisResults: AnalysisResultRow[]): StudioOverviewData {
  const structure = readAnalyzerData(analysisResults, 'structure_msaf');
  const mappedSegments = structure && Array.isArray(structure.mapped_segments) ? structure.mapped_segments : [];
  const tonal = readAnalyzerData(analysisResults, 'tonal_key');
  const beats = readAnalyzerData(analysisResults, 'tempo_beats');

  return {
    mapped_segments: mappedSegments,
    chords: deriveChordEvents(analysisResults),
    key: typeof tonal?.key === 'string' ? tonal.key : null,
    scale: typeof tonal?.scale === 'string' ? tonal.scale : null,
    bpm: typeof beats?.bpm === 'number' && Number.isFinite(beats.bpm) ? beats.bpm : null,
  };
}

// Expand the compact summary back into the synthetic analyzer rows the client
// derivations already understand, so the cold-load path needs no client changes.
export function expandStudioOverview(songId: string, overview: unknown): AnalysisResultRow[] {
  if (!overview || typeof overview !== 'object' || Array.isArray(overview)) {
    return [];
  }

  const data = overview as Partial<StudioOverviewData>;
  const make = (id: string, analyzerName: string, value: unknown): AnalysisResultRow => ({
    id,
    song_id: songId,
    asset_id: null,
    owner_id: '',
    analyzer_name: analyzerName,
    analyzer_version: null,
    ok: true,
    elapsed_sec: null,
    error: null,
    data: value as AnalysisResultRow['data'],
    is_current: true,
    created_at: new Date(0).toISOString(),
  });

  const rows: AnalysisResultRow[] = [];
  if (Array.isArray(data.mapped_segments) && data.mapped_segments.length > 0) {
    rows.push(make('studio_overview:structure', 'structure_msaf', { data: { mapped_segments: data.mapped_segments } }));
  }
  if (Array.isArray(data.chords) && data.chords.length > 0) {
    rows.push(make('studio_overview:chords', 'chords', { chords: data.chords }));
  }
  if ((typeof data.key === 'string' && data.key) || (typeof data.scale === 'string' && data.scale)) {
    rows.push(make('studio_overview:tonal', 'tonal_key', { data: { key: data.key ?? null, scale: data.scale ?? null } }));
  }
  if (typeof data.bpm === 'number' && Number.isFinite(data.bpm)) {
    rows.push(make('studio_overview:tempo', 'tempo_beats', { data: { bpm: data.bpm } }));
  }

  return rows;
}
