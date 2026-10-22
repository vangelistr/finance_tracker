import { describe, expect, it } from 'vitest';
import { goalStatus } from '@/lib/goals';

describe('goalStatus', () => {
  it('computes progress, required monthly amount and projected completion', () => {
    const s = goalStatus(
      {
        targetMinor: 120000,
        savedMinor: 30000,
        deadline: '2027-04-30',
        contributions: [
          { month: '2026-08', amountMinor: 10000 },
          { month: '2026-09', amountMinor: 10000 },
          { month: '2026-10', amountMinor: 10000 },
        ],
      },
      '2026-10-22',
    );
    expect(s).toMatchObject({ progressBps: 2500, remainingMinor: 90000, monthsLeft: 6, requiredMonthlyMinor: 15000, paceMinor: 10000, projectedMonth: '2027-07', reached: false });
  });

  it('uses at least one month for a deadline this month and flags a passed deadline', () => {
    expect(goalStatus({ targetMinor: 1000, savedMinor: 0, deadline: '2026-10-31', contributions: [] }, '2026-10-22')).toMatchObject({ monthsLeft: 1, requiredMonthlyMinor: 1000, deadlinePassed: false });
    expect(goalStatus({ targetMinor: 1000, savedMinor: 0, deadline: '2026-05-31', contributions: [] }, '2026-10-22')).toMatchObject({ monthsLeft: 1, requiredMonthlyMinor: 1000, deadlinePassed: true });
  });

  it('handles reached targets, zero pace and no deadline', () => {
    expect(goalStatus({ targetMinor: 1000, savedMinor: 1500, deadline: null, contributions: [] }, '2026-10-22')).toMatchObject({ progressBps: 10000, reached: true, requiredMonthlyMinor: null, projectedMonth: '2026-10' });
    expect(goalStatus({ targetMinor: 1000, savedMinor: 0, deadline: null, contributions: [{ month: '2026-01', amountMinor: 500 }] }, '2026-10-22')).toMatchObject({ paceMinor: 0, projectedMonth: null, requiredMonthlyMinor: null });
    expect(goalStatus({ targetMinor: 1000, savedMinor: 100, deadline: '2027-01-15', contributions: [] }, '2026-10-22').requiredMonthlyMinor).toBe(300);
  });
});
