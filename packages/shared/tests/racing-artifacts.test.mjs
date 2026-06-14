import test from 'node:test';
import assert from 'node:assert/strict';
import {
  racingArtifactKinds,
  racingArtifactSchemaVersion,
  racingArtifactSchemas,
  validateRacingArtifact,
  isRacingArtifact,
  serializeRacingArtifact,
  deserializeRacingArtifact,
  toUniversalArtifactEnvelope,
} from '../dist/racingArtifacts.js';
import {
  validateArtifactEnvelope,
  validateAssetArtifact,
  validateAuditArtifact,
  validateComplianceArtifact,
  validateEventArtifact,
  validateFeatureArtifact,
  validateInsightArtifact,
  validateTelemetryArtifact,
} from '../dist/index.js';

const now = '2026-06-14T22:40:00.000Z';

function base(kind, artifactId, overrides = {}) {
  return {
    artifactId,
    kind,
    schemaVersion: racingArtifactSchemaVersion,
    scope: {
      tenantId: 'tenant-east',
      racetrackId: 'track-main',
      organizationId: 'operator-1',
      jurisdiction: 'US-MD',
      meetId: 'meet-summer-2026',
      raceDate: '2026-06-14',
    },
    providerRefs: [{
      provider: 'provider-alpha',
      providerRecordId: `${artifactId}:provider`,
      providerEntityType: kind,
      observedAt: now,
      checksum: `sha256:${artifactId}`,
    }],
    source: {
      system: 'provider-alpha-feed',
      channel: 'api',
      feedName: 'racing-data-api-hub',
      ingestedAt: now,
      receivedAt: now,
      stewardedBy: 'data-steward-1',
    },
    provenance: {
      capturedAt: now,
      normalizedBy: 'racing-data-api-hub-worker-02',
      transformRefs: [`mapping:${kind}:v1`],
      confidence: 0.98,
    },
    licenseContext: {
      licenseId: 'license-provider-alpha-2026',
      provider: 'provider-alpha',
      rights: ['internal-use', 'analytics'],
      restrictions: ['no-redistribution'],
      permittedUses: ['race-day-operations', 'model-training-with-policy'],
      attribution: 'Provider Alpha',
    },
    lineage: {
      parentArtifactIds: ['artifact-raw-provider-payload-1'],
      upstreamArtifactIds: ['provider-alpha:feed:entries'],
      derivedFromArtifactIds: [],
      transformationRefs: [`mapping:${kind}:v1`],
      modelLineageRefs: [],
    },
    privacyClassification: 'regulated',
    evidence: [{
      evidenceId: `evidence:${artifactId}`,
      kind: 'provider-record',
      label: `${kind} provider record`,
      capturedAt: now,
      hash: `sha256:${artifactId}:evidence`,
    }],
    refs: {
      eventIds: [`racing.${kind}.observed.v1`],
      auditIds: [`audit:${artifactId}`],
      digitalTwinRefs: [`twin:track-main:${artifactId}`],
    },
    createdAt: now,
    updatedAt: now,
    correlationId: 'corr-racing-artifacts-1',
    dataUsagePolicyId: 'policy-racing-data-v1',
    tags: ['canonical-racing-artifact'],
    ...overrides,
  };
}

const examples = [
  {
    ...base('raw-provider-payload', 'artifact-raw-provider-payload-1', { lineage: { ...base('raw-provider-payload', 'tmp').lineage, parentArtifactIds: [] } }),
    payloadId: 'raw-provider-payload-1',
    provider: 'provider-alpha',
    contentType: 'application/json',
    payload: { records: [{ raceId: 'race-7', horseId: 'horse-1' }] },
    receivedAt: now,
    normalizedArtifactIds: ['artifact-race-7', 'artifact-entry-1'],
  },
  {
    ...base('race-card', 'artifact-race-card-2026-06-14'),
    raceCardId: 'race-card-2026-06-14',
    raceDate: '2026-06-14',
    trackCode: 'TM',
    races: [{ raceId: 'race-7', raceNumber: 7, scheduledPostTime: '2026-06-14T21:00:00.000Z', status: 'scheduled' }],
  },
  {
    ...base('race', 'artifact-race-7'),
    raceId: 'race-7',
    raceCardId: 'race-card-2026-06-14',
    raceNumber: 7,
    scheduledPostTime: '2026-06-14T21:00:00.000Z',
    distanceFurlongs: 8,
    surface: 'dirt',
    status: 'scheduled',
    entryIds: ['entry-1'],
  },
  {
    ...base('race-entry', 'artifact-entry-1'),
    entryId: 'entry-1',
    raceId: 'race-7',
    horseId: 'horse-1',
    trainerId: 'trainer-1',
    jockeyId: 'jockey-1',
    ownerIds: ['owner-1'],
    programNumber: '1',
    postPosition: 1,
    medicationFlags: ['lasix-declared'],
    equipmentFlags: ['blinkers'],
    status: 'entered',
  },
  {
    ...base('race-result', 'artifact-result-race-7'),
    resultId: 'result-race-7',
    raceId: 'race-7',
    official: true,
    postedAt: '2026-06-14T21:06:00.000Z',
    finishOrder: [{ entryId: 'entry-1', horseId: 'horse-1', position: 1, beatenLengths: 0 }],
    payouts: [{ wagerType: 'win', amount: 4.2, currency: 'USD' }],
  },
  {
    ...base('horse-identity', 'artifact-horse-1'),
    horseId: 'horse-1',
    registeredName: 'Canonical Runner',
    registrationNumber: 'TB-001',
    microchipId: '985141001',
    foaledOn: '2021-04-01',
    sex: 'gelding',
    color: 'bay',
    sireName: 'Sire One',
    damName: 'Dam One',
    identityStatus: 'active',
  },
  {
    ...base('person-identity', 'artifact-jockey-1'),
    personId: 'jockey-1',
    displayName: 'Sam Rivera',
    legalName: 'Samuel Rivera',
    roles: ['jockey'],
    licenseRefs: [{ licenseNumber: 'J-100', jurisdiction: 'US-MD', role: 'jockey', status: 'active' }],
    identityStatus: 'active',
  },
  {
    ...base('workout', 'artifact-workout-1'),
    workoutId: 'workout-1',
    horseId: 'horse-1',
    workedAt: '2026-06-10T12:00:00.000Z',
    distanceFurlongs: 4,
    surface: 'dirt',
    timeSeconds: 48.2,
    rank: '2/18',
    notes: 'Breezing',
  },
  {
    ...base('past-performance', 'artifact-past-performance-1'),
    performanceId: 'past-performance-1',
    horseId: 'horse-1',
    raceId: 'race-previous-1',
    raceDate: '2026-05-20',
    finishPosition: 2,
    speedFigure: 88,
    classRating: 92,
    trackCondition: 'fast',
    comments: ['stalked pace', 'finished well'],
  },
  {
    ...base('surface-condition', 'artifact-surface-condition-1'),
    conditionId: 'surface-condition-1',
    observedAt: '2026-06-14T20:30:00.000Z',
    surface: 'dirt',
    condition: 'fast',
    moisturePct: 18,
    compactionPsi: 276,
    cushionDepthInches: 3,
    weatherRefs: ['weather-observation-1'],
  },
  {
    ...base('steward-ruling', 'artifact-steward-ruling-1'),
    rulingId: 'steward-ruling-1',
    raceId: 'race-7',
    subjectRefs: [{ subjectId: 'entry-1', subjectType: 'entry' }],
    rulingType: 'inquiry',
    status: 'official',
    issuedAt: '2026-06-14T21:10:00.000Z',
    ruleRefs: ['md-rule-4035'],
    summary: 'Inquiry reviewed and result made official by human stewards.',
  },
  {
    ...base('regulatory-record', 'artifact-regulatory-record-1'),
    regulatoryRecordId: 'regulatory-record-1',
    authority: 'Maryland Racing Commission',
    jurisdiction: 'US-MD',
    recordType: 'license',
    subjectRef: { subjectId: 'jockey-1', subjectType: 'person' },
    status: 'active',
    effectiveAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  {
    ...base('entity-resolution-decision', 'artifact-resolution-1'),
    decisionId: 'resolution-1',
    entityType: 'horse',
    candidateRefs: ['provider-alpha:horse:001', 'trackmind:horse:horse-1'],
    resolvedEntityId: 'horse-1',
    decision: 'match',
    confidence: 0.96,
    decidedBy: 'service',
    rationale: 'Registration number and microchip match.',
  },
  {
    ...base('data-quality-report', 'artifact-data-quality-1'),
    reportId: 'data-quality-1',
    subjectArtifactIds: ['artifact-race-7', 'artifact-entry-1'],
    generatedAt: now,
    qualityScore: 0.94,
    dimensions: [{ name: 'completeness', score: 0.98, findings: [] }, { name: 'license', score: 0.9, findings: ['attribution required'] }],
    blockingIssues: [],
  },
  {
    ...base('data-usage-policy', 'artifact-data-usage-policy-1'),
    policyId: 'policy-racing-data-v1',
    appliesToArtifactKinds: ['raw-provider-payload', 'race-card', 'race', 'race-entry', 'feature-record'],
    allowedUses: ['race-day-operations', 'analytics', 'model-training-with-policy'],
    prohibitedUses: ['unlicensed-redistribution', 'cross-tenant-raw-join'],
    retention: { retentionPolicy: 'regulated-racing-record', legalHold: false },
    privacyRules: [{ classification: 'regulated', controls: ['tenant-isolation', 'audit-required', 'license-check'] }],
    attributionRequired: true,
  },
  {
    ...base('feature-record', 'artifact-feature-race-7'),
    featureRecordId: 'feature-record-race-7',
    featureId: 'feature-race-readiness',
    domain: 'race',
    entityRef: { entityId: 'race-7', entityType: 'race' },
    asOf: now,
    features: { entries: 8, scratches: 1, surface: 'dirt', officialSurfaceFast: true },
    scores: { dataQuality: 0.94, readiness: 0.86 },
    quality: { score: 0.94, missingFields: [], stale: false },
  },
  {
    ...base('training-dataset-manifest', 'artifact-training-dataset-manifest-1'),
    manifestId: 'training-dataset-manifest-1',
    datasetId: 'racing-readiness-training',
    datasetVersion: '2026.06.14',
    generatedAt: now,
    artifactIds: ['artifact-race-7', 'artifact-entry-1', 'artifact-feature-race-7'],
    featureRecordIds: ['feature-record-race-7'],
    labelDefinition: 'Human-approved official readiness outcome.',
    splitStrategy: 'time-based-by-race-date',
    permittedTrainingUses: ['race-readiness-model', 'data-quality-model'],
    excludedArtifactIds: [],
  },
];

const validatorsByUafType = {
  asset: validateAssetArtifact,
  event: validateEventArtifact,
  telemetry: validateTelemetryArtifact,
  audit: validateAuditArtifact,
  compliance: validateComplianceArtifact,
  feature: validateFeatureArtifact,
  insight: validateInsightArtifact,
};

test('canonical racing artifact schemas cover every requested DTO', () => {
  assert.deepEqual(Object.keys(racingArtifactSchemas), [...racingArtifactKinds]);
  assert.equal(examples.length, racingArtifactKinds.length);
  for (const kind of racingArtifactKinds) {
    assert.ok(examples.some((artifact) => artifact.kind === kind), `${kind} example missing`);
    assert.equal(racingArtifactSchemas[kind].schemaVersion, racingArtifactSchemaVersion);
    assert.ok(racingArtifactSchemas[kind].requiredFields.includes('providerRefs'));
    assert.ok(racingArtifactSchemas[kind].requiredFields.includes('licenseContext'));
    assert.ok(racingArtifactSchemas[kind].requiredFields.includes('privacyClassification'));
  }
});

test('canonical racing artifact examples validate and map into UAF envelopes', () => {
  for (const artifact of examples) {
    assert.deepEqual(validateRacingArtifact(artifact), { valid: true, errors: [] }, artifact.kind);
    assert.equal(isRacingArtifact(artifact), true, artifact.kind);

    const envelope = toUniversalArtifactEnvelope(artifact);
    assert.deepEqual(validateArtifactEnvelope(envelope), { valid: true, errors: [] }, `${artifact.kind} envelope`);
    const typedValidator = validatorsByUafType[envelope.artifactType];
    assert.deepEqual(typedValidator(envelope), { valid: true, errors: [] }, `${artifact.kind} typed UAF`);
    assert.equal(envelope.tenantId, artifact.scope.tenantId);
    assert.equal(envelope.racetrackId, artifact.scope.racetrackId);
    assert.equal(envelope.correlationId, artifact.correlationId);
  }
});

test('racing artifacts serialize without metadata loss and accept matching legacy aliases', () => {
  const feature = examples.find((artifact) => artifact.kind === 'feature-record');
  const serialized = serializeRacingArtifact(feature);
  const roundTrip = deserializeRacingArtifact(serialized);

  assert.deepEqual(roundTrip, feature);
  assert.deepEqual(JSON.parse(JSON.stringify(roundTrip)), feature);

  const aliased = { ...feature, tenantId: feature.scope.tenantId, racetrackId: feature.scope.racetrackId };
  assert.deepEqual(validateRacingArtifact(aliased), { valid: true, errors: [] });

  const mismatched = { ...aliased, tenantId: 'tenant-west' };
  const result = validateRacingArtifact(mismatched);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('FeatureRecord.tenantId must match scope.tenantId'));
});

test('racing artifact DTOs do not expose autonomous execution fields', () => {
  for (const artifact of examples) {
    const paths = collectPropertyPaths(artifact);
    assert.ok(paths.every((path) => !/autonomous|execution/i.test(path)), artifact.kind);
  }
});

function collectPropertyPaths(value, prefix = '') {
  if (Array.isArray(value)) return value.flatMap((item, index) => collectPropertyPaths(item, `${prefix}[${index}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...collectPropertyPaths(child, path)];
  });
}
