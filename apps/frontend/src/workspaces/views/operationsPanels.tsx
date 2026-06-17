import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function FacilitiesPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = feedData<Record<string, unknown>>(results, '/facilities-maintenance/workspace');
  const readiness = data && typeof data.readiness === 'object' ? data.readiness as Record<string, unknown> : undefined;
  const assets = extractArray<Record<string, unknown>>(data, 'assets');
  const workOrders = extractArray<Record<string, unknown>>(data, 'workOrders');
  const inspections = extractArray<Record<string, unknown>>(data, 'inspections');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'score', label: 'Readiness', value: readiness?.score != null ? String(readiness.score) : '—' },
          { id: 'assets', label: 'Assets', value: String(assets.length) },
          { id: 'orders', label: 'Work orders', value: String(workOrders.length) },
          { id: 'inspections', label: 'Inspections', value: String(inspections.length) },
        ]}
      />
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
