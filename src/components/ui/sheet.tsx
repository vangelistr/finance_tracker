'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}

/**
 * Bottom sheet on phones, a centred panel on wider screens. Built on <dialog> for focus trapping,
 * Escape handling and the top layer (never clipped by an overflow ancestor).
 */
export function Sheet({ open, onClose, title, closeLabel, children, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'fixed m-0 mt-auto w-full max-w-none bg-surface p-0 text-ink shadow-[var(--shadow-overlay)] backdrop:bg-[var(--scrim)]',
        'max-h-[88dvh] rounded-t-xl sm:m-auto sm:max-h-[80dvh] sm:w-[min(32rem,calc(100%-2rem))] sm:rounded-xl',
        'open:animate-[sheet-in_220ms_var(--ease-out-quint)]',
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rule bg-surface px-5 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-2 grid size-11 place-items-center rounded-md text-ink-2 hover:bg-surface-hover hover:text-ink">
          <X aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </div>
      <div className="px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">{children}</div>
    </dialog>
  );
}
