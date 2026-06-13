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
  assert.deepEqual(completed.digitalTwinRefs, ['twin:track:oval', 'twin:gate:1']);
  assert.ok(completed.audit.some((entry) => entry.action === 'service.executed'));
});

test('workflow engine escalates SLA breaches and preserves auditability', () => {
  const engine = new WorkflowOrchestrationEngine();
  engine.register(raceDayOperationsWorkflow('track-1'));
  const started = engine.start('race-day-ops', { tenantId: 'track-1', priority: 'critical', digitalTwinRefs: ['twin:track:oval'], payload: {} }, 'ops-lead', '2026-06-13T12:00:00.000Z');
  const escalated = engine.evaluateEscalations(started.id, '2026-06-13T12:31:00.000Z');
  assert.equal(escalated.status, 'escalated');
  assert.equal(escalated.tasks[0].status, 'escalated');
  assert.equal(escalated.tasks[0].escalatedTo, 'operations-director');
  assert.ok(escalated.audit.some((entry) => entry.action === 'task.escalated'));
});

test('workflow portfolio covers operations, AI review, and emergency procedure domains', () => {
  const portfolio = workflowPortfolio('track-1');
  assert.deepEqual(portfolio.map((definition) => definition.domain), ['race-day', 'ai-review', 'emergency']);
  assert.ok(portfolio.every((definition) => definition.bpmnProcessId.startsWith('Process_')));
});
