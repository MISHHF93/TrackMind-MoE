import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, ImmutableAuditLog, InMemoryEventBus, RaceOperationsPlatform } from '../dist/index.js';

const human = (id, roles) => ({ id, roles, human: true });
const ai = { id: 'ai-race-agent', roles: ['admin'], human: false };

function raceInput(id = 'race-approval-1') {
  return { id, trackId: 'trk-1', raceDate: '2026-06-13', raceNumber: 1, scheduledPostTime: '2026-06-13T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 90000, eligibility: ['three-year-olds-and-up'] } };
}

test('central approval service enforces chained race start approvals with audit and events', async () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const service = new CentralizedApprovalService({ auditLog, eventBus });
  const request = service.createRequest({ id: 'approval-race-start', tenantId: 'tenant-1', action: 'race-start', target: 'race-approval-1', requestedBy: 'ai-race-agent', actorType: 'ai-agent', reason: 'AI recommends race is ready', evidence: ['telemetry-ok'], now: '2026-06-13T17:45:00Z' });

  assert.equal(request.status, 'pending');
  assert.throws(() => service.decide(request.id, ai, 'approved', 'unsafe autonomous approval', ['human-approval-record'], '2026-06-13T17:46:00Z'), /AI agents and services cannot approve/);

  service.decide(request.id, human('secretary-1', ['racing-secretary']), 'approved', 'entries and gate order verified', ['human-approval-record'], '2026-06-13T17:47:00Z');
  service.decide(request.id, human('steward-1', ['steward']), 'approved', 'panel authorizes start', ['human-approval-record'], '2026-06-13T17:48:00Z');
  const approved = service.decide(request.id, human('vet-1', ['veterinarian']), 'approved', 'all runners cleared', ['human-approval-record'], '2026-06-13T17:49:00Z');
  assert.equal(approved.status, 'approved');

  const token = service.authorizeExecution({ requestId: request.id, action: 'race-start', target: 'race-approval-1', tenantId: 'tenant-1', actor: human('starter-1', ['steward']), now: '2026-06-13T17:50:00Z' });
  const platform = new RaceOperationsPlatform(service, 'tenant-1');
  platform.scheduleRace(raceInput());
  assert.equal(platform.startRace('race-approval-1', token, '2026-06-13T17:59:00Z').status, 'running');
  assert.ok(auditLog.all().some((entry) => entry.type === 'approval'));
  assert.ok(eventBus.events({ type: 'approval.execution-authorized' }).length >= 1);
});

test('controlled race actions cannot execute with missing, mismatched, expired, or AI-held approvals', () => {
  const service = new CentralizedApprovalService();
  const platform = new RaceOperationsPlatform(service, 'tenant-1');
  platform.scheduleRace(raceInput('race-2'));

  assert.throws(() => platform.startRace('race-2', undefined, '2026-06-13T18:00:00Z'), /requires approval token/);

  const request = service.createRequest({ id: 'approval-results', tenantId: 'tenant-1', action: 'official-results', target: 'race-2', requestedBy: 'results-service', actorType: 'service', reason: 'finish order ready', evidence: ['photo-finish'], now: '2026-06-13T18:05:00Z' });
  assert.throws(() => service.authorizeExecution({ requestId: request.id, action: 'official-results', target: 'race-2', tenantId: 'tenant-1', actor: ai, now: '2026-06-13T18:06:00Z' }), /AI agents cannot execute/);

  service.decide(request.id, human('steward-1', ['steward']), 'approved', 'official order verified', ['human-approval-record'], '2026-06-13T18:07:00Z');
  const partial = service.getRequest(request.id);
  assert.equal(partial.status, 'pending');
  assert.throws(() => service.authorizeExecution({ requestId: request.id, action: 'official-results', target: 'race-2', tenantId: 'tenant-1', actor: human('steward-1', ['steward']), now: '2026-06-13T18:08:00Z' }), /requires explicit authorized approval/);

  service.decide(request.id, human('finance-1', ['finance']), 'approved', 'payout funding locked', ['human-approval-record'], '2026-06-13T18:09:00Z');
  const token = service.authorizeExecution({ requestId: request.id, action: 'official-results', target: 'race-2', tenantId: 'tenant-1', actor: human('steward-1', ['steward']), now: '2026-06-13T18:10:00Z' });
  assert.throws(() => platform.startRace('race-2', token, '2026-06-13T18:11:00Z'), /does not match controlled action/);
  assert.throws(() => platform.publishOfficialResults('race-2', token, '2026-06-13T18:30:01Z'), /expired/);
});

test('approval delegation, expiration, escalation, and workflow references are tracked centrally', () => {
  const service = new CentralizedApprovalService();
  service.delegate('steward-chair', 'alternate-steward', ['steward'], '2026-06-13T20:00:00Z', 'chair assigned alternate for inquiry');
  const delegated = service.createRequest({ id: 'approval-steward-decision', tenantId: 'tenant-1', action: 'steward-decision', target: 'inquiry-1', requestedBy: 'workflow-engine', actorType: 'service', workflowInstanceId: 'wf-123', reason: 'objection review complete', evidence: ['video'], now: '2026-06-13T18:00:00Z' });
  const approved = service.decide(delegated.id, human('alternate-steward', []), 'approved', 'delegated steward ruling', ['human-approval-record'], '2026-06-13T18:01:00Z');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.workflowInstanceId, 'wf-123');
  assert.equal(approved.decisions[0].delegatedFor, 'steward-chair');

  const expiring = service.createRequest({ id: 'approval-vet-expire', tenantId: 'tenant-1', action: 'veterinary-clearance', target: 'horse-1', requestedBy: 'vet-ai', actorType: 'ai-agent', reason: 'clear flag recommendation', evidence: ['exam'], now: '2026-06-13T18:00:00Z' });
  assert.equal(service.expire(expiring.id, '2026-06-13T18:31:00Z').status, 'expired');

  const slow = service.createRequest({ id: 'approval-emergency-escalate', tenantId: 'tenant-1', action: 'emergency-action', target: 'gate-1', requestedBy: 'incident-bot', actorType: 'ai-agent', reason: 'gate alarm', evidence: ['alarm'], now: '2026-06-13T18:00:00Z' });
  const escalated = service.evaluateEscalations('2026-06-13T18:03:00Z').find((item) => item.id === slow.id);
  assert.equal(escalated.status, 'escalated');
  assert.ok(escalated.escalatedToRoles.includes('admin'));
});
