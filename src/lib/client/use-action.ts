'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { apiFetch, type ApiFailure } from './api';

/** Runs an API mutation, tracks busy/error state and refreshes the server components on success. */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const run = useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T | null> => {
      setBusy(true);
      setError(null);
      const res = await apiFetch<T>(path, init);
      setBusy(false);
      if (!res.ok) {
        setError(res);
        return null;
      }
      router.refresh();
      return res.data;
    },
    [router],
  );
  return { run, busy, error, setError };
}
