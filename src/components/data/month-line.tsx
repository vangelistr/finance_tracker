import { daysInMonth, parseLocalDate, type LocalDate, type Month } from '@/lib/dates';
import { cn } from '@/lib/cn';

export type StationKind = 'income' | 'expense' | 'renewal' | 'goal' | 'tax';

export interface Station {
  date: LocalDate;
  kind: StationKind;
  done: boolean;
  label: string;
}

const KIND_COLOUR: Record<StationKind, string> = {
  income: 'var(--income)',
  expense: 'var(--spend)',
  renewal: 'var(--accent)',
  goal: 'var(--goal-fill)',
  tax: 'var(--tax)',
};

interface MonthLineProps {
  month: Month;
  today: LocalDate | null;
  stations: Station[];
  summary: string; // accessible description of the whole line
  todayLabel: string;
  className?: string;
}

/**
 * The month drawn as a metro line. Each dated item is a station on its day: hollow while expected, filled once
 * received or paid. Days with several items become an interchange (a pill). The run already travelled is solid.
 */
export function MonthLine({ month, today, stations, summary, todayLabel, className }: MonthLineProps) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const days = daysInMonth(y, m);
  const W = 1000;
  const PAD = 16;
  const x = (day: number) => PAD + ((day - 1) / (days - 1)) * (W - 2 * PAD);
  const todayDay = today && today.startsWith(month) ? parseLocalDate(today).day : null;

  const byDay = new Map<number, Station[]>();
  for (const s of stations) {
    const d = parseLocalDate(s.date).day;
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }

  const ticks = [1, 10, 20, days];

  return (
    <figure className={cn('m-0', className)}>
      <svg viewBox={`0 0 ${W} 72`} preserveAspectRatio="none" role="img" aria-label={summary} className="block h-[72px] w-full overflow-visible">
        <line x1={PAD} x2={W - PAD} y1={28} y2={28} stroke="var(--rule-strong)" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {todayDay && (
          <line x1={PAD} x2={x(todayDay)} y1={28} y2={28} stroke="var(--ink)" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* Stations and labels are HTML so circles stay round whatever the width */}
      <div aria-hidden className="relative -mt-[72px] h-[72px]">
        {todayDay && (
          <>
            {/* You are here: a tick through the line, drawn under the stations so none is hidden */}
            <span className="absolute top-[16px] h-6 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: `${(x(todayDay) / W) * 100}%` }} />
            <span className="absolute top-[44px] -translate-x-1/2 text-xs font-semibold text-ink" style={{ left: `${(x(todayDay) / W) * 100}%` }}>
              {todayLabel}
            </span>
          </>
        )}
        {[...byDay.entries()].map(([day, list]) => {
          const left = `${(x(day) / W) * 100}%`;
          if (list.length === 1) {
            const s = list[0]!;
            return (
              <span
                key={day}
                title={s.label}
                className="absolute top-[28px] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
                style={{ left, borderColor: KIND_COLOUR[s.kind], background: s.done ? KIND_COLOUR[s.kind] : 'var(--surface)' }}
              />
            );
          }
          const allDone = list.every((s) => s.done);
          return (
            <span
              key={day}
              title={list.map((s) => s.label).join(', ')}
              className="num absolute top-[28px] flex h-4.5 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[2.5px] border-ink px-1 text-[0.6875rem] leading-none font-semibold"
              style={{ left, background: allDone ? 'var(--ink)' : 'var(--surface)', color: allDone ? 'var(--surface)' : 'var(--ink)' }}
            >
              {list.length}
            </span>
          );
        })}
        {ticks.map((d) => (
          <span
            key={d}
            className={cn('num absolute top-0 text-[0.6875rem] text-ink-3', d === 1 ? 'translate-x-0' : d === days ? '-translate-x-full' : '-translate-x-1/2')}
            style={{ left: `${(x(d) / W) * 100}%` }}
          >
            {d}
          </span>
        ))}
      </div>
    </figure>
  );
}
