import test from 'node:test';
import assert from 'node:assert/strict';
import { ResponsibleAIGovernancePlatform } from '../dist/index.js';

const model = { id:'model-surface-advisor-v2', name:'Surface Advisor', version:'2.0.0', owner:'ai-governance', purpose:'Recommend safe track-surface interventions', criticality:'safety-critical', dataClassification:'restricted', intendedUse:['surface-maintenance-advice'], prohibitedUse:['autonomous-track-closure','autonomous-race-start'], lineage:['dataset:surface-readings-v5','training-run:2026-06-01'], evidence:['model-card','validation-report'], registeredAt:'2026-06-14T00:00:00Z' };
const evaln = { modelId:model.id, evaluatedAt:'2026-06-14T01:00:00Z', evaluator:'rai-lab', metrics:{ accuracy:.93, calibration:.91 }, explainability:{ method:'rationale-trace', score:.94, artifacts:['rationale-report'] }, safety:{ passed:true, controls:['human-approval','restricted-action-blocks'], redTeamFindings:0 }, fairness:{ score:.9, segments:['race-type','surface'] }, privacy:{ personalDataUsed:false, controls:['minimization'] }, security:{ threatModelReviewed:true, vulnerabilitiesOpen:0 }, quality:{ reliability:.92, maintainability:.9, performanceEfficiency:.88 } };

function governedPlatform() {
  const p = new ResponsibleAIGovernancePlatform();
  p.registerModel(model);
  p.recordEvaluation(evaln);
  p.assessRisk({ modelId:model.id, assessedAt:'2026-06-14T02:00:00Z', assessor:'erm', impact:5, likelihood:3, mitigations:['human approval required','rollback runbook'] });
  p.publishPromptTemplate({ id:'prompt-surface-v4', name:'Surface intervention prompt', version:'4.0.0', owner:'prompt-review-board', template:'Recommend only with cited evidence and approvals.', evidence:['prompt-review-minutes'], status:'approved' });
  p.registerAgent({ id:'agent-surface-ops', name:'Surface Ops Agent', owner:'track-superintendent', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', status:'active', allowedActions:['recommend-harrow'], restrictedActions:['race-start','close-track'] });
  return p;
}

test('AI governance workspace records end-to-end lineage, evidence, approvals, events, audit, overrides, rollback, and metrics', () => {
  const p = governedPlatform();
  const rec = p.recordRecommendation({ id:'rec-harrow-7', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', action:'recommend-harrow', target:'sector:far-turn', recommendation:'Dispatch a human-approved harrow pass before Race 7.', confidence:.86, affectedAssets:['sector:far-turn','asset:sensor-44'], evidence:['surface:moisture=19','sensor-44:warning'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4','event:surface.reading.updated'], approvalPolicy:'single-human', riskLevel:'high', createdAt:'2026-06-14T03:00:00Z' });
  assert.equal(rec.status, 'queued');
  p.recordOverride({ id:'override-1', recommendationId:rec.id, actor:'track-superintendent', reason:'Delay until lightning watch clears', evidence:['weather:cell-west-18mi'], createdAt:'2026-06-14T03:05:00Z' });
  p.recordRollback({ id:'rollback-1', recommendationId:rec.id, actor:'ai-governance-board', reason:'Revert to prior prompt after drift alert', restoredVersionId:'prompt-surface-v3', evidence:['drift:metric-9'], createdAt:'2026-06-14T03:10:00Z' });
  p.ingestMonitoring({ modelId:model.id, observedAt:'2026-06-14T03:15:00Z', metric:'drift', value:.12, threshold:.2, evidence:['monitor:drift-window-1'] });
  const ws = p.governanceWorkspace();
  assert.equal(ws.activeAgents.length, 1);
  assert.equal(ws.evidencePackages[0].recommendationId, rec.id);
  assert.ok(ws.events.some((e) => e.type === 'ai.recommendation.recorded'));
  assert.ok(ws.auditTrails.some((a) => a.action === 'ai.rollback.recorded'));
  assert.equal(ws.rollbackRecords.length, 1);
  assert.equal(ws.monitoringMetrics.length, 1);
});

test('AI recommendations must have evidence, confidence, affected assets, approval policy, and traceable lineage', () => {
  const p = governedPlatform();
  assert.throws(() => p.recordRecommendation({ id:'bad-rec', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', action:'recommend-harrow', target:'sector:far-turn', recommendation:'Do work', confidence:0, affectedAssets:[], evidence:[], lineage:['agent:agent-surface-ops'], approvalPolicy:'single-human', riskLevel:'medium', createdAt:'2026-06-14T03:00:00Z' }), /evidence required.*confidence.*affected assets.*lineage/);
});

test('restricted actions cannot be executed by AI', () => {
  const p = governedPlatform();
  const rec = p.recordRecommendation({ id:'rec-race-start', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', action:'race-start', target:'race-7', recommendation:'Start Race 7', confidence:.91, affectedAssets:['race:race-7','gate:1'], evidence:['readiness:watch'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4'], approvalPolicy:'single-human', riskLevel:'critical', createdAt:'2026-06-14T03:00:00Z' });
  const result = p.executeRecommendation(rec.id, 'agent-surface-ops');
  assert.equal(result.executed, false);
  assert.match(result.reason, /blocked/i);
  assert.equal(p.governanceWorkspace().safetyBlockedActions[0].id, rec.id);
});
