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
