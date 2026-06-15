import type { ReactElement, ReactNode } from 'react';
import type { ApprovalDto, AuditEventDto, KPI, ModelReadableKPIContext } from '@trackmind/shared';
import type { AdvisoryAIRecommendation, WorkspaceCardAction, WorkspaceMetric, WorkspacePanel } from '../domain/workspaceModel';
import type { BackendSupportStatus } from '../domain/support';

export type StatusTone = 'neutral' | 'nominal' | 'advisory' | 'warning' | 'critical';

export function riskLevelToTone(riskLevel?: string): StatusTone {
  if (riskLevel === 'critical') return 'critical';
  if (riskLevel === 'high') return 'warning';
  if (riskLevel === 'medium') return 'advisory';
  if (riskLevel === 'low') return 'nominal';
  return 'warning';
}

export function kpiStatusToTone(status: KPI['status']): StatusTone {
  if (status === 'nominal') return 'nominal';
  if (status === 'critical' || status === 'blocked') return 'critical';
  if (status === 'warning') return 'warning';
  if (status === 'watch' || status === 'readiness-only') return 'advisory';
  return 'neutral';
}

export function workspacePanelStatusToTone(status: WorkspacePanel['status']): StatusTone {
  if (status === 'implemented') return 'nominal';
  return 'advisory';
}

export function supportStatusToTone(status: BackendSupportStatus): StatusTone {
  if (status === 'live-api') return 'nominal';
  return 'advisory';
}

export function PageHeader({ eyebrow, title, description, accessory }: { eyebrow: string; title: string; description: string; accessory?: ReactNode }): ReactElement {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {accessory ? <div className="page-header__accessory">{accessory}</div> : null}
    </header>
  );
}

export function SectionCard({ title, description, children, className = '' }: { title: string; description?: string; children: ReactNode; className?: string }): ReactElement {
  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-card__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }): ReactElement {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}

export function MetricCard({ metric, actions }: { metric: WorkspaceMetric; actions?: ReactNode }): ReactElement {
  return (
    <article className={`metric metric--${metric.tone}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
      {actions}
    </article>
  );
}

export function RecordCardFrame({ className = '', status, statusTone = 'neutral', title, children, actions }: { className?: string; status?: string; statusTone?: StatusTone; title: string; children: ReactNode; actions?: ReactNode }): ReactElement {
  return (
    <article className={`record-card ${className}`.trim()}>
      <div className="record-card__header">
        {status ? <StatusBadge label={status} tone={statusTone} /> : null}
        <h3>{title}</h3>
      </div>
      {children}
      {actions}
    </article>
  );
}

export function DataTable({ rows, ariaLabel }: { rows: Array<{ label: string; value: ReactNode }>; ariaLabel: string }): ReactElement {
  return (
    <dl className="data-table" aria-label={ariaLabel}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({ items, ariaLabel }: { items: Array<{ id: string; title: string; meta?: string; detail?: ReactNode }>; ariaLabel: string }): ReactElement {
  return (
    <ol className="timeline" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <strong>{item.title}</strong>
            {item.meta ? <span>{item.meta}</span> : null}
          </div>
          {item.detail ? <p>{item.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({ message, actions }: { message: string; actions?: ReactNode }): ReactElement {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {actions}
    </div>
  );
}

export function LoadingState({ label, source }: { label: string; source?: string }): ReactElement {
  return (
    <section className="workspace-state loading-state" aria-busy="true" aria-live="polite">
      <StatusBadge label="Loading" tone="advisory" />
      <p>Loading {label}{source ? ` from ${source}` : ''}</p>
    </section>
  );
}

export function ErrorState({ title, message, detail }: { title: string; message: string; detail?: string }): ReactElement {
  return (
    <section className="workspace-state workspace-state--error">
      <h1>{title}</h1>
      <p>{message}</p>
      {detail ? <p>{detail}</p> : null}
    </section>
  );
}

export function AlertPanel({ title, children, tone = 'advisory' }: { title: string; children: ReactNode; tone?: 'advisory' | 'warning' | 'critical' }): ReactElement {
  return (
    <aside className={`alert-panel alert-panel--${tone}`}>
      <h3>{title}</h3>
      {children}
    </aside>
  );
}

export function ApprovalCard({ approval, actions }: { approval: ApprovalDto; actions?: ReactNode }): ReactElement {
  const approverRoles = approval.approverRoles.length ? approval.approverRoles : approval.requiredRoles ?? [];
  return (
    <RecordCardFrame
      className="approval-card"
      status={approval.canonicalStatus}
      statusTone={approval.canonicalStatus.includes('approved') ? 'nominal' : approval.canonicalStatus.includes('rejected') || approval.canonicalStatus.includes('expired') ? 'critical' : 'warning'}
      title={String(approval.action)}
      actions={actions}
    >
      <DataTable
        ariaLabel={`Approval ${approval.approvalRequestId}`}
        rows={[
          { label: 'Target', value: approval.target },
          { label: 'Requested by', value: approval.requestedBy },
          { label: 'Tenant', value: approval.tenantId ?? 'tenant-scoped facade' },
          { label: 'Racetrack', value: approval.racetrackId ?? 'racetrack-scoped facade' },
          { label: 'Created', value: approval.createdAt },
          { label: 'Expires', value: approval.expiresAt },
          { label: 'Escalation', value: approval.escalation.length ? approval.escalation.map((rule) => `${rule.afterMinutes}m: ${rule.approverRoles.join(', ')}`).join('; ') : 'No escalation' },
          { label: 'Audit linkage', value: approval.auditLinkage.auditIds.length ? approval.auditLinkage.auditIds.join(', ') : 'No audit records yet' },
        ]}
      />
      <TagList label="Approver roles" values={approverRoles} emptyLabel="No approver roles listed" />
      <TagList label="Evidence" values={approval.evidence} emptyLabel="No evidence listed" />
    </RecordCardFrame>
  );
}

export function AuditCard({ event, actions }: { event: AuditEventDto; actions?: ReactNode }): ReactElement {
  const actorLabel = event.actor.displayName ?? event.actor.actorId;
  const entityLabel = event.entity.displayName ?? `${event.entity.entityType}:${event.entity.entityId}`;
  return (
    <RecordCardFrame
      className="audit-card audit-event-card"
      status={event.severity}
      statusTone={event.severity === 'critical' ? 'critical' : event.severity === 'warning' ? 'warning' : 'nominal'}
      title={event.action}
      actions={actions}
    >
      <DataTable
        ariaLabel={`Audit event ${event.auditEventId}`}
        rows={[
          { label: 'Actor', value: actorLabel },
          { label: 'Actor type', value: event.actor.actorType },
          { label: 'Entity', value: entityLabel },
          { label: 'Reason', value: event.reason },
          { label: 'Tenant scope', value: [event.tenantScope.tenantId, event.tenantScope.racetrackId].filter(Boolean).join(' / ') },
          { label: 'Approval', value: event.approvalReference?.approvalId ?? 'not approval-linked' },
          { label: 'Timestamp', value: event.timestamp },
          { label: 'Hash', value: <code className="inline-code">{event.integrityReference.hash.slice(0, 16)}</code> },
          { label: 'Previous hash', value: <code className="inline-code">{event.integrityReference.previousHash.slice(0, 16)}</code> },
        ]}
      />
      {event.evidenceIds?.length ? <TagList label="Evidence" values={event.evidenceIds} /> : null}
    </RecordCardFrame>
  );
}

export function AuditEventCard(props: { event: AuditEventDto; actions?: ReactNode }): ReactElement {
  return <AuditCard {...props} />;
}

export function WorkspaceRecordCard({ panel, actions }: { panel: WorkspacePanel; actions?: ReactNode }): ReactElement {
  return (
    <RecordCardFrame
      status={panel.status}
      statusTone={workspacePanelStatusToTone(panel.status)}
      title={panel.title}
      actions={actions}
    >
      <p>{panel.body}</p>
      <TagList label="Evidence" values={panel.evidence} emptyLabel="No evidence listed" />
    </RecordCardFrame>
  );
}

export function RecommendationCard({ recommendation, actions }: { recommendation: AdvisoryAIRecommendation; actions?: ReactNode }): ReactElement {
  const confidenceValue = recommendation.confidenceValue ?? recommendation.confidence.calibrated;
  const riskTone = riskLevelToTone(recommendation.riskLevel);
  return (
    <article className={`ai-card ai-card--${recommendation.riskLevel ?? 'medium'}`}>
      <div className="ai-card__header">
        <StatusBadge label={recommendation.riskLevel ?? 'medium risk'} tone={riskTone} />
        <strong>{Math.round(confidenceValue * 100)}%</strong>
      </div>
      <h3>{recommendation.recommendation}</h3>
      <DataTable
        ariaLabel={`AI recommendation ${recommendation.recommendationId}`}
        rows={[
          { label: 'Recommendation ID', value: recommendation.recommendationId },
          { label: 'Advisory', value: recommendation.advisoryOnly && recommendation.executionAllowed === false ? 'Advisory only; execution blocked' : 'Review governance policy' },
          { label: 'Confidence band', value: recommendation.confidence.band },
          { label: 'Model', value: recommendation.modelVersion },
          { label: 'Governor', value: recommendation.governorAllowed === false ? 'Execution blocked' : 'Advisory only' },
          { label: 'Generated', value: recommendation.generatedAt },
          { label: 'Approval', value: recommendation.approvalRequirement.required ? recommendation.approvalRequirement.policy : 'Not required' },
          { label: 'Audit', value: <TagList label="Audit refs" values={recommendation.auditReference.auditIds.length ? recommendation.auditReference.auditIds : [recommendation.auditId]} /> },
          { label: 'Evidence package', value: recommendation.evidencePackage.evidencePackageId },
        ]}
      />
      {recommendation.governorReason ? <p>Governor reason: {recommendation.governorReason}</p> : null}
      <TagList label="Evidence" values={recommendation.evidence} />
      {actions}
    </article>
  );
}

export function KPICard({ kpi, modelContext, actions }: { kpi: KPI; modelContext?: ModelReadableKPIContext; actions?: ReactNode }): ReactElement {
  return (
    <article className={`kpi-card kpi-card--${kpi.status}`}>
      <div className="kpi-card__header">
        <StatusBadge label={kpi.domain} tone="advisory" />
      </div>
      <h3>{kpi.name}</h3>
      <div className="kpi-card__value">
        <strong>{kpi.value}</strong>
        <span>{kpi.unit}</span>
      </div>
      <DataTable
        ariaLabel={`KPI ${kpi.kpiId}`}
        rows={[
          { label: 'Status', value: <StatusBadge label={kpi.status} tone={kpiStatusToTone(kpi.status)} /> },
          { label: 'Trend', value: kpi.trend },
          { label: 'Confidence', value: `${Math.round(kpi.confidence * 100)}%` },
          { label: 'Data quality', value: `${Math.round(kpi.dataQualityScore * 100)}%` },
          { label: 'Visibility', value: kpi.visibility },
          { label: 'Approval sensitivity', value: modelContext?.approvalSensitivity ?? kpi.approvalSensitivity },
          { label: 'Model readable', value: kpi.modelReadable ? 'Metadata only' : 'Not exposed to models' },
          { label: 'Last updated', value: kpi.lastCalculatedAt },
          { label: 'Threshold', value: kpi.threshold.description },
        ]}
      />
      <p>{kpi.description}</p>
      {modelContext ? (
        <>
          <p>{modelContext.sourceSummary}</p>
          <TagList label="Allowed model use" values={modelContext.allowedUse} emptyLabel="No allowed model uses" />
          <TagList label="Prohibited model use" values={modelContext.prohibitedUse} emptyLabel="No prohibited model uses" />
        </>
      ) : null}
      <TagList label="Audit refs" values={kpi.auditReference.auditEventIds} emptyLabel="No audit refs" />
      <Timeline
        ariaLabel={`KPI ${kpi.kpiId} snapshots`}
        items={kpi.historicalSnapshots.slice(0, 3).map((snapshot) => ({
          id: snapshot.snapshotId,
          title: `${snapshot.value} ${kpi.unit}`,
          meta: snapshot.calculatedAt,
          detail: `${snapshot.status} with ${Math.round(snapshot.confidence * 100)}% confidence`,
        }))}
      />
      {actions}
    </article>
  );
}

export function TagList({ label, values, emptyLabel = 'None' }: { label: string; values: readonly string[]; emptyLabel?: string }): ReactElement {
  return (
    <div className="tag-list" aria-label={label}>
      <span>{label}</span>
      <div>
        {values.length ? values.map((value) => <span className="tag" key={value}>{value}</span>) : <span className="tag tag--empty">{emptyLabel}</span>}
      </div>
    </div>
  );
}

export function ActionButtons({ actions, onNavigate }: { actions: WorkspaceCardAction[]; onNavigate: (path: string) => void }): ReactElement {
  return (
    <div className="card-actions" aria-label="Card actions">
      {actions.map((action) => (
        <button type="button" title={action.detail} onClick={() => onNavigate(action.path)} key={`${action.label}-${action.path}`}>{action.label}</button>
      ))}
    </div>
  );
}
