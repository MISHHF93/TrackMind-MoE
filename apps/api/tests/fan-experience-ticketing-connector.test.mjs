import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { createSeededFanExperience } from '../dist/fanExperiencePlatform.js';
import { handleFanExperienceApiRequest } from '../dist/fanExperience.js';
import { createTicketingAdapterRegistry } from '../dist/ticketingAdapter.js';

test('fan experience ticketing connector syncs inventory and attendance with audit + degraded labeling', () => {
  const now = () => '2026-06-21T12:00:00.000Z';
  const auditLog = new ImmutableAuditLog();
  const service = createSeededFanExperience({ auditLog }, now());
  const ticketing = createTicketingAdapterRegistry(now());
  const response = handleFanExperienceApiRequest(
    'GET',
    '/fan-experience/workspace',
    undefined,
    service,
    new URLSearchParams(),
    now,
    { ticketing, auditLog },
  );

  assert.equal(response?.status, 200);
  assert.ok(response?.body.ticketingConnector);
  assert.equal(response.body.ticketingConnector.overallStatus, 'degraded');
  assert.equal(response.body.ticketingConnector.degraded, true);
  assert.equal(response.body.ticketingConnector.inventorySource, 'degraded-connector');
  assert.equal(response.body.ticketingConnector.attendanceSource, 'degraded-connector');
  assert.ok(response.body.ticketingConnector.adapters.length >= 2);
  assert.ok(response.body.ticketingConnector.syncAuditIds.length >= 1);
  assert.equal(response.body.ticketInventory.sold, 8490);
  assert.equal(response.body.attendance.current, 8490);
  assert.ok(auditLog.all().some((entry) => entry.payload?.action === 'fan-experience.ticketing.sync'));
});
