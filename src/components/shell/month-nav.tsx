import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { addMonthsToMonth } from '@/lib/dates';
import { formatMonth } from '@/lib/intl';

/** Previous / current / next month links that keep the rest of the query string. */
export function MonthNav({ month, locale, basePath, query = {}, labels }: { month: string; locale: string; basePath: string; query?: Record<string, string>; labels: { prev: string; next: string } }) {
  const href = (m: string) => `${basePath}?${new URLSearchParams({ ...query, month: m }).toString()}`;
  return (
    <div className="flex items-center gap-1">
      <Link href={href(addMonthsToMonth(month, -1))} aria-label={labels.prev} className="grid size-11 place-items-center rounded-md text-ink-2 hover:bg-surface-hover hover:text-ink">
        <ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} />
      </Link>
      <span className="min-w-36 text-center font-semibold capitalize">{formatMonth(month, locale)}</span>
      <Link href={href(addMonthsToMonth(month, 1))} aria-label={labels.next} className="grid size-11 place-items-center rounded-md text-ink-2 hover:bg-surface-hover hover:text-ink">
        <ChevronRight aria-hidden className="size-5" strokeWidth={1.75} />
      </Link>
    </div>
  );
}
