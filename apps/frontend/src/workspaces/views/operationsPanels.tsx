import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { facilitiesActionRoles } from '@trackmind/shared';
import { useRouteAccess, roleCanMutate } from '@/domain/routeAccess';
import { actionDisabledReason, roleCanUseAction } from '@/domain/approvalControls';
import { Button } from '@/design/components/button';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';
import { FacilitiesEntryConsole } from '@/features/facilities-entry/FacilitiesEntryConsole';
import { BulkDataEntryConsole } from '@/features/bulk-data-entry/BulkDataEntryConsole';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';
import { FacilitiesGeospatialMap } from './FacilitiesGeospatialMap';
import { TrackOvalDiagram } from '@/features/track/TrackOvalDiagram';
import { completeWorkforceTask, syncDigitalTwinState } from '@/api/mutations';

function defaultAssetId(assets: Record<string, unknown>[], selectedAssetId?: string): string {
  if (selectedAssetId) return selectedAssetId;
  const first = assets[0];
  return first ? String(first.assetId ?? '') : 'GRANDSTAND_HVAC_01';
}

import type { WorkspacePanelProps } from './workspacePanelTypes';

export function FacilitiesPanels({ results, role: roleProp }: WorkspacePanelProps): ReactElement {
  const { session } = useTenantSession();
  const role = roleProp ?? session.role;
  const routeAccess = useRouteAccess('facilities');
  const canManageFacilities = routeAccess.canEdit && roleCanMutate(role);
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

  const selectedAsset = assets.find((asset) => String(asset.assetId) === selectedAssetId);
  const scheduleTargetAssetId = defaultAssetId(assets, selectedAssetId);
  const canRequestMaintenanceApproval = roleCanUseAction(
    { id: 'facility-maintenance-execution', protectedAction: 'facility-maintenance-execution', label: '', target: scheduleTargetAssetId, requiredRoles: facilitiesActionRoles },
    session.role,
  );

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
      <FacilitiesEntryConsole
        assets={assets}
        inspections={inspections}
        workOrders={workOrders}
        selectedAssetId={selectedAssetId}
        onSelectAsset={setSelectedAssetId}
      />
      <BulkDataEntryConsole
        title="Facilities bulk scheduling"
        description="Bulk schedule inspections with preview, tenant scoping, and row-level audit on commit."
        operationIds={['inspection-scheduling']}
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
        {canManageFacilities ? (
        <SectionPanel title="Maintenance scheduling" description="Approval-gated maintenance schedule requests; operational impact requires human authorization.">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="governance"
              onClick={() => {
                setScheduleMessage(null);
                setScheduleDialogOpen(true);
              }}
            >
              Schedule maintenance
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canRequestMaintenanceApproval}
              title={canRequestMaintenanceApproval ? 'Request approval before schedule execution' : actionDisabledReason({ id: 'facility-maintenance-execution', protectedAction: 'facility-maintenance-execution', label: '', target: scheduleTargetAssetId, requiredRoles: facilitiesActionRoles }, session.role)}
              onClick={() => setApprovalDialogOpen(true)}
            >
              Request maintenance approval
            </Button>
            {scheduleMessage ? <p className="text-xs text-[var(--muted-foreground)]">{scheduleMessage}</p> : null}
          </div>
        </SectionPanel>
        ) : null}
        <SectionPanel title="Facility incidents" description="Report facility incidents with audit and event linkage.">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="governance"
              onClick={() => {
                setIncidentMessage(null);
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

      <TrackMindFormDialog
        entityKind="facilities-maintenance"
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        seed={{ assetId: scheduleTargetAssetId }}
        title="Schedule maintenance"
        description={`Submit an approval-gated maintenance schedule for ${scheduleTargetAssetId}. Execution remains locked until authorized.`}
        submitLabel="Submit schedule request"
        onSubmitted={(result) => {
          setScheduleMessage(
            result.approvalRequired
              ? `Maintenance schedule submitted for approval${result.approvalRequestId ? ` (${result.approvalRequestId})` : ''}. Execution remains locked until authorized.`
              : result.message ?? 'Maintenance schedule confirmed.',
          );
        }}
      />

      <TrackMindFormDialog
        entityKind="facilities-incident"
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
        seed={{ assetId: selectedAssetId ?? '' }}
        title="Report facility incident"
        description="Record a facility incident for triage, audit linkage, and map overlay updates."
        submitLabel="Submit incident report"
        onSubmitted={(result) => setIncidentMessage(result.message ?? 'Facility incident reported and linked to audit trail.')}
      />

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
  const queryClient = useQueryClient();
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const data = feedData<Record<string, unknown>>(results, '/workforce-operations/workspace');
  const readiness = data && typeof data.readiness === 'object' ? data.readiness as Record<string, unknown> : undefined;
  const planning = data && typeof data.planning === 'object' ? data.planning as Record<string, unknown> : undefined;
  const employees = extractArray<Record<string, unknown>>(data, 'employees');
  const assignments = extractArray<Record<string, unknown>>(data, 'assignments');
  const certifications = extractArray<Record<string, unknown>>(data, 'certifications');
  const shifts = extractArray<Record<string, unknown>>(data, 'shifts');

  const employeeName = (identityId: string): string => {
    const employee = employees.find((entry) => {
      const identity = entry.identity && typeof entry.identity === 'object' ? entry.identity as Record<string, unknown> : undefined;
      return String(identity?.id ?? entry.identityId) === identityId;
    });
    const identity = employee?.identity && typeof employee.identity === 'object' ? employee.identity as Record<string, unknown> : undefined;
    return String(identity?.displayName ?? employee?.displayName ?? identityId);
  };

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => completeWorkforceTask(taskId),
    onSuccess: () => {
      setTaskMessage('Assignment marked complete.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setTaskMessage(error.message),
  });

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'coverage', label: 'Coverage', value: readiness?.coveragePct != null ? `${readiness.coveragePct}%` : '—' },
          { id: 'gaps', label: 'Staffing gaps', value: String(readiness?.staffingGap ?? '—') },
          { id: 'checked-in', label: 'Checked in', value: `${readiness?.checkedIn ?? '—'}/${readiness?.demand ?? '—'}` },
          { id: 'assignments', label: 'Active crew', value: String(assignments.length) },
          { id: 'shift', label: 'Race shift', value: String(shifts[0]?.label ?? '—') },
          { id: 'compliance', label: 'Compliance', value: String(readiness?.complianceStatus ?? '—') },
        ]}
      />
      {taskMessage ? <p className="text-xs text-[var(--muted-foreground)]">{taskMessage}</p> : null}
      <SectionPanel title="Race-day crew roster" description="Five core track workers assigned to today's card — gate, veterinary, starter, emergency, and facilities.">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {assignments.map((assignment) => {
            const identityId = String(assignment.identityId ?? '');
            const taskId = String(assignment.assignmentId ?? assignment.id ?? '');
            const status = String(assignment.status ?? '—');
            return (
              <div key={taskId || identityId} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">{employeeName(identityId)}</p>
                    <p className="text-xs capitalize text-[var(--muted-foreground)]">{String(assignment.role ?? '—').replace(/-/g, ' ')}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${status === 'checked-in' ? 'text-[var(--brand-turf)]' : status === 'assigned' ? 'text-[var(--status-warning)]' : 'text-[var(--muted-foreground)]'}`}>
                    {status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">Zone {String(assignment.zoneId ?? '—')}</p>
                {assignment.emergencyCritical === true ? (
                  <p className="mt-1 text-[11px] font-medium text-[var(--brand-maroon)]">Emergency-critical post</p>
                ) : null}
                <Button
                  className="mt-2"
                  size="sm"
                  variant="governance"
                  disabled={!taskId || completeTaskMutation.isPending || status === 'checked-in'}
                  onClick={() => completeTaskMutation.mutate(taskId)}
                >
                  Mark checked in
                </Button>
              </div>
            );
          })}
        </div>
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Role coverage" description="Demand vs assigned by race-day role.">
          <RecordTable
            columns={[
              { key: 'role', label: 'Role' },
              { key: 'demand', label: 'Demand' },
              { key: 'assigned', label: 'Assigned' },
              { key: 'gap', label: 'Gap' },
            ]}
            rows={mapRecords(extractArray<Record<string, unknown>>(planning, 'byRole'), (row) => ({
              role: String(row.role ?? '—').replace(/-/g, ' '),
              demand: String(row.demand ?? '—'),
              assigned: String(row.assigned ?? '—'),
              gap: String(row.gap ?? '0'),
            }))}
            emptyLabel="No role planning data."
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
              cert: String(c.kind ?? c.certificationId ?? c.name ?? '—'),
              employee: employeeName(String(c.identityId ?? c.employeeId ?? '')),
              expires: String(c.expiresAt ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function DigitalTwinPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const twin = feedData<Record<string, unknown>>(results, '/digital-twin/state');
  const assets = feedData<Record<string, unknown>>(results, '/assets');
  const geospatial = feedData<Record<string, unknown>>(results, '/track-configuration/map');
  const twinList = Array.isArray(twin) ? twin : extractArray<Record<string, unknown>>(twin, 'twins');
  const assetList = Array.isArray(assets) ? assets : extractArray<Record<string, unknown>>(assets, 'assets');
  const mapFeatures = (() => {
    const direct = extractArray<Record<string, unknown>>(geospatial, 'features');
    if (direct.length) return direct;
    if (geospatial && typeof geospatial.geospatial === 'object') {
      return extractArray<Record<string, unknown>>(geospatial.geospatial as Record<string, unknown>, 'features');
    }
    return [];
  })();
  const primaryTwinId = String(twinList[0]?.twinId ?? twinList[0]?.id ?? 'twin:main-track');

  const trackAssets = (mapFeatures.length ? mapFeatures : assetList).slice(0, 12).map((feature, index) => ({
    id: String(feature.id ?? feature.assetId ?? `asset-${index}`),
    label: String(feature.label ?? feature.name ?? feature.assetId ?? 'Asset'),
    type: typeof feature.layer === 'string' ? feature.layer : typeof feature.assetType === 'string' ? feature.assetType : undefined,
    sectorId: typeof feature.properties === 'object' && feature.properties && typeof (feature.properties as Record<string, unknown>).sectorId === 'string'
      ? String((feature.properties as Record<string, unknown>).sectorId)
      : index % 4 === 0 ? 'chute' : index % 4 === 1 ? 'backstretch' : index % 4 === 2 ? 'far-turn' : 'stretch',
    status: typeof feature.status === 'string' ? feature.status : undefined,
  }));

  const syncMutation = useMutation({
    mutationFn: () => syncDigitalTwinState(primaryTwinId),
    onSuccess: () => {
      setSyncMessage('Digital twin sync requested.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setSyncMessage(error.message),
  });

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'twins', label: 'Digital twins', value: String(twinList.length || (twin ? 1 : 0)) },
          { id: 'assets', label: 'Registered assets', value: String(assetList.length) },
          { id: 'features', label: 'Map features', value: String(mapFeatures.length) },
        ]}
      />
      <TrackOvalDiagram
        assets={trackAssets}
        selectedAssetId={selectedAssetId}
        onAssetSelect={setSelectedAssetId}
      />
      <SectionPanel title="Twin synchronization" description="Trigger governed digital twin state refresh from the racing data hub.">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="governance" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
            Trigger twin sync
          </Button>
          {syncMessage ? <p className="text-xs text-[var(--muted-foreground)]">{syncMessage}</p> : null}
        </div>
      </SectionPanel>
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
