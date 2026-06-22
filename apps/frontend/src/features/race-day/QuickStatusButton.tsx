import { cn } from '@/lib/utils';
import type { QuickStatusTone } from '@trackmind/shared';
import type { ButtonHTMLAttributes, ReactElement } from 'react';

const toneClasses: Record<QuickStatusTone, string> = {
  nominal: 'border-[var(--status-nominal,var(--border))] bg-[color-mix(in_srgb,var(--status-nominal,#22c55e)_12%,var(--card))] text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--status-nominal,#22c55e)_20%,var(--card))]',
  watch: 'border-[var(--warning-border,var(--border))] bg-[color-mix(in_srgb,var(--status-warning,#eab308)_12%,var(--card))] hover:bg-[color-mix(in_srgb,var(--status-warning,#eab308)_20%,var(--card))]',
  warning: 'border-[var(--warning-border,var(--border))] bg-[color-mix(in_srgb,var(--status-warning,#f97316)_14%,var(--card))] hover:bg-[color-mix(in_srgb,var(--status-warning,#f97316)_22%,var(--card))]',
  critical: 'border-[var(--status-critical)] bg-[color-mix(in_srgb,var(--status-critical)_12%,var(--card))] text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--status-critical)_20%,var(--card))]',
  neutral: 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]',
};

export function QuickStatusButton({
  label,
  shortLabel,
  tone = 'neutral',
  selected,
  compact,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortLabel?: string;
  tone?: QuickStatusTone;
  selected?: boolean;
  compact?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-12 min-w-[4.5rem] touch-manipulation flex-col items-center justify-center rounded-lg border px-3 py-2 text-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50',
        compact ? 'min-h-10 min-w-[3.5rem] px-2 py-1.5 text-xs' : 'text-sm',
        toneClasses[tone],
        selected && 'ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--background)]',
        className,
      )}
      aria-pressed={selected}
      {...props}
    >
      <span className="leading-tight">{shortLabel ?? label}</span>
      {shortLabel && !compact ? (
        <span className="mt-0.5 text-[10px] font-normal uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </span>
      ) : null}
    </button>
  );
}

export function QuickActionChip({
  label,
  active,
  shortcut,
  onClick,
}: {
  label: string;
  active?: boolean;
  shortcut?: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        active
          ? 'border-[var(--brand-maroon)] bg-[color-mix(in_srgb,var(--brand-maroon)_10%,var(--card))] text-[var(--brand-maroon)]'
          : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]',
      )}
    >
      {label}
      {shortcut ? (
        <kbd className="hidden rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--muted-foreground)] sm:inline">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}
