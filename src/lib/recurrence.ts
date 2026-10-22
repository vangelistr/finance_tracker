import {
  addDays,
  addMonths,
  compareLocalDates,
  daysBetween,
  monthOf,
  monthsBetween,
  parseLocalDate,
  type LocalDate,
} from './dates';

// Schedules work on local calendar dates only (no time of day), so DST and month edges cannot shift an
// occurrence. A monthly schedule on the 31st falls on the last day of shorter months.

export const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface Schedule {
  frequency: Frequency;
  startDate: LocalDate;
  endDate?: LocalDate | null;
  /** Day of month for monthly, quarterly and yearly schedules (1–31). Defaults to the start date's day. */
  dayOfMonth?: number | null;
}

const MONTH_STEP: Partial<Record<Frequency, number>> = { monthly: 1, quarterly: 3, yearly: 12 };
const DAY_STEP: Partial<Record<Frequency, number>> = { weekly: 7, biweekly: 14 };

/** Occurrences per year, used to turn any schedule into a monthly equivalent. */
export const PERIODS_PER_YEAR: Record<Frequency, number> = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, yearly: 1 };

/** Every occurrence date of the schedule within [from, to] (inclusive), in order. */
export function occurrences(schedule: Schedule, from: LocalDate, to: LocalDate): LocalDate[] {
  const end = schedule.endDate && compareLocalDates(schedule.endDate, to) < 0 ? schedule.endDate : to;
  const start = compareLocalDates(schedule.startDate, from) > 0 ? schedule.startDate : from;
  if (compareLocalDates(start, end) > 0) return [];
  const out: LocalDate[] = [];

  const dayStep = DAY_STEP[schedule.frequency];
  if (dayStep) {
    const offset = daysBetween(schedule.startDate, start);
    const k0 = offset <= 0 ? 0 : Math.ceil(offset / dayStep);
    for (let k = k0; ; k++) {
      const d = addDays(schedule.startDate, k * dayStep);
      if (compareLocalDates(d, end) > 0) break;
      out.push(d);
    }
    return out;
  }

  const monthStep = MONTH_STEP[schedule.frequency]!;
  const day = schedule.dayOfMonth ?? parseLocalDate(schedule.startDate).day;
  const firstMonth = `${monthOf(schedule.startDate)}-01`;
  const offsetMonths = Math.max(0, monthsBetween(monthOf(schedule.startDate), monthOf(start)));
  for (let k = Math.floor(offsetMonths / monthStep); ; k++) {
    const d = addMonths(firstMonth, k * monthStep, day);
    if (compareLocalDates(d, end) > 0) break;
    if (compareLocalDates(d, schedule.startDate) >= 0 && compareLocalDates(d, start) >= 0) out.push(d);
  }
  return out;
}

/** The first occurrence on or after `date`, or null when the schedule has ended. */
export function nextOccurrence(schedule: Schedule, date: LocalDate): LocalDate | null {
  const horizon = addMonths(date, 13);
  return occurrences(schedule, date, horizon)[0] ?? null;
}

/** Monthly equivalent of an amount paid on this schedule (rounded half up to the cent). */
export function monthlyEquivalent(amountMinor: number, frequency: Frequency): number {
  return Math.round((amountMinor * PERIODS_PER_YEAR[frequency]) / 12);
}
