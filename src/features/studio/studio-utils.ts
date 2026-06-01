import type { AssetRow } from '@/types/werecode';

type ApiError = {
  error?: {
    message?: string;
    code?: string;
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

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatBytes(bytes: number | null) {
  if (!bytes) {
    return '--';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
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

export function assetLabel(kind: string) {
  return kind.replaceAll('_', ' ');
}

export async function signDownload(asset: AssetRow) {
  const payload = await fetchJson<{ signedUrl: string }>(
    `/api/songs/${asset.song_id}/assets/${asset.id}/signed-url?expiresIn=3600`
  );

  return payload.signedUrl;
}
