import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalStore, CentralizedApprovalService, governanceRecommendationToForecastArtifact, governanceRecommendationToInsightArtifact, governanceRecommendationToRecommendationArtifact, ResponsibleAIGovernancePlatform, ResponsibleAIGovernor } from '../dist/index.js';
import { validateAIOutputArtifact } from '../../../packages/shared/dist/index.js';

const model = { id:'model-surface-advisor-v2', name:'Surface Advisor', version:'2.0.0', owner:'ai-governance', purpose:'Recommend safe track-surface interventions', criticality:'safety-critical', dataClassification:'restricted', intendedUse:['surface-maintenance-advice'], prohibitedUse:['autonomous-track-closure','autonomous-race-start'], lineage:['dataset:surface-readings-v5','training-run:2026-06-01'], evidence:['model-card','validation-report'], registeredAt:'2026-06-14T00:00:00Z' };
const evaln = { modelId:model.id, evaluatedAt:'2026-06-14T01:00:00Z', evaluator:'rai-lab', metrics:{ accuracy:.93, calibration:.91 }, explainability:{ method:'rationale-trace', score:.94, artifacts:['rationale-report'] }, safety:{ passed:true, controls:['human-approval','restricted-action-blocks'], redTeamFindings:0 }, fairness:{ score:.9, segments:['race-type','surface'] }, privacy:{ personalDataUsed:false, controls:['minimization'] }, security:{ threatModelReviewed:true, vulnerabilitiesOpen:0 }, quality:{ reliability:.92, maintainability:.9, performanceEfficiency:.88 } };

function governedPlatform(deps = {}) {
  const p = new ResponsibleAIGovernancePlatform(deps);
  p.registerModel(model);
  p.recordEvaluation(evaln);
  p.assessRisk({ modelId:model.id, assessedAt:'2026-06-14T02:00:00Z', assessor:'erm', impact:5, likelihood:3, mitigations:['human approval required','rollback runbook'] });
  p.publishPromptTemplate({ id:'prompt-surface-v4', name:'Surface intervention prompt', version:'4.0.0', owner:'prompt-review-board', template:'Recommend only with cited evidence and approvals.', evidence:['prompt-review-minutes'], status:'approved' });
  p.registerAgent({ id:'agent-surface-ops', name:'Surface Ops Agent', owner:'track-superintendent', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', status:'active', allowedActions:['recommend-harrow','summarize','forecast','create-recommendation','draft-work-order'], restrictedActions:['race-start','close-track'] });
  return p;
}

test('AI governance workspace records end-to-end lineage, evidence, approvals, events, audit, overrides, rollback, and metrics', () => {
  const p = governedPlatform();
  const rec = p.recordRecommendation({ id:'rec-harrow-7', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', action:'recommend-harrow', target:'sector:far-turn', recommendation:'Dispatch a human-approved harrow pass before Race 7.', confidence:.86, affectedAssets:['sector:far-turn','asset:sensor-44'], evidence:['surface:moisture=19','sensor-44:warning'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4','event:surface.reading.updated'], approvalPolicy:'single-human', riskLevel:'high', createdAt:'2026-06-14T03:00:00Z' });
  assert.equal(rec.status, 'pending-approval');
  assert.equal(rec.confidenceScore.band, 'high');
  assert.equal(rec.explainability.humanReviewRequired, true);
  p.recordOverride({ id:'override-1', recommendationId:rec.id, actor:'track-superintendent', reason:'Delay until lightning watch clears', evidence:['weather:cell-west-18mi'], createdAt:'2026-06-14T03:05:00Z' });
  p.recordRollback({ id:'rollback-1', recommendationId:rec.id, actor:'ai-governance-board', reason:'Revert to prior prompt after drift alert', restoredVersionId:'prompt-surface-v3', evidence:['drift:metric-9'], createdAt:'2026-06-14T03:10:00Z' });
  p.ingestMonitoring({ modelId:model.id, observedAt:'2026-06-14T03:15:00Z', metric:'drift', value:.12, threshold:.2, evidence:['monitor:drift-window-1'] });
  const ws = p.governanceWorkspace();
  assert.equal(ws.activeAgents.length, 1);
  assert.equal(ws.modelVersions[0].id, model.id);
  assert.equal(ws.promptTemplates[0].id, 'prompt-surface-v4');
  assert.ok(ws.approvalRequirements.some((approval) => approval.recommendationId === rec.id));
  assert.ok(ws.safetyPolicies[0].allowedActivities.includes('prioritize'));
  assert.ok(ws.digitalTwinImpacts.some((impact) => impact.recommendationId === rec.id && impact.approvalRequired));
  assert.ok(ws.observabilitySignals.some((signal) => signal.metric === 'confidence' && signal.subjectId === rec.id));
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
  const blocked = p.governanceWorkspace().safetyBlockedActions[0];
  assert.equal(blocked.recommendationId, rec.id);
  assert.equal(blocked.modelVersion, model.id);
  assert.equal(blocked.generatedAt, rec.createdAt);
  assert.equal(blocked.approvalRequirement.required, true);
  assert.ok(blocked.auditReference.auditIds.length > 0);
});

test('AI safety policy allows advisory activities only and blocks ungoverned protected actions', () => {
  const p = governedPlatform();
  assert.throws(() => p.recordRecommendation({ id:'bad-activity', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', activity:'execute', action:'recommend-harrow', target:'sector:far-turn', recommendation:'Execute work', confidence:.8, affectedAssets:['sector:far-turn'], evidence:['surface:moisture=19'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4'], approvalPolicy:'none', riskLevel:'medium', createdAt:'2026-06-14T03:00:00Z' }), /advisory boundary/);
  const blocked = p.recordRecommendation({ id:'rec-no-approval', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', activity:'create-draft-action', action:'race-start', target:'race-7', recommendation:'Draft race start only', confidence:.9, affectedAssets:['race:race-7'], evidence:['readiness:watch'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4'], approvalPolicy:'none', riskLevel:'critical', createdAt:'2026-06-14T03:00:00Z' });
  assert.equal(blocked.status, 'safety-blocked');
  const ws = p.governanceWorkspace();
  assert.ok(ws.humanInLoopWorkflows.some((workflow) => workflow.recommendationId === blocked.id && workflow.executionAllowed === false));
  assert.ok(ws.governorReviews.some((review) => review.recommendationId === blocked.id && review.blockedAutonomousExecution === true && review.requiredApproverRoles.includes('horse-operations-coordinator')));
});

test('AI Governor policy blocks protected controls and keeps advisory actions non-executable', () => {
  const governor = new ResponsibleAIGovernor(new ApprovalStore());
  for (const action of ['START_RACE','STOP_RACE','DECLARE_WINNER','MODIFY_OFFICIAL_RESULT','SCRATCH_HORSE','CLEAR_VET_FLAG','ISSUE_STEWARD_RULING','TRIGGER_PAYOUT','EXECUTE_GATE_MOVE','CLOSE_TRACK','REOPEN_TRACK','OVERRIDE_EMERGENCY_PERSONNEL']) {
    const review = governor.reviewAutonomousPermission({ action, recommendationId:`rec-${action}`, riskLevel:'low', requiresApproval:false, evidence:['policy-test'] });
    assert.equal(review.canExecute, false, action);
    assert.equal(review.blockedAutonomousExecution, true, action);
    assert.ok(review.requiredApproverRoles.length > 0, action);
    assert.match(review.reason, /hard-blocked|requires/i);
  }

  for (const action of ['SUMMARIZE','CLASSIFY','FORECAST','DETECT_ANOMALY','DRAFT_WORK_ORDER','CREATE_RECOMMENDATION','NOTIFY_HUMANS','GENERATE_REPORT','UPDATE_DASHBOARD']) {
    const review = governor.reviewAutonomousPermission({ action, recommendationId:`rec-${action}`, riskLevel:'low', requiresApproval:false, evidence:['advisory-evidence'] });
    assert.equal(review.canExecute, false, action);
    assert.equal(review.decision, 'blocked', action);
    assert.equal(review.blockedAutonomousExecution, true, action);
  }
});

test('low-risk automation fails when any autonomous permission predicate is unmet', () => {
  const governor = new ResponsibleAIGovernor(new ApprovalStore());
  const requiresApproval = governor.reviewAutonomousPermission({ action:'SUMMARIZE', recommendationId:'rec-approval', riskLevel:'low', requiresApproval:true, evidence:['evidence'] });
  assert.equal(requiresApproval.canExecute, false);
  assert.equal(requiresApproval.approvalRequired, true);

  const policyDenied = governor.reviewAutonomousPermission({ action:'CLOSE_TRACK', recommendationId:'rec-policy', riskLevel:'low', requiresApproval:false, evidence:['evidence'] });
  assert.equal(policyDenied.canExecute, false);
  assert.equal(policyDenied.policyAllowsAutomation, false);

  const governorDenied = governor.reviewAutonomousPermission({ action:'SUMMARIZE', recommendationId:'rec-governor', riskLevel:'low', requiresApproval:false, evidence:[] });
  assert.equal(governorDenied.canExecute, false);
  assert.equal(governorDenied.responsibleAIGovernorApproved, false);

  const riskDenied = governor.reviewAutonomousPermission({ action:'SUMMARIZE', recommendationId:'rec-risk', riskLevel:'medium', requiresApproval:false, evidence:['evidence'] });
  assert.equal(riskDenied.canExecute, false);
  assert.equal(riskDenied.policyAllowsAutomation, false);
});

test('low-risk advisory recommendations remain advisory and cannot execute', () => {
  const p = governedPlatform();
  const rec = p.recordRecommendation({ id:'rec-summarize', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', activity:'summarize', action:'SUMMARIZE', target:'race-7-dashboard', recommendation:'Summarize race readiness evidence for the dashboard.', confidence:.84, affectedAssets:['dashboard:race-7'], evidence:['readiness:watch','surface:moisture=19'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4'], approvalPolicy:'none', riskLevel:'low', createdAt:'2026-06-14T03:30:00Z' });
  assert.equal(rec.status, 'queued');
  assert.equal(rec.governorReview.canExecute, false);
  const blocked = p.executeRecommendation(rec.id, 'agent-surface-ops');
  assert.equal(blocked.executed, false);
  assert.equal(blocked.executionAllowed, false);
  assert.equal(p.governanceWorkspace().governorReviews.find((review) => review.recommendationId === rec.id).decision, 'blocked');
});

test('AI recommendations create approval drafts, mapped roles, metadata, and blocked autonomous execution logs', () => {
  const approvals = new ApprovalStore();
  const approvalService = new CentralizedApprovalService();
  const p = governedPlatform({ approvals, approvalService });

  const rec = p.recordRecommendation({ id:'rec-gate-move', tenantId:'track-1', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', activity:'create-draft-action', action:'gateMove', target:'gate-1', recommendation:'Draft a starting gate move work order for human review only.', confidence:.99, affectedAssets:['gate:gate-1','twin:main-track:gate-1'], evidence:['gps:current-position','race:race-7'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4','event:gate.position.reviewed'], approvalPolicy:'none', riskLevel:'critical', createdAt:'2026-06-14T04:00:00Z' });

  assert.equal(rec.status, 'safety-blocked');
  assert.equal(rec.action, 'starting-gate-move');
  const ws = p.governanceWorkspace();
  const req = ws.approvalRequirements.find((item) => item.recommendationId === rec.id);
  assert.deepEqual(req.requiredRoles, ['horse-operations-coordinator', 'facilities-manager']);
  assert.equal(req.controlledAction, 'starting-gate-move');
  assert.ok(req.approvalRequestId);

  const approvalRequest = approvalService.getRequest(req.approvalRequestId);
  assert.equal(approvalRequest.action, 'starting-gate-move');
  assert.equal(approvalRequest.actorType, 'ai-agent');
  assert.equal(approvalRequest.status, 'pending');
  assert.ok(approvalRequest.evidence.includes('human-in-the-loop-workflow'));
  assert.ok(approvalRequest.evidence.includes('recommendation:rec-gate-move'));

  const workflow = ws.humanInLoopWorkflows.find((item) => item.recommendationId === rec.id);
  assert.equal(workflow.approvalRequestId, approvalRequest.id);
  assert.equal(workflow.executionAllowed, false);
  assert.ok(workflow.auditId);
  assert.ok(workflow.eventId);
  assert.ok(ws.draftWorkOrders.some((workOrder) => workOrder.recommendationId === rec.id && workOrder.executionAllowed === false && workOrder.evidence.includes('draft-only:no-live-actuator-control')));
  assert.deepEqual(approvals.getRecommendation(rec.id).approvalRequestIds, [approvalRequest.id]);

  for (const [id, action, roles] of [
    ['rec-surface-action', 'surfaceAction', ['facilities-manager']],
    ['rec-vet-action', 'vetAction', ['veterinarian']],
    ['rec-steward-ruling', 'stewardRuling', ['steward']],
  ]) {
    p.recordRecommendation({ id, tenantId:'track-1', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', action, target:`target-${id}`, recommendation:`Request ${action} approval evidence path only.`, confidence:.88, affectedAssets:[`asset:${id}`], evidence:[`evidence:${id}`], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4'], approvalPolicy:'none', riskLevel:'high', createdAt:'2026-06-14T04:05:00Z' });
    const mapped = p.governanceWorkspace().approvalRequirements.find((item) => item.recommendationId === id);
    assert.deepEqual(mapped.requiredRoles, roles);
    assert.ok(mapped.approvalRequestId);
  }

  const blocked = p.executeRecommendation(rec.id, 'agent-surface-ops');
  assert.equal(blocked.executed, false);
  assert.match(blocked.reason, /Blocked:/i);
  const afterBlock = p.governanceWorkspace();
  assert.ok(afterBlock.blockedAutonomousExecutionLogs.some((log) => log.recommendationId === rec.id && log.auditId === blocked.auditId && log.eventId === blocked.eventId));
  assert.ok(afterBlock.events.some((event) => event.type === 'ai.autonomous-execution.blocked' && event.subjectId === rec.id));
});

test('AI artifact adapters keep protected recommendations blocked and preserve confidence risk and evidence', () => {
  const p = governedPlatform();
  const rec = p.recordRecommendation({ id:'rec-artifact-race-start', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', activity:'create-draft-action', action:'race-start', target:'race-7', recommendation:'Draft race start readiness package for human review only.', confidence:.91, affectedAssets:['race:race-7','gate:1'], evidence:['readiness:watch','gate:gps-verified'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4'], approvalPolicy:'none', riskLevel:'critical', createdAt:'2026-06-14T05:00:00Z' });
  const artifact = governanceRecommendationToRecommendationArtifact(rec, { tenantId:'track-1', racetrackId:'main-track', auditEventIds:['immutable-audit-artifact-race-start'], eventIds:['ai-event-artifact-race-start'] });

  assert.deepEqual(validateAIOutputArtifact(artifact), { valid: true, errors: [] });
  assert.equal(artifact.outputClass, 'Recommendation');
  assert.equal(artifact.confidence, .83);
  assert.equal(artifact.riskLevel, 'critical');
  assert.deepEqual(artifact.evidence, ['readiness:watch','gate:gps-verified']);
  assert.equal(artifact.approvalRequired, true);
  assert.equal(artifact.executionAllowed, false);
  assert.equal(artifact.blockedAutonomousExecution, true);

  const result = p.executeRecommendation(rec.id, 'agent-surface-ops');
  assert.equal(result.executed, false);
  assert.ok(p.governanceWorkspace().blockedAutonomousExecutionLogs.some((log) => log.recommendationId === rec.id));
});

test('approval-required AI recommendation adapts to Recommendation Insight and Forecast artifacts without execution authority', () => {
  const p = governedPlatform();
  const rec = p.recordRecommendation({ id:'rec-artifact-weather', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', activity:'forecast', action:'forecast', target:'race-7', recommendation:'Forecast elevated weather risk and request steward review.', confidence:.82, affectedAssets:['race:race-7','track:main'], evidence:['weather:lightning=6mi','forecast:rain=18mm'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4'], approvalPolicy:'single-human', riskLevel:'high', createdAt:'2026-06-14T05:10:00Z' });
  const artifactRefs = { tenantId:'track-1', racetrackId:'main-track', domain:'weather', type:'forecast', auditEventIds:['immutable-audit-artifact-weather'], eventIds:['ai-event-artifact-weather'] };
  const recommendation = governanceRecommendationToRecommendationArtifact(rec, artifactRefs);
  const insight = governanceRecommendationToInsightArtifact(rec, artifactRefs);
  const forecast = governanceRecommendationToForecastArtifact(rec, { ...artifactRefs, horizon:'2h' });
  const ws = p.governanceWorkspace();

  assert.equal(rec.status, 'pending-approval');
  assert.ok(ws.approvalRequirements.some((req) => req.recommendationId === rec.id && req.status === 'pending'));
  const queued = ws.recommendationQueue.find((item) => item.id === rec.id);
  assert.equal(queued.recommendationId, rec.id);
  assert.equal(queued.modelVersion, model.id);
  assert.equal(queued.generatedAt, rec.createdAt);
  assert.equal(queued.approvalRequirement.required, true);
  assert.ok(queued.auditReference.eventIds.length > 0);
  for (const artifact of [recommendation, insight, forecast]) {
    assert.deepEqual(validateAIOutputArtifact(artifact), { valid: true, errors: [] });
    assert.equal(artifact.approvalRequired, true);
    assert.equal(artifact.confidence, .78);
    assert.equal(artifact.riskLevel, 'high');
    assert.deepEqual(artifact.evidence, ['weather:lightning=6mi','forecast:rain=18mm']);
    assert.equal(artifact.executionAllowed, false);
  }
  assert.deepEqual([recommendation.outputClass, insight.outputClass, forecast.outputClass], ['Recommendation', 'Insight', 'Forecast']);
  assert.equal(forecast.payload.horizon, '2h');
});

test('prompt lineage draft and publish mutations govern registry cards with audit trail', async () => {
  const { createApiFacadeState, handleApiRequest } = await import('../dist/server.js');
  const adminHeaders = {
    'x-trackmind-role': 'platform-super-admin',
    'x-trackmind-tenant-id': 'trackmind',
    'x-trackmind-racetrack-id': 'main-track',
    'x-trackmind-organization-id': 'org-trackmind-network',
  };
  const state = createApiFacadeState();

  const draft = await handleApiRequest('POST', '/api/v1/ai-governance/prompt-lineage/drafts', {
    id: 'surface-intervention-v6',
    name: 'Surface Intervention',
    version: '6.0.0',
    path: 'ai/prompt-cards/surface-intervention-v6.md',
    lineage: ['surface-intervention-v4', 'surface-advisor-v2'],
    reason: 'Governed lineage draft for end-to-end verification',
    requestedBy: 'compliance-officer',
  }, state, adminHeaders);

  assert.equal(draft.status, 202);
  assert.equal(draft.body.eventType, 'ai.prompt-lineage.draft.created');
  assert.equal(draft.body.draftOnly, true);
  assert.ok(draft.body.draftId);
  assert.ok(draft.body.auditEventIds.length >= 1);

  const cardsBeforePublish = await handleApiRequest('GET', '/api/v1/ai-governance/prompt-cards', undefined, state, adminHeaders);
  assert.equal(cardsBeforePublish.status, 200);
  assert.equal(cardsBeforePublish.body.promptCards.some((card) => card.id === 'surface-intervention-v6'), false);

  const published = await handleApiRequest('POST', `/api/v1/ai-governance/prompt-lineage/${encodeURIComponent(draft.body.draftId)}/publish`, {}, state, adminHeaders);
  assert.equal(published.status, 201);
  assert.equal(published.body.eventType, 'ai.prompt-lineage.published');
  assert.equal(published.body.registeredId, 'surface-intervention-v6');
  assert.equal(published.body.audited, true);
  assert.ok(published.body.auditId);
  assert.ok(published.body.registry.promptCards.some((card) => card.id === 'surface-intervention-v6'));

  const auditSearch = await handleApiRequest('GET', '/api/v1/audit/search?domain=ai', undefined, state, adminHeaders);
  assert.equal(auditSearch.status, 200);
  assert.ok(auditSearch.body.some((event) => event.action === 'ai.prompt-lineage.draft.created'));
  assert.ok(auditSearch.body.some((event) => event.action === 'ai.prompt-lineage.published'));

  const republish = await handleApiRequest('POST', `/api/v1/ai-governance/prompt-lineage/${encodeURIComponent(draft.body.draftId)}/publish`, {}, state, adminHeaders);
  assert.equal(republish.status, 400);
  assert.match(republish.body.error.message, /already published/i);
});
