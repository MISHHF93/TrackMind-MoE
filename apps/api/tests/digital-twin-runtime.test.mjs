import test from 'node:test';
import assert from 'node:assert/strict';
import { DigitalTwinRuntime, RacetrackAssetRegistryService, UniversalEventBus, ImmutableAuditLog } from '../dist/index.js';

const principal = { id: 'ops-user', scopes: ['assets:write', 'assets:read', 'assets:approve'], tenantId: 'trk-1' };
const assetInput = {
  assetId: 'START_GATE_RUNTIME_01',
  externalIds: ['gate-runtime-01'],
  name: 'Runtime Starting Gate',
  assetType: 'StartingGate',
  domain: 'racing',
  riskLevel: 'high',
  maintenance: { status: 'ok', lastInspectionAt: '2026-06-13T08:00:00Z' },
  ownership: { ownerAgent: 'RaceOps', stewardTeam: 'gate-crew' },
  location: { railPositionMeters: 1600 },
  state: { batteryStatus: 80, locked: true },
  controls: [{ name: 'lock-status', category: 'C_HUMAN_CONTROLLED', description: 'Confirm lock before start.', requiresApprovalFrom: ['Starter'], executionMode: 'human-only' }],
  sensors: [{ id: 'gate-battery-runtime-01', type: 'battery', verifies: ['batteryStatus'], required: true }],
  regulations: [{ authority: 'StateRacingCommission', reference: 'Start procedures', appliesTo: ['lock-status'] }],
  tags: ['gate'],
  approvalPolicyId: 'critical-asset-dual-control',
  metadata: { dependsOn: ['twin:POWER_PANEL_01'] },
};

test('digital twin runtime auto-creates asset twins, applies stream updates, exposes history relationships health simulation and audit APIs', async () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const runtime = new DigitalTwinRuntime({ eventBus, auditLog });
  const registry = new RacetrackAssetRegistryService({ eventBus, auditLog });

  await registry.create(assetInput, principal);

  const [created] = runtime.queryTwins({ assetId: 'START_GATE_RUNTIME_01' });
  assert.equal(created.twinId, 'twin:START_GATE_RUNTIME_01');
  assert.equal(created.health, 'degraded');
  assert.equal(created.telemetryReferences[0].sensorId, 'gate-battery-runtime-01');
  assert.equal(created.approvalRequirements[0].requiredApprovers[0], 'Starter');
  assert.equal(runtime.viewRelationships(created.twinId).some((rel) => rel.type === 'depends-on'), true);

  await eventBus.publish({ type: 'telemetry.observed', producer: 'telemetry-stream', aggregateId: created.twinId, payload: { twinId: created.twinId, sensorId: 'gate-battery-runtime-01', metric: 'batteryStatus', value: 91, observedAt: '2026-06-13T10:05:00Z' } });
  const updated = runtime.getTwin(created.twinId);

  assert.equal(updated.state.batteryStatus, 91);
  assert.equal(updated.health, 'critical');
  assert.equal(runtime.replayHistory(created.twinId).length, 2);
  assert.equal(runtime.calculateOperationalHealth({ riskLevel: 'critical' }), 'critical');
  assert.equal(runtime.simulate(created.twinId, 'battery-drop', { batteryStatus: 40 }).approvalRequired, true);
  assert.equal(runtime.auditTrail(created.twinId).length, 2);

  const api = runtime.apiDefinition();
  assert.equal(api.basePath, '/api/v1/twins');
  assert.ok(api.endpoints.some((endpoint) => endpoint.path.includes('relationships')));
});
