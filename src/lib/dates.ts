import { TZDate } from '@date-fns/tz';

// Instants are stored as UTC Date objects. Calendar dates are stored as local `YYYY-MM-DD` strings in the
// user's time zone, so grouping by day or month never moves an item across a DST change or a month edge.
// Calendar arithmetic on local dates is done in UTC on purpose: it is pure date math with no time of day.

export const DEFAULT_TIMEZONE = 'Europe/Athens';

export type LocalDate = string; // YYYY-MM-DD
export type Month = string; // YYYY-MM

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function isLocalDate(value: string): value is LocalDate {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isMonth(value: string): value is Month {
  const m = MONTH_RE.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) throw new RangeError(`invalid local date: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
    partFormatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Wall-clock parts of an instant in a time zone. `weekday` is ISO (Monday = 1 … Sunday = 7). */
export function zonedParts(instant: Date, tz: string = DEFAULT_TIMEZONE) {
  const parts = Object.fromEntries(partsFormatter(tz).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday ?? ''] ?? 0,
  };
}

/** The local calendar date of an instant in a time zone. */
export function toLocalDate(instant: Date, tz: string = DEFAULT_TIMEZONE): LocalDate {
  const p = zonedParts(instant, tz);
  return formatLocalDate(p.year, p.month, p.day);
}

/** The UTC instant of a local wall-clock time. A time skipped by DST resolves to the next valid time. */
export function zonedInstant(date: LocalDate, time = '00:00', tz: string = DEFAULT_TIMEZONE): Date {
  const { year, month, day } = parseLocalDate(date);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(new TZDate(year, month - 1, day, hh ?? 0, mm ?? 0, tz).getTime());
}

export function monthOf(date: LocalDate): Month {
  return date.slice(0, 7);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Adds months and clamps the day to the last day of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: LocalDate, months: number, preferredDay?: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return formatLocalDate(y, m, Math.min(preferredDay ?? day, daysInMonth(y, m)));
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** ISO weekday of a local date (Monday = 1 … Sunday = 7). */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  const w = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function addMonthsToMonth(month: Month, months: number): Month {
  return monthOf(addMonths(`${month}-01`, months));
}

export function monthBounds(month: Month): { first: LocalDate; last: LocalDate } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { first: `${month}-01`, last: formatLocalDate(y, m, daysInMonth(y, m)) };
}

/** Whole calendar months from `from` to `to` (2026-01 → 2026-03 = 2). */
export function monthsBetween(from: Month, to: Month): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
