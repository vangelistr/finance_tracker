import { cn } from '@/lib/cn';

/**
 * The product mark: a station ring on a line. Hollow = expected, filled = done; the same mark is used for
 * dated items across the app.
 */
export function StationMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M2 16h28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="8" fill="var(--rail)" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

export function Wordmark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-semibold tracking-[-0.01em]', className)}>
      <StationMark className="size-7" />
      <span>{name}</span>
    </span>
  );
}
