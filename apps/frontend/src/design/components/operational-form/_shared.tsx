import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const operationalControlClassName =
  'w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60';

export interface OperationalControlProps {
  id?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

export function operationalToneClass(tone?: string): string {
  switch (tone) {
    case 'nominal':
      return 'border-[var(--status-nominal)]/50 bg-[var(--status-nominal)]/12 text-[var(--status-nominal)]';
    case 'watch':
      return 'border-[var(--status-watch)]/50 bg-[var(--status-watch)]/12 text-[var(--status-watch)]';
    case 'warning':
      return 'border-[var(--status-warning)]/50 bg-[var(--status-warning)]/12 text-[var(--status-warning)]';
    case 'critical':
      return 'border-[var(--status-critical)]/50 bg-[var(--status-critical)]/12 text-[var(--status-critical)]';
    default:
      return 'border-[var(--border)] bg-[var(--muted)]/30 text-[var(--foreground)]';
  }
}

export function OperationalChip({
  label,
  selected,
  tone,
  disabled,
  onClick,
  title,
  blockedReason,
}: {
  label: string;
  selected?: boolean;
  tone?: string;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  blockedReason?: string;
}): ReactElement {
  const blocked = Boolean(blockedReason);
  return (
    <button
      type="button"
      disabled={disabled || blocked}
      title={title ?? blockedReason}
      aria-pressed={selected}
      aria-disabled={blocked || undefined}
      onClick={onClick}
      className={cn(
        'min-h-9 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        selected ? operationalToneClass(tone) : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]',
        (disabled || blocked) && 'cursor-not-allowed opacity-60',
      )}
    >
      {label}
    </button>
  );
}

export function OperationalFieldHint({ id, children }: { id?: string; children: ReactNode }): ReactElement | null {
  if (!children) return null;
  return <p id={id} className="text-xs leading-relaxed text-[var(--muted-foreground)]">{children}</p>;
}
