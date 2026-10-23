'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/client/use-action';

/** A one-shot set-aside move; the server makes it idempotent, so a double tap never moves twice. */
export function MoveButton({ path, label }: { path: string; label: string }) {
  const tc = useTranslations('common');
  const { run, busy, error } = useAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" loading={busy} onClick={() => run(path, { method: 'POST' })}>
        {label}
      </Button>
      {error && <span className="text-sm text-danger">{tc('saveFailed')}</span>}
    </span>
  );
}
