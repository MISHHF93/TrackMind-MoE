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
