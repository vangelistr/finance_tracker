'use client';

import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineRetry({ label }: { label: string }) {
  return (
    <Button
      variant="secondary"
      icon={<RotateCw aria-hidden className="size-4" strokeWidth={1.75} />}
      // A full document load on purpose: the client router cannot recover a page the service worker replaced.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      onClick={() => window.location.assign('/')}
      className="self-start"
    >
      {label}
    </Button>
  );
}
