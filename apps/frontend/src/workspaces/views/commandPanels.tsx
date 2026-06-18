import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';
import { AdminFoundationPanels } from './platformPanels';

export function CommandCenterPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const command = feedData<Record<string, unknown>>(results, '/operations/command-center');
  const health = feedData<Record<string, unknown>>(results, '/platform/health');
  const kpis = feedData<Record<string, unknown>>(results, '/kpis');

  const widgets = extractArray<Record<string, unknown>>(command, 'widgets');
  const liveEvents = extractArray<Record<string, unknown>>(command, 'liveEvents');
  const services = extractArray<Record<string, unknown>>(health, 'services');
  const kpiItems = extractArray<Record<string, unknown>>(kpis, 'kpis');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={kpiItems.slice(0, 6).map((kpi, index) => ({
          id: String(kpi.id ?? index),
          label: String(kpi.label ?? kpi.name ?? 'KPI'),
          value: String(kpi.value ?? '—'),
          detail: kpi.target != null ? `Target ${kpi.target}` : undefined,
          status: kpi.status === 'critical' ? 'critical' : kpi.status === 'warning' ? 'warning' : 'nominal',
        }))}
      />
      <SectionPanel title="Command widgets" description="Role-aware operational cards from the command center feed.">
        <RecordTable
          columns={[
            { key: 'title', label: 'Widget' },
            { key: 'status', label: 'Status' },
            { key: 'value', label: 'Value' },
            { key: 'domain', label: 'Domain' },
          ]}
          rows={mapRecords(widgets, (w) => ({
            title: String(w.title ?? '—'),
            status: String(w.status ?? '—'),
            value: String(w.value ?? w.detail ?? '—'),
            domain: String(w.domain ?? '—'),
          }))}
          emptyLabel="No command widgets returned."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Live events" description="Recent operational events across domains.">
          <RecordTable
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'severity', label: 'Severity' },
              { key: 'summary', label: 'Summary' },
            ]}
            rows={mapRecords(liveEvents, (e) => ({
              type: String(e.type ?? e.eventType ?? '—'),
              severity: String(e.severity ?? '—'),
              summary: String(e.summary ?? e.detail ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Platform services" description="Dependency health from platform observability.">
          <RecordTable
            columns={[
              { key: 'name', label: 'Service' },
              { key: 'status', label: 'Status' },
              { key: 'latency', label: 'Latency' },
            ]}
            rows={mapRecords(services, (s) => ({
              name: String(s.name ?? s.serviceId ?? '—'),
              status: String(s.status ?? s.health ?? '—'),
              latency: s.latencyMs != null ? `${s.latencyMs}ms` : '—',
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function AdminPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const health = feedData<Record<string, unknown>>(results, '/platform/health');
  const ownership = feedData<Record<string, unknown>>(results, '/platform/domain-ownership');
  const lineage = feedData<Record<string, unknown>>(results, '/platform/governance-lineage/validation');
  const executive = feedData<Record<string, unknown>>(results, '/platform/executive-scorecard');
  const maturity = feedData<Record<string, unknown>>(results, '/platform/maturity-review');
  const services = extractArray<Record<string, unknown>>(health, 'services');
  const lineageSummary = lineage?.summary as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <AdminFoundationPanels results={results} />
      <SectionPanel title="Governance & maturity" description="Domain ownership, lineage validation, readiness scorecards, and platform maturity review.">
        <RecordTable
          columns={[
            { key: 'artifact', label: 'Artifact' },
            { key: 'metric', label: 'Metric' },
            { key: 'status', label: 'Status' },
          ]}
          rows={[
            { artifact: 'Domain ownership entries', metric: String(extractArray(ownership, 'entries').length), status: 'registry' },
            { artifact: 'Lineage checks valid', metric: String(lineageSummary?.valid ?? '—'), status: 'validated' },
            { artifact: 'Executive overall score', metric: String(executive?.overall ?? '—'), status: 'score' },
            { artifact: 'Platform maturity grade', metric: String(maturity?.overallGrade ?? '—'), status: 'grade' },
          ]}
        />
      </SectionPanel>
      <SectionPanel title="Platform services" description="Dependency health from platform observability.">
        <RecordTable
          columns={[
            { key: 'name', label: 'Service' },
            { key: 'status', label: 'Status' },
            { key: 'latency', label: 'Latency' },
          ]}
          rows={mapRecords(services, (s) => ({
            name: String(s.name ?? s.serviceId ?? '—'),
            status: String(s.status ?? s.health ?? '—'),
            latency: s.latencyMs != null ? `${s.latencyMs}ms` : '—',
          }))}
        />
      </SectionPanel>
    </div>
  );
}
