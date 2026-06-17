import type { ReactElement } from 'react';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { ApprovalDecisionButtons } from '@/features/approvals/GovernedActionDialog';
import { EmptyState } from '@/design/components/states';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';

export function ApprovalsWorkspacePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const approvals = results.flatMap((item) => {
    if (item.status !== 'ready') return [];
    if (Array.isArray(item.data)) return item.data as Record<string, unknown>[];
    return extractArray<Record<string, unknown>>(item.data, 'items');
  });

  if (approvals.length === 0) {
    return <EmptyState title="No approval requests" description="Create a governed action from the action dock to open a draft." />;
  }

  return (
    <div className="space-y-4">
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
                    <p className="font-medium text-sm">{String(approval.action ?? approval.actionType ?? approval.title ?? 'Approval')}</p>
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
            action: String(a.action ?? a.actionType ?? '—'),
            target: String(a.target ?? '—'),
            status: String(a.status ?? a.state ?? '—'),
            requested: String(a.requestedBy ?? a.createdAt ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}
