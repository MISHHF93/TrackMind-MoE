import type { ApprovalComposeMode, ApprovalSourceDomain } from '@trackmind/shared';
import {
  approvalSourceDomains,
  composerPreview,
  defaultSeedForDomain,
  fieldsForComposeMode,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { RecordTable, mapRecords } from '@/design/components/record-table';
import { FormMessage } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { isRecord } from '@/lib/utils';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';
import { useTenantSession } from '@/auth/TenantSessionProvider';

const composeModeLabels: Record<ApprovalComposeMode, { label: string; description: string }> = {
  quick: {
    label: 'Quick compose',
    description: 'Title, domain, action, reason, risk, and approver — optimized for speed.',
  },
  full: {
    label: 'Full compose',
    description: 'Adds evidence, expiration, and links to incidents, recommendations, or entities.',
  },
};

export function ApprovalRequestComposer({
  approvals,
  relatedIncidentId,
  relatedRecommendationId,
  relatedEntityKind,
  relatedEntityId,
  initialDomain = 'race-day-action',
  className,
}: {
  approvals: Record<string, unknown>[];
  relatedIncidentId?: string;
  relatedRecommendationId?: string;
  relatedEntityKind?: string;
  relatedEntityId?: string;
  initialDomain?: ApprovalSourceDomain;
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [composeMode, setComposeMode] = useState<ApprovalComposeMode>('quick');
  const [sourceDomain, setSourceDomain] = useState<ApprovalSourceDomain>(initialDomain);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const seed = useMemo(() => ({
    ...defaultSeedForDomain(sourceDomain),
    composeMode,
    requestTitle: '',
    reason: '',
    relatedIncidentId: relatedIncidentId ?? '',
    relatedRecommendationId: relatedRecommendationId ?? '',
    relatedEntityKind: relatedEntityKind ?? '',
    relatedEntityId: relatedEntityId ?? '',
    supportingEvidence: relatedIncidentId ? `incident:${relatedIncidentId}` : relatedRecommendationId ? `recommendation:${relatedRecommendationId}` : '',
  }), [composeMode, sourceDomain, relatedIncidentId, relatedRecommendationId, relatedEntityKind, relatedEntityId]);

  const preview = composerPreview(seed);
  const visibleFieldHint = fieldsForComposeMode(composeMode).join(', ');

  const openCompose = () => {
    setMessage(null);
    setDialogOpen(true);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Approval request composer"
        description="Submit governed approvals from AI, incident, race-day, compliance, security, finance, or admin context — clearer than editing raw records."
      >
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          Submits approval requests only. Protected actions are not executed from this composer.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(composeModeLabels) as ApprovalComposeMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={composeMode === mode ? 'governance' : 'outline'}
              onClick={() => setComposeMode(mode)}
            >
              {composeModeLabels[mode].label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{composeModeLabels[composeMode].description}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Fields: {visibleFieldHint}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {approvalSourceDomains.map((domain) => (
            <Button
              key={domain.domain}
              size="sm"
              variant={sourceDomain === domain.domain ? 'default' : 'outline'}
              title={domain.description}
              onClick={() => setSourceDomain(domain.domain)}
            >
              {domain.shortLabel}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-2 rounded-md border border-[var(--border)] p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Submission preview</p>
          <div className="grid gap-1 text-xs">
            <p><span className="text-[var(--muted-foreground)]">Title:</span> {preview.title || '—'}</p>
            <p><span className="text-[var(--muted-foreground)]">Domain:</span> {preview.domain}</p>
            <p><span className="text-[var(--muted-foreground)]">Action:</span> {preview.action}</p>
            <p><span className="text-[var(--muted-foreground)]">Target:</span> {preview.target}</p>
            <p><span className="text-[var(--muted-foreground)]">Risk:</span> {preview.riskLevel} · Approver: {preview.approverRole}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="governance" onClick={openCompose}>
            {composeMode === 'quick' ? 'Quick submit' : 'Full compose & submit'}
          </Button>
        </div>

        {message ? <div className="mt-3"><FormMessage message={message} tone="muted" /></div> : null}

        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Actor: {session.role} · Timestamps and audit linkage captured on submit.
        </p>
      </SectionPanel>

      <SectionPanel title="Recent requests" description="Queued approvals with domain context and audit references.">
        <RecordTable
          columns={[
            { key: 'title', label: 'Title / action' },
            { key: 'target', label: 'Target' },
            { key: 'status', label: 'Status' },
            { key: 'expires', label: 'Expires' },
            { key: 'audit', label: 'Audit' },
          ]}
          rows={mapRecords(approvals, (approval) => ({
            title: String(approval.requestTitle ?? approval.action ?? approval.actionType ?? '—'),
            target: String(approval.target ?? '—'),
            status: String(approval.status ?? approval.state ?? '—'),
            expires: approval.expiresAt ? new Date(String(approval.expiresAt)).toLocaleString() : '—',
            audit: Array.isArray(approval.auditIds) && approval.auditIds.length
              ? String(approval.auditIds[0])
              : isRecord(approval.auditLinkage) && Array.isArray((approval.auditLinkage as { auditIds?: string[] }).auditIds)
                ? String((approval.auditLinkage as { auditIds: string[] }).auditIds[0] ?? '—')
                : '—',
          }))}
          emptyLabel="No approval requests yet — compose one above."
        />
      </SectionPanel>

      <TrackMindFormDialog
        entityKind="approval-request-composer"
        mode="create"
        seed={seed}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={composeMode === 'quick' ? 'Quick approval request' : 'Full approval request'}
        description="Review title, action, and approver before submit. Execution stays locked until authorized."
        submitLabel="Submit for approval"
        onSubmitted={(result) => {
          setMessage(result.message ?? `Approval ${result.approvalRequestId ?? 'request'} queued.`);
          void queryClient.invalidateQueries({ queryKey: ['workspace'] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
