import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData, numericField } from '../feedUtils';

export function SurfacePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const surface = feedData<Record<string, unknown>>(results, '/surface-intelligence/workspace');
  const measurements = extractArray<Record<string, unknown>>(feedData(results, '/track-surface/measurements'));
  const sectors = extractArray<Record<string, unknown>>(surface, 'sectors');
  const anomalies = extractArray<Record<string, unknown>>(surface, 'anomalies');
  const recommendations = extractArray<Record<string, unknown>>(surface, 'recommendations');
  const weather = surface && typeof surface.weatherObservation === 'object' ? surface.weatherObservation as Record<string, unknown> : undefined;
  const score = numericField(surface, 'overallScore');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'score', label: 'Overall surface score', value: score != null ? String(score) : '—' },
          { id: 'readings', label: 'Live readings', value: String(measurements.length) },
          { id: 'sectors', label: 'Sectors monitored', value: String(sectors.length) },
          { id: 'anomalies', label: 'Anomalies', value: String(anomalies.length), status: anomalies.length ? 'warning' : 'nominal' },
          { id: 'weather', label: 'Weather', value: weather ? String(weather.condition ?? weather.summary ?? 'Observed') : '—' },
        ]}
      />
      <SectionPanel title="Sector conditions" description="Moisture, compaction, and risk by track sector.">
        <RecordTable
          columns={[
            { key: 'sector', label: 'Sector' },
            { key: 'moisture', label: 'Moisture' },
            { key: 'risk', label: 'Risk' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(sectors, (s) => ({
            sector: String(s.sectorId ?? s.name ?? s.id ?? '—'),
            moisture: String(s.moisture ?? s.moistureMm ?? '—'),
            risk: String(s.risk ?? s.riskLevel ?? '—'),
            status: String(s.status ?? '—'),
          }))}
        />
      </SectionPanel>
      <SectionPanel title="Live surface measurements" description="Sector moisture and compaction from /track-surface/measurements.">
        <RecordTable
          columns={[
            { key: 'sector', label: 'Sector' },
            { key: 'moisture', label: 'Moisture' },
            { key: 'compaction', label: 'Compaction' },
            { key: 'measuredAt', label: 'Measured' },
          ]}
          rows={mapRecords(measurements, (m) => ({
            sector: String(m.sectorId ?? '—'),
            moisture: m.moisture != null ? String(m.moisture) : '—',
            compaction: m.compaction != null ? String(m.compaction) : '—',
            measuredAt: String(m.measuredAt ?? '—'),
          }))}
          emptyLabel="No live surface measurements returned."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Surface anomalies">
          <RecordTable
            columns={[
              { key: 'title', label: 'Anomaly' },
              { key: 'severity', label: 'Severity' },
              { key: 'sector', label: 'Sector' },
            ]}
            rows={mapRecords(anomalies, (a) => ({
              title: String(a.title ?? a.summary ?? '—'),
              severity: String(a.severity ?? '—'),
              sector: String(a.sectorId ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Maintenance recommendations" description="Approval-gated surface actions.">
          <RecordTable
            columns={[
              { key: 'action', label: 'Action' },
              { key: 'state', label: 'State' },
              { key: 'detail', label: 'Detail' },
            ]}
            rows={mapRecords(recommendations, (r) => ({
              action: String(r.action ?? r.title ?? '—'),
              state: String(r.executionState ?? r.status ?? '—'),
              detail: String(r.detail ?? r.rationale ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}
