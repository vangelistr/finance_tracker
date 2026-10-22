'use client';

// Offline expense queue in IndexedDB, shared with the service worker (same database, store and record shape):
// { clientId, path, body, csrf, createdAt, status? }. The server de-duplicates by clientId, so replaying twice is safe.

const DB_NAME = 'finance-offline';
const DB_VERSION = 1;
const QUEUE = 'queue';
const META = 'meta';
export const SYNC_TAG = 'expense-queue';

export interface QueuedRequest {
  clientId: string;
  path: string;
  body: unknown;
  csrf: string;
  createdAt: string;
  status?: 'rejected';
  error?: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'clientId' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueue(item: QueuedRequest): Promise<void> {
  await withStore(QUEUE, 'readwrite', (s) => s.put(item));
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } })?.sync;
    await sync?.register(SYNC_TAG);
  } catch {
    // Background Sync is not available everywhere (e.g. Safari); the page replays on `online` and on start.
  }
}

export async function pending(): Promise<QueuedRequest[]> {
  try {
    return ((await withStore<QueuedRequest[]>(QUEUE, 'readonly', (s) => s.getAll())) ?? []).filter((i) => i.status !== 'rejected');
  } catch {
    return [];
  }
}

/** Sends queued requests in order; stops at the first network failure. Returns how many were delivered. */
export async function replay(): Promise<number> {
  let sent = 0;
  for (const item of await pending()) {
    let res: Response;
    try {
      res = await fetch(item.path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': item.csrf },
        body: JSON.stringify(item.body),
      });
    } catch {
      break;
    }
    if (res.ok || res.status === 409) {
      await withStore(QUEUE, 'readwrite', (s) => s.delete(item.clientId));
      sent++;
    } else if (res.status === 401 || res.status === 403) {
      break;
    } else if (res.status >= 400 && res.status < 500) {
      await withStore(QUEUE, 'readwrite', (s) => s.put({ ...item, status: 'rejected', error: res.status }));
    }
  }
  return sent;
}

export async function saveMeta(key: string, value: unknown): Promise<void> {
  try {
    await withStore(META, 'readwrite', (s) => s.put(value, key));
  } catch {
    // Private mode or storage blocked: offline quick-add falls back to "no categories".
  }
}

export async function loadMeta<T>(key: string): Promise<T | undefined> {
  try {
    return await withStore<T>(META, 'readonly', (s) => s.get(key) as IDBRequest<T>);
  } catch {
    return undefined;
  }
}
