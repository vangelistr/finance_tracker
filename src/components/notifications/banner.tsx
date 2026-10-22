'use client';

import { Bell, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';

export interface BannerItem {
  id: string;
  titleKey: string;
  bodyKey: string;
  params: Record<string, string | number>;
  url: string;
}

/** In-app fallback for every notification (also when push is off or unsupported). Dismissing marks it read. */
export function NotificationBanner({ initial }: { initial: BannerItem[] }) {
  const t = useTranslations('notifications');
  const [items, setItems] = useState(initial);
  if (items.length === 0) return null;
  const dismiss = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    void apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
  };
  return (
    <section aria-label={t('unread', { count: items.length })} className="mb-5 flex flex-col gap-2">
      {items.map((n) => (
        <div key={n.id} role="status" className="flex items-start gap-3 rounded-md bg-accent-soft px-3.5 py-3">
          <Bell aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t(n.titleKey as 'dailyTitle', n.params)}</p>
            <p className="text-sm text-ink-2">{t(n.bodyKey as 'dailyBody', n.params)}</p>
            <Link href={n.url} onClick={() => dismiss(n.id)} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
              {t('open')}
            </Link>
          </div>
          <button type="button" onClick={() => dismiss(n.id)} aria-label={t('dismiss')} className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-md text-ink-2 hover:text-ink">
            <X aria-hidden className="size-4" strokeWidth={2} />
          </button>
        </div>
      ))}
    </section>
  );
}
