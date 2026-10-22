import type { ReactNode } from 'react';

/** Teaches the next action instead of saying "nothing here". */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex max-w-prose flex-col items-start gap-2 py-6">
      <p className="font-semibold">{title}</p>
      {body && <p className="text-ink-2">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
