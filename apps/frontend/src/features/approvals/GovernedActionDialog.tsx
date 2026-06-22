import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveRequest,
  createControlledAction,
  rejectRequest,
  requestStartingGateRaceStartApproval,
  requestTrackConfigDraft,
} from '@/api/mutations';
import type { ControlledActionInput } from '@/api/approvalPayload';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/design/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/design/components/dialog';
import { FormMessage } from '@/design/components/form-field';
import type { WorkspaceAction } from '@/design/components/workspace';
import { TrackMindForm } from '@/features/data-entry/TrackMindForm';
import { UnsavedChangesGuard } from '@/features/data-entry/UnsavedChangesGuard';
import { useTrackMindForm } from '@/features/data-entry/useTrackMindForm';

async function submitApprovalRequest(
  input: ControlledActionInput,
  approvalApi: WorkspaceAction['approvalApi'],
): Promise<{ approvalId?: string; message?: string }> {
  if (approvalApi === 'track-configuration/draft-requests') {
    return requestTrackConfigDraft(input);
  }
  if (approvalApi === 'starting-gate-operations/race-start-approval') {
    const response = await requestStartingGateRaceStartApproval(input.target, {
      reason: input.reason,
      evidence: input.evidence,
    });
    return { approvalId: response.approvalRequestId, message: response.message };
  }
  return createControlledAction(input);
}

export function useApprovalMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['workspace'] });

  const controlled = useMutation({
    mutationFn: ({
      input,
      approvalApi,
    }: {
      input: ControlledActionInput;
      approvalApi?: WorkspaceAction['approvalApi'];
    }) => submitApprovalRequest(input, approvalApi),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => approveRequest(id, reason),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectRequest(id, reason),
    onSuccess: invalidate,
  });

  return { controlled, approve, reject };
}

export function GovernedActionDialog({
  open,
  onOpenChange,
  title,
  description,
  protectedAction,
  target,
  approvalApi,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  protectedAction: string;
  target: string;
  approvalApi?: WorkspaceAction['approvalApi'];
  onSubmitted?: (approvalId?: string) => void;
}): ReactElement {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { controlled } = useApprovalMutations();
  const form = useTrackMindForm({
    entityKind: 'approval',
    seed: { protectedAction, target },
  });

  useEffect(() => {
    form.setFieldValue('protectedAction', protectedAction);
    form.setFieldValue('target', target);
  }, [protectedAction, target, form.setFieldValue]);

  return (
    <>
      <UnsavedChangesGuard when={open && form.dirtyState.isDirty} />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setSuccessMessage(null);
            controlled.reset();
            form.resetForm({ protectedAction, target });
          }
          onOpenChange(next);
        }}
      >
        <DialogContent governance>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <TrackMindForm form={form} className="grid gap-3 text-sm" />
          <FormMessage message={controlled.isError ? (controlled.error as Error).message : successMessage ?? undefined} tone={controlled.isError ? 'error' : 'muted'} />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="governance"
              disabled={!String(form.values.reason ?? '').trim() || controlled.isPending}
              onClick={async () => {
                const validation = form.validate();
                if (!validation.valid) return;
                try {
                  const evidenceText = validation.normalizedValues.evidence;
                  const evidence = typeof evidenceText === 'string' && evidenceText.trim()
                    ? evidenceText.split('\n').map((line) => line.trim()).filter(Boolean)
                    : undefined;
                  const response = await controlled.mutateAsync({
                    input: {
                      action: protectedAction,
                      target,
                      reason: String(validation.normalizedValues.reason ?? ''),
                      evidence,
                    },
                    approvalApi,
                  });
                  const approvalId = response.approvalId;
                  setSuccessMessage(
                    approvalId
                      ? `Approval request ${approvalId} submitted. Execution remains locked until authorized.`
                      : 'Approval request submitted. Execution remains locked until authorized.',
                  );
                  form.resetForm({ protectedAction, target });
                  onSubmitted?.(approvalId);
                  setTimeout(() => onOpenChange(false), 1200);
                } catch {
                  // Error surfaced via controlled.isError
                }
              }}
            >
              Request approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ApprovalDecisionButtons({ approvalId }: { approvalId: string }): ReactElement {
  const { approve, reject } = useApprovalMutations();
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: approvalId })}>Approve</Button>
        <Button size="sm" variant="governance" disabled={reject.isPending} onClick={() => reject.mutate({ id: approvalId })}>Reject</Button>
      </div>
      {approve.isError ? <p className="text-xs text-[var(--status-critical)]">{(approve.error as Error).message}</p> : null}
      {reject.isError ? <p className="text-xs text-[var(--status-critical)]">{(reject.error as Error).message}</p> : null}
    </div>
  );
}

export function GovernedActionProvider({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>;
}
