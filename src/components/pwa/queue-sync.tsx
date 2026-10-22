'use client';

import { CloudOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { pending, replay } from '@/lib/client/offline-queue';

/** Replays the offline expense queue on start and when the connection returns; shows how many are waiting. */
export function QueueSync() {
  const t = useTranslations('quickAdd');
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const sent = await replay();
      if (!alive) return;
      setCount((await pending()).length);
      if (sent > 0) router.refresh();
    };
    void sync();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'queue-replayed') void sync();
    };
    window.addEventListener('online', sync);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    const timer = window.setInterval(async () => alive && setCount((await pending()).length), 15_000);
    return () => {
      alive = false;
      window.removeEventListener('online', sync);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      window.clearInterval(timer);
    };
  }, [router]);

  if (count === 0) return null;
  return (
    <p role="status" className="mb-4 flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm">
      <CloudOff aria-hidden className="size-4 text-warning" strokeWidth={2} />
      {t('pending', { count })}
    </p>
  );
}
