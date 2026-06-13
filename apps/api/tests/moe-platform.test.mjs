import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalStore, routeUserRequest } from '../dist/index.js';

test('MoE orchestration platform routes cross-domain decisions with governance, evidence, and observability', async () => {
  const recommendation = await routeUserRequest('Executive briefing: weather lightning risk, track surface moisture, gate maintenance repair work order asset inspection, security camera issue, finance refund, HISA compliance, and stop race 4 if unsafe', 'rec-moe-platform');

  assert.ok(recommendation.domains.includes('WeatherEnvironment'));
  assert.ok(recommendation.domains.includes('TrackSurface'));
  assert.ok(recommendation.domains.includes('MaintenanceOps'));
  assert.ok(recommendation.domains.includes('ResponsibleAIGovernor'));
  assert.ok(recommendation.requiredApprovals.includes('race-stop'));
  assert.equal(recommendation.governance.automationAllowed, false);
  assert.ok(recommendation.governance.missingApprovals.includes('race-stop'));
  assert.ok(recommendation.evidenceItems.every((item) => item.id && item.reliability >= 0.7));
  assert.ok(recommendation.consensus.agreementScore >= 0);
  assert.ok(recommendation.workflows.some((workflow) => workflow.target === 'maintenance'));
  assert.ok(recommendation.digitalTwinUpdates.every((update) => update.sourceRecommendationId === 'rec-moe-platform'));
  assert.equal(recommendation.observability.traceId, 'rec-moe-platform');
  assert.ok(recommendation.auditTrail.some((entry) => entry.type === 'expert-call'));
  assert.match(recommendation.explanation, /TrackMind Nexus routed/);
});

test('MoE governance allows protected automation only after matching human approval', async () => {
  const approvals = new ApprovalStore();
  approvals.saveApproval({ id: 'approval-1', recommendationId: 'rec-approved', action: 'race-stop', status: 'approved', approver: 'chief-steward', timestamp: '2026-06-13T00:00:00Z', reason: 'Unsafe lightning proximity confirmed.', evidence: ['weather-radar', 'steward-order'] });

  const recommendation = await routeUserRequest('Stop race 2 due to lightning and unsafe track surface', 'rec-approved', approvals);
  assert.equal(recommendation.governance.automationAllowed, true);
  assert.deepEqual(recommendation.governance.missingApprovals, []);
});
