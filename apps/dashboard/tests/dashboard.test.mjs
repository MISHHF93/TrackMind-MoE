import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockClient, createLiveClient } from '../dist/api/client.js';
import { loadCommandCenter, isSafetyCriticalEnabled, requestRaceStartApproval } from '../dist/App.js';
import { visibleNavItems } from '../dist/shell/navigation.js';
import { domainScreens } from '../dist/shell/domains.js';

test('routing exposes all command-center domain screens with role visibility', () => { const admin = visibleNavItems(['admin']).map((i)=>i.id); assert.ok(admin.includes('operations')); assert.ok(admin.includes('ai-governance')); const auditor = visibleNavItems(['read-only-auditor']).map((i)=>i.id); assert.ok(auditor.includes('operations')); assert.equal(auditor.includes('starting-gate'), false); });

test('safety-critical button remains disabled without live approval token', () => { assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:false, backendMode:'live' }), false); assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:true, backendMode:'mock' }), false); assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:true, backendMode:'live' }), true); });

test('approval-required flow calls backend adapter instead of mutating local state', async () => { const result = await requestRaceStartApproval(createMockClient(), 'starter-1', 'race-7'); assert.equal(result.accepted, true); assert.equal(result.eventType, 'approval.requested'); assert.equal(result.audited, true); assert.equal(result.mock, true); });

test('mock adapter is clearly marked and live adapter uses configured backend paths', async () => { const mockData = await loadCommandCenter(createMockClient()); assert.equal(mockData.mode, 'mock'); assert.equal(mockData.trackMap.mock, true); const live = createLiveClient('https://api.example.test/api/v1'); assert.equal(live.mode, 'live'); assert.equal(live.eventStreamUrl(), 'https://api.example.test/api/v1/events/stream'); });

test('API error handling surfaces live adapter failures', async () => { const original = globalThis.fetch; globalThis.fetch = async () => ({ ok:false, status:503, statusText:'Unavailable' }); await assert.rejects(() => createLiveClient('https://api.example.test').listApprovals(), /503 Unavailable/); globalThis.fetch = original; });

test('domain screen registry covers every Nexus command-center module with routes and event readiness', () => {
  assert.equal(domainScreens.length, 15);
  for (const screen of domainScreens) {
    assert.ok(screen.route.startsWith('/'));
    assert.ok(screen.owner.length > 0);
    assert.ok(screen.eventStreams.length > 0);
  }
  assert.ok(domainScreens.find((screen) => screen.id === 'starting-gate').stateChangingActions.every((action) => action.includes('approval') || action.includes('controlled')));
});

test('live controlled actions POST to the approval-aware backend path with JSON body', async () => {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ accepted: true, approvalId: 'approval-1', eventType: 'approval.requested', audited: true, message: 'queued', mock: false }) };
  };
  const result = await createLiveClient('https://api.example.test/api/v1').requestControlledAction({ action: 'race-start', target: 'race-7', reason: 'test', actor: 'starter-1' });
  assert.equal(result.audited, true);
  assert.equal(request.url, 'https://api.example.test/api/v1/approvals/controlled-actions');
  assert.equal(request.init.method, 'POST');
  assert.equal(JSON.parse(request.init.body).action, 'race-start');
  globalThis.fetch = original;
});
import React from 'react';
import { CommandCenter } from '../dist/App.js';
import { breadcrumbForPath, filterCommandPalette, selectTenant, serviceBanner } from '../dist/shell/experience.js';

function textFrom(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFrom).join(' ');
  if (React.isValidElement(node)) return textFrom(node.props.children);
  return '';
}

function collect(node, predicate, out = []) {
  if (node == null || typeof node === 'boolean') return out;
  if (Array.isArray(node)) { node.forEach((child) => collect(child, predicate, out)); return out; }
  if (React.isValidElement(node)) {
    if (predicate(node)) out.push(node);
    collect(node.props.children, predicate, out);
  }
  return out;
}

test('app shell renders persistent layout, command bar, breadcrumbs, tenant selector, notifications, and palette', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], path: '/surface', paletteQuery: 'gate' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('Persistent sidebar'));
  assert.ok(labels.includes('Top command bar'));
  assert.ok(labels.includes('Global search'));
  assert.ok(labels.includes('Breadcrumb'));
  assert.ok(labels.includes('Tenant racetrack selector'));
  assert.ok(labels.includes('Notification center'));
  assert.ok(labels.includes('Quick-access command palette'));
  assert.match(textFrom(tree), /Nexus .* Surface Intelligence/);
});

test('tenant switching helpers resolve known and fallback racetracks', () => {
  assert.equal(selectTenant('belmont').name, 'Belmont Park');
  assert.equal(selectTenant('missing').id, 'saratoga');
  assert.deepEqual(breadcrumbForPath('/starting-gate'), ['Nexus', 'Starting Gate Control']);
});

test('command palette filters by role and query', () => {
  const auditorGate = filterCommandPalette('gate', ['read-only-auditor']).map((item) => item.label);
  assert.equal(auditorGate.some((label) => label.includes('Starting Gate')), false);
  const adminGate = filterCommandPalette('gate', ['admin']).map((item) => item.label);
  assert.ok(adminGate.some((label) => label.includes('Starting Gate')));
});

test('degraded and offline banners communicate locked safety posture', () => {
  assert.match(serviceBanner('degraded', false).message, /Degraded service/);
  const offline = serviceBanner('offline', false);
  assert.equal(offline.tone, 'critical');
  assert.match(offline.message, /Safety-critical controls remain locked/);
});

test('rendered safety-critical action stays disabled without approval requirements satisfied', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true });
  const safetyButtons = collect(tree, (node) => (node.type === 'button' || node.type?.name === 'SafetyCriticalActionButton') && textFrom(node).includes('Release starting gate'));
  assert.equal(safetyButtons.length, 1);
  assert.equal(safetyButtons[0].props.approvalsSatisfied, false);
  assert.equal(safetyButtons[0].props.backendLive, false);
});

test('unified operations command center aggregates governed operational domains', async () => {
  const data = await loadCommandCenter(createMockClient());
  const titles = data.operations.widgets.map((widget) => widget.title);
  for (const required of ['Race readiness','Surface conditions','Weather status','Active incidents','Pending approvals','Steward inquiries','Asset health','Workforce readiness','Emergency resources','Facility status','AI recommendations']) {
    assert.ok(titles.includes(required), `missing ${required}`);
  }
  assert.ok(data.operations.widgets.every((widget) => ['service','event-stream','digital-twin','approved-mock-adapter'].includes(widget.source)));
  assert.ok(data.operations.widgets.every((widget) => widget.drillDownPath.startsWith('/')));
  assert.ok(data.operations.savedLayouts.length >= 3);
  assert.ok(data.operations.liveEvents.length >= 3);
  assert.ok(data.operations.alerts.length >= 1);
});

test('command center landing page renders widgets, saved layouts, live timeline, alerts, and lineage', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('Unified Operations Command Center'));
  assert.ok(labels.includes('Configurable widget grid'));
  assert.ok(labels.includes('Saved layouts and role-specific views'));
  assert.ok(labels.includes('Live event streaming'));
  assert.ok(labels.includes('Operational alerts'));
  assert.ok(labels.includes('Data lineage'));
  assert.match(textFrom(tree), /Far Turn requires operations review/);
  assert.match(textFrom(tree), /Source:\s+digital-twin/);
});

test('track map mock exposes geospatial Digital Twin layers, controls, playback, and simulation overlays', async () => {
  const map = await createMockClient().getTrackMap();
  assert.ok(map.geospatial);
  const layers = map.geospatial.overlays.map((overlay) => overlay.layer);
  for (const required of ['sector','gate','rail','barn','facility','camera','emergency','measurement','incident','maintenance','workforce','twin','simulation']) {
    assert.ok(layers.includes(required), `missing ${required}`);
  }
  assert.ok(map.geospatial.controls.zoom.presets.includes(18));
  assert.ok(map.geospatial.controls.overlayModes.includes('historical-playback'));
  assert.ok(map.geospatial.playback.length >= 2);
  assert.equal(map.geospatial.simulationOverlays[0].approvalRequired, true);
  assert.equal(map.geospatial.digitalTwinState[0].health, 'degraded');
});


test('command-center UX renders grouped operations navigation and operational workspace blueprint', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const group of ['OPERATIONS navigation group', 'SAFETY navigation group', 'FACILITIES navigation group', 'GOVERNANCE navigation group', 'EXECUTIVE navigation group']) {
    assert.ok(labels.includes(group), `missing ${group}`);
  }
  assert.ok(labels.includes('Nexus operational workspace blueprint'));
  assert.ok(labels.includes('Ten-screen operational experience'));
  assert.ok(labels.includes('Starting gate approval workflow'));
  assert.match(textFrom(tree), /Airport Operations Center/);
  assert.match(textFrom(tree), /Surface Health Score/);
  assert.match(textFrom(tree), /Verify GPS/);
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
  globalThis.fetch = original;
});

test('Command Center renders Digital Twin and Starting Gate workspaces with disabled draft controls', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('Digital Twin workspace shell'));
  assert.ok(labels.includes('Starting Gate Control workspace'));
  assert.ok(labels.includes('Draft starting gate move request'));
  assert.ok(labels.includes('Draft race distance configuration request'));
  const buttons = collect(tree, (node) => node.type === 'button' && String(node.props?.['aria-label'] ?? '').startsWith('Draft'));
  assert.equal(buttons.every((button) => button.props.disabled), true);
  assert.match(textFrom(tree), /MOCK DATA/);
});
