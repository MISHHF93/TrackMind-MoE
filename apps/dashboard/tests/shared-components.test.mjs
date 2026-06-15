import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { ActivityFeed, ApprovalChip, AssignmentChip, CollaborationPanel, CommandBar, CommandPanel, ConfidenceBadge, ConfirmationDialog, DataTable, DataTableShell, DecisionLog, DetailDrawer, EmptyState as NexusEmptyState, ErrorState as NexusErrorState, EventTimeline, EvidenceList, EvidencePanel, EvidencePacketViewer, GovernedActionButton, KpiTile, LoadingSkeleton, MockDataBanner, PageHeader, RecommendationCard, RecordSourceLabel, RiskBadge, SafetyCriticalActionButton, SafetyCriticalButton, SplitPane, StatusIndicator, WorkspaceFrame, WorkspaceLayout } from '../dist/components/nexus-ui.js';
import { buildStreamingDataSnapshot, StreamingDataStatus } from '../dist/components/streaming-data.js';
import { DataState, EmptyState, ErrorState, LoadingState, SafetyButton } from '../dist/components/states.js';

const h = React.createElement;

function render(node) {
  if (!React.isValidElement(node) || typeof node.type !== 'function') return node;
  return render(node.type(node.props));
}

function textFrom(node) {
  const rendered = render(node);
  if (rendered == null || typeof rendered === 'boolean') return '';
  if (typeof rendered === 'string' || typeof rendered === 'number') return String(rendered);
  if (Array.isArray(rendered)) return rendered.map(textFrom).join(' ');
  if (React.isValidElement(rendered)) return textFrom(rendered.props.children);
  return '';
}

function collect(node, predicate, out = []) {
  const rendered = render(node);
  if (rendered == null || typeof rendered === 'boolean') return out;
  if (Array.isArray(rendered)) { rendered.forEach((child) => collect(child, predicate, out)); return out; }
  if (React.isValidElement(rendered)) {
    if (predicate(rendered)) out.push(rendered);
    collect(rendered.props.children, predicate, out);
  }
  return out;
}

test('shared state components render loading empty error and ready mock banners', () => {
  assert.match(textFrom(h(LoadingState)), /Loading live operational data/);
  assert.match(textFrom(h(EmptyState, { mock: true })), /mock adapter active/);
  assert.match(textFrom(h(ErrorState, { message: 'feed down', mock: false })), /Unable to load live data: feed down/);
  assert.match(textFrom(h(DataState, { state: { status: 'ready', data: 'ready-data', mock: true } }, (data) => h('strong', null, data))), /Mock data active.*ready-data/);
  assert.equal(collect(h(LoadingState), (node) => node.props?.['data-state'] === 'loading')[0]?.props.className.includes('state-message'), true);
  assert.equal(collect(h(EmptyState, { mock: true }), (node) => node.props?.['data-state'] === 'empty')[0]?.props['data-adapter'], 'mock');
  assert.equal(collect(h(ErrorState, { message: 'feed down', mock: false }), (node) => node.props?.['data-state'] === 'error')[0]?.props['data-adapter'], 'live');
});

test('data table and mock banner expose consistent empty and mock affordances', () => {
  assert.equal(MockDataBanner({ active: false }), null);
  assert.match(textFrom(h(MockDataBanner, { active: true, source: 'approved mock adapter' })), /Mock data active via approved mock adapter/);
  assert.equal(collect(h(MockDataBanner, { active: true }), (node) => node.props?.className === 'mock-data-banner')[0]?.props['data-tone'], 'warning');
  assert.match(textFrom(h(DataTable, { label: 'Empty table', rows: [], getRowKey: (row) => row.id, columns: [{ key: 'id', header: 'ID', render: (row) => row.id }] })), /No records available/);
});

test('shared visual primitives expose tokenized risk and status tones', () => {
  const risk = collect(h(RiskBadge, { level: 'critical' }), (node) => node.props?.className === 'risk-badge')[0];
  assert.equal(risk.props['data-risk'], 'critical');
  assert.equal(risk.props['data-tone'], 'critical');

  const status = collect(h(StatusIndicator, { label: 'Degraded', tone: 'warning' }), (node) => node.props?.className === 'status-indicator')[0];
  assert.equal(status.props['data-tone'], 'warning');

  const approval = collect(h(ApprovalChip, { status: 'pending-approval' }), (node) => node.props?.className === 'approval-chip')[0];
  assert.equal(approval.props['data-status'], 'pending-approval');

  const kpi = collect(h(KpiTile, { label: 'Readiness', value: '87', trend: 'watch', tone: 'info' }), (node) => node.props?.className === 'kpi-tile')[0];
  assert.equal(kpi.props['data-tone'], 'info');

  const confidence = collect(h(ConfidenceBadge, { confidence: 0.91 }), (node) => node.props?.className === 'confidence-badge')[0];
  assert.equal(confidence.props['data-confidence'], 'high');

  const assignment = collect(h(AssignmentChip, { assigneeId: 'track-superintendent', status: 'open', priority: 'high' }), (node) => node.props?.className === 'assignment-chip')[0];
  assert.equal(assignment.props['data-risk'], 'high');
});

test('governance shared components label mock records, evidence, and disabled actions', () => {
  assert.match(textFrom(h(RecordSourceLabel, { mock: true, label: 'approval request' })), /approval request approved mock adapter/);
  assert.match(textFrom(h(RecordSourceLabel, { mock: false, label: 'ledger record' })), /ledger record live backend source/);
  assert.match(textFrom(h(EvidenceList, { items: ['ev-1', 'audit-1'], label: 'Governance evidence records' })), /ev-1.*audit-1/);

  const action = h(GovernedActionButton, { label: 'Request protected AI action approval', approvalApi: 'POST /api/v1/approvals/controlled-actions', reason: 'Backend approval required.' });
  const button = collect(action, (node) => node.type === 'button')[0];
  assert.equal(button.props.disabled, true);
  assert.equal(button.props['aria-disabled'], 'true');
  assert.match(textFrom(action), /POST \/api\/v1\/approvals\/controlled-actions/);

  assert.match(textFrom(h(EvidencePanel, { title: 'Gate move evidence', evidenceRefs: ['gps-fix'], auditRefs: ['audit-1'], eventRefs: ['event-1'], mock: true })), /Gate move evidence.*gps-fix.*audit-1.*event-1/);
  assert.match(textFrom(h(RecommendationCard, { id: 'rec-1', title: 'Surface recommendation', recommendation: 'Review far turn moisture.', confidence: 0.82, riskLevel: 'high', evidenceRefs: ['surface-reading'], approvalRequired: true })), /Surface recommendation.*HIGH.*82\s*%.*pending-approval.*Autonomous execution allowed: false.*surface-reading/);
});

test('command-center shell components expose accessible layout labels', () => {
  const header = h(PageHeader, { title: 'Operations', label: 'Operations page header', description: 'Read-only command surface.' }, h('button', { type: 'button', 'aria-label': 'Refresh operations' }, 'Refresh'));
  assert.equal(collect(header, (node) => node.type === 'header')[0].props['aria-label'], 'Operations page header');
  assert.match(textFrom(header), /Operations/);

  const layout = h(WorkspaceLayout, { label: 'Workspace layout', skipLink: { href: '#content', label: 'Skip to content' }, sidebar: h('aside', { 'aria-label': 'Sidebar' }, 'Navigation') }, h('section', { id: 'content' }, 'Main content'));
  assert.equal(collect(layout, (node) => node.type === 'main')[0].props['aria-label'], 'Workspace layout');
  assert.match(textFrom(layout), /Skip to content/);

  const panel = h(CommandPanel, { id: 'command-palette', title: 'Command Palette', label: 'Quick-access command palette' }, h('p', null, 'Filter role-aware commands.'));
  assert.equal(collect(panel, (node) => node.props?.id === 'command-palette').length, 1);
  assert.ok(collect(panel, (node) => node.props?.['aria-label'] === 'Quick-access command palette').length >= 1);
});

test('command bar and split pane expose responsive command-center regions', () => {
  const bar = h(CommandBar, {
    label: 'Global command bar',
    search: h('form', { role: 'search', 'aria-label': 'Global search' }, h('input', { 'aria-label': 'Search Nexus' })),
    actions: h('nav', { 'aria-label': 'Shell command actions' }, h('button', { type: 'button', 'aria-label': 'Notification button' }, 'Notifications')),
    breadcrumbs: h('nav', { 'aria-label': 'Breadcrumb' }, 'Nexus / Operations'),
    status: h('p', { 'aria-label': 'Race-day status indicator' }, 'Race day watch'),
    mock: true,
    degraded: true,
  });
  const commandRegion = collect(bar, (node) => node.props?.['aria-label'] === 'Global command bar')[0];
  assert.equal(commandRegion.props['data-mock'], true);
  assert.equal(commandRegion.props['data-state'], 'degraded');
  assert.match(textFrom(bar), /Notifications/);

  const split = h(SplitPane, { label: 'Approval audit split', primary: h('p', null, 'Approval queue'), secondary: h('p', null, 'Audit detail'), orientation: 'vertical' });
  const splitRegion = collect(split, (node) => node.props?.['aria-label'] === 'Approval audit split')[0];
  assert.equal(splitRegion.props['data-orientation'], 'vertical');
  assert.ok(collect(split, (node) => node.props?.['aria-label'] === 'Approval audit split secondary pane').length === 1);
  assert.match(textFrom(split), /Approval queue.*Audit detail/);
});

test('workspace frame exposes standard landmarks and responsive metadata', () => {
  const frame = h(WorkspaceFrame, {
    title: 'Operations Standard',
    label: 'Operations Standard workspace',
    eyebrow: 'Operations',
    description: 'Shared frame test.',
    summaryItems: [{ label: 'Readiness', value: '87', detail: 'watch' }],
    evidenceDetailPanel: h(EvidenceList, { items: ['evidence-1', 'audit-1'], label: 'Operations evidence records' }),
    eventTimeline: h(EventTimeline, { label: 'Operations event timeline', events: [{ time: '2026-06-14T00:00:00.000Z', label: 'approval.requested', tone: 'warning' }] }),
    approvalContext: h(SafetyCriticalActionButton, { approvalsSatisfied: false, backendLive: false, authenticated: true, ariaLabel: 'Execute approved operation' }, 'Execute approved operation'),
    auditContext: h('p', null, 'Ledger hash audit-1 previous hash audit-0'),
    digitalTwinContext: h('p', null, 'Gate Twin queued sync'),
    mock: true,
    degraded: true,
  }, h('section', { 'aria-label': 'Operations primary content' }, 'Primary command content'));

  const shell = collect(frame, (node) => node.props?.['data-workspace-standard'] === 'v1')[0];
  assert.equal(shell.props['aria-label'], 'Operations Standard workspace');
  assert.equal(shell.props['data-responsive-structure'], 'split-pane-to-single-column');
  assert.equal(shell.props['data-mock'], true);
  assert.equal(shell.props['data-state'], 'degraded');

  const sections = collect(frame, (node) => node.props?.['data-workspace-section']).map((node) => node.props['data-workspace-section']);
  assert.deepEqual(sections, ['operational-summary', 'primary-work-area', 'evidence-detail-panel', 'event-timeline', 'approval-context', 'audit-context', 'digital-twin-context']);
  assert.ok(collect(frame, (node) => node.props?.['aria-label'] === 'Operations Standard page header').length >= 1);
  assert.ok(collect(frame, (node) => node.props?.['aria-label'] === 'Operations Standard primary work area').length >= 1);
  assert.ok(collect(frame, (node) => node.props?.['aria-label'] === 'Operations Standard evidence/detail side panel').length >= 1);
  assert.match(textFrom(frame), /Primary command content.*evidence-1.*approval.requested.*valid approval token.*Ledger hash.*Gate Twin queued sync/);
});

test('data table shell covers loading error empty and mock states', () => {
  const columns = [{ key: 'id', header: 'ID', render: (row) => row.id }];
  assert.match(textFrom(h(LoadingSkeleton, { label: 'Loading table rows' })), /Loading table rows/);
  assert.match(textFrom(h(NexusEmptyState, { message: 'No safety events', mock: true })), /No safety events .*mock adapter active/);
  assert.match(textFrom(h(NexusErrorState, { message: 'Audit feed unavailable', mock: true })), /Unable to load mock data: Audit feed unavailable/);
  assert.match(textFrom(h(DataTableShell, { label: 'Approvals', loading: true, rows: [], getRowKey: (row) => row.id, columns })), /Approvals loading/);
  assert.match(textFrom(h(DataTableShell, { label: 'Approvals', error: 'Approval feed down', rows: [], getRowKey: (row) => row.id, columns })), /Approval feed down/);
  assert.match(textFrom(h(DataTableShell, { label: 'Approvals', mock: true, rows: [], getRowKey: (row) => row.id, columns, emptyMessage: 'No approvals queued.' })), /Mock data active.*No approvals queued/);
});

test('detail drawer preserves accessible summaries without mutating state', () => {
  const drawer = h(DetailDrawer, { label: 'Asset detail drawer gate-1', summary: 'Gate 1' }, h('p', null, 'Read-only asset detail.'));
  const details = collect(drawer, (node) => node.type === 'details')[0];
  assert.equal(details.props['aria-label'], 'Asset detail drawer gate-1');
  assert.match(textFrom(drawer), /Read-only asset detail/);
});

test('confirmation dialog only renders when open and wires actions', () => {
  let confirmed = false;
  let cancelled = false;
  assert.equal(ConfirmationDialog({ open: false, title: 'Confirm gate release', message: 'Locked', onConfirm: () => undefined, onCancel: () => undefined }), null);
  const dialog = h(ConfirmationDialog, { open: true, title: 'Confirm gate release', message: 'Release remains approval-gated.', danger: true, onConfirm: () => { confirmed = true; }, onCancel: () => { cancelled = true; } });
  const buttons = collect(dialog, (node) => node.type === 'button');
  assert.equal(collect(dialog, (node) => node.props?.role === 'dialog').length, 1);
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.equal(cancelled, true);
  assert.equal(confirmed, true);
});

test('safety buttons describe disabled critical controls', () => {
  const locked = h(SafetyCriticalActionButton, { approvalsSatisfied: false, backendLive: false, authenticated: true }, 'Release starting gate');
  const lockedButtons = collect(locked, (node) => node.type === 'button');
  assert.equal(lockedButtons[0].props.disabled, true);
  assert.equal(lockedButtons[0].props['aria-describedby'], 'safety-lock-reason');
  assert.match(textFrom(locked), /valid approval token/);

  const enabled = h(SafetyCriticalActionButton, { approvalsSatisfied: true, backendLive: true, authenticated: true }, 'Release starting gate');
  assert.equal(collect(enabled, (node) => node.type === 'button')[0].props.disabled, false);
  let called = false;
  const backendRouted = collect(h(SafetyCriticalButton, { approvalsSatisfied: true, backendLive: true, authenticated: true, onClick: () => { called = true; } }, 'Backend-routed action'), (node) => node.type === 'button')[0];
  backendRouted.props.onClick();
  assert.equal(called, true);
  assert.match(textFrom(h(SafetyButton, { disabled: true, reason: 'Approval required' }, 'Draft move')), /Approval required/);
});

test('collaboration primitives stay attached to operational artifacts', () => {
  const activity = [
    { id: 'act-1', kind: 'comment', actorId: 'ops-lead', summary: 'Requested evidence before gate move.', occurredAt: '2026-06-14T22:30:00.000Z', tone: 'info', auditRefs: ['audit-1'], eventRefs: ['event-1'] },
    { id: 'act-2', kind: 'decision', actorId: 'steward', summary: 'Hold until superintendent approval.', occurredAt: '2026-06-14T22:35:00.000Z', tone: 'warning', auditRefs: ['audit-2'], eventRefs: ['event-2'] },
  ];
  assert.match(textFrom(h(ActivityFeed, { items: activity })), /Requested evidence.*Hold until superintendent approval/);
  assert.match(textFrom(h(DecisionLog, { decisions: [{ id: 'decision-1', decision: 'Hold gate move', actorId: 'steward', rationale: 'Surface readings pending.', auditRefs: ['audit-2'] }] })), /Hold gate move.*Surface readings pending/);
  assert.match(textFrom(h(EvidencePacketViewer, { evidenceRefs: ['surface-reading', 'camera-still'], auditRefs: ['audit-3'] })), /surface-reading.*camera-still.*audit-3/);

  const panel = h(CollaborationPanel, {
    title: 'Gate move discussion',
    tenantId: 'woodbine',
    racetrackId: 'TRACK-WO',
    targetArtifactId: 'GATE-MOVE-001',
    targetArtifactType: 'GateMoveRequest',
    participants: ['ops-lead', 'steward'],
    activity,
    evidenceRefs: ['surface-reading'],
    auditRefs: ['audit-1'],
    eventRefs: ['event-1'],
    approvalId: 'approval-1',
    workflowId: 'workflow-1',
    digitalTwinRef: 'twin:gate:main',
    mock: true,
  });
  const root = collect(panel, (node) => node.props?.className === 'collaboration-panel')[0];
  assert.equal(root.props['data-target-artifact-id'], 'GATE-MOVE-001');
  assert.equal(root.props['data-tenant-id'], 'woodbine');
  assert.match(textFrom(panel), /artifact-bound, audited, and event-linked/);
  assert.match(textFrom(panel), /approval-1.*workflow-1.*twin:gate:main/);
  const buttons = collect(panel, (node) => node.type === 'button');
  assert.equal(buttons[0].props.disabled, true);
  assert.equal(buttons[0].props['aria-disabled'], 'true');
});

test('streaming data status renders mock stale degraded labels and reconnect affordance without browser APIs', () => {
  const snapshot = buildStreamingDataSnapshot({
    source: {
      url: '/mock/events/stream',
      mode: 'mock',
      transport: 'server-sent-events',
      label: 'Visible mock operational event stream',
      mock: true,
      safeForStateMutation: false,
      reconnectStrategy: { initialDelayMs: 1000, maxDelayMs: 30000, backoff: 'exponential' },
      fallbackReason: 'Approved mock stream used for tests.',
    },
    observedAt: '2026-06-13T00:10:30.000Z',
    events: [{ id: 'evt-stream-test', timestamp: '2026-06-13T00:00:00.000Z', type: 'surface.reading.updated', domain: 'surface', summary: 'Far Turn moisture changed.', severity: 'warning', source: 'event-stream' }],
    health: {
      generatedAt: '2026-06-13T00:10:30.000Z',
      overallStatus: 'degraded',
      services: [],
      eventBus: { status: 'degraded', publishedEvents: 1, deadLetters: 0, schemas: 1, eventsPerMinute: 1, throughputCapacity: 100, backpressure: false },
      audit: { status: 'healthy', validLedger: true, records: 1, criticalRecords: 0 },
      approvalEngine: { status: 'healthy', pending: 0, approved: 0, rejected: 0, escalated: 0, expired: 0 },
      aiGovernance: { status: 'healthy', activeAgents: 0, pendingReviews: 0, blockedActions: 0, driftBreaches: 0 },
      digitalTwin: { status: 'healthy', totalTwins: 0, healthy: 0, degraded: 0, critical: 0, queuedSync: 0 },
      workflows: { status: 'healthy', active: 0, completed: 0, failed: 0 },
      apiLatency: { p50Ms: 1, p95Ms: 1, budgetMs: 250, status: 'healthy' },
      frontend: { status: 'degraded', reportedErrors: 1, degradedMode: true },
      telemetrySchema: { version: 'platform-observability.v1', requiredSignals: ['log'], consistent: true },
      signals: [],
    },
  });
  const tree = h(StreamingDataStatus, { snapshot, label: 'Live event streaming' });
  assert.equal(snapshot.connection, 'mock');
  assert.equal(snapshot.stale, true);
  assert.equal(snapshot.degraded, true);
  assert.match(textFrom(tree), /MOCK STREAM ACTIVE/);
  assert.match(textFrom(tree), /Stale data warning/);
  assert.match(textFrom(tree), /Degraded service banner/);
  assert.match(textFrom(tree), /Reconnect stream/);
  assert.match(textFrom(tree), /Far Turn moisture changed/);
  assert.equal(collect(tree, (node) => node.type === 'button' && node.props?.['aria-label'] === 'Reconnect streaming data').length, 1);
});
