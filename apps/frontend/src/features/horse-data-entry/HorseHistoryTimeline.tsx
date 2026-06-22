import type { HorseTimelineEntry } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

const categoryTone: Record<HorseTimelineEntry['category'], string> = {
  identity: 'border-l-[var(--status-nominal)]',
  ownership: 'border-l-[var(--ring)]',
  trainer: 'border-l-[var(--ring)]',
  stable: 'border-l-[var(--ring)]',
  eligibility: 'border-l-[var(--status-watch)]',
  transport: 'border-l-[var(--status-watch)]',
  workout: 'border-l-[var(--status-nominal)]',
  welfare: 'border-l-[var(--status-warning)]',
  retirement: 'border-l-[var(--status-critical)]',
  audit: 'border-l-[var(--border)]',
};

export function HorseHistoryTimeline({
  entries,
  className,
  emptyLabel = 'No history entries yet.',
}: {
  entries: HorseTimelineEntry[];
  className?: string;
  emptyLabel?: string;
}): ReactElement {
  if (!entries.length) {
    return <p className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</p>;
  }

  return (
    <ol className={cn('space-y-2', className)}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            'rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] px-3 py-2 text-sm',
            categoryTone[entry.category],
            entry.restricted && 'opacity-90',
          )}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-[var(--foreground)]">
              {entry.title}
              {entry.restricted ? (
                <span className="ml-2 rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  restricted
                </span>
              ) : null}
            </span>
            <time className="text-xs text-[var(--muted-foreground)]">{entry.at}</time>
          </div>
          <p className="mt-1 text-[var(--muted-foreground)]">{entry.detail}</p>
          {(entry.actor || entry.source) ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {[entry.actor ? `Actor: ${entry.actor}` : null, entry.source ? `Source: ${entry.source}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
