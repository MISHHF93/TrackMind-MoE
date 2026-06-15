import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, RaceOperationsPlatform, raceOperationsControlMatrix } from '../dist/index.js';

const human = (id, roles) => ({ id, roles, human: true });
function approveToken(service, action, target, approvers, now = '2026-06-13T17:45:00Z', racetrackId = 'trk-1') {
  const request = service.createRequest({ id: `approval-${action}-${target}`, tenantId: 'tenant-1', racetrackId, action, target, requestedBy: 'test-human', actorType: 'human', reason: `approve ${action}`, evidence: ['human-approval-record'], now });
  approvers.forEach(([id, roles], index) => service.decide(request.id, human(id, roles), 'approved', `approve step ${index + 1}`, ['human-approval-record'], `2026-06-13T17:${46 + index}:00Z`));
  return service.authorizeExecution({ requestId: request.id, action, target, tenantId: 'tenant-1', racetrackId, actor: human('executor', ['admin']), now: '2026-06-13T17:55:00Z' });
}


test('race operations platform coordinates race lifecycle, readiness, execution, and reporting', () => {
  const approvals = new CentralizedApprovalService();
  const platform = new RaceOperationsPlatform(approvals, 'tenant-1');
  platform.scheduleRace({ id: 'race-1', trackId: 'trk-1', raceDate: '2026-06-13', raceNumber: 1, scheduledPostTime: '2026-06-13T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 90000, eligibility: ['three-year-olds-and-up'] } });
  platform.addEntry('race-1', { id: 'entry-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' });
  platform.addEntry('race-1', { id: 'entry-2', horseId: 'horse-2', trainerId: 'trainer-2', ownerId: 'owner-2' });
  platform.declareEntry('race-1', 'entry-1', 'jockey-1', 124);
  platform.declareEntry('race-1', 'entry-2', 'jockey-2', 122);
  assert.throws(() => platform.scratchEntry('race-1', 'entry-2', 'veterinary', 'state-vet'), /requireScratchEntryWithApproval|require scratchEntryWithApproval|requires? scratchEntryWithApproval/);
  const scratchToken = approveToken(approvals, 'race-office-scratch', 'race-1', [['vet-1', ['veterinarian']], ['steward-1', ['steward']]]);
  platform.scratchEntryWithApproval('race-1', 'entry-2', 'veterinary', scratchToken, 'state-vet', '2026-06-13T17:56:00Z');
  platform.drawPostPositions('race-1');
  const gated = platform.assignGates('race-1');
  assert.equal(gated.entries.find((entry) => entry.id === 'entry-1').gate, 'G-1');

  platform.coordinateStaffing('race-1', { stewards: ['steward-1'], veterinarians: ['vet-1'], gateCrew: ['gate-1'], outriders: ['out-1'], trackMaintenance: ['maint-1'], security: ['sec-1'] });
  platform.allocateResources('race-1', [{ id: 'gate-main', type: 'starting-gate', zone: 'chute', status: 'allocated' }]);
  platform.approveWorkflow('race-1', 'racingOffice', 'approved');
  platform.approveWorkflow('race-1', 'stewards', 'approved');
  platform.approveWorkflow('race-1', 'veterinarian', 'approved');
  const telemetry = [{ streamId: 'gate-status', type: 'gate', observedAt: '2026-06-13T17:55:00Z', healthy: true, value: 'closed' }];
  assert.equal(platform.assessReadiness('race-1', telemetry).ready, true);
  assert.equal(platform.aiRecommendations('race-1', telemetry).recommendations[0], 'proceed-to-post-parade');
  assert.throws(() => platform.monitorExecution('race-1', { timestamp: '2026-06-13T18:00:00Z', type: 'off', message: 'clean start' }), /controlled-action methods/);
  platform.startRace('race-1', approveToken(approvals, 'race-start', 'race-1', [['secretary-1', ['racing-secretary']], ['steward-1', ['steward']], ['vet-1', ['veterinarian']]], '2026-06-13T17:50:00Z'), '2026-06-13T18:00:00Z');
  platform.publishOfficialResults('race-1', approveToken(approvals, 'official-results', 'race-1', [['steward-1', ['steward']], ['finance-1', ['finance']]], '2026-06-13T17:55:00Z'), '2026-06-13T18:02:00Z');
  const report = platform.operationalReport('race-1');
  assert.equal(report.status, 'official');
  assert.equal(report.scratches, 1);
  assert.deepEqual(report.regulatoryControls, ['HISA', 'ARCI', 'state-racing-commission']);
});

test('race operations control matrix maps workflows to approvals, twins, telemetry, and AI controls', () => {
  const matrix = raceOperationsControlMatrix();
  assert.equal(matrix.length, 4);
  assert.ok(matrix[2].systems.includes('ai-recommendations'));
});

test('race operations bounded context persists APIs and connects event, audit, workflow, approval, twin, and dashboards', async () => {
  const { UniversalEventBus, ImmutableAuditLog, WorkflowOrchestrationEngine, RaceOperationsRepository } = await import('../dist/index.js');
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const workflow = new WorkflowOrchestrationEngine();
  workflow.register({ id: 'race-lifecycle', name: 'Race lifecycle', domain: 'race-day', version: '1.0.0', bpmnProcessId: 'race-lifecycle', startStepId: 'card', ownerRole: 'racing-secretary', tenantId: 'tenant-1', steps: [{ id: 'card', name: 'Build card', type: 'userTask', role: 'racing-secretary', next: ['approve'] }, { id: 'approve', name: 'Approve readiness', type: 'approvalTask', approvalRoles: ['steward'], requiredApprovals: 1 }] });
  const repository = new RaceOperationsRepository();
  const seen = [];
  eventBus.subscribe('*', (event) => seen.push(event), { name: 'race-test-spy' });
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const platform = new RaceOperationsPlatform({ approvalService: approvals, eventBus, auditLog, workflow, repository, tenantId: 'tenant-1' });

  platform.scheduleRace({ id: 'race-integrated', trackId: 'trk-1', raceDate: '2026-06-13', raceNumber: 7, scheduledPostTime: '2026-06-13T21:00:00Z', conditions: { surface: 'turf', distanceFurlongs: 8, classLevel: 'Stakes', purse: 250000, eligibility: ['fillies'], medicationRules: ['lasix-free'] } });
  const instance = platform.startWorkflow('race-integrated');
  assert.equal(instance.definitionId, 'race-lifecycle');
  platform.addEntry('race-integrated', { id: 'entry-a', horseId: 'horse-a', trainerId: 'trainer-a', ownerId: 'owner-a' });
  platform.declareEntry('race-integrated', 'entry-a', 'jockey-a', 120);
  platform.updateConditions('race-integrated', { weatherRestrictions: ['no-lightning'] });
  platform.drawPostPositions('race-integrated');
  platform.assignGates('race-integrated', 'MAIN');
  platform.coordinateStaffing('race-integrated', { stewards: ['s1'], veterinarians: ['v1'], gateCrew: ['g1'], outriders: ['o1'], trackMaintenance: ['m1'], security: ['sec1'] });
  platform.assignStaffing('race-integrated', [{ id: 'staff-1', role: 'stewards', personId: 's1', shiftStart: '2026-06-13T19:00:00Z', shiftEnd: '2026-06-14T00:00:00Z', status: 'checked-in' }]);
  platform.allocateResources('race-integrated', [{ id: 'gate-1', type: 'starting-gate', zone: 'turf-course', status: 'allocated' }, { id: 'camera-9', type: 'camera', zone: 'finish', status: 'unavailable' }]);
  for (const step of ['racingOffice', 'stewards', 'veterinarian']) platform.approveWorkflow('race-integrated', step, 'approved');

  const readiness = platform.assessReadiness('race-integrated', [{ streamId: 'weather', type: 'weather', observedAt: '2026-06-13T20:55:00Z', healthy: true, value: 'clear' }]);
  assert.equal(readiness.ready, true);
  platform.startRace('race-integrated', approveToken(approvals, 'race-start', 'race-integrated', [['secretary-1', ['racing-secretary']], ['steward-1', ['steward']], ['vet-1', ['veterinarian']]], '2026-06-13T20:50:00Z'), '2026-06-13T21:00:00Z');
  platform.monitorExecution('race-integrated', { timestamp: '2026-06-13T21:01:00Z', type: 'incident', message: 'camera offline', severity: 'warning' });

  const persisted = repository.getRace('race-integrated');
  assert.equal(persisted.workflowInstanceId, instance.id);
  assert.equal(platform.listRaces({ status: 'running' }).length, 1);
  const dashboard = platform.operationalDashboard('2026-06-13T21:02:00Z');
  assert.equal(dashboard.totals.running, 1);
  assert.equal(dashboard.resourceExceptions[0].resourceId, 'camera-9');
  assert.equal(dashboard.executionAlerts[0].severity, 'warning');
  assert.ok(auditLog.forensicTimeline({ subjectId: 'race-integrated' }).length >= 10);
  assert.ok(seen.some((event) => event.type === 'race.started'));
  assert.ok(platform.apiDefinition().endpoints.some((endpoint) => endpoint.path === '/dashboard'));
});
