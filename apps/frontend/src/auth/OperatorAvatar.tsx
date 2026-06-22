import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

function initialsFromName(name?: string): string {
  if (!name?.trim()) return 'OP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function OperatorAvatar({
  displayName,
  size = 'md',
  className,
}: {
  displayName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}): ReactElement {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-sm';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--brand-navy-wash)] font-semibold text-[var(--brand-navy)]',
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {initialsFromName(displayName)}
    </span>
  );
}
