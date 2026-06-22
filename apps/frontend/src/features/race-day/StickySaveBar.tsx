import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/design/components/button';
import { cn } from '@/lib/utils';

export function StickySaveBar({
  visible,
  message,
  error,
  saving,
  onSave,
  onCancel,
  saveLabel = 'Save',
  children,
}: {
  visible: boolean;
  message?: string;
  error?: string;
  saving?: boolean;
  onSave: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  children?: ReactNode;
}): ReactElement | null {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-4 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-4 py-3 backdrop-blur-sm',
        'supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--card)_85%,transparent)]',
      )}
      role="region"
      aria-label="Quick entry actions"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-sm">
          {error ? (
            <p className="text-[var(--status-critical)]">{error}</p>
          ) : message ? (
            <p className="text-[var(--muted-foreground)]">{message}</p>
          ) : (
            children
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          ) : null}
          <Button type="button" variant="governance" size="sm" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
