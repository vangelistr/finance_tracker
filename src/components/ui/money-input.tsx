'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { parseMoney, toInputValue } from '@/lib/money';
import { cn } from '@/lib/cn';
import { Field, controlClasses } from './field';

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> {
  label: string;
  valueMinor: number | null;
  onValueChange: (minor: number | null) => void;
  currency?: string;
  locale?: string;
  hint?: string;
  error?: string;
  size?: 'md' | 'lg';
}

/** Amount field: decimal keypad on phones, accepts "12,50" or "12.50", reports integer cents (null if invalid). */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { label, valueMinor, onValueChange, currency = 'EUR', locale = 'el', hint, error, size = 'md', className, ...rest },
  ref,
) {
  const [text, setText] = useState(valueMinor !== null ? toInputValue(valueMinor, locale) : '');
  const symbol = currency === 'EUR' ? '€' : currency;
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            ref={ref}
            id={id}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={text}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.,\s-]/g, '');
              setText(v);
              const minor = parseMoney(v);
              onValueChange(minor !== null && minor > 0 ? minor : null);
            }}
            className={cn(controlClasses, 'num pr-10', size === 'lg' && 'min-h-14 text-2xl font-semibold')}
            {...rest}
          />
          <span aria-hidden className={cn('pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3', size === 'lg' && 'text-xl')}>
            {symbol}
          </span>
        </div>
      )}
    </Field>
  );
});
