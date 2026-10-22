import { describe, expect, it } from 'vitest';
import { monthlyEquivalent, nextOccurrence, occurrences } from '@/lib/recurrence';

describe('occurrences', () => {
  it('clamps a monthly schedule on the 31st to short months', () => {
    expect(occurrences({ frequency: 'monthly', startDate: '2026-01-31' }, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('honours an explicit day of month and the window', () => {
    expect(occurrences({ frequency: 'monthly', startDate: '2026-01-10', dayOfMonth: 25 }, '2026-03-01', '2026-04-30')).toEqual([
      '2026-03-25',
      '2026-04-25',
    ]);
  });

  it('never returns dates before the start date', () => {
    expect(occurrences({ frequency: 'monthly', startDate: '2026-03-20', dayOfMonth: 5 }, '2026-03-01', '2026-05-31')).toEqual([
      '2026-04-05',
      '2026-05-05',
    ]);
  });

  it('handles quarterly and yearly (leap day) schedules', () => {
    expect(occurrences({ frequency: 'quarterly', startDate: '2026-01-15' }, '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
    expect(occurrences({ frequency: 'yearly', startDate: '2028-02-29' }, '2028-01-01', '2031-12-31')).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
    ]);
  });

  it('steps weekly and biweekly across both DST changes without drifting', () => {
    expect(occurrences({ frequency: 'weekly', startDate: '2026-03-22' }, '2026-03-20', '2026-04-06')).toEqual([
      '2026-03-22',
      '2026-03-29',
      '2026-04-05',
    ]);
    expect(occurrences({ frequency: 'biweekly', startDate: '2026-10-11' }, '2026-10-20', '2026-11-30')).toEqual([
      '2026-10-25',
      '2026-11-08',
      '2026-11-22',
    ]);
  });

  it('stops at the end date and returns nothing for an empty window', () => {
    expect(occurrences({ frequency: 'monthly', startDate: '2026-01-05', endDate: '2026-03-05' }, '2026-01-01', '2026-12-31')).toHaveLength(3);
    expect(occurrences({ frequency: 'monthly', startDate: '2026-06-05' }, '2026-01-01', '2026-05-31')).toEqual([]);
  });
});

describe('nextOccurrence and monthly equivalents', () => {
  it('finds the next renewal on or after a date', () => {
    const s = { frequency: 'yearly' as const, startDate: '2025-11-03' };
    expect(nextOccurrence(s, '2026-10-22')).toBe('2026-11-03');
    expect(nextOccurrence(s, '2026-11-03')).toBe('2026-11-03');
    expect(nextOccurrence({ frequency: 'monthly', startDate: '2026-01-01', endDate: '2026-02-01' }, '2026-03-01')).toBeNull();
  });
  it('converts amounts to a monthly equivalent', () => {
    expect(monthlyEquivalent(12000, 'yearly')).toBe(1000);
    expect(monthlyEquivalent(1000, 'weekly')).toBe(4333);
    expect(monthlyEquivalent(999, 'monthly')).toBe(999);
  });
});
