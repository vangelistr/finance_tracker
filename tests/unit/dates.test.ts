import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  isLocalDate,
  monthBounds,
  monthsBetween,
  toLocalDate,
  weekdayOf,
  zonedInstant,
  zonedParts,
} from '@/lib/dates';

const TZ = 'Europe/Athens';

describe('local dates in Europe/Athens', () => {
  it('maps 00:30 local on the 1st to the 1st, not the previous month', () => {
    // 2026-03-01 00:30 EET = 2026-02-28 22:30 UTC
    expect(toLocalDate(new Date('2026-02-28T22:30:00Z'), TZ)).toBe('2026-03-01');
  });

  it('handles the spring-forward day (last Sunday of March)', () => {
    // 2026-03-29: 03:00 EET jumps to 04:00 EEST
    expect(zonedInstant('2026-03-29', '02:30', TZ).toISOString()).toBe('2026-03-29T00:30:00.000Z');
    expect(zonedInstant('2026-03-29', '09:00', TZ).toISOString()).toBe('2026-03-29T06:00:00.000Z');
    expect(toLocalDate(zonedInstant('2026-03-29', '23:59', TZ), TZ)).toBe('2026-03-29');
  });

  it('handles the fall-back day (last Sunday of October)', () => {
    // 2026-10-25: 04:00 EEST goes back to 03:00 EET
    expect(zonedInstant('2026-10-25', '21:00', TZ).toISOString()).toBe('2026-10-25T19:00:00.000Z');
    expect(zonedInstant('2026-10-24', '21:00', TZ).toISOString()).toBe('2026-10-24T18:00:00.000Z');
    expect(toLocalDate(new Date('2026-10-25T21:59:00Z'), TZ)).toBe('2026-10-25');
    expect(toLocalDate(new Date('2026-10-25T22:00:00Z'), TZ)).toBe('2026-10-26');
  });

  it('returns wall-clock parts', () => {
    expect(zonedParts(new Date('2026-07-01T18:00:00Z'), TZ)).toMatchObject({ hour: 21, minute: 0, day: 1, weekday: 3 });
  });
});

describe('calendar arithmetic', () => {
  it('validates local dates', () => {
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
  });
  it('adds days across month and year edges', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('clamps month-end days', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
  });
  it('computes bounds and distances', () => {
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(weekdayOf('2026-10-25')).toBe(7);
  });
});
