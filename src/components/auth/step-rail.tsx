import { cn } from '@/lib/cn';

/** Wizard progress drawn as a short line: passed stations filled, the current one ringed, the rest hollow. */
export function StepRail({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {label}: {steps[current]}
      </p>
      <ol aria-hidden className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex flex-col gap-2">
              <div className="flex items-center">
                <span
                  className={cn(
                    'z-10 size-4 shrink-0 rounded-full border-[3px]',
                    done && 'border-accent bg-accent',
                    active && 'border-accent bg-surface ring-4 ring-accent/20',
                    !done && !active && 'border-rule-strong bg-surface',
                  )}
                />
                {i < steps.length - 1 && <span className={cn('-ml-px h-1 flex-1', done ? 'bg-accent' : 'bg-rule')} />}
              </div>
              <span className={cn('text-sm', active ? 'font-semibold text-ink' : 'text-ink-3')}>{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
