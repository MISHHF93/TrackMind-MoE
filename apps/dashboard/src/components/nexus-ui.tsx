import type { ReactNode } from 'react';
import type { AdapterMode, ApprovalDto, AuditEventDto, CollaborationActivityDto, CollaborationAssignmentDto, CollaborationDecisionRecordDto, CollaborationEvidencePacketDto, CollaborationMentionDto, CollaborationThreadDto, CollaborationWorkspaceDto, GeospatialLayerDto, TrackMapDto } from '../types.js';

export type NexusTone = 'ok' | 'info' | 'nominal' | 'advisory' | 'warning' | 'critical' | 'low' | 'medium' | 'high' | 'healthy' | 'degraded' | 'offline' | (string & {});
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

type CardProps = {
  title: string;
  eyebrow?: string;
  status?: string;
  detail?: string;
  tone?: NexusTone;
  mock?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
};

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
};

type SafetyCriticalButtonProps = {
  approvalsSatisfied: boolean;
  backendLive: boolean;
  authenticated: boolean;
  children: ReactNode;
  reason?: string;
  describedById?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

type CommandBarProps = {
  label?: string;
  search?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  mobileNavigation?: ReactNode;
  tenantSelector?: ReactNode;
  status?: ReactNode;
  notifications?: ReactNode;
  userMenu?: ReactNode;
  children?: ReactNode;
  mock?: boolean;
  degraded?: boolean;
};

export type WorkspaceSectionKind = 'operational-summary' | 'primary-work-area' | 'evidence-detail-panel' | 'event-timeline' | 'approval-context' | 'audit-context' | 'digital-twin-context';

export type WorkspaceFrameSummaryItem = { label: string; value: string; detail: string };

type WorkspaceSectionProps = {
  kind: WorkspaceSectionKind;
  title: string;
  label?: string;
  children: ReactNode;
};

type WorkspaceFrameProps = {
  id?: string;
  title: string;
  label?: string;
  eyebrow?: string;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  summaryItems?: WorkspaceFrameSummaryItem[];
  operationalSummary?: ReactNode;
  primary?: ReactNode;
  evidenceDetailPanel?: ReactNode;
  eventTimeline?: ReactNode;
  approvalContext?: ReactNode;
  auditContext?: ReactNode;
  digitalTwinContext?: ReactNode;
  children?: ReactNode;
  mock?: boolean;
  degraded?: boolean;
};

type DataTableShellProps<T> = {
  label: string;
  title?: string;
  description?: ReactNode;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  mock?: boolean;
};

type FilterBarOption = {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

export type CollaborationActivityItem = {
  id: string;
  kind: 'comment' | 'mention' | 'assignment' | 'decision' | 'handoff' | 'evidence' | 'incident-room' | 'approval-discussion';
  actorId: string;
  summary: string;
  occurredAt: string;
  tone?: NexusTone;
  auditRefs?: string[];
  eventRefs?: string[];
};

function toneForStatus(status: string): NexusTone {
  const normalized = status.toLowerCase();
  if (['critical', 'closed', 'blocked', 'offline'].includes(normalized)) return 'critical';
  if (['warning', 'watch', 'maintenance', 'degraded'].includes(normalized)) return 'warning';
  if (['ready', 'healthy', 'online', 'open', 'approved', 'satisfied', 'nominal'].includes(normalized)) return 'ok';
  return 'info';
}

function approvalStateForStatus(status: ApprovalDto['status']) {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'expired') return 'expired';
  if (status === 'escalated') return 'escalated';
  return 'pending';
}

export function PageHeader({ title, eyebrow, description, label = 'Page header', actions, metadata, mock = false, children, headingLevel = 1 }: { title: string; eyebrow?: string; description?: ReactNode; label?: string; actions?: ReactNode; metadata?: ReactNode; mock?: boolean; children?: ReactNode; headingLevel?: 1 | 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3';
  return (
    <header className="page-header command-bar" aria-label={label} data-mock={mock || undefined}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
      {metadata && <div className="page-header__metadata" aria-label={`${title} metadata`}>{metadata}</div>}
      {actions && <div className="page-header__actions" aria-label={`${title} actions`}>{actions}</div>}
      {children}
    </header>
  );
}

export function WorkspaceSection({ kind, title, label, children }: WorkspaceSectionProps) {
  return (
    <section className={`workspace-section workspace-section--${kind}`} aria-label={label ?? `${title} workspace section`} data-workspace-section={kind}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function WorkspaceFrame({ id, title, label, eyebrow, description, metadata, actions, summaryItems, operationalSummary, primary, evidenceDetailPanel, eventTimeline, approvalContext, auditContext, digitalTwinContext, children, mock = false, degraded = false }: WorkspaceFrameProps) {
  const summary = operationalSummary ?? (summaryItems ? <MetricStrip items={summaryItems} /> : null);
  const workArea = primary ?? children;
  return (
    <section id={id} className="workspace-frame" aria-label={label ?? `${title} workspace`} data-workspace-standard="v1" data-responsive-structure="split-pane-to-single-column" data-mock={mock || undefined} data-state={degraded ? 'degraded' : undefined}>
      <PageHeader title={title} eyebrow={eyebrow} description={description} label={`${title} page header`} actions={actions} metadata={metadata} mock={mock} headingLevel={2} />
      {summary && WorkspaceSection({ kind: 'operational-summary', title: 'Operational summary', label: `${title} operational summary row`, children: summary })}
      <SplitPane
        label={`${title} responsive work area`}
        primary={WorkspaceSection({ kind: 'primary-work-area', title: 'Primary work area', label: `${title} primary work area`, children: workArea })}
        secondary={WorkspaceSection({ kind: 'evidence-detail-panel', title: 'Evidence and detail', label: `${title} evidence/detail side panel`, children: evidenceDetailPanel ?? <p>No focused evidence record selected.</p> })}
        mock={mock}
      />
      <div className="workspace-frame__contexts" aria-label={`${title} governance and twin context`}>
        {eventTimeline && WorkspaceSection({ kind: 'event-timeline', title: 'Event timeline', label: `${title} event timeline`, children: eventTimeline })}
        {approvalContext && WorkspaceSection({ kind: 'approval-context', title: 'Approval context', label: `${title} approval context`, children: approvalContext })}
        {auditContext && WorkspaceSection({ kind: 'audit-context', title: 'Audit context', label: `${title} audit context`, children: auditContext })}
        {digitalTwinContext && WorkspaceSection({ kind: 'digital-twin-context', title: 'Digital Twin context', label: `${title} Digital Twin context`, children: digitalTwinContext })}
      </div>
    </section>
  );
}

export function WorkspaceLayout({ children, sidebar, skipLink, label = 'TrackMind Nexus workspace', id = 'top', mock = false, degraded = false }: { children: ReactNode; sidebar?: ReactNode; skipLink?: { href: string; label: string }; label?: string; id?: string; mock?: boolean; degraded?: boolean }) {
  return (
    <main className="nexus-shell workspace-layout" id={id} aria-label={label} data-mock={mock || undefined} data-state={degraded ? 'degraded' : undefined}>
      {skipLink && <a className="skip-link" href={skipLink.href}>{skipLink.label}</a>}
      {sidebar}
      <div className="workspace-content" aria-label={`${label} content`}>
        {children}
      </div>
    </main>
  );
}

export function CommandBar({ label = 'Command bar', search, actions, breadcrumbs, mobileNavigation, tenantSelector, status, notifications, userMenu, children, mock = false, degraded = false }: CommandBarProps) {
  return (
    <section className="command-bar command-bar--shared" aria-label={label} data-mock={mock || undefined} data-state={degraded ? 'degraded' : undefined}>
      {search}
      {actions}
      {breadcrumbs}
      {mobileNavigation}
      {tenantSelector}
      {status}
      {notifications}
      {userMenu}
      {children}
    </section>
  );
}

export function NexusCard({ title, eyebrow, status, detail, tone, mock = false, actions, children }: CardProps) {
  return (
    <article className="nexus-card" tabIndex={0} aria-label={status ? `${title}: ${status}` : title} data-tone={tone ?? (status ? toneForStatus(status) : undefined)} data-mock={mock || undefined}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h3>{title}</h3>
      {status && <StatusIndicator label={status} tone={tone ?? toneForStatus(status)} />}
      {detail && <p>{detail}</p>}
      {actions && <div aria-label={`${title} actions`}>{actions}</div>}
      {children}
    </article>
  );
}

export function StatusCard({ title, status, detail, tone, children, mock = false, actions }: { title: string; status: string; detail: string; tone?: NexusTone; children?: ReactNode; mock?: boolean; actions?: ReactNode }) {
  return <NexusCard title={title} status={status} detail={detail} tone={tone} mock={mock} actions={actions}>{children}</NexusCard>;
}

export function KpiTile({ label, value, trend, tone = 'info' }: { label: string; value: string; trend: string; tone?: NexusTone }) {
  return <article className="kpi-tile" aria-label={`${label} KPI`} data-tone={tone}><p>{label}</p><strong>{value}</strong><small>{trend}</small></article>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className="risk-badge" aria-label={`Risk level ${level}`} data-risk={level} data-tone={level}><span aria-hidden="true">◆</span> {level.toUpperCase()}</span>;
}

export function ApprovalChip({ status }: { status: ApprovalDto['status'] }) {
  const approvalState = approvalStateForStatus(status);
  const tone = approvalState === 'approved' ? 'ok' : approvalState === 'rejected' || approvalState === 'expired' ? 'critical' : 'warning';
  return <span className="approval-chip" aria-label={`Approval ${status}`} data-status={status} data-approval={approvalState} data-tone={tone}><span aria-hidden="true">●</span> {status}</span>;
}

export function StatusIndicator({ label, tone = 'info' }: { label: string; tone?: NexusTone }) {
  return <span className="status-indicator" aria-label={`Status ${label}`} data-tone={tone}><span aria-hidden="true">●</span> <strong>{label}</strong></span>;
}

export function EventTimeline({ events, label = 'Event timeline' }: { events: { time: string; label: string; tone: NexusTone }[]; label?: string }) {
  if (events.length === 0) return <p role="status" aria-label={`${label} empty`}>No timeline events available.</p>;
  return <ol className="event-timeline" aria-label={label}>{events.map((event) => <li key={`${event.time}-${event.label}`} data-tone={event.tone}><time>{event.time}</time> <StatusIndicator label={event.label} tone={event.tone} /> <small>{event.tone}</small></li>)}</ol>;
}

export function DataFreshness({ label, timestamp, mode, stale = false }: { label: string; timestamp?: string; mode: AdapterMode; stale?: boolean }) {
  return <p role="status" aria-label={`${label} data freshness`} data-state={stale ? 'stale' : 'fresh'} data-stale={stale || undefined}>Data freshness: {label} {timestamp ?? 'not reported'} ({mode} adapter); {stale ? 'stale data warning' : 'freshness current'}</p>;
}

export function EmptyState({ message = 'No records available', mock = false, label = 'Empty state' }: { message?: string; mock?: boolean; label?: string }) {
  return <p className="state-message" role="status" aria-label={label} data-state="empty" data-adapter={mock ? 'mock' : 'live'}>{`${message}${mock ? ' (mock adapter active)' : ''}`}</p>;
}

export function ErrorState({ message, mock = false, label = 'Error state' }: { message: string; mock?: boolean; label?: string }) {
  return <p className="state-message" role="alert" aria-label={label} data-state="error" data-adapter={mock ? 'mock' : 'live'}>{`Unable to load ${mock ? 'mock' : 'live'} data: ${message}`}</p>;
}

export function DataTable<T>({ label, columns, rows, getRowKey, emptyMessage = 'No records available.', mock = false }: { label: string; columns: DataTableColumn<T>[]; rows: T[]; getRowKey: (row: T) => string; emptyMessage?: string; mock?: boolean }) {
  if (rows.length === 0) return <EmptyState message={emptyMessage} mock={mock} label={`${label} empty`} />;
  return (
    <table className="data-table" aria-label={label}>
      <thead><tr>{columns.map((column) => <th key={column.key} scope="col" data-align={column.align ?? 'left'}>{column.header}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={getRowKey(row)}>{columns.map((column) => <td key={column.key} data-align={column.align ?? 'left'}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function LoadingSkeleton({ label = 'Loading command-center data...', rows = 3, adapter }: { label?: string; rows?: number; adapter?: AdapterMode }) {
  return (
    <div className="loading-skeleton state-message" role="status" aria-live="polite" aria-busy="true" aria-label={label} data-state="loading" data-tone="info" data-adapter={adapter}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => <span key={index} aria-hidden="true" />)}
    </div>
  );
}

export function DataTableShell<T>({ label, title, description, columns, rows, getRowKey, emptyMessage = 'No records available.', loading = false, error, mock = false }: DataTableShellProps<T>) {
  return (
    <section className="data-table-shell" aria-label={label} aria-busy={loading || undefined} data-state={loading ? 'loading' : error ? 'error' : rows.length === 0 ? 'empty' : 'ready'} data-adapter={mock ? 'mock' : 'live'}>
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      <MockDataBanner active={mock} />
      {loading ? <LoadingSkeleton label={`${label} loading`} adapter={mock ? 'mock' : 'live'} /> : error ? <ErrorState message={error} mock={mock} label={`${label} error`} /> : <DataTable label={`${label} table`} columns={columns} rows={rows} getRowKey={getRowKey} emptyMessage={emptyMessage} mock={mock} />}
    </section>
  );
}

export function FilterBar({ label, summary, children, actions, filters = [] }: { label: string; summary?: string; children?: ReactNode; actions?: ReactNode; filters?: FilterBarOption[] }) {
  return (
    <form className="filter-bar" role="search" aria-label={label}>
      {summary && <p>{summary}</p>}
      <div>{filters.map((filter) => <button key={filter.id} type="button" disabled={filter.disabled ?? true} aria-disabled={filter.disabled ?? true} aria-label={`Filter ${label.replace(/ filters$/i, '').toLowerCase()} by ${filter.label}`}>{filter.label}{filter.count === undefined ? '' : ` (${filter.count})`}</button>)}{children}</div>
      {actions && <div aria-label={`${label} actions`}>{actions}</div>}
    </form>
  );
}

export function MockDataBanner({ active, source = 'mock adapter' }: { active: boolean; source?: string }) {
  if (!active) return null;
  return <aside className="mock-data-banner" role="note" aria-label="Mock data banner" data-mock="true" data-adapter="mock" data-state="mock" data-tone="warning">{`Mock data active via ${source}: state-changing controls only create approval requests.`}</aside>;
}

export function RecordSourceLabel({ mock = false, label = 'governance record' }: { mock?: boolean; label?: string }) {
  return <small className="record-source-label" role="status" aria-label={`${label} source`} data-mock={mock || undefined} data-tone={mock ? 'warning' : 'info'}>{mock ? `Mock ${label} approved mock adapter` : `Live ${label} live backend source`}</small>;
}

export function EvidenceList({ items, empty = 'No evidence linked.', label = 'Evidence records' }: { items: string[]; empty?: string; label?: string }) {
  return <ul aria-label={label}>{items.length ? items.map((item) => <li key={item}><code>{item}</code></li>) : <li>{empty}</li>}</ul>;
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const band = confidence >= 0.85 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
  return <span className="confidence-badge" aria-label={`AI confidence ${band} ${Math.round(confidence * 100)} percent`} data-confidence={band} data-tone={band === 'high' ? 'ok' : band === 'medium' ? 'warning' : 'critical'}><span aria-hidden="true">●</span> {band.toUpperCase()} {Math.round(confidence * 100)}%</span>;
}

export function AssignmentChip({ assigneeId, status = 'open', priority = 'medium' }: { assigneeId: string; status?: string; priority?: RiskLevel }) {
  return <span className="assignment-chip" aria-label={`Assignment ${status} for ${assigneeId}`} data-status={status} data-risk={priority}><span aria-hidden="true">◆</span> {assigneeId} · {status}</span>;
}

export function ActiveParticipants({ participants }: { participants: string[] }) {
  return <ul className="active-participants" aria-label="Active participants">{participants.map((participant) => <li key={participant}><span aria-hidden="true">●</span> {participant}</li>)}</ul>;
}

export function MentionNotification({ actorId, targetArtifactId }: { actorId: string; targetArtifactId: string }) {
  return <p className="mention-notification" role="status" aria-label={`Mention notification for ${actorId}`} data-tone="info">@{actorId} mentioned on <code>{targetArtifactId}</code></p>;
}

export function ActivityFeed({ items, label = 'Collaboration activity feed' }: { items: CollaborationActivityItem[]; label?: string }) {
  if (items.length === 0) return <p role="status" aria-label={`${label} empty`}>No collaboration activity recorded for this artifact.</p>;
  return <ol className="activity-feed" aria-label={label}>{items.map((item) => <li key={item.id} data-tone={item.tone ?? 'info'}><time>{item.occurredAt}</time> <strong>{item.kind}</strong> by {item.actorId}: {item.summary}<p>Audit {(item.auditRefs ?? []).join(', ') || 'pending'}; events {(item.eventRefs ?? []).join(', ') || 'pending'}.</p></li>)}</ol>;
}

export function DecisionLog({ decisions }: { decisions: Array<{ id: string; decision: string; actorId: string; rationale: string; auditRefs: string[] }> }) {
  return <section aria-label="Decision log">{decisions.length ? decisions.map((decision) => <article key={decision.id}><strong>{decision.decision}</strong><p>{decision.rationale}</p><small>Recorded by {decision.actorId}; audit {decision.auditRefs.join(', ') || 'pending'}.</small></article>) : <p role="status">No decision records attached.</p>}</section>;
}

export function EvidencePacketViewer({ evidenceRefs, auditRefs = [] }: { evidenceRefs: string[]; auditRefs?: string[] }) {
  return <section aria-label="Evidence packet viewer"><h3>Evidence packet</h3><EvidenceList items={evidenceRefs} label="Evidence packet records" /><p>Audit refs: {auditRefs.join(', ') || 'pending audit link'}.</p></section>;
}

export type CollaborationPanelProps = {
  routeScope?: string;
  title: string;
  targetArtifactId: string;
  targetArtifactType: string;
  tenantId: string;
  racetrackId: string;
  workflowRef?: string;
  workflowId?: string;
  approvalRef?: string;
  approvalId?: string;
  auditRefs?: string[];
  twinRefs?: string[];
  digitalTwinRef?: string;
  evidenceRefs?: string[];
  eventRefs?: string[];
  participants?: string[];
  activity?: CollaborationActivityItem[];
  activityItems?: Array<{ id: string; actor: string; message: string; at: string; tone?: NexusTone; auditRefs?: string[]; eventRefs?: string[] }>;
  variant?: 'activity-feed' | 'approval-discussion' | 'incident-room' | 'evidence-review' | (string & {});
  mock?: boolean;
};

export function CollaborationPanel({ routeScope = 'workspace', title, targetArtifactId, targetArtifactType, tenantId, racetrackId, workflowRef, workflowId, approvalRef, approvalId, auditRefs = [], twinRefs = [], digitalTwinRef, evidenceRefs = [], eventRefs = [], participants = [], activity, activityItems = [], variant = 'activity-feed', mock = false }: CollaborationPanelProps) {
  const activities = activityItems.length ? activityItems : activity?.map((item) => ({ id: item.id, actor: item.actorId, message: item.summary, at: item.occurredAt, tone: item.tone, auditRefs: item.auditRefs, eventRefs: item.eventRefs })) ?? [
    { id: `${targetArtifactId}-opened`, actor: 'workspace-system', message: `Route-scoped collaboration opened for ${targetArtifactType}.`, at: 'route-local', tone: 'info' as const },
  ];
  const resolvedWorkflowRef = workflowRef ?? workflowId;
  const resolvedApprovalRef = approvalRef ?? approvalId;
  const resolvedTwinRefs = digitalTwinRef ? Array.from(new Set([digitalTwinRef, ...twinRefs])) : twinRefs;
  const resolvedParticipants = participants.length ? participants : Array.from(new Set(activities.map((item) => item.actor)));
  return (
    <section
      className="collaboration-panel"
      aria-label={`${title} collaboration panel`}
      data-collaboration-panel="route-scoped"
      data-collaboration-scope={routeScope}
      data-collaboration-variant={variant}
      data-target-artifact-id={targetArtifactId}
      data-target-artifact-type={targetArtifactType}
      data-tenant-id={tenantId}
      data-racetrack-id={racetrackId}
      data-workflow-ref={resolvedWorkflowRef ?? ''}
      data-approval-ref={resolvedApprovalRef ?? ''}
      data-audit-refs={auditRefs.join(',')}
      data-twin-refs={resolvedTwinRefs.join(',')}
      data-event-refs={eventRefs.join(',')}
      data-mock={mock || undefined}
    >
      <h3>{title}</h3>
      <p>Route-scoped collaboration panel attached to <code>{targetArtifactType}:{targetArtifactId}</code>. Collaboration is artifact-bound, audited, and event-linked; this is not a global chat island.</p>
      <MetricStrip items={[
        { label: 'Tenant', value: tenantId, detail: `Racetrack ${racetrackId}` },
        { label: 'Workflow', value: resolvedWorkflowRef ?? 'not linked', detail: 'Workflow or human task reference' },
        { label: 'Approval', value: resolvedApprovalRef ?? 'not linked', detail: 'Approval request reference' },
        { label: 'Audit/Twin refs', value: `${auditRefs.length}/${resolvedTwinRefs.length}`, detail: `Audits ${auditRefs.join(', ') || 'none'}; twins ${resolvedTwinRefs.join(', ') || 'none'}` },
      ]} />
      <ActiveParticipants participants={resolvedParticipants} />
      <section aria-label={`Activity feed for ${targetArtifactId}`} data-activity-feed="artifact-scoped">
        <h4>{variant === 'incident-room' ? 'Incident room activity' : variant === 'approval-discussion' ? 'Approval discussion' : 'Activity feed'}</h4>
        <EventTimeline events={activities.map((item) => ({ time: item.at, label: `${item.actor}: ${item.message}`, tone: item.tone ?? 'info' }))} label={`${targetArtifactId} collaboration activity`} />
      </section>
      <section aria-label={`Evidence packet viewer for ${targetArtifactId}`} data-evidence-packet-viewer={evidenceRefs.length ? 'attached' : 'empty'}>
        <h4>Evidence Packet Viewer</h4>
        <EvidenceList items={evidenceRefs} empty="No evidence packet records linked to this collaboration target." label={`Evidence packet records for ${targetArtifactId}`} />
      </section>
      <p>Workflow {resolvedWorkflowRef ?? 'not linked'}; approval {resolvedApprovalRef ?? 'not linked'}; Digital Twin {resolvedTwinRefs[0] ?? 'not linked'}.</p>
      <button type="button" disabled aria-disabled="true" aria-label={`Add comment to ${targetArtifactId}`}>Add comment through collaboration API</button>
    </section>
  );
}

export function GovernedActionButton({ label, approvalApi, reason }: { label: string; approvalApi: string; reason: string }) {
  return <article aria-label={label}>
    <button type="button" disabled aria-disabled="true" aria-label={label}>{label}</button>
    <p>{reason}</p>
    <code>{approvalApi}</code>
  </article>;
}

export function ConfirmationDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <section role="dialog" aria-modal="true" aria-label={title} data-tone={danger ? 'critical' : 'info'}>
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" onClick={onCancel}>{cancelLabel}</button>
      <button type="button" onClick={onConfirm} data-variant={danger ? 'danger' : 'primary'}>{confirmLabel}</button>
    </section>
  );
}

export function SafetyCriticalButton({ approvalsSatisfied, backendLive, authenticated, children, reason = 'Disabled until authenticated live backend returns a valid approval token.', describedById = 'safety-lock-reason', ariaLabel, onClick }: SafetyCriticalButtonProps) {
  const disabled = !(approvalsSatisfied && backendLive && authenticated);
  return (
    <>
      <button type="button" className="safety-critical-button" disabled={disabled} aria-disabled={disabled} aria-describedby={disabled ? describedById : undefined} aria-label={ariaLabel} data-variant="safety-critical" onClick={disabled ? undefined : onClick}>{children}</button>
      {disabled && <small id={describedById} role="status">{reason}</small>}
    </>
  );
}

export function SafetyCriticalActionButton(props: SafetyCriticalButtonProps) {
  return SafetyCriticalButton(props);
}

export function DetailDrawer({ label, title, summary, children, open = false, elementKey }: { label: string; title?: string; summary: ReactNode; children: ReactNode; open?: boolean; elementKey?: string }) {
  return (
    <details key={elementKey} className="detail-drawer" aria-label={label} open={open}>
      <summary>{summary}</summary>
      <section aria-label={`${label} details`}>
        {title && <h3>{title}</h3>}
        {children}
      </section>
    </details>
  );
}

export function SplitPane({ label = 'Split pane', primary, secondary, children, orientation = 'horizontal', reverse = false, mock = false }: { label?: string; primary?: ReactNode; secondary?: ReactNode; children?: ReactNode; orientation?: 'horizontal' | 'vertical'; reverse?: boolean; mock?: boolean }) {
  return (
    <section className="split-pane" aria-label={label} data-orientation={orientation} data-reverse={reverse || undefined} data-mock={mock || undefined}>
      <div className="split-pane__primary" aria-label={`${label} primary pane`}>{primary ?? children}</div>
      {secondary && <aside className="split-pane__secondary" aria-label={`${label} secondary pane`}>{secondary}</aside>}
    </section>
  );
}

export function CommandPanel({ title, label, description, actions, children, mock = false, id }: { title: string; label?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; mock?: boolean; id?: string }) {
  return (
    <section id={id} className="command-panel" aria-label={label ?? title} data-mock={mock || undefined}>
      <header>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {actions && <div aria-label={`${title} actions`}>{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function AuditEventRow({ event }: { event: AuditEventDto }) {
  return (
    <NexusCard title={event.type} detail={`${event.actorDetails?.displayName ?? event.actor} -> ${event.subjectId ?? 'unknown subject'} at ${event.timestamp}`} tone={event.severity}>
      <p>Correlation <code>{event.correlationId ?? 'unlinked'}</code>; previous <code>{event.previousHash}</code></p>
      <code>{event.hash}</code>
    </NexusCard>
  );
}

export function AssetHealthIndicator({ status, label }: { status: string; label: string }) {
  return <StatusIndicator label={`${label}: ${status}`} tone={toneForStatus(status)} />;
}

export function DigitalTwinRelationshipCard({ source, relationship, target }: { source: string; relationship: string; target: string }) {
  return <NexusCard title={source} detail={relationship}><strong>{target}</strong></NexusCard>;
}

const trackMapPanelLayers: Array<{ label: string; layers: GeospatialLayerDto[] }> = [
  { label: 'Sectors', layers: ['sector'] },
  { label: 'Gate and rail', layers: ['gate', 'starting-gate', 'rail'] },
  { label: 'Barns stalls facilities', layers: ['barn', 'stall', 'facility'] },
  { label: 'Cameras emergency incidents', layers: ['camera', 'emergency', 'emergency-resource', 'incident'] },
  { label: 'Maintenance measurements', layers: ['maintenance', 'measurement', 'surface-measurement', 'telemetry'] },
  { label: 'Surface heatmap', layers: ['surface-heatmap'] },
];

type TrackMapPanelContext = 'track-configuration' | 'digital-twin' | 'starting-gate';
const trackMapPanelContextLabels: Record<TrackMapPanelContext, string> = {
  'track-configuration': 'Track Configuration reusable map panel',
  'digital-twin': 'Digital Twin reusable map panel',
  'starting-gate': 'Starting Gate reusable map panel',
};

export function TrackMapPanel({ map, routeContext = 'track-configuration' }: { map: TrackMapDto; routeContext?: TrackMapPanelContext }) {
  const features = map.geospatial?.features ?? [];
  const visibleOverlays = map.geospatial?.overlays.filter((overlay) => overlay.visible).length ?? 0;
  const overlayTotal = map.geospatial?.overlays.length ?? 0;
  return <section aria-label="Track map panel" data-map-implementation="shared-track-map-panel" data-map-source="/api/v1/track-configuration/map" data-route-context={routeContext}><h2>Track Map</h2>
    <p aria-label={trackMapPanelContextLabels[routeContext]}>Reusable connected panel sourced from the Track Configuration map DTO; no standalone map state or live actuator control is mounted.</p>
    <MetricStrip items={[
      { label: 'Distance', value: `${map.distanceMeters}m`, detail: `Gate ${map.startingGate.sectorId} @ ${map.startingGate.metersFromStart}m` },
      { label: 'Sectors', value: String(map.sectors.length), detail: map.sectors.map((sector) => sector.condition).join(', ') },
      { label: 'Layers', value: `${visibleOverlays}/${overlayTotal}`, detail: 'Visible geospatial overlays' },
      { label: 'Features', value: String(features.length), detail: map.mock ? 'Approved mock map feed' : 'Live map feed' },
    ]} />
    <section aria-label="Track map panel sector coverage">{map.sectors.map((sector) => <StatusCard key={sector.id} title={sector.name} status={sector.condition} detail={`${sector.startMeters}-${sector.endMeters} meters`} />)}</section>
    <section aria-label="Track map panel layer coverage">{trackMapPanelLayers.map((group) => <article key={group.label} tabIndex={0} aria-label={`${group.label} compact map coverage`}><strong>{group.label}</strong><p>{features.filter((feature) => group.layers.includes(feature.layer)).length} features</p></article>)}</section>
    <ActionRail actions={[
      { id: 'map-gate-move', label: 'Draft gate move', detail: 'Creates a track-configuration draft only; no gate state changes locally.', approvalApi: 'POST /api/v1/track-configuration/draft-requests', locked: true },
      { id: 'map-rail-surface', label: 'Draft rail or surface work', detail: 'Rail positions and maintenance zones require human approval and audit evidence.', approvalApi: 'POST /api/v1/track-configuration/draft-requests', locked: true },
    ]} />
  </section>;
}

export function WorkspacePanel({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return <NexusCard title={title} eyebrow={eyebrow}>{children}</NexusCard>;
}

export function MetricStrip({ items }: { items: Array<{ label: string; value: string; detail: string }> }) {
  return <dl className="metric-strip" aria-label="Metric strip">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd><strong>{item.value}</strong><small>{item.detail}</small></dd></div>)}</dl>;
}

export function NotificationList({ items }: { items: Array<{ id: string; title: string; detail: string; tone: 'ok' | 'info' | 'warning' | 'critical' }> }) {
  return <ul className="notification-list" aria-label="Notification list">{items.map((item) => <li key={item.id} data-tone={item.tone}><strong>{item.title}</strong><p>{item.detail}</p></li>)}</ul>;
}

export function ActionRail({ actions }: { actions: Array<{ id: string; label: string; detail: string; approvalApi: string; locked: boolean }> }) {
  return <div className="action-rail" aria-label="Approval-safe action rail">{actions.map((action) => <NexusCard key={action.id} title={action.label}><SafetyCriticalButton approvalsSatisfied={!action.locked} backendLive={!action.locked} authenticated={!action.locked} describedById={`approval-lock-${action.id}`} ariaLabel={action.label} reason="Approval-gated action: use the backend approval API before any operational execution.">{action.label}</SafetyCriticalButton><p>{action.detail}</p><code>{action.approvalApi}</code></NexusCard>)}</div>;
}
