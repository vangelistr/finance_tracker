import { addDays, compareLocalDates, monthBounds, weekdayOf, type LocalDate, type Month } from './dates';

export type CalendarItemKind = 'income' | 'expense' | 'renewal' | 'transfer' | 'goal';
export type CalendarItemState = 'expected' | 'done' | 'projected';

export interface CalendarItem {
  key: string;
  kind: CalendarItemKind;
  state: CalendarItemState;
  localDate: LocalDate;
  label: string;
  amountMinor: number;
  transactionId: string | null;
}

export interface CalendarDay {
  date: LocalDate;
  inMonth: boolean;
  isToday: boolean;
  items: CalendarItem[];
  totals: { inMinor: number; outMinor: number };
}

const ORDER: Record<CalendarItemKind, number> = { income: 0, renewal: 1, expense: 2, transfer: 3, goal: 4 };

/**
 * Month grid with weeks starting on Monday. Items are grouped by their stored local date only, so an item at 00:30
 * on the 1st, or on a DST change day, always lands on its own calendar day.
 */
export function buildMonth(month: Month, today: LocalDate | null, items: CalendarItem[]): { weeks: CalendarDay[][]; days: CalendarDay[] } {
  const { first, last } = monthBounds(month);
  const gridStart = addDays(first, 1 - weekdayOf(first));
  const gridEnd = addDays(last, 7 - weekdayOf(last));
  const byDate = new Map<LocalDate, CalendarItem[]>();
  for (const item of items) {
    if (compareLocalDates(item.localDate, gridStart) < 0 || compareLocalDates(item.localDate, gridEnd) > 0) continue;
    byDate.set(item.localDate, [...(byDate.get(item.localDate) ?? []), item]);
  }
  const days: CalendarDay[] = [];
  for (let d = gridStart; compareLocalDates(d, gridEnd) <= 0; d = addDays(d, 1)) {
    const dayItems = (byDate.get(d) ?? []).sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || b.amountMinor - a.amountMinor);
    const totals = { inMinor: 0, outMinor: 0 };
    for (const i of dayItems) {
      if (i.kind === 'income') totals.inMinor += i.amountMinor;
      else if (i.kind === 'expense' || i.kind === 'renewal') totals.outMinor += i.amountMinor;
    }
    days.push({ date: d, inMonth: d.startsWith(month), isToday: d === today, items: dayItems, totals });
  }
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return { weeks, days };
}

/** The in-month days that have items, for the agenda (phone) view. */
export function agenda(days: CalendarDay[]): CalendarDay[] {
  return days.filter((d) => d.inMonth && d.items.length > 0);
}
