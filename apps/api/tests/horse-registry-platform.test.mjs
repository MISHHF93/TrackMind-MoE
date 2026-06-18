import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, EquineIntelligencePlatform, ImmutableAuditLog, createSeededHorseRegistry } from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('horse registry workspace exposes identity ownership trainer stable breeding registration eligibility and twin sync', () => {
  const auditLog = new ImmutableAuditLog();
  const equinePlatform = new EquineIntelligencePlatform({ auditLog, tenantId: 'trackmind' });
  const registry = createSeededHorseRegistry({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const workspace = registry.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.horse-registry.v1');
  assert.ok(workspace.horses.length >= 1);
  const horse = workspace.horses.find((entry) => entry.identity.horseId === 'horse-1');
  assert.ok(horse);
  assert.equal(horse.identity.name, 'Lifecycle Runner');
  assert.ok(horse.ownershipHistory.length >= 1);
  assert.ok(horse.trainerHistory.length >= 1);
  assert.ok(horse.stableHistory.length >= 1);
  assert.equal(horse.breedingMetadata.sireId, 'sire-1');
  assert.ok(horse.registrationRecords.length >= 2);
  assert.equal(horse.digitalTwin.twinId, 'equine:horse-1');
  assert.equal(horse.digitalTwin.readOnly, true);
  assert.ok(workspace.twinSyncCount >= 1);
  assert.deepEqual(validateContract('HorseRegistryWorkspaceDto', workspace, apiContractSchemas.HorseRegistryWorkspaceDto), { valid: true, errors: [] });
});

test('horse registry mutations append immutable lifecycle history and sync digital twin', () => {
  const auditLog = new ImmutableAuditLog();
  const equinePlatform = new EquineIntelligencePlatform({ auditLog, tenantId: 'trackmind' });
  const registry = createSeededHorseRegistry({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  registry.workspace('2026-06-14T12:00:00.000Z');

  const created = registry.registerHorse({
    identity: { horseId: 'horse-registry-2', name: 'Registry Runner', lifecycleStatus: 'active' },
    breedingMetadata: { sireId: 'sire-2', damId: 'dam-2', studBook: 'TB-2023' },
    registrationRecords: [{ authority: 'Jockey Club', registrationNumber: 'TB-2300001', registrationType: 'racing', effectiveFrom: '2023-04-01', status: 'active', evidence: ['foal-registration'] }],
    ownership: [{ ownerId: 'owner-2', ownerName: 'Registry Stable', effectiveFrom: '2026-01-01', percentage: 100, evidence: ['bill-of-sale'] }],
    trainer: { trainerId: 'trainer-2', trainerName: 'Registry Trainer', effectiveFrom: '2026-02-01', licenseStatus: 'active', evidence: ['license-registry'] },
  });
  assert.equal(created.twinSynced, true);
  assert.ok(created.auditId);

  registry.recordStableAssignment('horse-registry-2', { barnId: 'barn-3', stallId: 'stall-3A', assignedAt: '2026-06-14T12:00:00.000Z', assignedBy: 'racing-secretary', evidence: ['barn-assignment'] });
  const retired = registry.recordRetirement('horse-registry-2', { retiredAt: '2026-12-01T00:00:00.000Z', reason: 'soundness', destination: 'aftercare-farm', evidence: ['retirement-form'] });
  assert.equal(retired.lifecycleStatus, 'retired');

  const history = registry.lifecycleHistory('horse-registry-2');
  assert.ok(history.length >= 3);
  assert.ok(history.every((entry) => entry.hash && entry.previousHash));

  const twin = registry.twinSyncStatus('horse-registry-2');
  assert.equal(twin?.lifecycleStatus, 'retired');
  assert.equal(twin?.readOnly, true);
  assert.ok(auditLog.all().length >= 3);
});
