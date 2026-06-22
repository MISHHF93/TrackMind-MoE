import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { roleCanSubmitForm, getDataEntryFormDefinition } from '@trackmind/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { useId, useState } from 'react';
import { Button } from '@/design/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design/components/dialog';
import { FormMessage } from '@/design/components/form-field';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason } from '@/domain/approvalControls';
import { TrackMindForm } from './TrackMindForm';
import { submitEntityForm, type EntityFormSubmitResult } from './submitEntityForm';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { useTrackMindForm } from './useTrackMindForm';
import { DataLossWarningDialog } from './DataLossWarningDialog';
import { DraftRecoveryPrompt } from './DraftRecoveryPrompt';
import { FormDraftStatusBar } from './FormDraftStatusBar';
import { DataQualityFeedback } from './DataQualityFeedback';

export function TrackMindFormDialog({
  entityKind,
  mode = 'create',
  recordId,
  seed,
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'Save',
  onSubmitted,
  footerExtra,
}: {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  recordId?: string;
  seed?: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmitted?: (result: EntityFormSubmitResult) => void;
  footerExtra?: ReactNode;
}): ReactElement {
  const formDomId = useId();
  const submitHelpId = `${formDomId}-submit-help`;
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const definition = getDataEntryFormDefinition(entityKind, mode);
  const form = useTrackMindForm({ entityKind, mode, recordId, seed, recoverOnMount: open });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lossWarningOpen, setLossWarningOpen] = useState(false);
  const canSubmit = roleCanSubmitForm(definition, session.role);
  const disabledReason = canSubmit
    ? undefined
    : actionDisabledReason(
      {
        id: `${entityKind}-submit`,
        label: submitLabel,
        protectedAction: definition.auditAction,
        target: recordId ?? entityKind,
        requiredRoles: [...definition.allowedRoles],
      },
      session.role,
    );

  const submit = useMutation({
    mutationFn: async () => {
      if (form.draftStatus === 'conflict') {
        throw new Error(form.conflictReason ?? 'Resolve the record conflict before submitting.');
      }
      const validation = form.validate();
      if (!validation.valid) throw new Error(validation.errors.join('; '));
      return submitEntityForm({ entityKind, mode, values: validation.normalizedValues, recordId });
    },
    onSuccess: (result) => {
      setStatusMessage(result.message ?? 'Saved.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      void form.discardDraftSession();
      onSubmitted?.(result);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      form.validate();
      setStatusMessage(error.message);
    },
  });

  const closeWithoutSaving = () => {
    setLossWarningOpen(false);
    setStatusMessage(null);
    void form.discardDraftSession();
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && form.dirtyState.isDirty) {
      if (form.warnOnDiscard) {
        setLossWarningOpen(true);
        return;
      }
      closeWithoutSaving();
      return;
    }
    if (!nextOpen) setStatusMessage(null);
    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submit.isPending || form.draftStatus === 'conflict' || form.recoverableDraft) return;
    submit.mutate();
  };

  return (
    <>
      <UnsavedChangesGuard when={open && form.dirtyState.isDirty} />
      <DataLossWarningDialog
        open={lossWarningOpen}
        onOpenChange={setLossWarningOpen}
        onConfirm={closeWithoutSaving}
        onSaveDraft={async () => {
          await form.persistDraft(true);
          setLossWarningOpen(false);
        }}
        savingDraft={form.autosaveStatus === 'saving'}
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent governance className="flex max-h-[min(92vh,920px)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle>{title ?? definition.displayName}</DialogTitle>
            {description || definition.description ? (
              <DialogDescription>{description ?? definition.description}</DialogDescription>
            ) : null}
          </DialogHeader>

          <form
            id={formDomId}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {form.recoverableDraft ? (
                <DraftRecoveryPrompt
                  draft={form.recoverableDraft}
                  onRestore={() => void form.restoreRecoverableDraft()}
                  onDiscard={() => {
                    void form.discardDraftSession();
                  }}
                />
              ) : (
                <div className="grid gap-4">
                  <FormDraftStatusBar
                    draftStatus={form.draftStatus}
                    autosaveStatus={form.autosaveStatus}
                    conflictReason={form.conflictReason}
                    updatedAt={form.draftUpdatedAt}
                    onSaveDraft={() => void form.persistDraft(true)}
                    onDiscardDraft={() => void form.discardDraftSession()}
                    onReloadBaseline={form.draftStatus === 'conflict' ? form.reloadFromBaseline : undefined}
                  />
                  <TrackMindForm form={form} />
                  {form.qualityIssues.length > 0 ? (
                    <DataQualityFeedback issues={form.qualityIssues} />
                  ) : null}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-6 py-4">
              <FormMessage
                message={submit.isError ? (submit.error as Error).message : statusMessage ?? undefined}
                tone={submit.isError ? 'error' : statusMessage ? 'success' : 'muted'}
              />
              <DialogFooter className="mt-3 gap-2 sm:justify-between">
                <div className="text-xs text-[var(--muted-foreground)]">
                  <span className="text-[var(--status-critical)]" aria-hidden="true">*</span> Required fields
                  {definition.draft.enabled ? ' · Draft saves locally until you submit' : null}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {footerExtra}
                  <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  {definition.draft.enabled ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 touch-manipulation"
                      disabled={!form.dirtyState.isDirty || form.autosaveStatus === 'saving'}
                      onClick={() => void form.persistDraft(true)}
                    >
                      Save draft
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    variant="governance"
                    className="min-h-11 touch-manipulation"
                    disabled={!canSubmit || submit.isPending || form.draftStatus === 'conflict' || Boolean(form.recoverableDraft)}
                    aria-describedby={disabledReason ? submitHelpId : undefined}
                  >
                    {submit.isPending ? 'Saving…' : submitLabel}
                  </Button>
                </div>
              </DialogFooter>
              {disabledReason ? (
                <p id={submitHelpId} className="sr-only">{disabledReason}</p>
              ) : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EntityFormAction({
  entityKind,
  label,
  mode = 'create',
  seed,
  title,
  description,
  submitLabel,
  variant = 'governance',
}: {
  entityKind: DataEntryEntityKind;
  label: string;
  mode?: DataEntryFormMode;
  seed?: Record<string, unknown>;
  title?: string;
  description?: string;
  submitLabel?: string;
  variant?: 'governance' | 'outline' | 'default';
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant={variant} className="min-h-9 touch-manipulation" onClick={() => { setMessage(null); setOpen(true); }}>
        {label}
      </Button>
      {message ? (
        <p role="status" aria-live="polite" className="text-xs text-[var(--muted-foreground)]">{message}</p>
      ) : null}
      <TrackMindFormDialog
        entityKind={entityKind}
        mode={mode}
        seed={seed}
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        submitLabel={submitLabel}
        onSubmitted={(result) => setMessage(result.message ?? 'Saved.')}
      />
    </>
  );
}
