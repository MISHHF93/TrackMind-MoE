import type { RaceCardLifecycleStatus } from '@trackmind/shared';
import { raceCardLifecycleMeta } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

const toneClass: Record<string, string> = {
  draft: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  review: 'bg-[var(--status-watch)]/20 text-[var(--status-watch)]',
  approved: 'bg-[var(--status-nominal)]/20 text-[var(--status-nominal)]',
  published: 'bg-[var(--ring)]/20 text-[var(--foreground)]',
  completed: 'bg-[var(--border)] text-[var(--muted-foreground)]',
  archived: 'bg-[var(--border)] text-[var(--muted-foreground)]',
};

export function RaceCardLifecycleBadge({
  status,
  className,
  showDescription = false,
}: {
  status: RaceCardLifecycleStatus | string;
  className?: string;
  showDescription?: boolean;
}): ReactElement {
  const normalized = String(status) as RaceCardLifecycleStatus;
  const meta = raceCardLifecycleMeta[normalized] ?? {
    label: String(status),
    tone: 'draft' as const,
    description: '',
  };

  return (
    <span className={cn('inline-flex flex-col gap-0.5', className)}>
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide', toneClass[meta.tone])}>
        {meta.label}
      </span>
      {showDescription && meta.description ? (
        <span className="text-xs text-[var(--muted-foreground)]">{meta.description}</span>
      ) : null}
    </span>
  );
}
