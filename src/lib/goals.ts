import { addMonthsToMonth, monthOf, monthsBetween, type LocalDate, type Month } from './dates';

// Savings goal arithmetic (PLAN 6.3). Integer cents; months are calendar months in the user's time zone.

export interface GoalInput {
  targetMinor: number;
  savedMinor: number;
  deadline: LocalDate | null;
  /** Contributions as (month, amount), used for the pace. */
  contributions: Array<{ month: Month; amountMinor: number }>;
}

export interface GoalStatus {
  /** Saved / target in basis points, capped at 10000 for display. */
  progressBps: number;
  remainingMinor: number;
  monthsLeft: number | null;
  requiredMonthlyMinor: number | null;
  /** Average contribution per month over the current and the two previous calendar months. */
  paceMinor: number;
  projectedMonth: Month | null;
  reached: boolean;
  deadlinePassed: boolean;
}

export function goalStatus(g: GoalInput, today: LocalDate): GoalStatus {
  const current = monthOf(today);
  const remaining = Math.max(0, g.targetMinor - g.savedMinor);
  const reached = g.targetMinor > 0 && remaining === 0;
  const deadlineMonth = g.deadline ? monthOf(g.deadline) : null;
  const diff = deadlineMonth ? monthsBetween(current, deadlineMonth) : null;
  const monthsLeft = diff === null ? null : Math.max(1, diff);
  const window = [addMonthsToMonth(current, -2), addMonthsToMonth(current, -1), current];
  const pace = Math.floor(g.contributions.filter((c) => window.includes(c.month)).reduce((s, c) => s + c.amountMinor, 0) / 3);
  return {
    progressBps: g.targetMinor > 0 ? Math.min(10_000, Math.floor((g.savedMinor * 10_000) / g.targetMinor)) : 0,
    remainingMinor: remaining,
    monthsLeft,
    requiredMonthlyMinor: monthsLeft === null || reached ? null : Math.ceil(remaining / monthsLeft),
    paceMinor: Math.max(0, pace),
    projectedMonth: reached ? current : pace > 0 ? addMonthsToMonth(current, Math.ceil(remaining / pace)) : null,
    reached,
    deadlinePassed: diff !== null && diff < 0 && !reached,
  };
}
