import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiContractSchemas,
  apiEndpointContracts,
  artifactRegistry,
  artifactTypes,
  checkArtifactEnvelopeCompatibility,
  compareSchemaVersions,
  createArtifactBaseMetadata,
  deserializeArtifact,
  isArtifact,
  isArtifactOfType,
  migrateArtifactEnvelope,
  serializeArtifact,
  trackMindUniversalArtifactFrameworkSchemaVersion,
  universalArtifactSchemaVersion,
  universalArtifactTypes,
  validateArtifact,
  validateApprovalArtifact,
  validateArtifactEnvelope,
  validateAssetArtifact,
  validateAuditArtifact,
  validateComplianceArtifact,
  validateContract,
  validateDigitalTwinArtifact,
  validateEventArtifact,
  validateFeatureArtifact,
  validateForecastArtifact,
  validateInsightArtifact,
  validateInvestigationArtifact,
  validateRecommendationArtifact,
  validateArtifactSet,
  validateRegistryEntry,
  validateTelemetryArtifact,
  validateWorkflowArtifact,
} from '../dist/index.js';

const now = '2026-06-14T22:00:00.000Z';
const artifactKinds = ['Asset','Event','DigitalTwin','Telemetry','Workflow','Approval','Audit','Compliance','Recommendation','Investigation','Feature','Insight','Forecast'];
const aiOutputKinds = ['Insight','Recommendation','Forecast'];

function artifact(kind, overrides = {}) {
  return {
    id: `artifact:${kind.toLowerCase()}`,
    kind,
    name: `${kind} artifact`,
    description: `${kind} universal artifact compatibility seed.`,
    schemaRef: `trackmind.artifact.${kind.toLowerCase()}.v1`,
    ownerDomain: kind === 'DigitalTwin' ? 'digital-twin' : kind === 'Audit' ? 'audit' : kind === 'Recommendation' ? 'ai-governance' : 'operations',
    lifecycleStatus: 'published',
    readOnly: true,
    advisoryOnly: aiOutputKinds.includes(kind),
    operationalMutationAllowed: false,
    autonomousExecutionAllowed: false,
    approvalRequiredForMutation: true,
    auditIds: [`audit:${kind.toLowerCase()}`],
    eventTypes: [`artifact.${kind.toLowerCase()}.published.v1`],
    digitalTwinRefs: kind === 'DigitalTwin' ? ['twin:track:main-track'] : ['twin:race:race-7'],
    evidence: [`evidence:${kind.toLowerCase()}`],
    mock: false,
    ...overrides,
  };
}

function registry() {
  return {
    generatedAt: now,
    schemaVersion: 'trackmind.artifacts.registry.v1',
    readOnly: true,
    executionEndpointsAvailable: false,
    artifactKinds,
    artifacts: artifactKinds.map((kind) => artifact(kind)),
    governance: {
      draftRegistrationOnly: true,
      approvalRequired: true,
      audited: true,
      autonomousExecutionAllowed: false,
      operationalMutationAllowed: false,
    },
    mock: false,
  };
}

test('Universal Artifact registry contract covers all artifact kinds and safety invariants', () => {
  const value = registry();

  assert.deepEqual(validateContract('UniversalArtifactRegistryDto', value, apiContractSchemas.UniversalArtifactRegistryDto), { valid: true, errors: [] });
  assert.deepEqual(value.artifactKinds, artifactKinds);
  assert.equal(new Set(value.artifacts.map((item) => item.kind)).size, artifactKinds.length);

  for (const item of value.artifacts) {
    assert.equal(item.readOnly, true, item.kind);
    assert.equal(item.operationalMutationAllowed, false, item.kind);
    assert.equal(item.autonomousExecutionAllowed, false, item.kind);
    assert.equal(item.approvalRequiredForMutation, true, item.kind);
    assert.ok(item.auditIds.length > 0, `${item.kind} auditIds missing`);
    assert.ok(item.eventTypes.every((eventType) => eventType.endsWith('.v1')), `${item.kind} event version missing`);
    assert.ok(item.digitalTwinRefs.length > 0, `${item.kind} digitalTwinRefs missing`);
  }
});

test('Universal Artifact schema, training, and storage contracts preserve event, audit, and Digital Twin integration', () => {
  const schemas = {
    generatedAt: now,
    schemaVersion: 'trackmind.artifacts.schemas.v1',
    readOnly: true,
    executionEndpointsAvailable: false,
    schemas: artifactKinds.map((kind) => ({
      artifactKind: kind,
      schemaRef: `trackmind.artifact.${kind.toLowerCase()}.v1`,
      version: '1.0.0',
      requiredFields: ['id','kind','schemaRef','auditIds','eventTypes','digitalTwinRefs','evidence'],
      optionalFields: ['advisoryOnly','ownerDomain'],
      eventTypes: [`artifact.${kind.toLowerCase()}.validated.v1`],
      auditActions: [`artifact.${kind.toLowerCase()}.validated`],
      approvalRequiredFor: ['publish','mutate','register-training-use'],
      autonomousExecutionAllowed: false,
    })),
    mock: false,
  };
  const training = {
    generatedAt: now,
    schemaVersion: 'trackmind.artifacts.training-inputs.v1',
    readOnly: true,
    executionEndpointsAvailable: false,
    inputs: aiOutputKinds.map((kind) => ({
      id: `training:${kind.toLowerCase()}`,
      artifactKind: kind,
      sourceArtifactIds: [`artifact:${kind.toLowerCase()}`],
      featureSetId: 'feature-set:surface-risk-v1',
      lineage: ['dataset:surface-readings-v5','model:model-surface-advisor-v2'],
      evidence: [`evidence:${kind.toLowerCase()}`],
      dataClassification: kind === 'Forecast' ? 'internal' : 'restricted',
      allowedUse: ['train','evaluate','explain'],
      prohibitedUse: ['execute-control','mutate-operational-state','autonomous-approval'],
      humanReviewRequired: true,
      retainedInFeatureStore: true,
      mock: false,
    })),
    policy: { noAutonomousExecution: true, humanApprovalRequiredFor: ['training-use','publication','operational-use'], draftOnlyRegistration: true },
    mock: false,
  };
  const storage = {
    generatedAt: now,
    schemaVersion: 'trackmind.artifacts.storage-map.v1',
    readOnly: true,
    executionEndpointsAvailable: false,
    storage: [
      { storeId: 'artifact-registry', artifactKinds, purpose: 'Governed registry metadata.', tenantScoped: true, auditRequired: true, encryptionRequired: true, retentionPolicy: 'regulated-racing-record', writeBoundary: 'backend-governed', operationalMutationAllowed: false },
      { storeId: 'artifact-drafts', artifactKinds: ['Insight','Recommendation','Forecast'], purpose: 'Draft-only AI artifact registration.', tenantScoped: true, auditRequired: true, encryptionRequired: true, retentionPolicy: 'human-review-required', writeBoundary: 'draft-only', operationalMutationAllowed: false },
    ],
    eventAuditMap: artifactKinds.map((kind) => ({ artifactKind: kind, eventTypes: [`artifact.${kind.toLowerCase()}.validated.v1`], auditActions: [`artifact.${kind.toLowerCase()}.validated`], digitalTwinRefs: ['twin:race:race-7'], approvalRefs: ['approval:artifact-review'] })),
    mock: false,
  };

  assert.deepEqual(validateContract('UniversalArtifactSchemaCatalogDto', schemas, apiContractSchemas.UniversalArtifactSchemaCatalogDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('UniversalArtifactTrainingInputsDto', training, apiContractSchemas.UniversalArtifactTrainingInputsDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('UniversalArtifactStorageMapDto', storage, apiContractSchemas.UniversalArtifactStorageMapDto), { valid: true, errors: [] });
  assert.ok(schemas.schemas.every((schema) => schema.autonomousExecutionAllowed === false));
  assert.ok(training.inputs.every((input) => aiOutputKinds.includes(input.artifactKind)));
  assert.ok(training.inputs.every((input) => input.humanReviewRequired && input.prohibitedUse.includes('execute-control')));
  assert.ok(storage.eventAuditMap.every((item) => item.eventTypes.length && item.auditActions.length && item.digitalTwinRefs.length && item.approvalRefs.length));
});

test('Universal Artifact contracts remain backward-compatible with existing AI, audit, and twin DTOs', () => {
  const aiRecommendation = {
    id: 'rec-harrow-7',
    recommendationId: 'rec-harrow-7',
    recommendation: 'Draft a human-approved harrow pass before Race 7.',
    confidence: 0.86,
    evidence: ['surface:moisture=19','sensor-44:warning'],
    modelVersion: 'model-surface-advisor-v2',
    generatedAt: now,
    approvalRequirement: { required: true, policy: 'single-human', requirementId: 'approval-rec-harrow-7', workflowId: 'hitl-rec-harrow-7-1' },
    auditReference: { auditIds: ['audit-ai-1'], eventIds: ['ai.recommendation.created.v1'], digitalTwinRefs: ['twin:sector:far-turn'], approvalReference: 'approval-rec-harrow-7' },
    requiresApproval: true,
    actionPath: '/ai-governance',
    eventId: 'ai.recommendation.created.v1',
    auditId: 'audit-ai-1',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    correlationId: 'corr-ai-facade',
    causationId: 'selection-surface-live-1',
    digitalTwinRefs: ['twin:sector:far-turn'],
    riskLevel: 'high',
    mock: false,
  };
  const twin = {
    twinId: 'twin:sector:far-turn',
    assetId: 'sector:far-turn',
    health: 'degraded',
    version: 7,
    lastUpdatedAt: now,
    state: { approvalState: 'required' },
    mock: false,
  };
  const audit = {
    id: 'audit-ai-1',
    type: 'ai-recommendation',
    actor: 'agent-surface-ops',
    timestamp: now,
    severity: 'warning',
    hash: 'sha256:ai-1',
    previousHash: 'genesis',
    correlationId: 'corr-ai-facade',
    evidenceIds: ['surface:moisture=19'],
    mock: false,
  };

  assert.deepEqual(validateContract('AIRecommendationDto', aiRecommendation, apiContractSchemas.AIRecommendationDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('DigitalTwinStateDto', twin, apiContractSchemas.DigitalTwinStateDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('AuditEventDto', audit, apiContractSchemas.AuditEventDto), { valid: true, errors: [] });
  assert.deepEqual(artifact('Recommendation', { id: aiRecommendation.id, eventTypes: [aiRecommendation.eventId], auditIds: [aiRecommendation.auditId], digitalTwinRefs: aiRecommendation.digitalTwinRefs }).advisoryOnly, true);
});

test('Universal Artifact API endpoint catalog exposes read and draft-only routes with no execution route', () => {
  const endpoints = apiEndpointContracts.filter((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/'));
  const byOperation = new Map(endpoints.map((endpoint) => [endpoint.operationId, endpoint]));

  for (const operationId of [
    'createUniversalArtifactDraftRegistration',
    'getUniversalArtifactRegistry',
    'getUniversalArtifactSchemas',
    'getUniversalArtifactStorageMap',
    'getUniversalArtifactTrainingInputs',
    'listKPIArtifactsByArtifactNamespace',
    'getKPIArtifactByArtifactNamespace',
    'listKPIHistoricalSnapshotsByArtifactNamespace',
    'listModelReadableKPIContextByArtifactNamespace',
  ]) {
    assert.ok(byOperation.has(operationId), `${operationId} missing from artifact endpoint catalog`);
  }
  assert.ok(endpoints.filter((endpoint) => endpoint.method === 'GET').every((endpoint) => endpoint.emits.length === 0 && endpoint.audits.some((audit) => audit.startsWith('artifact.'))));
  assert.equal(byOperation.get('createUniversalArtifactDraftRegistration').method, 'POST');
  assert.ok(byOperation.get('createUniversalArtifactDraftRegistration').emits.includes('approval.requested'));
  assert.ok(byOperation.get('createUniversalArtifactDraftRegistration').audits.includes('artifact.registration.draft.created'));
  assert.ok(!apiEndpointContracts.some((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/') && /execute|publish|mutate/i.test(endpoint.path)));

  const draft = { accepted: true, status: 'draft', draftId: 'draft-artifact-1', artifactId: 'artifact:recommendation', approvalRequired: true, audited: true, eventType: 'artifact.registration.draft.created', executionAllowed: false, operationalMutationAllowed: false, message: 'Draft registration only; human approval required before publication.', mock: false };
  assert.deepEqual(validateContract('UniversalArtifactDraftRegistrationResultDto', draft, apiContractSchemas.UniversalArtifactDraftRegistrationResultDto), { valid: true, errors: [] });
});

test('Universal Artifact AI output boundary allows only Insight, Recommendation, or Forecast artifacts', () => {
  const aiOutputs = [artifact('Insight'), artifact('Recommendation'), artifact('Forecast')];
  const disallowed = [artifact('Workflow'), artifact('Approval'), artifact('DigitalTwin')];

  assert.ok(aiOutputs.every((item) => aiOutputKinds.includes(item.kind) && item.advisoryOnly && !item.autonomousExecutionAllowed));
  assert.ok(disallowed.every((item) => !aiOutputKinds.includes(item.kind)));
  assert.ok(!registry().artifacts.some((item) => /execute|actuator|direct-control/i.test(`${item.kind} ${item.name} ${item.description}`)));
});

{
const now = '2026-06-14T22:00:00.000Z';
const tenant = { tenantId: 'tenant-east', racetrackId: 'track-001', organizationId: 'org-trackmind', dataBoundary: 'racetrack' };
const lineage = {
  sourceSystem: 'trackmind-nexus',
  correlationId: 'corr-uaf-1',
  causationIds: ['evt-source-1'],
  inputArtifactIds: ['artifact-source-1'],
  producedBy: 'worker-02',
};
const subjectRef = { id: 'race-7', type: 'race' };

function artifact(artifactType, payload, overrides = {}) {
  return {
    schemaVersion: universalArtifactSchemaVersion,
    artifactId: `artifact-${artifactType}`,
    artifactType,
    tenant,
    lineage,
    createdAt: now,
    updatedAt: now,
    payload,
    tags: ['universal-artifact-framework'],
    ...overrides,
  };
}

const assetPayload = { assetId: 'asset-camera-1', assetType: 'camera', status: 'online', riskClassification: 'operational' };
const eventPayload = { eventType: 'asset.registry.changed.v1', occurredAt: now, subjectRef, payload: { assetId: 'asset-camera-1' } };
const digitalTwinPayload = { twinId: 'twin:asset:asset-camera-1', modelId: 'asset.camera.v1', sourceArtifactId: 'artifact-asset', state: { health: 'healthy' } };
const telemetryPayload = { sourceId: 'sensor-1', metric: 'moisture', observedAt: now, value: 27.4 };
const workflowPayload = { workflowId: 'workflow-1', state: 'pending-approval', subjectRef, approvalRefs: ['approval-1'] };
const approvalPayload = { approvalId: 'approval-1', status: 'pending-approval', requestedBy: { actorId: 'steward-1' }, evidenceRefs: ['ev-approval'] };
const auditPayload = { auditId: 'audit-1', action: 'asset.updated', actorId: 'asset-service', occurredAt: now, evidenceRefs: ['ev-audit'] };
const compliancePayload = { controlId: 'ctrl-ai-evidence', frameworkIds: ['ISO-42001'], status: 'implemented', evidenceRefs: ['ev-control'] };
const recommendationPayload = { recommendationId: 'rec-1', summary: 'Draft maintenance inspection.', confidence: 0.84, evidenceRefs: ['ev-rec'], advisoryOnly: true };
const investigationPayload = { investigationId: 'inv-1', status: 'open', subjectRef, evidenceRefs: ['ev-investigation'] };
const featurePayload = { featureId: 'feature-1', domain: 'surface', asOf: now, features: { moisture: 27.4, compaction: 271 } };
const insightPayload = { insightId: 'insight-1', summary: 'Far turn moisture is trending up.', confidence: 0.79, evidenceRefs: ['ev-insight'] };
const forecastPayload = { forecastId: 'forecast-1', forecastAt: now, horizon: 'PT2H', predictions: [{ metric: 'surface-risk', value: 'moderate' }], confidence: 0.76 };

test('UAF validates valid canonical artifact envelopes and typed payloads', () => {
  const cases = [
    ['asset', assetPayload, validateAssetArtifact],
    ['event', eventPayload, validateEventArtifact],
    ['digital-twin', digitalTwinPayload, validateDigitalTwinArtifact],
    ['telemetry', telemetryPayload, validateTelemetryArtifact],
    ['workflow', workflowPayload, validateWorkflowArtifact],
    ['approval', approvalPayload, validateApprovalArtifact],
    ['audit', auditPayload, validateAuditArtifact],
    ['compliance', compliancePayload, validateComplianceArtifact],
    ['recommendation', recommendationPayload, validateRecommendationArtifact],
    ['investigation', investigationPayload, validateInvestigationArtifact],
    ['feature', featurePayload, validateFeatureArtifact],
    ['insight', insightPayload, validateInsightArtifact],
    ['forecast', forecastPayload, validateForecastArtifact],
  ];

  assert.deepEqual(universalArtifactTypes, cases.map(([artifactType]) => artifactType));
  for (const [artifactType, payload, validator] of cases) {
    const value = artifact(artifactType, payload);
    assert.deepEqual(validateArtifactEnvelope(value), { valid: true, errors: [] }, `${artifactType} envelope`);
    assert.deepEqual(validator(value), { valid: true, errors: [] }, `${artifactType} artifact`);
  }
});

test('UAF reports missing required typed payload fields', () => {
  const result = validateAssetArtifact(artifact('asset', { assetType: 'camera', status: 'online' }));

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('AssetArtifact.payload.assetId is required'));
});

test('UAF rejects invalid artifactType values', () => {
  const invalid = artifact('not-a-real-artifact', assetPayload);
  const result = validateArtifactEnvelope(invalid);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('ArtifactEnvelope.artifactType must be one of')));
});

test('UAF enforces tenant metadata and backward-compatible top-level tenant aliases', () => {
  const mismatchedTenant = artifact('event', eventPayload, { tenantId: 'tenant-west', racetrackId: 'track-001', correlationId: 'corr-uaf-1' });
  const missingTenantMetadata = artifact('event', eventPayload, { tenant: { tenantId: 'tenant-east' } });

  const mismatchResult = validateEventArtifact(mismatchedTenant);
  assert.equal(mismatchResult.valid, false);
  assert.ok(mismatchResult.errors.includes('ArtifactEnvelope.tenantId must match tenant.tenantId'));

  const missingResult = validateEventArtifact(missingTenantMetadata);
  assert.equal(missingResult.valid, false);
  assert.ok(missingResult.errors.includes('ArtifactEnvelope.tenant.racetrackId is required'));
});

test('UAF enforces lineage metadata arrays and correlation aliases', () => {
  const badLineage = artifact('feature', featurePayload, {
    correlationId: 'corr-legacy-mismatch',
    lineage: {
      ...lineage,
      inputArtifactIds: ['artifact-source-1', 42],
      outputArtifactIds: ['artifact-output-1', false],
    },
  });

  const result = validateFeatureArtifact(badLineage);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('ArtifactEnvelope.correlationId must match lineage.correlationId'));
  assert.ok(result.errors.includes('ArtifactEnvelope.lineage.inputArtifactIds[1] must be string'));
  assert.ok(result.errors.includes('ArtifactEnvelope.lineage.outputArtifactIds[1] must be string'));
});

test('UAF validates registry entries against envelope, payload, and validator contracts', () => {
  const entry = {
    artifactType: 'recommendation',
    schemaVersion: universalArtifactSchemaVersion,
    title: 'Recommendation Artifact',
    requiredEnvelopeFields: ['schemaVersion', 'artifactId', 'artifactType', 'tenant', 'lineage', 'createdAt', 'updatedAt', 'payload'],
    requiredPayloadFields: ['recommendationId', 'summary', 'confidence', 'evidenceRefs', 'advisoryOnly'],
    validator: 'validateRecommendationArtifact',
    backwardCompatibleWith: [],
  };

  assert.deepEqual(validateRegistryEntry(entry), { valid: true, errors: [] });

  const invalid = validateRegistryEntry({ ...entry, validator: 'validateAssetArtifact', requiredPayloadFields: ['recommendationId'] });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('UniversalArtifactRegistryEntry.validator must be validateRecommendationArtifact'));
  assert.ok(invalid.errors.includes('UniversalArtifactRegistryEntry.requiredPayloadFields must include summary'));
});

test('UAF compares schema versions and reports unsupported migrations explicitly', () => {
  const older = compareSchemaVersions('trackmind.uaf.v0', universalArtifactSchemaVersion);
  assert.equal(older.compatibleFamily, true);
  assert.equal(older.order, -1);

  assert.deepEqual(checkArtifactEnvelopeCompatibility(universalArtifactSchemaVersion), {
    compatible: true,
    errors: [],
    supportedSchemaVersions: [universalArtifactSchemaVersion],
  });

  const migration = migrateArtifactEnvelope(artifact('forecast', forecastPayload, { schemaVersion: 'trackmind.uaf.v0' }));
  assert.equal(migration.supported, false);
  assert.equal(migration.fromVersion, 'trackmind.uaf.v0');
  assert.equal(migration.toVersion, universalArtifactSchemaVersion);
  assert.match(migration.reason, /not implemented/);
});

test('UAF artifacts survive serialization round-trip validation', () => {
  const value = artifact('forecast', forecastPayload, { tenantId: 'tenant-east', racetrackId: 'track-001', correlationId: 'corr-uaf-1' });
  const roundTrip = JSON.parse(JSON.stringify(value));

  assert.deepEqual(roundTrip, value);
  assert.deepEqual(validateForecastArtifact(roundTrip), { valid: true, errors: [] });
  assert.deepEqual(migrateArtifactEnvelope(roundTrip), { supported: true, fromVersion: universalArtifactSchemaVersion, toVersion: universalArtifactSchemaVersion, artifact: roundTrip, warnings: [] });
});
}

const canonicalOwner = { ownerId: 'nexus-ops', ownerType: 'department', tenantId: 'tenant-east', racetrackId: 'track-001' };
const canonicalSourceRef = { sourceId: 'source-race-office', sourceType: 'service', system: 'trackmind-nexus', observedAt: now };
const canonicalEvidenceRef = { evidenceId: 'ev-canonical-1', kind: 'observation', capturedAt: now };
const canonicalTwinRef = { twinId: 'twin:race:race-7', modelId: 'race.v1', relationship: 'primary', synchronizedAt: now };
const canonicalAuditRef = { auditId: 'audit-canonical-1', action: 'artifact.created', occurredAt: now };

function canonicalBase(artifactType, overrides = {}) {
  return createArtifactBaseMetadata(artifactType, {
    id: `canonical-${artifactType}`,
    tenantId: 'tenant-east',
    racetrackId: 'track-001',
    owner: canonicalOwner,
    now,
    correlationId: 'corr-canonical-uaf-1',
    causationId: 'cause-canonical-uaf-1',
    sourceRefs: [canonicalSourceRef],
    evidenceRefs: [canonicalEvidenceRef],
    digitalTwinRefs: [canonicalTwinRef],
    auditRefs: [canonicalAuditRef],
    lineage: { parentArtifactIds: ['parent-artifact'], upstreamArtifactIds: ['upstream-artifact'], modelLineageRefs: ['model:readiness:v1'] },
    ...overrides,
  });
}

test('canonical UAF registry exposes schema shape and DTO names for every artifact type', () => {
  assert.equal(trackMindUniversalArtifactFrameworkSchemaVersion, universalArtifactSchemaVersion);
  assert.deepEqual(artifactTypes, universalArtifactTypes);

  for (const artifactType of artifactTypes) {
    const entry = artifactRegistry[artifactType];
    assert.equal(entry.schemaVersion, universalArtifactSchemaVersion);
    assert.ok(entry.dtoName.endsWith('ArtifactDto'));
    for (const field of ['schemaVersion', 'artifactType', 'tenantId', 'owner', 'createdAt', 'updatedAt', 'lineage', 'sourceRefs', 'evidenceRefs', 'correlationId', 'digitalTwinRefs', 'auditRefs']) {
      assert.ok(entry.requiredFields.includes(field), `${artifactType} missing ${field}`);
    }
    assert.ok(entry.rules.some((rule) => rule.path === 'artifactType' && rule.values.includes(artifactType)));
  }
});

test('canonical UAF validates discriminated artifact union members', () => {
  const subjectRefs = [{ id: 'race-7', kind: 'race', tenantId: 'tenant-east', racetrackId: 'track-001' }];
  const artifacts = [
    { ...canonicalBase('asset'), assetId: 'asset-camera-1', assetType: 'camera', assetCategory: 'physical', displayName: 'Camera 1', state: { health: 'healthy' }, risk: { level: 'low', safetyCritical: false, drivers: [] }, telemetryRefs: ['telemetry-camera-1'] },
    { ...canonicalBase('event'), eventId: 'event-1', eventType: 'asset.registry.changed.v1', occurredAt: now, producer: 'asset-service', severity: 'info', subjectRefs, payload: { assetId: 'asset-camera-1' } },
    { ...canonicalBase('digital-twin'), twinId: 'twin:asset:asset-camera-1', twinType: 'asset', modelId: 'asset.camera.v1', sourceEntityRefs: subjectRefs, state: { health: 'healthy' }, relationships: [] },
    { ...canonicalBase('telemetry'), telemetryId: 'telemetry-1', streamId: 'surface-stream', observedAt: now, metric: 'moisture', value: 27.4, quality: { score: 0.98, flags: [] }, subjectRefs },
    { ...canonicalBase('workflow'), workflowId: 'workflow-1', workflowType: 'race-start', workflowState: 'pending-approval', subjectRefs, stepRefs: [{ stepId: 'request', state: 'complete' }], approvalRefs: ['approval-1'] },
    { ...canonicalBase('approval'), approvalId: 'approval-1', protectedAction: 'race-start', approvalStatus: 'approved', targetRefs: subjectRefs, requestedBy: canonicalOwner, approverRefs: [canonicalOwner] },
    { ...canonicalBase('audit'), auditId: 'audit-1', action: 'workflow.created', actor: canonicalOwner, targetRefs: subjectRefs, occurredAt: now, severity: 'info' },
    { ...canonicalBase('compliance', { racetrackId: undefined, owner: { ownerId: 'compliance', ownerType: 'department', tenantId: 'tenant-east' } }), complianceId: 'compliance-1', frameworkIds: ['ISO-42001'], controlIds: ['ctrl-1'], obligationRefs: subjectRefs, complianceStatus: 'implemented', complianceOwner: canonicalOwner },
    { ...canonicalBase('recommendation'), recommendationId: 'rec-1', activity: 'create-draft-action', targetRefs: subjectRefs, recommendation: 'Draft race-start request.', confidence: 0.82, riskLevel: 'medium', advisoryOnly: true, requestedAction: 'race-start', modelLineageRefs: ['model:readiness:v1'] },
    { ...canonicalBase('investigation'), investigationId: 'inv-1', investigationType: 'steward-inquiry', investigationStatus: 'open', openedAt: now, leadOwner: canonicalOwner, subjectRefs, findingRefs: [] },
    { ...canonicalBase('feature'), featureId: 'feature-1', featureDomain: 'surface', asOf: now, features: { moisture: 27.4 }, scores: { surfaceRisk: 0.2 }, quality: { score: 0.95, missingFields: [], stale: false } },
    { ...canonicalBase('insight'), insightId: 'insight-1', generatedAt: now, subjectRefs, summary: 'Surface risk is stable.', confidence: 0.8, severity: 'info', drivers: ['fresh telemetry'], recommendationRefs: ['rec-1'] },
    { ...canonicalBase('forecast'), forecastId: 'forecast-1', forecastAt: now, horizon: { value: 2, unit: 'hours' }, subjectRefs, predictions: { surfaceRisk: 'moderate' }, confidence: 0.76, modelLineageRefs: ['model:surface:v1'] },
  ];

  for (const value of artifacts) assert.deepEqual(validateArtifact(value), { valid: true, errors: [] }, value.artifactType);
  assert.deepEqual(validateArtifactSet(artifacts), { valid: true, errors: [] });
  assert.equal(isArtifact(artifacts[8]), true);
  assert.equal(isArtifactOfType(artifacts[8], 'recommendation'), true);
  assert.equal(isArtifactOfType(artifacts[8], 'forecast'), false);
});

test('canonical UAF serialization helpers reject non-JSON artifact shapes', () => {
  const forecast = {
    ...canonicalBase('forecast'),
    forecastId: 'forecast-serialization',
    forecastAt: now,
    horizon: { value: 2, unit: 'hours' },
    subjectRefs: [{ id: 'race-7', kind: 'race', tenantId: 'tenant-east', racetrackId: 'track-001' }],
    predictions: { surfaceRisk: 'moderate' },
    confidence: 0.76,
    modelLineageRefs: ['model:surface:v1'],
  };

  const payload = serializeArtifact(forecast);
  assert.deepEqual(deserializeArtifact(payload), forecast);

  const unsafe = { ...forecast, predictions: { generatedAt: new Date(now) } };
  assert.equal(validateArtifact(unsafe).valid, false);
  assert.throws(() => serializeArtifact(unsafe), /JSON-serializable/);
});
