import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTusEntityBase,
  createTusGlobalId,
  createTusReference,
  trackMindUniversalSchemaManifest,
  trackMindUniversalSchemaVersion,
  tusDeploymentModels,
  tusEntityKinds,
  tusEntityRegistry,
  validateTusEntity,
  validateTusEntitySet,
  validateTusManifest,
} from '../dist/index.js';

const now = '2026-06-14T20:00:00.000Z';

function base(kind, id, status, overrides = {}) {
  return {
    ...createTusEntityBase(kind, {
      id,
      tenantId: overrides.tenantId ?? 'tenant-east',
      racetrackId: overrides.racetrackId ?? 'track-001',
      displayName: overrides.displayName ?? id,
      status,
      ownerId: overrides.ownerId ?? 'nexus-ops',
      now,
      deploymentModel: overrides.deploymentModel,
      sourceSystem: overrides.sourceSystem,
      externalIds: overrides.externalIds,
      actor: overrides.actor,
    }),
    ...(overrides.entity ?? {}),
  };
}

const ref = (kind, id, racetrackId = 'track-001') => createTusReference({ kind, id, tenantId: 'tenant-east', racetrackId, displayName: id });
const actor = { actorId: 'steward-1', actorType: 'human', roles: ['steward'], sourceSystem: 'nexus-ui' };

test('TUS manifest registers Tier 1 business objects and universal governance objects', () => {
  assert.equal(trackMindUniversalSchemaManifest.schemaVersion, trackMindUniversalSchemaVersion);
  assert.deepEqual(validateTusManifest(), { valid: true, errors: [] });

  for (const kind of ['racetrack','meet','race-day','race','horse','jockey','trainer','owner','veterinarian','steward','employee','asset','incident','inspection','approval','audit-event','ai-recommendation']) {
    assert.ok(tusEntityRegistry[kind], `${kind} missing`);
  }
  for (const kind of ['workflow','audit-record','digital-twin','compliance-control']) {
    assert.ok(tusEntityRegistry[kind], `${kind} missing`);
  }
  assert.deepEqual(Object.keys(tusEntityRegistry), [...tusEntityKinds]);
});

test('TUS validates required Tier 1 object contracts', () => {
  const raceDayRef = ref('race-day', 'race-day-2026-06-14');
  const raceRef = ref('race', 'race-7');
  const horseRef = ref('horse', 'horse-1');
  const ownerRef = ref('owner', 'owner-1');
  const employeeRef = ref('employee', 'employee-1');

  const entities = [
    { ...base('racetrack', 'track-001', 'open'), timezone: 'America/New_York', operatingJurisdiction: 'MD' },
    { ...base('meet', 'meet-summer-2026', 'open'), meetCode: 'SUM26', season: '2026', opensOn: '2026-06-01', closesOn: '2026-09-01' },
    { ...base('race-day', 'race-day-2026-06-14', 'open'), raceDate: '2026-06-14', raceRefs: [raceRef] },
    { ...base('race', 'race-7', 'scheduled'), raceDayRef, raceNumber: 7, surface: 'dirt', horseRefs: [horseRef] },
    { ...base('horse', 'horse-1', 'active'), ownerRefs: [ownerRef] },
    { ...base('jockey', 'jockey-1', 'active'), licenseNumber: 'J-1', licenseJurisdiction: 'MD' },
    { ...base('trainer', 'trainer-1', 'active'), licenseNumber: 'T-1', licenseJurisdiction: 'MD' },
    { ...base('owner', 'owner-1', 'active'), ownershipType: 'stable' },
    { ...base('veterinarian', 'vet-1', 'active'), licenseNumber: 'V-1', authorityScope: 'regulatory', licenseJurisdiction: 'MD' },
    { ...base('steward', 'steward-1', 'active'), licenseNumber: 'S-1', jurisdiction: 'MD', panelRole: 'chair' },
    { ...base('employee', 'employee-1', 'active'), employeeNumber: 'E-1', role: 'track-superintendent', employmentStatus: 'active' },
    { ...base('asset', 'asset-gate-release', 'online'), assetType: 'control', riskClassification: 'safety-critical' },
    { ...base('incident', 'incident-1', 'open'), severity: 'high', subjectRef: raceRef, openedAt: now, evidenceRefs: ['ev-incident'] },
    { ...base('inspection', 'inspection-1', 'passed'), inspectionType: 'surface', inspectedSubjectRef: ref('asset', 'asset-gate-release'), inspectedAt: now, inspectedByRef: employeeRef, findings: ['nominal'] },
    { ...base('approval', 'approval-1', 'pending-approval', { actor }), protectedAction: 'race-start', targetRef: raceRef, requestedBy: { ...actor, tenantId: 'tenant-east', racetrackId: 'track-001' }, approverRefs: [], evidenceRefs: ['ev-approval'] },
    { ...base('audit-event', 'audit-event-1', 'recorded', { actor }), eventType: 'audit.event.recorded.v1', action: 'approval.requested', targetRef: raceRef, occurredAt: now, evidenceRefs: ['ev-audit'], correlationId: 'corr-1' },
    { ...base('ai-recommendation', 'ai-rec-1', 'review-required'), activity: 'create-draft-action', targetRef: raceRef, summary: 'Draft race start only.', confidence: 0.82, evidenceRefs: ['ev-ai'], advisoryOnly: true, approvalRefs: [ref('approval', 'approval-1')], modelLineageRefs: ['model:readiness:v1'] },
  ];

  for (const entity of entities) assert.deepEqual(validateTusEntity(entity), { valid: true, errors: [] }, entity.kind);
  assert.deepEqual(validateTusEntitySet(entities), { valid: true, errors: [] });
});

test('TUS stable global identifiers are deterministic and racetrack scoped', () => {
  const trackOne = createTusGlobalId({ tenantId: 'tenant-east', racetrackId: 'track-001', kind: 'horse', id: 'Horse 1' });
  const trackOneAgain = createTusGlobalId({ tenantId: 'TENANT_EAST', racetrackId: 'track-001', kind: 'horse', id: 'Horse 1' });
  const trackTwo = createTusGlobalId({ tenantId: 'tenant-east', racetrackId: 'track-002', kind: 'horse', id: 'Horse 1' });

  assert.equal(trackOne, 'tus:tenant-east:track-001:horse:horse-1');
  assert.equal(trackOneAgain, trackOne);
  assert.notEqual(trackOne, trackTwo);

  const bad = { ...base('horse', 'horse-1', 'active'), ownerRefs: [ref('owner', 'owner-1')], globalId: trackTwo };
  const result = validateTusEntity(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('globalId must equal tus:tenant-east:track-001:horse:horse-1')));
});

test('TUS enforces tenant, racetrack, and interoperability metadata for multi-track exchange', () => {
  const asset = {
    ...base('asset', 'asset-camera-1', 'online', {
      deploymentModel: 'franchise',
      sourceSystem: 'certified-track-node',
      externalIds: { 'source-system': 'CAM-001' },
      entity: {
        digitalTwinRef: {
          twinId: 'twin:asset:asset-camera-1',
          modelId: 'asset.camera.v1',
          sourceSystem: 'certified-track-node',
          entity: ref('asset', 'asset-camera-1'),
          legalSourceOfTruth: false,
        },
        interoperability: {
          deploymentModel: 'franchise',
          sourceSystem: 'certified-track-node',
          externalIds: { 'source-system': 'CAM-001' },
          sharedWithRacetrackIds: ['track-002'],
          federationKeys: { arci: 'ARCI-CAM-001' },
        },
      },
    }),
    assetType: 'camera',
    riskClassification: 'operational',
  };

  assert.deepEqual(validateTusEntity(asset), { valid: true, errors: [] });
  for (const model of tusDeploymentModels) assert.ok(tusEntityRegistry.asset.interoperability.deploymentModels.includes(model));

  const wrongTrackTwin = {
    ...asset,
    digitalTwinRef: { ...asset.digitalTwinRef, entity: ref('asset', 'asset-camera-1', 'track-002') },
  };
  const result = validateTusEntity(wrongTrackTwin);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('digitalTwinRef.entity racetrackId must match entity racetrackId'));
});

test('TUS includes canonical workflow, Digital Twin, audit record, and compliance control contracts', () => {
  const raceRef = ref('race', 'race-7');
  const workflow = { ...base('workflow', 'workflow-race-start', 'pending-approval'), workflowType: 'race-start', state: 'pending-approval', subjectRef: raceRef, approvalRefs: [ref('approval', 'approval-1')] };
  const auditRecord = { ...base('audit-record', 'audit-record-1', 'recorded'), action: 'workflow.created', targetRef: raceRef, occurredAt: now, evidenceRefs: ['ev-audit'] };
  const twin = { ...base('digital-twin', 'twin-race-7', 'active'), twinId: 'twin:race:race-7', modelId: 'race.v1', sourceEntityRef: raceRef };
  const control = { ...base('compliance-control', 'ctrl-racing-safety', 'implemented'), frameworkIds: ['HISA','ARCI'], controlStatus: 'implemented', ownerRef: ref('employee', 'employee-1'), evidenceRefs: ['ev-control'] };

  for (const entity of [workflow, auditRecord, twin, control]) assert.deepEqual(validateTusEntity(entity), { valid: true, errors: [] }, entity.kind);
});
