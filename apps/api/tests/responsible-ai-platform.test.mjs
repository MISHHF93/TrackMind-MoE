import test from 'node:test';
import assert from 'node:assert/strict';
import { ResponsibleAIGovernancePlatform } from '../dist/index.js';

const registration = {
  id: 'model-race-start-v1',
  name: 'Race Start Advisor',
  version: '1.0.0',
  owner: 'responsible-ai-governor',
  purpose: 'Recommend whether pre-race conditions are safe',
  criticality: 'safety-critical',
  dataClassification: 'personal-data',
  intendedUse: ['race-start-readiness'],
  prohibitedUse: ['autonomous-race-start'],
  lineage: ['training-dataset:surface-v3', 'prompt:steward-v2'],
  evidence: ['model-card', 'data-provenance'],
  registeredAt: '2026-06-13T00:00:00Z',
};

const passingEvaluation = {
  modelId: registration.id,
  evaluatedAt: '2026-06-13T01:00:00Z',
  evaluator: 'model-risk-management',
  metrics: { accuracy: 0.94, calibration: 0.91 },
  explainability: { method: 'rationale-trace', score: 0.92, artifacts: ['explainability-report'] },
  safety: { passed: true, controls: ['human-in-the-loop', 'red-team-suite'], redTeamFindings: 0 },
  fairness: { score: 0.88, segments: ['race-class', 'track-condition'] },
  privacy: { personalDataUsed: true, controls: ['minimization', 'retention-policy'] },
  security: { threatModelReviewed: true, vulnerabilitiesOpen: 0 },
  quality: { reliability: 0.93, maintainability: 0.86, performanceEfficiency: 0.9 },
};

test('responsible AI platform governs model lifecycle, approvals, oversight, rollback, and reports', () => {
  const platform = new ResponsibleAIGovernancePlatform();
  platform.registerModel(registration);

  assert.deepEqual(platform.readiness(registration.id).gaps, ['model evaluation required', 'ISO 31000 risk assessment required']);
  platform.recordEvaluation(passingEvaluation);
  platform.assessRisk({ modelId: registration.id, assessedAt: '2026-06-13T02:00:00Z', assessor: 'erm', impact: 5, likelihood: 3, mitigations: ['human approval', 'rollback runbook'] });

  assert.equal(platform.readiness(registration.id).deployable, true);
  assert.equal(platform.requestApproval(registration.id, 'compliance-officer').status, 'pending-approval');
  const deployment = platform.approveForDeployment(registration.id, 'ai-governance-board', ['approval-minutes']);
  assert.equal(deployment.deployed, true);
  assert.ok(deployment.humanOversight.includes('human-in-the-loop decisions'));
  assert.ok(deployment.rollbackProcedure.steps.includes('restore last approved version'));

  const monitor = platform.ingestMonitoring({ modelId: registration.id, observedAt: '2026-06-13T03:00:00Z', metric: 'safety-incident', value: 1, threshold: 0, evidence: ['incident-123'] });
  assert.equal(monitor.action, 'open-corrective-action-and-human-review');
  assert.equal(platform.getModel(registration.id).status, 'suspended');

  const report = platform.regulatoryReport('reg-2026-06', '2026-06-13T04:00:00Z');
  assert.ok(report.frameworks.includes('ISO42001'));
  assert.ok(report.frameworks.includes('NIST-AI-RMF'));
  assert.equal(report.incidents.length, 1);
  assert.ok(report.controlCoverage.find((item) => item.framework === 'ISO27701').controls.includes('privacy impact assessment'));
  assert.ok(platform.auditLog().some((entry) => entry.action === 'model-deployed'));
});

test('responsible AI platform rejects unsafe or unexplained models before approval', () => {
  const platform = new ResponsibleAIGovernancePlatform();
  platform.registerModel({ ...registration, id: 'model-risky-v1', evidence: ['model-card'] });
  platform.recordEvaluation({ ...passingEvaluation, modelId: 'model-risky-v1', explainability: { ...passingEvaluation.explainability, score: 0.4 }, safety: { ...passingEvaluation.safety, redTeamFindings: 2 } });
  platform.assessRisk({ modelId: 'model-risky-v1', assessedAt: '2026-06-13T02:00:00Z', assessor: 'erm', impact: 5, likelihood: 5, mitigations: ['manual only'] });

  const approval = platform.requestApproval('model-risky-v1', 'compliance-officer');
  assert.equal(approval.approved, false);
  assert.ok(approval.missing.includes('explainability score below threshold'));
  assert.ok(approval.missing.includes('critical residual risk requires executive acceptance'));
  assert.equal(platform.explainabilityRequirements('model-risky-v1').minimumScore, 0.9);
});
