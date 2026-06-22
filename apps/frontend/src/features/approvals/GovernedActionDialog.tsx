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
import { useState } from 'react';
import { Button } from '@/design/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/design/components/dialog';
import type { WorkspaceAction } from '@/design/components/workspace';

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
  const [justification, setJustification] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { controlled } = useApprovalMutations();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSuccessMessage(null);
          controlled.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent governance>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-sm">
          <span>Justification</span>
          <textarea
            className="min-h-[96px] rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Document why this approval is required…"
          />
        </label>
        {controlled.isError ? (
          <p className="text-sm text-[var(--status-critical)]">{(controlled.error as Error).message}</p>
        ) : null}
        {successMessage ? (
          <p className="text-sm text-[var(--status-nominal)]">{successMessage}</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="governance"
            disabled={!justification.trim() || controlled.isPending}
            onClick={async () => {
              try {
                const response = await controlled.mutateAsync({
                  input: { action: protectedAction, target, reason: justification },
                  approvalApi,
                });
                const approvalId = response.approvalId;
                setSuccessMessage(
                  approvalId
                    ? `Approval request ${approvalId} submitted. Execution remains locked until authorized.`
                    : 'Approval request submitted. Execution remains locked until authorized.',
                );
                setJustification('');
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
