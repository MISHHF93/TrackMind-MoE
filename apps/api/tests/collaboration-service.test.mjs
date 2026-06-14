import assert from 'node:assert/strict';
import test from 'node:test';
import { CollaborationService, createApiFacadeState, handleApiRequest } from '../dist/index.js';

const principalA = { id: 'steward-a', tenantId: 'tenant-a', racetrackId: 'main-track', scopes: ['collaboration:read', 'collaboration:write'], actorType: 'human' };
const principalB = { id: 'steward-b', tenantId: 'tenant-b', racetrackId: 'main-track', scopes: ['collaboration:read', 'collaboration:write'], actorType: 'human' };
const target = { tenantId: 'tenant-a', racetrackId: 'main-track', targetArtifactId: 'approval-race-start', targetArtifactType: 'approval' };

test('collaboration service keeps target discussions tenant isolated', async () => {
  const service = new CollaborationService();
  const created = await service.createComment({ ...target, body: 'Review race-start approval evidence.', approvalRef: 'approval-race-start', evidence: ['readiness-watch'] }, principalA, { correlationId: 'corr-collab-a', now: '2026-06-13T17:45:00.000Z' });
  await service.createComment({ ...target, tenantId: 'tenant-b', body: 'Separate tenant discussion.' }, principalB, { correlationId: 'corr-collab-b', now: '2026-06-13T17:46:00.000Z' });

  assert.equal(created.thread.tenantId, 'tenant-a');
  assert.equal(created.comment.targetArtifactId, 'approval-race-start');
  assert.equal(service.queryThreads(target, principalA).total, 1);
  assert.equal(service.queryThreads({ ...target, tenantId: 'tenant-b' }, principalB).total, 1);
  assert.throws(() => service.queryThreads({ ...target, tenantId: 'tenant-b' }, principalA), /tenant isolation violation/);
  assert.throws(() => service.queryThreads({ tenantId: 'tenant-a', racetrackId: 'main-track' }, principalA), /targetArtifactId is required/);
});

test('collaboration service creates comments assignments and decisions with audit event refs', async () => {
  const service = new CollaborationService();
  const comment = await service.createComment({ ...target, body: 'Approval panel should discuss far-turn surface evidence.', approvalRef: 'approval-race-start', evidence: ['surface:moisture=27'] }, principalA, { correlationId: 'corr-approval-discussion', now: '2026-06-13T17:45:00.000Z' });
  const assignment = await service.createAssignment({ ...target, threadId: comment.thread.id, assigneeId: 'track-superintendent', role: 'surface-reviewer', reason: 'Confirm harrow evidence.', evidence: ['surface-inspection'], approvalRef: 'approval-race-start' }, principalA, { correlationId: 'corr-approval-discussion', now: '2026-06-13T17:46:00.000Z' });
  const decision = await service.recordDecision({ ...target, threadId: comment.thread.id, decision: 'keep-race-start-approval-pending', rationale: 'Surface evidence requires steward and superintendent review before operational action.', evidence: ['human-approval-record'], approvalRef: 'approval-race-start' }, principalA, { correlationId: 'corr-approval-discussion', now: '2026-06-13T17:47:00.000Z' });

  assert.equal(comment.comment.operationalMutationAllowed, false);
  assert.equal(assignment.assignment.operationalMutationAllowed, false);
  assert.equal(decision.decision.impactsProtectedState, false);
  assert.ok(comment.comment.auditRefs.length >= 1);
  assert.ok(comment.comment.eventRefs.length >= 1);
  assert.ok(assignment.assignment.auditRefs.length >= 1);
  assert.ok(decision.decision.eventRefs.length >= 1);
  assert.equal(service.auditLog.verify().valid, true);
  assert.equal(service.eventBus.events({ type: 'collaboration.comment.created', correlationId: 'corr-approval-discussion' }).length, 1);
  assert.equal(service.eventBus.events({ type: 'collaboration.assignment.created', correlationId: 'corr-approval-discussion' }).length, 1);
  assert.equal(service.eventBus.events({ type: 'collaboration.decision.recorded', correlationId: 'corr-approval-discussion' }).length, 1);

  const activity = service.activity({ ...target, approvalRef: 'approval-race-start' }, principalA);
  assert.equal(activity.total, 4);
  assert.ok(activity.activity.some((entry) => entry.artifactType === 'thread'));
  assert.ok(activity.activity.some((entry) => entry.artifactType === 'comment'));
  assert.ok(activity.activity.some((entry) => entry.artifactType === 'assignment'));
  assert.ok(activity.activity.some((entry) => entry.artifactType === 'decision'));
});

test('collaboration facade creates artifacts only and supports approval-linked discussion', async () => {
  const state = createApiFacadeState();
  const beforeGate = await handleApiRequest('GET', '/api/v1/starting-gate/position', undefined, state);
  const context = { tenantId: 'trackmind', racetrackId: 'main-track', targetArtifactId: 'approval-race-start', targetArtifactType: 'approval', approvalRef: 'approval-race-start', actorId: 'steward-live' };

  const comment = await handleApiRequest('POST', '/api/v1/collaboration/comments', { ...context, title: 'Race start approval discussion', body: 'Confirm gate, surface, and veterinary evidence before approval.', evidence: ['readiness-watch'] }, state);
  assert.equal(comment.status, 201);
  assert.equal(comment.body.accepted, true);
  assert.equal(comment.body.artifact.artifactType, 'comment');
  assert.equal(comment.body.artifact.approvalRef, 'approval-race-start');
  assert.equal(comment.body.artifact.operationalMutationAllowed, false);
  assert.equal(comment.body.metadata.audited, true);
  assert.equal(comment.body.metadata.eventPublished, true);
  assert.ok(comment.body.metadata.auditRefs.length >= 1);
  assert.ok(comment.body.metadata.eventRefs.length >= 1);

  const assignment = await handleApiRequest('POST', '/api/v1/collaboration/assignments', { ...context, threadId: comment.body.thread.id, assigneeId: 'track-superintendent-live', role: 'surface-reviewer', reason: 'Review far-turn footing evidence.' }, state);
  assert.equal(assignment.status, 201);
  assert.equal(assignment.body.artifact.artifactType, 'assignment');
  assert.equal(assignment.body.artifact.threadId, comment.body.thread.id);
  assert.equal(assignment.body.metadata.operationalMutationAllowed, false);

  const decision = await handleApiRequest('POST', '/api/v1/collaboration/decisions', { ...context, threadId: comment.body.thread.id, decision: 'approval-remains-pending', rationale: 'Collaboration record captures the discussion but does not approve or execute the race start.' }, state);
  assert.equal(decision.status, 201);
  assert.equal(decision.body.artifact.artifactType, 'decision');
  assert.equal(decision.body.artifact.impactsProtectedState, false);
  assert.equal(decision.body.event.type, 'collaboration.decision.recorded');

  const threads = await handleApiRequest('GET', '/api/v1/collaboration/threads?tenantId=trackmind&racetrackId=main-track&targetArtifactId=approval-race-start&targetArtifactType=approval&approvalRef=approval-race-start', undefined, state);
  assert.equal(threads.status, 200);
  assert.equal(threads.body.total, 1);
  assert.ok(threads.body.threads[0].commentIds.includes(comment.body.artifact.id));
  assert.ok(threads.body.threads[0].assignmentIds.includes(assignment.body.artifact.id));
  assert.ok(threads.body.threads[0].decisionIds.includes(decision.body.artifact.id));

  const activity = await handleApiRequest('GET', '/api/v1/collaboration/activity?tenantId=trackmind&racetrackId=main-track&targetArtifactId=approval-race-start&targetArtifactType=approval&approvalRef=approval-race-start', undefined, state);
  assert.equal(activity.status, 200);
  assert.equal(activity.body.total, 4);
  assert.ok(activity.body.activity.every((entry) => entry.auditRefs.length >= 1 && entry.eventRefs.length >= 1));

  const afterGate = await handleApiRequest('GET', '/api/v1/starting-gate/position', undefined, state);
  assert.deepEqual(afterGate.body, beforeGate.body);
});
