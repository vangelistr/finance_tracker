'use client';

import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** A labelled on/off row. The whole row is the hit target. */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex w-full min-h-11 items-center justify-between gap-4 py-2 text-left disabled:opacity-60"
    >
      <span className="flex flex-col">
        <span className="text-base text-ink">{label}</span>
        {description && <span className="text-sm text-ink-3">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150',
          checked ? 'border-accent bg-accent' : 'border-rule-strong bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute size-5 rounded-full transition-transform duration-200 ease-out-quint',
            checked ? 'translate-x-6 bg-accent-ink' : 'translate-x-1 bg-ink-3',
          )}
        />
      </span>
    </button>
  );
}
