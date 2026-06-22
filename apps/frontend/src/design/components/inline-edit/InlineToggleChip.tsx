import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export function InlineToggleChip({
  active,
  label,
  activeLabel,
  onToggle,
  disabled,
  className,
}: {
  active: boolean;
  label: string;
  activeLabel?: string;
  onToggle: (next: boolean) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}): ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex min-h-8 touch-manipulation items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50',
        active
          ? 'border-[var(--warning-border,var(--border))] bg-[color-mix(in_srgb,var(--status-warning,#eab308)_14%,var(--card))]'
          : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]',
        className,
      )}
      onClick={() => void onToggle(!active)}
      title={active ? 'Follow-up flagged — click to clear' : 'Flag for follow-up'}
    >
      {active ? (activeLabel ?? label) : label}
    </button>
  );
}
