import { formatMoney, type Minor } from '@/lib/money';
import { cn } from '@/lib/cn';

/** Money in tabular figures with a lighter currency symbol and a true minus sign. */
export function Money({
  minor,
  currency = 'EUR',
  locale = 'el-GR',
  signed = false,
  className,
}: {
  minor: Minor;
  currency?: string;
  locale?: string;
  signed?: boolean;
  className?: string;
}) {
  const text = formatMoney(minor, currency, locale, { signDisplay: signed ? 'exceptZero' : 'auto' });
  const parts = text.split(/([€$£]|CHF)/);
  return (
    <span className={cn('num whitespace-nowrap', className)}>
      {parts.map((p, i) =>
        /^([€$£]|CHF)$/.test(p) ? (
          <span key={i} className="font-normal text-[0.82em] opacity-70">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </span>
  );
}
