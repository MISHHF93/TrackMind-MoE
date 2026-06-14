import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService } from '../dist/approvals.js';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { UniversalEventBus } from '../dist/eventBus.js';
import { WorkflowOrchestrationEngine, canonicalWorkflowTemplates, inspectionWorkflow, raceDayOperationsWorkflow, workflowPortfolio, workflowTemplateRegistry } from '../dist/workflowEngine.js';

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

test('workflow engine claims, executes, tracks SLA, and exposes running instances', () => {
  const engine = new WorkflowOrchestrationEngine();
  engine.register({
    id: 'inspection-execute', name: 'Inspection Execute', domain: 'inspection', version: '1.0.0', bpmnProcessId: 'Process_InspectionExecute', startStepId: 'inspect', ownerRole: 'inspection-manager', tenantId: 'track-1',
    steps: [
      { id: 'inspect', name: 'Inspect gate', type: 'inspectionTask', role: 'inspector', sla: { minutes: 30, escalationRole: 'inspection-manager', severity: 'warning' }, action: (context) => ({ executionSummary: `checked:${context.payload.assetId}` }), digitalTwin: { refs: ['twin:gate:1'], syncMode: 'read-write', statePatch: { inspection: 'active' } }, next: ['closed'] },
      { id: 'closed', name: 'Closed', type: 'endEvent' },
    ],
  });
  const started = engine.start('inspection-execute', { tenantId: 'track-1', priority: 'normal', digitalTwinRefs: ['twin:gate:1'], payload: { assetId: 'gate-1' } }, 'coordinator', '2026-06-13T12:00:00.000Z');
  const claimed = engine.claimTask(started.id, started.tasks[0].id, 'inspector-1', '2026-06-13T12:05:00.000Z');
  assert.equal(claimed.tasks[0].status, 'claimed');
  assert.equal(claimed.tasks[0].claimedBy, 'inspector-1');
  const sla = engine.slaSnapshot(started.id, '2026-06-13T12:10:00.000Z')[0];
  assert.equal(sla.minutesRemaining, 20);
  assert.equal(sla.breached, false);

  const completed = engine.executeTask(started.id, started.tasks[0].id, 'inspector-1', { checklist: 'ok' }, '2026-06-13T12:15:00.000Z');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.context.payload.executionSummary, 'checked:gate-1');
  assert.equal(engine.instances('track-1')[0].id, started.id);
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

test('workflow engine integrates approval service, immutable audit, event bus, digital twin patches, and observability', () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const signals = [];
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const engine = new WorkflowOrchestrationEngine({ approvalService: approvals, auditLog, eventBus, observability: (signal) => signals.push(signal) });
  engine.register(raceDayOperationsWorkflow('track-1'));

  const started = engine.start('race-day-ops', { tenantId: 'track-1', priority: 'critical', digitalTwinRefs: ['twin:track:oval'], payload: { raceId: 'race-integrated', evidenceIds: ['ev-surface'] } }, 'ops-lead', '2026-06-13T12:00:00.000Z');
  const advanced = engine.completeTask(started.id, started.tasks[0].id, 'track-superintendent', { surface: 'safe' }, '2026-06-13T12:05:00.000Z');
  const approvalTask = advanced.tasks.find((task) => task.stepId === 'parallel-approvals');

  assert.ok(approvalTask.approvalRequestId);
  const request = approvals.getRequest(approvalTask.approvalRequestId);
  assert.equal(request.action, 'race-start');
  assert.equal(request.target, 'race-integrated');
  assert.equal(request.workflowInstanceId, started.id);
  assert.ok(eventBus.events({ type: 'workflow.started' }).length >= 1);
  assert.ok(eventBus.events({ type: 'approval.requested' }).length >= 1);
  assert.ok(eventBus.events({ type: 'digital-twin.state.patch' }).some((event) => event.payload.twinId === 'twin:operations:command'));
  assert.ok(auditLog.all().some((entry) => entry.type === 'workflow-action' && entry.workflowId === started.id));
  assert.ok(auditLog.all().some((entry) => entry.type === 'approval' && entry.payload.approvalRequestId === request.id));
  assert.equal(auditLog.verify().valid, true);
  assert.ok(signals.some((signal) => signal.name === 'approval.requested' && signal.attributes.instanceId === started.id));
});

test('workflow portfolio covers canonical Tier 4 workflows plus operational domains', () => {
  const portfolio = workflowPortfolio('track-1');
  for (const id of ['tmwf.gate-move.v1','tmwf.horse-entry.v1','tmwf.scratch.v1','tmwf.inspection.v1','tmwf.incident.v1','tmwf.race-readiness.v1','tmwf.emergency.v1']) {
    assert.ok(portfolio.some((definition) => definition.id === id), `${id} missing`);
  }
  for (const domain of ['race-day', 'maintenance', 'stewarding', 'investigation', 'veterinary', 'inspection', 'security', 'compliance', 'staffing', 'emergency', 'ai-review']) {
    assert.ok(portfolio.some((definition) => definition.domain === domain), `${domain} domain missing`);
  }
  assert.ok(portfolio.every((definition) => definition.bpmnProcessId.startsWith('Process_')));
  assert.ok(portfolio.every((definition) => definition.steps.some((step) => step.digitalTwin || step.type === 'endEvent')));
  assert.ok(portfolio.some((definition) => definition.id === 'race-start-approval-workflow' && definition.steps.some((step) => step.approval?.action === 'race-start')));
  const stewardInvestigation = portfolio.find((definition) => definition.id === 'steward-investigation');
  assert.ok(stewardInvestigation.steps.some((step) => step.id === 'organize-evidence' && step.type === 'serviceTask' && step.action({ tenantId:'track-1', priority:'high', digitalTwinRefs:[], payload:{ inquiryId:'inq-1' } }).stewardEvidenceOrganization.officialRuling === false));
  assert.ok(stewardInvestigation.steps.some((step) => step.id === 'ruling-approval' && step.approval?.action === 'steward-decision'));
});

test('canonical Tier 4 workflow registry carries approval, audit, event, twin, SLA, role, and certification metadata', () => {
  const registry = workflowTemplateRegistry('track-1', '2026-06-14T12:00:00.000Z');
  assert.equal(registry.certificationTier, 'Tier 4');
  assert.deepEqual(registry.templates.map((template) => template.canonicalId), ['tmwf.gate-move.v1','tmwf.horse-entry.v1','tmwf.scratch.v1','tmwf.inspection.v1','tmwf.incident.v1','tmwf.race-readiness.v1','tmwf.emergency.v1']);
  for (const template of registry.templates) {
    assert.equal(template.certifiedRacetrackRequired, true);
    assert.equal(template.apiFacadePath, '/api/v1/workflows/templates');
    assert.ok(template.requiredRoles.length > 0, `${template.canonicalId} missing roles`);
    assert.ok(template.approvalPoints.length > 0, `${template.canonicalId} missing approval metadata`);
    assert.ok(template.auditRequirements.length > 0, `${template.canonicalId} missing audit metadata`);
    assert.ok(template.eventRequirements.length > 0, `${template.canonicalId} missing event metadata`);
    assert.ok(template.digitalTwinSyncPoints.length > 0, `${template.canonicalId} missing twin metadata`);
    assert.ok(template.sla.completeWithinMinutes > 0, `${template.canonicalId} missing SLA metadata`);
    assert.ok(template.certificationEvidence.length >= 5, `${template.canonicalId} missing certification evidence`);
    assert.ok(template.approvalPoints.every((point) => point.requiredRoles.length > 0 && point.evidenceRequired.length > 0 && point.deadlineMinutes > 0));
  }
});

test('safety-critical canonical approval tasks cannot execute without explicit approval', () => {
  for (const definition of canonicalWorkflowTemplates('track-1')) {
    const engine = new WorkflowOrchestrationEngine();
    engine.register(definition);
    let instance = engine.start(definition.id, { tenantId: 'track-1', priority: 'critical', digitalTwinRefs: ['twin:track:oval'], payload: { raceId: 'race-7', gateId: 'gate-1', incidentId: 'incident-1', inspectionId: 'inspection-1', evidenceIds: ['ev-1'] } }, 'workflow-test', '2026-06-14T12:00:00.000Z');
    for (let i = 0; i < 5 && !instance.tasks.some((task) => task.type === 'approvalTask' || task.type === 'parallelApproval'); i += 1) {
      const task = instance.tasks.find((candidate) => ['open', 'claimed', 'retrying', 'escalated'].includes(candidate.status));
      assert.ok(task, `${definition.id} did not expose an approval task`);
      instance = engine.completeTask(instance.id, task.id, task.role ?? 'workflow-test', { evidenceIds: ['ev-1'] }, '2026-06-14T12:01:00.000Z');
    }
    const approvalTask = instance.tasks.find((task) => task.type === 'approvalTask' || task.type === 'parallelApproval');
    assert.ok(approvalTask, `${definition.id} missing approval task`);
    assert.throws(() => engine.completeTask(instance.id, approvalTask.id, 'bypass-actor', {}, '2026-06-14T12:02:00.000Z'), /requires explicit approval/);
    assert.throws(() => engine.executeTask(instance.id, approvalTask.id, 'bypass-actor', {}, '2026-06-14T12:02:00.000Z'), /requires explicit approval/);
  }
});

test('workflow templates can be cloned for frontend catalogs without losing executable service actions', () => {
  const engine = new WorkflowOrchestrationEngine();
  engine.registerPortfolio([inspectionWorkflow('track-1'), raceDayOperationsWorkflow('track-1')]);
  const templates = engine.templates('track-1');
  assert.equal(templates.length, 2);
  assert.equal(typeof templates.find((definition) => definition.id === 'inspection-program').steps.find((step) => step.id === 'evidence-package').action, 'function');
  templates[0].steps[0].name = 'mutated in UI';
  assert.notEqual(engine.templates('track-1')[0].steps[0].name, 'mutated in UI');
});
