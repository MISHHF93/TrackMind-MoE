import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createFacilitiesMaintenanceSchedule, reportFacilitiesIncident } from '@/api/mutations';
import { assertMutationOk } from '@/api/approvalPayload';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason, roleCanUseAction } from '@/domain/approvalControls';
import { Button } from '@/design/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/design/components/dialog';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';
import { FacilitiesGeospatialMap } from './FacilitiesGeospatialMap';

function defaultAssetId(assets: Record<string, unknown>[], selectedAssetId?: string): string {
  if (selectedAssetId) return selectedAssetId;
  const first = assets[0];
  return first ? String(first.assetId ?? '') : 'GRANDSTAND_HVAC_01';
}

export function FacilitiesPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const { session } = useTenantSession();
  const data = feedData<Record<string, unknown>>(results, '/facilities-maintenance/workspace');
  const readiness = data && typeof data.readiness === 'object' ? data.readiness as Record<string, unknown> : undefined;
  const assets = extractArray<Record<string, unknown>>(data, 'assets');
  const workOrders = extractArray<Record<string, unknown>>(data, 'workOrders');
  const inspections = extractArray<Record<string, unknown>>(data, 'inspections');
  const inventory = extractArray<Record<string, unknown>>(data, 'inventory');
  const incidents = extractArray<Record<string, unknown>>(data, 'incidents');
  const utilities = data && typeof data.utilities === 'object' ? data.utilities as Record<string, unknown> : undefined;
  const map = data && typeof data.map === 'object' ? data.map as Record<string, unknown> : undefined;

  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [incidentMessage, setIncidentMessage] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    assetId: '',
    title: 'Scheduled facility maintenance',
    priority: 'normal',
    scheduledFor: '',
    dueAt: '',
  });
  const [incidentForm, setIncidentForm] = useState({
    assetId: '',
    title: '',
    severity: 'medium',
    description: '',
  });

  const selectedAsset = assets.find((asset) => String(asset.assetId) === selectedAssetId);
  const scheduleTargetAssetId = scheduleForm.assetId || defaultAssetId(assets, selectedAssetId);
  const canRequestMaintenanceApproval = roleCanUseAction(
    { id: 'facility-maintenance-execution', protectedAction: 'facility-maintenance-execution', label: '', target: scheduleTargetAssetId, requiredRoles: ['admin', 'track-superintendent'] },
    session.role,
  );

  const scheduleMaintenance = useMutation({
    mutationFn: () =>
      createFacilitiesMaintenanceSchedule({
        assetId: scheduleTargetAssetId,
        title: scheduleForm.title.trim() || 'Scheduled facility maintenance',
        priority: scheduleForm.priority,
        scheduledFor: scheduleForm.scheduledFor || new Date().toISOString(),
        dueAt: scheduleForm.dueAt || new Date(Date.now() + 86_400_000).toISOString(),
        tasks: ['verify lockout', 'perform maintenance', 'capture evidence'],
        evidence: ['facilities-console'],
        operationalImpact: 'operational-impact',
        requestedBy: `${session.role}-operator`,
      }).then(assertMutationOk),
    onSuccess: (response) => {
      const body = response as Record<string, unknown>;
      const approvalRequired = Boolean(body.approvalRequired);
      const approvalRequestId = body.approvalRequestId ? String(body.approvalRequestId) : undefined;
      setScheduleMessage(
        approvalRequired
          ? `Maintenance schedule submitted for approval${approvalRequestId ? ` (${approvalRequestId})` : ''}. Execution remains locked until authorized.`
          : 'Maintenance schedule confirmed.',
      );
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setScheduleDialogOpen(false);
    },
    onError: (error: Error) => setScheduleMessage(error.message),
  });

  const reportIncident = useMutation({
    mutationFn: () =>
      reportFacilitiesIncident({
        assetId: incidentForm.assetId || selectedAssetId || undefined,
        title: incidentForm.title.trim() || 'Facility incident reported',
        severity: incidentForm.severity,
        description: incidentForm.description.trim() || 'Facility incident recorded for triage.',
        evidence: ['facilities-console'],
        reportedBy: `${session.role}-operator`,
      }).then(assertMutationOk),
    onSuccess: () => {
      setIncidentMessage('Facility incident reported and linked to audit trail.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIncidentDialogOpen(false);
      setIncidentForm({ assetId: '', title: '', severity: 'medium', description: '' });
    },
    onError: (error: Error) => setIncidentMessage(error.message),
  });

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'score', label: 'Readiness', value: readiness?.score != null ? String(readiness.score) : '—' },
          { id: 'assets', label: 'Assets', value: String(assets.length) },
          { id: 'inventory', label: 'Inventory', value: String(inventory.length) },
          { id: 'orders', label: 'Work orders', value: String(workOrders.length) },
          { id: 'utilities', label: 'Utilities coverage', value: utilities?.coveragePct != null ? `${utilities.coveragePct}%` : '—' },
          { id: 'incidents', label: 'Incidents', value: String(incidents.length) },
        ]}
      />
      <FacilitiesGeospatialMap
        map={map}
        selectedAssetId={selectedAssetId}
        onAssetSelect={setSelectedAssetId}
      />
      {selectedAsset ? (
        <SectionPanel title="Asset detail" description="Selected from geospatial map click-through.">
          <RecordTable
            columns={[
              { key: 'field', label: 'Field' },
              { key: 'value', label: 'Value' },
            ]}
            rows={[
              { field: 'Asset', value: String(selectedAsset.name ?? selectedAsset.assetId ?? '—') },
              { field: 'Asset ID', value: String(selectedAsset.assetId ?? '—') },
              { field: 'Type', value: String(selectedAsset.assetType ?? '—') },
              { field: 'Health', value: selectedAsset.healthScore != null ? String(selectedAsset.healthScore) : '—' },
              { field: 'Risk', value: String(selectedAsset.predictedFailureRisk ?? selectedAsset.riskLevel ?? '—') },
              { field: 'Maintenance', value: String(selectedAsset.maintenanceStatus ?? '—') },
              { field: 'Readiness', value: String(selectedAsset.readinessStatus ?? '—') },
              { field: 'Twin', value: String(selectedAsset.twinId ?? '—') },
            ]}
          />
        </SectionPanel>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Maintenance scheduling" description="Approval-gated maintenance schedule requests; operational impact requires human authorization.">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="governance"
              onClick={() => {
                setScheduleMessage(null);
                setScheduleForm((current) => ({
                  ...current,
                  assetId: defaultAssetId(assets, selectedAssetId),
                }));
                setScheduleDialogOpen(true);
              }}
            >
              Schedule maintenance
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canRequestMaintenanceApproval}
              title={canRequestMaintenanceApproval ? 'Request approval before schedule execution' : actionDisabledReason({ id: 'facility-maintenance-execution', protectedAction: 'facility-maintenance-execution', label: '', target: scheduleTargetAssetId, requiredRoles: ['admin', 'track-superintendent'] }, session.role)}
              onClick={() => setApprovalDialogOpen(true)}
            >
              Request maintenance approval
            </Button>
            {scheduleMessage ? <p className="text-xs text-[var(--muted-foreground)]">{scheduleMessage}</p> : null}
          </div>
        </SectionPanel>
        <SectionPanel title="Facility incidents" description="Report facility incidents with audit and event linkage.">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="governance"
              onClick={() => {
                setIncidentMessage(null);
                setIncidentForm((current) => ({
                  ...current,
                  assetId: selectedAssetId ?? '',
                }));
                setIncidentDialogOpen(true);
              }}
            >
              Report incident
            </Button>
            {incidentMessage ? <p className="text-xs text-[var(--muted-foreground)]">{incidentMessage}</p> : null}
          </div>
          <RecordTable
            columns={[
              { key: 'title', label: 'Incident' },
              { key: 'severity', label: 'Severity' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(incidents, (incident) => ({
              title: String(incident.title ?? '—'),
              severity: String(incident.severity ?? '—'),
              status: String(incident.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Utilities adapters">
          <RecordTable
            columns={[
              { key: 'adapter', label: 'Adapter' },
              { key: 'kind', label: 'Kind' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(extractArray<Record<string, unknown>>(utilities, 'adapters'), (adapter) => ({
              adapter: String(adapter.adapterId ?? '—'),
              kind: String(adapter.kind ?? '—'),
              status: String(adapter.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Inventory">
          <RecordTable
            columns={[
              { key: 'asset', label: 'Asset' },
              { key: 'location', label: 'Location' },
              { key: 'maintenance', label: 'Maintenance' },
            ]}
            rows={mapRecords(inventory, (item) => ({
              asset: String(item.assetId ?? item.name ?? '—'),
              location: String(item.locationLabel ?? '—'),
              maintenance: String(item.maintenanceStatus ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Asset health">
        <RecordTable
          columns={[
            { key: 'asset', label: 'Asset' },
            { key: 'health', label: 'Health' },
            { key: 'risk', label: 'Risk' },
            { key: 'maintenance', label: 'Maintenance' },
          ]}
          rows={mapRecords(assets, (a) => ({
            asset: String(a.assetId ?? a.name ?? '—'),
            health: a.healthScore != null ? String(a.healthScore) : '—',
            risk: String(a.predictedFailureRisk ?? a.riskLevel ?? '—'),
            maintenance: String(a.maintenanceStatus ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Work orders">
          <RecordTable
            columns={[
              { key: 'id', label: 'Order' },
              { key: 'priority', label: 'Priority' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(workOrders, (w) => ({
              id: String(w.id ?? w.workOrderId ?? '—'),
              priority: String(w.priority ?? '—'),
              status: String(w.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Inspections">
          <RecordTable
            columns={[
              { key: 'asset', label: 'Asset' },
              { key: 'due', label: 'Due' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(inspections, (i) => ({
              asset: String(i.assetId ?? '—'),
              due: String(i.nextInspectionDueAt ?? i.dueAt ?? '—'),
              status: String(i.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent governance>
          <DialogHeader>
            <DialogTitle>Schedule maintenance</DialogTitle>
            <DialogDescription>
              Submit an approval-gated maintenance schedule for {scheduleTargetAssetId}. Execution remains locked until authorized.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1">
              <span>Asset</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                value={scheduleTargetAssetId}
                onChange={(event) => setScheduleForm((current) => ({ ...current, assetId: event.target.value }))}
              >
                {assets.map((asset) => (
                  <option key={String(asset.assetId)} value={String(asset.assetId)}>
                    {String(asset.name ?? asset.assetId)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span>Title</span>
              <input
                className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                value={scheduleForm.title}
                onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="grid gap-1">
              <span>Priority</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                value={scheduleForm.priority}
                onChange={(event) => setScheduleForm((current) => ({ ...current, priority: event.target.value }))}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>
          {scheduleMaintenance.isError ? (
            <p className="text-sm text-[var(--status-critical)]">{(scheduleMaintenance.error as Error).message}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button
              variant="governance"
              disabled={scheduleMaintenance.isPending}
              onClick={() => scheduleMaintenance.mutate()}
            >
              Submit schedule request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
        <DialogContent governance>
          <DialogHeader>
            <DialogTitle>Report facility incident</DialogTitle>
            <DialogDescription>Record a facility incident for triage, audit linkage, and map overlay updates.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1">
              <span>Asset (optional)</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                value={incidentForm.assetId || selectedAssetId || ''}
                onChange={(event) => setIncidentForm((current) => ({ ...current, assetId: event.target.value }))}
              >
                <option value="">Unassigned</option>
                {assets.map((asset) => (
                  <option key={String(asset.assetId)} value={String(asset.assetId)}>
                    {String(asset.name ?? asset.assetId)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span>Title</span>
              <input
                className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                value={incidentForm.title}
                placeholder="Elevator door fault"
                onChange={(event) => setIncidentForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="grid gap-1">
              <span>Severity</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                value={incidentForm.severity}
                onChange={(event) => setIncidentForm((current) => ({ ...current, severity: event.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span>Description</span>
              <textarea
                className="min-h-[96px] rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                value={incidentForm.description}
                placeholder="Describe the incident and immediate safety posture…"
                onChange={(event) => setIncidentForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
          </div>
          {reportIncident.isError ? (
            <p className="text-sm text-[var(--status-critical)]">{(reportIncident.error as Error).message}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentDialogOpen(false)}>Cancel</Button>
            <Button
              variant="governance"
              disabled={reportIncident.isPending || !incidentForm.title.trim()}
              onClick={() => reportIncident.mutate()}
            >
              Submit incident report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GovernedActionDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        title="Request maintenance approval"
        description={`Request human approval for facility maintenance execution on ${scheduleTargetAssetId}.`}
        protectedAction="facility-maintenance-execution"
        target={scheduleTargetAssetId}
        approvalApi="controlled-actions"
      />
    </div>
  );
}

export function WorkforcePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = feedData<Record<string, unknown>>(results, '/workforce-operations/workspace');
  const readiness = data && typeof data.readiness === 'object' ? data.readiness as Record<string, unknown> : undefined;
  const assignments = extractArray<Record<string, unknown>>(data, 'assignments');
  const certifications = extractArray<Record<string, unknown>>(data, 'certifications');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'coverage', label: 'Coverage', value: readiness?.coveragePct != null ? `${readiness.coveragePct}%` : '—' },
          { id: 'gaps', label: 'Staffing gaps', value: String(readiness?.staffingGap ?? '—') },
          { id: 'assignments', label: 'Assignments', value: String(assignments.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Shift assignments">
          <RecordTable
            columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'role', label: 'Role' },
              { key: 'zone', label: 'Zone' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(assignments, (a) => ({
              employee: String(a.employeeId ?? a.name ?? '—'),
              role: String(a.role ?? '—'),
              zone: String(a.zoneId ?? a.zone ?? '—'),
              status: String(a.status ?? a.checkInStatus ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Certifications">
          <RecordTable
            columns={[
              { key: 'cert', label: 'Certification' },
              { key: 'employee', label: 'Employee' },
              { key: 'expires', label: 'Expires' },
            ]}
            rows={mapRecords(certifications, (c) => ({
              cert: String(c.certificationId ?? c.name ?? '—'),
              employee: String(c.employeeId ?? '—'),
              expires: String(c.expiresAt ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function DigitalTwinPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const twin = feedData<Record<string, unknown>>(results, '/digital-twin/state');
  const assets = feedData<Record<string, unknown>>(results, '/assets');
  const twinList = Array.isArray(twin) ? twin : extractArray<Record<string, unknown>>(twin, 'twins');
  const assetList = Array.isArray(assets) ? assets : extractArray<Record<string, unknown>>(assets, 'assets');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'twins', label: 'Digital twins', value: String(twinList.length || (twin ? 1 : 0)) },
          { id: 'assets', label: 'Registered assets', value: String(assetList.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Twin state">
          <RecordTable
            columns={[
              { key: 'twin', label: 'Twin' },
              { key: 'health', label: 'Health' },
              { key: 'updated', label: 'Updated' },
            ]}
            rows={mapRecords(twinList.length ? twinList : twin ? [twin] : [], (t) => ({
              twin: String(t.twinId ?? t.displayName ?? t.id ?? '—'),
              health: String(t.health && typeof t.health === 'object' ? (t.health as Record<string, unknown>).status : t.healthScore ?? '—'),
              updated: String(t.lastUpdatedAt ?? t.updatedAt ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Asset registry">
          <RecordTable
            columns={[
              { key: 'asset', label: 'Asset' },
              { key: 'class', label: 'Class' },
              { key: 'risk', label: 'Risk' },
            ]}
            rows={mapRecords(assetList, (a) => ({
              asset: String(a.assetId ?? a.name ?? '—'),
              class: String(a.assetClass ?? a.assetType ?? '—'),
              risk: String(a.riskLevel ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export { EmergencyPanels } from './securityPanels';
