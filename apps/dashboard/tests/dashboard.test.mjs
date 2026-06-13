import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockClient, createLiveClient } from '../dist/api/client.js';
import { loadCommandCenter, isSafetyCriticalEnabled, requestRaceStartApproval } from '../dist/App.js';
import { visibleNavItems } from '../dist/shell/navigation.js';

test('routing exposes all command-center domain screens with role visibility', () => { const admin = visibleNavItems(['admin']).map((i)=>i.id); assert.ok(admin.includes('operations')); assert.ok(admin.includes('ai-governance')); const auditor = visibleNavItems(['read-only-auditor']).map((i)=>i.id); assert.ok(auditor.includes('operations')); assert.equal(auditor.includes('starting-gate'), false); });

test('safety-critical button remains disabled without live approval token', () => { assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:false, backendMode:'live' }), false); assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:true, backendMode:'mock' }), false); assert.equal(isSafetyCriticalEnabled({ authenticated:true, hasApprovalToken:true, backendMode:'live' }), true); });

test('approval-required flow calls backend adapter instead of mutating local state', async () => { const result = await requestRaceStartApproval(createMockClient(), 'starter-1', 'race-7'); assert.equal(result.accepted, true); assert.equal(result.eventType, 'approval.requested'); assert.equal(result.audited, true); assert.equal(result.mock, true); });

test('mock adapter is clearly marked and live adapter uses configured backend paths', async () => { const mockData = await loadCommandCenter(createMockClient()); assert.equal(mockData.mode, 'mock'); assert.equal(mockData.trackMap.mock, true); const live = createLiveClient('https://api.example.test/api/v1'); assert.equal(live.mode, 'live'); assert.equal(live.eventStreamUrl(), 'https://api.example.test/api/v1/events/stream'); });

test('API error handling surfaces live adapter failures', async () => { const original = globalThis.fetch; globalThis.fetch = async () => ({ ok:false, status:503, statusText:'Unavailable' }); await assert.rejects(() => createLiveClient('https://api.example.test').listApprovals(), /503 Unavailable/); globalThis.fetch = original; });
