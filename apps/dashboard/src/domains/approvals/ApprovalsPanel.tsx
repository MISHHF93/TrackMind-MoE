import { ApprovalChip, CollaborationPanel, EmptyState, EvidenceList, EventTimeline, FilterBar, GovernedActionButton, MetricStrip, RecordSourceLabel, RiskBadge, WorkspaceFrame } from '../../components/nexus-ui.js';
import type { ApprovalDto, ApprovalQueueDto } from '../../types.js';

const queues: ApprovalQueueDto[] = ['race-day', 'surface', 'veterinary', 'security', 'compliance', 'ai', 'operations'];

function queueFor(approval: ApprovalDto): ApprovalQueueDto {
  if (approval.queue) return approval.queue;
  const text = `${approval.action} ${approval.target}`.toLowerCase();
  if (text.includes('surface') || text.includes('harrow') || text.includes('irrigation')) return 'surface';
  if (text.includes('vet') || text.includes('horse')) return 'veterinary';
  if (text.includes('security') || text.includes('credential')) return 'security';
  if (text.includes('compliance')) return 'compliance';
  if (approval.requestedBy.toLowerCase().includes('ai')) return 'ai';
  if (text.includes('race')) return 'race-day';
  return 'operations';
}

function riskFor(approval: ApprovalDto): 'low' | 'medium' | 'high' | 'critical' {
  if (approval.priority) return approval.priority;
  if (approval.status === 'escalated') return 'critical';
  if (approval.status === 'pending-approval' || approval.status === 'pending') return 'high';
  return 'medium';
}

function csvFields(approval: ApprovalDto) {
  return approval.exportFields ?? ['id', 'tenantId', 'racetrackId', 'queue', 'action', 'target', 'status', 'requestedBy', 'createdAt', 'expiresAt', 'correlationId'];
}

function approvalTenant(approval: ApprovalDto) {
  return approval.tenantId ?? 'unscoped-approval-tenant';
}

function approvalRacetrack(approval: ApprovalDto) {
  return approval.racetrackId ?? approval.tenantId ?? 'unscoped-approval-racetrack';
}

export function ApprovalsPanel({ approvals }: { approvals: ApprovalDto[] }) {
  const byQueue = queues.map((queue) => ({ queue, items: approvals.filter((approval) => queueFor(approval) === queue) }));
  const pending = approvals.filter((approval) => approval.status === 'pending-approval' || approval.status === 'pending' || approval.status === 'escalated');
  const critical = approvals.filter((approval) => riskFor(approval) === 'critical');
  const discussionApproval = pending[0] ?? approvals[0];

  return (
    <WorkspaceFrame
      title="Approvals Center"
      label="Approvals panel"
      eyebrow="Human approval queue"
      description={<>Human approval queue for protected operations. Action controls remain routed through <code>POST /api/v1/approvals/controlled-actions</code> or draft-request APIs; this view does not mutate local state.</>}
      mock={approvals.some((approval) => approval.mock)}
      operationalSummary={<MetricStrip items={[
        { label: 'Open approvals', value: String(pending.length), detail: 'Pending, pending-approval, or escalated' },
        { label: 'Queues', value: String(byQueue.filter((entry) => entry.items.length > 0).length), detail: 'Race day, surface, veterinary, security, compliance, AI, operations' },
        { label: 'Critical approvals', value: String(critical.length), detail: 'Escalated or explicitly critical' },
      ]} />}
      evidenceDetailPanel={<><p>Evidence records are rendered per approval request and preserved for export review.</p><EvidenceList items={Array.from(new Set(approvals.flatMap((approval) => approval.evidence))).slice(0, 8)} label="Approval workspace evidence records" /></>}
      eventTimeline={<EventTimeline label="Approval workspace event timeline" events={pending.flatMap((approval) => (approval.history?.length ? approval.history : [{ id: `${approval.id}-requested`, actor: approval.actor ?? { id: approval.requestedBy, displayName: approval.requestedBy, role: 'requester', actorType: 'service' as const }, decision: 'requested' as const, reason: 'Approval requested', evidence: approval.evidence, timestamp: approval.createdAt }]).map((item) => ({ time: item.timestamp, label: `${approval.id}: ${item.decision} by ${item.actor.displayName}`, tone: item.decision })))} />}
      approvalContext={<p>{pending.length} approvals are pending, pending-approval, or escalated across {byQueue.filter(({ items }) => items.some((approval) => pending.includes(approval))).map(({ queue }) => queue).join(', ') || 'no active queues'}.</p>}
      auditContext={<p>Approval audit links: {approvals.flatMap((approval) => approval.auditIds ?? []).join(', ') || 'not linked in current approval DTOs'}; correlation IDs {approvals.map((approval) => approval.correlationId).filter(Boolean).join(', ') || 'none'}.</p>}
      digitalTwinContext={<p>Affected Digital Twin or asset context is derived from affected assets: {approvals.flatMap((approval) => approval.affectedAssets ?? [approval.target]).join(', ') || 'none loaded'}.</p>}
      primary={<>
      <FilterBar label="Approval queue filters" summary="Filters are rendered for export/readiness review; backend query parameters should own live filtering." filters={byQueue.map(({ queue, items }) => ({ id: queue, label: queue, count: items.length }))} />
      <section aria-label="Pending approval queue summary">
        <h3>Pending queues</h3>
        <p>{pending.length} protected actions are pending, pending-approval, or escalated. AI advisory requests and operational controls are routed to backend approval services only.</p>
        <p>Queued domains: {byQueue.filter(({ items }) => items.some((approval) => pending.includes(approval))).map(({ queue }) => queue).join(', ') || 'none'}.</p>
        {discussionApproval && <CollaborationPanel
          routeScope="approvals"
          title="Approval Request Discussion"
          targetArtifactId={discussionApproval.id}
          targetArtifactType="approval-request"
          tenantId={approvalTenant(discussionApproval)}
          racetrackId={approvalRacetrack(discussionApproval)}
          workflowRef={discussionApproval.workflowId}
          approvalRef={discussionApproval.id}
          auditRefs={discussionApproval.auditIds ?? []}
          twinRefs={(discussionApproval.affectedAssets ?? []).filter((asset) => asset.startsWith('twin:'))}
          evidenceRefs={discussionApproval.evidence}
          variant="approval-discussion"
          activityItems={(discussionApproval.history?.length ? discussionApproval.history : [{ id: `${discussionApproval.id}-requested`, actor: discussionApproval.actor ?? { id: discussionApproval.requestedBy, displayName: discussionApproval.requestedBy, role: 'requester', actorType: 'service' as const }, decision: 'requested' as const, reason: 'Approval requested', evidence: discussionApproval.evidence, timestamp: discussionApproval.createdAt }]).map((item) => ({
            id: item.id,
            actor: item.actor.displayName,
            message: `${item.decision}: ${item.reason}`,
            at: item.timestamp,
            tone: item.decision === 'approved' ? 'ok' : item.decision === 'rejected' ? 'critical' : 'warning',
          }))}
        />}
      </section>
      {approvals.length === 0 ? <EmptyState message="No pending AI or operational approvals." label="Approvals empty" /> : (
        <section aria-label="Approval queues">
          {byQueue.filter(({ items }) => items.length > 0).map(({ queue, items }) => (
            <article key={queue} aria-label={`${queue} approval queue`}>
              <h3>{queue}</h3>
              {items.map((approval) => (
                <article key={approval.id} aria-label={`Approval request ${approval.id}`} data-status={approval.status} data-correlation-id={approval.correlationId ?? approval.id}>
                  <header>
                    <RiskBadge level={riskFor(approval)} /> <ApprovalChip status={approval.status} />
                    <RecordSourceLabel mock={approval.mock} label="approval request" />
                    <h4>{approval.action} for {approval.target}</h4>
                    <p>Requested by {approval.actor?.displayName ?? approval.requestedBy} ({approval.actor?.role ?? 'requester'}) at <time>{approval.createdAt}</time>; expires <time>{approval.expiresAt}</time>.</p>
                    <p>Tenant <code>{approvalTenant(approval)}</code>; racetrack <code>{approvalRacetrack(approval)}</code>; correlation ID <code>{approval.correlationId ?? approval.id}</code>{approval.workflowId ? <>; workflow <code>{approval.workflowId}</code></> : null}</p>
                  </header>
                  <section aria-label={`Evidence panel for ${approval.id}`}>
                    <h5>Evidence</h5>
                    <EvidenceList items={approval.evidence} label={`Approval evidence records for ${approval.id}`} />
                  </section>
                  <section aria-label={`Affected assets for ${approval.id}`}>
                    <h5>Affected assets</h5>
                    <p>{(approval.affectedAssets ?? [approval.target]).join(', ')}</p>
                  </section>
                  <section aria-label={`Approval history for ${approval.id}`}>
                    <h5>Approval history</h5>
                    <EventTimeline events={(approval.history?.length ? approval.history : [{ id: `${approval.id}-requested`, actor: approval.actor ?? { id: approval.requestedBy, displayName: approval.requestedBy, role: 'requester', actorType: 'service' as const }, decision: 'requested' as const, reason: 'Approval requested', evidence: approval.evidence, timestamp: approval.createdAt }]).map((item) => ({ time: item.timestamp, label: `${item.decision} by ${item.actor.displayName}: ${item.reason}`, tone: item.decision }))} />
                  </section>
                  <section aria-label={`Approval export view for ${approval.id}`}>
                    <h5>Export-ready fields</h5>
                    <code>{csvFields(approval).join(',')}</code>
                  </section>
                  <section aria-label={`Approval controls for ${approval.id}`}>
                    <GovernedActionButton label={`Route ${approval.id} approval action through backend client`} approvalApi="POST /api/v1/approvals/controlled-actions" reason="Human approval decisions must be recorded through the backend approval service; this UI never mutates official approval records locally." />
                  </section>
                </article>
              ))}
            </article>
          ))}
        </section>
      )}
      </>}
    />
  );
}
