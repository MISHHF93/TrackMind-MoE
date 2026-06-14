import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveClient, createMockClient } from '../dist/api/client.js';

test('dashboard AI control-plane mock data renders through safe advisory DTOs', async () => {
  const client = createMockClient();
  assert.equal(client.executeAIControlPlaneRecommendation, undefined);

  if (typeof client.getAIControlPlaneWorkspace !== 'function') {
    const governance = await client.getAIGovernanceWorkspace();
    assert.ok(governance.safetyBlockedActions.length > 0);
    assert.ok(governance.safetyBlockedActions.every((action) => /cannot execute|approval/i.test(action.reason)));
    return;
  }

  const workspace = await client.getAIControlPlaneWorkspace();
  assert.equal(workspace.policy.executionEndpointsAvailable, false);
  assert.equal(workspace.policy.draftOnlyStateChanges, true);
  assert.ok(workspace.recommendations.length > 0);
  assert.ok(workspace.blockedActions.length > 0);
  assert.ok(workspace.auditEventTwinReferences.auditIds.length > 0);
  assert.ok(workspace.auditEventTwinReferences.eventIds.length > 0);
  assert.ok(workspace.auditEventTwinReferences.digitalTwinRefs.length > 0);
  assert.ok(workspace.blockedActions.every((action) => action.governorDecision.allowed === false && action.governorDecision.approvalRequired));

  if (typeof client.createAIControlPlaneRecommendationDraft === 'function') {
    const draft = await client.createAIControlPlaneRecommendationDraft({ recommendationId: 'rec-dashboard-safe' });
    assert.equal(draft.executionAllowed, false);
    assert.equal(draft.approvalRequired, true);
  }
});

test('dashboard live AI control-plane adapter calls read and draft endpoints only', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET' });
    return { ok: true, json: async () => ({ generatedAt: '2026-06-14T12:00:00.000Z', mock: false, policy: { executionEndpointsAvailable: false, draftOnlyStateChanges: true }, accepted: true, approvalRequired: true, executionAllowed: false }) };
  };

  try {
    const live = createLiveClient('https://api.example.test/api/v1');
    assert.equal(live.executeAIControlPlaneRecommendation, undefined);
    await live.getAIControlPlaneWorkspace();
    await live.getAIControlPlanePolicy();
    await live.getAIControlPlaneModels();
    await live.listAIControlPlaneRecommendations();
    await live.listAIControlPlaneBlockedActions();
    await live.listAIControlPlaneEvents();
    await live.createAIControlPlaneRecommendationDraft({ recommendationId: 'rec-dashboard-safe' });
    await live.evaluateAIControlPlaneRecommendationDraft({ recommendationId: 'rec-dashboard-safe' });

    assert.deepEqual(calls.map((call) => [call.method, call.url]), [
      ['GET', 'https://api.example.test/api/v1/ai-control-plane/workspace'],
      ['GET', 'https://api.example.test/api/v1/ai-control-plane/policy'],
      ['GET', 'https://api.example.test/api/v1/ai-control-plane/models'],
      ['GET', 'https://api.example.test/api/v1/ai-control-plane/recommendations'],
      ['GET', 'https://api.example.test/api/v1/ai-control-plane/blocked-actions'],
      ['GET', 'https://api.example.test/api/v1/ai-control-plane/events'],
      ['POST', 'https://api.example.test/api/v1/ai-control-plane/recommendations/draft'],
      ['POST', 'https://api.example.test/api/v1/ai-control-plane/recommendations/evaluate'],
    ]);
    assert.equal(calls.some((call) => /execute/i.test(call.url)), false);
  } finally {
    globalThis.fetch = original;
  }
});
