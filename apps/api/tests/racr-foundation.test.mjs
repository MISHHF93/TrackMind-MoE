import test from 'node:test';
import assert from 'node:assert/strict';
import { RacetrackAssetControlRegistry, authorizeRacrAction, createRacrAssetTemplate, validateRacrAsset, racrSupportedAssetTypes } from '../dist/index.js';

const admin = { id: 'admin-1', roles: ['registry-admin', 'compliance-officer'] };
const ops = { id: 'ops-1', roles: ['track-ops'] };
const viewer = { id: 'viewer-1', roles: ['viewer'] };

test('RACR provides schema validation and coverage for racetrack asset classes', () => {
  assert.ok(racrSupportedAssetTypes.includes('StartingGate'));
  assert.ok(racrSupportedAssetTypes.includes('Horse'));
  assert.ok(racrSupportedAssetTypes.includes('WageringSystem'));
  assert.ok(racrSupportedAssetTypes.includes('AIAgent'));
  const asset = createRacrAssetTemplate({ globalId: 'racr:trk-1:gate:01', assetType: 'StartingGate', assetClass: 'physical', tenantId: 'trk-1', name: 'Gate 1', owner: { ownerId: 'race-ops', ownerType: 'department', accountableRole: 'Racing Secretary' }, riskClassification: 'high', updatedBy: 'admin-1' });
  assert.deepEqual(validateRacrAsset(asset), { valid: true, errors: [] });
});

test('RACR versions assets, audits changes, emits events, and returns defensive copies', () => {
  const registry = new RacetrackAssetControlRegistry();
  const asset = createRacrAssetTemplate({ globalId: 'racr:trk-1:horse:001', assetType: 'Horse', assetClass: 'biological', tenantId: 'trk-1', name: 'Example Horse', owner: { ownerId: 'owner-1', ownerType: 'person', accountableRole: 'Owner' }, riskClassification: 'critical', updatedBy: 'admin-1' });
  const created = registry.create(asset, admin);
  const updated = registry.update(created.globalId, { lifecycleState: 'active', metadata: { barn: 'A', stall: '12' }, twinRelationships: [{ twinId: 'twin:horse:001', relationship: 'represents', since: '2026-06-13T00:00:00Z' }] }, admin, 'activate horse profile');
  assert.equal(updated.version, 2);
  assert.equal(registry.history(created.globalId).length, 2);
  assert.equal(registry.auditTrail(created.globalId).length, 2);
  assert.equal(registry.events().length, 2);
  updated.metadata.barn = 'mutated';
  assert.equal(registry.current(created.globalId).metadata.barn, 'A');
});

test('RACR enforces RBAC, telemetry binding, maintenance history, soft delete, and rollback', () => {
  const registry = new RacetrackAssetControlRegistry();
  const asset = createRacrAssetTemplate({ globalId: 'racr:trk-1:irrigation:04', assetType: 'IrrigationSystem', assetClass: 'physical', tenantId: 'trk-1', name: 'Irrigation Zone 4', owner: { ownerId: 'surface-team', ownerType: 'department', accountableRole: 'Track Superintendent' }, riskClassification: 'medium', updatedBy: 'admin-1' });
  registry.create(asset, admin);
  assert.equal(authorizeRacrAction(viewer, 'update'), false);
  assert.throws(() => registry.update(asset.globalId, { lifecycleState: 'active' }, viewer), /not authorized/);
  registry.bindTelemetry(asset.globalId, { bindingId: 'bind-1', sourceId: 'moisture-turn-2', stream: 'surface.moisture', schemaRef: 'telemetry.surface.v1', required: true }, ops);
  registry.recordMaintenance(asset.globalId, { recordId: 'maint-1', performedAt: '2026-06-13T01:00:00Z', performedBy: 'crew-1', summary: 'Nozzle inspection', evidence: ['photo://1'] }, ops);
  assert.equal(registry.current(asset.globalId).maintenanceHistory.length, 1);
  registry.softDelete(asset.globalId, admin, 'decommissioned');
  assert.throws(() => registry.current(asset.globalId), /deleted/);
  const rolledBack = registry.rollback(asset.globalId, 3, admin, 'restore after erroneous decommission');
  assert.equal(rolledBack.lifecycleState, 'draft');
  assert.equal(rolledBack.telemetryBindings.length, 1);
});
