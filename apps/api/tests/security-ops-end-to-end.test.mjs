import test from 'node:test';
import assert from 'node:assert/strict';
import { SecurityOperationsService } from '../dist/index.js';

const fullActor = { id: 'sec-commander', permissions: ['security:read','security:sensitive:read','security:write','security:escalate','security:investigate'] };

test('security operations enforces access control and creates auditable events/incidents', () => {
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z');
  const check = service.checkCredential(fullActor, { credentialId: 'cred-123', holderDisplayName: 'Visitor A', holderLegalName: 'Visitor Alpha', zoneId: 'zone-backstretch-medication', status: 'revoked' });
  assert.equal(check.decision, 'deny');
  const access = service.recordAccessEvent(fullActor, { zoneId: 'zone-backstretch-medication', credentialId: 'cred-123', personDisplayName: 'Visitor A', personLegalName: 'Visitor Alpha', decision: 'denied', reason: 'revoked credential', occurredAt: '2026-06-14T00:00:00.000Z' });
  assert.match(access.eventId, /evt-security-access/);
  const workspace = service.getWorkspace(fullActor);
  assert.equal(workspace.incidents.length, 1);
  assert.equal(workspace.auditRecords.some((record) => record.action === 'access.checked' && record.sensitiveFields.includes('credentialId')), true);
});

test('privacy-sensitive security fields are masked without sensitive-read permission', () => {
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z');
  service.checkCredential(fullActor, { credentialId: 'cred-secret', holderDisplayName: 'Contractor B', holderLegalName: 'Contractor Beta', zoneId: 'zone-grandstand', status: 'valid' });
  service.recordAccessEvent(fullActor, { zoneId: 'zone-grandstand', credentialId: 'cred-secret', personDisplayName: 'Contractor B', personLegalName: 'Contractor Beta', decision: 'granted', reason: 'valid credential', occurredAt: '2026-06-14T00:00:00.000Z' });
  const masked = service.getWorkspace({ id: 'auditor', permissions: ['security:read'] });
  assert.equal(masked.credentialChecks[0].credentialId, '••••');
  assert.equal(masked.credentialChecks[0].holderLegalName, '••••');
  assert.equal(masked.accessEvents[0].credentialId, '••••');
  assert.equal(masked.watchlistPlaceholders[0].sensitiveNotes, '••••');
});

test('investigations and escalation workflows update dashboard queues and audit chain', () => {
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z');
  const incident = service.createIncident(fullActor, { title: 'Camera tamper and door alarm', severity: 'critical', zoneId: 'zone-backstretch-medication', eventIds: ['evt-1'] });
  const investigation = service.openInvestigation(fullActor, incident.id, 'investigator-1');
  const escalation = service.escalateIncident(fullActor, incident.id);
  const workspace = service.getWorkspace(fullActor);
  assert.equal(investigation.status, 'queued');
  assert.equal(escalation.status, 'sent');
  assert.equal(workspace.dashboard.activeAlerts, 1);
  assert.equal(workspace.dashboard.investigationQueue, 1);
  assert.equal(workspace.dashboard.cameraHealth.degraded, 1);
  assert.equal(workspace.auditRecords.at(-1).previousHash, workspace.auditRecords.at(-2).hash);
});

