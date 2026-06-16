import { Component, isValidElement } from 'react';
import type { ErrorInfo, ReactElement, ReactNode } from 'react';
import { normalizeApprovalStatus, type ApprovalDto, type AuditEventDto, type KPI, type ModelReadableKPIContext } from '@trackmind/shared';
import type { AdvisoryAIRecommendation, WorkspaceCardAction, WorkspaceMetric, WorkspacePanel } from '../domain/workspaceModel';
import type { BackendSupportStatus } from '../domain/support';
import { routeForPathname } from '../routes/routes';

export type StatusTone = 'neutral' | 'nominal' | 'advisory' | 'warning' | 'critical';

export function riskLevelToTone(riskLevel?: string): StatusTone {
  if (riskLevel === 'critical') return 'critical';
  if (riskLevel === 'high') return 'warning';
  if (riskLevel === 'medium') return 'advisory';
  if (riskLevel === 'low') return 'nominal';
  return 'warning';
}

export function kpiStatusToTone(status: unknown): StatusTone {
  if (status === 'nominal') return 'nominal';
  if (status === 'critical' || status === 'blocked') return 'critical';
  if (status === 'warning') return 'warning';
  if (status === 'watch' || status === 'readiness-only') return 'advisory';
  return 'neutral';
}

export function workspacePanelStatusToTone(status: unknown): StatusTone {
  if (status === 'implemented') return 'nominal';
  if (status === 'facade-only' || status === 'documented-stub') return 'advisory';
  return 'warning';
}

export function workspacePanelStatusLabel(status: unknown): string {
  if (status === 'implemented') return 'Endpoint-backed';
  if (status === 'facade-only') return 'Facade data';
  if (status === 'documented-stub') return 'Documentation only';
  return 'Unknown status';
}

function safeStatusTone(tone: unknown): StatusTone {
  return ['neutral', 'nominal', 'advisory', 'warning', 'critical'].includes(String(tone)) ? tone as StatusTone : 'warning';
}

function safeMetricTone(tone: unknown): WorkspaceMetric['tone'] {
  return ['nominal', 'advisory', 'warning', 'critical'].includes(String(tone)) ? tone as WorkspaceMetric['tone'] : 'warning';
}

function safeKpiStatus(status: unknown): string {
  return ['nominal', 'watch', 'warning', 'critical', 'blocked', 'readiness-only'].includes(String(status)) ? String(status) : 'unknown';
}

function safeRiskLevel(riskLevel: unknown): string {
  return ['critical', 'high', 'medium', 'low'].includes(String(riskLevel)) ? String(riskLevel) : 'unknown';
}

function safeAuditSeverity(severity: unknown): string {
  return ['info', 'warning', 'critical'].includes(String(severity)) ? String(severity) : 'unknown';
}

function auditSeverityToTone(severity: unknown): StatusTone {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  if (severity === 'info') return 'nominal';
  return 'warning';
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
  return <span className={`status-badge status-badge--${safeStatusTone(tone)}`}>{displayText(label, 'Unavailable')}</span>;
}

export function MetricCard({ metric, actions }: { metric: WorkspaceMetric; actions?: ReactNode }): ReactElement {
  const tone = safeMetricTone(metric.tone);
  return (
    <article className={`metric metric--${tone}`}>
      <span>{displayText(metric.label, 'Metric unavailable')}</span>
      <strong>{displayText(metric.value, 'Unavailable')}</strong>
      <small>{displayText(metric.detail, 'Metric detail unavailable')}</small>
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
      {safeRows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <dt>{row.label}</dt>
          <dd>{displayNode(row.value, 'Unavailable')}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({ items, ariaLabel }: { items?: Array<{ id: string; title: string; meta?: string; detail?: ReactNode }>; ariaLabel: string }): ReactElement {
  const safeItems = Array.isArray(items) ? items.filter((item) => item && typeof item.title === 'string' && item.title.trim()) : [];
  return (
    <ol className="timeline" aria-label={ariaLabel}>
      {safeItems.map((item, index) => (
        <li key={`${displayText(item.id, 'timeline-item')}-${index}`}>
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
    <div className="empty-state" aria-live="polite">
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
    <section className="workspace-state workspace-state--error" role="alert">
      <h1>{title}</h1>
      <p>{message}</p>
      {detail ? <p>{detail}</p> : null}
    </section>
  );
}

export class RenderErrorBoundary extends Component<{ children: ReactNode; title: string; resetKey?: string }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Workspace render failed', error, errorInfo.componentStack);
  }

  componentDidUpdate(previousProps: { resetKey?: string }): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: undefined });
    }
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
  const canonicalStatus = normalizeApprovalStatus(String(approval.canonicalStatus ?? approval.status ?? 'pending'));
  const approverRoles = safeStringArray(approval.approverRoles?.length ? approval.approverRoles : approval.requiredRoles);
  const escalation = Array.isArray(approval.escalation) ? approval.escalation.filter(isRecord) : [];
  const auditIds = safeStringArray(approval.auditLinkage?.auditIds ?? approval.auditIds);
  const requestedBy = displayText(approval.requestedByActor?.displayName ?? approval.requestedBy, 'Unknown requester');
  const approvalId = displayText(approval.approvalRequestId ?? approval.id, 'unavailable');
  return (
    <RecordCardFrame
      className="approval-card"
      status={canonicalStatus}
      statusTone={canonicalStatus.includes('approved') ? 'nominal' : canonicalStatus.includes('rejected') || canonicalStatus.includes('expired') ? 'critical' : 'warning'}
      title={displayText(approval.action, 'Approval record')}
      actions={actions}
    >
      <DataTable
        ariaLabel={`Approval ${approvalId}`}
        rows={[
          { label: 'Target', value: displayText(approval.target, 'Approval target unavailable') },
          { label: 'Requested by', value: requestedBy },
          { label: 'Tenant', value: displayText(approval.tenantId, 'tenant-scoped facade') },
          { label: 'Racetrack', value: displayText(approval.racetrackId, 'racetrack-scoped facade') },
          { label: 'Created', value: displayText(approval.createdAt, 'Created time unavailable') },
          { label: 'Expires', value: displayText(approval.expiresAt, 'Expiration unavailable') },
          { label: 'Escalation', value: escalation.length ? escalation.map((rule) => `${formatNumber(rule.afterMinutes)}m: ${safeStringArray(rule.approverRoles).join(', ') || 'role not listed'}`).join('; ') : 'No escalation' },
          { label: 'Audit linkage', value: auditIds.length ? auditIds.join(', ') : 'No audit records yet' },
        ]}
      />
      <TagList label="Approver roles" values={approverRoles} emptyLabel="No approver roles listed" />
      <TagList label="Evidence" values={safeStringArray(approval.evidence)} emptyLabel="No evidence listed" />
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
  const hash = displayText(event.integrityReference?.hash ?? event.hash, 'hash unavailable');
  const previousHash = displayText(event.integrityReference?.previousHash ?? event.previousHash, 'previous hash unavailable');
  const severity = safeAuditSeverity(event.severity);
  const eventId = displayText(event.auditEventId ?? event.id, 'unavailable');
  return (
    <RecordCardFrame
      className="audit-card audit-event-card"
      status={severity}
      statusTone={auditSeverityToTone(severity)}
      title={displayText(event.action, 'Audit event')}
      actions={actions}
    >
      <DataTable
        ariaLabel={`Audit event ${eventId}`}
        rows={[
          { label: 'Actor', value: actorLabel },
          { label: 'Actor type', value: actorType },
          { label: 'Entity', value: entityLabel },
          { label: 'Reason', value: displayText(event.reason, 'Reason unavailable') },
          { label: 'Tenant scope', value: tenantScopeLabel },
          { label: 'Approval', value: event.approvalReference?.approvalId ?? 'not approval-linked' },
          { label: 'Timestamp', value: event.timestamp },
          { label: 'Hash', value: <code className="inline-code">{hash.slice(0, 16)}</code> },
          { label: 'Previous hash', value: <code className="inline-code">{previousHash.slice(0, 16)}</code> },
        ]}
      />
      {safeStringArray(event.evidenceIds).length ? <TagList label="Evidence" values={safeStringArray(event.evidenceIds)} /> : null}
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
  const confidenceBand = displayText(recommendation.confidenceBand ?? recommendation.confidence?.band, 'unknown');
  const approvalRequirement = recommendation.approvalRequirement;
  const auditIds = recommendation.auditReference?.auditIds?.length ? recommendation.auditReference.auditIds : recommendation.auditId ? [recommendation.auditId] : [];
  const evidencePackageId = displayText(recommendation.evidencePackage?.evidencePackageId, 'No evidence package');
  const riskLevel = safeRiskLevel(recommendation.riskLevel);
  const riskTone = riskLevelToTone(riskLevel);
  const governorLabel = recommendation.executionAllowed === false || recommendation.blockedAutonomousExecution || recommendation.governorAllowed === false
    ? 'Execution blocked'
    : recommendation.governorAllowed === true ? 'Advisory review only' : 'Governor decision unavailable';
  const recommendationId = displayText(recommendation.recommendationId ?? recommendation.id, 'unavailable');
  return (
    <article className={`ai-card ai-card--${riskLevel}`}>
      <div className="ai-card__header">
        <StatusBadge label={`${riskLevel} risk`} tone={riskTone} />
        <strong>{percent(confidenceValue)}</strong>
      </div>
      <h3>{displayText(recommendation.recommendation, 'Recommendation unavailable')}</h3>
      <DataTable
        ariaLabel={`AI recommendation ${recommendationId}`}
        rows={[
          { label: 'Recommendation ID', value: recommendationId },
          { label: 'Advisory', value: recommendation.advisoryOnly && recommendation.executionAllowed === false ? 'Advisory only; execution blocked' : 'Review governance policy' },
          { label: 'Confidence band', value: confidenceBand },
          { label: 'Model', value: recommendation.modelVersion },
          { label: 'Governor', value: governorLabel },
          { label: 'Generated', value: recommendation.generatedAt },
          { label: 'Approval', value: approvalRequirement?.required ? displayText(approvalRequirement.policy, 'Approval policy unavailable') : 'Not required' },
          { label: 'Audit', value: <TagList label="Audit refs" values={auditIds} emptyLabel="No audit refs" /> },
          { label: 'Evidence package', value: evidencePackageId },
        ]}
      />
      {recommendation.governorReason ? <p>Governor reason: {displayText(recommendation.governorReason, 'Reason unavailable')}</p> : null}
      <TagList label="Evidence" values={recommendation.evidence} />
      {actions}
    </article>
  );
}

export function KPICard({ kpi, modelContext, actions }: { kpi: KPI; modelContext?: ModelReadableKPIContext; actions?: ReactNode }): ReactElement {
  const auditEventIds = kpi.auditReference?.auditEventIds ?? [];
  const historicalSnapshots = Array.isArray(kpi.historicalSnapshots) ? kpi.historicalSnapshots.filter(isRecord) : [];
  const kpiValue = typeof kpi.value === 'number' && Number.isFinite(kpi.value) ? String(kpi.value) : displayText(kpi.value, 'Unavailable');
  const kpiUnit = displayText(kpi.unit, '');
  const status = safeKpiStatus(kpi.status);
  const domain = displayText(kpi.domain, 'KPI domain unavailable');
  const name = displayText(kpi.name, 'KPI unavailable');
  const description = displayText(kpi.description, 'KPI description unavailable');
  const trend = displayText(kpi.trend, 'Trend unavailable');
  const visibility = displayText(kpi.visibility, 'Visibility unavailable');
  const threshold = kpi.threshold
    ? `${displayText(kpi.threshold.description, 'Threshold configured')} Target ${formatNumber(kpi.target)}; warning ${formatNumber(kpi.threshold.warning)}; critical ${formatNumber(kpi.threshold.critical)}; direction ${displayText(kpi.threshold.targetDirection, 'unknown')}.`
    : 'No threshold configured';
  return (
    <article className={`kpi-card kpi-card--${status}`}>
      <div className="kpi-card__header">
        <StatusBadge label={domain} tone="advisory" />
      </div>
      <h3>{name}</h3>
      <div className="kpi-card__value">
        <strong>{kpiValue}</strong>
        <span>{kpiUnit}</span>
      </div>
      <DataTable
        ariaLabel={`KPI ${kpi.kpiId}`}
        rows={[
          { label: 'Status', value: <StatusBadge label={status} tone={kpiStatusToTone(status)} /> },
          { label: 'Trend', value: trend },
          { label: 'Confidence', value: percent(kpi.confidence) },
          { label: 'Data quality', value: percent(kpi.dataQualityScore) },
          { label: 'Visibility', value: visibility },
          { label: 'Approval sensitivity', value: modelContext?.approvalSensitivity ?? kpi.approvalSensitivity },
          { label: 'Model readable', value: kpi.modelReadable ? 'Metadata only' : 'Not exposed to models' },
          { label: 'Last updated', value: kpi.lastCalculatedAt },
          { label: 'Threshold', value: threshold },
        ]}
      />
      <p>{description}</p>
      {modelContext ? (
        <>
          <p>{displayText(modelContext.sourceSummary, 'Model-readable source summary unavailable')}</p>
          <TagList label="Allowed model use" values={modelContext.allowedUse} emptyLabel="No allowed model uses" />
          <TagList label="Prohibited model use" values={modelContext.prohibitedUse} emptyLabel="No prohibited model uses" />
        </>
      ) : null}
      <TagList label="Audit refs" values={auditEventIds} emptyLabel="No audit refs" />
      <Timeline
        ariaLabel={`KPI ${kpi.kpiId} snapshots`}
        items={historicalSnapshots.slice(0, 3).map((snapshot) => ({
          id: displayText(snapshot.snapshotId, 'snapshot'),
          title: `${formatNumber(snapshot.value)} ${kpiUnit}`.trim(),
          meta: displayText(snapshot.calculatedAt, 'Snapshot time unavailable'),
          detail: `${displayText(snapshot.status, 'status unavailable')} with ${percent(snapshot.confidence)} confidence`,
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
  const seen = new Set<string>();
  const safeActions = Array.isArray(actions) ? actions.filter((action) => {
    if (!action || typeof action.label !== 'string' || !action.label.trim() || typeof action.path !== 'string') return false;
    if (!isSafeAppPath(action.path)) return false;
    const key = `${action.label}:${action.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }) : [];
  if (safeActions.length === 0) return <></>;
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

function displayNode(value: ReactNode, fallback: string): ReactNode {
  if (isValidElement(value)) return value;
  if (typeof value === 'string') return value.trim() ? value : fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return fallback;
  return fallback;
}

function percent(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? `${Math.round(value * 100)}%` : 'Not reported';
}

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Unavailable';
}

function safeStringArray(values: unknown): string[] {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isSafeAppPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  try {
    const url = new URL(path, 'https://trackmind.local');
    if (url.origin !== 'https://trackmind.local') return false;
    return Boolean(routeForPathname(url.pathname));
  } catch {
    return false;
  }
}
