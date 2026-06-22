import type { ReactElement } from 'react';
import { Button } from '@/design/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design/components/dialog';

export function DataLossWarningDialog({
  open,
  onOpenChange,
  title = 'Discard unsaved changes?',
  description = 'You have unsaved form changes. Leaving now may lose work unless you save a draft first.',
  confirmLabel = 'Discard changes',
  cancelLabel = 'Keep editing',
  onConfirm,
  onSaveDraft,
  savingDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onSaveDraft?: () => void | Promise<void>;
  savingDraft?: boolean;
}): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent governance className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-[var(--muted-foreground)]">
          Autosaved drafts are retained according to workflow policy. Regulated submissions still require approval.
        </p>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          {onSaveDraft ? (
            <Button size="sm" variant="secondary" disabled={savingDraft} onClick={() => void onSaveDraft()}>
              {savingDraft ? 'Saving draft…' : 'Save draft'}
            </Button>
          ) : null}
          <Button size="sm" variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
