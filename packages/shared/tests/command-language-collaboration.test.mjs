import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collaborationEventTypes,
  commandLanguageComponentCategories,
  commandLanguageNavGroups,
  commandLanguageWorkspaceIds,
  commandLanguageWorkspaceSections,
  createCollaborationEvent,
  trackMindCollaborationSchemaVersion,
  trackMindCommandLanguage,
  trackMindCommandLanguageVersion,
  validateCollaborationContext,
  validateTrackMindCommandLanguage,
} from '../dist/index.js';

const now = '2026-06-14T22:30:00.000Z';

function collaborationContext(overrides = {}) {
  return {
    id: 'thread-gate-move-1',
    tenantId: 'woodbine',
    racetrackId: 'TRACK-WO',
    targetArtifactId: 'GATE-MOVE-001',
    targetArtifactType: 'GateMoveRequest',
    authorId: 'USER-OPS-1',
    participants: ['USER-OPS-1', 'track-superintendent'],
    createdAt: now,
    updatedAt: now,
    status: 'open',
    visibility: 'team',
    permissions: ['comment:create', 'assignment:create'],
    auditRefs: ['audit-gate-move-1'],
    eventRefs: ['event-gate-move-requested'],
    evidenceRefs: ['gps-fix', 'approval-policy'],
    retentionPolicy: { policyId: 'regulated-7-year', retainForDays: 2555, legalHold: false, regulatoryBasis: 'regulated-racing-records' },
    workflowId: 'workflow-gate-move-1',
    approvalId: 'approval-gate-move-1',
    digitalTwinRef: 'twin:gate:main',
    ...overrides,
  };
}

test('TrackMind Command Language defines required enterprise command-center standards', () => {
  assert.equal(trackMindCommandLanguage.schemaVersion, trackMindCommandLanguageVersion);
  assert.equal(trackMindCommandLanguage.name, 'TrackMind Command Language');
  for (const group of ['Operations', 'Equine', 'Safety', 'Facilities', 'Governance', 'Intelligence', 'Executive', 'Platform Admin']) {
    assert.ok(commandLanguageNavGroups.includes(group));
  }
  for (const section of ['page-header', 'operational-summary-row', 'primary-work-area', 'evidence-detail-side-panel', 'event-timeline', 'approval-context', 'audit-context', 'digital-twin-context']) {
    assert.ok(commandLanguageWorkspaceSections.includes(section));
  }
  for (const category of ['data-tables', 'maps', 'timelines', 'approvals', 'audit-rows', 'confidence-badges', 'digital-twin-cards', 'safety-critical-controls']) {
    assert.ok(commandLanguageComponentCategories.includes(category));
  }
  for (const workspace of ['operations', 'starting-gate', 'surface', 'approvals', 'audit', 'ai-governance', 'api-hub', 'platform-health']) {
    assert.ok(commandLanguageWorkspaceIds.includes(workspace));
  }
  assert.ok(trackMindCommandLanguage.accessibilityRequirements.includes('keyboard-navigation'));
  assert.ok(trackMindCommandLanguage.safetyRequirements.some((rule) => /Safety-critical controls remain disabled/.test(rule)));
  assert.ok(trackMindCommandLanguage.collaborationRequirements.includes('targetArtifactId'));
  assert.ok(trackMindCommandLanguage.tenantBoundaryRequirements.some((rule) => /No cross-tenant/.test(rule)));
  assert.equal(validateTrackMindCommandLanguage().valid, true);
});

test('collaboration contexts are tenant-scoped and attached to operational artifacts', () => {
  const context = collaborationContext();
  const result = validateCollaborationContext(context);
  assert.equal(result.valid, true);
  assert.equal(result.attachedToArtifact, true);
  assert.equal(result.tenantScoped, true);
  assert.deepEqual(result.missing, []);
});

test('collaboration validation rejects disconnected chat objects', () => {
  const result = validateCollaborationContext(collaborationContext({ targetArtifactId: '', targetArtifactType: '', tenantId: '' }));
  assert.equal(result.valid, false);
  assert.equal(result.attachedToArtifact, false);
  assert.equal(result.tenantScoped, false);
  assert.ok(result.missing.includes('tenantId'));
  assert.ok(result.missing.includes('targetArtifactId'));
});

test('collaboration events preserve audit, workflow, approval, and Digital Twin references', () => {
  const context = collaborationContext();
  const event = createCollaborationEvent('CommentAdded', context);
  assert.equal(event.schemaVersion, trackMindCollaborationSchemaVersion);
  assert.equal(event.eventType, 'CommentAdded');
  assert.equal(event.tenantId, 'woodbine');
  assert.equal(event.targetArtifactId, 'GATE-MOVE-001');
  assert.equal(event.workflowId, 'workflow-gate-move-1');
  assert.equal(event.approvalId, 'approval-gate-move-1');
  assert.equal(event.digitalTwinRef, 'twin:gate:main');
  assert.deepEqual(event.auditRefs, ['audit-gate-move-1']);
  for (const required of ['CommentAdded', 'MentionCreated', 'AssignmentCreated', 'DecisionRecorded', 'HandoffRequested', 'EvidencePacketCreated', 'IncidentRoomOpened', 'ApprovalDiscussionUpdated', 'CollaborationArchived']) {
    assert.ok(collaborationEventTypes.includes(required));
  }
});
