import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData, numericField } from '../feedUtils';

export function RaceDayPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const raceOffice = feedData<Record<string, unknown>>(results, '/race-operations/race-office');
  const readiness = feedData<Record<string, unknown>>(results, '/race-day-readiness/dashboard');
  const surface = feedData<Record<string, unknown>>(results, '/surface-intelligence/workspace');

  const cards = extractArray<Record<string, unknown>>(raceOffice, 'cards');
  const lifecycle = extractArray<Record<string, unknown>>(raceOffice, 'lifecycle');
  const warnings = extractArray<Record<string, unknown>>(readiness, 'warnings');
  const domainScores = extractArray<Record<string, unknown>>(readiness, 'domainScores');

  const avgScore = numericField(readiness, 'averageScore') ?? numericField(readiness, 'readinessScore');
  const surfaceScore = numericField(surface, 'overallScore');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'avg', label: 'Readiness score', value: avgScore != null ? `${avgScore}%` : '—', status: avgScore != null && avgScore >= 80 ? 'nominal' : 'warning' },
          { id: 'surface', label: 'Surface score', value: surfaceScore != null ? String(surfaceScore) : '—' },
          { id: 'races', label: 'Race cards', value: String(cards.length) },
          { id: 'warnings', label: 'Warnings', value: String(warnings.length), status: warnings.length > 0 ? 'warning' : 'nominal' },
        ]}
      />
      <SectionPanel title="Race cards" description="Entries, conditions, and office state per race.">
        <RecordTable
          columns={[
            { key: 'id', label: 'Race' },
            { key: 'status', label: 'Status' },
            { key: 'entries', label: 'Entries' },
            { key: 'postTime', label: 'Post' },
          ]}
          rows={mapRecords(cards, (c) => ({
            id: String(c.id ?? c.raceId ?? '—'),
            status: String(c.status ?? '—'),
            entries: String(Array.isArray(c.entries) ? c.entries.length : c.activeEntries ?? '—'),
            postTime: String(c.postTime ?? c.scheduledStart ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Domain readiness" description="Per-domain readiness scores and blockers.">
          <RecordTable
            columns={[
              { key: 'domain', label: 'Domain' },
              { key: 'score', label: 'Score' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(domainScores, (d) => ({
              domain: String(d.domain ?? d.label ?? '—'),
              score: d.score != null ? String(d.score) : '—',
              status: String(d.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Race lifecycle" description="Next governed actions per race.">
          <RecordTable
            columns={[
              { key: 'raceId', label: 'Race' },
              { key: 'status', label: 'Status' },
              { key: 'next', label: 'Next action' },
            ]}
            rows={mapRecords(lifecycle, (l) => ({
              raceId: String(l.raceId ?? '—'),
              status: String(l.status ?? '—'),
              next: String(l.nextAction ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Readiness warnings" description="Items requiring steward or operational review.">
        <RecordTable
          columns={[
            { key: 'title', label: 'Warning' },
            { key: 'domain', label: 'Domain' },
            { key: 'action', label: 'Recommended action' },
          ]}
          rows={mapRecords(warnings, (w) => ({
            title: String(w.title ?? w.summary ?? '—'),
            domain: String(w.domain ?? '—'),
            action: String(w.recommendedAction ?? w.detail ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}
