import type { DataEntryDraftStatus } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/design/components/button';

const statusLabels: Record<DataEntryDraftStatus, string> = {
  draft: 'Draft saved',
  autosaved: 'Autosaved',
  restored: 'Draft restored',
  conflict: 'Record conflict',
};

const statusTone: Record<DataEntryDraftStatus, string> = {
  draft: 'border-[var(--brand-maroon)] bg-[color-mix(in_srgb,var(--brand-maroon)_8%,var(--card))] text-[var(--brand-maroon)]',
  autosaved: 'border-[var(--border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)]',
  restored: 'border-[var(--status-nominal,#22c55e)] bg-[color-mix(in_srgb,var(--status-nominal,#22c55e)_10%,var(--card))] text-[var(--foreground)]',
  conflict: 'border-[var(--status-critical)] bg-[color-mix(in_srgb,var(--status-critical)_10%,var(--card))] text-[var(--foreground)]',
};

export function FormDraftStatusBar({
  draftStatus,
  autosaveStatus,
  conflictReason,
  updatedAt,
  onSaveDraft,
  onDiscardDraft,
  onReloadBaseline,
  className,
}: {
  draftStatus?: DataEntryDraftStatus;
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  conflictReason?: string;
  updatedAt?: string;
  onSaveDraft?: () => void;
  onDiscardDraft?: () => void;
  onReloadBaseline?: () => void;
  className?: string;
}): ReactElement | null {
  if (!draftStatus && autosaveStatus === 'idle') return null;

  const label = draftStatus
    ? statusLabels[draftStatus]
    : autosaveStatus === 'saving'
      ? 'Saving draft…'
      : autosaveStatus === 'saved'
        ? 'Autosaved'
        : autosaveStatus === 'error'
          ? 'Draft save failed'
          : null;

  if (!label) return null;

  const liveMessage = conflictReason ? `${label}. ${conflictReason}` : label;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs', draftStatus ? statusTone[draftStatus] : 'border-[var(--border)] bg-[var(--muted)]/20', className)}
    >
      <div>
        <span className="font-medium">{liveMessage}</span>
        {updatedAt ? <span className="ml-2 text-[var(--muted-foreground)]">{updatedAt.slice(0, 16).replace('T', ' ')}</span> : null}
        {conflictReason ? (
          <p className="mt-1 font-medium text-[var(--status-critical)]">{conflictReason}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {draftStatus === 'conflict' && onReloadBaseline ? (
          <Button size="sm" variant="outline" className="min-h-9 touch-manipulation" onClick={onReloadBaseline}>
            Use latest record
          </Button>
        ) : null}
        {onSaveDraft ? (
          <Button size="sm" variant="secondary" className="min-h-9 touch-manipulation" onClick={onSaveDraft}>
            Save draft
          </Button>
        ) : null}
        {onDiscardDraft ? (
          <Button size="sm" variant="outline" className="min-h-9 touch-manipulation" onClick={onDiscardDraft}>
            Discard draft
          </Button>
        ) : null}
      </div>
    </div>
  );
}
