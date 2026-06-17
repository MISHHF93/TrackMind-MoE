import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function AuditPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const events = results.flatMap((item) => {
    if (item.status !== 'ready') return [];
    if (Array.isArray(item.data)) return item.data as Record<string, unknown>[];
    return extractArray<Record<string, unknown>>(item.data, 'events');
  });

  const critical = events.filter((e) => e.severity === 'critical').length;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'events', label: 'Audit events', value: String(events.length) },
          { id: 'critical', label: 'Critical', value: String(critical), status: critical > 0 ? 'critical' : 'nominal' },
        ]}
      />
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
  const library = feedData<Record<string, unknown>>(results, '/compliance/control-library');
  const readiness = library && typeof library.readiness === 'object' ? library.readiness as Record<string, unknown> : undefined;
  const controls = extractArray<Record<string, unknown>>(library, 'controls');
  const findings = extractArray<Record<string, unknown>>(library, 'findings');
  const actions = extractArray<Record<string, unknown>>(library, 'correctiveActions');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'score', label: 'Readiness score', value: readiness?.score != null ? String(readiness.score) : '—' },
          { id: 'controls', label: 'Controls', value: String(controls.length) },
          { id: 'findings', label: 'Open findings', value: String(findings.length), status: findings.length ? 'warning' : 'nominal' },
          { id: 'actions', label: 'Corrective actions', value: String(actions.length) },
        ]}
      />
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
              framework: String(c.framework ?? '—'),
              status: String(c.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Findings & corrective actions">
          <RecordTable
            columns={[
              { key: 'title', label: 'Item' },
              { key: 'severity', label: 'Severity' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords([...findings, ...actions], (f) => ({
              title: String(f.title ?? f.summary ?? f.id ?? '—'),
              severity: String(f.severity ?? '—'),
              status: String(f.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}
