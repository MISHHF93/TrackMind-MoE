import test from 'node:test';
import assert from 'node:assert/strict';
import { createMasterDataEntityTemplate, EnterpriseMasterDataRegistry, enterpriseDomainSchemas, enterpriseRelationshipBlueprints, getEnterpriseDomainSchema, validateMasterDataEntity } from '../dist/index.js';

test('enterprise domain catalog covers racetrack canonical entities with governance metadata', () => {
  const expected = ['racetrack', 'race-day', 'race', 'horse', 'jockey', 'trainer', 'owner', 'veterinarian', 'steward', 'maintenance-crew', 'security-personnel', 'facility', 'asset', 'sensor', 'track-sector', 'betting-system', 'ticketing-system', 'incident', 'investigation', 'compliance-record', 'ai-recommendation', 'approval', 'digital-twin-object'];
  assert.deepEqual(enterpriseDomainSchemas.map((schema) => schema.kind), expected);
  const horse = getEnterpriseDomainSchema('horse');
  assert.equal(horse.classification, 'regulated');
  assert.equal(horse.schemaVersion, 'edm.v1');
  assert.ok(horse.owner.accountableRole.includes('Horse'));
  assert.ok(horse.fields.some((field) => field.name === 'registrationNumber' && field.required));
});

test('master data entities validate required fields, namespace, quality, and lifecycle', () => {
  const horse = createMasterDataEntityTemplate('horse', { entityId: 'edm:horse:001', tenantId: 'track-001', name: 'Northern Logic', updatedBy: 'data-steward', attributes: { registrationNumber: 'H-001', microchipId: 'M-001' }, sourceSystem: 'equine-passport' });
  assert.deepEqual(validateMasterDataEntity(horse), { valid: true, errors: [] });
  const invalid = { ...horse, entityId: 'horse-001', attributes: {}, metadata: { ...horse.metadata, qualityScore: 101 } };
  const result = validateMasterDataEntity(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('entityId must use edm: namespace'));
  assert.ok(result.errors.includes('qualityScore must be between 0 and 100'));
  assert.ok(result.errors.includes('missing required field registrationNumber'));
});

test('registry versions entities, records audit trail, and maps canonical relationships', () => {
  const registry = new EnterpriseMasterDataRegistry();
  const raceDay = registry.upsert(createMasterDataEntityTemplate('race-day', { entityId: 'edm:race-day:2026-06-13', tenantId: 'track-001', name: 'Belmont Day', updatedBy: 'ops', attributes: { raceDate: '2026-06-13T00:00:00Z', status: 'scheduled' } }), 'ops');
  const race = registry.upsert(createMasterDataEntityTemplate('race', { entityId: 'edm:race:2026-06-13:01', tenantId: 'track-001', name: 'Race 1', updatedBy: 'steward', attributes: { raceNumber: 1, surface: 'dirt' } }), 'steward');
  const activeRace = registry.transition(race.entityId, 'active', 'steward', 'race opened');
  const rel = registry.relate({ fromEntityId: raceDay.entityId, toEntityId: race.entityId, relationshipType: 'race-day-contains-race', cardinality: 'one-to-many', strength: 'canonical', validFrom: '2026-06-13T12:00:00Z' }, 'ops');
  assert.equal(activeRace.version, 2);
  assert.equal(registry.history(race.entityId).length, 2);
  assert.equal(rel.relationshipId, 'edm-rel-1');
  assert.equal(registry.relationshipMap(race.entityId).length, 1);
  assert.equal(registry.auditTrail().length, 4);
  assert.ok(enterpriseRelationshipBlueprints.some((blueprint) => blueprint.relationshipType === 'digital-twin-object-represents-entity'));
});
