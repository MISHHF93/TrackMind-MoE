import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApprovalArtifact, CentralizedApprovalService } from '../dist/approvals.js';
import { buildWorkflowArtifact, canonicalGateMoveWorkflow, WorkflowOrchestrationEngine } from '../dist/workflowEngine.js';

const human = (id, roles) => ({ id, roles, human: true });

test('workflow artifact builder adapts the canonical gate move workflow contract', () => {
  const definition = canonicalGateMoveWorkflow('tenant-1');
  const artifact = buildWorkflowArtifact(definition, { racetrackId: 'track-main', correlationId: 'corr-gate-move', generatedAt: '2026-06-14T12:00:00.000Z' });

  assert.equal(artifact.schemaVersion, 'trackmind.workflow-artifact.v1');
  assert.equal(artifact.workflowType, 'tmwf.gate-move.v1');
  assert.equal(artifact.status, 'pending');
  assert.equal(artifact.sourceStatus, 'defined');
  assert.equal(artifact.tenantId, 'tenant-1');
  assert.equal(artifact.racetrackId, 'track-main');
  assert.equal(artifact.correlationId, 'corr-gate-move');
  assert.deepEqual(artifact.protectedActions, ['starting-gate-move']);
  assert.ok(artifact.tasks.some((task) => task.stepId === 'survey-gate-location' && task.evidence.length === 0));
  const approval = artifact.approvals.find((item) => item.stepId === 'approve-gate-move');
  assert.ok(approval);
  assert.equal(approval.minimumApprovals, 2);
  assert.deepEqual(approval.requiredApprovers, ['horse-operations-coordinator', 'facilities-manager']);
  assert.ok(artifact.evidence.includes('gps-fix'));
  assert.equal(artifact.mutationPolicy.localMutationAllowed, false);
});

test('safety-critical gate move approval artifacts preserve workflow and approval requirements', () => {
  const approvalService = new CentralizedApprovalService();
  const definition = canonicalGateMoveWorkflow('tenant-1');
  const engine = new WorkflowOrchestrationEngine({ approvalService });
  engine.register(definition);
  const started = engine.start(definition.id, {
    tenantId: 'tenant-1',
    priority: 'critical',
    digitalTwinRefs: ['twin:main-track:gate-1'],
    payload: { racetrackId: 'track-main', gateId: 'gate-1', evidenceIds: ['gps-fix', 'photo'] },
  }, 'racing-office', '2026-06-14T12:00:00.000Z');
  const surveyed = engine.completeTask(started.id, started.tasks[0].id, 'track-superintendent', {}, '2026-06-14T12:05:00.000Z');
  const approvalTask = surveyed.tasks.find((task) => task.stepId === 'approve-gate-move');
  assert.ok(approvalTask);
  assert.ok(approvalTask.approvalRequestId);

  const workflowArtifact = buildWorkflowArtifact(surveyed, { definition, correlationId: 'corr-runtime-gate' });
  const workflowApproval = workflowArtifact.approvals.find((approval) => approval.stepId === 'approve-gate-move');
  assert.ok(workflowApproval);
  assert.equal(workflowApproval.action, 'starting-gate-move');
  assert.equal(workflowApproval.target, 'gate-1');
  assert.equal(workflowApproval.status, 'pending');
  assert.equal(workflowApproval.expiresAt, '2026-06-14T12:20:00.000Z');
  assert.deepEqual(workflowApproval.requiredApprovers, ['horse-operations-coordinator', 'facilities-manager']);
  assert.ok(workflowApproval.evidence.includes('gps-fix'));
  assert.ok(workflowArtifact.auditRefs.length >= 1);

  const request = approvalService.getRequest(approvalTask.approvalRequestId);
  const approvalArtifact = buildApprovalArtifact(request, { racetrackId: 'track-main', eventRefs: ['evt-approval-requested'] });
  assert.equal(approvalArtifact.approvalType, 'starting-gate-move');
  assert.equal(approvalArtifact.status, 'pending');
  assert.equal(approvalArtifact.workflowInstanceId, surveyed.id);
  assert.equal(approvalArtifact.workflowTaskId, approvalTask.id);
  assert.deepEqual(approvalArtifact.requiredApprovers, ['horse-operations-coordinator', 'facilities-manager']);
  assert.ok(approvalArtifact.evidence.includes('photo'));
  assert.equal(approvalArtifact.expiresAt, '2026-06-14T12:20:00.000Z');
  assert.ok(approvalArtifact.escalation.rules.some((rule) => rule.reason === 'starting gate move approval pending'));
});

test('approval artifact builder normalizes pending approved and rejected statuses', () => {
  const service = new CentralizedApprovalService();
  const pending = service.createRequest({ id: 'approval-gate-pending', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'starting-gate-move', target: 'gate-1', requestedBy: 'workflow-engine', actorType: 'service', reason: 'gate move', evidence: ['human-approval-record'], now: '2026-06-14T12:00:00.000Z' });
  assert.equal(buildApprovalArtifact(pending).status, 'pending');

  service.decide(pending.id, human('secretary-1', ['horse-operations-coordinator']), 'approved', 'office approved', ['human-approval-record'], '2026-06-14T12:01:00.000Z');
  const approved = service.decide(pending.id, human('surface-1', ['track-superintendent']), 'approved', 'surface approved', ['human-approval-record'], '2026-06-14T12:02:00.000Z');
  assert.equal(buildApprovalArtifact(approved).status, 'approved');

  const rejectable = service.createRequest({ id: 'approval-gate-rejected', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'starting-gate-move', target: 'gate-2', requestedBy: 'workflow-engine', actorType: 'service', reason: 'gate move', evidence: ['human-approval-record'], now: '2026-06-14T12:03:00.000Z' });
  const rejected = service.decide(rejectable.id, human('secretary-2', ['horse-operations-coordinator']), 'rejected', 'insufficient GPS evidence', ['human-approval-record'], '2026-06-14T12:04:00.000Z');
  assert.equal(buildApprovalArtifact(rejected).status, 'rejected');
});

test('artifact adapters are server-authored snapshots without frontend local mutation semantics', () => {
  const definition = canonicalGateMoveWorkflow('tenant-1');
  const workflowArtifact = buildWorkflowArtifact(definition);
  const serviceTask = workflowArtifact.tasks.find((task) => task.stepId === 'sync-gate-twin');
  assert.ok(serviceTask);
  assert.equal('action' in serviceTask, false);
  assert.equal(workflowArtifact.mutationPolicy.writeModel, 'server-authoritative');
  workflowArtifact.tasks.find((task) => task.stepId === 'approve-gate-move').requiredApprovers.push('frontend-admin');
  assert.deepEqual(definition.steps.find((step) => step.id === 'approve-gate-move').approvalRoles, ['horse-operations-coordinator', 'facilities-manager']);
  assert.deepEqual(buildWorkflowArtifact(definition).approvals.find((approval) => approval.stepId === 'approve-gate-move').requiredApprovers, ['horse-operations-coordinator', 'facilities-manager']);

  const service = new CentralizedApprovalService();
  const request = service.createRequest({ id: 'approval-snapshot', tenantId: 'tenant-1', racetrackId: 'trk-1', action: 'starting-gate-move', target: 'gate-1', requestedBy: 'workflow-engine', actorType: 'service', reason: 'gate move', evidence: ['human-approval-record'], now: '2026-06-14T12:00:00.000Z' });
  const approvalArtifact = buildApprovalArtifact(request);
  assert.equal(approvalArtifact.mutationPolicy.localMutationAllowed, false);
  approvalArtifact.evidence.push('frontend-only-evidence');
  approvalArtifact.approvalSteps[0].requiredApprovers.push('frontend-admin');
  assert.deepEqual(request.evidence, ['human-approval-record']);
  assert.deepEqual(buildApprovalArtifact(request).approvalSteps[0].requiredApprovers, ['horse-operations-coordinator']);
});
