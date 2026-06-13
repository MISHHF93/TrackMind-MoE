import assert from 'node:assert/strict';
import test from 'node:test';
import { RacetrackAssetRegistryService, racetrackAssetRegistryApiDefinition, EnterpriseServiceRegistry, EnterpriseApiGateway } from '../dist/index.js';

const principal = { id: 'ops-user-1', tenantId: 'track-a', scopes: ['assets:read', 'assets:write', 'assets:approve'] };
const baseAsset = {
  assetId: 'START_GATE_02',
  externalIds: ['erp:gate:2'],
  name: 'Starting Gate 02',
  assetType: 'StartingGate',
  domain: 'racing',
  riskLevel: 'high',
  maintenance: { status: 'ok', nextInspectionDueAt: '2026-06-20T00:00:00Z' },
  ownership: { ownerAgent: 'RaceOps', stewardTeam: 'race-ops' },
  location: { railPositionMeters: 1200 },
  state: { doors: 'CLOSED', locked: true },
  controls: [],
  sensors: [],
  regulations: [{ authority: 'StateRacingCommission', reference: 'start procedures', appliesTo: ['race-start'] }],
  tags: ['Gate', 'Race-Day'],
  digitalTwin: { twinId: 'dtmi:trackmind:gate;2', relationship: 'represents' },
  approvalPolicyId: 'critical-asset-dual-control',
  metadata: { manufacturer: 'TrackMind' },
};

test('racetrack asset registry supports lifecycle, search, audit, cache, and event emission', async () => {
  const service = new RacetrackAssetRegistryService();
  const emitted = [];
  service.eventBus.subscribe('*', (event) => emitted.push(event));

  const created = await service.create(baseAsset, principal);
  assert.equal(created.assetId, 'START_GATE_02');
  assert.equal(created.lifecycleStatus, 'draft');

  const firstQuery = service.query({ tag: 'gate', twinId: 'dtmi:trackmind:gate;2' }, principal);
  const secondQuery = service.query({ tag: 'gate', twinId: 'dtmi:trackmind:gate;2' }, principal);
  assert.equal(firstQuery.cache, 'miss');
  assert.equal(secondQuery.cache, 'hit');
  assert.equal(secondQuery.total, 1);

  await service.activate(created.assetId, principal);
  await service.assign(created.assetId, 'starter-team-a', principal);
  await service.inspect(created.assetId, { inspector: 'inspector-1', status: 'due', nextInspectionDueAt: '2026-06-14T00:00:00Z' }, principal);
  await service.approve(created.assetId, { id: 'approval-1', status: 'approved', approver: 'safety-officer', timestamp: '2026-06-13T12:00:00Z', reason: 'pre-race readiness', evidence: ['inspection-report', 'photo-log'] }, principal);
  await service.deactivate(created.assetId, principal);
  await service.archive(created.assetId, principal);

  assert.deepEqual(emitted.map((event) => event.type), [
    'racetrack.asset.created',
    'racetrack.asset.activated',
    'racetrack.asset.updated',
    'racetrack.asset.assigned',
    'racetrack.asset.updated',
    'racetrack.asset.inspected',
    'racetrack.asset.approved',
    'racetrack.asset.deactivated',
    'racetrack.asset.archived',
  ]);
  assert.equal(service.auditLog.verify().valid, true);
  assert.equal(service.query({ lifecycleStatus: 'archived', riskLevel: 'high', maintenanceStatus: 'due', ownerAgent: 'RaceOps' }, principal).total, 1);
});

test('racetrack asset registry enforces unique identifiers and gateway auth scopes', async () => {
  const service = new RacetrackAssetRegistryService();
  await service.create(baseAsset, principal);
  await assert.rejects(() => service.create({ ...baseAsset, assetId: 'START_GATE_03' }, principal), /external id must be unique/);
  assert.throws(() => service.get('START_GATE_02', { id: 'viewer', scopes: [] }), /missing scope/);

  const registry = new EnterpriseServiceRegistry();
  registry.register(racetrackAssetRegistryApiDefinition());
  const gateway = new EnterpriseApiGateway(registry);
  assert.equal(gateway.route({ serviceId: 'racetrack-asset-registry', path: '/', method: 'GET', principal: { id: 'viewer', scopes: ['assets:read'] }, nowEpochMs: 1 }).allowed, true);
  assert.equal(gateway.route({ serviceId: 'racetrack-asset-registry', path: '/', method: 'POST', principal: { id: 'viewer', scopes: ['assets:read'] }, nowEpochMs: 2 }).status, 403);
});
