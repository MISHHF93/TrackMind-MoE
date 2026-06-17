import type { ReactElement } from 'react';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function StewardingPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = feedData<Record<string, unknown>>(results, '/stewarding/inquiries');
  const inquiries = extractArray<Record<string, unknown>>(data, 'inquiries');
  const evidence = extractArray<Record<string, unknown>>(data, 'evidenceReferences');
  const drafts = extractArray<Record<string, unknown>>(data, 'decisionDrafts');
  const timeline = extractArray<Record<string, unknown>>(data, 'timeline');

  return (
    <div className="space-y-4">
      <SectionPanel title="Steward inquiries" description="Objections, incidents, and investigations under review.">
        <RecordTable
          columns={[
            { key: 'inquiry', label: 'Inquiry' },
            { key: 'status', label: 'Status' },
            { key: 'parties', label: 'Parties' },
          ]}
          rows={mapRecords(inquiries, (i) => ({
            inquiry: String(i.title ?? i.id ?? '—'),
            status: String(i.status ?? '—'),
            parties: String(Array.isArray(i.involvedParties) ? i.involvedParties.join(', ') : i.horseId ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Evidence references">
          <RecordTable
            columns={[
              { key: 'ref', label: 'Reference' },
              { key: 'custody', label: 'Custody' },
              { key: 'hold', label: 'Legal hold' },
            ]}
            rows={mapRecords(evidence, (e) => ({
              ref: String(e.id ?? e.referenceId ?? '—'),
              custody: String(e.custodyStatus ?? '—'),
              hold: String(e.legalHold ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Decision drafts">
          <RecordTable
            columns={[
              { key: 'draft', label: 'Draft' },
              { key: 'status', label: 'Status' },
              { key: 'rule', label: 'Rule' },
            ]}
            rows={mapRecords(drafts, (d) => ({
              draft: String(d.id ?? d.title ?? '—'),
              status: String(d.status ?? '—'),
              rule: String(d.ruleReference ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Inquiry timeline">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'event', label: 'Event' },
            { key: 'detail', label: 'Detail' },
          ]}
          rows={mapRecords(timeline, (t) => ({
            time: String(t.timestamp ?? t.occurredAt ?? '—'),
            event: String(t.event ?? t.action ?? '—'),
            detail: String(t.detail ?? t.summary ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}
