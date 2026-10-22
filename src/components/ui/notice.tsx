import { AlertTriangle, CircleCheck, Info, OctagonAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'bg-accent-soft text-ink', icon: Info },
  success: { box: 'bg-income-soft text-ink', icon: CircleCheck },
  warning: { box: 'bg-warning-soft text-ink', icon: AlertTriangle },
  danger: { box: 'bg-danger-soft text-ink', icon: OctagonAlert },
};

const ICON_COLOURS: Record<Tone, string> = {
  info: 'text-accent',
  success: 'text-income',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Notice({ tone = 'info', title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md px-3.5 py-3 text-sm', box, className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', ICON_COLOURS[tone])} strokeWidth={2} />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
    </div>
  );
}
