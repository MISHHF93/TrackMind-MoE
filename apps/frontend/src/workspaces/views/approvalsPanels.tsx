import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { ApprovalDecisionButtons } from '@/features/approvals/GovernedActionDialog';
import { ApprovalRequestComposer } from '@/features/approval-composer/ApprovalRequestComposer';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { simulateApprovalEscalation } from '@/api/mutations';

export function ApprovalsWorkspacePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const approvals = results.flatMap((item) => {
    if (item.status !== 'ready') return [];
    if (Array.isArray(item.data)) return item.data as Record<string, unknown>[];
    return extractArray<Record<string, unknown>>(item.data, 'items');
  });

  const escalationMutation = useMutation({
    mutationFn: () => simulateApprovalEscalation(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });

  return (
    <div className="space-y-4">
      <SectionPanel title="Approval operations" description="Compose requests, run escalation review, and decide pending items.">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="governance"
            disabled={escalationMutation.isPending}
            onClick={() => escalationMutation.mutate()}
          >
            Run escalation review
          </Button>
          {escalationMutation.isSuccess ? (
            <p className="text-xs text-[var(--muted-foreground)]">Escalation cycle simulated.</p>
          ) : null}
          {escalationMutation.isError ? (
            <p className="text-xs text-[var(--status-critical)]">{(escalationMutation.error as Error).message}</p>
          ) : null}
        </div>
      </SectionPanel>
      <ApprovalRequestComposer approvals={approvals} />

      {approvals.length === 0 ? null : (
        <>
          <SectionPanel title="Approval queue" description="Human decisions with SLA, evidence, and workflow steps.">
            <div className="space-y-3">
              {approvals.slice(0, 12).map((approval) => {
                const id = String(approval.id ?? approval.approvalRequestId ?? '');
                const status = String(approval.status ?? approval.state ?? 'pending');
                const steps = extractArray<Record<string, unknown>>(approval, 'approvalSteps');
                const evidence = Array.isArray(approval.evidence) ? approval.evidence : [];
                return (
                  <div key={id} className="rounded-md border border-[var(--border)] p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{String(approval.requestTitle ?? approval.action ?? approval.actionType ?? approval.title ?? 'Approval')}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {status} · {String(approval.target ?? '')}
                          {approval.queue ? ` · ${String(approval.queue)}` : ''}
                          {approval.priority ? ` · priority ${String(approval.priority)}` : ''}
                        </p>
                        {approval.expiresAt ? (
                          <p className="text-xs text-[var(--muted-foreground)]">Expires {new Date(String(approval.expiresAt)).toLocaleString()}</p>
                        ) : null}
                      </div>
                      {status.toLowerCase().includes('pending') && id ? <ApprovalDecisionButtons approvalId={id} /> : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>{steps.length} approval step{steps.length === 1 ? '' : 's'}</span>
                      {evidence.length > 0 ? <span>Evidence: {evidence.slice(0, 4).join(', ')}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionPanel>
          <SectionPanel title="Approval register">
            <RecordTable
              columns={[
                { key: 'action', label: 'Action' },
                { key: 'target', label: 'Target' },
                { key: 'status', label: 'Status' },
                { key: 'requested', label: 'Requested' },
              ]}
              rows={mapRecords(approvals, (a) => ({
                action: String(a.requestTitle ?? a.action ?? a.actionType ?? '—'),
                target: String(a.target ?? '—'),
                status: String(a.status ?? a.state ?? '—'),
                requested: String(a.requestedBy ?? a.createdAt ?? '—'),
              }))}
            />
          </SectionPanel>
        </>
      )}
    </div>
  );
}
