import { Component } from 'react';
import type { ErrorInfo, ReactElement, ReactNode } from 'react';
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

export function workspacePanelStatusLabel(status: WorkspacePanel['status']): string {
  if (status === 'implemented') return 'Endpoint-backed';
  if (status === 'facade-only') return 'Facade data';
  return 'Documentation only';
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

export function DataTable({ rows, ariaLabel }: { rows?: Array<{ label: string; value: ReactNode }>; ariaLabel: string }): ReactElement {
  const safeRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row.label === 'string' && row.label.trim()) : [];
  return (
    <dl className="data-table" aria-label={ariaLabel}>
      {safeRows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({ items, ariaLabel }: { items?: Array<{ id: string; title: string; meta?: string; detail?: ReactNode }>; ariaLabel: string }): ReactElement {
  const safeItems = Array.isArray(items) ? items.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string') : [];
  return (
    <ol className="timeline" aria-label={ariaLabel}>
      {safeItems.map((item) => (
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

export class RenderErrorBoundary extends Component<{ children: ReactNode; title: string }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Workspace render failed', error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorState
          title={this.props.title}
          message="This workspace could not render one of its records."
          detail={this.state.error.message}
        />
      );
    }
    return this.props.children;
  }
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
  const canonicalStatus = approval.canonicalStatus ?? approval.status ?? 'pending';
  const approverRoles = approval.approverRoles?.length ? approval.approverRoles : approval.requiredRoles ?? [];
  const escalation = approval.escalation ?? [];
  const auditIds = approval.auditLinkage?.auditIds ?? approval.auditIds ?? [];
  return (
    <RecordCardFrame
      className="approval-card"
      status={canonicalStatus}
      statusTone={canonicalStatus.includes('approved') ? 'nominal' : canonicalStatus.includes('rejected') || canonicalStatus.includes('expired') ? 'critical' : 'warning'}
      title={displayText(approval.action, 'Approval record')}
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
          { label: 'Escalation', value: escalation.length ? escalation.map((rule) => `${rule.afterMinutes ?? '?'}m: ${Array.isArray(rule.approverRoles) ? rule.approverRoles.join(', ') || 'role not listed' : 'roles unavailable'}`).join('; ') : 'No escalation' },
          { label: 'Audit linkage', value: auditIds.length ? auditIds.join(', ') : 'No audit records yet' },
        ]}
      />
      <TagList label="Approver roles" values={approverRoles} emptyLabel="No approver roles listed" />
      <TagList label="Evidence" values={approval.evidence} emptyLabel="No evidence listed" />
    </RecordCardFrame>
  );
}

export function AuditCard({ event, actions }: { event: AuditEventDto; actions?: ReactNode }): ReactElement {
  const actorLabel = event.actor?.displayName ?? event.actor?.actorId ?? event.actorId ?? 'Unknown actor';
  const actorType = event.actor?.actorType ?? 'unknown';
  const entityLabel = event.entity?.displayName
    ?? (event.entity?.entityType && event.entity?.entityId ? `${event.entity.entityType}:${event.entity.entityId}` : event.subjectId ?? 'No entity reference');
  const tenantScopeLabel = event.tenantScope
    ? [event.tenantScope.tenantId, event.tenantScope.racetrackId].filter(Boolean).join(' / ') || 'Tenant scope not provided'
    : 'Tenant scope not provided';
  const hash = event.integrityReference?.hash ?? event.hash ?? 'hash unavailable';
  const previousHash = event.integrityReference?.previousHash ?? event.previousHash ?? 'previous hash unavailable';
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
          { label: 'Actor type', value: actorType },
          { label: 'Entity', value: entityLabel },
          { label: 'Reason', value: event.reason },
          { label: 'Tenant scope', value: tenantScopeLabel },
          { label: 'Approval', value: event.approvalReference?.approvalId ?? 'not approval-linked' },
          { label: 'Timestamp', value: event.timestamp },
          { label: 'Hash', value: <code className="inline-code">{hash.slice(0, 16)}</code> },
          { label: 'Previous hash', value: <code className="inline-code">{previousHash.slice(0, 16)}</code> },
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
      status={workspacePanelStatusLabel(panel.status)}
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
  const confidenceValue = recommendation.confidenceValue ?? recommendation.confidence?.calibrated;
  const confidenceBand = recommendation.confidenceBand ?? recommendation.confidence?.band ?? 'unknown';
  const approvalRequirement = recommendation.approvalRequirement;
  const auditIds = recommendation.auditReference?.auditIds?.length ? recommendation.auditReference.auditIds : recommendation.auditId ? [recommendation.auditId] : [];
  const evidencePackageId = recommendation.evidencePackage?.evidencePackageId ?? 'No evidence package';
  const riskTone = riskLevelToTone(recommendation.riskLevel);
  return (
    <article className={`ai-card ai-card--${recommendation.riskLevel ?? 'medium'}`}>
      <div className="ai-card__header">
        <StatusBadge label={recommendation.riskLevel ?? 'medium risk'} tone={riskTone} />
        <strong>{percent(confidenceValue)}</strong>
      </div>
      <h3>{displayText(recommendation.recommendation, 'Recommendation unavailable')}</h3>
      <DataTable
        ariaLabel={`AI recommendation ${recommendation.recommendationId}`}
        rows={[
          { label: 'Recommendation ID', value: recommendation.recommendationId },
          { label: 'Advisory', value: recommendation.advisoryOnly && recommendation.executionAllowed === false ? 'Advisory only; execution blocked' : 'Review governance policy' },
          { label: 'Confidence band', value: confidenceBand },
          { label: 'Model', value: recommendation.modelVersion },
          { label: 'Governor', value: recommendation.governorAllowed === false ? 'Execution blocked' : 'Advisory only' },
          { label: 'Generated', value: recommendation.generatedAt },
          { label: 'Approval', value: approvalRequirement?.required ? approvalRequirement.policy : 'Not required' },
          { label: 'Audit', value: <TagList label="Audit refs" values={auditIds} emptyLabel="No audit refs" /> },
          { label: 'Evidence package', value: evidencePackageId },
        ]}
      />
      {recommendation.governorReason ? <p>Governor reason: {recommendation.governorReason}</p> : null}
      <TagList label="Evidence" values={recommendation.evidence} />
      {actions}
    </article>
  );
}

export function KPICard({ kpi, modelContext, actions }: { kpi: KPI; modelContext?: ModelReadableKPIContext; actions?: ReactNode }): ReactElement {
  const auditEventIds = kpi.auditReference?.auditEventIds ?? [];
  const historicalSnapshots = kpi.historicalSnapshots ?? [];
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
          { label: 'Confidence', value: percent(kpi.confidence) },
          { label: 'Data quality', value: percent(kpi.dataQualityScore) },
          { label: 'Visibility', value: kpi.visibility },
          { label: 'Approval sensitivity', value: modelContext?.approvalSensitivity ?? kpi.approvalSensitivity },
          { label: 'Model readable', value: kpi.modelReadable ? 'Metadata only' : 'Not exposed to models' },
          { label: 'Last updated', value: kpi.lastCalculatedAt },
          { label: 'Threshold', value: kpi.threshold?.description ?? 'No threshold configured' },
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
      <TagList label="Audit refs" values={auditEventIds} emptyLabel="No audit refs" />
      <Timeline
        ariaLabel={`KPI ${kpi.kpiId} snapshots`}
        items={historicalSnapshots.slice(0, 3).map((snapshot) => ({
          id: snapshot.snapshotId,
          title: `${snapshot.value} ${kpi.unit}`,
          meta: snapshot.calculatedAt,
          detail: `${snapshot.status} with ${percent(snapshot.confidence)} confidence`,
        }))}
      />
      {actions}
    </article>
  );
}

export function TagList({ label, values, emptyLabel = 'None' }: { label: string; values?: readonly string[]; emptyLabel?: string }): ReactElement {
  const safeValues = Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))] : [];
  return (
    <div className="tag-list" aria-label={label}>
      <span>{label}</span>
      <div>
        {safeValues.length ? safeValues.map((value, index) => <span className="tag" key={`${value}-${index}`}>{value}</span>) : <span className="tag tag--empty">{emptyLabel}</span>}
      </div>
    </div>
  );
}

export function ActionButtons({ actions, onNavigate }: { actions?: WorkspaceCardAction[]; onNavigate: (path: string) => void }): ReactElement {
  const safeActions = Array.isArray(actions) ? actions.filter((action) => action && typeof action.label === 'string' && action.label.trim() && typeof action.path === 'string' && action.path.startsWith('/')) : [];
  return (
    <div className="card-actions" aria-label="Card actions">
      {safeActions.map((action) => (
        <button type="button" title={action.detail} onClick={() => onNavigate(action.path)} key={`${action.label}-${action.path}`}>{action.label}</button>
      ))}
    </div>
  );
}

function displayText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function percent(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'Unavailable';
}
