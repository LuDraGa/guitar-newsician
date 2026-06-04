import type { SongSummary } from '@/types/werecode-client';

type ApiError = {
  error?: {
    message?: string;
    code?: string;
    details?: unknown;
  };
};

export function extractErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as ApiError).error;
    return error?.message ?? error?.code ?? fallback;
  }

  return fallback;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Request failed: ${response.status}`));
  }

  return payload as T;
}

export function formatDuration(seconds: number | null) {
  if (!seconds) {
    return '--:--';
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function statusClass(status: string) {
  if (status === 'ready') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  }
  if (status === 'failed') {
    return 'border-red-400/30 bg-red-400/10 text-red-200';
  }
  if (status === 'processing' || status === 'queued' || status === 'importing') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
  }
  return 'border-white/10 bg-white/5 text-slate-300';
}

export function inferSourceType(sourceUrl: string) {
  if (sourceUrl.includes('music.youtube.com')) {
    return 'youtube_music';
  }

  if (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be')) {
    return 'youtube';
  }

  return 'audio_url';
}

export function titleFromFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled upload';
}

export function safeFilename(filename: string) {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'audio-upload';
}

export function readAudioDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    audio.src = objectUrl;
  });
}

export function getSongIssue(song: SongSummary) {
  const metadata = song.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const error = metadata.last_ingest_error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const category = typeof error.category === 'string' ? error.category : null;
    if (category === 'youtube_cookies_required') {
      return 'YouTube cloud download is not part of the current Modal contract. Use audio upload for now.';
    }

    if (typeof error.message === 'string') {
      return error.message;
    }
  }

  if (metadata.source_audio_required === true) {
    return 'Source URL is saved. Upload audio before running studio workflows.';
  }

  return null;
}
