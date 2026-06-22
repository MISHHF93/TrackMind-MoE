import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService } from '../dist/approvals.js';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { DigitalTwinRuntime } from '../dist/digitalTwinRuntime.js';
import { UniversalEventBus } from '../dist/eventBus.js';
import { RacetrackAssetRegistryService } from '../dist/racetrackAssetRegistryService.js';

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
  location: { racetrackId: 'trk-1', railPositionMeters: 1600 },
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
  const approvals = new CentralizedApprovalService({ eventBus, auditLog });
  const runtime = new DigitalTwinRuntime({ eventBus, auditLog, approvals });
  const registry = new RacetrackAssetRegistryService({ eventBus, auditLog });

  await registry.create(assetInput, principal);

  const [created] = runtime.queryTwins({ assetId: 'START_GATE_RUNTIME_01' });
  assert.equal(created.twinId, 'twin:START_GATE_RUNTIME_01');
  assert.equal(created.tenantId, 'trk-1');
  assert.equal(runtime.queryTwins({ tenantId: 'trk-1' }).length, 1);
  assert.equal(runtime.queryTwins({ tenantId: 'other-track' }).length, 0);
  assert.equal(created.health, 'degraded');
  assert.ok(created.healthIndicators.some((indicator) => indicator.name === 'telemetry-freshness'));
  assert.equal(created.telemetryReferences[0].sensorId, 'gate-battery-runtime-01');
  assert.equal(created.approvalRequirements[0].requiredApprovers[0], 'Starter');
  assert.equal(runtime.viewRelationships(created.twinId).some((rel) => rel.type === 'depends-on'), true);
  assert.equal(runtime.visualizationModels({ tenantId: 'trk-1' })[0].approvalRequired, true);

  await eventBus.publish({ type: 'telemetry.observed', producer: 'telemetry-stream', aggregateId: created.twinId, payload: { twinId: created.twinId, sensorId: 'gate-battery-runtime-01', metric: 'batteryStatus', value: 91, observedAt: '2026-06-13T10:05:00Z' } });
  const updated = runtime.getTwin(created.twinId);

  assert.equal(updated.state.batteryStatus, 91);
  assert.equal(updated.health, 'critical');
  assert.equal(runtime.replayHistory(created.twinId).length, 2);
  assert.equal(runtime.calculateOperationalHealth({ riskLevel: 'critical' }), 'critical');
  runtime.registerSimulationHook('gate-delay-risk', ({ scenario }) => scenario === 'battery-drop' ? { riskDelta: 7, assumptions: ['Gate delay hook applied.'], approvalRequired: true } : {});
  assert.equal(runtime.simulate(created.twinId, 'battery-drop', { batteryStatus: 40 }).approvalRequired, true);
  assert.equal(runtime.auditTrail(created.twinId).length, 2);
  assert.ok(auditLog.all().some((entry) => entry.subjectId === created.twinId && entry.tenantId === 'trk-1'));
  const healthChanged = eventBus.events({ type: 'digital-twin.health.changed', aggregateId: created.twinId }).at(-1);
  assert.ok(healthChanged);
  assert.equal(healthChanged.context.tenantId, 'trk-1');
  assert.equal(healthChanged.context.racetrackId, 'trk-1');
  assert.equal(healthChanged.context.digitalTwinRef, created.twinId);
  assert.ok(healthChanged.context.auditRefs.length >= 1);
  assert.throws(() => runtime.updateState({ twinId: created.twinId, tenantId: 'trk-1', patch: { locked: false }, actor: 'ops-user' }), /requires approval token/);
  const rejected = eventBus.events({ type: 'digital-twin.command.rejected', aggregateId: created.twinId }).at(-1);
  assert.ok(rejected);
  assert.equal(rejected.context.digitalTwinRef, created.twinId);
  assert.ok(rejected.context.auditRefs.length >= 1);

  const request = runtime.requestStateChangeApproval({ twinId: created.twinId, tenantId: 'trk-1', requestedBy: 'ops-user', actorType: 'human', reason: 'manual lock state correction', evidence: ['operator-report'] });
  approvals.decide(request.id, { id: 'super-1', roles: ['facilities-manager'], human: true }, 'approved', 'track ops approved', ['human-approval-record']);
  approvals.decide(request.id, { id: 'steward-1', roles: ['steward'], human: true }, 'approved', 'steward approved', ['human-approval-record']);
  const token = approvals.authorizeExecution({ requestId: request.id, action: 'safety-critical-control', target: created.twinId, tenantId: 'trk-1', racetrackId: 'trk-1', actor: { id: 'super-1', roles: ['facilities-manager'], human: true } });
  const commanded = runtime.updateState({ twinId: created.twinId, tenantId: 'trk-1', patch: { locked: false }, actor: 'ops-user', approvalToken: token, command: true });
  assert.equal(commanded.state.locked, false);
  assert.equal(runtime.replayHistory(created.twinId).at(-1).approvalRequestId, request.id);
  const updatedEvent = eventBus.events({ type: 'digital-twin.state.updated', aggregateId: created.twinId }).at(-1);
  assert.equal(updatedEvent.context.approvalRef, request.id);
  assert.equal(updatedEvent.context.auditRefs.length > 0, true);
  assert.equal(runtime.dependencyGraph([created.twinId], 'trk-1').nodes.some((node) => node.twinId === created.twinId), true);

  const api = runtime.apiDefinition();
  assert.equal(api.basePath, '/api/v1/twins');
  assert.ok(api.endpoints.some((endpoint) => endpoint.path.includes('relationships')));
  assert.ok(api.endpoints.some((endpoint) => endpoint.path.includes('dependency-graph')));
});
