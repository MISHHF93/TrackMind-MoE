import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('animate-pulse rounded-md bg-[var(--muted)]', className)} {...props} />;
}

export function LoadingState({ label = 'Loading workspace data…' }: { label?: string }): ReactElement {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message?: string; onRetry?: () => void }): ReactElement {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_8%,transparent)] p-4">
      <h3 className="font-semibold text-[var(--status-critical)]">{title}</h3>
      {message ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{message}</p> : null}
      {onRetry ? (
        <button type="button" className="mt-3 text-sm font-medium text-[var(--primary)]" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }): ReactElement {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-8 text-center">
      <h3 className="font-medium">{title}</h3>
      {description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}
    </div>
  );
}
