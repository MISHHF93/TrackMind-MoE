import type { ReactElement } from 'react';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function StewardingPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const inquiriesData = feedData<Record<string, unknown>>(results, '/stewarding/inquiries');
  const workspaceData = feedData<Record<string, unknown>>(results, '/steward-operations/workspace');
  const inquiries = extractArray<Record<string, unknown>>(inquiriesData, 'inquiries');
  const recommendationSupport = (inquiriesData?.recommendationSupport ?? workspaceData?.recommendationSupport) as Record<string, unknown> | undefined;
  const recommendations = extractArray<Record<string, unknown>>(recommendationSupport ?? {}, 'recommendations');
  const firstInquiry = inquiries[0] as Record<string, unknown> | undefined;
  const inquiryId = String(firstInquiry?.id ?? '');
  const evidence = firstInquiry
    ? extractArray<Record<string, unknown>>(firstInquiry, 'evidenceReferences')
    : extractArray<Record<string, unknown>>(inquiriesData, 'evidenceReferences');
  const drafts = firstInquiry
    ? extractArray<Record<string, unknown>>(firstInquiry, 'decisionDrafts')
    : extractArray<Record<string, unknown>>(inquiriesData, 'decisionDrafts');
  const timeline = firstInquiry
    ? extractArray<Record<string, unknown>>(firstInquiry, 'timeline')
    : extractArray<Record<string, unknown>>(inquiriesData, 'timeline');

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
      <SectionPanel
        title="Decision support"
        description="Advisory AI recommendations linked to steward evidence references. Official rulings require human steward approval."
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {String(recommendationSupport?.guardrailStatement ?? 'AI outputs remain advisory only; human stewards must review evidence before any official ruling.')}
        </p>
        <RecordTable
          columns={[
            { key: 'recommendation', label: 'Recommendation' },
            { key: 'source', label: 'Source' },
            { key: 'evidence', label: 'Linked evidence' },
          ]}
          rows={mapRecords(recommendations, (r) => ({
            recommendation: String(r.summary ?? r.recommendationId ?? '—'),
            source: String(r.source ?? '—'),
            evidence: String(
              Array.isArray(r.linkedEvidenceRefs)
                ? r.linkedEvidenceRefs.join(', ')
                : Array.isArray(r.evidenceIds)
                  ? r.evidenceIds.map((id) => `/steward-operations/inquiries/${inquiryId}/evidence/${id}`).join(', ')
                  : '—',
            ),
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
            rows={mapRecords(evidence, (e) => {
              const custody = e.custody as { chainOfCustody?: unknown[]; legalHold?: boolean } | undefined;
              return {
                ref: String(e.id ?? e.referenceId ?? '—'),
                custody: String(custody?.chainOfCustody?.length ?? e.custodyStatus ?? '—'),
                hold: String(custody?.legalHold ?? e.legalHold ?? '—'),
              };
            })}
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
              draft: String(d.id ?? d.title ?? d.recommendation ?? '—'),
              status: String(d.aiGenerated ? 'advisory' : d.status ?? 'draft'),
              rule: String(d.ruleReference ?? (Array.isArray(d.ruleIds) ? d.ruleIds.join(', ') : '—')),
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
            time: String(t.at ?? t.timestamp ?? t.occurredAt ?? '—'),
            event: String(t.source ?? t.event ?? t.action ?? '—'),
            detail: String(t.label ?? t.detail ?? t.summary ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}
