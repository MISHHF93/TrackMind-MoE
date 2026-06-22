import assert from 'node:assert/strict';
import test from 'node:test';
import { EnterpriseApiGateway, EnterpriseServiceRegistry } from '../dist/enterpriseApiGateway.js';
import { RacetrackAssetRegistryService, racetrackAssetRegistryApiDefinition } from '../dist/racetrackAssetRegistryService.js';

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
  assert.equal(created.tenantId, 'track-a');
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
  assert.equal(emitted[0].context.tenantId, 'track-a');
  assert.equal(emitted[0].context.racetrackId, 'track-a');
  assert.equal(emitted[0].context.auditRefs.length > 0, true);
  assert.equal(emitted[0].context.digitalTwinRef, 'dtmi:trackmind:gate;2');
  assert.equal(emitted[0].context.subject.id, 'START_GATE_02');
  assert.equal(service.auditLog.verify().valid, true);
  assert.equal(service.query({ lifecycleStatus: 'archived', riskLevel: 'high', maintenanceStatus: 'due', ownerAgent: 'RaceOps' }, principal).total, 1);
});

test('racetrack asset registry keeps tenant reads and query caches isolated', async () => {
  const service = new RacetrackAssetRegistryService();
  const tenantB = { id: 'ops-user-2', tenantId: 'track-b', scopes: ['assets:read', 'assets:write', 'assets:approve'] };

  await service.create(baseAsset, principal);
  await service.create({ ...baseAsset, assetId: 'START_GATE_22', externalIds: ['erp:gate:22'], name: 'Starting Gate 22', digitalTwin: { twinId: 'dtmi:trackmind:gate;22', relationship: 'represents' } }, tenantB);

  const trackAQuery = service.query({}, principal);
  const trackBQuery = service.query({}, tenantB);
  const trackBRepeat = service.query({}, tenantB);

  assert.equal(trackAQuery.total, 1);
  assert.equal(trackAQuery.assets[0].tenantId, 'track-a');
  assert.equal(trackBQuery.total, 1);
  assert.equal(trackBQuery.assets[0].tenantId, 'track-b');
  assert.equal(trackBRepeat.cache, 'hit');
  assert.throws(() => service.get('START_GATE_02', tenantB), /tenant isolation violation/);
  assert.throws(() => service.query({ tenantId: 'track-a' }, tenantB), /tenant isolation violation/);
});

test('racetrack asset registry enforces unique identifiers and gateway auth scopes', async () => {
  const service = new RacetrackAssetRegistryService();
  await service.create(baseAsset, principal);
  await assert.rejects(() => service.create({ ...baseAsset, assetId: 'START_GATE_03' }, principal), /external id must be unique/);
  assert.throws(() => service.get('START_GATE_02', { id: 'viewer', scopes: [] }), /missing scope/);

  const registry = new EnterpriseServiceRegistry();
  const apiDefinition = racetrackAssetRegistryApiDefinition();
  registry.register(apiDefinition);
  const gateway = new EnterpriseApiGateway(registry);
  assert.equal(gateway.route({ serviceId: 'racetrack-asset-registry', path: '/', method: 'GET', principal: { id: 'viewer', scopes: ['assets:read'] }, nowEpochMs: 1 }).allowed, true);
  assert.equal(gateway.route({ serviceId: 'racetrack-asset-registry', path: '/', method: 'POST', principal: { id: 'viewer', scopes: ['assets:read'] }, nowEpochMs: 2 }).status, 403);
  assert.ok(apiDefinition.endpoints.some((endpoint) => endpoint.path === '/{assetId}/approval-requests'));
  assert.ok(apiDefinition.endpoints.some((endpoint) => endpoint.path === '/{assetId}/telemetry-bindings'));
});

test('racetrack asset registry covers physical, digital, biological, operational, regulatory, and ai assets with search facets', async () => {
  const service = new RacetrackAssetRegistryService();
  const assets = [
    baseAsset,
    { ...baseAsset, assetId: 'CAMERA_PADDOCK_01', externalIds: ['camera:paddock:1'], name: 'Paddock Camera 01', assetType: 'Camera', domain: 'security', riskLevel: 'medium', approvalPolicyId: 'standard-asset-approval', digitalTwin: { twinId: 'twin:camera:paddock-01', relationship: 'observes' }, tags: ['camera', 'paddock'] },
    { ...baseAsset, assetId: 'HORSE_SEA_STAR', externalIds: ['horse:sea-star'], name: 'Sea Star', assetType: 'Horse', domain: 'racing', riskLevel: 'medium', approvalPolicyId: 'standard-asset-approval', digitalTwin: { twinId: 'twin:horse:sea-star', relationship: 'represents' }, tags: ['horse', 'biological'] },
    { ...baseAsset, assetId: 'RACE_EVENT_07', externalIds: ['race:event:7'], name: 'Race Event 07', assetType: 'RaceEvent', domain: 'racing', riskLevel: 'high', digitalTwin: { twinId: 'twin:race:event-07', relationship: 'represents' }, tags: ['race', 'operation'] },
    { ...baseAsset, assetId: 'HISA_RECORD_001', externalIds: ['reg:hisa:001'], name: 'HISA Record 001', assetType: 'RegulatoryRecord', domain: 'regulatory', riskLevel: 'high', digitalTwin: { twinId: 'twin:reg:hisa-001', relationship: 'represents' }, tags: ['hisa', 'regulatory'], regulations: [{ authority: 'HISA', reference: 'HISA asset evidence', appliesTo: ['eligibility'] }] },
    { ...baseAsset, assetId: 'AI_AGENT_SURFACE_01', externalIds: ['ai:surface:1'], name: 'Surface AI Agent', assetType: 'AIAgent', domain: 'surface', riskLevel: 'medium', approvalPolicyId: 'standard-asset-approval', digitalTwin: { twinId: 'twin:ai:surface-01', relationship: 'observes' }, tags: ['ai', 'surface'] },
  ];

  for (const asset of assets) await service.create(asset, principal);

  assert.equal(service.query({ assetClass: 'physical' }, principal).total, 1);
  assert.equal(service.query({ assetClass: 'digital' }, principal).total, 1);
  assert.equal(service.query({ assetClass: 'biological' }, principal).total, 1);
  assert.equal(service.query({ assetClass: 'operational' }, principal).total, 1);
  assert.equal(service.query({ assetClass: 'regulatory', complianceFramework: 'HISA' }, principal).total, 1);
  assert.equal(service.query({ assetClass: 'ai-agent', q: 'surface' }, principal).total, 1);

  const camera = service.get('CAMERA_PADDOCK_01', principal);
  assert.equal(camera.telemetryBindings.length, 0);
  assert.equal(camera.complianceMappings[0].framework, 'StateRacingCommission');
  assert.equal(camera.lifecycleHistory[0].status, 'draft');
  assert.equal(camera.riskAssessments[0].approvalRequired, false);
});

test('racetrack asset registry approval-gates safety-critical lifecycle telemetry maintenance and risk changes', async () => {
  const service = new RacetrackAssetRegistryService();
  const safetyAsset = await service.create({
    ...baseAsset,
    assetId: 'EMERGENCY_ALERT_02',
    externalIds: ['safety:alert:2'],
    name: 'Emergency Alert 02',
    assetType: 'EmergencyAlertSystem',
    domain: 'safety',
    riskLevel: 'critical',
    controls: [{ name: 'activate-alert', category: 'C_HUMAN_CONTROLLED', description: 'Human incident commanders activate emergency alerts.', requiresApprovalFrom: ['IncidentCommander'], protectedAction: 'emergency-action', executionMode: 'human-only' }],
    sensors: [{ id: 'alert-delivery-02', type: 'delivery-receipt', verifies: ['deliveryStatus'], required: true }],
    approvalPolicyId: 'critical-asset-dual-control',
    digitalTwin: { twinId: 'twin:emergency-alert-02', relationship: 'controls' },
    tags: ['safety', 'emergency'],
  }, principal);

  assert.equal(safetyAsset.assetClass, 'physical');
  assert.equal(safetyAsset.safetyCritical, true);
  assert.equal(service.query({ safetyCritical: true, sensorId: 'alert-delivery-02' }, principal).total, 1);
  await assert.rejects(() => service.activate(safetyAsset.assetId, principal), /requires approval token/);

  const request = await service.requestSafetyCriticalChange(safetyAsset.assetId, { actorType: 'ai-agent', reason: 'AI recommends activation after readiness checks', evidence: ['readiness-report'] }, principal);
  service.approvalService.decide(request.id, { id: 'track-super-1', roles: ['facilities-manager'], human: true }, 'approved', 'Operations approves asset change', ['human-approval-record']);
  service.approvalService.decide(request.id, { id: 'steward-1', roles: ['steward'], human: true }, 'approved', 'Stewards approve safety-critical change', ['human-approval-record']);
  const token = service.approvalService.authorizeExecution({ requestId: request.id, action: 'safety-critical-control', target: safetyAsset.assetId, tenantId: 'track-a', racetrackId: 'track-a', actor: { id: 'steward-1', roles: ['steward'], human: true } });

  await assert.rejects(() => service.activate(safetyAsset.assetId, principal, { approvalToken: token, actorType: 'ai-agent' }), /AI agents cannot execute/);
  const active = await service.activate(safetyAsset.assetId, principal, { approvalToken: token, reason: 'approved activation' });
  assert.equal(active.lifecycleStatus, 'active');
  assert.equal(active.lifecycleHistory.at(-1).approvalRequestId, request.id);

  await service.bindTelemetry(safetyAsset.assetId, { bindingId: 'bind-alert-heartbeat', sourceId: 'alert-heartbeat', sensorId: 'alert-delivery-02', stream: 'safety.alert.heartbeat', schemaRef: 'telemetry.alert.v1', required: true, metric: 'deliveryStatus' }, principal, { approvalToken: token });
  await service.recordMaintenance(safetyAsset.assetId, { recordId: 'maint-alert-1', performedAt: '2026-06-13T13:00:00Z', performedBy: 'safety-tech-1', status: 'ok', summary: 'Emergency alert delivery test passed', evidence: ['work-order-123'], workOrderId: 'WO-123' }, principal, { approvalToken: token });
  await service.updateRiskClassification(safetyAsset.assetId, { level: 'critical', rationale: 'Emergency alert system controls safety messaging', safetyCritical: true, approvalRequired: true, evidence: ['risk-review'] }, principal, { approvalToken: token });

  const current = service.get(safetyAsset.assetId, principal);
  assert.equal(current.telemetryBindings.some((binding) => binding.bindingId === 'bind-alert-heartbeat'), true);
  assert.equal(current.maintenanceHistory.length, 1);
  assert.equal(current.riskAssessments.at(-1).rationale, 'Emergency alert system controls safety messaging');
  assert.ok(service.eventBus.events({ type: 'racetrack.asset.approval-requested' }).length >= 1);
  assert.ok(service.eventBus.events({ type: 'racetrack.asset.telemetry-bound' }).length >= 1);
  const telemetryEvent = service.eventBus.events({ type: 'racetrack.asset.telemetry-bound' }).at(-1);
  assert.equal(telemetryEvent.context.approvalRef, request.id);
  assert.equal(telemetryEvent.context.digitalTwinRef, 'twin:emergency-alert-02');
  assert.ok(telemetryEvent.context.auditRefs.length >= 1);
  assert.equal(service.auditLog.verify().valid, true);
});

