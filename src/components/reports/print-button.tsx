'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" className="no-print" icon={<Printer aria-hidden className="size-4" strokeWidth={2} />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
