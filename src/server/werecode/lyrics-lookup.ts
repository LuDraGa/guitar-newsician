import 'server-only';

export type LyricsLookupInput = {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  durationSec?: number | null;
  allowUnsynced?: boolean;
};

export type LyricsLookupResponse = {
  success?: boolean;
  message?: string;
  has_synced_lyrics?: boolean;
  has_plain_lyrics?: boolean;
  synced_lyrics?: string | null;
  plain_lyrics?: string | null;
  sources?: string[];
  sources_tried?: string[];
  match?: {
    id: number;
    track_name: string;
    artist_name: string;
    album_name: string | null;
    duration_sec: number | null;
    instrumental: boolean;
  } | null;
};

export type LyricsLookupResult =
  | {
      attempted: false;
      reason: string;
    }
  | {
      attempted: true;
      response: LyricsLookupResponse | null;
      error: string | null;
    };

export async function lookupLyrics(input: LyricsLookupInput): Promise<LyricsLookupResult> {
  if (!shouldAttemptLyricsLookup()) {
    return {
      attempted: false,
      reason: 'Lyrics lookup is disabled in this environment',
    };
  }

  const title = input.title?.trim();
  if (!title) {
    return {
      attempted: false,
      reason: 'Missing title for local lyrics lookup',
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.LYRICS_LOOKUP_TIMEOUT_MS ?? 15_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await lookupLrclib({
      title,
      artist: input.artist?.trim() || null,
      album: input.album?.trim() || null,
      durationSec: input.durationSec ?? null,
      allowUnsynced: input.allowUnsynced ?? true,
      signal: controller.signal,
    });

    return {
      attempted: true,
      response,
      error: null,
    };
  } catch (error) {
    return {
      attempted: true,
      response: null,
      error: error instanceof Error ? error.message : 'Lyrics lookup failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldAttemptLyricsLookup() {
  const explicit = process.env.LYRICS_LOOKUP_ENABLED;
  if (explicit === 'false') {
    return false;
  }
  return true;
}

async function lookupLrclib(options: {
  title: string;
  artist: string | null;
  album: string | null;
  durationSec: number | null;
  allowUnsynced: boolean;
  signal: AbortSignal;
}): Promise<LyricsLookupResponse> {
  const sourcesTried: string[] = [];
  const exactMatch = await findExactLrclibMatch(options, sourcesTried);
  const searchMatches = exactMatch ? [] : await searchLrclib(options, sourcesTried);
  const match = exactMatch ?? chooseBestLrclibMatch(searchMatches, options);

  if (!match) {
    return {
      success: false,
      message: 'No lyrics available from LRCLIB',
      has_synced_lyrics: false,
      has_plain_lyrics: false,
      synced_lyrics: null,
      plain_lyrics: null,
      sources: [],
      sources_tried: sourcesTried,
      match: null,
    };
  }

  const syncedLyrics = match.syncedLyrics?.trim() || null;
  const plainLyrics = options.allowUnsynced ? match.plainLyrics?.trim() || null : null;

  return {
    success: Boolean(syncedLyrics || plainLyrics),
    message: syncedLyrics
      ? 'Synced lyrics found from LRCLIB'
      : plainLyrics
        ? 'Plain lyrics found from LRCLIB'
        : 'LRCLIB match did not include usable lyrics',
    has_synced_lyrics: Boolean(syncedLyrics),
    has_plain_lyrics: Boolean(plainLyrics),
    synced_lyrics: syncedLyrics,
    plain_lyrics: plainLyrics,
    sources: syncedLyrics || plainLyrics ? ['lrclib'] : [],
    sources_tried: sourcesTried,
    match: summarizeLrclibRecord(match),
  };
}

async function findExactLrclibMatch(
  options: {
    title: string;
    artist: string | null;
    album: string | null;
    durationSec: number | null;
    signal: AbortSignal;
  },
  sourcesTried: string[]
) {
  if (!options.artist || !options.album || typeof options.durationSec !== 'number') {
    return null;
  }

  sourcesTried.push('LRCLIB /api/get');
  const url = lrclibUrl('/get');
  url.searchParams.set('track_name', options.title);
  url.searchParams.set('artist_name', options.artist);
  url.searchParams.set('album_name', options.album);
  url.searchParams.set('duration', String(Math.round(options.durationSec)));

  const response = await fetch(url, lrclibFetchInit(options.signal));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`LRCLIB exact lookup failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as LrclibRecord;
}

async function searchLrclib(
  options: {
    title: string;
    artist: string | null;
    signal: AbortSignal;
  },
  sourcesTried: string[]
) {
  sourcesTried.push('LRCLIB /api/search');
  const url = lrclibUrl('/search');
  url.searchParams.set('track_name', options.title);
  if (options.artist) {
    url.searchParams.set('artist_name', options.artist);
  }

  const response = await fetch(url, lrclibFetchInit(options.signal));
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`LRCLIB search failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as LrclibRecord[];
}

function chooseBestLrclibMatch(
  records: LrclibRecord[],
  options: {
    title: string;
    artist: string | null;
    album: string | null;
    durationSec: number | null;
  }
) {
  return [...records].sort((a, b) => scoreLrclibRecord(b, options) - scoreLrclibRecord(a, options))[0] ?? null;
}

function scoreLrclibRecord(
  record: LrclibRecord,
  options: {
    title: string;
    artist: string | null;
    album: string | null;
    durationSec: number | null;
  }
) {
  let score = 0;
  if (record.syncedLyrics?.trim()) {
    score += 100;
  }
  if (record.plainLyrics?.trim()) {
    score += 20;
  }
  if (normaliseText(record.trackName) === normaliseText(options.title)) {
    score += 40;
  }
  if (options.artist && normaliseText(record.artistName).includes(normaliseText(options.artist))) {
    score += 20;
  }
  if (options.album && normaliseText(record.albumName).includes(normaliseText(options.album))) {
    score += 10;
  }
  if (typeof options.durationSec === 'number' && typeof record.duration === 'number') {
    const delta = Math.abs(record.duration - options.durationSec);
    if (delta <= 2) {
      score += 20;
    } else if (delta <= 5) {
      score += 10;
    }
  }

  return score;
}

function lrclibUrl(path: string) {
  const base = process.env.LRCLIB_API_URL ?? 'https://lrclib.net/api/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), normalizedBase);
}

function lrclibFetchInit(signal: AbortSignal) {
  return {
    cache: 'no-store' as const,
    headers: {
      accept: 'application/json',
      'user-agent': process.env.LRCLIB_USER_AGENT ?? 'WereCode/0.1',
    },
    signal,
  };
}

function summarizeLrclibRecord(record: LrclibRecord) {
  return {
    id: record.id,
    track_name: record.trackName,
    artist_name: record.artistName,
    album_name: record.albumName || null,
    duration_sec: typeof record.duration === 'number' ? record.duration : null,
    instrumental: Boolean(record.instrumental),
  };
}

function normaliseText(value: string | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim();
}

type LrclibRecord = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};
