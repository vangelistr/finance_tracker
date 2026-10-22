/* Finance Tracker service worker. Generated into public/sw.js by scripts/build-sw.mjs (build id injected).
   Offline shell, immutable asset cache, push display, and replay of the offline expense queue. */

const BUILD_ID = '__BUILD_ID__';
const STATIC_CACHE = `ft-static-${BUILD_ID}`;
const SHELL_CACHE = `ft-shell-${BUILD_ID}`;
const SHELL_URLS = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

const DB_NAME = 'finance-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';
const SYNC_TAG = 'expense-queue';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_URLS);
      // Precache the offline page's own scripts and styles so it renders with no network.
      const res = await shell.match('/offline');
      const html = res ? await res.text() : '';
      const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
      const statics = await caches.open(STATIC_CACHE);
      await Promise.all([...new Set(assets)].map((url) => statics.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, SHELL_CACHE]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // never cached

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match('/offline', { cacheName: SHELL_CACHE })) || Response.error()),
    );
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

// ---- Push ----

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Finance Tracker', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Finance Tracker', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target.href);
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

// ---- Offline expense queue (written by the page, replayed here and by the page) ----

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'clientId' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

async function replayQueue() {
  const db = await openDb();
  const items = await tx(db, QUEUE_STORE, 'readonly', (s) => s.getAll());
  for (const item of items || []) {
    if (item.status === 'rejected') continue;
    let res;
    try {
      res = await fetch(item.path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': item.csrf },
        body: JSON.stringify(item.body),
      });
    } catch {
      return; // still offline: try again on the next sync
    }
    if (res.ok || res.status === 409) {
      await tx(db, QUEUE_STORE, 'readwrite', (s) => s.delete(item.clientId));
    } else if (res.status === 401 || res.status === 403) {
      return; // signed out or token rotated: the page replays after sign-in
    } else if (res.status >= 400 && res.status < 500) {
      await tx(db, QUEUE_STORE, 'readwrite', (s) => s.put({ ...item, status: 'rejected', error: res.status }));
    }
  }
  const windows = await self.clients.matchAll({ type: 'window' });
  windows.forEach((c) => c.postMessage({ type: 'queue-replayed' }));
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(replayQueue());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'replay-queue') event.waitUntil(replayQueue());
});
