import assert from 'node:assert/strict';
import test from 'node:test';
import { ApexApprovalGateway, createApexDomainControllers, handleApiRequest, createApiFacadeState } from '../dist/index.js';

const steward = { actor: 'steward-1', roles: ['steward'], reason: 'Human steward reviewed evidence.', evidence: ['human-approval-record'], now: '2026-06-14T18:00:30.000Z' };
const vet = { actor: 'vet-1', roles: ['veterinarian'], reason: 'Veterinarian examined horse.', evidence: ['human-approval-record'], now: '2026-06-14T18:00:20.000Z' };
const finance = { actor: 'finance-1', roles: ['finance'], reason: 'Finance verified payout funding.', evidence: ['human-approval-record'], now: '2026-06-14T18:00:45.000Z' };
const security = { actor: 'security-1', roles: ['security'], reason: 'Incident commander reviewed action.', evidence: ['human-approval-record'], now: '2026-06-14T18:00:25.000Z' };

function evidence(rationale = 'Evidence supports approval request.') {
  return {
    confidence: 0.84,
    rationale,
    alternativeOptions: ['delay action', 'request additional evidence'],
    evidenceLinks: ['event://race-day/readiness', 'audit://human-review'],
  };
}

function context(actor = 'service-operator', roles = ['steward']) {
  return {
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actor,
    roles,
    now: '2026-06-14T18:00:00.000Z',
  };
}

test('APEX safety service creates approval request before emergency mutation and executes only after explicit approval', async () => {
  const state = createApiFacadeState();
  const request = await handleApiRequest('POST', '/api/v1/services/safety/emergency-actions', {
    incidentId: 'incident-fire-1',
    action: 'dispatch emergency response',
    ...context('safety-lead', ['security']),
    evidence: evidence('Emergency action requires incident commander review.'),
  }, state);

  assert.equal(request.status, 202);
  assert.equal(request.body.approvalRequired, true);
  assert.equal(request.body.status, 'approval_required');
  assert.equal(request.body.approvalTimeoutSeconds, 120);
  assert.ok(request.body.evidence.evidenceLinks.includes('event://race-day/readiness'));

  const approved = await handleApiRequest('POST', `/api/v1/approvals/${request.body.approvalRequestId}/approve`, security, state);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.executed, true);
  assert.equal(approved.body.record.status, 'executed');
  assert.equal(approved.body.result.executed, true);
  assert.ok(approved.body.record.auditRefs.length >= 2);
  assert.ok(approved.body.record.eventRefs.length >= 2);
});

test('horse scratches require veterinarian and steward dual-control before lifecycle mutation', async () => {
  const gateway = new ApexApprovalGateway();
  const controllers = createApexDomainControllers(gateway);
  const request = await controllers.handle('POST', '/services/equine/scratch-decisions', {
    horseId: 'horse-1',
    reason: 'Lameness observed in paddock.',
    ...context('vet-tech', ['veterinarian']),
    evidence: evidence('Horse scratch requires veterinarian and steward co-approval.'),
  });

  assert.equal(request.status, 202);
  assert.deepEqual(request.body.requiredRoles.sort(), ['steward', 'veterinarian']);

  const first = await controllers.handle('POST', `/approvals/${request.body.approvalRequestId}/approve`, vet);
  assert.equal(first.body.executed, false);
  assert.equal(first.body.request.status, 'pending');

  const second = await controllers.handle('POST', `/approvals/${request.body.approvalRequestId}/approve`, steward);
  assert.equal(second.body.executed, true);
  assert.equal(second.body.result.lifecycleStatus, 'scratched');
  assert.deepEqual(second.body.result.dualControl, ['veterinarian', 'steward']);
  assert.equal(controllers.services.equine.horseProfile('horse-1', ['read-only-auditor']).veterinaryNotes, 'redacted-veterinary-privacy');
});

test('approval requests expire after the APEX 120 second race-wait limit', async () => {
  const gateway = new ApexApprovalGateway();
  const controllers = createApexDomainControllers(gateway);
  const request = await controllers.handle('POST', '/services/equine/medication-approvals', {
    horseId: 'horse-1',
    medication: 'therapeutic-review',
    ...context('vet-tech', ['veterinarian']),
    evidence: evidence('Medication approval requires dual human review.'),
  });

  const expired = gateway.expire(request.body.approvalRequestId, '2026-06-14T18:02:01.000Z');
  assert.equal(expired.status, 'expired');
  assert.throws(() => gateway.approvals.decide(request.body.approvalRequestId, { id: 'vet-1', roles: ['veterinarian'], human: true }, 'approved', 'late approval', ['human-approval-record'], '2026-06-14T18:02:02.000Z'), /expired/);
});

test('finance payout requires steward and finance approval and emits immutable audit/events', async () => {
  const gateway = new ApexApprovalGateway();
  const controllers = createApexDomainControllers(gateway);
  const request = await controllers.handle('POST', '/services/finance/payouts', {
    payoutId: 'payout-race-7',
    amountCents: 125000,
    recipientId: 'owner-1',
    ...context('finance-bot', ['finance']),
    evidence: evidence('Payout release requires steward and finance dual-control.'),
  });

  assert.equal(request.status, 202);
  assert.deepEqual(request.body.requiredRoles.sort(), ['finance', 'steward']);

  const partial = await controllers.handle('POST', `/approvals/${request.body.approvalRequestId}/approve`, steward);
  assert.equal(partial.body.executed, false);

  const final = await controllers.handle('POST', `/approvals/${request.body.approvalRequestId}/approve`, finance);
  assert.equal(final.body.executed, true);
  assert.equal(final.body.result.status, 'released');
  assert.deepEqual(final.body.result.dualControl, ['steward', 'finance']);

  const audits = gateway.auditLog.all();
  assert.ok(audits.some((entry) => entry.action === 'approval.evidence-presented'));
  assert.ok(audits.some((entry) => entry.action === 'approval.approved'));
  assert.equal(gateway.auditLog.verify().valid, true);
  assert.ok(gateway.eventBus.events({ aggregateId: 'payout-race-7' }).some((event) => String(event.type).includes('finance.payout.executed')));
});

test('stewarding and security read paths remain advisory until approval gates are used', async () => {
  const state = createApiFacadeState();
  const rulebook = await handleApiRequest('POST', '/api/v1/services/stewarding/rulebook/query', { question: 'Can stewards issue a penalty from AI output?', evidenceRefs: ['rulebook://arci/stewards'] }, state);
  assert.equal(rulebook.status, 200);
  assert.equal(rulebook.body.mayIssueOfficialRuling, false);

  const credential = await handleApiRequest('POST', '/api/v1/services/security/credentials/validate', { zoneId: 'paddock', credentialId: 'credential-unknown', personId: 'guest-1' }, state);
  assert.equal(credential.status, 200);
  assert.equal(credential.body.allowed, false);
  assert.match(credential.body.reason, /denied/);
});

test('steward penalty recommendations create an approval request before official decision state changes', async () => {
  const gateway = new ApexApprovalGateway();
  const controllers = createApexDomainControllers(gateway);
  const request = await controllers.handle('POST', '/services/stewarding/penalty-recommendations', {
    inquiryId: 'inquiry-race-7',
    ruleIds: ['rule-interference'],
    recommendedPenalty: 'three-day suspension',
    ...context('steward-clerk', ['steward']),
    evidence: evidence('Penalty recommendation requires human steward approval before it becomes official.'),
  });

  assert.equal(request.status, 202);
  assert.equal(request.body.approvalRequired, true);
  assert.equal(request.body.action, 'steward-decision');
  assert.deepEqual(request.body.requiredRoles, ['steward']);

  const approved = await controllers.handle('POST', `/approvals/${request.body.approvalRequestId}/approve`, steward);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.executed, true);
  assert.equal(approved.body.result.official, true);
  assert.equal(gateway.auditLog.verify().valid, true);
});
