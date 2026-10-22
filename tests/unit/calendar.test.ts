import { describe, expect, it } from 'vitest';
import { agenda, buildMonth, type CalendarItem } from '@/lib/calendar';
import { toLocalDate } from '@/lib/dates';

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  key: Math.random().toString(36),
  kind: 'expense',
  state: 'expected',
  localDate: '2026-10-01',
  label: 'x',
  amountMinor: 1000,
  transactionId: null,
  ...over,
});

describe('buildMonth', () => {
  it('lays out Monday-first weeks covering the whole month', () => {
    const { weeks, days } = buildMonth('2026-02', '2026-02-10', []);
    expect(days[0]!.date).toBe('2026-01-26'); // Monday before 1 Feb 2026 (a Sunday)
    expect(days.at(-1)!.date).toBe('2026-03-01');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(days.filter((d) => d.inMonth)).toHaveLength(28);
    expect(days.find((d) => d.isToday)?.date).toBe('2026-02-10');
  });

  it('keeps items on their stored local date across month boundaries', () => {
    // 2026-03-01 00:30 in Athens is 2026-02-28 22:30 UTC: the stored local date decides the day.
    const localDate = toLocalDate(new Date('2026-02-28T22:30:00Z'), 'Europe/Athens');
    const { days } = buildMonth('2026-03', null, [item({ localDate, kind: 'income', state: 'done' })]);
    expect(days.find((d) => d.date === '2026-03-01')!.items).toHaveLength(1);
    expect(days.find((d) => d.date === '2026-02-28')?.items ?? []).toHaveLength(0);
  });

  it('places items on both DST change days correctly', () => {
    const spring = toLocalDate(new Date('2026-03-29T21:59:00Z'), 'Europe/Athens'); // 00:59 EEST on the 30th
    const autumn = toLocalDate(new Date('2026-10-25T21:30:00Z'), 'Europe/Athens'); // 23:30 EET on the 25th
    expect(spring).toBe('2026-03-30');
    expect(autumn).toBe('2026-10-25');
    const { days } = buildMonth('2026-10', null, [item({ localDate: autumn })]);
    expect(days.find((d) => d.date === '2026-10-25')!.items).toHaveLength(1);
  });

  it('separates expected, done and projected items and sums the day', () => {
    const items = [
      item({ localDate: '2026-10-05', kind: 'income', state: 'done', amountMinor: 150000 }),
      item({ localDate: '2026-10-05', kind: 'renewal', state: 'expected', amountMinor: 1299 }),
      item({ localDate: '2026-10-05', kind: 'expense', state: 'projected', amountMinor: 5000 }),
    ];
    const day = buildMonth('2026-10', null, items).days.find((d) => d.date === '2026-10-05')!;
    expect(day.items.map((i) => i.kind)).toEqual(['income', 'renewal', 'expense']);
    expect(day.totals).toEqual({ inMinor: 150000, outMinor: 6299 });
  });

  it('builds an agenda of in-month days with items only', () => {
    const { days } = buildMonth('2026-10', null, [item({ localDate: '2026-09-30' }), item({ localDate: '2026-10-07' })]);
    expect(agenda(days).map((d) => d.date)).toEqual(['2026-10-07']);
  });
});
