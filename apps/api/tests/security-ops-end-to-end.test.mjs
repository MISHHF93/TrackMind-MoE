import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog, RacetrackAssetRegistryService, SecurityOperationsService, UniversalEventBus } from '../dist/index.js';

const fullActor = { id: 'sec-commander', roles: ['security'], tenantId: 'trackmind', human: true, permissions: ['security:read','security:sensitive-read','security:manage','security:investigate'] };

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
  assert.equal(masked.restrictedZones.find((zone) => zone.id === 'zone-backstretch-medication').requiredCredential, '••••');
  assert.equal(masked.credentialChecks[0].credentialId, '••••');
  assert.equal(masked.credentialChecks[0].requiredCredential, '••••');
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

test('security operations mirrors actions to shared audit, events, and twin updates', () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new UniversalEventBus();
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z', { auditLog, eventBus });

  service.recordAccessEvent(fullActor, { zoneId: 'zone-backstretch-medication', credentialId: 'cred-999', personDisplayName: 'Contractor C', personLegalName: 'Contractor Gamma', decision: 'denied', reason: 'after-hours critical zone access', occurredAt: '2026-06-14T00:00:00.000Z' });
  const workspace = service.getWorkspace(fullActor);

  assert.ok(workspace.sharedAuditRecords.some((record) => record.type === 'security-event' && record.subjectId === 'security:zone-backstretch-medication'));
  assert.ok(eventBus.events({ type: 'security.access.checked' }).length >= 1);
  assert.ok(workspace.events.some((event) => event.type === 'security.incident.created'));
  assert.ok(workspace.events.some((event) => event.type === 'security.twin.patch.queued'));
  assert.ok(workspace.twinUpdates.some((update) => update.twinId === 'twin:zone-backstretch-medication' && update.status === 'published' && update.eventId));
});

test('approved sensitive access can reveal protected fields and remains audited', () => {
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z');
  const auditor = { id: 'auditor-1', roles: ['read-only-auditor'], permissions: ['security:read'] };

  service.checkCredential(fullActor, { credentialId: 'cred-sensitive', holderDisplayName: 'Visitor D', holderLegalName: 'Visitor Delta', zoneId: 'zone-grandstand', status: 'valid' });
  service.requestSensitiveAccess(auditor, { reason: 'Compliance review', evidence: ['manager-ticket'] });
  service.approveSensitiveAccess({ id: 'approval-sensitive-1', actorId: auditor.id, approver: 'security-manager', timestamp: '2026-06-14T00:00:00.000Z', reason: 'Approved compliance review', evidence: ['manager-ticket'] });
  const workspace = service.getWorkspace(auditor);

  assert.equal(workspace.credentialChecks[0].credentialId, 'cred-sensitive');
  assert.ok(workspace.auditRecords.some((record) => record.action === 'sensitive-fields.accessed'));
  assert.ok(workspace.auditRecords.some((record) => record.action === 'security.approval.approved'));
  assert.ok(workspace.events.some((event) => event.type === 'security.approval.requested'));
  assert.ok(workspace.events.some((event) => event.type === 'security.approval.approved'));
});

test('security authorization failures are audited and emitted', () => {
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z');
  assert.throws(() => service.getWorkspace({ id: 'visitor', permissions: [] }), /missing permission/);
  const events = service.listEvents();
  const audits = service.listAuditRecords();

  assert.ok(audits.some((record) => record.action === 'security.authorization.failed'));
  assert.ok(events.some((event) => event.type === 'security.authorization.failed'));
});

test('camera assets sync to registry with shared audit evidence', async () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new UniversalEventBus();
  const registry = new RacetrackAssetRegistryService({ auditLog, eventBus });
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z', { auditLog, eventBus, assetRegistry: registry });

  const links = await service.syncCameraAssetsToRegistry({ id: 'asset-sync', tenantId: 'trackmind', scopes: ['assets:write','assets:read'] });

  assert.ok(links.length >= 2);
  assert.ok(registry.query({ domain: 'security' }, { id: 'asset-reader', tenantId: 'trackmind', scopes: ['assets:read'] }).assets.some((asset) => asset.assetType === 'SecurityCamera'));
  assert.ok(auditLog.all().some((record) => record.type === 'security-event' && record.payload.action === 'security.asset.synced'));
});

