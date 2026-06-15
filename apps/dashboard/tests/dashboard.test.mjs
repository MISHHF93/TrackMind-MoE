import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createMockClient, createLiveClient, createNexusClient, NexusApiError } from '../dist/api/client.js';
import { calculateRequiredGatePosition, loadCommandCenter, isSafetyCriticalEnabled, requestRaceStartApproval, requestRaceOfficeApproval, requestStartingGateMoveDraft, requestTrackConfigurationDraft, commandCenterApprovalActions } from '../dist/App.js';
import { activeNavItem, apiHubDeepLinks, canonicalPathForRoute, canonicalRouteMap, groupHasActiveItem, groupedVisibleNavItems, isKnownRoutePath, isNavItemActive, legacyRouteAliases, navItems, navLinkState, navSections, routeAliasForPath, routeBadgesForItem, visibleNavItems } from '../dist/shell/navigation.js';
import { domainScreens } from '../dist/shell/domains.js';

test('routing exposes all command-center domain screens with role visibility', () => { const admin = visibleNavItems(['admin']).map((i)=>i.id); assert.ok(admin.includes('operations')); assert.ok(admin.includes('ai-governance')); assert.ok(admin.includes('api-hub')); assert.ok(admin.includes('track-configuration')); assert.ok(admin.includes('workforce')); assert.ok(admin.includes('platform-health')); assert.ok(admin.includes('safety')); const auditor = visibleNavItems(['read-only-auditor']).map((i)=>i.id); assert.ok(auditor.includes('operations')); assert.ok(auditor.includes('workforce')); assert.ok(auditor.includes('api-hub')); assert.ok(auditor.includes('platform-health')); assert.ok(auditor.includes('safety')); assert.equal(auditor.includes('starting-gate'), false); assert.equal(auditor.includes('security'), false); assert.equal(auditor.includes('emergency'), false); });

test('safety-critical button remains disabled without live approval token', () => { assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:false, backendMode:'live' }), false); assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:true, backendMode:'mock' }), false); assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:true, backendMode:'live' }), true); });

test('approval-required flow calls backend adapter instead of mutating local state', async () => { const result = await requestRaceStartApproval(createMockClient(), 'starter-1', 'race-7'); assert.equal(result.accepted, true); assert.equal(result.eventType, 'approval.requested'); assert.equal(result.audited, true); assert.equal(result.mock, true); });

test('mock approvals and audit events expose harmonized UX metadata', async () => {
  const client = createMockClient();
  const approvals = await client.listApprovals();
  const auditEvents = await client.listAuditEvents();
  assert.ok(approvals.some((approval) => approval.queue === 'race-day' && approval.correlationId === 'corr-race-7-start'));
  assert.ok(approvals.some((approval) => approval.queue === 'surface' && approval.affectedAssets.includes('asset:sensor-44')));
  assert.ok(approvals.every((approval) => approval.history.length >= 1 && approval.exportFields.includes('correlationId')));
  assert.ok(auditEvents.every((event) => event.correlationId && event.actorDetails && event.exportFields.includes('hash')));
  assert.equal(auditEvents[1].previousHash, auditEvents[0].hash);
});

test('mock adapter is clearly marked and live adapter uses configured backend paths', async () => { const mockClient = createMockClient(); const mockData = await loadCommandCenter(mockClient); assert.equal(mockData.mode, 'mock'); assert.equal(mockData.trackMap.mock, true); assert.equal(mockClient.eventStream().mock, true); assert.equal(mockClient.eventStream().safeForStateMutation, false); const live = createLiveClient('https://api.example.test/api/v1'); assert.equal(live.mode, 'live'); assert.equal(live.eventStreamUrl(), 'https://api.example.test/api/v1/events/stream'); assert.equal(live.eventStream().transport, 'server-sent-events'); assert.equal(live.eventStream().safeForStateMutation, false); });

test('mock and live adapters expose approval-safe SSE stream descriptors', () => {
  const mockStream = createMockClient().eventStream();
  assert.equal(mockStream.url, '/mock/events/stream');
  assert.equal(mockStream.mode, 'mock');
  assert.equal(mockStream.transport, 'server-sent-events');
  assert.equal(mockStream.safeForStateMutation, false);
  assert.match(mockStream.fallbackReason, /Approved mock stream/);

  const liveStream = createLiveClient('https://api.example.test/api/v1').eventStream();
  assert.equal(liveStream.url, 'https://api.example.test/api/v1/events/stream');
  assert.equal(liveStream.mode, 'live');
  assert.equal(liveStream.mock, false);
  assert.equal(liveStream.safeForStateMutation, false);
  assert.deepEqual(liveStream.reconnectStrategy, { initialDelayMs: 1000, maxDelayMs: 30000, backoff: 'exponential' });
});

test('live adapter attaches auth, tenant, racetrack, and request headers from one client context', async () => {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init = {}) => {
    request = { url, init };
    return { ok: true, json: async () => ({ generatedAt: '2026-06-14T00:00:00.000Z', overallStatus: 'healthy' }) };
  };
  try {
    await createLiveClient('https://api.example.test/api/v1', {
      authToken: 'test-token',
      tenantId: 'tenant-a',
      racetrackId: 'track-a',
      requestId: 'req-dashboard-1',
    }).getPlatformHealth();
    assert.equal(request.url, 'https://api.example.test/api/v1/platform/health');
    assert.equal(request.init.headers.authorization, 'Bearer test-token');
    assert.equal(request.init.headers['x-trackmind-tenant-id'], 'tenant-a');
    assert.equal(request.init.headers['x-trackmind-racetrack-id'], 'track-a');
    assert.equal(request.init.headers['x-trackmind-request-id'], 'req-dashboard-1');
  } finally {
    globalThis.fetch = original;
  }
});

test('API error handling surfaces live adapter failures', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok:false, status:503, statusText:'Unavailable' });
  try {
    await assert.rejects(() => createLiveClient('https://api.example.test').listApprovals(), /503 Unavailable/);
  } finally {
    globalThis.fetch = original;
  }
});

test('adapter consistency keeps live and mock draft paths approval-gated', async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url, init) => {
    urls.push({ url, init });
    return { ok: true, json: async () => ({ accepted: true, approvalId: 'approval-draft', eventType: 'approval.requested', audited: true, message: 'queued', mock: false }) };
  };
  try {
    const live = createLiveClient('https://api.example.test/api/v1');
    const input = { action: 'starting-gate-move', target: 'gate-1', reason: 'test', actor: 'starter-1', evidence: [], payload: {} };
    await live.createDraftRequest(input);
    await live.createTrackConfigurationDraft(input);
    assert.deepEqual(urls.map((entry) => entry.url), [
      'https://api.example.test/api/v1/approvals/draft-requests',
      'https://api.example.test/api/v1/track-configuration/draft-requests',
    ]);
    assert.ok(urls.every((entry) => entry.init.method === 'POST'));
    const payloads = urls.map((entry) => JSON.parse(entry.init.body));
    assert.ok(payloads.every((payload) => payload.tenantId === 'trackmind' && payload.racetrackId === 'main-track'));
    assert.ok(payloads.every((payload) => payload.actorType === 'human' && payload.roles.length > 0));
    const mock = createMockClient();
    const mockDraft = await mock.createTrackConfigurationDraft(input);
    assert.equal(mockDraft.eventType, 'track.configuration.change.requested');
    assert.equal(mockDraft.mock, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('typed API errors retain status and path metadata', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok:false, status:418, statusText:'Teapot', json: async () => ({ error: { code: 'teapot', message: 'short and stout', details: ['typed'] } }) });
  try {
    await assert.rejects(async () => createLiveClient('https://api.example.test/api/v1').getPlatformHealth(), (error) => {
      assert.ok(error instanceof NexusApiError);
      assert.equal(error.status, 418);
      assert.equal(error.path, '/platform/health');
      assert.equal(error.code, 'teapot');
      assert.deepEqual(error.details, ['typed']);
      assert.match(error.message, /short and stout/);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('createNexusClient is the single mock/live adapter selector', () => {
  assert.equal(createNexusClient(true, 'https://api.example.test/api/v1').mode, 'live');
  assert.equal(createNexusClient(false).mode, 'mock');
});

test('live transport errors retain request path, method, and url metadata', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('socket closed');
  };
  try {
    await assert.rejects(async () => createLiveClient('https://api.example.test/api/v1').listApprovals(), (error) => {
      assert.ok(error instanceof NexusApiError);
      assert.equal(error.status, 0);
      assert.equal(error.path, '/approvals/requests');
      assert.equal(error.method, 'GET');
      assert.equal(error.url, 'https://api.example.test/api/v1/approvals/requests');
      assert.deepEqual(error.details, ['socket closed']);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('optional live backend gaps use explicit mock-labeled fallbacks', async () => {
  const client = Object.assign(createMockClient(), {
    mode: 'live',
    getTUSStandardization: async () => { throw new NexusApiError(404, 'NotFound', '/tus/standardization', 'not_found'); },
    getFacilitiesMaintenance: async () => { throw new NexusApiError(404, 'NotFound', '/facilities-maintenance/workspace', 'not_found'); },
    getRacingDataApiHub: async () => { throw new NexusApiError(404, 'NotFound', '/racing-data', 'not_found'); },
    getCollaborationWorkspace: async () => { throw new NexusApiError(501, 'NotImplemented', '/collaboration/workspace', 'not_implemented'); },
  });
  const data = await loadCommandCenter(client);
  assert.equal(data.mode, 'live');
  assert.equal(data.tusStandardization.mock, true);
  assert.equal(data.tusStandardization.tenantId, 'approved-mock-fallback');
  assert.equal(data.facilitiesMaintenance.mock, true);
  assert.equal(data.facilitiesMaintenance.observability.serviceId, 'approved-mock-facilities-fallback');
  assert.deepEqual(Object.keys(data.facilitiesMaintenance.integrations), ['assetRegistry','digitalTwinRuntime','approvals','workflows','audit','eventBus','observability']);
  assert.equal(data.racingDataApiHub.mock, true);
  assert.equal(data.collaborationWorkspace.mock, true);
  assert.equal(data.collaborationWorkspace.safety.mutatesOperationalState, false);
});

test('domain screen registry covers every Nexus command-center module with routes and event readiness', () => {
  assert.equal(domainScreens.length, 22);
  for (const screen of domainScreens) {
    assert.ok(screen.route.startsWith('/'));
    assert.ok(screen.owner.length > 0);
    assert.ok(screen.eventStreams.length > 0);
  }
  assert.ok(domainScreens.find((screen) => screen.id === 'starting-gate').stateChangingActions.every((action) => action.includes('approval') || action.includes('controlled')));
  assert.ok(domainScreens.some((screen) => screen.id === 'track-configuration' && screen.liveApi === '/track-configuration/map'));
  assert.ok(domainScreens.some((screen) => screen.id === 'starting-gate' && screen.liveApi === '/starting-gate/position'));
  assert.ok(domainScreens.some((screen) => screen.id === 'workforce' && screen.liveApi === '/workforce-operations/workspace'));
  assert.ok(domainScreens.some((screen) => screen.id === 'safety' && screen.route === '/safety' && !screen.liveApi));
  assert.ok(domainScreens.some((screen) => screen.id === 'api-hub' && screen.route === '/api-hub' && screen.liveApi === '/racing-data'));
  assert.ok(domainScreens.some((screen) => screen.id === 'platform-health' && screen.liveApi === '/platform/health'));
});

test('navigation groups, domain routes, and live API contracts stay harmonized from one nav registry', () => {
  assert.deepEqual(navSections.map((section) => section.label), ['Operations','Equine','Safety','Facilities','Governance','Intelligence','Executive','Platform Admin']);
  assert.equal(new Set(navItems.map((item) => item.id)).size, navItems.length);
  assert.equal(new Set(domainScreens.map((screen) => screen.id)).size, domainScreens.length);
  for (const screen of domainScreens) {
    const item = navItems.find((candidate) => candidate.id === screen.id);
    assert.ok(item, `missing nav item for ${screen.id}`);
    assert.equal(screen.route, item.path);
  }
  const livePaths = [
    '/approvals/requests','/audit/events','/track-configuration/map','/operations/command-center','/assets','/starting-gate/position','/digital-twin/state','/race-operations/race-office','/surface-intelligence/workspace','/equine-intelligence/horses/{horseId}','/barn-operations/workspace','/facilities-maintenance/workspace','/workforce-operations/workspace','/stewarding/inquiries','/security-operations/workspace','/emergency-operations/workspace','/compliance/control-library','/ai-governance/workspace','/racing-data','/platform/health',
  ];
  for (const screen of domainScreens) {
    assert.ok(!screen.liveApi || livePaths.includes(screen.liveApi), `unaligned live API for ${screen.id}: ${screen.liveApi}`);
  }
});

test('live controlled actions POST to the approval-aware backend path with JSON body', async () => {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ accepted: true, approvalId: 'approval-1', eventType: 'approval.requested', audited: true, message: 'queued', mock: false }) };
  };
  try {
    const result = await createLiveClient('https://api.example.test/api/v1').requestControlledAction({ action: 'race-start', target: 'race-7', reason: 'test', actor: 'starter-1' });
    assert.equal(result.audited, true);
    assert.equal(request.url, 'https://api.example.test/api/v1/approvals/controlled-actions');
    assert.equal(request.init.method, 'POST');
    assert.equal(JSON.parse(request.init.body).action, 'race-start');
  } finally {
    globalThis.fetch = original;
  }
});
import React from 'react';
import { App, CommandCenter } from '../dist/App.js';
import { DataState } from '../dist/components/states.js';
import { DataFreshness, SafetyCriticalActionButton, TrackMapPanel } from '../dist/components/nexus-ui.js';
import { buildStreamingDataSnapshot, StreamingDataStatus } from '../dist/components/streaming-data.js';
import { StartingGateControl, hasApprovedGateMoveRequest } from '../dist/domains/starting-gate/StartingGateControl.js';
import { SurfaceIntelligenceWorkspace } from '../dist/domains/surface/SurfaceIntelligenceWorkspace.js';
import { TrackMap } from '../dist/domains/track-map/TrackMap.js';
import { breadcrumbForPath, filterCommandPalette, selectTenant, serviceBanner } from '../dist/shell/experience.js';

const now = '2026-06-13T00:00:00.000Z';

function textFrom(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFrom).join(' ');
  if (React.isValidElement(node)) {
    if (typeof node.type === 'function') return textFrom(node.type(node.props));
    return textFrom(node.props.children);
  }
  return '';
}

function collect(node, predicate, out = []) {
  if (node == null || typeof node === 'boolean') return out;
  if (Array.isArray(node)) { node.forEach((child) => collect(child, predicate, out)); return out; }
  if (React.isValidElement(node)) {
    if (predicate(node)) out.push(node);
    if (typeof node.type === 'function') collect(node.type(node.props), predicate, out);
    collect(node.props.children, predicate, out);
  }
  return out;
}

test('route-scoped collaboration panels attach to concrete workspace artifacts', async () => {
  const data = await loadCommandCenter(createMockClient());
  const routeExpectations = [
    { path: '/starting-gate', scope: 'starting-gate', type: 'gate-move-request', variant: 'approval-discussion' },
    { path: '/surface', scope: 'surface', type: 'surface-recommendation', variant: 'approval-discussion' },
    { path: '/stewards', scope: 'stewards', type: 'steward-case', variant: 'evidence-review' },
    { path: '/security', scope: 'security', type: 'security-incident', variant: 'incident-room' },
    { path: '/approvals', scope: 'approvals', type: 'approval-request', variant: 'approval-discussion' },
    { path: '/ai-governance', scope: 'ai-governance', type: 'ai-recommendation', variant: 'approval-discussion' },
    { path: '/compliance', scope: 'compliance', type: 'compliance-control', variant: 'evidence-review' },
    { path: '/api-hub', scope: 'api-hub', type: 'api-hub-ingestion-job', variant: 'evidence-review' },
  ];

  for (const expected of routeExpectations) {
    const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: expected.path });
    const panels = collect(tree, (node) => node.props?.['data-collaboration-panel'] === 'route-scoped');
    const panel = panels.find((node) => node.props['data-collaboration-scope'] === expected.scope && node.props['data-target-artifact-type'] === expected.type);
    assert.ok(panel, `missing ${expected.type} collaboration panel`);
    assert.equal(panel.props['data-collaboration-variant'], expected.variant);
    assert.ok(panel.props['data-target-artifact-id'], `${expected.type} missing target artifact id`);
    assert.ok(panel.props['data-tenant-id'], `${expected.type} missing tenant id`);
    assert.ok(panel.props['data-racetrack-id'], `${expected.type} missing racetrack id`);
    assert.equal(panel.props['data-collaboration-scope'], expected.scope);
  }
});

test('collaboration panels render approval discussion, incident room, and evidence packet viewer semantics', async () => {
  const data = await loadCommandCenter(createMockClient());
  const approvalTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/approvals' });
  const securityTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/security' });
  const complianceTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/compliance' });

  const approvalPanel = collect(approvalTree, (node) => node.props?.['data-target-artifact-type'] === 'approval-request')[0];
  assert.ok(approvalPanel);
  assert.equal(approvalPanel.props['data-collaboration-variant'], 'approval-discussion');
  assert.ok(approvalPanel.props['data-approval-ref']);
  assert.ok(approvalPanel.props['data-audit-refs']);
  assert.match(textFrom(approvalPanel), /Approval discussion/);

  const incidentPanel = collect(securityTree, (node) => node.props?.['data-target-artifact-type'] === 'security-incident')[0];
  assert.ok(incidentPanel);
  assert.equal(incidentPanel.props['data-collaboration-variant'], 'incident-room');
  assert.ok(incidentPanel.props['data-audit-refs']);
  assert.match(textFrom(incidentPanel), /Incident room activity/);

  const evidenceViewer = collect(complianceTree, (node) => node.props?.['data-evidence-packet-viewer'] === 'attached')[0];
  assert.ok(evidenceViewer);
  assert.match(textFrom(evidenceViewer), /Evidence Packet Viewer/);
});

test('collaboration is route-local and does not create a global chat island', async () => {
  const data = await loadCommandCenter(createMockClient());
  const operationsTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const startingGateTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/starting-gate' });
  const operationsPanels = collect(operationsTree, (node) => node.props?.['data-collaboration-panel']);
  const startingGatePanels = collect(startingGateTree, (node) => node.props?.['data-collaboration-panel'] === 'route-scoped');

  assert.equal(operationsPanels.length, 0);
  assert.ok(startingGatePanels.length > 0);
  assert.ok(startingGatePanels.every((panel) => panel.props['data-collaboration-scope'] === 'starting-gate'));
  assert.doesNotMatch(textFrom(operationsTree), /Global chat/i);
  assert.match(textFrom(startingGateTree), /not a global chat island/i);
});

test('app shell renders persistent layout, command bar, breadcrumbs, tenant selector, notifications, and palette', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], path: '/operations', paletteQuery: 'gate' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('Persistent sidebar'));
  assert.ok(labels.includes('Top command bar'));
  assert.ok(labels.includes('Global search'));
  assert.ok(labels.includes('Shell command actions'));
  assert.ok(labels.includes('Command palette entry point'));
  assert.ok(labels.includes('Notification button'));
  assert.ok(labels.includes('Breadcrumb'));
  assert.ok(labels.includes('Mobile navigation'));
  assert.ok(labels.includes('Tenant racetrack selector'));
  assert.ok(labels.includes('Shell tenant context'));
  assert.ok(labels.includes('Notification center'));
  assert.ok(labels.includes('Approvals shortcut'));
  assert.ok(labels.includes('Emergency banner zone'));
  assert.ok(labels.includes('Quick-access command palette'));
  assert.ok(labels.includes('Executive KPI strip'));
  assert.ok(labels.includes('Responsive content area'));
  assert.ok(labels.includes('User menu'));
  assert.match(textFrom(tree), /Nexus .* Operations Command/);
  assert.match(textFrom(tree), /race-7 watch/);
});

test('unauthenticated routes keep the Nexus shell and do not restore the old one-page UI', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: false, path: '/operations', paletteQuery: 'gate' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const shell = collect(tree, (node) => node.type === 'main' && String(node.props?.className ?? '').includes('nexus-shell'))[0];
  const activeFrame = collect(tree, (node) => node.props?.id === 'command-center-content')[0];

  assert.ok(shell);
  for (const required of ['Persistent sidebar', 'Top command bar', 'Global command bar', 'Tenant racetrack selector', 'Race-day status indicator', 'Breadcrumb', 'Notification center', 'Approvals shortcut', 'Emergency banner zone', 'Quick-access command palette', 'User menu']) {
    assert.ok(labels.includes(required), `missing unauthenticated shell surface ${required}`);
  }
  assert.equal(activeFrame.props.className, 'route-content-frame');
  assert.equal(activeFrame.props['data-active-workspace'], 'login');
  assert.match(textFrom(activeFrame), /Sign In Required/);
  assert.doesNotMatch(textFrom(tree), /Unified Operations Command Center|Command-center workspace blueprint|Nexus operational workspace blueprint/);
});

test('app shell exposes collapsed sidebar and mobile drawer navigation semantics', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], path: '/workforce/shifts/today', navCollapsed: true, mobileNavOpen: true });
  const sidebar = collect(tree, (node) => node.props?.['aria-label'] === 'Persistent sidebar')[0];
  assert.equal(sidebar.props['data-collapsed'], true);
  assert.equal(sidebar.props['aria-expanded'], false);
  const primaryNav = collect(tree, (node) => node.props?.['aria-label'] === 'Primary navigation')[0];
  assert.equal(primaryNav.props['data-collapsed'], true);
  const mobileDrawer = collect(tree, (node) => node.props?.['aria-label'] === 'Mobile navigation drawer')[0];
  assert.equal(mobileDrawer.type, 'details');
  assert.equal(mobileDrawer.props.open, true);
  const mobileToggle = collect(tree, (node) => node.type === 'summary' && node.props?.['aria-label'] === 'Toggle mobile navigation')[0];
  assert.equal(mobileToggle.props['aria-expanded'], true);
  assert.equal(mobileToggle.props['aria-controls'], 'mobile-navigation-panel');
  const activeLinks = collect(tree, (node) => node.type === 'a' && node.props?.['aria-current'] === 'page');
  assert.equal(activeLinks.length, 2);
  assert.ok(activeLinks.every((link) => link.props.href === '/workforce'));
  assert.ok(activeLinks.every((link) => link.props['data-route-id'] === 'workforce'));
  assert.ok(activeLinks.every((link) => link.props['aria-label'] === 'Workforce navigation link'));
  assert.ok(activeLinks.every((link) => link.props.tabIndex === 0));
  assert.ok(activeLinks.every((link) => link.props['aria-keyshortcuts'] === 'ArrowDown ArrowUp Home End'));
  assert.ok(activeLinks.every((link) => typeof link.props.onKeyDown === 'function'));
  assert.ok(activeLinks.every((link) => link.props['data-badge-count'] >= 2));
  assert.match(textFrom(tree), /Nexus .* Facilities .* Workforce/);
});

test('navigation route badges expose readiness, approval, alert, and keyboard metadata', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], path: '/security', mobileNavOpen: true });
  const badges = collect(tree, (node) => node.props?.className === 'nav-route-badge').map((node) => ({ text: textFrom(node), tone: node.props['data-tone'], id: node.props['data-badge-id'] }));
  assert.ok(badges.some((badge) => badge.id === 'approvals:pending' && /Pending \d+/.test(badge.text)));
  assert.ok(badges.some((badge) => badge.id === 'security:alerts' && /Alerts \d+/.test(badge.text)));
  assert.ok(badges.some((badge) => badge.text === 'Ready' && badge.tone === 'success'));
  assert.ok(badges.some((badge) => badge.text === 'Live only' && badge.tone === 'warning'));

  const approvals = navItems.find((item) => item.id === 'approvals');
  assert.ok(approvals);
  const routeBadges = routeBadgesForItem(approvals, { approvals: [{ id: 'approvals:pending', label: 'Pending', value: 7, tone: 'warning' }] });
  assert.deepEqual(routeBadges.map((badge) => badge.id), ['approvals:pending', 'approvals:readiness', 'approvals:source']);
  assert.equal(routeBadges[0].value, 7);

  const navLinks = collect(tree, (node) => node.type === 'a' && node.props?.['data-route-id']);
  assert.ok(navLinks.length > 0);
  assert.ok(navLinks.every((link) => link.props['aria-describedby']?.startsWith('nav-badges-')));
  const first = { focusCalled: false, focus() { this.focusCalled = true; }, closest() { return group; } };
  const second = { focusCalled: false, focus() { this.focusCalled = true; }, closest() { return group; } };
  const group = { querySelectorAll: () => [first, second] };
  let prevented = false;
  navLinks[0].props.onKeyDown({ key: 'ArrowDown', currentTarget: first, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(second.focusCalled, true);
});

test('command center renders consistent data freshness labels', async () => {
  const data = await loadCommandCenter(createMockClient());
  const routeTrees = ['/operations', '/platform-health', '/api-hub', '/surface', '/digital-twin', '/starting-gate'].map((path) => CommandCenter({ data, roles: ['admin'], authenticated: true, path }));
  const freshness = routeTrees.flatMap((tree) => collect(tree, (node) => node.type?.name === 'DataFreshness').map((node) => node.props));
  for (const label of ['Command center','Operations command center','Platform health','API Hub metadata','Surface intelligence','Race-day readiness','Digital Twin state','Starting gate and distance']) {
    assert.ok(freshness.some((item) => item.label === label && item.mode === 'mock'), `missing ${label}`);
  }
});

test('api hub dashboard renders role-aware source labels and deep subworkspace links', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['read-only-auditor'], authenticated: true, path: '/api-hub/license-policy', paletteQuery: 'payload' });
  const content = collect(tree, (node) => node.props?.id === 'command-center-content')[0];
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.equal(content.props['data-active-workspace'], 'api-hub');
  assert.equal(content.props['data-route'], '/api-hub/license-policy');
  assert.match(textFrom(tree), /Nexus .* Platform Admin .* Racing Data API Hub .* License Policy/);
  assert.match(textFrom(tree), /API Hub Dashboard/);
  assert.match(textFrom(tree), /Mock Racing Data API Hub contract metadata approved mock adapter/);
  assert.match(textFrom(tree), /MOCK DATA: approved shared contract metadata/);
  for (const label of ['API Hub Dashboard workspace','API Hub provider status','API Hub ingestion pipeline','API Hub license risk KPIs','API Hub data quality','API Hub entity resolution queue','API Hub lineage health','API Hub export readiness']) {
    assert.ok(labels.includes(label), `missing ${label}`);
  }
  assert.match(textFrom(tree), /External Sources -> Provider Connectors -> Raw Landing -> Validation -> Normalization -> Canonical Racing Data Model -> Universal Artifact Registry -> Digital Twin Runtime -> Event Backbone -> Feature Store \/ ML Training Store -> Apps\/Dashboards\/AI\/Reports/);
  assert.match(textFrom(tree), /No scraping/);
  assert.match(textFrom(tree), /No public redistribution without license/);
  assert.match(textFrom(tree), /No autonomous operational execution/);
  assert.match(textFrom(tree), /Official racing data providers/);
  assert.match(textFrom(tree), /Customer API packages/);

  const subworkspaceLinks = collect(tree, (node) => node.type === 'a' && apiHubDeepLinks.some((link) => link.path === node.props?.href));
  assert.equal(new Set(subworkspaceLinks.map((link) => link.props.href)).size, apiHubDeepLinks.length);
  assert.ok(subworkspaceLinks.some((link) => link.props.href === '/api-hub/raw-payload-review'));
  assert.ok(subworkspaceLinks.some((link) => link.props.href === '/api-hub/license-policy' && link.props['aria-current'] === 'page'));
});

test('api hub provider registry renders license and connection governance fields', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/providers' });
  const text = textFrom(tree);
  assert.match(text, /Provider Registry/);
  assert.match(text, /Approved Mock Racing Feed/);
  assert.match(text, /licenseStatus/);
  assert.match(text, /connectionType/);
  assert.match(text, /dataClasses/);
  assert.match(text, /commercialUseAllowed/);
  assert.match(text, /redistributionAllowed/);
  assert.match(text, /attributionRequired/);
  assert.match(text, /piiPresent/);
});

test('api hub ingestion jobs render status, payload, validation, normalization, event, and audit refs', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/ingestion-jobs' });
  const text = textFrom(tree);
  assert.match(text, /Ingestion Jobs/);
  assert.match(text, /ingest-race-card-2026-06-13/);
  assert.match(text, /raw-race-card-1/);
  assert.match(text, /validationStatus.*valid/);
  assert.match(text, /normalizationStatus.*normalized/);
  assert.match(text, /event:racing-data\.ingestion\.completed/);
  assert.match(text, /audit:racing-data-ingestion/);
});

test('api hub raw payload review preserves source hash format and license context', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/raw-payload-review' });
  const text = textFrom(tree);
  assert.match(text, /Raw Payload Review/);
  assert.match(text, /originalPayloadHash.*sha256:mock-raw-race-card-1-original/);
  assert.match(text, /sourceFormat.*json/);
  assert.match(text, /licenseContext.*license:approved-mock-racing-feed/);
  assert.match(text, /Original payload hash, source format, and license context are preserved before normalization/);
  assert.match(text, /no scraping path is provided/i);
});

test('api hub license warning labels render restricted-use labels', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/license-policy' });
  const text = textFrom(tree);
  assert.match(text, /License warning labels/);
  assert.match(text, /Commercial use blocked/);
  assert.match(text, /Redistribution blocked/);
  assert.match(text, /Attribution required/);
});

test('API Hub license center renders usage policy fields', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/license-policy' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const activePolicy = data.racingDataApiHub.policyCenter.find((policy) => policy.policyId === 'policy-official-racing-internal');
  assert.ok(activePolicy);
  assert.ok(labels.includes('API Hub License and Usage Policy Center'));
  assert.match(textFrom(tree), /Allowed uses:/);
  assert.match(textFrom(tree), /Restricted uses:/);
  assert.equal(activePolicy.retentionDays, 365);
  assert.equal(activePolicy.exportAllowed, true);
  assert.equal(activePolicy.redistributionAllowed, false);
  assert.equal(activePolicy.commercialUseAllowed, false);
  assert.equal(activePolicy.privacyClassification, 'confidential');
  assert.equal(activePolicy.modelTraining.allowed, true);
});

test('API Hub blocks public redistribution from provider license policy', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/data-lake-exports' });
  const manifest = data.racingDataApiHub.dataLakeExports.find((item) => item.manifestId === 'manifest-data-lake-official-results-public');
  assert.ok(manifest);
  assert.equal(manifest.exportAllowed, false);
  assert.equal(manifest.redistributionAllowed, false);
  assert.match(textFrom(tree), /Public redistribution blocked: redistributionAllowed=false for provider license/);
  assert.match(textFrom(tree), /Official results public redistribution package/);
});

test('API Hub blocks unlicensed model training exports', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/feature-exports' });
  const manifest = data.racingDataApiHub.featureStoreExports.find((item) => item.manifestId === 'manifest-feature-store-speed-figures-eval');
  const policy = data.racingDataApiHub.policyCenter.find((item) => item.policyId === 'policy-speed-figures-evaluation');
  assert.ok(manifest);
  assert.ok(policy);
  assert.equal(manifest.modelTrainingAllowed, false);
  assert.equal(policy.modelTraining.unlicensedBlocked, true);
  assert.match(textFrom(tree), /Speed figures evaluation training candidate/);
  assert.match(textFrom(tree), /Blocked unlicensed model training: evaluation license omits ai-training scope/);
});

test('API Hub renders feature store and data lake export manifests', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/feature-exports' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('API Hub Feature Store Exports'));
  assert.ok(labels.includes('API Hub Data Lake Exports'));
  assert.match(textFrom(tree), /manifest-feature-store-official-race-7/);
  assert.match(textFrom(tree), /feature-store:\/\/track-1\/race-7\/internal-advisory/);
  assert.match(textFrom(tree), /manifest-data-lake-official-results-public/);
  assert.match(textFrom(tree), /lakehouse:\/\/track-1\/public-results-package/);
  assert.match(textFrom(tree), /sha256:feature-store-official-race-7/);
});

test('API Hub export controls stay disabled until backend allows export', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/feature-exports' });
  const controls = collect(tree, (node) => node.props?.['data-api-hub-export-control']);
  assert.ok(controls.length >= 3);
  const buttons = collect(controls, (node) => node.type === 'button');
  assert.equal(buttons.length, controls.length);
  assert.ok(buttons.every((button) => button.props.disabled === true));
  assert.ok(buttons.every((button) => button.props['aria-disabled'] === true));
  assert.ok(buttons.every((button) => button.props['data-draft-only'] === true));
  assert.match(textFrom(tree), /Draft-only export disabled/);
});

test('api hub renders entity resolution, quality warnings, lineage labels, and disabled review controls', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/entity-resolution' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);

  for (const required of ['Entity Resolution Queue', 'Data Quality Center', 'Lineage Explorer', 'API Hub disabled review controls']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }

  assert.match(textFrom(tree), /horse:canonical:lifecycle-runner/);
  assert.match(textFrom(tree), /official-racing-provider:horse-1.*speed-figures-evaluation:LR-001/);
  assert.match(textFrom(tree), /matchConfidence.*91%/);
  assert.match(textFrom(tree), /reviewRequired.*true/);
  assert.match(textFrom(tree), /Low quality warning:.*canonical-envelope:race-7-entries.*score.*68.*severity.*warning/);
  assert.match(textFrom(tree), /License impact: public redistribution, commercial product use, and raw payload replay remain blocked/);
  assert.match(textFrom(tree), /Data quality impact: low quality warning requires entity-resolution review before feature\/export promotion/);
  assert.match(textFrom(tree), /RAW PAYLOAD -> NORMALIZED ARTIFACT -> REGISTRY -> TWIN\/EVENT\/AUDIT\/FEATURE\/EXPORT REFS/);
  assert.deepEqual(data.racingDataApiHub.lineage.paths?.[0], {
    lineageId: 'lineage-race-7-entries',
    rawPayloadRef: 'raw:payload-race-7-entries',
    normalizedArtifactRef: 'artifact:normalized-race-7-entries',
    registryRef: 'registry:canonical-race-7-entries',
    twinRefs: ['twin:race:race-7','twin:horse:horse-1'],
    eventRefs: ['event:racing-data-ingested','event:racing-data-normalized'],
    auditRefs: ['audit:racing-data-ingested','audit:racing-data-normalized'],
    featureRefs: ['feature://race-7/entries'],
    exportRefs: ['lake://race-7/results'],
    evidenceRefs: ['evidence:racing-data-provider','evidence:entity-resolution:horse-1'],
  });
  const disabledReviewButtons = collect(tree, (node) => node.type === 'button' && /entity resolution review|quality exception approval|feature export approval/i.test(String(node.props?.['aria-label'] ?? '')));
  assert.ok(disabledReviewButtons.length >= 3);
  assert.ok(disabledReviewButtons.every((button) => button.props.disabled === true));
  assert.ok(disabledReviewButtons.every((button) => String(button.props['aria-disabled']) === 'true'));
  assert.match(textFrom(tree), /Creates a resolution draft only; canonical horse registry is not mutated locally/);
  assert.match(textFrom(tree), /Quality exception approval is backend-owned and cannot mark official records valid in the frontend/);
});

test('streaming readiness renders stale, degraded, reconnect, and event timeline hooks', () => {
  const source = createLiveClient('https://api.example.test/api/v1').eventStream();
  const health = {
    overallStatus: 'healthy',
    eventBus: { status: 'healthy' },
    frontend: { status: 'healthy', degradedMode: false },
  };
  const staleSnapshot = buildStreamingDataSnapshot({
    source,
    health,
    observedAt: '2026-06-13T00:10:01.000Z',
    events: [{ id: 'evt-old', timestamp: '2026-06-13T00:00:00.000Z', type: 'surface.reading.updated', domain: 'surface', summary: 'Old event', severity: 'warning', source: 'event-stream' }],
  });
  assert.equal(staleSnapshot.connection, 'stale');
  assert.equal(staleSnapshot.stale, true);
  assert.equal(staleSnapshot.source.safeForStateMutation, false);

  const staleTree = StreamingDataStatus({ snapshot: staleSnapshot, label: 'Streaming readiness' });
  const staleSection = collect(staleTree, (node) => node.props?.['aria-label'] === 'Streaming readiness')[0];
  assert.equal(staleSection.props['data-connection-state'], 'stale');
  assert.equal(staleSection.props['data-stale'], true);
  assert.ok(collect(staleTree, (node) => node.props?.['aria-label'] === 'Streaming event timeline').length > 0);
  assert.match(textFrom(staleTree), /Stale data warning/);
  assert.match(textFrom(staleTree), /Reconnect stream/);
  assert.match(textFrom(staleTree), /Live TrackMind event stream/);
  assert.match(textFrom(staleTree), /backend-owned and approval-gated/);

  const degradedSnapshot = buildStreamingDataSnapshot({
    source,
    health: { ...health, overallStatus: 'degraded', eventBus: { status: 'degraded' }, frontend: { status: 'healthy', degradedMode: true } },
    observedAt: '2026-06-13T00:00:30.000Z',
    events: [{ id: 'evt-fresh', timestamp: '2026-06-13T00:00:00.000Z', type: 'platform.health.degraded', domain: 'platform', summary: 'Event bus degraded', severity: 'warning', source: 'event-stream' }],
  });
  assert.equal(degradedSnapshot.connection, 'degraded');
  assert.equal(degradedSnapshot.degraded, true);
  const degradedTree = StreamingDataStatus({ snapshot: degradedSnapshot });
  const degradedSection = collect(degradedTree, (node) => node.props?.['aria-label'] === 'Streaming operational updates')[0];
  assert.equal(degradedSection.props['data-degraded'], true);
  assert.match(textFrom(degradedTree), /Degraded service banner/);
});

test('live client fails safely when fetch is unavailable during SSR', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = undefined;
  try {
    await assert.rejects(() => createLiveClient('https://api.example.test/api/v1').listApprovals(), (error) => {
      assert.ok(error instanceof NexusApiError);
      assert.equal(error.status, 0);
      assert.equal(error.code, 'fetch_unavailable');
      assert.equal(error.path, '/approvals/requests');
      assert.match(error.message, /Live adapter requires a fetch-capable runtime/);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('app shell exposes keyboard shortcuts, focus targets, and safety descriptions', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], path: '/starting-gate', paletteQuery: 'gate' });
  const approvalTree = CommandCenter({ data, roles: ['admin'], path: '/approvals', paletteQuery: 'gate' });
  const labels = [
    ...collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']),
    ...collect(approvalTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']),
  ];
  assert.ok(labels.includes('Command center jump links'));
  assert.ok(labels.includes('Starting gate map overlays'));
  assert.ok(labels.includes('Approvals work area'));
  assert.ok(labels.includes('Command palette results'));
  const skipLinks = collect(tree, (node) => node.type === 'a' && node.props?.className === 'skip-link');
  assert.equal(skipLinks[0]?.props.href, '#command-center-content');
  const contentTarget = collect(tree, (node) => node.props?.id === 'command-center-content')[0];
  assert.equal(contentTarget?.props.className, 'route-content-frame');
  assert.equal(contentTarget?.props.tabIndex, -1);
  const lockReason = collect(tree, (node) => node.props?.id === 'safety-lock-reason')[0];
  assert.match(textFrom(lockReason), /Safety-critical controls are locked/);
  const paletteInput = collect(tree, (node) => node.type === 'input' && node.props?.['aria-label'] === 'Command palette query')[0];
  assert.equal(paletteInput?.props['aria-controls'], 'command-palette-results');
  const paletteEntry = collect(tree, (node) => node.type === 'a' && node.props?.['aria-label'] === 'Command palette entry point')[0];
  assert.equal(paletteEntry.props.href, '#command-palette');
  assert.equal(paletteEntry.props['aria-keyshortcuts'], 'Control+K');
  const notificationButton = collect(tree, (node) => node.type === 'button' && node.props?.['aria-label'] === 'Notification button')[0];
  assert.equal(notificationButton.props['aria-controls'], 'command-center-notifications');
  const notificationCenter = collect(tree, (node) => node.props?.id === 'command-center-notifications')[0];
  assert.equal(notificationCenter.props['aria-label'], 'Notification center');
});

test('track map exposes keyboard-readable sectors, overlays, and feature statuses', async () => {
  const map = await createMockClient().getTrackMap();
  const tree = TrackMap({ map, routeContext: 'track-configuration' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('Track Configuration map route context'));
  assert.ok(labels.includes('Track map keyboard shortcuts'));
  assert.ok(labels.includes('Keyboard navigable track sectors'));
  assert.ok(labels.includes('Map overlay legend'));
  assert.ok(labels.includes('Track map overlay coverage summary'));
  assert.ok(labels.includes('Required track map overlay categories'));
  assert.ok(labels.includes('Interactive track map layout'));
  assert.ok(labels.includes('Track map semantic canvas'));
  assert.ok(labels.includes('Track sector ring'));
  assert.ok(labels.includes('Map feature layer groups'));
  for (const required of ['Starting gate and rail positions', 'Barn stall and facility markers', 'Camera emergency incident markers', 'Maintenance and workforce zones', 'Sensor and surface measurement overlays', 'Surface heatmap overlays', 'Track map approval gates']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  for (const required of ['Track sectors overlay coverage', 'Starting gate position overlay coverage', 'Rail positions overlay coverage', 'Turf configuration overlay coverage', 'Barn overlay coverage', 'Stall overlay coverage', 'Facility overlay coverage', 'Camera overlay coverage', 'Sensor overlay coverage', 'Emergency resources overlay coverage', 'Incident overlay coverage', 'Maintenance zones overlay coverage', 'Surface overlays coverage']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.ok(map.geospatial.overlays.some((overlay) => overlay.layer === 'surface-heatmap' && overlay.visible));
  assert.ok(map.geospatial.features.some((feature) => feature.layer === 'surface-heatmap' && feature.properties.mockLabel === 'MOCK SAFE MAP OVERLAY'));
  const focusableCards = collect(tree, (node) => node.props?.className === 'focus-card' && node.props?.tabIndex === 0);
  assert.ok(focusableCards.length >= map.sectors.length + map.geospatial.features.length);
  assert.equal(collect(tree, (node) => node.props?.className === 'track-map-canvas').length, 1);
  assert.equal(collect(tree, (node) => node.props?.className === 'track-sector-ring').length, 1);
  assert.ok(collect(tree, (node) => node.props?.className === 'track-sector-pill').length >= map.sectors.length);
  assert.ok(collect(tree, (node) => String(node.props?.className ?? '').split(/\s+/).includes('track-map-marker')).length >= 1);
  const styledTrackMapNodes = collect(tree, (node) => node.props?.style);
  assert.ok(styledTrackMapNodes.length >= map.sectors.length + 1);
  assert.ok(styledTrackMapNodes.every((node) => Object.keys(node.props.style).every((key) => key.startsWith('--tm-'))));
  assert.equal(styledTrackMapNodes.some((node) => Object.hasOwn(node.props.style, '--tm-track-sector-count')), true);
  assert.equal(styledTrackMapNodes.some((node) => Object.hasOwn(node.props.style, '--tm-track-sector-height')), true);
  assert.equal(styledTrackMapNodes.some((node) => Object.hasOwn(node.props.style, '--tm-map-marker-left')), true);
  assert.equal(styledTrackMapNodes.some((node) => Object.hasOwn(node.props.style, 'left') || Object.hasOwn(node.props.style, 'top') || Object.hasOwn(node.props.style, 'opacity') || Object.hasOwn(node.props.style, 'minHeight') || Object.hasOwn(node.props.style, 'gridTemplateColumns')), false);
  const lockedMapButtons = collect(tree, (node) => node.type === 'button' && String(node.props?.['aria-label'] ?? '').startsWith('Request '));
  assert.ok(lockedMapButtons.length >= 4);
  assert.ok(lockedMapButtons.every((button) => button.props.disabled));
  assert.ok(lockedMapButtons.every((button) => button.props['aria-disabled'] === 'true'));
  assert.equal(collect(tree, (node) => node.props?.['data-map-implementation'] === 'shared-track-map').length, 1);
  assert.equal(collect(tree, (node) => node.props?.['data-map-source'] === '/api/v1/track-configuration/map').length, 1);
  assert.ok(collect(tree, (node) => node.props?.['data-no-live-actuator-controls'] === 'true').length >= 1);
  assert.match(textFrom(tree), /Keyboard map: use Tab/);
  assert.match(textFrom(tree), /Stall 12A/);
  assert.match(textFrom(tree), /Status:/);
  assert.match(textFrom(tree), /Far Turn heatmap cell/);
  assert.match(textFrom(tree), /no live actuator, gate, rail, surface, emergency dispatch, or Digital Twin patch control/i);
  assert.match(textFrom(tree), /SIMULATION PLACEHOLDER/);
});

test('track map panel summarizes harmonized layer coverage with locked draft actions', async () => {
  const map = await createMockClient().getTrackMap();
  const tree = TrackMapPanel({ map, routeContext: 'digital-twin' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('Digital Twin reusable map panel'));
  assert.ok(labels.includes('Track map panel layer coverage'));
  assert.match(textFrom(tree), /Barns stalls facilities/);
  assert.match(textFrom(tree), /no standalone map state or live actuator control/i);
  assert.equal(collect(tree, (node) => node.props?.['data-map-implementation'] === 'shared-track-map-panel').length, 1);
  assert.equal(collect(tree, (node) => node.props?.['data-map-source'] === '/api/v1/track-configuration/map').length, 1);
  const actionRails = collect(tree, (node) => node.type?.name === 'ActionRail');
  assert.equal(actionRails.length, 1);
  assert.equal(actionRails[0].props.actions.length, 2);
  assert.ok(actionRails[0].props.actions.every((action) => action.locked));
});

test('route-selected workspaces reuse the connected shared track map implementation', async () => {
  const data = await loadCommandCenter(createMockClient());
  const routeTrees = {
    trackConfiguration: CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/track-configuration' }),
    digitalTwin: CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/digital-twin' }),
    startingGate: CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/starting-gate' }),
    legacyTrackMap: CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/track-map' }),
  };

  const routeAssertions = [
    [routeTrees.trackConfiguration, 'track-configuration', 'Track Configuration map route context'],
    [routeTrees.digitalTwin, 'digital-twin', 'Digital Twin map route context'],
    [routeTrees.startingGate, 'starting-gate', 'Starting Gate map route context'],
    [routeTrees.legacyTrackMap, 'track-configuration', 'Track Configuration map route context'],
  ];

  for (const [tree, context, label] of routeAssertions) {
    const fullMaps = collect(tree, (node) => node.props?.['data-map-implementation'] === 'shared-track-map');
    const panels = collect(tree, (node) => node.props?.['data-map-implementation'] === 'shared-track-map-panel');
    const sources = [...fullMaps, ...panels].map((node) => node.props?.['data-map-source']);
    assert.equal(fullMaps.length, 1, `${context} should render one full shared map`);
    assert.equal(panels.length, 1, `${context} should render one reusable map panel`);
    assert.ok(fullMaps.every((node) => node.props?.['data-route-context'] === context), `${context} full map context mismatch`);
    assert.ok(panels.every((node) => node.props?.['data-route-context'] === context), `${context} panel context mismatch`);
    assert.ok(sources.every((source) => source === '/api/v1/track-configuration/map'), `${context} source mismatch`);
    assert.ok(collect(tree, (node) => node.props?.['aria-label'] === label).length >= 1, `missing ${label}`);
    assert.equal(textFrom(tree).includes('/api/v1/geospatial/map'), false);
  }

  assert.match(textFrom(routeTrees.legacyTrackMap), /Legacy Route Redirect/);
  assert.match(textFrom(routeTrees.legacyTrackMap), /\/track-map.*\/track-configuration/);
});

test('Approvals Center and Audit Ledger render queues, evidence, assets, history, correlations, and export views', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/approvals' });
  const auditTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/audit' });
  const labels = [
    ...collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']),
    ...collect(auditTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']),
  ];
  for (const required of ['Approvals work area', 'Approval queue filters', 'Pending approval queue summary', 'Approval queues', 'race-day approval queue', 'surface approval queue', 'Audit ledger work area', 'Audit ledger filters', 'Audit correlation and export panel', 'Immutable audit event rows', 'Audit correlation timeline']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.ok(labels.some((label) => label.startsWith('Evidence panel for mock-approval-race-start')));
  assert.ok(labels.some((label) => label.startsWith('Affected assets for mock-approval-surface-harrow')));
  assert.ok(labels.some((label) => label.startsWith('Approval history for mock-approval-race-start')));
  assert.ok(labels.some((label) => label.startsWith('Approval controls for mock-approval-race-start')));
  assert.ok(labels.some((label) => label.startsWith('Audit export view for mock-audit-1')));
  assert.match(textFrom(tree), /POST \/api\/v1\/approvals\/controlled-actions/);
  assert.match(textFrom(tree), /corr-race-7-start/);
  const recordLabels = [
    ...collect(tree, (node) => node.type?.name === 'RecordSourceLabel').map((node) => node.props.label),
    ...collect(auditTree, (node) => node.type?.name === 'RecordSourceLabel').map((node) => node.props.label),
  ];
  assert.ok(recordLabels.includes('approval request'));
  assert.ok(recordLabels.includes('ledger record'));
  assert.match(textFrom(auditTree), /Read-only hash-chained audit ledger/);
});

test('command center renders coordinated Nexus upgrade package coverage', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.nexusUpgrade.workspaces.length, 22);
  assert.ok(data.nexusUpgrade.complianceFrameworks.includes('ISO-25010'));
  assert.ok(data.nexusUpgrade.safetyControls.every((control) => control.autonomousExecutionAllowed === false));
  assert.equal(data.nexusUpgrade.tier7SaasModel.billingImplemented, false);
  assert.ok(data.nexusUpgrade.tier7SaasModel.tiers.some((tier) => tier.id === 'national' && tier.featureEntitlements.some((feature) => feature.domain === 'industry-analytics')));
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('TrackMind Nexus upgrade package'));
  assert.ok(labels.includes('Tier 7 SaaS model'));
  assert.ok(labels.includes('Starter tier entitlements'));
  assert.ok(labels.includes('National tier entitlements'));
  assert.ok(labels.includes('Nexus workspace coverage'));
  assert.ok(labels.includes('Nexus safety controls'));
  assert.match(textFrom(tree), /including Workforce and Platform Health hardening/);
  assert.match(textFrom(tree), /SaaS, Private Cloud, Managed Service, Franchise \/ Certified Track/);
  assert.match(textFrom(tree), /billing implemented\s+false\s*;\s*provisioning implemented\s+false/);
  assert.match(textFrom(tree), /Track Configuration/);
  assert.match(textFrom(tree), /Workforce/);
  assert.match(textFrom(tree), /Platform Health/);
});

test('live client exposes coordinated Nexus upgrade package endpoint', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => createMockClient().getNexusUpgradePackage?.() }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getNexusUpgradePackage?.();
    assert.equal(requestUrl, 'https://api.example.test/api/v1/platform/nexus-upgrade');
  } finally {
    globalThis.fetch = original;
  }
});

test('tenant switching helpers resolve known and fallback racetracks', () => {
  assert.equal(selectTenant('belmont').name, 'Belmont Park');
  assert.equal(selectTenant('missing').id, 'saratoga');
  assert.equal(selectTenant('belmont').saasBoundary.tenantId, 'tenant-belmont');
  assert.equal(selectTenant('belmont').saasBoundary.externalCertificationClaimed, false);
  assert.match(selectTenant('belmont').saasBoundary.federation.aggregationLabel, /no cross-tenant|tenant-only/i);
  assert.deepEqual(breadcrumbForPath('/starting-gate'), ['Nexus', 'Operations', 'Starting Gate Control']);
  assert.deepEqual(breadcrumbForPath('/workforce/shifts/today'), ['Nexus', 'Facilities', 'Workforce']);
  assert.deepEqual(breadcrumbForPath('/facilities'), ['Nexus', 'Facilities']);
  assert.deepEqual(breadcrumbForPath('/ai-governance/recommendations/rec-harrow-7'), ['Nexus', 'Governance', 'AI Governance']);
  assert.deepEqual(breadcrumbForPath('/api-hub/license-policy/terms'), ['Nexus', 'Platform Admin', 'Racing Data API Hub', 'License Policy']);
});

test('route-scoped tenant SaaS boundary panel renders tenant labels, scores, and no-leakage copy', async () => {
  const data = await loadCommandCenter(createMockClient());
  const routeScopes = [
    ['/platform-health', 'platform-health'],
    ['/executive', 'executive'],
    ['/api-hub', 'api-hub'],
  ];

  for (const [path, scope] of routeScopes) {
    const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, tenantId: 'belmont', path });
    const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
    const panels = collect(tree, (node) => node.props?.['aria-label'] === 'Tenant SaaS boundary panel');
    const text = textFrom(tree);

    assert.equal(panels.length, 1, `${path} should render one tenant boundary panel`);
    assert.equal(panels[0].props['data-route-scope'], scope);
    assert.equal(panels[0].props['data-tenant-id'], 'tenant-belmont');
    assert.equal(panels[0].props['data-racetrack-id'], 'belmont');
    assert.equal(panels[0].props['data-cross-tenant-aggregation'], false);
    assert.ok(labels.includes('Tenant-specific configuration'));
    assert.ok(labels.includes('Role tenant boundary metadata'));
    assert.ok(labels.includes('Certified Track candidate wording'));
    assert.ok(labels.includes('Cross-tenant aggregation boundary'));
    assert.ok(labels.includes('Tenant leakage guardrails'));
    assert.match(text, /Belmont Park/);
    assert.match(text, /tenant-belmont/);
    assert.match(text, /Safety Score/);
    assert.match(text, /Compliance Score/);
    assert.match(text, /Operational Score/);
    assert.match(text, /Accreditation Score/);
    assert.match(text, /TrackMind Certified Track candidate/);
    assert.match(text, /External certification claimed:\s+false/);
    assert.match(text, /no external certification/i);
    assert.match(text, /Explicit federation aggregate labels are required before any cross-tenant aggregation/i);
    assert.doesNotMatch(text, /externally certified by|regulator approved by|third-party certified by/i);
  }
});

test('active navigation helpers handle exact routes and deep links consistently', () => {
  const surface = navItems.find((item) => item.id === 'surface');
  assert.ok(surface);
  assert.equal(isNavItemActive('/surface/sectors/far-turn?panel=moisture#heatmap', surface), true);
  assert.equal(activeNavItem('/platform-health/services/api-gateway')?.id, 'platform-health');
  assert.equal(activeNavItem('/api-hub/providers/provider-1')?.id, 'api-hub');
  assert.equal(activeNavItem('/safety/security-posture')?.id, 'safety');
  assert.equal(activeNavItem('/workforce-operations/shifts/today')?.id, 'workforce');
  assert.equal(isNavItemActive('/surface-risk', surface), false);
  assert.equal(canonicalPathForRoute('/command-center'), '/operations');
  assert.equal(canonicalPathForRoute('/safety-center/readiness'), '/safety/readiness');
  assert.equal(canonicalPathForRoute('/racing-data-api-hub/providers'), '/api-hub/providers');
  const deprecatedLegacyDashboard = routeAliasForPath('/legacy-one-page-dashboard');
  assert.equal(deprecatedLegacyDashboard?.status, 'deprecated');
  assert.ok(deprecatedLegacyDashboard);
  assert.equal('to' in deprecatedLegacyDashboard, false);
  assert.equal(canonicalPathForRoute('/legacy-one-page-dashboard'), '/legacy-one-page-dashboard');
  assert.equal(isKnownRoutePath('/safety'), true);
  assert.equal(isKnownRoutePath('/security'), true);
  assert.equal(isKnownRoutePath('/emergency'), true);
  assert.equal(isKnownRoutePath('/api-hub/raw-payload-review'), true);
  assert.equal(isKnownRoutePath('/legacy-one-page-dashboard'), false);
  assert.equal(isKnownRoutePath('/unknown-workspace'), false);
  assert.ok(legacyRouteAliases.some((alias) => alias.from === '/workforce-operations' && alias.to === '/workforce'));
  assert.ok(legacyRouteAliases.some((alias) => alias.from === '/safety-center' && alias.to === '/safety'));
  assert.ok(legacyRouteAliases.some((alias) => alias.from === '/racing-data-api-hub' && alias.to === '/api-hub'));
  assert.equal(navLinkState('/surface/sectors/far-turn', surface).ariaCurrent, 'page');
  assert.equal(navLinkState('/surface-risk', surface).ariaCurrent, undefined);
});

test('canonical route registry covers every required Nexus shell path', () => {
  const requiredRoutes = [
    ['operations', 'Operations Command', '/operations'],
    ['race-office', 'Race Office', '/race-office'],
    ['track-configuration', 'Track Configuration', '/track-configuration'],
    ['starting-gate', 'Starting Gate Control', '/starting-gate'],
    ['surface', 'Surface Intelligence', '/surface'],
    ['equine', 'Equine Intelligence', '/equine'],
    ['barns', 'Barn Operations', '/barns'],
    ['stewards', 'Steward Center', '/stewards'],
    ['safety', 'Safety Center', '/safety'],
    ['security', 'Security', '/security'],
    ['emergency', 'Emergency Ops', '/emergency'],
    ['assets', 'Asset Registry', '/assets'],
    ['digital-twin', 'Digital Twin View', '/digital-twin'],
    ['facilities', 'Facilities', '/facilities'],
    ['workforce', 'Workforce', '/workforce'],
    ['approvals', 'Approvals', '/approvals'],
    ['audit', 'Audit Ledger', '/audit'],
    ['compliance', 'Compliance', '/compliance'],
    ['ai-governance', 'AI Governance', '/ai-governance'],
    ['executive', 'Executive Center', '/executive'],
    ['platform-health', 'Platform Health', '/platform-health'],
    ['api-hub', 'Racing Data API Hub', '/api-hub'],
  ];
  const requiredPaths = requiredRoutes.map(([, , path]) => path);
  const canonicalById = new Map(canonicalRouteMap.map((entry) => [entry.id, entry]));
  const navPaths = new Set(navItems.map((item) => item.path));
  const screenPaths = new Set(domainScreens.map((screen) => screen.route));

  assert.equal(canonicalRouteMap.length, 22);
  assert.equal(canonicalById.size, 22);
  for (const [id, label, path] of requiredRoutes) {
    const entry = canonicalById.get(id);
    assert.ok(entry, `missing canonical route ${id}`);
    assert.equal(entry.label, label);
    assert.equal(entry.path, path);
  }
  for (const path of requiredPaths) {
    assert.ok(navPaths.has(path), `missing nav path ${path}`);
    assert.ok(screenPaths.has(path), `missing domain screen path ${path}`);
    assert.equal(isKnownRoutePath(path), true, `${path} should be known`);
    assert.equal(canonicalPathForRoute(path), path, `${path} should already be canonical`);
  }
  assert.deepEqual(canonicalById.get('api-hub').aliases.sort(), ['/api-hub-dashboard', '/data-api-hub', '/racing-data-api-hub']);
  assert.ok(canonicalById.get('operations').aliases.includes('/command-center'));
  assert.ok(canonicalById.get('ai-governance').aliases.includes('/responsible-ai'));
  const canonicalAliases = canonicalRouteMap.flatMap((entry) => entry.aliases);
  const deprecatedAliases = legacyRouteAliases.filter((alias) => alias.status === 'deprecated');
  assert.ok(deprecatedAliases.length > 0);
  assert.ok(deprecatedAliases.every((alias) => !('to' in alias)));
  assert.ok(deprecatedAliases.every((alias) => !canonicalAliases.includes(alias.from)));
  assert.equal(requiredPaths.length, 22);
});

test('command palette filters by role and query', () => {
  const auditorGate = filterCommandPalette('gate', ['read-only-auditor']).map((item) => item.label);
  assert.equal(auditorGate.some((label) => label.includes('Starting Gate')), false);
  const adminGate = filterCommandPalette('gate', ['admin']).map((item) => item.label);
  assert.ok(adminGate.some((label) => label.includes('Starting Gate')));
  const auditorApiHub = filterCommandPalette('license', ['read-only-auditor']).map((item) => item.path);
  assert.deepEqual(auditorApiHub, ['/api-hub/license-policy']);
});

test('degraded and offline banners communicate locked safety posture', () => {
  assert.match(serviceBanner('degraded', false).message, /Degraded service/);
  const offline = serviceBanner('offline', false);
  assert.equal(offline.tone, 'critical');
  assert.match(offline.message, /Safety-critical controls remain locked/);
});

test('rendered safety-critical action stays disabled without approval requirements satisfied', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/starting-gate' });
  const safetyButtons = collect(tree, (node) => node.type?.name === 'SafetyCriticalActionButton' && textFrom(node).includes('Execute approved gate move'));
  assert.equal(safetyButtons.length, 1);
  assert.equal(safetyButtons[0].props.approvalsSatisfied, false);
  assert.equal(safetyButtons[0].props.backendLive, false);
  assert.doesNotMatch(textFrom(tree), /Release starting gate/);
});

test('unified operations command center aggregates governed operational domains', async () => {
  const data = await loadCommandCenter(createMockClient());
  const titles = data.operations.widgets.map((widget) => widget.title);
  for (const required of ['Race readiness','Surface conditions','Weather status','Active incidents','Pending approvals','Steward inquiries','Asset health','Workforce readiness','Emergency resources','Facility status','AI recommendations']) {
    assert.ok(titles.includes(required), `missing ${required}`);
  }
  assert.equal(data.operations.widgets.find((widget) => widget.id === 'steward-inquiries').value, '1 inquiry under review');
  assert.match(data.operations.widgets.find((widget) => widget.id === 'steward-inquiries').detail, /official results stay locked/i);
  assert.ok(data.operations.widgets.every((widget) => ['service','event-stream','digital-twin','approved-mock-adapter'].includes(widget.source)));
  assert.ok(data.operations.widgets.every((widget) => widget.drillDownPath.startsWith('/')));
  assert.equal(data.operations.widgets.find((widget) => widget.id === 'workforce-readiness').drillDownPath, '/workforce');
  assert.equal(data.operations.widgets.find((widget) => widget.id === 'facility-status').drillDownPath, '/facilities');
  assert.ok(data.operations.savedLayouts.length >= 3);
  assert.ok(data.operations.liveEvents.length >= 3);
  assert.ok(data.operations.alerts.length >= 1);
});

test('command center landing page renders widgets, saved layouts, live timeline, alerts, and lineage', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const panelTitles = collect(tree, (node) => node.type?.name === 'WorkspacePanel').map((node) => node.props.title);
  const mockBannerSources = collect(tree, (node) => node.type?.name === 'MockDataBanner').map((node) => node.props.source);
  const widgetCards = collect(tree, (node) => node.type === 'article' && String(node.props?.['aria-label'] ?? '').endsWith(' widget') && node.props?.['data-source']);
  const widgetHrefs = widgetCards.flatMap((card) => collect(card, (node) => node.type === 'a').map((link) => link.props.href));
  const timelines = collect(tree, (node) => node.type?.name === 'EventTimeline').map((node) => node.props);
  assert.ok(labels.includes('Unified Operations Command Center'));
  assert.ok(labels.includes('Operations command source status'));
  assert.ok(labels.includes('Operations command landing grid'));
  assert.ok(labels.includes('Configurable widget grid'));
  for (const required of ['Race readiness widget', 'Readiness domain score widgets', 'Surface status widget', 'Weather placeholder widget', 'Surface approval recommendations widget', 'Active incidents widget', 'Pending approvals widget', 'Steward inquiries widget', 'Asset health widget', 'Workforce readiness widget', 'Facility health widget', 'Emergency resources widget', 'AI recommendations widget', 'Audit activity widget', 'Live event timeline widget', 'Live event streaming', 'Streaming event timeline', 'Executive command KPI strip']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.ok(labels.includes('Saved layouts and role-specific views'));
  assert.ok(labels.includes('Operational alerts'));
  assert.ok(labels.includes('Data lineage'));
  assert.equal(labels.includes('Command center overview'), false);
  assert.match(textFrom(tree), /Far Turn requires operations review/);
  for (const required of ['Race readiness cockpit', 'Surface and weather watch', 'Safety, approvals, stewards', 'Asset, workforce, facility health', 'Emergency resources', 'AI, audit, live timeline']) {
    assert.ok(panelTitles.includes(required), `missing panel ${required}`);
  }
  assert.match(textFrom(tree), /Source:\s+Digital Twin runtime|Source:\s+digital-twin/);
  assert.match(textFrom(tree), /approved mock placeholder/);
  assert.match(textFrom(tree), /Mock weather placeholder/);
  assert.match(textFrom(tree), /official result mutation locked/);
  assert.ok(mockBannerSources.includes('Operations Command mock/live facade'));
  for (const href of ['/race-office','/surface','/emergency','/security','/approvals','/stewards','/assets','/workforce','/facilities','/ai-governance']) {
    assert.ok(widgetHrefs.includes(href), `missing operations drill-down ${href}`);
  }
  assert.ok(timelines.some((timeline) => timeline.label === 'Operations live event timeline' && timeline.events.length >= 4));
  assert.ok(timelines.some((timeline) => timeline.label === 'Streaming event timeline' && timeline.events.length >= 3));
  assert.match(textFrom(tree), /MOCK STREAM ACTIVE|Connection mock/);
  assert.match(textFrom(tree), /Reconnect stream/);
  assert.match(textFrom(tree), /telemetry\/status only|telemetry, event, and status views only/);
  assert.match(textFrom(tree), /POST \/api\/v1\/approvals\/controlled-actions/);
  assert.match(textFrom(tree), /POST \/api\/v1\/approvals\/draft-requests/);
  assert.match(textFrom(tree), /Platform audit volume/);
  assert.match(textFrom(tree), /Active emergency status:\s+critical fire-incident/);
});

test('operations landing content is scoped to /operations and old one-page UI is removed', async () => {
  const data = await loadCommandCenter(createMockClient());
  const operationsTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const surfaceTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/surface' });
  const platformTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const operationsLabels = collect(operationsTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const surfaceLabels = collect(surfaceTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const platformLabels = collect(platformTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);

  assert.ok(operationsLabels.includes('Unified Operations Command Center'));
  assert.equal(surfaceLabels.includes('Unified Operations Command Center'), false);
  assert.equal(platformLabels.includes('Unified Operations Command Center'), false);
  assert.equal(collect(operationsTree, (node) => node.props?.id === 'command-center-content')[0].props['data-active-workspace'], 'operations');
  assert.equal(collect(surfaceTree, (node) => node.props?.id === 'command-center-content')[0].props['data-active-workspace'], 'surface');
  for (const treeToCheck of [operationsTree, surfaceTree, platformTree]) {
    assert.doesNotMatch(textFrom(treeToCheck), /Command-center workspace blueprint|Command-center contract coverage|Ten-screen operational experience|Nexus operational workspace blueprint/);
  }
});

test('platform health renders artifact framework metadata without execution controls', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health/artifacts' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const sourceLabels = collect(tree, (node) => node.type?.name === 'RecordSourceLabel' && node.props?.label === 'artifact framework metadata');
  const rawVetAllowlist = collect(tree, (node) => node.type?.name === 'StatusCard' && node.props?.title === 'Raw veterinary notes');

  for (const required of ['Artifact Framework visibility panel', 'Artifact pipeline sequence', 'Artifact pipeline metadata sequence', 'Artifact registry stats', 'Canonical artifact type registry', 'Artifact storage map', 'AI training input allowlist', 'Artifact output classes']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.equal(sourceLabels.length, 1);
  assert.equal(sourceLabels[0].props.mock, true);
  assert.match(textFrom(tree), /INPUTS -> EVENTS -> ARTIFACTS -> DIGITAL TWINS -> FEATURE STORE -> AI MODELS -> RECOMMENDATIONS -> APPROVALS -> OUTPUTS -> AUDITS/);
  assert.match(textFrom(tree), /Canonical artifact types/);
  assert.match(textFrom(tree), /Registry stats/);
  assert.match(textFrom(tree), /Storage map/);
  assert.match(textFrom(tree), /Telemetry aggregates/);
  assert.equal(rawVetAllowlist[0]?.props.status, 'No');
  assert.match(textFrom(tree), /Insight/);
  assert.match(textFrom(tree), /Recommendation/);
  assert.match(textFrom(tree), /Forecast/);
  assert.match(textFrom(tree), /Framework\/metadata only/);
  assert.match(textFrom(tree), /does not execute operations, launch training jobs, deploy models, approve recommendations, mutate Digital Twins, or issue protected commands/i);
  assert.match(textFrom(tree), /Operational execution blocked:\s+true/);
  assert.match(textFrom(tree), /Mock artifact framework metadata approved mock adapter/);
});

test('artifact framework panel is route-scoped and preserves mock/live labels', async () => {
  const data = await loadCommandCenter(createMockClient());
  const liveData = {
    ...data,
    mode: 'live',
    aiGovernance: { ...data.aiGovernance, mock: false },
    platformHealth: {
      ...data.platformHealth,
      rosStandardization: data.platformHealth.rosStandardization ? { ...data.platformHealth.rosStandardization, mock: false } : undefined,
    },
  };
  const platformTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const livePlatformTree = CommandCenter({ data: liveData, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const operationsTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const executiveTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/executive' });
  const aiGovernanceTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/ai-governance' });
  const complianceTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/compliance' });
  const frameworkSections = collect(platformTree, (node) => node.props?.['aria-label'] === 'Artifact Framework visibility panel');
  const liveSourceLabels = collect(livePlatformTree, (node) => node.type?.name === 'RecordSourceLabel' && node.props?.label === 'artifact framework metadata');

  assert.equal(frameworkSections.length, 1);
  assert.equal(frameworkSections[0].props['data-route-scope'], 'platform-health');
  assert.equal(frameworkSections[0].props['data-framework-kind'], 'metadata');
  assert.equal(frameworkSections[0].props['data-execution-surface'], 'false');
  assert.equal(collect(operationsTree, (node) => node.props?.['aria-label'] === 'Artifact Framework visibility panel').length, 0);
  assert.equal(collect(executiveTree, (node) => node.props?.['aria-label'] === 'Artifact Framework visibility panel').length, 0);
  assert.equal(collect(aiGovernanceTree, (node) => node.props?.['aria-label'] === 'Artifact Framework visibility panel').length, 0);
  assert.equal(collect(complianceTree, (node) => node.props?.['aria-label'] === 'Artifact Framework visibility panel').length, 0);
  assert.equal(liveSourceLabels.length, 1);
  assert.equal(liveSourceLabels[0].props.mock, false);
  assert.match(textFrom(livePlatformTree), /Live artifact framework metadata live backend source/);
  assert.doesNotMatch(textFrom(operationsTree), /Artifact Framework Visibility/);
  assert.doesNotMatch(textFrom(executiveTree), /Artifact Framework Visibility/);
});

test('track map mock exposes geospatial Digital Twin layers, controls, playback, and simulation overlays', async () => {
  const map = await createMockClient().getTrackMap();
  assert.ok(map.geospatial);
  const layers = map.geospatial.overlays.map((overlay) => overlay.layer);
  for (const required of ['sector','gate','rail','barn','stall','facility','camera','emergency','measurement','incident','maintenance','workforce','twin','simulation']) {
    assert.ok(layers.includes(required), `missing ${required}`);
  }
  assert.ok(map.geospatial.features.some((feature) => feature.layer === 'stall' && feature.label === 'Stall 12A'));
  assert.ok(map.geospatial.controls.zoom.presets.includes(18));
  assert.ok(map.geospatial.controls.overlayModes.includes('historical-playback'));
  assert.ok(map.geospatial.playback.length >= 2);
  assert.equal(map.geospatial.simulationOverlays[0].approvalRequired, true);
  assert.equal(map.geospatial.digitalTwinState[0].health, 'degraded');
});

test('track map renders approval-gated configuration work orders and verification state when provided', async () => {
  const map = {
    ...(await createMockClient().getTrackMap()),
    trackConfiguration: {
      changeId: 'test-change',
      raceDistance: { advertisedMeters: 1609, measuredMeters: 1614.4, varianceMeters: 5.4, regulatoryFlags: ['distance-variance-review'] },
      railPosition: { railId: 'rail-b', offsetMeters: 6, protectedTurns: ['far-turn'] },
      turfConfiguration: { lane: 'B', going: 'good', irrigationMillimeters: 2, mowingHeightMillimeters: 110, resting: false },
      approvalRequirements: ['racing-secretary', 'track-superintendent', 'steward'],
      workOrders: [{ id: 'wo-gate', crew: 'gate-crew', status: 'approval-blocked', tasks: ['place gate'], evidenceRequired: ['gps-fix'], dueAt: now }],
      verificationWorkflow: { id: 'verify-track-config', status: 'approval-blocked', digitalTwinSync: 'blocked-until-approved', requiredRoles: ['track-superintendent'], actuatorControlAvailable: false },
      events: ['track.configuration.change.requested', 'digital-twin.state.patch'],
      auditIds: ['audit-track-config'],
      digitalTwinSync: { twinId: 'race-setup:race-7', status: 'approval-required' },
      noLiveActuatorControl: true,
    },
  };
  const tree = TrackMap({ map });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('Track configuration control plan'));
  assert.ok(labels.includes('Track configuration work orders'));
  assert.ok(labels.includes('Track configuration verification workflow'));
  assert.match(textFrom(tree), /Live actuator control available:\s+false/);
  assert.match(textFrom(tree), /approval-blocked/);
});

test('track map renders starting gate current and target overlays without state mutation', async () => {
  const map = await createMockClient().getTrackMap();
  const gatePlan = {
    raceId: 'race-7',
    currentSectorId: 'backstretch',
    currentMetersFromStart: 0,
    targetSectorId: 'chute',
    targetMetersFromStart: 120,
    deltaMeters: 120,
    gpsVerified: false,
    approvalRequired: true,
    workOrderId: 'wo-race-7-gate-1',
  };
  const tree = TrackMap({ map, gatePlan });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Starting gate move target overlay', 'Starting gate current and target map markers', 'Current starting gate map marker', 'Target starting gate map marker']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /approval required/i);
  assert.match(textFrom(tree), /does not mutate gate state/i);
});


test('command-center UX renders grouped navigation and route-selected workspaces without old blueprint', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/ai-governance/recommendations/rec-harrow-7' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const group of ['Operations navigation group', 'Equine navigation group', 'Safety navigation group', 'Facilities navigation group', 'Governance navigation group', 'Intelligence navigation group', 'Executive navigation group', 'Platform Admin navigation group']) {
    assert.ok(labels.includes(group), `missing ${group}`);
  }
  const activeLinks = collect(tree, (node) => node.type === 'a' && node.props?.['aria-current'] === 'page');
  assert.equal(activeLinks.length, 2);
  assert.ok(activeLinks.every((link) => textFrom(link).includes('AI Governance')));
  assert.ok(labels.includes('Active command-center workspace'));
  assert.ok(labels.includes('AI Governance workspace'));
  assert.equal(labels.includes('Nexus operational workspace blueprint'), false);
  assert.match(textFrom(tree), /Other workspaces stay available through navigation instead of being stacked into this page/);
});

test('route-selected shell keeps one active workspace landmark and does not stack unrelated workspace bodies', async () => {
  const data = await loadCommandCenter(createMockClient());
  const routeCases = [
    { path: '/operations', active: 'operations', included: 'Unified Operations Command Center', excluded: ['AI Governance workspace', 'API Hub Dashboard workspace', 'Platform Health workspace', 'Starting Gate Control workspace'] },
    { path: '/ai-governance/recommendations/rec-harrow-7', active: 'ai-governance', included: 'AI Governance workspace', excluded: ['Unified Operations Command Center', 'API Hub Dashboard workspace', 'Platform Health workspace', 'Starting Gate Control workspace'] },
    { path: '/api-hub/license-policy', active: 'api-hub', included: 'API Hub Dashboard workspace', excluded: ['Unified Operations Command Center', 'AI Governance workspace', 'Platform Health workspace', 'Starting Gate Control workspace'] },
    { path: '/platform-health/services/api-gateway', active: 'platform-health', included: 'Platform Health workspace', excluded: ['Unified Operations Command Center', 'AI Governance workspace', 'API Hub Dashboard workspace', 'Starting Gate Control workspace'] },
    { path: '/starting-gate', active: 'starting-gate', included: 'Starting Gate Control workspace', excluded: ['Unified Operations Command Center', 'AI Governance workspace', 'API Hub Dashboard workspace', 'Platform Health workspace'] },
    { path: '/safety', active: 'safety', included: 'Safety Center overview workspace', excluded: ['Security Operations workspace', 'Emergency Operations command view', 'Unified Operations Command Center'] },
    { path: '/security', active: 'security', included: 'Security Operations workspace', excluded: ['Safety Center overview workspace', 'Emergency Operations command view', 'Unified Operations Command Center'] },
    { path: '/emergency', active: 'emergency', included: 'Emergency Operations command view', excluded: ['Safety Center overview workspace', 'Security Operations workspace', 'Unified Operations Command Center'] },
  ];

  for (const routeCase of routeCases) {
    const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: routeCase.path });
    const activeFrames = collect(tree, (node) => node.props?.id === 'command-center-content');
    assert.equal(activeFrames.length, 1, `${routeCase.path} should render one active workspace frame`);
    assert.equal(activeFrames[0].props['data-active-workspace'], routeCase.active);
    const sectionLabels = collect(tree, (node) => node.type === 'section' && Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
    assert.ok(sectionLabels.includes(routeCase.included), `${routeCase.path} missing ${routeCase.included}`);
    for (const excluded of routeCase.excluded) assert.equal(sectionLabels.includes(excluded), false, `${routeCase.path} should not stack ${excluded}`);
  }
});

test('all active domain routes render inside the shared Nexus shell surfaces', async () => {
  const data = await loadCommandCenter(createMockClient());
  const requiredLabels = ['Persistent sidebar', 'Top command bar', 'Global command bar', 'Tenant racetrack selector', 'Race-day status indicator', 'Breadcrumb', 'Notification center', 'Approvals shortcut', 'Emergency banner zone', 'Quick-access command palette', 'User menu'];

  for (const screen of domainScreens) {
    const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: screen.route });
    const shell = collect(tree, (node) => node.type === 'main' && String(node.props?.className ?? '').includes('nexus-shell'))[0];
    const activeFrames = collect(tree, (node) => node.props?.id === 'command-center-content');
    const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);

    assert.ok(shell, `${screen.route} missing Nexus shell main`);
    assert.equal(activeFrames.length, 1, `${screen.route} should render one active route frame`);
    assert.equal(activeFrames[0].props['data-active-workspace'], screen.id);
    for (const required of requiredLabels) assert.ok(labels.includes(required), `${screen.route} missing shell surface ${required}`);
    assert.doesNotMatch(textFrom(tree), /Command-center workspace blueprint|Nexus operational workspace blueprint/);
  }
});

test('unknown routes render not-found shell instead of falling back to Operations', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/legacy-one-page-dashboard' });
  const activeFrames = collect(tree, (node) => node.props?.id === 'command-center-content');
  assert.equal(activeFrames.length, 1);
  assert.equal(activeFrames[0].props['data-active-workspace'], 'not-found');
  assert.equal(activeFrames[0].props['data-route'], '/legacy-one-page-dashboard');
  assert.match(textFrom(activeFrames[0]), /Route not found in TrackMind Nexus/);
  assert.match(textFrom(activeFrames[0]), /do not render Operations by default/);
  assert.equal(collect(tree, (node) => node.props?.['aria-label'] === 'Unified Operations Command Center').length, 0);
});

test('Command Center v1 shared client exposes vertical-slice endpoint contracts', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.gatePosition.mock, true);
  assert.equal(data.raceDistanceConfiguration.mock, true);
  assert.equal(data.digitalTwinState[0].mock, true);
  const live = createLiveClient('https://api.example.test/api/v1');
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url, init) => { urls.push({ url, init }); return { ok: true, json: async () => ({}) }; };
  try {
    await live.getGatePosition();
    await live.getRaceDistanceConfiguration();
    await live.listDigitalTwinState();
    await live.createDraftRequest({ action: 'starting-gate-move', target: 'gate-1', reason: 'test', actor: 'starter-1', evidence: [], payload: { sectorId: 'chute' } });
    assert.deepEqual(urls.map((entry) => entry.url), [
      'https://api.example.test/api/v1/starting-gate/position',
      'https://api.example.test/api/v1/race-distance/configuration',
      'https://api.example.test/api/v1/digital-twin/state',
      'https://api.example.test/api/v1/approvals/draft-requests',
    ]);
    assert.equal(urls[3].init.method, 'POST');
  } finally {
    globalThis.fetch = original;
  }
});

test('Command Center renders guided Starting Gate workflow with disabled safety-critical controls', async () => {
  const data = await loadCommandCenter(createMockClient());
  const twinTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/digital-twin' });
  const trackConfigurationTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/track-configuration' });
  const operationsTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const gateTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/starting-gate' });
  const labels = [
    ...collect(twinTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']),
    ...collect(gateTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']),
  ];
  assert.ok(labels.includes('Digital Twin workspace shell'));
  for (const required of ['Digital Twin track map panel', 'Digital Twin asset graph and relationship view', 'Digital Twin dependency view', 'Digital Twin health indicators', 'Digital Twin risk indicators', 'Digital Twin asset detail drawer', 'Digital Twin telemetry summary', 'Digital Twin event history', 'Digital Twin audit history', 'Digital Twin simulation placeholders', 'Digital Twin approval-gated controls']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.ok(labels.some((label) => String(label).startsWith('Asset detail drawer ')));
  const twinButtons = collect(twinTree, (node) => node.type === 'button' && ['Draft Digital Twin patch approval request', 'Run Digital Twin simulation placeholder'].includes(String(node.props?.['aria-label'] ?? '')));
  assert.equal(twinButtons.length, 2);
  assert.equal(twinButtons.every((button) => button.props.disabled), true);
  const twinSafety = collect(twinTree, (node) => node.type?.name === 'SafetyCriticalActionButton' && String(node.props?.ariaLabel ?? '').includes('Digital Twin'))[0];
  assert.equal(twinSafety.props.approvalsSatisfied, false);
  assert.equal(twinSafety.props.backendLive, false);
  assert.match(textFrom(twinTree), /SIMULATION PLACEHOLDER/);
  assert.match(textFrom(twinTree), /MOCK\/WHAT-IF ONLY/);
  assert.match(textFrom(twinTree), /Twin audit link/);
  assert.match(textFrom(twinTree), /Moisture Sensor 44/);
  assert.match(textFrom(twinTree), /Tenant scope/);
  assert.match(textFrom(twinTree), /No Digital Twin patch, relationship edit, dependency rewire, or simulation run mutates local state/);
  assert.doesNotMatch(textFrom(twinTree), /PLACEHOLDER drawer/);
  assert.ok(labels.includes('Starting Gate Control workspace'));
  for (const required of ['Starting gate race selection', 'Starting gate current distance', 'Starting gate required position calculation', 'Starting gate move request package', 'Starting gate approval requirement', 'Starting gate work order', 'Starting gate GPS verification', 'Starting gate audit trail', 'Starting gate safety critical execution lock']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.ok(labels.includes('Select race for starting gate workflow'));
  assert.ok(labels.includes('Create draft starting gate move request'));
  assert.ok(labels.includes('Draft race distance configuration request'));
  assert.ok(labels.includes('Generate approval-blocked starting gate work order'));
  assert.ok(labels.includes('Verify starting gate GPS location'));
  const target = calculateRequiredGatePosition(data.trackMap.distanceMeters, data.raceDistanceConfiguration, data.trackMap.sectors);
  assert.equal(target.targetMetersFromStart, 0);
  const buttons = collect(gateTree, (node) => node.type === 'button' && ['Create draft starting gate move request', 'Draft race distance configuration request', 'Generate approval-blocked starting gate work order', 'Verify starting gate GPS location'].includes(String(node.props?.['aria-label'] ?? '')));
  assert.equal(buttons.every((button) => button.props.disabled), true);
  const raceSelectors = collect(gateTree, (node) => node.type === 'select' && node.props?.['aria-label'] === 'Select race for starting gate workflow');
  assert.equal(raceSelectors[0].props.disabled, true);
  assert.match(textFrom(gateTree), /MOCK DATA/);
  assert.match(textFrom(gateTree), /requestStartingGateMoveDraft\(\)/);
  assert.match(textFrom(gateTree), /requestTrackConfigurationDraft\(\)/);
  assert.match(textFrom(gateTree), /Event path:/);
  assert.doesNotMatch(textFrom(gateTree), /Release starting gate/);
  assert.doesNotMatch(textFrom(twinTree), /Starting gate move target overlay/);
  assert.doesNotMatch(textFrom(trackConfigurationTree), /Starting Gate Control workspace|Starting gate move target overlay/);
  assert.doesNotMatch(textFrom(operationsTree), /Starting Gate Control workspace|Starting gate move target overlay/);
});

test('Starting Gate Control component harmonizes race, approvals, work order, GPS, audit, and disabled execution', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = StartingGateControl({
    trackMap: data.trackMap,
    gatePosition: data.gatePosition,
    raceDistanceConfiguration: data.raceDistanceConfiguration,
    readiness: data.readiness,
    approvals: data.approvals,
    auditEvents: data.auditEvents,
    digitalTwinState: data.digitalTwinState,
    mode: data.mode,
    authenticated: true,
    canExecute: false,
  });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Starting gate race selection', 'Starting gate map overlays', 'Starting gate approval requirement', 'Starting gate work order', 'Starting gate GPS verification', 'Starting gate audit trail', 'Starting gate safety critical execution lock']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /mock-approval-starting-gate-move:pending-approval:starting-gate-move/);
  assert.match(textFrom(tree), /Placeholder work order status derived from current DTOs/);
  assert.match(textFrom(tree), /Current GPS verified:\s+false/);
  assert.match(textFrom(tree), /mock-gate-move-requested/);
  assert.match(textFrom(tree), /Approved gate request exists:\s+false/);
  assert.match(textFrom(tree), /approval token accepted by backend:\s+false/i);
  const disabled = collect(tree, (node) => node.type === 'button' && ['Create draft starting gate move request', 'Draft race distance configuration request', 'Generate approval-blocked starting gate work order', 'Verify starting gate GPS location'].includes(String(node.props?.['aria-label'] ?? '')));
  assert.equal(disabled.length, 4);
  assert.ok(disabled.every((button) => button.props.disabled));
  const executionButton = collect(tree, (node) => node.type?.name === 'SafetyCriticalActionButton' && textFrom(node).includes('Execute approved gate move'))[0];
  assert.equal(executionButton.props.approvalsSatisfied, false);
});

test('Starting Gate approval helper requires a gate-specific approved request before execution can unlock', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(hasApprovedGateMoveRequest(data.approvals, data.gatePosition.gateId, data.raceDistanceConfiguration, data.gatePosition), false);
  const approvedApproval = { ...data.approvals.find((approval) => approval.id === 'mock-approval-starting-gate-move'), status: 'approved' };
  const approvedGatePosition = { ...data.gatePosition, lastApprovedRequestId: 'mock-approval-starting-gate-move' };
  assert.equal(hasApprovedGateMoveRequest([approvedApproval], data.gatePosition.gateId, data.raceDistanceConfiguration, approvedGatePosition), true);
  const tree = StartingGateControl({
    trackMap: data.trackMap,
    gatePosition: data.gatePosition,
    raceDistanceConfiguration: data.raceDistanceConfiguration,
    readiness: data.readiness,
    approvals: [],
    auditEvents: data.auditEvents,
    digitalTwinState: data.digitalTwinState,
    mode: 'live',
    authenticated: true,
    canExecute: true,
  });
  const executionButton = collect(tree, (node) => node.type?.name === 'SafetyCriticalActionButton' && textFrom(node).includes('Execute approved gate move'))[0];
  assert.equal(executionButton.props.approvalsSatisfied, false);
});

test('Starting Gate draft helper uses approval draft client without live execution', async () => {
  const result = await requestStartingGateMoveDraft(createMockClient(), 'starter-1', { raceId: 'race-7', gateId: 'gate-1', currentSectorId: 'backstretch', targetSectorId: 'chute', currentMetersFromStart: 0, targetMetersFromStart: 120, distanceMeters: 1489, gpsVerified: false });
  assert.equal(result.accepted, true);
  assert.equal(result.eventType, 'approval.requested');
  assert.equal(result.audited, true);
  assert.match(result.message, /draft approval request/i);
});

test('Track Configuration draft helper uses the shared approval and audit aware route', async () => {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ accepted: true, approvalId: 'approval-track-config', eventType: 'track.configuration.change.requested', audited: true, message: 'queued', mock: false }) };
  };
  try {
    const input = { action: 'race-distance-configuration', target: 'race-7', reason: 'distance review', actor: 'starter-1', evidence: ['distance-sheet'], payload: { approvalRequired: true } };
    const result = await requestTrackConfigurationDraft(createLiveClient('https://api.example.test/api/v1'), input);
    assert.equal(request.url, 'https://api.example.test/api/v1/track-configuration/draft-requests');
    assert.equal(request.init.method, 'POST');
    assert.equal(JSON.parse(request.init.body).payload.approvalRequired, true);
    assert.equal(result.eventType, 'track.configuration.change.requested');
    assert.equal(result.audited, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('Race Office route renders vertical-slice screens and approval-gated controls', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.raceOffice.mock, true);
  assert.equal(data.raceOffice.cards[0].conditions.surface, 'dirt');
  assert.equal(data.raceOffice.cards[0].declarationsPlaceholder, true);
  assert.ok(data.raceOffice.cards[0].entries.some((entry) => entry.scratched));
  assert.ok(data.raceOffice.approvalControls.every((control) => control.locked && control.safetyCritical && (control.approvalApi.includes('/approvals/controlled-actions') || control.approvalApi.includes('/track-configuration/draft-requests'))));
  assert.ok(data.raceOffice.approvalControls.some((control) => control.action === 'race-distance-configuration' && control.approvalApi.includes('/track-configuration/draft-requests')));
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/race-office' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Race Office workspace', 'Race Office mock-only data boundary', 'Race meets', 'Race days', 'Race cards', 'Race conditions and declarations', 'Entries scratches and post positions', 'Race Office entries scratches and post positions', 'Race readiness checks', 'Race lifecycle status', 'Race office approval gates', 'Safety-critical approval controls', 'Request scratch approval', 'Request race cancellation approval', 'Request official configuration approval', 'Request lifecycle status approval']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /race meets, race days, cards, conditions, entries, declarations, scratches, post positions, readiness checks, lifecycle status, and approval controls/i);
  assert.match(textFrom(tree), /PLACEHOLDER declarations/i);
  assert.match(textFrom(tree), /PLACEHOLDER entry - source feed incomplete/i);
  assert.match(textFrom(tree), /POST PENDING/);
  assert.match(textFrom(tree), /Scratch approval approval-required/);
  assert.match(textFrom(tree), /This panel does not directly mutate race state/i);
  assert.match(textFrom(tree), /Scratch, cancellation, official configuration, and lifecycle changes require approved backend requests and never update local React state/i);
  assert.match(textFrom(tree), /Mock Race Office approved mock adapter/i);
  assert.match(textFrom(tree), /race-office-scratch/i);
  const raceOfficeButtons = collect(tree, (node) => node.type === 'button' && ['Request scratch approval', 'Request race cancellation approval', 'Request official configuration approval', 'Request lifecycle status approval'].includes(String(node.props?.['aria-label'] ?? '')));
  assert.ok(raceOfficeButtons.length >= 4);
  assert.ok(raceOfficeButtons.every((button) => button.props.disabled === true));

  const liveTree = CommandCenter({ data: { ...data, mode: 'live', raceOffice: { ...data.raceOffice, mock: false } }, roles: ['admin'], authenticated: true, path: '/race-office' });
  assert.match(textFrom(liveTree), /Live Race Office live backend source/i);
  assert.doesNotMatch(textFrom(liveTree), /MOCK-ONLY Race Office data is labeled/i);
});

test('Race Office panel does not render outside the race-office route', async () => {
  const data = await loadCommandCenter(createMockClient());
  const operationsTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const operationsLabels = collect(operationsTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.equal(operationsLabels.includes('Race office approval gates'), false);
  assert.equal(operationsLabels.includes('Race conditions and declarations'), false);
  assert.equal(operationsLabels.includes('Entries scratches and post positions'), false);
  assert.equal(operationsLabels.includes('Race Office entries scratches and post positions'), false);
  assert.equal(operationsLabels.includes('Request lifecycle status approval'), false);
  assert.equal(collect(operationsTree, (node) => node.type === 'article' && node.props?.['aria-label'] === 'Race Office').length, 0);
});

test('Race Office approval helper posts safety-critical actions through backend-aware client', async () => {
  const result = await requestRaceOfficeApproval(createMockClient(), { action: 'race-office-scratch', target: 'race-7', reason: 'scratch requested from Race Office', actor: 'racing-secretary-1' });
  assert.equal(result.accepted, true);
  assert.equal(result.eventType, 'approval.requested');
  assert.equal(result.audited, true);
  assert.equal(result.mock, true);
});

test('Race Office distance approvals use track-configuration draft route', async () => {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ accepted: true, approvalId: 'approval-race-office-distance', eventType: 'track.configuration.change.requested', audited: true, message: 'draft queued', mock: false }) };
  };
  try {
    const result = await requestRaceOfficeApproval(createLiveClient('https://api.example.test/api/v1'), { action: 'race-distance-configuration', target: 'race-7', reason: 'distance correction from Race Office', actor: 'racing-secretary-1' });
    const body = JSON.parse(request.init.body);
    assert.equal(request.url, 'https://api.example.test/api/v1/track-configuration/draft-requests');
    assert.equal(request.init.method, 'POST');
    assert.equal(body.action, 'race-distance-configuration');
    assert.equal(body.payload.liveExecutionAllowed, false);
    assert.equal(result.eventType, 'track.configuration.change.requested');
  } finally {
    globalThis.fetch = original;
  }
});

test('Race Office live client uses vertical-slice endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({ meets: [], raceDays: [], cards: [], readiness: [] }) }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getRaceOffice();
    assert.equal(requestUrl, 'https://api.example.test/api/v1/race-operations/race-office');
  } finally {
    globalThis.fetch = original;
  }
});

test('API Hub canonical data explorer renders seeded canonical racing records', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub/canonical-data-explorer' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Canonical Data Explorer workspace', 'Canonical race cards', 'Canonical races', 'Canonical entries', 'Official race results read-only', 'Canonical horse identities', 'Canonical person identities', 'Canonical workouts and past performance', 'Surface and regulatory records', 'Steward notes read-only']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  const activeFrames = collect(tree, (node) => node.props?.id === 'command-center-content');
  assert.equal(activeFrames[0].props['data-active-workspace'], 'api-hub');
  assert.match(textFrom(tree), /Race Cards/);
  assert.match(textFrom(tree), /Race 7 card/);
  assert.match(textFrom(tree), /Lifecycle Runner/);
  assert.match(textFrom(tree), /work-1/);
  assert.match(textFrom(tree), /HISA|ARCI|LOCAL-RACING-COMMISSION/);
  assert.match(textFrom(tree), /Provider refs/);
  assert.match(textFrom(tree), /Normalized fields/);
  assert.match(textFrom(tree), /Source lineage/);
  assert.match(textFrom(tree), /License and restrictions/);
  assert.match(textFrom(tree), /artifact:canonical:race-card:race-7/);
  assert.match(textFrom(tree), /training prohibited/);
});

test('API Hub official results and steward notes are read-only with no edit controls', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/api-hub' });
  const officialSections = collect(tree, (node) => node.type === 'section' && ['Official race results read-only', 'Steward notes read-only'].includes(String(node.props?.['aria-label'] ?? '')));
  assert.equal(officialSections.length, 2);
  for (const section of officialSections) {
    assert.equal(section.props['data-readonly'], 'true');
    assert.equal(section.props['data-mutation-allowed'], 'false');
    assert.equal(collect(section, (node) => node.type === 'button').length, 0);
    assert.equal(collect(section, (node) => node.type === 'input' || node.type === 'textarea' || node.type === 'select' || node.type === 'form').length, 0);
    assert.match(textFrom(section), /modifiableFromFrontend: false/);
  }
  assert.match(textFrom(tree), /No edit, submit, approve, finalize, or mutation control is rendered/i);
  assert.doesNotMatch(textFrom(officialSections), /POST \/api\/v1\/approvals\/controlled-actions/);
});

test('Surface Intelligence workspace renders vertical slice and approval-gated operational actions', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.surfaceIntelligence.operationalActionsRequireHumanApproval, true);
  assert.ok(data.surfaceIntelligence.heatmap.every((cell) => typeof cell.latitude === 'number' && typeof cell.riskIndex === 'number'));
  assert.ok(data.surfaceIntelligence.conditionScorecards.some((card) => card.label === 'Far Turn' && card.riskLevel === 'high'));
  assert.ok(data.surfaceIntelligence.metricPanels.map((panel) => panel.factor).includes('cushion-depth'));
  assert.ok(data.surfaceIntelligence.heatmapSectors.every((sector) => sector.cellIds.length > 0 && sector.coordinates.length > 0));
  assert.ok(data.surfaceIntelligence.inspectionTimeline.some((inspection) => inspection.requiresFollowUp));
  assert.equal(data.surfaceIntelligence.approvalActions.every((action) => action.locked), true);
  assert.ok(data.surfaceIntelligence.recommendations.every((item) => item.requiresHumanApproval && item.executionState === 'approval-required'));
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/surface' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Surface Intelligence workspace', 'Surface status cards', 'Surface condition scorecards', 'Surface factor panels', 'Surface sector table', 'Surface measurement timeline', 'Surface inspection timeline', 'Surface risk badges', 'Surface drainage analysis', 'Surface maintenance records', 'Surface irrigation recommendations', 'Surface forecasts', 'Surface anomalies', 'Surface risk analysis', 'Surface maintenance recommendations', 'Heatmap-ready sector view', 'Mock-safe surface map overlay', 'Surface Digital Twin sync', 'Surface approval gates']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  const actionRails = collect(tree, (node) => node.type?.name === 'ActionRail');
  assert.ok(actionRails.some((rail) => rail.props.actions === data.surfaceIntelligence.approvalActions));
  assert.ok(data.surfaceIntelligence.approvalActions.every((action) => action.locked && action.approvalApi.includes('/approvals/')));
  assert.match(textFrom(tree), /moisture, compaction, cushion depth, drainage, weather observations/i);
  assert.match(textFrom(tree), /MOCK SAFE MAP OVERLAY/);
  assert.match(textFrom(tree), /AI and surface recommendations are advisory only/);
  assert.match(textFrom(tree), /never mutate critical local surface or Digital Twin state directly/);
  assert.match(textFrom(tree), /Approval-required action controls/);
});

test('Surface Intelligence component labels weather, evidence, heatmap, and locked approval controls', async () => {
  const workspace = await createMockClient().getSurfaceIntelligence();
  const tree = SurfaceIntelligenceWorkspace({ workspace, mode: 'mock' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Surface advisory and approval boundary', 'Surface weather impact placeholder', 'Surface event audit evidence', 'Surface Digital Twin sync', 'Heatmap-ready sector view', 'Surface approval gates']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /MOCK WEATHER PLACEHOLDER/);
  assert.match(textFrom(tree), /Mock data active via Surface Intelligence approved mock\/weather adapter/);
  assert.match(textFrom(tree), /Event\s+evt-rec-harrow\s*;\s+audit\s+audit-rec-harrow/);
  assert.match(textFrom(tree), /mock-main-track:far-turn/);
  assert.match(textFrom(tree), /MOCK SAFE MAP OVERLAY/);
  const actionRails = collect(tree, (node) => node.type?.name === 'ActionRail');
  assert.equal(actionRails.length, 1);
  assert.ok(actionRails[0].props.actions.every((action) => action.locked && /approvals/.test(action.approvalApi)));
  const protectedButtons = collect(tree, (node) => node.type === 'button' && String(node.props?.['aria-label'] ?? '').startsWith('Request '));
  assert.ok(protectedButtons.length >= workspace.approvalActions.length);
  assert.ok(protectedButtons.every((button) => button.props.disabled === true || button.props['aria-disabled'] === true));
});

test('Surface Intelligence renders only on the canonical routed workspace', async () => {
  const data = await loadCommandCenter(createMockClient());
  const surfaceTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/surface/sectors/far-turn' });
  const operationsTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const legacyTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/surface-intelligence/sectors/far-turn' });
  assert.match(textFrom(surfaceTree), /Surface Intelligence is a routed workspace/);
  assert.doesNotMatch(textFrom(operationsTree), /Surface Intelligence is a routed workspace/);
  assert.match(textFrom(legacyTree), /Surface Intelligence is a routed workspace/);
  assert.equal(canonicalPathForRoute('/surface-intelligence/sectors/far-turn'), '/surface/sectors/far-turn');
});

test('Surface Intelligence live client uses vertical-slice endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({}) }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getSurfaceIntelligence();
    assert.equal(requestUrl, 'https://api.example.test/api/v1/surface-intelligence/workspace');
  } finally {
    globalThis.fetch = original;
  }
});

test('Equine Intelligence route renders horse detail, governed AI advisory review, audit, events, and approval gates', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.equineIntelligence.mock, true);
  assert.equal(data.equineIntelligence.aiRiskRecommendations[0].advisoryOnly, true);
  assert.equal(data.equineIntelligence.aiRiskRecommendations[0].veterinarianReviewRequired, true);
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/equine' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Equine Intelligence workspace', 'Equine command dashboard', 'Horse Registry and barn operations alignment', 'Veterinarian-review-required warnings', 'Horse profile detail', 'Horse ownership', 'Trainer assignment', 'Race history', 'Workout history', 'Transportation records', 'Veterinary status placeholder', 'Eligibility status', 'Eligibility rule tracking', 'Welfare status', 'Welfare tracking records', 'Barn assignment', 'Equine Digital Twin references', 'Equine relationship map', 'Equine integration status', 'Equine observability', 'Equine advisory AI recommendations', 'Equine approvals', 'Equine audit records', 'Equine event stream', 'Equine approval gates', 'Request veterinarian AI risk review']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /advisory only and require licensed veterinarian review/i);
  assert.match(textFrom(tree), /MOCK DATA boundary: Equine Intelligence and Barn Operations/i);
  assert.match(textFrom(tree), /Health AI advisory lock/);
  assert.match(textFrom(tree), /Veterinarian review required/);
  assert.match(textFrom(tree), /This panel never mutates local safety-critical state directly/i);
  assert.match(textFrom(tree), /stall-12A/);
  assert.ok(data.equineIntelligence.transportationRecords.length >= 1);
  const relationshipTypes = data.equineIntelligence.relationships.map((relationship) => relationship.type);
  for (const expected of ['owned-by', 'trained-by', 'entered-in-race', 'worked-at-track', 'transported-by', 'assigned-to-barn', 'mirrored-by-digital-twin']) {
    assert.ok(relationshipTypes.includes(expected), `missing ${expected}`);
  }
  assert.equal(data.equineIntelligence.barnAssignment.stallId, data.barnOperations.occupancy.find((occupancy) => occupancy.horseId === data.equineIntelligence.horse.horseId)?.stallId);
  assert.equal(data.equineIntelligence.integrations.digitalTwin, true);
  assert.equal(data.equineIntelligence.observability.pendingVeterinarianReviews, 1);
  const gated = collect(tree, (node) => node.type === 'button' && ['Request veterinarian AI risk review', 'Request eligibility change approval', 'Request barn transfer approval'].includes(node.props?.['aria-label']));
  assert.ok(gated.length >= 3);
  assert.ok(gated.every((button) => button.props.disabled === true || button.props['aria-disabled'] === true));
});

test('Equine Intelligence live client uses horse detail endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({}) }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getEquineIntelligence('horse-42');
    assert.equal(requestUrl, 'https://api.example.test/api/v1/equine-intelligence/horses/horse-42');
  } finally {
    globalThis.fetch = original;
  }
});

test('Barn Operations frontend renders barn map, stall occupancy, movement timeline, access history, and readiness', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/barns' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const label of ['Barn Operations workspace','Barn operations command dashboard','Barn map and list','Stall occupancy grid','Horse movement timeline','Current horse movement timeline','Barn access history','Barn readiness dashboard','Barn facility readiness dashboard','Barn asset registry links','Barn Digital Twin sync','Barn approval queue','Barn event backbone','Barn approval gates']) assert.ok(labels.includes(label), `missing ${label}`);
  assert.match(textFrom(tree), /Barn 2/);
  assert.match(textFrom(tree), /stall-12A|12A/);
  assert.match(textFrom(tree), /Lifecycle Runner/);
  assert.match(textFrom(tree), /Veterinarian review required warning follows this occupied stall/);
  assert.match(textFrom(tree), /barn\.horse\.moved/);
  assert.match(textFrom(tree), /audit-barn-2/);
  assert.match(textFrom(tree), /Restricted moves and assignments remain locked/);
  assert.match(textFrom(tree), /MOCK DATA boundary: Barn Operations mock data is labeled/i);
  assert.match(textFrom(tree), /require approval tokens from the backend/i);
  assert.match(textFrom(tree), /Mock barn event labels are shown/i);
  assert.match(textFrom(tree), /credential patrol/);
  const gated = collect(tree, (node) => node.type === 'button' && ['Request stall move approval', 'Request barn restriction approval', 'Request veterinary visit review'].includes(node.props?.['aria-label']));
  assert.ok(gated.length >= 3);
  assert.ok(gated.every((button) => button.props.disabled === true || button.props['aria-disabled'] === true));
});

test('/assets, /facilities, and /workforce render distinct route-selected workspaces without global bleed', async () => {
  const data = await loadCommandCenter(createMockClient());
  const routeContent = {
    assets: CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/assets' }),
    facilities: CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/facilities' }),
    workforce: CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/workforce' }),
  };
  const activeFrameFor = (node) => collect(node, (candidate) => candidate.props?.id === 'command-center-content')[0];
  const labelsFor = (node) => collect(node, (candidate) => candidate.type === 'section' && Boolean(candidate.props?.['aria-label'])).map((candidate) => candidate.props['aria-label']);
  const allContentLabelsFor = (node) => collect(node, (candidate) => candidate.type !== 'a' && candidate.type !== 'span' && Boolean(candidate.props?.['aria-label'])).map((candidate) => candidate.props['aria-label']);

  assert.equal(activeFrameFor(routeContent.assets).props['data-active-workspace'], 'assets');
  assert.equal(activeFrameFor(routeContent.facilities).props['data-active-workspace'], 'facilities');
  assert.equal(activeFrameFor(routeContent.workforce).props['data-active-workspace'], 'workforce');

  const assetLabels = labelsFor(routeContent.assets);
  for (const label of ['Asset Registry workspace','Facility assets in registry','Asset predictive health placeholders','Asset registry approval gates']) {
    assert.ok(assetLabels.includes(label), `missing asset route label ${label}`);
  }
  assert.match(textFrom(routeContent.assets), /Lifecycle and safety changes require approvals/);
  assert.match(textFrom(routeContent.assets), /Predictive-maintenance placeholder only/);

  const facilityLabels = labelsFor(routeContent.facilities);
  const facilityContentLabels = allContentLabelsFor(routeContent.facilities);
  for (const label of ['Facilities Maintenance workspace','Facility asset health table','Facilities inspection records','Preventive maintenance schedule','Facilities work orders','Predictive maintenance hooks','Facilities approval and audit integrations']) {
    assert.ok(facilityLabels.includes(label), `missing facilities route label ${label}`);
  }
  for (const label of ['Request facility work order approval','Request return-to-service approval']) {
    assert.ok(facilityContentLabels.includes(label), `missing facilities approval control ${label}`);
  }
  assert.match(textFrom(routeContent.facilities), /Grandstand HVAC/);
  assert.match(textFrom(routeContent.facilities), /Patron Elevator A/);
  assert.match(textFrom(routeContent.facilities), /facility-maintenance-execution:pending/);
  assert.match(textFrom(routeContent.facilities), /Predictive-maintenance placeholder/);

  const workforceLabels = labelsFor(routeContent.workforce);
  const workforceContentLabels = allContentLabelsFor(routeContent.workforce);
  for (const label of ['Workforce workspace','Workforce employee profiles','Workforce scheduling dashboard','Workforce certifications and training','Workforce training expiration alerts','Workforce readiness and planning','Workforce compliance tracking','Workforce event audit and twin integration','Emergency staffing approval gates']) {
    assert.ok(workforceLabels.includes(label), `missing workforce route label ${label}`);
  }
  assert.ok(workforceContentLabels.includes('Workforce Operations dashboard'), 'missing workforce dashboard label');
  assert.ok(workforceContentLabels.includes('Request emergency staffing override approval'), 'missing workforce approval control label');
  assert.match(textFrom(routeContent.workforce), /Staffing readiness/);
  assert.match(textFrom(routeContent.workforce), /Incident command refresh/);
  assert.match(textFrom(routeContent.workforce), /Emergency Liaison/);
  assert.match(textFrom(routeContent.workforce), /Request emergency staffing override approval/);
  assert.match(textFrom(routeContent.workforce), /twin:workforce/);

  for (const [route, content] of Object.entries(routeContent)) {
    const labels = labelsFor(content);
    assert.equal(labels.includes('Facilities and workforce operations hub'), false, `${route} should not render the old combined hub`);
  }
  assert.equal(assetLabels.includes('Facilities Maintenance workspace'), false);
  assert.equal(assetLabels.includes('Workforce Operations dashboard'), false);
  assert.equal(facilityLabels.includes('Asset Registry workspace'), false);
  assert.equal(facilityLabels.includes('Workforce Operations dashboard'), false);
  assert.equal(workforceLabels.includes('Asset Registry workspace'), false);
  assert.equal(workforceLabels.includes('Facilities Maintenance workspace'), false);
});

test('Barn Operations client exposes mock data and live endpoint contract', async () => {
  const mock = await createMockClient().getBarnOperations();
  assert.equal(mock.mock, true);
  assert.equal(mock.occupancy[0].twinId, 'equine:horse-1');
  assert.ok(mock.restrictions[0].eventId.startsWith('barn.restriction'));
  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => { requested = url; return { ok: true, json: async () => ({ barns: [], stalls: [], occupancy: [], movements: [], access: [], inspections: [], restrictions: [], trainers: [], vetVisits: [], readiness: [], mock: false }) }; };
  try {
    const live = await createLiveClient('https://api.example.test/api/v1').getBarnOperations();
    assert.equal(requested, 'https://api.example.test/api/v1/barn-operations/workspace');
    assert.equal(live.mock, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('Facilities Maintenance frontend renders RACR-backed assets, PM, work orders, predictions, and approval gates', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.facilitiesMaintenance.operationalActionsRequireApproval, true);
  assert.ok(data.facilitiesMaintenance.assets.every((asset) => asset.sourceOfTruth === 'racetrack-asset-registry' && asset.twinId));
  assert.ok(data.facilitiesMaintenance.workOrders.some((order) => order.approvalRequestId && order.workflowInstanceId));
  assert.ok(data.facilitiesMaintenance.inspections.some((inspection) => inspection.assetId === 'PATRON_ELEVATOR_A'));
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/facilities' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const label of ['Facilities Maintenance workspace','Facilities readiness summary','Facility asset health table','Facilities inspection records','Preventive maintenance schedule','Facilities work orders','Predictive maintenance hooks','Facilities approval and audit integrations','Request facility work order approval','Request return-to-service approval']) assert.ok(labels.includes(label), `missing ${label}`);
  assert.match(textFrom(tree), /RACR-backed facility assets/);
  assert.match(textFrom(tree), /facility-maintenance-execution:pending/);
  assert.match(textFrom(tree), /Patron Elevator A/);
  assert.match(textFrom(tree), /Predictive-maintenance placeholder/);
  assert.match(textFrom(tree), /Mock data active via facilities-maintenance mock adapter/);
  assert.match(textFrom(tree), /twin:GRANDSTAND_HVAC_01/);
});

test('Facilities Maintenance client exposes mock data and live endpoint contract', async () => {
  const mock = await createMockClient().getFacilitiesMaintenance();
  assert.equal(mock.mock, true);
  assert.equal(mock.integrations.assetRegistry, true);
  assert.ok(mock.predictiveHooks.length >= 1);
  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => { requested = url; return { ok: true, json: async () => ({ ...mock, mock: false }) }; };
  try {
    const live = await createLiveClient('https://api.example.test/api/v1').getFacilitiesMaintenance();
    assert.equal(requested, 'https://api.example.test/api/v1/facilities-maintenance/workspace');
    assert.equal(live.mock, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('Steward Center renders harmonized steward workflow with AI boundaries and human-only final controls', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['steward'], authenticated: true, path: '/stewards' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Steward Center workspace','Steward AI assistance boundaries','Steward command summary','Steward inquiry queue','Steward objection cases','Steward investigation workflow','Steward involved horses and jockeys','Steward evidence timeline','Steward evidence custody timeline','Steward rule reference panel','Steward decision draft panel','Steward appeal package placeholder','Steward human-only final ruling controls','Steward approval audit event telemetry','Steward audit records']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.equal(labels.includes('Deprecated Steward Center workspace'), false);
  assert.match(textFrom(tree), /AI may summarize and organize evidence only/);
  assert.match(textFrom(tree), /AI cannot issue official rulings/);
  assert.match(textFrom(tree), /AI result mutation\s+false/);
  assert.match(textFrom(tree), /official ruling\s+false/);
  assert.match(textFrom(tree), /Investigation Workflow/);
  assert.match(textFrom(tree), /Final-ruling prerequisite check requires evidence hash, custody chain, legal hold, audit record, event record, and evidence-vault record/);
  assert.match(textFrom(tree), /Video review placeholder requires secured evidence service/);
  assert.match(textFrom(tree), /No appeal package exported yet/);
  assert.match(textFrom(tree), /officialResultsModified=false/);
  assert.match(textFrom(tree), /no direct local mutation of official decisions/i);
  assert.match(textFrom(tree), /approval\/audit\/event prerequisites complete:\s+false/i);
  const finalRulingControl = collect(tree, (node) => node.type?.name === 'SafetyCriticalActionButton' && node.props?.ariaLabel === 'Issue final ruling requires live human steward verification')[0];
  assert.equal(finalRulingControl.props.approvalsSatisfied, false);
  assert.equal(finalRulingControl.props.backendLive, false);
  assert.equal(finalRulingControl.props.authenticated, true);
  const placeholderButtons = collect(tree, (node) => node.type === 'button' && ['Save steward decision draft placeholder','Export steward appeal package placeholder'].includes(String(node.props?.['aria-label'] ?? '')));
  assert.equal(placeholderButtons.length, 2);
  assert.ok(placeholderButtons.every((button) => button.props.disabled === true));
});

test('Steward Center full workspace is routed only under canonical /stewards', async () => {
  const data = await loadCommandCenter(createMockClient());
  const operationsTree = CommandCenter({ data, roles: ['steward'], authenticated: true, path: '/operations' });
  const stewardTree = CommandCenter({ data, roles: ['steward'], authenticated: true, path: '/stewards' });
  const aliasTree = CommandCenter({ data, roles: ['steward'], authenticated: true, path: '/stewarding' });
  const operationsLabels = collect(operationsTree, (node) => node.type !== 'a' && Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const stewardLabels = collect(stewardTree, (node) => node.type !== 'a' && Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const aliasContent = collect(aliasTree, (node) => node.props?.id === 'command-center-content')[0];

  assert.equal(canonicalPathForRoute('/stewarding'), '/stewards');
  assert.equal(canonicalPathForRoute('/steward-center'), '/stewards');
  assert.equal(operationsLabels.includes('Steward Center workspace'), false);
  assert.equal(operationsLabels.includes('Steward evidence timeline'), false);
  assert.ok(stewardLabels.includes('Steward Center workspace'));
  assert.equal(aliasContent.props['data-route'], '/stewards');
  assert.match(textFrom(aliasTree), /Legacy Route Redirect/);
});

test('Steward Center live client uses inquiry endpoint contract', async () => {
  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => { requested = url; return { ok: true, json: async () => ({ inquiries: [], permissions: { canRead: true, canDraft: false, canFinalize: false, canExportAppeal: false }, mock: false }) }; };
  try {
    const result = await createLiveClient('https://api.example.test/api/v1').getStewardCenter();
    assert.equal(requested, 'https://api.example.test/api/v1/stewarding/inquiries');
    assert.equal(result.mock, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('Compliance Control Library dashboard renders frameworks, controls, evidence links, owners, actions, cycles, and readiness', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.ok(data.complianceLibrary.frameworks.length >= 11);
  assert.ok(data.complianceLibrary.frameworks.some((framework) => framework.id === 'ISO-42001'));
  assert.ok(data.complianceLibrary.controls.some((control) => control.frameworkIds.includes('ISO-25010')));
  assert.ok(data.complianceLibrary.evidencePackages.some((pkg) => pkg.readiness === 'audit-ready' && pkg.sealed));
  assert.ok(data.complianceLibrary.accreditationPrograms.some((program) => program.status === 'ready-for-accreditor'));
  assert.equal(data.complianceLibrary.trackCertificationCandidate.externalCertificationClaimed, false);
  assert.equal(data.complianceLibrary.trackCertificationCandidate.certificationCriteria.length, 7);
  assert.equal(data.complianceLibrary.integrations.approvals, true);
  assert.equal(data.complianceLibrary.readiness.evidenceCoverage, 100);
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/compliance' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Compliance Control Library dashboard','Compliance pending control queue','Compliance evidence record panels','Compliance correlation and export panel','TrackMind Certified Track candidate','Certified Track criteria','Franchise operating standards','Compliance framework placeholders','Compliance controls','Compliance AI governance crosswalk','Compliance obligations','Control owners and permissions','Compliance findings and corrective actions','Compliance evidence packages and AI audit trails','Compliance review cycles','Audit readiness score by framework','Compliance control assessments','Compliance framework mappings','Compliance evidence packages','Accreditation readiness programs','Compliance audit readiness events','Compliance integration coverage']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /Governed AI evidence trail/);
  assert.match(textFrom(tree), /ISO 25010/);
  assert.match(textFrom(tree), /ev-ai-approval/);
  assert.match(textFrom(tree), /evidence-rec-harrow-7/);
  const complianceRecordLabels = collect(tree, (node) => node.type?.name === 'RecordSourceLabel').map((node) => node.props.label);
  assert.ok(complianceRecordLabels.includes('compliance framework'));
  const complianceActions = collect(tree, (node) => node.type?.name === 'GovernedActionButton').map((node) => node.props.label);
  assert.ok(complianceActions.includes('Request compliance filing approval'));
  assert.match(textFrom(tree), /Audit readiness score/);
  assert.match(textFrom(tree), /TrackMind readiness\/certification candidate only/);
  assert.match(textFrom(tree), /Safety Score/);
});

test('Compliance Control Library live client uses endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({ frameworks: [], controls: [], obligations: [], owners: [], findings: [], correctiveActions: [], reviewCycles: [], readiness: { score: 0, totalControls: 0, effectiveControls: 0, evidenceCoverage: 0, openFindings: 0, overdueActions: 0, byFramework: [] }, mock: false }) }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getComplianceLibrary();
    assert.equal(requestUrl, 'https://api.example.test/api/v1/compliance/control-library');
  } finally {
    globalThis.fetch = original;
  }
});

test('AI Governance workspace renders governed recommendations, blocked actions, evidence packages, approvals, and audit trails', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.aiGovernance.activeAgents[0].status, 'active');
  assert.ok(data.aiGovernance.recommendationQueue.every((rec) => rec.evidence.length > 0 && rec.confidence > 0 && rec.affectedAssets.length > 0 && rec.approvalPolicy && rec.lineage.length >= 3));
  assert.ok(data.aiGovernance.safetyBlockedActions.some((blocked) => blocked.action === 'race-start'));
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/ai-governance' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['AI Governance workspace', 'AI Control Plane cards', 'Unified AI/ML Control Plane pipeline', 'Expert module roster', 'ISO 42001 and NIST AI RMF governance anchors', 'Active AI agents', 'AI model versions and prompt templates', 'AI recommendation queue', 'AI control plane recommendation cards', 'Confidence and evidence panel for rec-harrow-7', 'Safety-blocked AI actions', 'Blocked-action log for protected controls', 'AI evaluation status', 'AI risk classifications', 'AI evidence packages', 'AI approval requirements', 'Approval-required workflows and human-in-the-loop policy', 'AI safety policies', 'AI Digital Twin impacts', 'AI observability signals', 'AI governance export package layout', 'AI advisory approval gates', 'AI control plane approval controls', 'AI override records', 'AI rollback records', 'AI governance events', 'AI audit trails']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  const aiGateButtons = collect(tree, (node) => node.type?.name === 'GovernedActionButton' && /^Request (AI|protected AI)/.test(String(node.props?.label ?? '')));
  assert.equal(aiGateButtons.length, 4);
  assert.equal(aiGateButtons.every((button) => button.props.approvalApi.includes('/approvals/controlled-actions')), true);
  const renderedButtons = collect(tree, (node) => node.type === 'button' && /^Request AI/.test(String(node.props?.['aria-label'] ?? '')));
  assert.equal(renderedButtons.length, 4);
  assert.equal(renderedButtons.every((button) => button.props.disabled === true && button.props['aria-disabled'] === 'true'), true);
  assert.match(textFrom(tree), /Responsible AI workspace/);
  assert.match(textFrom(tree), /Unified AI\/ML Control Plane/);
  assert.match(textFrom(tree), /Inputs -> Feature Store -> Model Registry -> Expert Models -> AI Governor -> Approved Outputs/);
  for (const module of ['Surface Risk', 'Race Readiness', 'Gate Position', 'Equine Advisory', 'Security Anomaly', 'Weather Impact', 'Maintenance Forecast', 'Steward Evidence Assistant', 'Executive Intelligence']) {
    assert.match(textFrom(tree), new RegExp(module));
  }
  assert.match(textFrom(tree), /advisory decision support only/i);
  assert.match(textFrom(tree), /AI may recommend\/summarize\/classify\/forecast\/simulate\/draft only; no autonomous race\/gate\/vet\/steward\/payout\/emergency controls/);
  assert.match(textFrom(tree), /adjusted confidence/);
  assert.match(textFrom(tree), /Confidence badge/);
  assert.match(textFrom(tree), /Approval-required roles/);
  assert.match(textFrom(tree), /blockedAutonomousExecution:\s+true/);
  assert.match(textFrom(tree), /NIST AI RMF/);
  assert.match(textFrom(tree), /No direct local mutation/);
  assert.match(textFrom(tree), /model-surface-advisor-v2/);
  const aiRecordLabels = collect(tree, (node) => node.type?.name === 'RecordSourceLabel').map((node) => node.props.label);
  assert.ok(aiRecordLabels.includes('AI agent registry record'));
  assert.ok(aiRecordLabels.includes('AI control-plane recommendation'));
  const mockBannerSources = collect(tree, (node) => node.type?.name === 'MockDataBanner').map((node) => node.props.source);
  assert.ok(mockBannerSources.includes('AI Governance mock/live facade'));
  assert.match(textFrom(tree), /AI cannot execute protected race-start actions/);
});

test('governance routes stay distinct without shared governance dump', async () => {
  const data = await loadCommandCenter(createMockClient());
  const routes = ['/approvals', '/audit', '/compliance', '/ai-governance'];
  const routeLabels = routes.map((path) => collect(CommandCenter({ data, roles: ['admin'], authenticated: true, path }), (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']));
  for (const labels of routeLabels) {
    assert.equal(labels.includes('Compliance and AI governance harmonization'), false);
    assert.equal(labels.includes('Governance framework crosswalk'), false);
  }
  assert.ok(routeLabels[0].includes('Approvals work area'));
  assert.ok(routeLabels[1].includes('Audit ledger work area'));
  assert.ok(routeLabels[2].includes('Compliance Control Library dashboard'));
  assert.ok(routeLabels[3].includes('AI Governance workspace'));
});

test('Platform Health workspace renders service, event, audit, approval, AI, twin, latency, readiness, and frontend degraded status', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const label of ['Platform Health workspace','Platform Health KPI dashboard','Racing Operating System standardization view','TRACKMIND OS tree','Universal Schema coverage','SaaS tiers and deployment modes','Certified Track criteria and scores','Unified data model stores','Intelligence Core shared layers','ROS standardization safety disclaimers','Platform health trend cards','Platform operational readiness dashboard','Service health and dependencies','System dependency view','Event bus health','Audit health','Approval engine health','AI governance health','Digital Twin health','Workflow status','Operational readiness health','API latency metrics','Frontend error reporting','Internet-facing deployment assumptions']) assert.ok(labels.includes(label), `missing ${label}`);
  assert.match(textFrom(tree), /Frontend degraded state active/);
  assert.match(textFrom(tree), /queued sync\s+5/);
  assert.match(textFrom(tree), /PlatformHealthWorkspaceDto/);
  assert.match(textFrom(tree), /System dependency health matrix/);
  assert.match(textFrom(tree), /api-gateway/);
  assert.match(textFrom(tree), /separate operational feed/i);
  assert.match(textFrom(tree), /HTTPS/);
  assert.match(textFrom(tree), /WAF/);
  assert.match(textFrom(tree), /frontend-error logs/);
  assert.match(textFrom(tree), /Infrastructure implemented:\s+false/);
  assert.match(textFrom(tree), /copy-only label:\s+true/);
  assert.match(textFrom(tree), /not proof of configured infrastructure/);
});

test('ROS standardization renders only on the routed Platform Health workspace with candidate labels', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.equal(data.platformHealth.rosStandardization.readOnly, true);
  assert.equal(data.platformHealth.rosStandardization.externalCertification, false);
  assert.equal(data.platformHealth.rosStandardization.osTree.length, 9);
  assert.deepEqual(data.platformHealth.rosStandardization.universalSchemaCoverage.map((item) => item.area), ['entities','events','workflows','approvals','twins','AI','audit','compliance']);

  const platformTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const operationsTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const executiveTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/executive' });
  const platformText = textFrom(platformTree);

  for (const required of ['Operations OS','Safety OS','Compliance OS','AI OS','Digital Twin OS','Command Center OS','Accreditation OS','Multi-Track Federation OS','Racing Intelligence Network']) {
    assert.match(platformText, new RegExp(required));
  }
  assert.match(platformText, /readiness\/certification candidate/i);
  assert.match(platformText, /not external certification/i);
  assert.match(platformText, /No unsafe actions/i);
  assert.match(platformText, /No race, gate, veterinary, steward, payout, emergency, surface, facility, security, or Digital Twin state is mutated/i);
  assert.match(platformText, /Starter Track/);
  assert.match(platformText, /Enterprise Federation/);
  assert.match(platformText, /Operational event store/);
  assert.match(platformText, /Event and audit backbone/);
  assert.doesNotMatch(textFrom(operationsTree), /Racing Operating System standardization view|TRACKMIND OS Tree/);
  assert.doesNotMatch(textFrom(executiveTree), /Racing Operating System standardization view|TRACKMIND OS Tree/);
});

test('Executive Center harmonizes read-only KPI, trend, service, and platform health context', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/executive' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const label of ['Executive Intelligence Center workspace','Executive Center KPI dashboard','Executive trend cards','Executive service health','Executive safety KPI dashboard','Executive compliance KPI dashboard','Executive asset health dashboard','Executive operational readiness','Executive operational drill-down','Executive briefing cards','Executive mock and placeholder coverage']) assert.ok(labels.includes(label), `missing ${label}`);
  assert.match(textFrom(tree), /Executive Center is read-only/i);
  assert.match(textFrom(tree), /does not assert unavailable revenue, wagering, attendance, or finance feeds are complete/i);
  assert.match(textFrom(tree), /Revenue KPI is marked not connected/i);
  assert.match(textFrom(tree), /approval workflows/i);
  assert.match(textFrom(tree), /Revenue, wagering, attendance, and finance telemetry are not connected/);
  assert.match(textFrom(tree), /Mock adapter active for executive context/);
});

test('frontend platform health client uses live health endpoint and mock degraded state', async () => {
  const mock = await createMockClient().getPlatformHealth();
  assert.equal(mock.frontend.degradedMode, true);
  assert.equal(mock.telemetrySchema.consistent, true);
  assert.equal(mock.deploymentBoundary.providerStyle, 'Azure Front Door-style edge');
  assert.equal(mock.deploymentBoundary.implemented, false);
  assert.equal(mock.deploymentBoundary.copyOnly, true);
  assert.ok(mock.deploymentBoundary.assumptions.includes('WAF'));
  assert.ok(mock.deploymentBoundary.loggingSignals.includes('frontend-error'));
  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => { requested = url; return { ok:true, json: async () => mock }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getPlatformHealth();
    assert.equal(requested, 'https://api.example.test/api/v1/platform/health');
  } finally {
    globalThis.fetch = original;
  }
});

test('Workforce Operations client exposes governed scheduling, compliance, events, audit, and twin sync', async () => {
  const mock = await createMockClient().getWorkforceOperations();
  assert.equal(mock.mock, true);
  assert.equal(mock.readiness.raceDayCheck.domain, 'staffing');
  assert.equal(mock.compliance.status, 'non-compliant');
  assert.ok(mock.employees.every((employee) => employee.identity.tenantId === mock.tenantId));
  assert.ok(mock.certifications.every((cert) => cert.auditId && cert.eventId));
  assert.ok(mock.assignments.some((assignment) => assignment.digitalTwinRef.startsWith('twin:workforce:')));
  assert.ok(mock.compliance.expiringCertifications.length >= 1);
  assert.ok(mock.compliance.overdueTraining.length >= 1);
  assert.ok(mock.approvals.some((approval) => approval.action === 'emergency-personnel-override'));
  assert.ok(mock.digitalTwinSync.length >= 1);

  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => { requested = url; return { ok: true, json: async () => mock }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getWorkforceOperations();
    assert.equal(requested, 'https://api.example.test/api/v1/workforce-operations/workspace');
  } finally {
    globalThis.fetch = original;
  }
});

test('Command Center renders Workforce Operations dashboard and emergency workforce readiness', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/workforce' });
  const emergencyTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/emergency' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Workforce Operations dashboard', 'Workforce employee profiles', 'Workforce employee records', 'Workforce scheduling dashboard', 'Workforce certifications and training', 'Workforce training expiration alerts', 'Workforce readiness and planning', 'Workforce compliance tracking', 'Workforce event audit and twin integration', 'Emergency staffing approval gates']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /Staffing readiness/);
  assert.match(textFrom(tree), /Incident command refresh/);
  assert.match(textFrom(tree), /Emergency Liaison/);
  assert.match(textFrom(tree), /Request emergency staffing override approval/);
  assert.match(textFrom(tree), /local safety-critical state/);
  assert.match(textFrom(tree), /twin:workforce/);
  assert.match(textFrom(emergencyTree), /Workforce emergency readiness/);
});

test('command-center shell renders race-day status, notifications, approval-safe actions, and responsive workspace grid', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/operations' });
  const platformTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Race-day status indicators', 'Command center notifications', 'Approval-safe action library', 'Responsive command center dashboard grid', 'Approval-safe action rail', 'Metric strip', 'Notification list']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(tree), /Frontend controls create approval requests/);
  assert.match(textFrom(platformTree), /Mobile command surface prioritizes alerts/);
});

test('asset registry, digital twin visualization, executive intelligence, and accessibility support render from routed shared DTOs', async () => {
  const data = await loadCommandCenter(createMockClient());
  const assetTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/assets' });
  const twinTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/digital-twin' });
  const executiveTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/executive' });
  const platformTree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/platform-health' });
  const labels = [assetTree, twinTree, executiveTree, platformTree].flatMap((tree) => collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']));
  for (const required of ['Asset Registry workspace', 'Asset registry table', 'Asset health summary', 'Asset Digital Twin links', 'Digital Twin asset graph and relationship view', 'Digital Twin dependency view', 'Digital Twin simulation placeholders', 'Digital Twin approval-gated controls', 'Executive Intelligence Center workspace', 'Executive briefing cards', 'Accessibility and responsive layout support']) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }
  assert.match(textFrom(assetTree), /Lifecycle and safety changes require approvals/);
  assert.match(textFrom(executiveTree), /decision context without direct operational mutation/);
});

test('approval-safe action library only points to approval request APIs and remains locked by default', () => {
  const actions = commandCenterApprovalActions();
  assert.ok(actions.length >= 4);
  assert.ok(actions.every((action) => action.locked === true));
  assert.ok(actions.every((action) => action.approvalApi.includes('/approvals/') || action.approvalApi.includes('/track-configuration/')));
  assert.ok(actions.some((action) => action.approvalApi.includes('/track-configuration/draft-requests')));
  assert.ok(actions.some((action) => action.detail.includes('does not start the race')));
});

test('routing registry stays synchronized across navigation, route audits, and Nexus package workspaces', async () => {
  const data = await loadCommandCenter(createMockClient());
  const navById = new Map(navItems.map((item) => [item.id, item]));
  const workspaceById = new Map(data.nexusUpgrade.workspaces.map((workspace) => [workspace.id, workspace]));

  for (const screen of domainScreens) {
    const item = navById.get(screen.id);
    assert.ok(item, `${screen.id} must be present in primary navigation`);
    assert.equal(screen.route, item.path, `${screen.id} route must match navigation`);
    assert.equal(item.eventReady, true, `${screen.id} must be event-stream ready`);
    assert.ok(screen.liveApi || screen.mockReason, `${screen.id} must declare a live API or approved mock boundary`);

    const workspace = workspaceById.get(screen.id);
    assert.ok(workspace, `${screen.id} must be present in the Nexus upgrade package`);
    assert.equal(workspace.route, screen.route, `${screen.id} workspace route must match route audit`);
    assert.equal(workspace.title, item.label, `${screen.id} workspace title must match canonical navigation label`);
  }
});

test('route metadata aligns with TrackMind OS and Universal Schema package coverage', async () => {
  const data = await loadCommandCenter(createMockClient());
  const workspaceById = new Map(data.nexusUpgrade.workspaces.map((workspace) => [workspace.id, workspace]));
  const osById = new Map(data.nexusUpgrade.trackMindOS.map((component) => [component.id, component]));
  const coverageIds = new Set(data.nexusUpgrade.universalSchemaCoverage.map((coverage) => coverage.id));
  const navById = new Map(navItems.map((item) => [item.id, item]));

  for (const item of navItems) {
    const workspace = workspaceById.get(item.id);
    assert.ok(workspace, `${item.id} workspace metadata missing`);
    assert.equal(item.readinessStatus, workspace.status, `${item.id} readiness status must match Nexus package`);
    assert.ok(item.osComponentIds.length > 0, `${item.id} OS metadata missing`);
    assert.ok(item.universalSchemaCoverage.length > 0, `${item.id} Universal Schema coverage missing`);
    for (const coverage of item.universalSchemaCoverage) assert.ok(coverageIds.has(coverage), `${item.id} references unknown coverage ${coverage}`);
    for (const osId of item.osComponentIds) {
      const os = osById.get(osId);
      assert.ok(os, `${item.id} references unknown OS component ${osId}`);
      assert.ok(os.routeIds.includes(item.id), `${osId} must include route ${item.id}`);
    }
  }

  for (const screen of domainScreens) {
    const item = navById.get(screen.id);
    assert.ok(item, `${screen.id} nav metadata missing`);
    assert.deepEqual(screen.osComponentIds, item.osComponentIds);
    assert.deepEqual(screen.universalSchemaCoverage, item.universalSchemaCoverage);
    assert.equal(screen.readinessStatus, item.readinessStatus);
  }
});

test('role-filtered shell hides restricted navigation and marks unavailable route audits as permission denied', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['read-only-auditor'], path: '/starting-gate', paletteQuery: 'approval' });
  const visibleLinks = collect(tree, (node) => node.type === 'a' && node.props?.['data-route-id']).map((node) => ({ href: node.props.href, label: textFrom(node) }));
  assert.ok(visibleLinks.some((link) => link.href === '/operations'));
  assert.equal(visibleLinks.some((link) => link.href === '/starting-gate'), false);
  assert.equal(visibleLinks.some((link) => link.href === '/approvals'), false);

  const activeWorkspace = collect(tree, (node) => node.props?.id === 'command-center-content')[0];
  assert.equal(activeWorkspace.props['data-active-workspace'], 'starting-gate');
  assert.match(textFrom(activeWorkspace), /Permission denied/);
  assert.match(textFrom(tree), /Nexus .* Starting Gate Control/);
});

test('navigation groups and command palette expose only role-visible destinations', () => {
  const trackSuperintendentGroups = groupedVisibleNavItems(['track-superintendent']);
  assert.ok(trackSuperintendentGroups.every((group) => group.items.length > 0));
  assert.deepEqual(trackSuperintendentGroups.map((group) => group.section.id), ['operations', 'equine', 'safety', 'facilities', 'governance', 'intelligence', 'executive', 'platform-admin']);
  const facilitiesGroup = trackSuperintendentGroups.find((group) => group.section.id === 'facilities');
  assert.ok(facilitiesGroup);
  assert.ok(facilitiesGroup.items.some((item) => item.id === 'workforce'));
  assert.equal(groupHasActiveItem('/workforce/shifts/today', facilitiesGroup), true);

  const palettePaths = filterCommandPalette('  SURFACE  ', ['track-superintendent']).map((item) => item.path);
  assert.ok(palettePaths.includes('/surface'));
  assert.ok(palettePaths.every((path) => path === '/surface' || path === '/safety'));

  const auditorPalette = filterCommandPalette('', ['read-only-auditor']).map((item) => item.path);
  assert.ok(auditorPalette.includes('/operations'));
  assert.ok(auditorPalette.includes('/api-hub'));
  assert.ok(auditorPalette.includes('/api-hub/data-lake-exports'));
  assert.ok(auditorPalette.includes('/platform-health'));
  assert.equal(auditorPalette.includes('/approvals'), false);
  assert.equal(auditorPalette.includes('/ai-governance'), false);
});

test('app shell exposes accessible names for key controls and tenant fallback selection', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], tenantId: 'unknown-track', path: '/surface', paletteQuery: 'gate' });
  assert.equal(tree.type, 'main');

  const controls = collect(tree, (node) => ['a', 'button', 'input', 'select'].includes(node.type));
  assert.ok(controls.length > 0);
  for (const control of controls) {
    const accessibleName = String(control.props?.['aria-label'] ?? textFrom(control)).trim();
    assert.ok(accessibleName.length > 0, `${control.type} control should have accessible text or aria-label`);
  }

  const tenantSelector = collect(tree, (node) => node.type === 'select' && node.props?.['aria-label'] === 'Tenant racetrack selector')[0];
  assert.equal(tenantSelector.props.defaultValue, 'saratoga');
  const emergencyBanner = collect(tree, (node) => node.props?.id === 'emergency-banner-zone')[0];
  assert.equal(emergencyBanner.props['aria-label'], 'Emergency banner zone');
  assert.equal(emergencyBanner.props.role, 'alert');
  const contentFrame = collect(tree, (node) => node.props?.id === 'command-center-content')[0];
  assert.equal(contentFrame.props.className, 'route-content-frame');
  assert.equal(contentFrame.props.tabIndex, -1);
  assert.match(textFrom(tree), /Mock data active|MOCK DATA|mock adapter/i);
});

test('legacy App entry is quarantined from the active command-center shell', () => {
  const app = App();
  assert.equal(app.props['aria-label'], 'Quarantined legacy app entry');
  assert.match(textFrom(app), /Legacy standalone app entry quarantined/);
  assert.match(textFrom(app), /CommandCenter/);
});

test('generated dashboard output is refreshed and does not retain obsolete steward UI symbols', () => {
  const generated = readFileSync(new URL('../dist/App.js', import.meta.url), 'utf8');
  assert.match(generated, /Quarantined legacy app entry/);
  assert.doesNotMatch(generated, /stewardFinalRulingReady|stewardGuardrails|stewardEvidenceTimeline/);
  assert.doesNotMatch(generated, /Nexus operational workspace blueprint/);
});

test('unauthenticated route renders login-ready content inside the Nexus shell', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: false });
  assert.equal(tree.type, 'main');
  assert.equal(tree.props['aria-label'], 'TrackMind Nexus command center shell');
  assert.match(textFrom(tree), /Please sign in/);
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.equal(labels.includes('Persistent sidebar'), true);
  assert.equal(labels.includes('Quick-access command palette'), true);
  const activeFrame = collect(tree, (node) => node.props?.id === 'command-center-content')[0];
  assert.equal(activeFrame.props['data-active-workspace'], 'login');
  assert.doesNotMatch(textFrom(tree), /Unified Operations Command Center|Nexus operational workspace blueprint/);
});

test('loading, empty, error, and mock-ready states render stable accessible copy', () => {
  assert.match(textFrom(DataState({ state: { status: 'loading' }, children: () => null })), /Loading live operational data/);
  assert.match(textFrom(DataState({ state: { status: 'empty', mock: true }, children: () => null })), /No records available .*mock adapter active/);

  const errorState = DataState({ state: { status: 'error', message: 'Telemetry delayed', mock: false }, children: () => null });
  assert.equal(errorState.props.role, 'alert');
  assert.match(textFrom(errorState), /Unable to load live data: Telemetry delayed/);

  const readyState = DataState({ state: { status: 'ready', data: { label: 'read-only payload' }, mock: true }, children: (value) => React.createElement('span', null, value.label) });
  assert.match(textFrom(readyState), /Mock data/);
  assert.match(textFrom(readyState), /read-only payload/);
});

test('approval-required and safety-critical controls stay disabled in mock shell', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true });
  const protectedButtons = collect(tree, (node) => node.type === 'button')
    .filter((button) => /^(Request|Draft|Issue|Escalate|Open|Reveal)/.test(String(button.props?.['aria-label'] ?? textFrom(button))));
  assert.ok(protectedButtons.length >= 10);
  assert.ok(protectedButtons.every((button) => button.props.disabled === true));

  const locked = SafetyCriticalActionButton({ approvalsSatisfied: false, backendLive: true, authenticated: true, children: 'Release starting gate' });
  const lockedButton = collect(locked, (node) => node.type === 'button')[0];
  assert.equal(lockedButton.props.disabled, true);
  assert.equal(lockedButton.props['aria-disabled'], true);
  assert.equal(lockedButton.props['aria-describedby'], 'safety-lock-reason');
  assert.match(textFrom(locked), /Disabled until authenticated live backend returns a valid approval token/);

  const unlocked = SafetyCriticalActionButton({ approvalsSatisfied: true, backendLive: true, authenticated: true, children: 'Release starting gate' });
  const unlockedButton = collect(unlocked, (node) => node.type === 'button')[0];
  assert.equal(unlockedButton.props.disabled, false);
  assert.equal(unlockedButton.props['aria-disabled'], false);
  assert.equal(unlockedButton.props['aria-describedby'], undefined);
});
