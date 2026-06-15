import assert from 'node:assert/strict';
import test from 'node:test';
import { createAIActAuditLogger, createApiFacadeState, createTrustworthyOrchestrationPolicyEngine, handleApiRequest } from '../dist/index.js';

test('Trustworthy Orchestration policy engine enforces C1, C2, C6, and C7', () => {
  const engine = createTrustworthyOrchestrationPolicyEngine();
  const autonomous = engine.evaluate({ subjectId: 'race-7', action: 'race-start', actorId: 'ai-agent-1', actorType: 'ai-agent', roles: ['steward'], confidence: 0.91, attributes: { protectedAction: true, autonomousMutation: true } });
  assert.equal(autonomous.status, 'blocked');
  assert.ok(autonomous.criteria.includes('C1-human-governance'));
  assert.ok(autonomous.criteria.includes('C2-policy-enforced'));
  assert.ok(autonomous.requiredApprovals.some((approval) => approval.includes('steward')));

  const uncertain = engine.evaluate({ subjectId: 'rec-1', action: 'recommend', actorId: 'moe-router', actorType: 'ai-agent', confidence: 0.41, attributes: { protectedAction: false } });
  assert.equal(uncertain.status, 'escalated');
  assert.ok(uncertain.criteria.includes('C6-epistemic-prudence'));
  assert.ok(uncertain.escalation.routeTo.includes('ai-governor'));

  const update = engine.recordKnowledgeUpdate('rulebook-rag-index', { checksum: 'sha256:v2' }, 'compliance-officer', 'Update rulebook index');
  const rollback = engine.rollbackKnowledge('rulebook-rag-index', update.version, 'compliance-officer');
  assert.equal(update.reversible, true);
  assert.equal(rollback.changeSummary, `Rollback to v${update.version}`);
});

test('AI Act audit logger records recommendation timestamps, transparency payloads, overrides, and post-market signals', () => {
  const logger = createAIActAuditLogger();
  const report = logger.report();
  assert.ok(report.automaticLogging.some((item) => item.modelId === 'model-race-readiness-v1' && item.inferenceTimestamp));
  assert.ok(report.transparencyRecords[0].rationale.includes('Race start readiness'));
  assert.equal(report.humanOversight[0].approverId, 'steward-1');
  assert.equal(report.postMarketMonitoring.auditVerification.valid, true);
  assert.ok(report.postMarketMonitoring.driftMetrics.some((metric) => metric.feedbackLoopRef === 'feedback:race-day-review'));
});

test('compliance regulatory reporting endpoints expose AI Act artifact structure', async () => {
  const state = createApiFacadeState();
  const routes = [
    '/api/v1/compliance/risk-management',
    '/api/v1/compliance/data-governance',
    '/api/v1/compliance/technical-documentation',
    '/api/v1/compliance/automatic-logging',
    '/api/v1/compliance/transparency',
    '/api/v1/compliance/human-oversight',
    '/api/v1/compliance/post-market-monitoring',
    '/api/v1/compliance/trustworthy-orchestration',
    '/api/v1/compliance/regulatory-report',
  ];
  for (const route of routes) {
    const response = await handleApiRequest('GET', route, undefined, state);
    assert.equal(response.status, 200, route);
  }

  const risk = await handleApiRequest('GET', '/api/v1/compliance/risk-management', undefined, state);
  assert.equal(risk.body.article, 'AI Act Article 9');
  assert.ok(risk.body.hazards.some((hazard) => hazard.hazardId === 'hazard-autonomous-race-start'));

  const logging = await handleApiRequest('GET', '/api/v1/compliance/automatic-logging', undefined, state);
  assert.equal(logging.body.article, 'AI Act Article 12');
  assert.ok(logging.body.automaticLogging[0].modelId);

  const full = await handleApiRequest('GET', '/api/v1/compliance/regulatory-report', undefined, state);
  assert.equal(full.body.humanOversight.article, 'AI Act Article 14');
  assert.equal(full.body.postMarketMonitoring.article, 'AI Act Article 72');
  assert.ok(full.body.trustworthyOrchestration.criteria.includes('C7-incremental-knowledge-evolution'));
});
