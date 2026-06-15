import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiAllowedActivities,
  aiControlPlaneBlockedActions,
  aiControlPlaneModuleIds,
  aiControlPlaneModules,
  apiContractSchemas,
  apiEndpointContracts,
  createDefaultAIControlPolicyConfig,
  normalizeProtectedActionIntent,
  protectedActions,
  validateAIControlPolicyConfig,
  validateAIRecommendationOutput,
  validateProtectedActionExecution,
  validateUnifiedAIInput,
} from '../dist/index.js';

const protectedControlAliases = [
  ['start-race', 'race-start'],
  ['stop-race', 'race-stop'],
  ['declare-winner', 'official-results'],
  ['modify-result', 'modify-official-results'],
  ['scratch-horse', 'scratch-horse'],
  ['clear-veterinary-flag', 'clear-vet-flag'],
  ['issue-steward-ruling', 'steward-ruling'],
  ['trigger-payout', 'payout'],
  ['execute-gate-move', 'starting-gate-move'],
  ['close-track', 'track-closure'],
  ['reopen-track', 'track-reopen'],
  ['override-emergency-personnel', 'emergency-personnel-override'],
];

test('unified AI control plane validates input and output recommendation schemas', () => {
  const input = {
    inputId: 'input-surface-1',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    timestamp: '2026-06-14T12:00:00.000Z',
    source: 'iot',
    domain: 'surface',
    assetId: 'sector:far-turn',
    data: { moisture: 27, compaction: 276 },
    confidence: 0.91,
    quality: { isComplete: true, isFresh: true, outlierScore: 0.12 },
  };
  assert.deepEqual(validateUnifiedAIInput(input), { valid: true, errors: [] });

  const output = {
    recommendationId: 'rec-surface-risk',
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    type: 'risk-assessment',
    recommendationType: 'risk-assessment',
    domain: 'surface',
    affectedAssets: ['sector:far-turn', 'twin:main-track:far-turn'],
    summary: 'Draft a far-turn surface intervention package for human review.',
    evidence: ['surface:moisture=27', 'inspection:standing-water'],
    evidencePackage: { evidencePackageId: 'evidence-package:rec-surface-risk', evidence: [{ evidenceId: 'surface:moisture=27', kind: 'telemetry', source: 'surface' }], lineage: ['agent:surface', 'model:model-surface-risk-v1'], hash: 'sha256:rec-surface-risk' },
    confidence: 0.84,
    confidenceScore: { raw: 0.84, calibrated: 0.8, band: 'medium', drivers: ['surface-telemetry', 'risk:high'] },
    modelVersion: 'model-surface-risk-v1',
    policyReferences: ['trackmind-ai-advisory-only-v1', 'approval-policy:steward'],
    riskLevel: 'high',
    generatedAt: '2026-06-14T20:00:00.000Z',
    requiresApproval: true,
    requiredApproverRoles: ['track-superintendent', 'steward'],
    approvalRequirement: { required: true, policy: 'steward', requiredApproverRoles: ['track-superintendent', 'steward'] },
    auditReference: { auditEventIds: ['audit-rec-surface-risk'], eventIds: ['event-rec-surface-risk'], digitalTwinRefs: ['twin:main-track:far-turn'], correlationId: 'corr-rec-surface-risk', integrityRef: 'evidence-package:rec-surface-risk' },
    advisoryOnly: true,
    executionAllowed: false,
    blockedAutonomousExecution: true,
  };
  assert.deepEqual(validateAIRecommendationOutput(output), { valid: true, errors: [] });

  const unsafe = validateAIRecommendationOutput({ ...output, requiredApproverRoles: [], blockedAutonomousExecution: false });
  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.errors.some((error) => error.includes('requiredApproverRoles')));
  assert.ok(unsafe.errors.some((error) => error.includes('blockedAutonomousExecution')));
});

test('shared DTO contracts expose AI control plane workspace, policy, and draft result schemas', () => {
  for (const schemaName of ['AIControlPlaneWorkspaceDto', 'AIControlPlanePolicyDto', 'AIControlPlaneDraftResultDto', 'AIRecommendationDto']) {
    assert.ok(apiContractSchemas[schemaName], `${schemaName} missing`);
  }

  const paths = apiEndpointContracts.map((endpoint) => endpoint.path);
  for (const path of ['/api/v1/ai-control-plane/workspace', '/api/v1/ai-control-plane/models', '/api/v1/ai-control-plane/recommendations', '/api/v1/ai-control-plane/blocked-actions']) {
    assert.ok(paths.includes(path), `${path} missing`);
  }
  assert.equal(paths.some((path) => /execute/i.test(path)), false);
});

test('AI model registry contains every required control-plane expert module', () => {
  const required = [
    'ai-router',
    'feature-builder',
    'surface-risk-model',
    'race-readiness-model',
    'gate-position-model',
    'equine-advisory-model',
    'security-anomaly-model',
    'weather-impact-model',
    'maintenance-forecast-model',
    'steward-evidence-assistant',
    'responsible-ai-governor',
  ];
  assert.deepEqual([...aiControlPlaneModuleIds].sort(), required.sort());
  for (const moduleId of aiControlPlaneModuleIds) {
    assert.ok(aiControlPlaneModules[moduleId].displayName);
    assert.ok(['input', 'feature-store', 'model-registry', 'expert-model', 'governor'].includes(aiControlPlaneModules[moduleId].stage));
  }
});

test('advisory activities are allowed while protected controls are normalized and blocked', () => {
  for (const activity of ['summarize', 'classify', 'forecast', 'detect-anomaly', 'draft-work-order', 'create-recommendation', 'notify-humans', 'generate-report', 'update-dashboard']) {
    assert.ok(aiAllowedActivities.includes(activity), `${activity} should be allowed`);
  }
  assert.equal(aiAllowedActivities.includes('execute'), false);

  for (const [alias, normalized] of protectedControlAliases) {
    assert.equal(normalizeProtectedActionIntent(alias), normalized);
    assert.ok(protectedActions.includes(normalized), `${normalized} should be a shared protected action`);
    assert.ok(aiControlPlaneBlockedActions.includes(normalized) || alias === 'declare-winner' || alias === 'modify-result', `${normalized} should be blocked by control-plane policy`);
    const denied = validateProtectedActionExecution({ action: alias, recommendationId: `rec-${alias}`, tenantId: 'tenant-1', target: 'race-7' });
    assert.equal(denied.allowed, false, alias);
    assert.match(denied.reason, /Explicit authorized human approval required/);
  }
});

test('autonomous permission checks require matching authorized human approval', () => {
  const denied = validateProtectedActionExecution({
    action: 'execute-gate-move',
    recommendationId: 'rec-gate-move',
    tenantId: 'tenant-1',
    target: 'gate-1',
    approval: { id: 'approval-ai', tenantId: 'tenant-1', recommendationId: 'rec-gate-move', protectedAction: 'execute-gate-move', target: 'gate-1', status: 'approved', approverId: 'ai-copilot', approverRoles: ['steward'], reason: 'Autonomous approval attempt', evidence: ['human-approval-record'] },
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'Approval must be granted by an authorized human role');

  const allowed = validateProtectedActionExecution({
    action: 'execute-gate-move',
    recommendationId: 'rec-gate-move',
    tenantId: 'tenant-1',
    target: 'gate-1',
    approval: { id: 'approval-human', tenantId: 'tenant-1', recommendationId: 'rec-gate-move', protectedAction: 'starting-gate-move', target: 'gate-1', status: 'approved', approverId: 'steward-1', approverRoles: ['steward'], reason: 'Human steward approved verified gate placement.', evidence: ['human-approval-record'] },
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.approvalId, 'approval-human');
});

test('default AI control policy keeps autonomous execution disabled', () => {
  const policy = createDefaultAIControlPolicyConfig();
  const result = validateAIControlPolicyConfig(policy);
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(policy.allowAutonomousLowRiskActions, false);
  for (const [, normalized] of protectedControlAliases) {
    assert.ok(policy.blockedActions.includes(normalized) || normalized === 'official-results' || normalized === 'modify-official-results', `${normalized} should be blocked`);
  }
});
