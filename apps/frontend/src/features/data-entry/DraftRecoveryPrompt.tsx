import type { DataEntryDraftRecord } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { Button } from '@/design/components/button';

export function DraftRecoveryPrompt({
  draft,
  onRestore,
  onDiscard,
  className,
}: {
  draft: DataEntryDraftRecord;
  onRestore: () => void;
  onDiscard: () => void;
  className?: string;
}): ReactElement {
  return (
    <div
      role="alert"
      className={className ?? 'rounded-md border border-[var(--warning-border,var(--border))] bg-[color-mix(in_srgb,var(--status-warning,#eab308)_10%,var(--card))] px-3 py-3 text-sm'}
    >
      <p className="font-medium">Unsaved session found</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
        A {draft.status === 'autosaved' ? 'autosaved' : 'draft'} session from {draft.updatedAt.slice(0, 16).replace('T', ' ')} can be restored.
        Choose restore to continue where you left off, or start fresh to discard it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="governance" className="min-h-10 touch-manipulation" onClick={onRestore}>
          Restore draft
        </Button>
        <Button size="sm" variant="outline" className="min-h-10 touch-manipulation" onClick={onDiscard}>
          Start fresh
        </Button>
      </div>
    </div>
  );
}
