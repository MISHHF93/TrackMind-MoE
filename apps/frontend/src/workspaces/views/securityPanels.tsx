import type { ReactElement } from 'react';
import { Badge } from '@/design/components/badge';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

function securityData(results: WorkspaceDataResult[]) {
  return feedData<Record<string, unknown>>(results, '/security-operations/workspace');
}

export function SecurityPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = securityData(results);
  const incidents = extractArray<Record<string, unknown>>(data, 'incidents');
  const cameras = extractArray<Record<string, unknown>>(data, 'cameras');
  const access = extractArray<Record<string, unknown>>(data, 'accessEvents');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'incidents', label: 'Active incidents', value: String(incidents.length), status: incidents.length ? 'warning' : 'nominal' },
          { id: 'cameras', label: 'Cameras', value: String(cameras.length) },
          { id: 'access', label: 'Access events', value: String(access.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Incidents">
          <RecordTable
            columns={[
              { key: 'title', label: 'Incident' },
              { key: 'severity', label: 'Severity' },
              { key: 'zone', label: 'Zone' },
            ]}
            rows={mapRecords(incidents, (i) => ({
              title: String(i.title ?? i.summary ?? i.id ?? '—'),
              severity: String(i.severity ?? '—'),
              zone: String(i.zoneId ?? i.zone ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Camera health">
          <RecordTable
            columns={[
              { key: 'camera', label: 'Camera' },
              { key: 'zone', label: 'Zone' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(cameras, (c) => ({
              camera: String(c.cameraId ?? c.id ?? c.name ?? '—'),
              zone: String(c.zoneId ?? '—'),
              status: String(c.status ?? c.health ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Recent access events">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'person', label: 'Person' },
            { key: 'zone', label: 'Zone' },
            { key: 'result', label: 'Result' },
          ]}
          rows={mapRecords(access, (a) => ({
            time: String(a.timestamp ?? '—'),
            person: String(a.personId ?? a.credentialId ?? '—'),
            zone: String(a.zoneId ?? '—'),
            result: String(a.result ?? a.decision ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}

export function IncidentPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const security = securityData(results);
  const emergency = feedData<Record<string, unknown>>(results, '/emergency-operations/workspace');
  const investigations = extractArray<Record<string, unknown>>(security, 'investigations');
  const incidents = extractArray<Record<string, unknown>>(security, 'incidents');
  const emergencyStatus = String(emergency?.activeEmergencyStatus ?? 'nominal');

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Emergency posture</p>
          <p className="text-xs text-[var(--muted-foreground)]">Combined security and emergency operations feeds</p>
        </div>
        <Badge variant={emergencyStatus.includes('active') ? 'critical' : 'nominal'}>{emergencyStatus}</Badge>
      </div>
      <SectionPanel title="Incident command board">
        <RecordTable
          columns={[
            { key: 'incident', label: 'Incident' },
            { key: 'severity', label: 'Severity' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(incidents, (i) => ({
            incident: String(i.title ?? i.id ?? '—'),
            severity: String(i.severity ?? '—'),
            status: String(i.status ?? '—'),
          }))}
        />
      </SectionPanel>
      <SectionPanel title="Investigations">
        <RecordTable
          columns={[
            { key: 'id', label: 'Investigation' },
            { key: 'lead', label: 'Lead' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(investigations, (i) => ({
            id: String(i.id ?? '—'),
            lead: String(i.lead ?? i.assignee ?? '—'),
            status: String(i.status ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}

export function EmergencyPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const emergency = feedData<Record<string, unknown>>(results, '/emergency-operations/workspace');
  const checklist = extractArray<Record<string, unknown>>(emergency, 'checklist');
  const comms = extractArray<Record<string, unknown>>(emergency, 'communicationLog');
  const roles = extractArray<Record<string, unknown>>(emergency, 'commandRoles');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'status', label: 'Emergency status', value: String(emergency?.activeEmergencyStatus ?? 'standby') },
          { id: 'checklist', label: 'Checklist items', value: String(checklist.length) },
          { id: 'roles', label: 'Command roles', value: String(roles.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Emergency checklist">
          <RecordTable
            columns={[
              { key: 'item', label: 'Item' },
              { key: 'status', label: 'Status' },
              { key: 'owner', label: 'Owner' },
            ]}
            rows={mapRecords(checklist, (c) => ({
              item: String(c.title ?? c.item ?? c.id ?? '—'),
              status: String(c.status ?? (c.completed ? 'done' : 'open')),
              owner: String(c.owner ?? c.role ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Command roles">
          <RecordTable
            columns={[
              { key: 'role', label: 'Role' },
              { key: 'assignee', label: 'Assignee' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(roles, (r) => ({
              role: String(r.role ?? r.title ?? '—'),
              assignee: String(r.assignee ?? r.personId ?? '—'),
              status: String(r.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Communications log">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'audience', label: 'Audience' },
            { key: 'message', label: 'Message' },
          ]}
          rows={mapRecords(comms, (c) => ({
            time: String(c.timestamp ?? '—'),
            audience: String(c.audience ?? c.channel ?? '—'),
            message: String(c.message ?? c.summary ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}
