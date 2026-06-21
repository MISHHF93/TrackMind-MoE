import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  ImmutableAuditLog,
  InMemoryEventBus,
  DurableApprovalStore,
  runApprovalEscalationCycle,
  notificationFramework,
  resetApprovalRepositoryForTests,
} from '../dist/index.js';

const human = (id, roles) => ({ id, roles, human: true });

test('durable approval store survives service restart via repository', () => {
  resetApprovalRepositoryForTests();
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const service = new CentralizedApprovalService({ auditLog, eventBus });
  const store = new DurableApprovalStore(service);

  const request = service.createRequest({
    id: 'approval-restart-1',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-restart',
    requestedBy: 'incident-bot',
    actorType: 'ai-agent',
    reason: 'gate fault',
    evidence: ['alarm'],
    now: '2026-06-13T18:00:00Z',
  });

  assert.equal(store.list().some((item) => item.id === request.id), true);

  const restarted = store.simulateRestart(() => new CentralizedApprovalService({ auditLog: new ImmutableAuditLog(), eventBus: new InMemoryEventBus() }));
  assert.equal(restarted.hasRequest('approval-restart-1'), true);
  assert.equal(restarted.getRequest('approval-restart-1').status, 'pending');
  assert.equal(restarted.getRequest('approval-restart-1').target, 'gate-restart');
});

test('escalation worker escalates, expires, and sends approval reminders', () => {
  resetApprovalRepositoryForTests();
  notificationFramework.publish({ category: 'platform', severity: 'info', title: 'reset', message: 'baseline', targetRoles: ['*'] });
  const beforeCount = notificationFramework.count();

  const service = new CentralizedApprovalService();
  const store = new DurableApprovalStore(service);

  service.createRequest({
    id: 'approval-escalate-worker',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-worker',
    requestedBy: 'incident-bot',
    actorType: 'ai-agent',
    reason: 'gate fault',
    evidence: ['alarm'],
    now: '2026-06-13T18:00:00Z',
  });

  service.createRequest({
    id: 'approval-expire-worker',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'emergency-action',
    target: 'gate-expire',
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

  assert.ok(escalationResult.escalated.includes('approval-escalate-worker'));
  assert.equal(service.getRequest('approval-escalate-worker').status, 'escalated');
  assert.ok(service.getRequest('approval-escalate-worker').escalatedToRoles.includes('admin'));

  const expiryResult = runApprovalEscalationCycle({
    approvalService: service,
    durableStore: store,
    now: '2026-06-13T18:06:00Z',
    reminderLeadMinutes: 10,
  });

  assert.ok(expiryResult.expired.includes('approval-expire-worker'));
  assert.equal(service.getRequest('approval-expire-worker').status, 'expired');

  service.createRequest({
    id: 'approval-reminder-worker',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'race-stop',
    target: 'race-reminder',
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

  assert.ok(reminderResult.remindersSent.includes('approval-reminder-worker'));
  assert.ok(notificationFramework.count() > beforeCount);
  const inbox = notificationFramework.inbox('admin');
  assert.ok(inbox.notifications.some((item) => item.title.includes('Approval reminder')));
});

test('approval-gated mutations emit audit events when audit log is wired', () => {
  resetApprovalRepositoryForTests();
  const auditLog = new ImmutableAuditLog();
  const service = new CentralizedApprovalService({ auditLog, eventBus: new InMemoryEventBus() });
  new DurableApprovalStore(service);

  const request = service.createRequest({
    id: 'approval-audit-wire',
    tenantId: 'tenant-1',
    racetrackId: 'trk-1',
    action: 'steward-decision',
    target: 'inquiry-audit',
    requestedBy: 'steward-clerk',
    actorType: 'human',
    reason: 'objection review',
    evidence: ['video'],
    now: '2026-06-13T18:00:00Z',
  });

  service.decide(
    request.id,
    human('steward-1', ['steward']),
    'approved',
    'evidence supports ruling',
    ['human-approval-record'],
    '2026-06-13T18:01:00Z',
  );

  const auditEntries = auditLog.all().filter((entry) => entry.type === 'approval');
  assert.ok(auditEntries.some((entry) => entry.action === 'approval.requested'));
  assert.ok(auditEntries.some((entry) => entry.action === 'approval.approved'));
});
