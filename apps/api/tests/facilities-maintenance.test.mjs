import test from 'node:test';
import assert from 'node:assert/strict';
import { FacilitiesMaintenanceService, createMockFacilitiesMaintenanceWorkspace, createSeededFacilitiesMaintenanceService } from '../dist/index.js';
import { registerFacilitiesKpiPack } from '@trackmind/shared';

const principal = { id: 'facilities-supervisor', tenantId: 'track-1', scopes: ['assets:read', 'assets:write', 'assets:approve'] };

test('facilities maintenance uses RACR assets, twins, approvals, workflows, audit, and events', async () => {
  const service = new FacilitiesMaintenanceService();
  const seeded = await service.seedFacilityAssets(principal, '2026-06-13T12:00:00.000Z');

  assert.ok(seeded.length >= 3);
  assert.ok(seeded.every((asset) => asset.domain === 'facilities'));
  assert.ok(seeded.every((asset) => asset.digitalTwin?.twinId));
  assert.equal(service.twins.queryTwins({ tenantId: 'track-1', domain: 'facilities' }).length, seeded.length);

  const inspection = await service.recordInspection({
    assetId: 'GRANDSTAND_HVAC_01',
    inspectedBy: 'facilities-supervisor',
    checklist: ['filter pressure', 'airflow', 'motor temperature'],
    findings: ['filter pressure reviewed'],
    score: 88,
    nextInspectionDueAt: '2026-06-15T12:00:00.000Z',
  }, principal);
  assert.equal(inspection.status, 'passed');
  assert.ok(service.approvals.allRequests().some((approval) => approval.action === 'safety-critical-control' && approval.target === 'GRANDSTAND_HVAC_01'));

  const plan = service.createPreventiveMaintenancePlan({
    assetId: 'GRANDSTAND_HVAC_01',
    cadenceDays: 7,
    checklist: ['replace filters', 'verify airflow'],
    nextDueAt: '2026-06-15T12:00:00.000Z',
  }, principal);
  assert.equal(plan.approvalRequiredForExecution, true);

  const order = service.createWorkOrder({
    assetId: 'GRANDSTAND_HVAC_01',
    title: 'Replace grandstand HVAC filters',
    priority: 'high',
    requestedBy: 'facilities-supervisor',
    dueAt: '2026-06-14T20:00:00.000Z',
    tasks: ['lockout unit', 'replace filters', 'verify airflow'],
    evidence: ['inspection-hvac-1'],
    operationalImpact: 'operational-impact',
  }, principal);
  assert.equal(order.status, 'approval-required');
  assert.ok(order.approvalRequestId);
  assert.ok(order.workflowInstanceId);
  assert.equal(service.approvals.getRequest(order.approvalRequestId).workflowInstanceId, order.workflowInstanceId);

  await assert.rejects(() => service.completeWorkOrder({ workOrderId: order.id, completedBy: 'facilities-supervisor', evidence: ['repair-photo'] }, principal), /requires approval token/);

  service.approvals.decide(order.approvalRequestId, { id: 'facilities-lead', roles: ['facilities-manager'], human: true }, 'approved', 'Approve facility work order execution', ['human-approval-record']);
  service.approvals.decide(order.approvalRequestId, { id: 'ops-command', roles: ['platform-super-admin'], human: true }, 'approved', 'Approve operational impact window', ['human-approval-record']);
  const facilityToken = service.approvals.authorizeExecution({ requestId: order.approvalRequestId, action: 'facility-maintenance-execution', target: 'GRANDSTAND_HVAC_01', tenantId: 'track-1', racetrackId: 'track-1', actor: { id: 'ops-command', roles: ['platform-super-admin'], human: true } });
  const assetSafetyRequest = await service.assetRegistry.requestSafetyCriticalChange('GRANDSTAND_HVAC_01', { actorType: 'human', reason: 'Approve return to service after completed facility work order', evidence: ['human-approval-record', 'repair-photo'] }, principal);
  service.assetRegistry.approvalService.decide(assetSafetyRequest.id, { id: 'track-superintendent', roles: ['facilities-manager'], human: true }, 'approved', 'Approve asset return-to-service update', ['human-approval-record']);
  service.assetRegistry.approvalService.decide(assetSafetyRequest.id, { id: 'steward-1', roles: ['steward'], human: true }, 'approved', 'Approve safety-critical asset maintenance update', ['human-approval-record']);
  const assetToken = service.assetRegistry.approvalService.authorizeExecution({ requestId: assetSafetyRequest.id, action: 'safety-critical-control', target: 'GRANDSTAND_HVAC_01', tenantId: 'track-1', racetrackId: 'track-1', actor: { id: 'steward-1', roles: ['steward'], human: true } });
  const completed = await service.completeWorkOrder({ workOrderId: order.id, completedBy: 'facilities-supervisor', evidence: ['repair-photo'], approvalToken: facilityToken, assetApprovalToken: assetToken }, principal);
  assert.equal(completed.status, 'completed');
  assert.equal(service.assetRegistry.get('GRANDSTAND_HVAC_01', principal).maintenance.status, 'ok');

  const workspace = service.workspace(principal);
  assert.equal(workspace.operationalActionsRequireApproval, true);
  assert.equal(workspace.integrations.assetRegistry, true);
  assert.equal(workspace.integrations.digitalTwinRuntime, true);
  assert.equal(workspace.integrations.approvals, true);
  assert.equal(workspace.integrations.workflows, true);
  assert.ok(workspace.assets.some((asset) => asset.assetId === 'GRANDSTAND_HVAC_01' && asset.sourceOfTruth === 'racetrack-asset-registry'));
  assert.ok(workspace.predictiveHooks.some((hook) => hook.assetId === 'GRANDSTAND_HVAC_01'));
  assert.ok(workspace.approvals.some((approval) => approval.action === 'facility-maintenance-execution'));
  assert.ok(workspace.events.some((event) => event.type === 'facilities.work-order.requested'));
  assert.ok(workspace.events.some((event) => event.type === 'facilities.work-order.completed'));
  assert.equal(service.auditLog.verify().valid, true);
});

test('facilities maintenance schedule POST is approval-gated with audit hooks', async () => {
  const service = new FacilitiesMaintenanceService();
  await service.seedFacilityAssets(principal, '2026-06-13T12:00:00.000Z');

  const pending = service.scheduleMaintenance({
    assetId: 'BACKUP_GENERATOR_A',
    title: 'Generator load test window',
    priority: 'high',
    scheduledFor: '2026-06-14T18:00:00.000Z',
    dueAt: '2026-06-14T20:00:00.000Z',
    tasks: ['isolate transfer switch', 'run load test', 'capture evidence'],
    evidence: ['load-test-plan'],
    operationalImpact: 'operational-impact',
    requestedBy: 'facilities-supervisor',
  }, principal);
  assert.equal(pending.approvalRequired, true);
  assert.ok(pending.approvalRequestId);
  assert.ok(pending.auditId);

  const approvalId = pending.approvalRequestId;
  assert.ok(approvalId);
  service.approvals.decide(approvalId, { id: 'facilities-lead', roles: ['facilities-manager'], human: true }, 'approved', 'Approve generator maintenance window', ['human-approval-record']);
  service.approvals.decide(approvalId, { id: 'ops-command', roles: ['platform-super-admin'], human: true }, 'approved', 'Approve operational impact', ['human-approval-record']);
  const token = service.approvals.authorizeExecution({
    requestId: approvalId,
    action: 'facility-maintenance-execution',
    target: 'BACKUP_GENERATOR_A',
    tenantId: 'track-1',
    racetrackId: 'track-1',
    actor: { id: 'ops-command', roles: ['platform-super-admin'], human: true },
  });

  const scheduled = service.scheduleMaintenance({
    assetId: 'BACKUP_GENERATOR_A',
    title: 'Generator load test window',
    priority: 'high',
    scheduledFor: '2026-06-14T18:00:00.000Z',
    dueAt: '2026-06-14T20:00:00.000Z',
    tasks: ['isolate transfer switch', 'run load test', 'capture evidence'],
    evidence: ['load-test-plan', 'human-approval-record'],
    operationalImpact: 'operational-impact',
    requestedBy: 'facilities-supervisor',
  }, principal, { approvalToken: token });
  assert.equal(scheduled.approvalRequired, false);
  assert.equal(scheduled.workOrder.status, 'scheduled');
  assert.ok(service.eventBus.events().some((event) => event.type === 'facilities.maintenance-schedule.approved'));
});

test('facilities workspace exposes inventory, utilities adapters, incidents, map, and KPI pack', async () => {
  const service = createSeededFacilitiesMaintenanceService('2026-06-13T12:00:00.000Z');
  const workspace = service.workspace(principal);
  assert.ok(workspace.inventory.length >= 3);
  assert.ok(workspace.utilities.adapters.length >= 2);
  assert.ok(workspace.incidents.length >= 1);
  assert.ok(workspace.map.features.length >= 1);
  assert.equal(workspace.kpiPackId, 'facilities-kpi-pack-v1');
  assert.equal(workspace.integrations.utilitiesAdapters, true);
  assert.equal(workspace.integrations.geospatialMap, true);
});

test('facilities mock workspace labels asset health, inspections, work orders, and approval gates', () => {
  const workspace = createMockFacilitiesMaintenanceWorkspace('2026-06-13T12:00:00.000Z');

  assert.equal(workspace.mock, true);
  assert.equal(workspace.operationalActionsRequireApproval, true);
  assert.ok(workspace.assets.every((asset) => asset.sourceOfTruth === 'racetrack-asset-registry' && asset.twinId));
  assert.ok(workspace.assets.some((asset) => asset.healthScore < 85 && asset.readinessStatus === 'watch'));
  assert.ok(workspace.inspections.some((inspection) => inspection.auditId && inspection.eventId));
  assert.ok(workspace.workOrders.every((order) => order.operationalImpact === 'read-only' || (order.approvalRequestId && order.workflowInstanceId)));
  assert.ok(workspace.predictiveHooks.every((hook) => hook.failureProbability >= 0 && hook.failureProbability <= 1));
  assert.ok(workspace.approvals.some((approval) => approval.action === 'facility-maintenance-execution' && approval.status === 'pending'));
  assert.equal(workspace.integrations.approvals, true);
  assert.equal(workspace.integrations.workflows, true);
  assert.equal(workspace.integrations.digitalTwinRuntime, true);
});

test('facilities KPI pack registers readiness, backlog, utilities, inventory, and incident KPIs', () => {
  const pack = registerFacilitiesKpiPack({ generatedAt: '2026-06-13T12:00:00.000Z' });
  assert.equal(pack.length, 5);
  assert.ok(pack.some((kpi) => kpi.kpiId === 'kpi-facilities-readiness'));
  assert.ok(pack.some((kpi) => kpi.kpiId === 'kpi-facilities-maintenance-backlog'));
  assert.ok(pack.every((kpi) => kpi.domain === 'facilities'));
});
