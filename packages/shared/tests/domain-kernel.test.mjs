import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomainEntityBase, deserializeDomainEntity, domainKernelSchemaVersion, domainSchemas, serializeDomainEntity, validateDomainEntity } from '../dist/index.js';

const now = '2026-06-13T00:00:00.000Z';

test('domain kernel registers schemas for all core TrackMind Nexus entities', () => {
  assert.deepEqual(Object.keys(domainSchemas), ['racetrack','race-day','race','horse','jockey','trainer','owner','veterinarian','steward','track-sector','starting-gate','sensor','facility','vehicle','incident','workflow','ai-recommendation','approval','audit-record']);
  assert.equal(domainSchemas.horse.schemaVersion, domainKernelSchemaVersion);
  assert.ok(domainSchemas['ai-recommendation'].rules.some((rule) => rule.path === 'confidence'));
});

test('domain kernel validates metadata, ownership, versioning, lifecycle, and entity specific constraints', () => {
  const horse = {
    ...createDomainEntityBase('horse', { id: 'horse-001', tenantId: 'track-001', displayName: 'Northern Logic', ownerId: 'equine-safety', createdBy: 'registrar', now, classification: 'regulated' }),
    registrationNumber: 'TB-001', microchipId: '985141001', status: 'active', trainerId: 'trainer-001', ownerIds: ['owner-001'],
    digitalTwin: { twinId: 'twin:horse:horse-001', modelId: 'horse.v1', entity: { id: 'horse-001', kind: 'horse', tenantId: 'track-001' }, sourceSystem: 'nexus-twin' },
    approvals: [{ approvalId: 'approval-001', status: 'approved', protectedAction: 'clear-veterinary-flag' }],
    events: [{ eventId: 'event-001', eventType: 'horse-arrived', occurredAt: now }]
  };
  assert.deepEqual(validateDomainEntity(horse), { valid: true, errors: [] });
  const invalid = { ...horse, ownership: { ...horse.ownership, tenantId: 'other-track' }, version: { ...horse.version, entityVersion: 0 }, ownerIds: undefined };
  const result = validateDomainEntity(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('tenantId must match ownership.tenantId'));
  assert.ok(result.errors.includes('version.entityVersion must be >= 1'));
  assert.ok(result.errors.includes('ownerIds is required'));
});

test('domain kernel serialization round trips and rejects invalid payloads for backward compatible JSON contracts', () => {
  const approval = {
    ...createDomainEntityBase('approval', { id: 'approval-001', tenantId: 'track-001', displayName: 'Scratch approval', ownerId: 'stewarding', createdBy: 'steward-1', now, lifecycleState: 'pending-approval', classification: 'regulated' }),
    recommendationId: 'ai-rec-001', protectedAction: 'scratch-horse', target: { id: 'horse-001', kind: 'horse', tenantId: 'track-001' }, status: 'approved', approverId: 'steward-1', approverRoles: ['steward'], reason: 'Vet evidence accepted', evidence: ['vet-note']
  };
  const payload = serializeDomainEntity(approval);
  assert.equal(deserializeDomainEntity(payload).id, approval.id);
  assert.throws(() => deserializeDomainEntity(JSON.stringify({ ...approval, confidence: 2, kind: 'ai-recommendation' })), /target is required|confidence/);
});
