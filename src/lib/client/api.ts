'use client';

import { CSRF_HEADER } from '@/lib/cookie-names';

export interface ApiFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
  retryAfter?: number;
}

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export function readCsrfToken(): string {
  const match = document.cookie.split('; ').find((c) => c.startsWith('__Host-ft_csrf=') || c.startsWith('ft_csrf='));
  return match ? decodeURIComponent(match.slice(match.indexOf('=') + 1)) : '';
}

/** JSON fetch against the app's own API with the CSRF header. Never throws on HTTP errors. */
export async function apiFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(method !== 'GET' ? { [CSRF_HEADER]: readCsrfToken() } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    const error = (json as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    return {
      ok: false,
      status: res.status,
      code: error?.code ?? 'internal',
      message: error?.message ?? res.statusText,
      fields: error?.fields,
      retryAfter: Number(res.headers.get('retry-after')) || undefined,
    };
  } catch {
    return { ok: false, status: 0, code: 'network', message: 'network error' };
  }
}
