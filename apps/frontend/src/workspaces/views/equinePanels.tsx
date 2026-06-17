import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function EquinePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const horse = feedData<Record<string, unknown>>(results, '/equine-intelligence/horses');
  const barn = feedData<Record<string, unknown>>(results, '/barn-operations/workspace');

  const eligibilityRules = extractArray<Record<string, unknown>>(horse, 'eligibilityRules');
  const stalls = extractArray<Record<string, unknown>>(barn, 'stalls');
  const movements = extractArray<Record<string, unknown>>(barn, 'movements');
  const vetVisits = extractArray<Record<string, unknown>>(barn, 'vetVisits');

  const vetStatus = horse && typeof horse.veterinaryStatus === 'object' ? horse.veterinaryStatus as Record<string, unknown> : undefined;
  const eligibility = horse && typeof horse.eligibilityStatus === 'object' ? horse.eligibilityStatus as Record<string, unknown> : undefined;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'horse', label: 'Horse', value: String(horse?.name ?? horse?.horseId ?? 'horse-1') },
          { id: 'vet', label: 'Vet status', value: String(vetStatus?.status ?? '—') },
          { id: 'eligible', label: 'Eligibility', value: String(eligibility?.status ?? '—') },
          { id: 'stalls', label: 'Stalls tracked', value: String(stalls.length) },
        ]}
      />
      <SectionPanel title="Eligibility rules" description="Pass/fail checklist for race-day eligibility.">
        <RecordTable
          columns={[
            { key: 'rule', label: 'Rule' },
            { key: 'status', label: 'Status' },
            { key: 'detail', label: 'Detail' },
          ]}
          rows={mapRecords(eligibilityRules, (r) => ({
            rule: String(r.rule ?? r.id ?? r.name ?? '—'),
            status: String(r.status ?? (r.passed === true ? 'pass' : r.passed === false ? 'fail' : '—')),
            detail: String(r.detail ?? r.reason ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Barn stalls">
          <RecordTable
            columns={[
              { key: 'stall', label: 'Stall' },
              { key: 'horse', label: 'Horse' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(stalls, (s) => ({
              stall: String(s.stallId ?? s.id ?? '—'),
              horse: String(s.horseId ?? s.horseName ?? '—'),
              status: String(s.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Movements & access">
          <RecordTable
            columns={[
              { key: 'time', label: 'Time' },
              { key: 'type', label: 'Type' },
              { key: 'detail', label: 'Detail' },
            ]}
            rows={mapRecords([...movements, ...vetVisits], (m) => ({
              time: String(m.timestamp ?? m.observedAt ?? m.visitedAt ?? '—'),
              type: String(m.type ?? m.visitType ?? 'movement'),
              detail: String(m.detail ?? m.reason ?? m.zone ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}
