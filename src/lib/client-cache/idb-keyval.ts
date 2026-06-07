'use client';

// Minimal IndexedDB key/value helpers. Hand-rolled (no dependency) to back the
// durable Studio-detail tier: heavy per-song analysis lives on disk and is read
// lazily for the active song only, so the JS heap never grows with library size.
// Every call degrades to a no-op/null when IndexedDB is unavailable (SSR,
// private mode, blocked storage) so callers can always fall back to the network.

const DB_NAME = 'werecode-cache';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) {
    return null;
  }

  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const result = await promisifyRequest<T>(tx.objectStore(STORE_NAME).get(key) as IDBRequest<T>);
    return (result ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await promisifyRequest(tx.objectStore(STORE_NAME).put(value, key));
  } catch {
    // Swallow quota/transaction errors — the cache is best-effort and the
    // caller revalidates from the network on a miss.
  }
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await promisifyRequest(tx.objectStore(STORE_NAME).delete(key));
  } catch {
    // ignore
  }
}

export async function idbEntries<T>(): Promise<Array<{ key: string; value: T }>> {
  const db = await openDb();
  if (!db) {
    return [];
  }

  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const entries: Array<{ key: string; value: T }> = [];

    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          entries.push({ key: String(cursor.key), value: cursor.value as T });
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    return entries;
  } catch {
    return [];
  }
}
