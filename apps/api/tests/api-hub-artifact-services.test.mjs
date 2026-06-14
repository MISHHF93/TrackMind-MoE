import assert from 'node:assert/strict';
import test from 'node:test';
import { DataQualityService, LineageService, UniversalArtifactRegistryService } from '../dist/index.js';

const now = '2026-06-14T22:00:00.000Z';
const principal = { id: 'api-hub-worker-09', tenantId: 'tenant-a', racetrackId: 'main-track', scopes: ['artifacts:read', 'artifacts:write'], actorType: 'service' };

function raceArtifact(overrides = {}) {
  const metadata = {
    domain: 'race',
    raceId: 'race-7',
    canonicalRaceId: 'race:main-track:2026-06-14:7',
    raceDate: '2026-06-14',
    distanceMeters: 1609.34,
    sourceDistance: { value: 8, unit: 'furlongs' },
    rawPayloadId: 'raw-provider-race-7',
    sourcePayloadPreserved: true,
    providerRefs: ['provider:equibase', 'provider:trackmaster'],
    transformations: ['normalize-distance-unit', 'resolve-horse-identity', 'map-provider-condition-code'],
    eventRefs: ['evt-race-canonicalized'],
    auditRefs: ['audit-race-canonicalized'],
    twinRefs: ['twin:race:race-7'],
    featureRefs: ['feature:race-readiness-v1'],
    licensePolicy: { checked: true, exportAllowed: true, restrictions: [], attributionRequired: true, policyRef: 'license:api-hub-standard' },
    horseIdentityResolved: true,
    horseIdentity: { resolved: true, confidence: 0.98 },
    entries: [
      { entryId: 'entry-1', horseId: 'horse-001', canonicalHorseId: 'horse:canonical:001', programNumber: '1', postPosition: 1 },
      { entryId: 'entry-2', horseId: 'horse-002', canonicalHorseId: 'horse:canonical:002', programNumber: '2', postPosition: 2 },
    ],
    ...(overrides.metadata ?? {}),
  };
  return {
    artifactId: overrides.artifactId ?? 'ART-CANONICAL-RACE-7',
    artifactType: overrides.artifactType ?? 'canonical-race',
    schemaVersion: overrides.schemaVersion ?? 'trackmind.api-hub.canonical-race.v1',
    owner: overrides.owner ?? 'ApiHub',
    source: overrides.source ?? { system: 'provider-ingestion', id: 'provider-race-7', type: 'provider-payload', eventId: 'evt-provider-race-7', metadata: { providerRefs: ['provider:equibase'] } },
    lineage: overrides.lineage ?? { parentArtifactIds: ['ART-RAW-RACE-7'], sourceEventIds: ['evt-provider-race-7'], sourceAuditIds: ['audit-provider-race-7'], relatedTwinIds: ['twin:race:race-7'] },
    evidence: overrides.evidence ?? [{ id: 'ev-race-7-payload', uri: 'lakehouse://raw/provider-race-7.json', hash: 'sha256:raw-race-7' }],
    storageRefs: overrides.storageRefs ?? [{ id: 'raw-race-7-json', uri: 'lakehouse://raw/provider-race-7.json', provider: 'lakehouse', contentType: 'application/json' }],
    metadata,
  };
}

async function registeredRaceArtifact(overrides = {}) {
  const registry = new UniversalArtifactRegistryService();
  return registry.register(raceArtifact(overrides), principal, { correlationId: `corr-${overrides.artifactId ?? 'quality'}` });
}

test('Data Quality Service scores high, medium, and low API Hub artifacts', async () => {
  const quality = new DataQualityService();
  const high = quality.assess(await registeredRaceArtifact({ artifactId: 'ART-QUALITY-HIGH' }), { generatedAt: now });
  const medium = quality.assess(await registeredRaceArtifact({
    artifactId: 'ART-QUALITY-MEDIUM',
    metadata: { distanceMeters: undefined, distanceFurlongs: 8, rawPayloadId: undefined, sourcePayloadPreserved: false },
  }), { generatedAt: now });
  const low = quality.assess(await registeredRaceArtifact({
    artifactId: 'ART-QUALITY-LOW',
    metadata: { raceDate: undefined, entries: [], distanceMeters: undefined, rawPayloadId: undefined, sourcePayloadPreserved: false, horseIdentityResolved: false, licensePolicy: { checked: false, exportAllowed: true, restrictions: [] } },
  }), { generatedAt: now });

  assert.equal(high.band, 'high');
  assert.equal(high.exportReadiness, 'ready');
  assert.equal(high.checks.required_fields_present.passed, true);
  assert.equal(high.checks.distance_unit_normalized.passed, true);
  assert.equal(high.checks.provider_attribution_present.passed, true);

  assert.equal(medium.band, 'medium');
  assert.equal(medium.exportReadiness, 'review');
  assert.equal(medium.checks.distance_unit_normalized.score, 50);
  assert.equal(medium.checks.source_payload_preserved.passed, false);

  assert.equal(low.band, 'low');
  assert.equal(low.exportReadiness, 'restricted');
  assert.equal(low.checks.horse_identity_resolved.score, 0);
  assert.ok(low.missingFields.includes('metadata.raceDate'));
});

test('Data Quality Service reports failed horse identity resolution', async () => {
  const artifact = await registeredRaceArtifact({
    artifactId: 'ART-IDENTITY-FAILED',
    metadata: {
      horseIdentityResolved: false,
      horseIdentity: { resolved: false, confidence: 0.21 },
      unresolvedHorseIds: ['provider-horse-temp-42'],
      entries: [{ entryId: 'entry-unresolved', horseId: '', unresolved: true, programNumber: '9', postPosition: 9 }],
    },
  });
  const report = new DataQualityService().assess(artifact, { generatedAt: now });

  assert.equal(report.checks.horse_identity_resolved.score, 0);
  assert.equal(report.horseIdentity.resolved, false);
  assert.ok(report.horseIdentity.unresolvedEntries.includes('provider-horse-temp-42'));
  assert.ok(report.issues.some((issue) => /Horse identity resolution failed/.test(issue)));
});

test('Data Quality Service lowers export readiness for license restrictions', async () => {
  const artifact = await registeredRaceArtifact({
    artifactId: 'ART-LICENSE-RESTRICTED',
    metadata: { licensePolicy: { checked: true, exportAllowed: false, restrictions: ['no-external-export'], attributionRequired: true, policyRef: 'license:restricted-provider' } },
  });
  const report = new DataQualityService().assess(artifact, { generatedAt: now });

  assert.equal(report.band, 'high');
  assert.equal(report.checks.license_policy_checked.passed, true);
  assert.equal(report.licensePolicy.exportAllowed, false);
  assert.deepEqual(report.licensePolicy.restrictions, ['no-external-export']);
  assert.equal(report.exportReadiness, 'restricted');
});

test('Lineage Service returns raw payload to canonical race to feature to audit graph', async () => {
  const registry = new UniversalArtifactRegistryService();
  await registry.register({
    artifactId: 'ART-RAW-RACE-7',
    artifactType: 'raw-provider-payload',
    schemaVersion: 'trackmind.api-hub.raw-payload.v1',
    owner: 'ApiHub',
    source: { system: 'provider-feed', id: 'raw-provider-race-7', type: 'raw-payload', eventId: 'evt-provider-race-7', metadata: { providerRefs: ['provider:equibase'] } },
    evidence: [{ id: 'ev-raw-race-7', uri: 'lakehouse://raw/provider-race-7.json', hash: 'sha256:raw-race-7' }],
    storageRefs: [{ id: 'raw-race-7-json', uri: 'lakehouse://raw/provider-race-7.json', provider: 'lakehouse' }],
    metadata: { rawPayloadId: 'raw-provider-race-7', sourcePayloadPreserved: true, providerRefs: ['provider:equibase'], licensePolicy: { checked: true, exportAllowed: true, restrictions: [] } },
  }, principal);
  await registry.register(raceArtifact(), principal);
  await registry.register({
    artifactId: 'ART-FEATURE-RACE-7',
    artifactType: 'feature-record',
    schemaVersion: 'trackmind.feature-store.v1',
    owner: 'FeatureStore',
    source: { system: 'feature-store', id: 'feature:race-readiness-v1', type: 'feature-record', auditRef: 'audit-feature-race-7' },
    lineage: { parentArtifactIds: ['ART-CANONICAL-RACE-7'], sourceEventIds: ['evt-feature-race-7'], sourceAuditIds: ['audit-feature-race-7'], relatedTwinIds: ['twin:race:race-7'] },
    metadata: { domain: 'feature', featureSetId: 'race-readiness-v1', featureRefs: ['feature:race-readiness-v1'], transformations: ['build-feature-record'], features: { readinessScore: 0.92 }, auditRefs: ['audit-feature-race-7'] },
  }, principal);
  await registry.register({
    artifactId: 'ART-AUDIT-RACE-7',
    artifactType: 'audit',
    schemaVersion: 'trackmind.audit-artifact.v1',
    owner: 'AuditLedger',
    source: { system: 'audit-ledger', id: 'audit-race-canonicalized', type: 'audit-record', auditRef: 'audit-race-canonicalized' },
    lineage: { parentArtifactIds: ['ART-FEATURE-RACE-7'], sourceAuditIds: ['audit-race-canonicalized'], relatedTwinIds: ['twin:race:race-7'] },
    metadata: { auditRefs: ['audit-race-canonicalized'], transformations: ['seal-audit-evidence'] },
  }, principal);

  const lineage = new LineageService(registry).lookup('ART-CANONICAL-RACE-7', principal, now);
  const edgeKeys = lineage.graph.edges.map((edge) => `${edge.from}->${edge.to}:${edge.relationship}`);

  assert.equal(lineage.rawPayloadId, 'raw-provider-race-7');
  assert.ok(lineage.sourceArtifacts.some((artifact) => artifact.artifactId === 'ART-RAW-RACE-7'));
  assert.ok(lineage.providerRefs.includes('provider:equibase'));
  assert.ok(lineage.transformations.includes('normalize-distance-unit'));
  assert.ok(lineage.transformations.includes('build-feature-record'));
  assert.ok(lineage.eventRefs.includes('evt-race-canonicalized'));
  assert.ok(lineage.auditRefs.includes('audit-race-canonicalized'));
  assert.ok(lineage.twinRefs.includes('twin:race:race-7'));
  assert.ok(lineage.featureRefs.includes('ART-FEATURE-RACE-7'));
  assert.ok(lineage.featureRefs.includes('race-readiness-v1'));
  assert.ok(edgeKeys.includes('ART-RAW-RACE-7->ART-CANONICAL-RACE-7:parentArtifact'));
  assert.ok(edgeKeys.includes('ART-CANONICAL-RACE-7->ART-FEATURE-RACE-7:parentArtifact'));
  assert.ok(edgeKeys.includes('ART-FEATURE-RACE-7->ART-AUDIT-RACE-7:parentArtifact'));
});
