import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedFromIndex, indexWorkspaceFeeds } from '../feedUtils';
import { AdminFoundationPanels } from './platformPanels';

export function CommandCenterPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const feeds = useMemo(() => indexWorkspaceFeeds(results), [results]);
  const command = feedFromIndex<Record<string, unknown>>(feeds, '/operations/command-center');
  const health = feedFromIndex<Record<string, unknown>>(feeds, '/platform/health');
  const kpis = feedFromIndex<Record<string, unknown>>(feeds, '/kpis');

  const widgets = extractArray<Record<string, unknown>>(command, 'widgets');
  const liveEvents = extractArray<Record<string, unknown>>(command, 'liveEvents');
  const services = extractArray<Record<string, unknown>>(health, 'services');
  const kpiItems = extractArray<Record<string, unknown>>(kpis, 'kpis');
  const kpiItemsWithSnapshots = useMemo(
    () => kpiItems.map((kpi) => ({
      kpi,
      snapshots: extractArray<Record<string, unknown>>(kpi, 'historicalSnapshots'),
    })),
    [kpiItems],
  );
  const kpiSnapshotCount = kpiItemsWithSnapshots.reduce((total, item) => total + item.snapshots.length, 0);

  return (
    <div className="space-y-4">
      <KpiStrip
        items={kpiItemsWithSnapshots.slice(0, 6).map(({ kpi, snapshots }, index) => {
          const latest = snapshots.length ? snapshots[snapshots.length - 1] : undefined;
          return {
            id: String(kpi.id ?? kpi.kpiId ?? index),
            label: String(kpi.label ?? kpi.name ?? 'KPI'),
            value: String(kpi.value ?? latest?.value ?? '—'),
            detail: snapshots.length ? `${snapshots.length} snapshots` : kpi.target != null ? `Target ${kpi.target}` : undefined,
            status: kpi.status === 'critical' ? 'critical' : kpi.status === 'warning' ? 'warning' : 'nominal',
          };
        })}
      />
      <SectionPanel title="Command widgets" description={`Role-aware operational cards from the command center feed. KPI engine: ${kpiSnapshotCount} historical snapshots.`}>
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
  const feeds = useMemo(() => indexWorkspaceFeeds(results), [results]);
  const health = feedFromIndex<Record<string, unknown>>(feeds, '/platform/health');
  const ownership = feedFromIndex<Record<string, unknown>>(feeds, '/platform/domain-ownership');
  const lineage = feedFromIndex<Record<string, unknown>>(feeds, '/platform/governance-lineage/validation');
  const executive = feedFromIndex<Record<string, unknown>>(feeds, '/platform/executive-scorecard');
  const maturity = feedFromIndex<Record<string, unknown>>(feeds, '/platform/maturity-review');
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
