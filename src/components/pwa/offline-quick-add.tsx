'use client';

import { useEffect, useState } from 'react';
import { toLocalDate } from '@/lib/dates';
import { loadMeta } from '@/lib/client/offline-queue';
import { QuickAdd, type QuickAccount, type QuickCategory } from '@/components/quick-add/quick-add';
import { QueueSync } from './queue-sync';

interface Bootstrap {
  categories: QuickCategory[];
  accounts: QuickAccount[];
  currency: string;
}

/** Quick-add on the offline page: categories come from the device cache, every save goes to the queue. */
export function OfflineQuickAdd() {
  const [data, setData] = useState<Bootstrap | null>(null);
  useEffect(() => {
    let alive = true;
    loadMeta<Bootstrap>('bootstrap').then((d) => alive && setData(d ?? { categories: [], accounts: [], currency: 'EUR' }));
    return () => {
      alive = false;
    };
  }, []);
  if (!data) return null;
  return (
    <div className="flex flex-col gap-3">
      <QueueSync />
      <QuickAdd {...data} today={toLocalDate(new Date(), 'Europe/Athens')} variant="rail" offline />
    </div>
  );
}
