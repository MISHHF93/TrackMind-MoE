import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowOrchestrationEngine, raceDayOperationsWorkflow, workflowPortfolio } from '../dist/index.js';

test('workflow engine orchestrates BPMN-style race-day process with Digital Twin sync and parallel approvals', () => {
  const engine = new WorkflowOrchestrationEngine();
  engine.register(raceDayOperationsWorkflow('track-1'));
  const started = engine.start('race-day-ops', { tenantId: 'track-1', priority: 'high', digitalTwinRefs: ['twin:track:oval', 'twin:gate:1'], payload: { raceId: 'race-7' } }, 'ops-lead', '2026-06-13T12:00:00.000Z');
  assert.equal(started.status, 'waiting');
  assert.equal(started.tasks[0].name, 'Pre-race safety and surface inspection');
  assert.equal(started.tasks[0].dueAt, '2026-06-13T12:30:00.000Z');

  const inspected = engine.completeTask(started.id, started.tasks[0].id, 'track-superintendent', { surface: 'safe' }, '2026-06-13T12:05:00.000Z');
  assert.equal(inspected.context.payload.twinSync.status, 'updated');
  assert.equal(inspected.digitalTwinState.status, 'pre-race-validated');
  const approvalTask = inspected.tasks.find((task) => task.stepId === 'parallel-approvals');
  assert.ok(approvalTask);
  assert.equal(approvalTask.type, 'parallelApproval');

  const stewardApproved = engine.recordApproval(inspected.id, approvalTask.id, 'chief-steward', 'steward-1', 'approved', 'Rulebook checks complete', '2026-06-13T12:06:00.000Z');
  assert.equal(stewardApproved.status, 'waiting');
  const vetApproved = engine.recordApproval(inspected.id, approvalTask.id, 'veterinarian', 'vet-1', 'approved', 'Veterinary checks complete', '2026-06-13T12:07:00.000Z');
  assert.equal(vetApproved.status, 'waiting');
  const completed = engine.recordApproval(inspected.id, approvalTask.id, 'operations-director', 'ops-director', 'approved', 'Staffing and emergency lanes ready', '2026-06-13T12:08:00.000Z');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.context.payload.raceDayDecision, 'race-ready');
  assert.ok(completed.digitalTwinRefs.includes('twin:race-day:readiness'));
  assert.ok(completed.audit.some((entry) => entry.action === 'digitalTwin.updated'));
});

test('workflow engine escalates SLA breaches and preserves auditability', () => {
  const engine = new WorkflowOrchestrationEngine();
  engine.register(raceDayOperationsWorkflow('track-1'));
  const started = engine.start('race-day-ops', { tenantId: 'track-1', priority: 'critical', digitalTwinRefs: ['twin:track:oval'], payload: {} }, 'ops-lead', '2026-06-13T12:00:00.000Z');
  const escalated = engine.evaluateEscalations(started.id, '2026-06-13T12:31:00.000Z');
  assert.equal(escalated.status, 'escalated');
  assert.equal(escalated.tasks[0].status, 'escalated');
  assert.equal(escalated.tasks[0].escalatedTo, 'operations-director');
  assert.ok(escalated.audit.some((entry) => entry.action === 'sla.breached'));
});

test('workflow runtime retries failures and exposes recovery state', () => {
  const engine = new WorkflowOrchestrationEngine();
  engine.register({
    id: 'maintenance-retry', name: 'Maintenance Retry', domain: 'maintenance', version: '1.0.0', bpmnProcessId: 'Process_MaintenanceRetry', startStepId: 'repair', ownerRole: 'maintenance-manager', tenantId: 'track-1',
    steps: [
      { id: 'repair', name: 'Repair controllable asset', type: 'userTask', role: 'maintenance-lead', retryPolicy: { maxAttempts: 2, backoffMinutes: 2, retryableErrors: ['parts-delay'] }, recoveryStepId: 'manual-recovery', next: ['closed'] },
      { id: 'manual-recovery', name: 'Manual recovery plan', type: 'userTask', role: 'maintenance-manager', next: ['closed'] },
      { id: 'closed', name: 'Closed', type: 'endEvent' },
    ],
  });
  const started = engine.start('maintenance-retry', { tenantId: 'track-1', priority: 'critical', digitalTwinRefs: ['twin:gate:1'], payload: {} }, 'maintenance-dispatcher', '2026-06-13T12:00:00.000Z');
  const failed = engine.failTask(started.id, started.tasks[0].id, 'parts-delay', 'maintenance-lead', '2026-06-13T12:02:00.000Z');
  assert.equal(failed.status, 'recovering');
  assert.equal(failed.tasks[0].status, 'retrying');
  assert.equal(failed.tasks[0].retryAt, '2026-06-13T12:04:00.000Z');

  const ready = engine.retryReadyTasks(started.id, '2026-06-13T12:04:00.000Z');
  assert.equal(ready.status, 'waiting');
  assert.equal(ready.tasks[0].status, 'open');
});

test('visual workflow graph exposes renderable nodes, edges, dependencies, and critical path', () => {
  const engine = new WorkflowOrchestrationEngine();
  engine.register(raceDayOperationsWorkflow('track-1'));
  const started = engine.start('race-day-ops', { tenantId: 'track-1', priority: 'normal', digitalTwinRefs: ['twin:track:oval'], payload: {} }, 'ops-lead', '2026-06-13T12:00:00.000Z');
  const graph = engine.visualGraph(started.id);
  assert.equal(graph.instanceId, started.id);
  assert.ok(graph.nodes.some((node) => node.id === 'pre-race-inspection' && node.status === 'open'));
  assert.ok(graph.edges.some((edge) => edge.source === 'pre-race-inspection' && edge.target === 'sync-digital-twin'));
  assert.deepEqual(graph.dependencies.find((dependency) => dependency.stepId === 'parallel-approvals').dependsOn, ['pre-race-inspection', 'sync-digital-twin']);
  assert.deepEqual(graph.criticalPath.slice(0, 3), ['pre-race-inspection', 'sync-digital-twin', 'parallel-approvals']);
});

test('workflow portfolio covers race-day, maintenance, stewarding, veterinary, inspections, security, compliance, staffing, emergency, and AI review domains', () => {
  const portfolio = workflowPortfolio('track-1');
  assert.deepEqual(portfolio.map((definition) => definition.domain), ['race-day', 'maintenance', 'stewarding', 'veterinary', 'inspection', 'security', 'compliance', 'staffing', 'emergency', 'ai-review']);
  assert.ok(portfolio.every((definition) => definition.bpmnProcessId.startsWith('Process_')));
  assert.ok(portfolio.every((definition) => definition.steps.some((step) => step.digitalTwin || step.type === 'endEvent')));
});
