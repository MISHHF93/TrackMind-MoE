import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@trackmind/shared';
import { canRoleExportAudit, complianceMutationRoles } from '@trackmind/shared';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import { EntityFormAction } from '@/features/data-entry/TrackMindFormDialog';
import { ComplianceEvidenceEntryConsole } from '@/features/compliance-evidence/ComplianceEvidenceEntryConsole';
import { OperationalNotesConsole } from '@/features/operational-notes/OperationalNotesConsole';
import {
  closeComplianceCorrectiveAction,
  createComplianceCorrectiveAction,
  deleteComplianceCorrectiveAction,
  generateComplianceEvidencePacket,
  updateComplianceCorrectiveAction,
} from '@/api/mutations';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';


function canMutateCompliance(role: Role): boolean {
  return complianceMutationRoles.includes(role);
}

import type { WorkspacePanelProps } from './workspacePanelTypes';

export function AuditPanels({ results, role: roleProp }: WorkspacePanelProps): ReactElement {
  const { session } = useTenantSession();
  const role = roleProp ?? session.role;
  const canExport = canRoleExportAudit(role);
  const notesJournal = feedData<Record<string, unknown>>(results, '/operational-notes/journal');
  const operationalNotes = extractArray<Record<string, unknown>>(notesJournal, 'notes');
  const events = results.flatMap((item) => {
    if (item.status !== 'ready') return [];
    if (Array.isArray(item.data)) return item.data as Record<string, unknown>[];
    return extractArray<Record<string, unknown>>(item.data, 'events');
  });

  const critical = events.filter((e) => e.severity === 'critical').length;

  return (
    <div className="space-y-4">
      <OperationalNotesConsole notes={operationalNotes} defaultSubjectKind="compliance" />
      <KpiStrip
        items={[
          { id: 'events', label: 'Audit events', value: String(events.length) },
          { id: 'critical', label: 'Critical', value: String(critical), status: critical > 0 ? 'critical' : 'nominal' },
        ]}
      />
      {canExport ? (
        <SectionPanel title="Audit export" description="Export governed audit evidence packages when authorized.">
          <Button size="sm" variant="governance" asChild>
            <a href="/audit?focus=export">Open audit export console</a>
          </Button>
        </SectionPanel>
      ) : null}
      <SectionPanel title="Legacy audit note" description="Simple audit note form — prefer unified operational notes above.">
        <EntityFormAction entityKind="audit-note" label="Record audit note" />
      </SectionPanel>
      <SectionPanel title="Forensic event log" description="Immutable audit trail with hash linkage and severity.">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'action', label: 'Action' },
            { key: 'severity', label: 'Severity' },
            { key: 'target', label: 'Target' },
            { key: 'hash', label: 'Hash' },
          ]}
          rows={mapRecords(events, (e) => ({
            time: String(e.timestamp ?? e.occurredAt ?? '—'),
            action: String(e.action ?? e.eventType ?? '—'),
            severity: String(e.severity ?? '—'),
            target: String(e.target ?? e.subjectId ?? '—'),
            hash: String(e.hash ?? e.integrityReference ?? '—').slice(0, 12),
          }), 20)}
        />
      </SectionPanel>
    </div>
  );
}

export function CompliancePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const { session } = useTenantSession();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | undefined>();
  const canMutate = canMutateCompliance(session.role);

  const dashboard = feedData<Record<string, unknown>>(results, '/compliance/dashboard');
  const library = feedData<Record<string, unknown>>(results, '/compliance/control-library');
  const correctiveFeed = feedData<Record<string, unknown>>(results, '/compliance/corrective-actions');

  const readiness = dashboard
    ? {
        score: dashboard.readinessScore,
        totalControls: dashboard.controlsMapped,
        effectiveControls: dashboard.controlsEffective,
        evidenceCoverage: dashboard.evidenceCoverage,
        openFindings: dashboard.openFindings,
        overdueActions: dashboard.overdueActions,
      }
    : library && typeof library.readiness === 'object'
      ? (library.readiness as Record<string, unknown>)
      : undefined;

  const controls = extractArray<Record<string, unknown>>(library, 'controls');
  const findings = extractArray<Record<string, unknown>>(library, 'findings');
  const evidencePackages = extractArray<Record<string, unknown>>(library, 'evidencePackages');
  const evidenceRecords = extractArray<Record<string, unknown>>(library, 'evidenceRecords');
  const notesJournal = feedData<Record<string, unknown>>(results, '/operational-notes/journal');
  const operationalNotes = extractArray<Record<string, unknown>>(notesJournal, 'notes');
  const kpiPack = extractArray<Record<string, unknown>>(dashboard, 'kpiPack');
  const regulatoryWorkflows = extractArray<Record<string, unknown>>(dashboard, 'regulatoryWorkflows');
  const correctiveActions = extractArray<Record<string, unknown>>(correctiveFeed, 'correctiveActions');
  const libraryActions = extractArray<Record<string, unknown>>(library, 'correctiveActions');
  const actions = correctiveActions.length > 0 ? correctiveActions : libraryActions;

  const [selectedControlId, setSelectedControlId] = useState<string | undefined>();

  const evidencePackageCount = typeof dashboard?.evidencePackages === 'number'
    ? dashboard.evidencePackages
    : evidencePackages.length;

  const seedFinding = findings.find((finding) => finding.status !== 'closed') ?? findings[0];
  const seedAction = actions.find((action) => action.status !== 'closed') ?? actions[0];

  const invalidateWorkspace = () => void queryClient.invalidateQueries({ queryKey: ['workspace'] });
  const onMutationMessage = (response: unknown, fallback: string) => {
    if (typeof response === 'object' && response && 'message' in response) {
      setActionMessage(String((response as { message?: string }).message));
    } else {
      setActionMessage(fallback);
    }
    invalidateWorkspace();
  };

  const createAction = useMutation({
    mutationFn: () =>
      createComplianceCorrectiveAction({
        findingId: String(seedFinding?.id ?? ''),
        ownerId: 'owner-compliance',
        action: `Remediate ${String(seedFinding?.summary ?? seedFinding?.title ?? 'open finding')}`,
        dueAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        startWorkflow: true,
        approvalRequestId: pendingApprovalId,
        actor: session.role,
      }),
    onSuccess: (response) => onMutationMessage(response, 'Corrective action registered.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const updateAction = useMutation({
    mutationFn: () =>
      updateComplianceCorrectiveAction(String(seedAction?.id ?? ''), {
        status: seedAction?.status === 'in-progress' ? 'open' : 'in-progress',
        actor: session.role,
        approvalRequestId: seedAction?.approvalRequestId ? String(seedAction.approvalRequestId) : pendingApprovalId,
      }),
    onSuccess: (response) => onMutationMessage(response, 'Corrective action updated.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const closeAction = useMutation({
    mutationFn: () =>
      closeComplianceCorrectiveAction(String(seedAction?.id ?? ''), {
        actor: session.role,
        approvalRequestId: seedAction?.approvalRequestId ? String(seedAction.approvalRequestId) : pendingApprovalId,
      }),
    onSuccess: (response) => onMutationMessage(response, 'Corrective action closed.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const removeAction = useMutation({
    mutationFn: () =>
      deleteComplianceCorrectiveAction(String(seedAction?.id ?? ''), { actor: session.role }),
    onSuccess: (response) => onMutationMessage(response, 'Corrective action removed.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const generateEvidencePacket = useMutation({
    mutationFn: () => generateComplianceEvidencePacket(),
    onSuccess: (response) => onMutationMessage(response, 'Evidence packet generation requested.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  return (
    <div className="space-y-4">
      <ComplianceEvidenceEntryConsole
        controls={controls}
        evidenceRecords={evidenceRecords}
        evidencePackages={evidencePackages}
        selectedControlId={selectedControlId ?? String(controls[0]?.id ?? controls[0]?.controlId ?? '')}
        onSelectControl={setSelectedControlId}
      />
      <OperationalNotesConsole notes={operationalNotes} defaultSubjectKind="compliance" />
      <KpiStrip
        items={[
          { id: 'score', label: 'Readiness score', value: readiness?.score != null ? String(readiness.score) : '—' },
          { id: 'controls', label: 'Controls mapped', value: readiness?.totalControls != null ? String(readiness.totalControls) : String(controls.length) },
          { id: 'findings', label: 'Open findings', value: readiness?.openFindings != null ? String(readiness.openFindings) : String(findings.length), status: (readiness?.openFindings ?? findings.length) ? 'warning' : 'nominal' },
          { id: 'actions', label: 'Overdue actions', value: readiness?.overdueActions != null ? String(readiness.overdueActions) : String(actions.length), status: (readiness?.overdueActions ?? 0) ? 'warning' : 'nominal' },
          { id: 'evidence', label: 'Evidence packages', value: String(evidencePackageCount) },
        ]}
      />
      <SectionPanel title="Evidence operations" description="Generate governed compliance evidence packages for audit readiness.">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="governance"
            disabled={!canMutate || generateEvidencePacket.isPending}
            title={canMutate ? 'POST /compliance/evidence-packets/generate' : 'Requires compliance-officer or admin role'}
            onClick={() => {
              setActionMessage(null);
              generateEvidencePacket.mutate();
            }}
          >
            Generate evidence packet
          </Button>
          {actionMessage ? <p className="text-xs text-[var(--muted-foreground)]">{actionMessage}</p> : null}
        </div>
      </SectionPanel>
      <SectionPanel title="Additional entry" description="Open the structured evidence form directly from the data-entry framework.">
        <EntityFormAction entityKind="compliance-evidence" label="Open evidence form" />
      </SectionPanel>
      {kpiPack.length > 0 ? (
        <SectionPanel title="Compliance KPI pack" description="Dashboard KPIs from /compliance/dashboard.">
          <RecordTable
            columns={[
              { key: 'label', label: 'KPI' },
              { key: 'value', label: 'Value' },
              { key: 'target', label: 'Target' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(kpiPack, (kpi) => ({
              label: String(kpi.label ?? kpi.kpiId ?? '—'),
              value: kpi.unit ? `${kpi.value ?? '—'} ${kpi.unit}` : String(kpi.value ?? '—'),
              target: kpi.target != null ? String(kpi.target) : '—',
              status: String(kpi.status ?? '—'),
            }))}
          />
        </SectionPanel>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Control library">
          <RecordTable
            columns={[
              { key: 'id', label: 'Control' },
              { key: 'framework', label: 'Framework' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(controls, (c) => ({
              id: String(c.id ?? c.controlId ?? '—'),
              framework: String(Array.isArray(c.frameworkIds) ? c.frameworkIds.join(', ') : c.framework ?? '—'),
              status: String(c.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Findings register">
          <RecordTable
            columns={[
              { key: 'title', label: 'Finding' },
              { key: 'severity', label: 'Severity' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(findings, (f) => ({
              title: String(f.summary ?? f.title ?? f.id ?? '—'),
              severity: String(f.severity ?? '—'),
              status: String(f.status ?? '—'),
            }))}
            emptyLabel="No open findings."
          />
        </SectionPanel>
      </div>
      <SectionPanel
        title="Corrective actions"
        description="Active corrective actions from /compliance/corrective-actions. Create, update, and delete remain approval-gated."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="governance"
            disabled={!canMutate || !seedFinding}
            title={canMutate ? 'Request approval before registering a corrective action' : 'Requires compliance-officer or admin role'}
            onClick={() => {
              setActionMessage(null);
              setCreateDialogOpen(true);
            }}
          >
            Request corrective action approval
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canMutate || !seedFinding || createAction.isPending}
            title={canMutate ? 'POST /compliance/corrective-actions after approval is recorded' : 'Requires compliance-officer or admin role'}
            onClick={() => {
              setActionMessage(null);
              createAction.mutate();
            }}
          >
            Register corrective action
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canMutate || !seedAction || updateAction.isPending}
            title={canMutate ? 'POST /compliance/corrective-actions/{id}/updates' : 'Requires compliance-officer or admin role'}
            onClick={() => {
              setActionMessage(null);
              updateAction.mutate();
            }}
          >
            Update selected action
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canMutate || !seedAction || seedAction.status === 'done' || closeAction.isPending}
            title={canMutate ? 'POST /compliance/corrective-actions/{id}/close' : 'Requires compliance-officer or admin role'}
            onClick={() => {
              setActionMessage(null);
              closeAction.mutate();
            }}
          >
            Close selected action
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canMutate || !seedAction || removeAction.isPending}
            title={canMutate ? 'POST /compliance/corrective-actions/{id}/delete' : 'Requires compliance-officer or admin role'}
            onClick={() => {
              setActionMessage(null);
              removeAction.mutate();
            }}
          >
            Delete selected action
          </Button>
          {actionMessage ? <p className="text-xs text-[var(--muted-foreground)]">{actionMessage}</p> : null}
        </div>
        <RecordTable
          columns={[
            { key: 'action', label: 'Action' },
            { key: 'finding', label: 'Finding' },
            { key: 'owner', label: 'Owner' },
            { key: 'due', label: 'Due' },
            { key: 'status', label: 'Status' },
            { key: 'approval', label: 'Approval' },
          ]}
          rows={mapRecords(actions, (a) => ({
            action: String(a.action ?? a.id ?? '—'),
            finding: String(a.findingId ?? '—'),
            owner: String(a.ownerId ?? '—'),
            due: a.dueAt ? new Date(String(a.dueAt)).toLocaleDateString() : '—',
            status: String(a.status ?? '—'),
            approval: a.approvalRequestId ? String(a.approvalRequestId) : 'required for mutations',
          }))}
          emptyLabel="No corrective actions on register."
        />
      </SectionPanel>
      <GovernedActionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Request corrective action approval"
        description="Create an approval-gated request before registering a corrective action against the findings register."
        protectedAction="compliance-corrective-action"
        target={String(seedFinding?.id ?? 'finding-register')}
        onSubmitted={(approvalId) => {
          setPendingApprovalId(approvalId);
          setActionMessage(approvalId
            ? `Approval ${approvalId} recorded. Register the corrective action when ready.`
            : 'Approval request submitted. Register the corrective action when authorized.');
        }}
      />
      <SectionPanel
        title="Evidence packets"
        description="Mapped evidence packages for internal review. POST /compliance/evidence-packets/generate is display-only until an approval token flow is wired."
      >
        <RecordTable
          columns={[
            { key: 'title', label: 'Packet' },
            { key: 'controls', label: 'Controls' },
            { key: 'sealed', label: 'Sealed' },
            { key: 'readiness', label: 'Readiness' },
          ]}
          rows={mapRecords(evidencePackages, (pkg) => ({
            title: String(pkg.title ?? pkg.id ?? '—'),
            controls: String(extractArray(pkg, 'controlIds').length || '—'),
            sealed: pkg.sealed === true ? 'yes' : 'no',
            readiness: String(
              pkg.readiness
              ?? (pkg.accreditationReadiness && typeof pkg.accreditationReadiness === 'object'
                ? (pkg.accreditationReadiness as Record<string, unknown>).status
                : '—'),
            ),
          }))}
          emptyLabel="No evidence packets mapped. Generation requires compliance-officer approval."
        />
      </SectionPanel>
      {regulatoryWorkflows.length > 0 ? (
        <SectionPanel title="Regulatory workflows" description="Workflow triggers tracked on the compliance dashboard.">
          <RecordTable
            columns={[
              { key: 'name', label: 'Workflow' },
              { key: 'domain', label: 'Domain' },
              { key: 'triggers', label: 'Trigger events' },
            ]}
            rows={mapRecords(regulatoryWorkflows, (wf) => ({
              name: String(wf.name ?? wf.id ?? '—'),
              domain: String(wf.domain ?? '—'),
              triggers: extractArray<string>(wf, 'triggerEvents').join(', ') || '—',
            }))}
          />
        </SectionPanel>
      ) : null}
    </div>
  );
}
