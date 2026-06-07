'use client';

import type { StudioDetail } from '@/types/werecode-client';

import { idbDelete, idbEntries, idbGet, idbSet } from './idb-keyval';

// Durable, reload-surviving tier for the heavy per-song Studio bundle (song +
// assets + analysis + lyrics). Kept in IndexedDB rather than the auto-rehydrated
// zustand slice so the live heap only ever holds the active song. The store
// itself is freshness-agnostic — it records `loadedAt` and lets callers decide
// staleness via STUDIO_DETAIL_TTL_MS.

const KEY_PREFIX = 'studio:';
const MAX_ENTRIES = 25;

// How long a persisted bundle is treated as fresh before the next open
// revalidates it. Tracks product-state freshness (e.g. a Modal job that wrote
// rows server-side), so it is intentionally short; Manual Refresh forces sooner.
export const STUDIO_DETAIL_TTL_MS = 10 * 60 * 1000;

type StoredStudioDetail = {
  songId: string;
  detail: StudioDetail;
  loadedAt: number;
  lastAccess: number;
};

const keyFor = (songId: string) => `${KEY_PREFIX}${songId}`;
const isStudioKey = (key: string) => key.startsWith(KEY_PREFIX);

export async function getStoredStudioDetail(
  songId: string
): Promise<{ detail: StudioDetail; loadedAt: number } | null> {
  const stored = await idbGet<StoredStudioDetail>(keyFor(songId));
  if (!stored || !stored.detail) {
    return null;
  }

  // Best-effort LRU touch so eviction keeps the genuinely active songs.
  void idbSet(keyFor(songId), { ...stored, lastAccess: Date.now() });

  return { detail: stored.detail, loadedAt: stored.loadedAt };
}

export async function putStoredStudioDetail(
  songId: string,
  detail: StudioDetail,
  loadedAt: number = Date.now()
): Promise<void> {
  await evictIfNeeded(songId);
  await idbSet(keyFor(songId), {
    songId,
    detail,
    loadedAt,
    lastAccess: Date.now(),
  } satisfies StoredStudioDetail);
}

export async function deleteStoredStudioDetail(songId: string): Promise<void> {
  await idbDelete(keyFor(songId));
}

export async function clearStoredStudioDetails(): Promise<void> {
  const entries = await idbEntries<StoredStudioDetail>();
  await Promise.all(entries.filter((entry) => isStudioKey(entry.key)).map((entry) => idbDelete(entry.key)));
}

async function evictIfNeeded(incomingSongId: string): Promise<void> {
  const entries = (await idbEntries<StoredStudioDetail>()).filter((entry) => isStudioKey(entry.key));
  const others = entries.filter((entry) => entry.value?.songId !== incomingSongId);
  if (others.length < MAX_ENTRIES) {
    return;
  }

  const removeCount = others.length - MAX_ENTRIES + 1;
  const oldestFirst = others.sort((a, b) => (a.value?.lastAccess ?? 0) - (b.value?.lastAccess ?? 0));
  await Promise.all(oldestFirst.slice(0, removeCount).map((entry) => idbDelete(entry.key)));
}
