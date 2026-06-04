import type { LyricLine } from '@/types/lyrics';

export function parseLrcTimestamp(timestamp: string): number {
  const match = timestamp.match(/\[(\d+):(\d+)(?:[.:](\d+))?\]/);

  if (!match) {
    return 0;
  }

  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  const fractionalSeconds = match[3] ? Number(`0.${match[3]}`) : 0;

  return minutes * 60 + seconds + fractionalSeconds;
}

export function parseLrc(lrcContent: string): LyricLine[] {
  if (!lrcContent) {
    return [];
  }

  const lyricLines: LyricLine[] = [];

  for (const line of lrcContent.split('\n')) {
    if (!line.trim() || line.match(/^\[(ar|ti|al|au|length|by|offset|re|ve):/i)) {
      continue;
    }

    const leadingTimestampMatch = line.match(/^((?:\[\d+:\d+(?:[.:]\d+)?\])+)(.*)$/);

    if (leadingTimestampMatch) {
      const timestamps = leadingTimestampMatch[1].match(/\[\d+:\d+(?:[.:]\d+)?\]/g) ?? [];
      const text = leadingTimestampMatch[2].trim();
      for (const timestamp of timestamps) {
        lyricLines.push({
          timestamp: parseLrcTimestamp(timestamp),
          text,
        });
      }
    }
  }

  return lyricLines.sort((a, b) => a.timestamp - b.timestamp);
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(wholeSeconds).padStart(2, '0')}`;
}

export function formatTimeDetailed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}
