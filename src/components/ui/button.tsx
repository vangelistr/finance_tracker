import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover active:translate-y-px disabled:bg-surface-2 disabled:text-ink-3',
  secondary:
    'bg-surface text-ink border border-rule-strong hover:bg-surface-hover active:translate-y-px disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-surface-hover hover:text-ink disabled:text-ink-3',
  // Destructive actions stay outlined until deliberately hovered or focused.
  danger:
    'border border-danger/60 text-danger bg-transparent hover:bg-danger hover:text-accent-ink focus-visible:bg-danger focus-visible:text-accent-ink disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  // Small buttons keep a 44 px touch target on phones and tighten on pointer screens.
  sm: 'min-h-11 sm:min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-base gap-2',
  lg: 'min-h-13 px-5 text-lg gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-md font-medium select-none',
    'transition-[background-color,color,transform] duration-150 ease-out',
    'disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={2} /> : icon}
      {children}
    </button>
  );
}
