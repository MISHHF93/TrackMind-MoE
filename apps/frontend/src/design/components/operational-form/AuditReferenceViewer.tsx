import { parseOperationalAuditReference } from '@trackmind/shared';
import { ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import type { OperationalControlProps } from './_shared';

export function AuditReferenceViewer({
  id,
  value,
  className,
  'aria-labelledby': ariaLabelledBy,
}: OperationalControlProps & {
  value: unknown;
  'aria-labelledby'?: string;
}): ReactElement {
  const reference = parseOperationalAuditReference(value);

  if (!reference) {
    return (
      <div id={id} className={cn('rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-sm text-[var(--muted-foreground)]', className)}>
        No audit reference attached.
      </div>
    );
  }

  return (
    <div
      id={id}
      role="region"
      aria-labelledby={ariaLabelledBy}
      className={cn('rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm', className)}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--status-nominal)]" aria-hidden />
        <div className="grid gap-1 min-w-0">
          <p className="font-medium truncate">{reference.id}</p>
          {reference.action ? <p className="text-[var(--muted-foreground)]">Action: {reference.action}</p> : null}
          {reference.actor ? <p className="text-[var(--muted-foreground)]">Actor: {reference.actor}</p> : null}
          {reference.timestamp ? <p className="text-[var(--muted-foreground)]">Recorded: {reference.timestamp}</p> : null}
          {reference.integrityHash ? (
            <p className="font-mono text-xs text-[var(--muted-foreground)] truncate">Hash: {reference.integrityHash}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
