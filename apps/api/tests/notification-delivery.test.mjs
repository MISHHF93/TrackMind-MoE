import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationFramework,
  resetApprovalRepositoryForTests,
} from '../dist/index.js';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const adminHeaders = {
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-role': 'platform-super-admin',
};

test('notification delivery adapters dispatch in-app, email-stub, and webhook-stub', () => {
  const before = notificationFramework.deliveryAuditTrail().length;
  const result = notificationFramework.dispatch({
    category: 'platform',
    title: 'Adapter probe',
    message: 'Verify all delivery adapters.',
    targetRoles: ['platform-super-admin'],
    severity: 'info',
  });

  assert.equal(result.delivery.length, 3);
  assert.deepEqual(
    result.delivery.map((entry) => entry.channel).sort(),
    ['email-stub', 'in-app', 'webhook-stub'],
  );
  assert.ok(result.delivery.every((entry) => entry.delivered));
  assert.ok(result.delivery.every((entry) => entry.notificationId === result.notification.id));
  assert.ok(notificationFramework.deliveryAuditTrail().length >= before + 3);
});

test('delivery audit trail filters by notification id and supports redispatch', () => {
  const dispatched = notificationFramework.dispatch({
    category: 'approval',
    title: 'Audit trail probe',
    message: 'Filter and redispatch.',
    targetRoles: ['steward'],
    severity: 'warning',
  });

  const filtered = notificationFramework.deliveryAuditTrail(dispatched.notification.id);
  assert.ok(filtered.length >= 3);
  assert.ok(filtered.every((entry) => entry.notificationId === dispatched.notification.id));

  const redelivered = notificationFramework.redispatch(dispatched.notification.id, ['email-stub']);
  assert.ok(redelivered);
  assert.equal(redelivered.length, 1);
  assert.equal(redelivered[0].channel, 'email-stub');
});

test('approval reminders and incident notifications produce delivery audit entries via API', async () => {
  resetApprovalRepositoryForTests();
  const state = createApiFacadeState();

  const created = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', {
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    action: 'race-stop',
    target: 'race-delivery-audit',
    actorId: 'starter',
    actorType: 'human',
    roles: ['steward'],
    reason: 'Verify delivery audit trail wiring',
    evidence: ['incident-report'],
  }, state, { ...adminHeaders, 'x-trackmind-role': 'steward' });
  assert.equal(created.status, 202);

  const durable = await handleApiRequest('GET', '/api/v1/approvals/durable', undefined, state, adminHeaders);
  assert.equal(durable.status, 200);
  const durableRecord = durable.body.find((item) => item.target === 'race-delivery-audit');
  assert.ok(durableRecord);

  const reminderAt = new Date(Date.parse(durableRecord.createdAt) + 4 * 60_000 + 30_000).toISOString();
  const escalation = await handleApiRequest('POST', '/api/v1/approvals/escalation/simulate', {
    now: reminderAt,
    reminderLeadMinutes: 5,
  }, state, adminHeaders);
  assert.equal(escalation.status, 200);
  assert.ok(escalation.body.remindersSent.length >= 1);

  const incident = await handleApiRequest('POST', '/api/v1/incidents', {
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    title: 'Delivery audit incident',
    description: 'Incident notification dispatch probe.',
    severity: 'high',
    category: 'safety',
    reportedBy: 'security-officer',
    status: 'reported',
  }, state, adminHeaders);
  assert.equal(incident.status, 201);

  const dispatch = await handleApiRequest('POST', '/api/v1/notifications/dispatch', {
    category: 'compliance',
    title: 'Manual dispatch probe',
    message: 'POST /notifications/dispatch audit trail.',
    targetRoles: ['platform-super-admin'],
    severity: 'info',
  }, state, adminHeaders);
  assert.equal(dispatch.status, 202);
  assert.ok(Array.isArray(dispatch.body.delivery));
  assert.equal(dispatch.body.delivery.length, 3);

  const auditTrail = await handleApiRequest('GET', '/api/v1/notifications/delivery-audit-trail', undefined, state, adminHeaders);
  assert.equal(auditTrail.status, 200);
  assert.ok(auditTrail.body.entries.length >= 6);
  assert.ok(auditTrail.body.entries.some((entry) => entry.channel === 'webhook-stub'));
  assert.ok(auditTrail.body.entries.some((entry) => entry.detail?.includes('email-stub')));

  const inbox = await handleApiRequest('GET', '/api/v1/notifications/inbox?role=platform-super-admin', undefined, state, adminHeaders);
  assert.equal(inbox.status, 200);
  assert.ok(inbox.body.notifications.some((item) => item.category === 'incident'));
  assert.ok(inbox.body.notifications.some((item) => item.title.includes('Approval reminder') || item.title.includes('Approval requested')));
});
