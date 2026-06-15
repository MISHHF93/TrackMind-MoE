import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalRequirement, protectedAIAutonomyActions, validateAIRecommendation, validateProtectedActionExecution } from '../dist/index.js';

const baseRecommendation = {
  id: 'rec-1',
  tenantId: 'tenant-1',
  activity: 'create-draft-action',
  requestedAction: 'start-race',
  target: 'race-1',
  summary: 'Draft start readiness recommendation only.',
  confidence: 0.82,
  evidence: ['surface-ok', 'gate-loaded'],
  createdAt: '2026-06-13T12:00:00Z',
  createdBy: 'ai-agent-1',
  requiredApprovals: [createApprovalRequirement('start-race')],
};

test('AI may recommend or draft protected actions but the recommendation declares required approval', () => {
  const result = validateAIRecommendation(baseRecommendation);
  assert.equal(result.allowed, true);
  assert.equal(result.requiredApproval.protectedAction, 'start-race');
  assert.ok(result.reason.includes('advisory'));
});

test('AI advisory boundary includes prioritization but not execution', async () => {
  const { aiAllowedActivities } = await import('../dist/index.js');
  assert.ok(aiAllowedActivities.includes('prioritize'));
  assert.equal(aiAllowedActivities.includes('execute'), false);
});

test('all protected AI autonomy actions are blocked without explicit human approval', () => {
  for (const action of protectedAIAutonomyActions) {
    const result = validateProtectedActionExecution({ action, recommendationId: 'rec-1', tenantId: 'tenant-1', target: 'target-1' });
    assert.equal(result.allowed, false, action);
    assert.match(result.reason, /Explicit authorized human approval required/);
  }
});

test('protected action execution requires matching approval, authorized role, reason, and evidence', () => {
  const denied = validateProtectedActionExecution({
    action: 'start-race', recommendationId: 'rec-1', tenantId: 'tenant-1', target: 'race-1',
    approval: { id: 'appr-1', tenantId: 'tenant-1', recommendationId: 'rec-1', protectedAction: 'start-race', target: 'race-1', status: 'approved', approverId: 'human-1', approverRoles: ['ticketing-manager'], reason: 'Ready', evidence: ['human-approval-record'] },
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'Approval must be granted by an authorized human role');

  const allowed = validateProtectedActionExecution({
    action: 'start-race', recommendationId: 'rec-1', tenantId: 'tenant-1', target: 'race-1',
    approval: { id: 'appr-2', tenantId: 'tenant-1', recommendationId: 'rec-1', protectedAction: 'start-race', target: 'race-1', status: 'approved', approverId: 'steward-1', approverRoles: ['steward'], reason: 'Starter and stewards confirmed readiness', evidence: ['human-approval-record'] },
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.approvalId, 'appr-2');
});

test('protected action intent names normalize to platform approval actions', async () => {
  const { normalizeProtectedActionIntent, protectedActionIntentMap } = await import('../dist/index.js');
  assert.equal(normalizeProtectedActionIntent('start-race'), 'race-start');
  assert.equal(normalizeProtectedActionIntent('make-medication-decision'), 'medication-decision');
  assert.equal(normalizeProtectedActionIntent('clear-veterinary-flag'), 'clear-vet-flag');
  assert.equal(normalizeProtectedActionIntent('issue-disciplinary-decision'), 'disciplinary-decision');
  assert.equal(normalizeProtectedActionIntent('execute-emergency-action'), 'emergency-action');
  assert.equal(normalizeProtectedActionIntent('execute-safety-critical-control'), 'safety-critical-control');
  assert.equal(Object.keys(protectedActionIntentMap).length, protectedAIAutonomyActions.length);
});

test('protected execution validation blocks normalized backend action names without approval', async () => {
  const { validateProtectedActionExecution } = await import('../dist/index.js');
  const denied = validateProtectedActionExecution({ action: 'race-start', recommendationId: 'rec-2', tenantId: 'tenant-1', target: 'race-7' });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /Explicit authorized human approval required/);

  const allowed = validateProtectedActionExecution({
    action: 'race-start', recommendationId: 'rec-2', tenantId: 'tenant-1', target: 'race-7',
    approval: { id: 'appr-3', tenantId: 'tenant-1', recommendationId: 'rec-2', protectedAction: 'race-start', target: 'race-7', status: 'approved', approverId: 'steward-1', approverRoles: ['steward'], reason: 'Race-start checklist complete', evidence: ['human-approval-record'] },
  });
  assert.equal(allowed.allowed, true);
});

test('normalized regulated action names are protected even when callers use backend contract names', async () => {
  const { validateAIRecommendation, validateProtectedActionExecution } = await import('../dist/index.js');
  for (const action of ['medication-decision', 'emergency-action', 'disciplinary-decision']) {
    const recommendation = validateAIRecommendation({ ...baseRecommendation, id: `rec-${action}`, requestedAction: action });
    assert.equal(recommendation.allowed, true);
    assert.equal(recommendation.requiredApproval.minimumApprovals, 1);

    const execution = validateProtectedActionExecution({ action, recommendationId: `rec-${action}`, tenantId: 'tenant-1', target: 'regulated-target' });
    assert.equal(execution.allowed, false);
    assert.match(execution.reason, /Explicit authorized human approval required/);
  }
});

test('protected execution validation rejects AI or service approval identities', async () => {
  const { validateProtectedActionExecution } = await import('../dist/index.js');
  const denied = validateProtectedActionExecution({
    action: 'race-start', recommendationId: 'rec-3', tenantId: 'tenant-1', target: 'race-8',
    approval: { id: 'appr-ai', tenantId: 'tenant-1', recommendationId: 'rec-3', protectedAction: 'race-start', target: 'race-8', status: 'approved', approverId: 'ai-copilot', approverRoles: ['steward'], reason: 'Autonomous approval attempt', evidence: ['human-approval-record'] },
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'Approval must be granted by an authorized human role');
});

test('Nexus event envelopes enforce versioned event contract and tenant-scoped subject', async () => {
  const { validateNexusEventEnvelope } = await import('../dist/index.js');
  const valid = validateNexusEventEnvelope({ eventId: 'evt-1', eventType: 'race.race.startRequested.v1', tenantId: 'tenant-1', racetrackId: 'main-track', actorId: 'steward-1', source: 'foundation-test', timestamp: '2026-06-13T12:00:00Z', version: 1, occurredAt: '2026-06-13T12:00:00Z', actor: { id: 'steward-1', type: 'human', roles: ['steward'] }, correlationId: 'corr-1', subject: { id: 'race-7', type: 'race', tenantId: 'tenant-1' }, payload: { status: 'pending-approval' }, evidence: ['approval-request'] });
  assert.equal(valid.allowed, true);

  const invalid = validateNexusEventEnvelope({ eventId: 'evt-2', eventType: 'race-start-requested', tenantId: 'tenant-1', racetrackId: 'main-track', actorId: 'ai-1', source: 'foundation-test', timestamp: '2026-06-13T12:00:00Z', version: 1, occurredAt: '2026-06-13T12:00:00Z', actor: { id: 'ai-1', type: 'ai-agent' }, correlationId: 'corr-2', subject: { id: 'race-7', type: 'race', tenantId: 'tenant-2' }, payload: {}, evidence: [] });
  assert.equal(invalid.allowed, false);
});
