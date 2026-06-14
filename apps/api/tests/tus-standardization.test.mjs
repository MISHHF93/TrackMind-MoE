import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContract, apiContractSchemas } from '@trackmind/shared';
import { DigitalTwinFoundationPlatform } from '../dist/digitalTwinFoundation.js';
import { DigitalTwinRuntime } from '../dist/digitalTwinRuntime.js';
import { DigitalTwinGraph } from '../dist/twinGraph.js';
import { UniversalEventBus } from '../dist/eventBus.js';
import { RacetrackAssetRegistryService } from '../dist/racetrackAssetRegistryService.js';
import { handleApiRequest } from '../dist/server.js';
import { foundationTwinToTUSTwin, graphNodeToTUSTwin, registryAssetToTUSAsset, runtimeTwinToTUSTwin } from '../dist/tusStandardization.js';

const principal = { id: 'tus-ops', tenantId: 'tenant-raceway', scopes: ['assets:read', 'assets:write', 'assets:approve'] };
const context = { tenantId: 'tenant-raceway', racetrackId: 'bluegrass-park', generatedAt: '2026-06-14T20:00:00.000Z', mock: false };

function asset(assetId, assetType, overrides = {}) {
  return {
    assetId,
    externalIds: [`external:${assetId}`],
    name: `${assetType} ${assetId}`,
    assetType,
    domain: overrides.domain ?? 'facilities',
    riskLevel: overrides.riskLevel ?? 'medium',
    maintenance: { status: overrides.maintenanceStatus ?? 'ok', lastInspectionAt: context.generatedAt },
    ownership: { ownerAgent: overrides.ownerAgent ?? 'FacilitiesIoT', stewardTeam: 'tus-standardization' },
    location: overrides.location ?? { facilityId: 'main-plant' },
    state: overrides.state ?? { operationalStatus: 'ready' },
    controls: overrides.controls ?? [],
    sensors: overrides.sensors ?? [{ id: `${assetId.toLowerCase()}-sensor`, type: 'heartbeat', verifies: ['status'], required: true }],
    regulations: [{ authority: 'StateRacingCommission', reference: 'asset-standardization', appliesTo: ['asset-registry'] }],
    tags: [assetType.toLowerCase()],
    digitalTwin: { twinId: `twin:${assetId.toLowerCase()}`, relationship: 'represents' },
    approvalPolicyId: overrides.approvalPolicyId ?? 'standard-asset-approval',
    metadata: { racetrackId: context.racetrackId },
  };
}

test('TUS asset adapter standardizes representative racing operating system assets', async () => {
  const service = new RacetrackAssetRegistryService();
  const inputs = [
    asset('GATE_STD_01', 'StartingGate', { domain: 'racing', riskLevel: 'high', approvalPolicyId: 'critical-asset-dual-control', location: { sectorId: 'backstretch' }, controls: [{ name: 'starting-gate-move', category: 'C_HUMAN_CONTROLLED', description: 'Move gate only after approvals.', requiresApprovalFrom: ['Starter', 'Steward'], protectedAction: 'starting-gate-move', executionMode: 'human-only' }] }),
    asset('CAMERA_STD_01', 'Camera', { domain: 'security', location: { zoneId: 'paddock' } }),
    asset('GENERATOR_STD_01', 'Generator', { riskLevel: 'high', maintenanceStatus: 'due', approvalPolicyId: 'critical-asset-dual-control', controls: [{ name: 'power-transfer', category: 'C_HUMAN_CONTROLLED', description: 'Life-safety transfer.', requiresApprovalFrom: ['FacilitiesLead'], protectedAction: 'safety-critical-control', executionMode: 'human-only' }] }),
    asset('LIGHT_POLE_STD_01', 'LightPole'),
    asset('IRRIGATION_ZONE_STD_01', 'IrrigationZone', { domain: 'surface', riskLevel: 'high', location: { sectorId: 'far-turn' } }),
    asset('TRACK_SECTOR_STD_01', 'TrackSector', { domain: 'surface', riskLevel: 'high', location: { sectorId: 'far-turn', startMeters: 900, endMeters: 1250 }, state: { moisture: 27, compaction: 276 } }),
    asset('AMBULANCE_STD_01', 'Ambulance', { domain: 'safety', riskLevel: 'critical', approvalPolicyId: 'critical-asset-dual-control', location: { zoneId: 'zone-track' } }),
    asset('STALL_STD_01', 'HorseStall', { location: { barnId: 'barn-2', stallId: '12A' } }),
    asset('BARN_STD_01', 'Barn', { riskLevel: 'high', location: { barnId: 'barn-2' } }),
  ];

  const created = [];
  for (const input of inputs) created.push(await service.create(input, principal));
  const standardized = created.map((item) => registryAssetToTUSAsset(item, context));

  for (const view of standardized) {
    assertContract('TUSAssetStandardDto', view, apiContractSchemas.TUSAssetStandardDto);
    assert.equal(view.schemaVersion, 'trackmind.tus.asset.v1');
    assert.equal(view.tenantId, principal.tenantId);
    assert.equal(view.racetrackId, context.racetrackId);
    assert.ok(view.assetId);
    assert.ok(view.assetType);
    assert.ok(view.location);
    assert.ok(view.state);
    assert.ok(view.health.indicators.length >= 1);
    assert.ok(view.telemetry.length >= 1);
    assert.ok(view.approvals.length >= 1);
    assert.ok(view.audit.length >= 1);
    assert.ok(view.twin?.twinId);
  }

  assert.equal(standardized.find((item) => item.assetType === 'Camera').assetCategory, 'digital');
  assert.equal(standardized.find((item) => item.assetType === 'Ambulance').risk.level, 'critical');
  assert.equal(standardized.find((item) => item.assetType === 'TrackSector').location.sectorId, 'far-turn');
});

test('TUS twin adapters standardize runtime, foundation, and graph twins with context', async () => {
  const eventBus = new UniversalEventBus();
  const runtime = new DigitalTwinRuntime({ eventBus });
  const registry = new RacetrackAssetRegistryService({ eventBus });
  await registry.create(asset('GATE_TWIN_STD_01', 'StartingGate', { domain: 'racing', riskLevel: 'high', location: { sectorId: 'backstretch' } }), principal);
  const runtimeView = runtimeTwinToTUSTwin(runtime.queryTwins({ assetId: 'GATE_TWIN_STD_01' })[0], context);

  const foundation = new DigitalTwinFoundationPlatform();
  const horseTwin = foundation.registerTwin({ id: 'twin:horse:standard', kind: 'horse', name: 'Horse Twin Standard', tenantId: principal.tenantId, state: { assetId: 'HORSE_STD_01', welfareScore: 92 }, updatedAt: context.generatedAt, health: 'healthy', riskScore: 30, telemetryBindings: [{ sensorId: 'horse-wearable', metric: 'heartRate', unit: 'bpm', freshnessSeconds: 60 }], controls: [{ id: 'vet-clearance', action: 'request veterinarian clearance', mode: 'manual-approval-required', requiredApprovals: ['Veterinarian'] }], dependencies: ['STALL_STD_01'], regulatoryRefs: ['HISA'] });
  const foundationView = foundationTwinToTUSTwin(horseTwin, context, foundation.audit(horseTwin.id));

  const graph = new DigitalTwinGraph();
  const aiNode = graph.upsertNode({ id: 'twin:ai:standard', kind: 'operational', labels: ['AI Twin', 'SurfaceOpsAgent'], name: 'AI Twin Standard', tenantId: principal.tenantId, state: { assetId: 'AI_AGENT_STD_01', health: 'degraded', riskScore: 65, advisoryOnly: true }, updatedAt: context.generatedAt });
  const graphView = graphNodeToTUSTwin(aiNode, context);

  for (const view of [runtimeView, foundationView, graphView]) {
    assertContract('TUSTwinStandardDto', view, apiContractSchemas.TUSTwinStandardDto);
    assert.equal(view.schemaVersion, 'trackmind.tus.twin.v1');
    assert.equal(view.context.tenantId, principal.tenantId);
    assert.equal(view.context.racetrackId, context.racetrackId);
    assert.ok(view.state);
    assert.ok(view.health.indicators.length >= 1);
    assert.ok(view.risk.score >= 0);
    assert.ok(view.audit.length >= 1);
  }

  assert.equal(runtimeView.twinType, 'gate');
  assert.equal(foundationView.twinType, 'horse');
  assert.equal(graphView.twinType, 'ai');
});

test('TUS facade exposes standard asset and twin coverage without breaking legacy endpoints', async () => {
  const assets = await handleApiRequest('GET', '/api/v1/assets/standard');
  const twins = await handleApiRequest('GET', '/api/v1/digital-twin/standard');
  const workspace = await handleApiRequest('GET', '/api/v1/tus/standardization');
  const legacyAssets = await handleApiRequest('GET', '/api/v1/assets');
  const legacyTwins = await handleApiRequest('GET', '/api/v1/digital-twin/state');

  assert.equal(assets.status, 200);
  assert.equal(twins.status, 200);
  assert.equal(workspace.status, 200);
  assert.equal(legacyAssets.status, 200);
  assert.equal(legacyTwins.status, 200);
  assert.ok(Array.isArray(assets.body));
  assert.ok(Array.isArray(twins.body));
  assert.ok(assets.body.some((item) => item.assetType === 'StartingGate'));
  assert.ok(assets.body.some((item) => item.assetType === 'Camera'));
  assert.ok(assets.body.some((item) => item.assetType === 'Ambulance'));
  assert.deepEqual(['ai', 'employee', 'facility', 'gate', 'horse', 'race', 'track'], [...new Set(twins.body.map((item) => item.twinType))].sort());
  assert.equal(workspace.body.coverage.telemetryBindings > 0, true);
  assert.equal(workspace.body.coverage.approvals > 0, true);
  assert.equal(workspace.body.coverage.auditEvents > 0, true);
});
