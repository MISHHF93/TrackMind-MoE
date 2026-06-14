import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collaborationEventContracts,
  collaborationEventNames,
  collaborationObjectSchemas,
  collaborationObjectTypes,
  collaborationSchemaVersion,
  deserializeCollaborationEvent,
  deserializeCollaborationObject,
  isCollaborationEvent,
  isCommentThread,
  serializeCollaborationEvent,
  serializeCollaborationObject,
  validateCollaborationEvent,
  validateCollaborationObject,
  validateCollaborationObjectSet,
} from '../dist/index.js';

const now = '2026-06-14T22:30:00.000Z';
const tenantId = 'tenant-east';
const racetrackId = 'track-001';
const targetArtifactId = 'artifact:race:race-7';
const targetArtifactType = 'event';

function participant(actorId = 'steward-1') {
  return { actorId, actorType: 'human', tenantId, racetrackId, roles: ['steward'] };
}

function auditRef(auditId = 'audit:collaboration:1') {
  return { auditId, eventId: 'evt:audit:1', action: 'collaboration.changed', occurredAt: now, tenantId, racetrackId };
}

function eventRef(eventId = 'evt:collaboration:source') {
  return { eventId, eventType: 'collaboration.source.linked.v1', occurredAt: now, tenantId, racetrackId };
}

function evidenceRef(evidenceId = 'evidence:race-7:video') {
  return { evidenceId, kind: 'video', uri: 's3://evidence/race-7/head-on.mp4', hash: 'sha256:video', capturedAt: now, tenantId, racetrackId };
}

function attachment(id = 'attachment:target-artifact') {
  return { id, kind: 'artifact', artifactId: targetArtifactId, artifactType: targetArtifactType, tenantId, racetrackId, attachedAt: now, attachedBy: 'steward-1' };
}

function base(objectType, overrides = {}) {
  return {
    schemaVersion: collaborationSchemaVersion,
    objectType,
    id: `collab:${objectType}:1`,
    tenantId,
    racetrackId,
    targetArtifactId,
    targetArtifactType,
    authorId: 'steward-1',
    participants: [participant('steward-1'), participant('steward-2')],
    createdAt: now,
    updatedAt: now,
    status: 'open',
    visibility: 'racetrack',
    permissions: {
      canRead: ['steward', 'compliance-officer'],
      canComment: ['steward'],
      canMention: ['steward'],
      canAssign: ['steward'],
      canResolve: ['steward'],
      canArchive: ['steward', 'compliance-officer'],
      canAttachEvidence: ['steward'],
      externalShareAllowed: false,
      aiAccessAllowed: false,
    },
    auditRefs: [auditRef()],
    eventRefs: [eventRef()],
    attachments: [attachment()],
    evidenceRefs: [evidenceRef()],
    retention: { policyId: 'regulated-racing-record', retainUntil: '2033-06-14', disposition: 'retain', legalHold: false, regulatoryBasis: ['HISA', 'ARCI'] },
    workflowId: 'workflow:race-7-review',
    approvalId: 'approval:race-7-review',
    digitalTwinRef: 'twin:race:race-7',
    correlationId: 'corr:collaboration:1',
    ...overrides,
  };
}

function comment(overrides = {}) {
  return base('comment', {
    id: 'collab:comment:1',
    threadId: 'collab:comment-thread:1',
    body: 'Please review the head-on replay before the ruling.',
    mentions: [],
    ...overrides,
  });
}

function objects() {
  return [
    base('comment-thread', { id: 'collab:comment-thread:1', title: 'Race 7 review', comments: [comment()], mentionIds: ['collab:mention:1'], assignmentIds: ['collab:assignment:1'], decisionRecordIds: ['collab:decision-record:1'] }),
    comment(),
    base('mention', { id: 'collab:mention:1', mentionedActorId: 'steward-2', threadId: 'collab:comment-thread:1', commentId: 'collab:comment:1' }),
    base('assignment', { id: 'collab:assignment:1', assigneeId: 'steward-2', assignedBy: 'steward-1', assignmentType: 'review', description: 'Review the cited evidence before the panel call.', dueAt: '2026-06-14T23:00:00.000Z' }),
    base('decision-record', { id: 'collab:decision-record:1', status: 'recorded', decision: 'Escalate to steward panel.', rationale: 'Evidence requires formal panel review.', decidedBy: 'steward-1', decidedAt: now, outcome: 'escalated' }),
    base('handoff', { id: 'collab:handoff:1', status: 'requested', fromActorId: 'steward-1', toActorId: 'steward-2', reason: 'Shift change before final review.', requestedAt: now, checklist: [{ id: 'check:evidence', label: 'Evidence manifest reviewed', completed: true, evidenceRefs: ['evidence:race-7:video'] }] }),
    base('evidence-packet', { id: 'collab:evidence-packet:1', title: 'Race 7 evidence packet', summary: 'Head-on replay and steward notes.', packetHash: 'sha256:evidence-packet', sealed: false, custodyAuditRefs: ['audit:collaboration:1'] }),
    base('incident-room', { id: 'collab:incident-room:1', incidentId: 'incident:race-7:interference', severity: 'warning', openedAt: now, commanderId: 'steward-1', roomMode: 'triage' }),
    base('approval-discussion', { id: 'collab:approval-discussion:1', approvalId: 'approval:race-7-review', approvalStatus: 'pending', protectedAction: 'steward-ruling', decisionRefs: ['collab:decision-record:1'] }),
    base('steward-case-discussion', { id: 'collab:steward-case:1', caseId: 'case:race-7:interference', inquiryId: 'inquiry:race-7', stewardPanelIds: ['steward-1', 'steward-2'], ruleRefs: ['rule:interference'] }),
    base('maintenance-discussion', { id: 'collab:maintenance:1', maintenanceWorkOrderId: 'wo:surface:far-turn', assetIds: ['asset:far-turn'], maintenanceType: 'surface' }),
    base('ai-recommendation-discussion', { id: 'collab:ai-recommendation:1', recommendationId: 'rec:surface:harrow', modelLineageRefs: ['model:surface-advisor:v2'], advisoryOnly: true, requiresApproval: true, approvalId: 'approval:surface:harrow' }),
    base('compliance-review-discussion', { id: 'collab:compliance-review:1', reviewId: 'review:hisa:race-7', frameworkIds: ['HISA'], controlIds: ['control:evidence-retention'], filingId: 'filing:hisa:race-7' }),
  ];
}

function event(overrides = {}) {
  return {
    schemaVersion: collaborationSchemaVersion,
    eventId: 'evt:collaboration:comment-added:1',
    eventType: 'CommentAdded',
    eventName: collaborationEventNames.CommentAdded,
    tenantId,
    racetrackId,
    occurredAt: now,
    actorId: 'steward-1',
    targetArtifactId,
    targetArtifactType,
    collaborationObjectId: 'collab:comment:1',
    collaborationObjectType: 'comment',
    payload: {
      objectId: 'collab:comment:1',
      objectType: 'comment',
      targetArtifactId,
      targetArtifactType,
      authorId: 'steward-1',
      threadId: 'collab:comment-thread:1',
      commentId: 'collab:comment:1',
      summary: 'Comment added.',
    },
    auditRefs: [auditRef('audit:comment-added:1')],
    eventRefs: [eventRef('evt:previous:1')],
    evidenceRefs: [evidenceRef()],
    correlationId: 'corr:collaboration:1',
    workflowId: 'workflow:race-7-review',
    approvalId: 'approval:race-7-review',
    digitalTwinRef: 'twin:race:race-7',
    ...overrides,
  };
}

test('collaboration schemas validate every canonical object DTO', () => {
  assert.deepEqual(collaborationObjectTypes, Object.keys(collaborationObjectSchemas));

  for (const object of objects()) {
    assert.deepEqual(validateCollaborationObject(object), { valid: true, errors: [] }, object.objectType);
  }
  assert.deepEqual(validateCollaborationObjectSet(objects()), { valid: true, errors: [] });
  assert.equal(isCommentThread(objects()[0]), true);
});

test('collaboration validators report required fields and tenant boundary violations', () => {
  const missingRequired = { ...comment(), body: '' };
  const wrongTenant = {
    ...comment(),
    participants: [{ ...participant('steward-1'), tenantId: 'tenant-west' }],
    evidenceRefs: [{ ...evidenceRef(), tenantId: 'tenant-west' }],
  };

  const missing = validateCollaborationObject(missingRequired);
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.includes('CollaborationObject.body is required'));

  const boundary = validateCollaborationObject(wrongTenant);
  assert.equal(boundary.valid, false);
  assert.ok(boundary.errors.includes('CollaborationObject.participants[0].tenantId must match collaboration tenantId'));
  assert.ok(boundary.errors.includes('CollaborationObject.evidenceRefs[0].tenantId must match collaboration tenantId'));
});

test('collaboration objects must stay connected to artifacts and scoped participants', () => {
  const disconnected = validateCollaborationObject({ ...comment(), targetArtifactId: '' });
  assert.equal(disconnected.valid, false);
  assert.ok(disconnected.errors.includes('CollaborationObject.targetArtifactId is required'));
  assert.ok(disconnected.errors.includes('CollaborationObject must be attached to a target artifact'));

  const missingAuthorParticipant = validateCollaborationObject({ ...comment(), participants: [participant('steward-2')] });
  assert.equal(missingAuthorParticipant.valid, false);
  assert.ok(missingAuthorParticipant.errors.includes('CollaborationObject.authorId must be included in participants'));

  const nestedWrongTarget = validateCollaborationObject(base('comment-thread', { title: 'Thread', comments: [comment({ targetArtifactId: 'artifact:other' })], mentionIds: [], assignmentIds: [], decisionRecordIds: [] }));
  assert.equal(nestedWrongTarget.valid, false);
  assert.ok(nestedWrongTarget.errors.includes('CollaborationObject.comments[0].targetArtifactId must match thread targetArtifactId'));
});

test('collaboration attachment and evidence references require usable targets', () => {
  const invalidAttachment = validateCollaborationObject({ ...comment(), attachments: [{ id: 'attachment:empty', kind: 'artifact', tenantId, racetrackId }] });
  assert.equal(invalidAttachment.valid, false);
  assert.ok(invalidAttachment.errors.includes('CollaborationObject.attachments[0] must reference an artifactId, evidenceId, or uri'));

  const invalidEvidencePacket = validateCollaborationObject({ ...objects().find((object) => object.objectType === 'evidence-packet'), evidenceRefs: [] });
  assert.equal(invalidEvidencePacket.valid, false);
  assert.ok(invalidEvidencePacket.errors.includes('CollaborationObject.evidence-packet requires at least one evidenceRef'));
});

test('collaboration event contracts expose canonical names and validate envelopes', () => {
  assert.deepEqual(Object.keys(collaborationEventNames), [
    'CommentAdded',
    'MentionCreated',
    'AssignmentCreated',
    'DecisionRecorded',
    'HandoffRequested',
    'EvidencePacketCreated',
    'IncidentRoomOpened',
    'ApprovalDiscussionUpdated',
    'CollaborationArchived',
  ]);
  assert.equal(collaborationEventContracts.length, 9);
  assert.ok(collaborationEventContracts.every((contract) => contract.eventName === collaborationEventNames[contract.eventType]));
  assert.ok(Object.values(collaborationEventNames).every((name) => name.startsWith('collaboration.') && name.endsWith('.v1')));

  assert.deepEqual(validateCollaborationEvent(event()), { valid: true, errors: [] });
  assert.equal(isCollaborationEvent(event()), true);

  const invalidName = validateCollaborationEvent({ ...event(), eventName: 'collaboration.comment.created.v1' });
  assert.equal(invalidName.valid, false);
  assert.ok(invalidName.errors.includes('CollaborationEvent.eventName must be collaboration.comment.added.v1 for CommentAdded'));
});

test('collaboration serialization preserves validated object and event DTOs', () => {
  const thread = objects()[0];
  const roundTripObject = deserializeCollaborationObject(serializeCollaborationObject(thread));
  assert.deepEqual(roundTripObject, thread);

  const value = event();
  const roundTripEvent = deserializeCollaborationEvent(serializeCollaborationEvent(value));
  assert.deepEqual(roundTripEvent, value);

  assert.throws(() => serializeCollaborationObject({ ...comment(), participants: [] }), /participants must include/);
  assert.throws(() => serializeCollaborationEvent({ ...event(), payload: { ...event().payload, objectId: 'other' } }), /payload.objectId must match/);
});
