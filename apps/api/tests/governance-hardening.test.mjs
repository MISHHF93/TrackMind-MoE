import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiFacadeState, createCqrsCommandHandler, createTrustworthyOrchestrationPolicyEngine, handleApiRequest, ImmutableAuditLog, safetyCriticalGovernanceRules } from '../dist/index.js';

const approval = {
  approval_id: 'approval-safety-1',
  approver_id: 'chief-steward',
  approval_timestamp: '2026-06-14T18:00:00.000Z',
  model_id: 'safety-governance-v1',
  confidence: 0.92,
  evidence_links: ['approval://safety-1', 'steward://review'],
};

const human = (id, roles) => ({ id, roles, human: true });

function approveToken(state, action, target, approvers, tenantId = 'trackmind', racetrackId = 'main-track') {
  const now = new Date().toISOString();
  const request = state.approvalService.createRequest({ tenantId, racetrackId, action, target, requestedBy: 'governance-test', actorType: 'human', reason: `Approve ${action}`, evidence: ['human-approval-record'], now });
  approvers.forEach(([id, roles], index) => state.approvalService.decide(request.id, human(id, roles), 'approved', `Approval step ${index + 1}`, ['human-approval-record'], new Date(Date.parse(now) + (index + 1) * 1000).toISOString()));
  return state.approvalService.authorizeExecution({ requestId: request.id, action, target, tenantId, racetrackId, actor: human('executor-1', ['admin']), now: new Date(Date.parse(now) + (approvers.length + 1) * 1000).toISOString() });
}

test('machine-readable governance blocks direct safety-critical commands without approval metadata', async () => {
  const handler = createCqrsCommandHandler();
  const blocked = await handler.handle({
    id: 'cmd-bypass-medication',
    type: 'medication_admin',
    aggregateId: 'horse-1',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actorId: 'vet-service',
    approvalRequired: false,
    ai: { model_id: 'med-ai', confidence: 0.8, evidence_links: ['ai://med'] },
    payload: { horseId: 'horse-1', medication: 'controlled-x' },
  });

  assert.equal(blocked.accepted, false);
  assert.match(blocked.blockedReason, /approval_required_true/);
  assert.ok(safetyCriticalGovernanceRules.some((rule) => rule.protectedAction === 'medication-decision'));
});

test('race stop scratch and medication API commands require approval gates before event emission', async () => {
  const state = createApiFacadeState();
  const blockedStop = await handleApiRequest('POST', '/api/v1/races/race-7/stop', { reason: 'incident on track' }, state);
  assert.equal(blockedStop.status, 400);
  assert.match(blockedStop.body.error.message, /tenantId, racetrackId, actorId/);

  const forgedStop = await handleApiRequest('POST', '/api/v1/races/race-7/stop', { tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'race-control', reason: 'incident on track', ...approval }, state);
  assert.equal(forgedStop.status, 403);
  assert.match(forgedStop.body.blockedReason, /approvalToken/);

  const stopToken = approveToken(state, 'race-stop', 'race-7', [['steward-1', ['steward']], ['security-1', ['security']]]);
  const stopped = await handleApiRequest('POST', '/api/v1/races/race-7/stop', { tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'race-control', reason: 'incident on track', approvalToken: stopToken, model_id: approval.model_id, confidence: approval.confidence, evidence_links: approval.evidence_links }, state);
  assert.equal(stopped.status, 202);
  assert.equal(stopped.body.event.eventType, 'RaceStoppedEvent');
  assert.equal(typeof stopped.body.event.timestampSynchronization.withinTolerance, 'boolean');
  assert.ok(stopped.body.event.timestampSynchronization.maxSkewMs >= 0);
  assert.ok(stopped.body.event.timestampSynchronization.sources.some((source) => source.source === 'approval.timestamp'));

  const scratchToken = approveToken(state, 'scratch-horse', 'horse-1', [['vet-1', ['veterinarian']], ['steward-1', ['steward']]]);
  const scratched = await handleApiRequest('POST', '/api/v1/races/race-7/scratches', { tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'vet-1', horseId: 'horse-1', reason: 'vet scratch', approvalToken: scratchToken, model_id: approval.model_id, confidence: approval.confidence, evidence_links: approval.evidence_links }, state);
  assert.equal(scratched.status, 202);
  assert.equal(scratched.body.event.eventType, 'HorseScratchedEvent');

  const medicationToken = approveToken(state, 'medication-decision', 'horse-1', [['vet-1', ['veterinarian']], ['steward-1', ['steward']]]);
  const medication = await handleApiRequest('POST', '/api/v1/horses/horse-1/medications/administer', { tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'vet-1', medication: 'controlled-x', dose: '1ml', reason: 'approved medication administration', approvalToken: medicationToken, model_id: approval.model_id, confidence: approval.confidence, evidence_links: approval.evidence_links }, state);
  assert.equal(medication.status, 202);
  assert.equal(medication.body.event.eventType, 'MedicationAdministeredEvent');
  assert.equal(state.cqrs.verifyHashChain().valid, true);
});

test('immutable audit log includes synchronized timestamp metadata inside verified hash chain', () => {
  const log = new ImmutableAuditLog();
  const entry = log.append({
    id: 'audit-sync-1',
    type: 'approval',
    actor: 'steward-1',
    timestamp: '2026-06-14T18:00:00.000Z',
    action: 'approval.evidence-presented',
    payload: { action: 'race-start' },
    timestampSources: [
      { source: 'rtk', timestamp: '2026-06-14T18:00:00.050Z' },
      { source: 'video', timestamp: '2026-06-14T18:00:00.120Z' },
    ],
  });

  assert.equal(entry.timestampSynchronization.withinTolerance, true);
  assert.equal(entry.timestampSynchronization.maxSkewMs, 120);
  assert.equal(log.verify().valid, true);
});

test('HISA compliance endpoint reports eligibility failures and requires approval for changes', async () => {
  const state = createApiFacadeState();
  const hisa = await handleApiRequest('GET', '/api/v1/horses/horse-1/hisa?role=steward&actorId=steward-1', undefined, state);
  assert.equal(hisa.status, 200);
  assert.equal(hisa.body.compliant, false);
  assert.equal(hisa.body.approvalRequiredForEligibilityChange, true);
  assert.ok(hisa.body.failedRules.includes('hisa-registration-status'));
  assert.ok(hisa.body.failedRules.includes('hisa-medication-withdrawal-clear'));
});

test('Trustworthy policy engine exposes action-specific mandatory approval rules', () => {
  const engine = createTrustworthyOrchestrationPolicyEngine();
  const scratch = engine.evaluate({
    subjectId: 'horse-1',
    action: 'scratch_decision',
    actorId: 'equine-ai',
    actorType: 'ai-agent',
    roles: ['veterinarian'],
    confidence: 0.91,
    attributes: { protectedAction: true, protectedActionName: 'scratch-horse' },
  });

  assert.equal(scratch.status, 'approval-required');
  assert.ok(scratch.requiredApprovals.some((approvalRef) => approvalRef.includes('veterinarian:1:scratch-horse')));
  assert.ok(scratch.requiredApprovals.some((approvalRef) => approvalRef.includes('steward:1:scratch-horse')));
  assert.ok(scratch.criteria.includes('C1-human-governance'));
  assert.ok(scratch.criteria.includes('C2-policy-enforced'));
});
