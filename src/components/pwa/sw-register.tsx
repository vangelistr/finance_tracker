'use client';

import { useEffect } from 'react';

/** Registers the service worker in production builds (development chunks are not cache-safe). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Registration fails on plain http other than localhost; the app still works online.
    });
  }, []);
  return null;
}
