import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertTenantScope,
  computeAdoptionScore,
  computeHealthBand,
  computeHealthScore,
  validateOnboardingWorkflowsConfig,
  validateSupportTiersConfig,
  workflowProgressPercent,
} from '../dist/customerManagement.js';

const supportTiers = {
  schemaVersion: 'trackmind.support-tiers.v1',
  tiers: [{ id: 'support-standard', name: 'Standard', order: 1, responseTimeHours: 24, channels: ['email'], successManagerAssigned: false, quarterlyBusinessReview: false, slaUptimePercent: 99.5 }],
};

const onboardingWorkflows = {
  schemaVersion: 'trackmind.onboarding-workflows.v1',
  workflows: [{ id: 'wf-test', name: 'Test', scope: 'organization', steps: [{ id: 'step-1', title: 'Step 1', required: true }] }],
};

test('validates configuration-driven support tiers and onboarding workflows', () => {
  assert.deepEqual(validateSupportTiersConfig(supportTiers), { valid: true, errors: [] });
  assert.deepEqual(validateOnboardingWorkflowsConfig(onboardingWorkflows), { valid: true, errors: [] });
});

test('enforces strict tenant isolation across organizations', () => {
  assert.throws(
    () => assertTenantScope({ organizationId: 'org-a', actorOrganizationId: 'org-b' }),
    /tenant_isolation_violation/,
  );
});

test('computes health bands and adoption scores', () => {
  assert.equal(computeHealthBand(85), 'healthy');
  assert.equal(computeHealthBand(50), 'at-risk');
  const score = computeHealthScore({
    subscriptionActive: true,
    adoptionScore: 80,
    onboardingProgressPercent: 100,
    contractDaysRemaining: 200,
    openRisks: 0,
  });
  assert.ok(score >= 80);
  assert.equal(computeAdoptionScore(7, 10, 50), 64);
});

test('calculates onboarding workflow progress', () => {
  const progress = workflowProgressPercent([
    { stepId: 'a', title: 'A', required: true, status: 'completed' },
    { stepId: 'b', title: 'B', required: true, status: 'pending' },
  ]);
  assert.equal(progress, 50);
});
