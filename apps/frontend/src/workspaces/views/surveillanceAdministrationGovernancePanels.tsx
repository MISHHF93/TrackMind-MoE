import type {
  SurveillanceAdministrationAuditRecordDto,
  SurveillanceAdministrationApprovalRequestDto,
  SurveillanceAdministrationGovernanceWorkspaceDto,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { Badge } from '@/design/components/badge';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';

function actionKindLabel(kind: string): string {
  return kind.replace(/-/g, ' ');
}

export function SurveillanceAdministrationGovernancePanel({
  governance,
}: {
  governance: SurveillanceAdministrationGovernanceWorkspaceDto | undefined;
}): ReactElement {
  if (!governance) {
    return (
      <SectionPanel
        title="CCTV & IoT administration governance"
        description="Audit trail and approval queue for high-risk surveillance administrative changes."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Administration governance feed unavailable — reload the workspace.
        </p>
      </SectionPanel>
    );
  }

  const summary = governance.summary;

  return (
    <div className="space-y-4">
      <SectionPanel
        title="CCTV & IoT administration governance"
        description="Audit trail for device creation, reassignment, zone remapping, retention and alert policy changes, health overrides, maintenance, evidence linking, and privileged configuration access. High-risk changes require approver review before application."
      >
        <KpiStrip
          items={[
            { id: 'audited', label: 'Audited actions', value: String(summary.auditedActionCount) },
            {
              id: 'pending',
              label: 'Pending approvals',
              value: String(summary.pendingApprovalCount),
              status: summary.pendingApprovalCount > 0 ? 'warning' : 'nominal',
            },
            {
              id: 'high-risk',
              label: 'High-risk (24h)',
              value: String(summary.highRiskActionCount24h),
              status: summary.highRiskActionCount24h > 0 ? 'warning' : 'nominal',
            },
          ]}
        />
      </SectionPanel>

      <SectionPanel
        title="Pending approvals"
        description="Retention changes, sensitive zone remapping, and surveillance policy modifications awaiting security or compliance approval."
      >
        <ApprovalQueueTable approvals={governance.pendingApprovals} />
      </SectionPanel>

      <SectionPanel
        title="Administration audit trail"
        description="Enriched audit records with action kind, risk tier, and approval status for significant CCTV and IoT administrative actions."
      >
        <AuditTrailTable records={governance.auditTrail.slice(0, 25)} />
      </SectionPanel>

      <SectionPanel
        title="Approval policies"
        description="Which administration actions require human approval before changes are applied."
      >
        <RecordTable
          columns={[
            { key: 'action', label: 'Action' },
            { key: 'risk', label: 'Risk tier' },
            { key: 'approval', label: 'Approval' },
            { key: 'approvers', label: 'Approver roles' },
          ]}
          rows={governance.approvalPolicies.map((policy) => ({
            action: actionKindLabel(policy.actionKind),
            risk: policy.riskTier,
            approval: policy.requiresApproval ? 'Required' : 'Audit only',
            approvers: policy.approverRoles.join(', '),
          }))}
          emptyLabel="No approval policies configured."
        />
      </SectionPanel>
    </div>
  );
}

function ApprovalQueueTable({ approvals }: { approvals: SurveillanceAdministrationApprovalRequestDto[] }): ReactElement {
  return (
    <RecordTable
      columns={[
        { key: 'request', label: 'Request' },
        { key: 'action', label: 'Action' },
        { key: 'target', label: 'Target' },
        { key: 'requested', label: 'Requested by' },
        { key: 'expires', label: 'Expires' },
      ]}
      rows={approvals.map((approval) => ({
        request: approval.approvalRequestId,
        action: actionKindLabel(approval.actionKind),
        target: approval.targetId,
        requested: approval.requestedBy,
        expires: approval.expiresAt,
      }))}
      emptyLabel="No pending administration approvals."
    />
  );
}

function AuditTrailTable({ records }: { records: SurveillanceAdministrationAuditRecordDto[] }): ReactElement {
  return (
    <RecordTable
      columns={[
        { key: 'time', label: 'Time' },
        { key: 'action', label: 'Action' },
        { key: 'subject', label: 'Subject' },
        { key: 'actor', label: 'Actor' },
        { key: 'risk', label: 'Risk' },
        { key: 'approval', label: 'Approval' },
      ]}
      rows={records.map((record) => ({
        time: record.timestamp,
        action: actionKindLabel(record.actionKind),
        subject: record.subjectId,
        actor: record.actorId,
        risk: record.riskTier,
        approval: record.approvalStatus,
      }))}
      emptyLabel="No administration audit records yet."
    />
  );
}

export function SurveillanceAdministrationGovernancePanels({
  results,
  sectionId,
}: WorkspacePanelProps & { sectionId?: string }): ReactElement {
  const governanceFeed = feedData<SurveillanceAdministrationGovernanceWorkspaceDto>(
    results,
    '/surveillance-iot/administration/governance/workspace',
  );
  const legacyGovernanceFeed = feedData<Record<string, unknown>>(
    results,
    '/surveillance-iot/governance/workspace',
  );
  const embedded = legacyGovernanceFeed?.administrationGovernance as SurveillanceAdministrationGovernanceWorkspaceDto | undefined;

  return (
    <div id={sectionId}>
      <SurveillanceAdministrationGovernancePanel governance={governanceFeed ?? embedded} />
    </div>
  );
}

export function SurveillanceAdministrationGovernanceSummaryStrip({
  governance,
}: {
  governance: SurveillanceAdministrationGovernanceWorkspaceDto | undefined;
}): ReactElement | null {
  if (!governance) return null;
  const pending = governance.summary.pendingApprovalCount;
  if (pending === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-sm">
      <Badge variant="warning">{pending} pending approval{pending === 1 ? '' : 's'}</Badge>
      <span className="text-[var(--muted-foreground)]">
        High-risk CCTV/IoT administration changes require approver review.
      </span>
    </div>
  );
}
