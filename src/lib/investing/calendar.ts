import { addDays, toLocalDate, weekdayOf, zonedInstant, type LocalDate } from '@/lib/dates';
import { EXCHANGE_INFO, marketOf, type Exchange } from './instruments';

// Exchange calendars and refresh slots (docs/MARKET-DATA.md section 5). Pure functions over an injected `now`.

/** NYSE full-day closures, NYSE "Holidays and trading hours" page, read 2026-10-22. */
const NYSE_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

/**
 * Euronext closures on all its markets in 2026 (Euronext trading hours page, read 2026-10-22). Xetra, LSE, Borsa
 * Italiana and SIX lists were not read [uncertain]: those listings use weekdays only, so on their holidays a quote
 * shows as stale for a day and gets one extra retry.
 */
const EURONEXT_HOLIDAYS = new Set(['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-25']);

function isHoliday(exchange: Exchange, date: LocalDate): boolean {
  if (marketOf(exchange) === 'us') return NYSE_HOLIDAYS.has(date);
  if (exchange === 'XAMS' || exchange === 'XPAR') return EURONEXT_HOLIDAYS.has(date);
  return false;
}

export function isTradingDay(exchange: Exchange, date: LocalDate): boolean {
  return weekdayOf(date) <= 5 && !isHoliday(exchange, date);
}

/**
 * The newest session whose end-of-day bar should be published by `now`: the last trading day before today in the
 * exchange's own time zone. Twelve Data documents US EOD data "after 12:00 AM ET on the next trading day"; EODHD
 * publishes European exchanges 2-3 hours after the close, so "before today" holds for both.
 */
export function expectedLastClose(exchange: Exchange, now: Date): LocalDate {
  let d = addDays(toLocalDate(now, EXCHANGE_INFO[exchange].timezone), -1);
  for (let i = 0; i < 14 && !isTradingDay(exchange, d); i++) d = addDays(d, -1);
  return d;
}

/** A quote is stale once it misses one expected close. */
export function isStale(lastBarDate: LocalDate | null, exchange: Exchange, now: Date): boolean {
  return lastBarDate === null || lastBarDate < expectedLastClose(exchange, now);
}

/** Refresh slots in Europe/Athens (MARKET-DATA 5.4): the main run and the retry for symbols still stale. */
export const REFRESH_TIMEZONE = 'Europe/Athens';
export const REFRESH_SLOTS = ['07:30', '12:30'] as const;

/**
 * The refresh slot `now` belongs to, as `YYYY-MM-DDTHH:MM` in Europe/Athens: the latest slot at or before `now`.
 * Each instrument is attempted at most once per slot, so a restart inside a slot never repeats calls, and a worker
 * that was down catches up in the next tick (a new slot key). Sunday and Monday mornings follow no US session, so
 * their slots only pick up instruments that are still behind (the expected close does not move).
 */
export function refreshSlot(now: Date): { key: string; retry: boolean } {
  const today = toLocalDate(now, REFRESH_TIMEZONE);
  for (let i = REFRESH_SLOTS.length - 1; i >= 0; i--) {
    const time = REFRESH_SLOTS[i]!;
    if (now.getTime() >= zonedInstant(today, time, REFRESH_TIMEZONE).getTime()) return { key: `${today}T${time}`, retry: i > 0 };
  }
  return { key: `${addDays(today, -1)}T${REFRESH_SLOTS[REFRESH_SLOTS.length - 1]}`, retry: true };
}

/** The digest goes out from 08:00 local, after the main refresh slot. */
export const DIGEST_TIME = '08:00';
