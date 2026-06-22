import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { stewardRulingRoles } from '@trackmind/shared';
import { useRouteAccess } from '@/domain/routeAccess';
import { actionDisabledReason, roleCanUseAction } from '@/domain/approvalControls';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { ApprovalDecisionButtons } from '@/features/approvals/GovernedActionDialog';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import {
  authorizeApprovalExecution,
  issueStewardFinalRuling,
  type ApprovalTokenPayload,
} from '@/api/mutations';
import { feedData } from '../feedUtils';

import type { WorkspacePanelProps } from './workspacePanelTypes';

export function StewardingPanels({ results, role: roleProp }: WorkspacePanelProps): ReactElement {
  const { session } = useTenantSession();
  const role = roleProp ?? session.role;
  const routeAccess = useRouteAccess('stewarding');
  const canDraftRuling = routeAccess.canEdit && !routeAccess.isReadOnly;
  const isReadOnlyAuditor = routeAccess.isReadOnly;
  const queryClient = useQueryClient();
  const [rulingMessage, setRulingMessage] = useState<string | null>(null);
  const inquiriesData = feedData<Record<string, unknown>>(results, '/stewarding/inquiries');
  const workspaceData = feedData<Record<string, unknown>>(results, '/steward-operations/workspace');
  const decisionSupportData = feedData<Record<string, unknown>>(results, '/decision-support');
  const inquiries = extractArray<Record<string, unknown>>(inquiriesData, 'inquiries');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const defaultInquiryId = String(inquiries[0]?.id ?? '');

  useEffect(() => {
    if (!selectedInquiryId && defaultInquiryId) {
      setSelectedInquiryId(defaultInquiryId);
    }
  }, [defaultInquiryId, selectedInquiryId]);

  const activeInquiry = inquiries.find((inquiry) => String(inquiry.id) === selectedInquiryId) ?? inquiries[0];
  const inquiryId = String(activeInquiry?.id ?? '');
  const recommendationSupport = (decisionSupportData ?? inquiriesData?.recommendationSupport ?? workspaceData?.recommendationSupport) as Record<string, unknown> | undefined;
  const recommendations = extractArray<Record<string, unknown>>(recommendationSupport ?? {}, 'recommendations');
  const evidence = activeInquiry
    ? extractArray<Record<string, unknown>>(activeInquiry, 'evidenceReferences')
    : extractArray<Record<string, unknown>>(inquiriesData, 'evidenceReferences');
  const drafts = activeInquiry
    ? extractArray<Record<string, unknown>>(activeInquiry, 'decisionDrafts')
    : extractArray<Record<string, unknown>>(inquiriesData, 'decisionDrafts');
  const timeline = activeInquiry
    ? extractArray<Record<string, unknown>>(activeInquiry, 'timeline')
    : extractArray<Record<string, unknown>>(inquiriesData, 'timeline');
  const integrations = (activeInquiry?.integrations ?? {}) as { approvalRequestIds?: string[] };
  const approvalRequestId = integrations.approvalRequestIds?.[0];
  const finalRuling = activeInquiry?.finalRuling as Record<string, unknown> | undefined;
  const humanDraft = drafts.find((draft) => !draft.aiGenerated);
  const evidenceIds = evidence.map((item) => String(item.id ?? '')).filter(Boolean);
  const ruleIds = (humanDraft && Array.isArray(humanDraft.ruleIds)
    ? humanDraft.ruleIds
    : activeInquiry && Array.isArray(activeInquiry.ruleReferences)
      ? (activeInquiry.ruleReferences as Array<{ id?: string }>).map((rule) => String(rule.id ?? ''))
      : []
  ).filter(Boolean);
  const canFinalize = roleCanUseAction(
    { id: 'steward-final-ruling', label: 'Record final ruling', protectedAction: 'steward-decision', target: inquiryId, requiredRoles: stewardRulingRoles },
    session.role,
  );
  const finalizeDisabledReason = actionDisabledReason(
    { id: 'steward-final-ruling', label: 'Record final ruling', protectedAction: 'steward-decision', target: inquiryId, requiredRoles: stewardRulingRoles },
    session.role,
  );

  const recordFinalRulingMutation = useMutation({
    mutationFn: async () => {
      if (!inquiryId) throw new Error('Steward inquiry is required before recording a final ruling.');
      if (!approvalRequestId) throw new Error('Final ruling requires a pending steward approval request.');
      const authorized = await authorizeApprovalExecution(approvalRequestId);
      const token = authorized.approvalToken;
      if (!token) throw new Error('Approval token was not issued. Complete steward approval first.');
      return issueStewardFinalRuling(inquiryId, {
        id: `final-${Date.now().toString(36)}`,
        issuedBy: session.role,
        issuedByRole: session.role === 'platform-super-admin' ? 'admin' : 'steward',
        issuedAt: new Date().toISOString(),
        decision: String(humanDraft?.recommendation ?? 'Official steward ruling recorded without official result mutation'),
        rationale: String(humanDraft?.rationale ?? 'Human steward panel reviewed evidence and rule references.'),
        penalties: [],
        evidenceIds,
        ruleIds,
        tenantId: session.tenantId,
        racetrackId: session.racetrackId,
        approvalToken: token as ApprovalTokenPayload,
        approvalRequestId,
        actor: session.role,
      });
    },
    onSuccess: (result) => {
      setRulingMessage(result.message ?? 'Final steward ruling recorded with verified approval token.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error) => {
      setRulingMessage(error instanceof Error ? error.message : 'Final ruling request failed.');
    },
  });

  return (
    <div className="space-y-4">
      <SectionPanel title="Steward inquiries" description="Objections, incidents, and investigations under review.">
        {inquiries.length > 1 ? (
          <label className="mb-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            Active inquiry
            <select
              className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--foreground)]"
              value={inquiryId}
              onChange={(event) => setSelectedInquiryId(event.target.value)}
            >
              {inquiries.map((inquiry) => (
                <option key={String(inquiry.id)} value={String(inquiry.id ?? '')}>
                  {String(inquiry.title ?? inquiry.id ?? 'Inquiry')}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
      <SectionPanel
        title="Final ruling"
        description="Human-only final steward ruling with verified approval token. AI cannot issue official rulings or modify official results."
      >
        {isReadOnlyAuditor ? (
          <p className="text-sm text-muted-foreground">Read-only auditor view — ruling drafts and finalization are disabled.</p>
        ) : finalRuling ? (
          <div className="space-y-2 text-sm">
            <Badge variant="outline">Finalized</Badge>
            <p>{String(finalRuling.decision ?? 'Final ruling recorded')}</p>
            <p className="text-muted-foreground">
              Issued by {String(finalRuling.issuedBy ?? 'steward')} · official results unchanged
            </p>
          </div>
        ) : canDraftRuling ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {approvalRequestId
                ? `Pending approval ${approvalRequestId} before final ruling can be recorded.`
                : 'No steward approval request is linked to this inquiry.'}
            </p>
            {approvalRequestId ? <ApprovalDecisionButtons approvalId={approvalRequestId} /> : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={!canFinalize || !approvalRequestId || recordFinalRulingMutation.isPending}
                onClick={() => recordFinalRulingMutation.mutate()}
              >
                Record final ruling
              </Button>
              {finalizeDisabledReason ? (
                <span className="text-sm text-muted-foreground">{finalizeDisabledReason}</span>
              ) : null}
            </div>
            {rulingMessage ? <p className="text-sm text-muted-foreground">{rulingMessage}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Your role can review steward inquiries but cannot draft or finalize rulings.</p>
        )}
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
