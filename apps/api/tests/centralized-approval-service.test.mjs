import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApprovalStore,
  CentralizedApprovalService,
  DurableApprovalStore,
  ImmutableAuditLog,
  InMemoryEventBus,
  InMemoryPostgresRecordStore,
  RaceOperationsPlatform,
  canonicalApprovalRequest,
  defaultApprovalPolicies,
  getApprovalRepository,
  initializeRepositoryPersistence,
  notificationFramework,
  resetApprovalRepositoryForTests,
  resetPostgresRecordStoreForTests,
  resetRepositorySnapshotsForTests,
  runApprovalEscalationCycle,
  setPostgresClientAvailableForTests,
  setPostgresRecordStoreForTests,
  startApprovalEscalationScheduler,
} from '../dist/index.js';
import { protectedActions } from '../../../packages/shared/dist/index.js';

const human = (id, roles) => ({ id, roles, human: true });
const ai = { id: 'ai-race-agent', roles: ['admin'], human: false };

function raceInput(id = 'race-approval-1') {
  return { id, trackId: 'trk-1', raceDate: '2026-06-13', raceNumber: 1, scheduledPostTime: '2026-06-13T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 90000, eligibility: ['three-year-olds-and-up'] } };
}

test('central approval service enforces chained race start approvals with audit and events', async () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const service = new CentralizedApprovalService({ auditLog, eventBus });
  const request = service.createRequest({ id: 'approval-race-start', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'race-start', target: 'race-approval-1', requestedBy: 'ai-race-agent', actorType: 'ai-agent', reason: 'AI recommends race is ready', evidence: ['telemetry-ok'], now: '2026-06-13T17:45:00Z' });

  assert.equal(request.status, 'pending');
  assert.throws(() => service.decide(request.id, ai, 'approved', 'unsafe autonomous approval', ['human-approval-record'], '2026-06-13T17:46:00Z'), /AI agents and services cannot approve/);

  service.decide(request.id, human('secretary-1', ['racing-secretary']), 'approved', 'entries and gate order verified', ['human-approval-record'], '2026-06-13T17:47:00Z');
  service.decide(request.id, human('steward-1', ['steward']), 'approved', 'panel authorizes start', ['human-approval-record'], '2026-06-13T17:48:00Z');
  const approved = service.decide(request.id, human('vet-1', ['veterinarian']), 'approved', 'all runners cleared', ['human-approval-record'], '2026-06-13T17:49:00Z');
  assert.equal(approved.status, 'approved');

  const token = service.authorizeExecution({ requestId: request.id, action: 'race-start', target: 'race-approval-1', tenantId: 'tenant-1', racetrackId: 'trk-1', actor: human('starter-1', ['steward']), now: '2026-06-13T17:50:00Z' });
  const platform = new RaceOperationsPlatform(service, 'tenant-1');
  platform.scheduleRace(raceInput());
  platform.addEntry('race-approval-1', { id: 'entry-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' });
  platform.declareEntry('race-approval-1', 'entry-1', 'jockey-1', 124);
  platform.drawPostPositions('race-approval-1');
  platform.assignGates('race-approval-1');
  platform.coordinateStaffing('race-approval-1', { stewards: ['steward-1'], veterinarians: ['vet-1'], gateCrew: ['gate-1'], outriders: ['out-1'], trackMaintenance: ['maint-1'], security: ['sec-1'] });
  platform.allocateResources('race-approval-1', [{ id: 'gate-main', type: 'starting-gate', zone: 'chute', status: 'allocated' }]);
  for (const step of ['racingOffice', 'stewards', 'veterinarian']) platform.approveWorkflow('race-approval-1', step, 'approved');
  assert.equal(platform.assessReadiness('race-approval-1', [{ streamId: 'gate-status', type: 'gate', observedAt: '2026-06-13T17:55:00Z', healthy: true, value: 'closed' }]).ready, true);
  assert.equal(platform.startRace('race-approval-1', token, '2026-06-13T17:59:00Z').status, 'running');
  assert.ok(auditLog.all().some((entry) => entry.type === 'approval'));
  const executionEvent = eventBus.events({ type: 'approval.execution-authorized' }).at(-1);
  assert.ok(executionEvent);
  assert.equal(executionEvent.context.tenantId, 'tenant-1');
  assert.equal(executionEvent.context.approvalRef, request.id);
  assert.ok(executionEvent.context.auditRefs.length >= 1);
});

test('controlled race actions cannot execute with missing, mismatched, expired, or AI-held approvals', () => {
  const service = new CentralizedApprovalService();
  const platform = new RaceOperationsPlatform(service, 'tenant-1');
  platform.scheduleRace(raceInput('race-2'));

  assert.throws(() => platform.startRace('race-2', undefined, '2026-06-13T18:00:00Z'), /requires approval token/);

  const request = service.createRequest({ id: 'approval-results', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'official-results', target: 'race-2', requestedBy: 'results-service', actorType: 'service', reason: 'finish order ready', evidence: ['photo-finish'], now: '2026-06-13T18:05:00Z' });
  assert.throws(() => service.authorizeExecution({ requestId: request.id, action: 'official-results', target: 'race-2', tenantId: 'tenant-1', racetrackId: 'trk-1', actor: ai, now: '2026-06-13T18:06:00Z' }), /AI agents cannot execute/);

  service.decide(request.id, human('steward-1', ['steward']), 'approved', 'official order verified', ['human-approval-record'], '2026-06-13T18:07:00Z');
  const partial = service.getRequest(request.id);
  assert.equal(partial.status, 'pending');
  assert.throws(() => service.authorizeExecution({ requestId: request.id, action: 'official-results', target: 'race-2', tenantId: 'tenant-1', racetrackId: 'trk-1', actor: human('steward-1', ['steward']), now: '2026-06-13T18:08:00Z' }), /requires explicit authorized approval/);

  service.decide(request.id, human('finance-1', ['finance']), 'approved', 'payout funding locked', ['human-approval-record'], '2026-06-13T18:09:00Z');
  const token = service.authorizeExecution({ requestId: request.id, action: 'official-results', target: 'race-2', tenantId: 'tenant-1', racetrackId: 'trk-1', actor: human('steward-1', ['steward']), now: '2026-06-13T18:10:00Z' });
  assert.throws(() => platform.startRace('race-2', token, '2026-06-13T18:11:00Z'), /does not match controlled action/);
  assert.throws(() => platform.publishOfficialResults('race-2', token, '2026-06-13T18:30:01Z'), /expired/);
});

test('approval delegation, expiration, escalation, and workflow references are tracked centrally', () => {
  const service = new CentralizedApprovalService();
  service.delegate('steward-chair', 'alternate-steward', ['steward'], '2026-06-13T20:00:00Z', 'chair assigned alternate for inquiry');
  const delegated = service.createRequest({ id: 'approval-steward-decision', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'steward-decision', target: 'inquiry-1', requestedBy: 'workflow-engine', actorType: 'service', workflowInstanceId: 'wf-123', reason: 'objection review complete', evidence: ['video'], now: '2026-06-13T18:00:00Z' });
  const approved = service.decide(delegated.id, human('alternate-steward', []), 'approved', 'delegated steward ruling', ['human-approval-record'], '2026-06-13T18:01:00Z');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.workflowInstanceId, 'wf-123');
  assert.equal(approved.decisions[0].delegatedFor, 'steward-chair');

  const expiring = service.createRequest({ id: 'approval-vet-expire', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'veterinary-clearance', target: 'horse-1', requestedBy: 'vet-ai', actorType: 'ai-agent', reason: 'clear flag recommendation', evidence: ['exam'], now: '2026-06-13T18:00:00Z' });
  assert.equal(service.expire(expiring.id, '2026-06-13T18:31:00Z').status, 'expired');

  const slow = service.createRequest({ id: 'approval-emergency-escalate', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'emergency-action', target: 'gate-1', requestedBy: 'incident-bot', actorType: 'ai-agent', reason: 'gate alarm', evidence: ['alarm'], now: '2026-06-13T18:00:00Z' });
  const escalated = service.evaluateEscalations('2026-06-13T18:03:00Z').find((item) => item.id === slow.id);
  assert.equal(escalated.status, 'escalated');
  assert.ok(escalated.escalatedToRoles.includes('admin'));
  const canonical = canonicalApprovalRequest(escalated, { policies: defaultApprovalPolicies(), auditRefs: ['audit-approval-escalated'], eventRefs: ['approval.escalated'] });
  assert.equal(canonical.approvalRequestId, slow.id);
  assert.equal(canonical.status, 'escalated');
  assert.equal(canonical.auditLinkage.auditIds[0], 'audit-approval-escalated');
  assert.ok(canonical.escalation.some((rule) => rule.approverRoles.includes('admin')));
});

test('default approval policies cover every protected regulated action', () => {
  const policyActions = new Set(defaultApprovalPolicies().map((policy) => policy.action));
  for (const action of protectedActions) assert.ok(policyActions.has(action), `${action} missing approval policy`);
});

test('escalated approvals can be completed by escalation roles but still expire', () => {
  const service = new CentralizedApprovalService();
  const request = service.createRequest({ id: 'approval-escalated-admin', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'emergency-action', target: 'gate-2', requestedBy: 'incident-bot', actorType: 'ai-agent', reason: 'gate fault', evidence: ['alarm'], now: '2026-06-13T18:00:00Z' });
  assert.equal(service.evaluateEscalations('2026-06-13T18:03:00Z')[0].status, 'escalated');

  const approved = service.decide(request.id, human('ops-admin-1', ['admin']), 'approved', 'incident commander accepts escalation', ['human-approval-record'], '2026-06-13T18:04:00Z');
  assert.equal(approved.status, 'approved');

  const expiring = service.createRequest({ id: 'approval-escalated-expiry', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'emergency-action', target: 'gate-3', requestedBy: 'incident-bot', actorType: 'ai-agent', reason: 'gate fault', evidence: ['alarm'], now: '2026-06-13T18:00:00Z' });
  service.evaluateEscalations('2026-06-13T18:03:00Z');
  assert.equal(service.expire(expiring.id, '2026-06-13T18:06:00Z').status, 'expired');
  assert.throws(() => service.decide(expiring.id, human('ops-admin-1', ['admin']), 'approved', 'late approval', ['human-approval-record'], '2026-06-13T18:06:30Z'), /expired/);
});

test('terminal approval requests and legacy approval records cannot be bypassed by AI actors', () => {
  const service = new CentralizedApprovalService();
  const rejected = service.createRequest({ id: 'approval-rejected-terminal', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'steward-ruling', target: 'inquiry-2', requestedBy: 'workflow-engine', actorType: 'service', reason: 'ruling review', evidence: ['video'], now: '2026-06-13T18:00:00Z' });
  service.decide(rejected.id, human('steward-1', ['steward']), 'rejected', 'insufficient evidence', ['human-approval-record'], '2026-06-13T18:01:00Z');
  assert.throws(() => service.decide(rejected.id, human('steward-2', ['steward']), 'approved', 'second attempt', ['human-approval-record'], '2026-06-13T18:02:00Z'), /rejected/);

  const store = new ApprovalStore();
  assert.throws(() => store.saveApproval({ id: 'ap-ai', recommendationId: 'rec-1', action: 'race-start', status: 'approved', approver: 'ai-copilot', approverRoles: ['steward'], reason: 'autonomous approval', evidence: ['human-approval-record'] }), /AI agents and services cannot approve/);
  assert.throws(() => store.saveApproval({ id: 'ap-service', recommendationId: 'rec-1', action: 'race-start', status: 'approved', approver: 'workflow-service', approverActorType: 'service', approverRoles: ['steward'], reason: 'service approval', evidence: ['human-approval-record'] }), /AI agents and services cannot approve/);
});

test('durable approval store survives service restart via repository adapter', () => {
  resetRepositorySnapshotsForTests();
  resetApprovalRepositoryForTests();
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const service = new CentralizedApprovalService({ auditLog, eventBus });
  const store = new DurableApprovalStore(service);

  const request = service.createRequest({
    id: 'approval-restart-central',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-restart-central',
    requestedBy: 'incident-bot',
    actorType: 'ai-agent',
    reason: 'gate fault',
    evidence: ['alarm'],
    now: '2026-06-13T18:00:00Z',
  });

  assert.equal(getApprovalRepository().get(request.id)?.request?.target, 'gate-restart-central');
  assert.equal(store.list().some((item) => item.id === request.id), true);

  const restarted = store.simulateRestart(() => new CentralizedApprovalService({ auditLog: new ImmutableAuditLog(), eventBus: new InMemoryEventBus() }));
  assert.equal(restarted.hasRequest('approval-restart-central'), true);
  assert.equal(restarted.getRequest('approval-restart-central').status, 'pending');
});

test('escalation cycle escalates, expires, and sends approval reminders', () => {
  resetRepositorySnapshotsForTests();
  resetApprovalRepositoryForTests();
  notificationFramework.publish({ category: 'platform', severity: 'info', title: 'reset', message: 'baseline', targetRoles: ['*'] });
  const beforeCount = notificationFramework.count();

  const service = new CentralizedApprovalService();
  const store = new DurableApprovalStore(service);

  service.createRequest({
    id: 'approval-escalate-central',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-escalate-central',
    requestedBy: 'incident-bot',
    actorType: 'ai-agent',
    reason: 'gate fault',
    evidence: ['alarm'],
    now: '2026-06-13T18:00:00Z',
  });

  service.createRequest({
    id: 'approval-expire-central',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-expire-central',
    requestedBy: 'incident-bot',
    actorType: 'ai-agent',
    reason: 'gate fault',
    evidence: ['alarm'],
    now: '2026-06-13T18:00:00Z',
  });

  const escalationResult = runApprovalEscalationCycle({
    approvalService: service,
    durableStore: store,
    now: '2026-06-13T18:03:00Z',
    reminderLeadMinutes: 10,
  });

  assert.ok(escalationResult.escalated.includes('approval-escalate-central'));
  assert.equal(service.getRequest('approval-escalate-central').status, 'escalated');

  const expiryResult = runApprovalEscalationCycle({
    approvalService: service,
    durableStore: store,
    now: '2026-06-13T18:06:00Z',
    reminderLeadMinutes: 10,
  });

  assert.ok(expiryResult.expired.includes('approval-expire-central'));
  assert.equal(service.getRequest('approval-expire-central').status, 'expired');

  service.createRequest({
    id: 'approval-reminder-central',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'race-stop',
    target: 'race-reminder-central',
    requestedBy: 'starter',
    actorType: 'human',
    reason: 'stop requested',
    evidence: ['incident-report'],
    now: '2026-06-13T18:00:00Z',
  });

  const reminderResult = runApprovalEscalationCycle({
    approvalService: service,
    durableStore: store,
    now: '2026-06-13T18:04:30Z',
    reminderLeadMinutes: 5,
  });

  assert.ok(reminderResult.remindersSent.includes('approval-reminder-central'));
  assert.ok(notificationFramework.count() > beforeCount);
  const inbox = notificationFramework.inbox('admin');
  assert.ok(inbox.notifications.some((item) => item.title.includes('Approval reminder')));
});

test('escalation scheduler ticks pending approvals on interval', () => {
  resetApprovalRepositoryForTests();
  const service = new CentralizedApprovalService();
  const store = new DurableApprovalStore(service);

  service.createRequest({
    id: 'approval-scheduler-tick',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-scheduler',
    requestedBy: 'incident-bot',
    actorType: 'ai-agent',
    reason: 'gate fault',
    evidence: ['alarm'],
    now: '2026-06-13T18:00:00Z',
  });

  const scheduler = startApprovalEscalationScheduler({
    approvalService: service,
    durableStore: store,
    intervalMs: 60_000,
    reminderLeadMinutes: 10,
  });

  const tickResult = scheduler.tick('2026-06-13T18:03:00Z');
  scheduler.stop();
  assert.ok(tickResult.escalated.includes('approval-scheduler-tick'));
});

test('approval repository reloads from postgres when persistence enabled', async () => {
  resetRepositorySnapshotsForTests();
  resetPostgresRecordStoreForTests();
  resetApprovalRepositoryForTests();

  const previousMode = process.env.TRACKMIND_PERSISTENCE_MODE;
  const previousUrl = process.env.TRACKMIND_DATABASE_URL;

  process.env.TRACKMIND_PERSISTENCE_MODE = 'postgres';
  process.env.TRACKMIND_DATABASE_URL = 'postgres://trackmind:secret@localhost:5432/trackmind';
  setPostgresClientAvailableForTests(true);
  const pgStore = new InMemoryPostgresRecordStore();
  setPostgresRecordStoreForTests(pgStore);

  const service = new CentralizedApprovalService();
  new DurableApprovalStore(service);
  service.createRequest({
    id: 'approval-pg-central',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-pg-central',
    requestedBy: 'incident-bot',
    actorType: 'ai-agent',
    reason: 'gate fault',
    evidence: ['alarm'],
    now: '2026-06-13T18:00:00Z',
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  resetRepositorySnapshotsForTests();
  resetApprovalRepositoryForTests();
  await initializeRepositoryPersistence();

  const reloaded = getApprovalRepository();
  assert.equal(reloaded.persistenceMode(), 'postgres');
  assert.equal(reloaded.get('approval-pg-central')?.request?.target, 'gate-pg-central');

  const hydrated = new CentralizedApprovalService();
  const store = new DurableApprovalStore(hydrated);
  assert.equal(hydrated.hasRequest('approval-pg-central'), true);
  assert.equal(store.list().some((item) => item.id === 'approval-pg-central'), true);

  resetPostgresRecordStoreForTests();
  if (previousMode === undefined) delete process.env.TRACKMIND_PERSISTENCE_MODE;
  else process.env.TRACKMIND_PERSISTENCE_MODE = previousMode;
  if (previousUrl === undefined) delete process.env.TRACKMIND_DATABASE_URL;
  else process.env.TRACKMIND_DATABASE_URL = previousUrl;
  resetApprovalRepositoryForTests();
});
