import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RacetrackAssetControlRegistry,
  createRacrAssetTemplate,
  validateRacrAsset,
  racrSupportedAssetTypes,
} from '../dist/index.js';

const admin = { id: 'admin-1', roles: ['registry-admin', 'compliance-officer', 'ai-governance'] };
const trackOps = { id: 'ops-1', roles: ['track-ops'] };

test('RACR authoritative asset envelope carries required twin, risk, approval, telemetry, owner, compliance, state, and lifecycle controls', () => {
  const asset = createRacrAssetTemplate({
    globalId: 'racr:trk-1:camera:paddock-01',
    assetType: 'Camera',
    assetClass: 'digital',
    tenantId: 'trk-1',
    name: 'Paddock Camera 01',
    owner: { ownerId: 'security', ownerType: 'department', accountableRole: 'Security SOC Manager' },
    riskClassification: 'high',
    updatedBy: 'admin-1',
  });

  assert.equal(asset.digitalTwin.modelRef, 'dtmi:trackmind:Camera;1');
  assert.equal(asset.operationalState.status, 'unknown');
  assert.ok(asset.complianceMappings.some((mapping) => mapping.controlId === 'RACR-BASELINE'));
  assert.ok(asset.lifecycleControls.some((control) => control.state === 'active' && control.approvalRequired));
  assert.ok(asset.governanceControls.some((control) => control.enforcedBy === 'rbac'));
  assert.deepEqual(validateRacrAsset(asset), { valid: true, errors: [] });
});

test('RACR supports mandated and future asset categories', () => {
  for (const assetType of ['StartingGate', 'IrrigationSystem', 'SurfaceSector', 'LightingSystem', 'Camera', 'Vehicle', 'Ambulance', 'Horse', 'RaceEvent', 'RegulatoryRecord', 'AIAgent', 'Workflow', 'FutureAssetCategory']) {
    assert.ok(racrSupportedAssetTypes.includes(assetType), `${assetType} should be supported`);
  }
});

test('RACR exposes APIs, event streams, approval recording, state changes, and governance query controls', () => {
  const registry = new RacetrackAssetControlRegistry();
  const horse = createRacrAssetTemplate({
    globalId: 'racr:trk-1:horse:sea-star',
    assetType: 'Horse',
    assetClass: 'biological',
    tenantId: 'trk-1',
    name: 'Sea Star',
    owner: { ownerId: 'stable-1', ownerType: 'tenant', accountableRole: 'Trainer' },
    riskClassification: 'critical',
    updatedBy: 'admin-1',
  });

  registry.create(horse, admin);
  registry.approve(horse.globalId, { approvalId: 'appr-1', action: 'activate', approvedBy: 'admin-1', role: 'compliance-officer', decidedAt: '2026-06-13T00:01:00Z', decision: 'approved', evidence: ['vet-passport://sea-star'] }, admin);
  registry.changeOperationalState(horse.globalId, { status: 'ready', healthScore: 98, lastObservedAt: '2026-06-13T00:02:00Z', activeIncidents: [] }, trackOps, 'race-day readiness verified');

  const current = registry.current(horse.globalId);
  assert.equal(current.approvals.length, 1);
  assert.equal(current.operationalState.status, 'ready');
  assert.equal(registry.events().length, 3);
  assert.ok(registry.apiCatalog().some((api) => api.path === '/racr/assets/{globalId}/telemetry-bindings'));
  assert.equal(registry.query({ assetClass: 'biological', riskClassification: 'critical' }).length, 1);
});
