'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { Button } from '@/components/ui/button';

export function FinishOnboarding({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await apiFetch('/api/onboarding/complete', { method: 'POST' });
        if (res.ok) {
          router.replace('/');
          router.refresh();
        } else setBusy(false);
      }}
    >
      {label}
    </Button>
  );
}
