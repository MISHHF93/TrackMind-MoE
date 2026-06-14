import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanonicalApiHubSourceArtifacts,
  createDataLakeExportManifest,
  createFeatureStoreExportManifest,
  createLicenseRestrictedSourceArtifact,
  createTrainingDatasetManifest,
} from '../dist/index.js';

const scope = {
  tenantId: 'tenant-001',
  racetrackId: 'track-main',
  jurisdiction: 'NY',
  generatedAt: '2026-06-14T12:00:00.000Z',
  correlationId: 'corr-api-hub-export-test',
  causationIds: ['api-hub-worker-10-test'],
};

test('allowed feature export emits FeatureRecord artifacts and metadata-only feature store targets', () => {
  const manifest = createFeatureStoreExportManifest({ scope });

  assert.equal(manifest.status, 'ready');
  assert.equal(manifest.noCloudUpload, true);
  assert.equal(manifest.allowedUseDecision.allowed, true);
  assert.deepEqual(new Set(manifest.featureRecords.map((record) => record.metadata.domain)), new Set(['surface', 'weather', 'gate', 'race']));
  assert.ok(manifest.featureRecords.every((record) => record.schemaVersion === 'trackmind.feature-store.v1'));
  assert.ok(manifest.featureArtifacts.every((artifact) => artifact.artifactClass === 'Feature' && artifact.trainingUse === 'not-eligible'));
  assert.ok(manifest.storageTargetDescriptors.every((target) => target.storeKind === 'feature-store' && target.cloudUploadImplemented === false));
  assert.ok(manifest.partitionKeys.includes('tenantId'));
  assert.ok(manifest.partitionKeys.includes('racetrackId'));
  assert.ok(manifest.licenseRestrictions.includes('redistribution-not-allowed'));
  assert.ok(manifest.auditRefs.length > 0);
  assert.ok(manifest.eventRefs.length > 0);
});

test('unlicensed source artifacts block model training manifest generation', () => {
  const sources = createCanonicalApiHubSourceArtifacts(scope);
  const restricted = createLicenseRestrictedSourceArtifact(scope);
  const unlicensed = {
    ...restricted,
    license: {
      ...restricted.license,
      licenseStatus: 'revoked',
    },
  };
  const manifest = createTrainingDatasetManifest({ scope, sourceArtifacts: [...sources, unlicensed] });

  assert.equal(manifest.status, 'blocked');
  assert.equal(manifest.trainingAllowed, false);
  assert.match(manifest.blockedReasons.join(' '), /revoked/);
  assert.match(manifest.blockedReasons.join(' '), /model-training/);
  assert.ok(manifest.sourceArtifacts.some((artifact) => artifact.artifactId === unlicensed.envelopeId));
  assert.ok(manifest.licenseRestrictions.includes('terms:terms://vendor-sectional-times/no-ai-training'));
});

test('training manifest preserves source artifacts time range privacy and lineage', () => {
  const manifest = createTrainingDatasetManifest({ scope });

  assert.equal(manifest.status, 'ready');
  assert.equal(manifest.trainingAllowed, true);
  assert.equal(manifest.sourceArtifacts.length, 3);
  assert.equal(manifest.timeRange.start, '2026-06-14T08:00:00.000Z');
  assert.equal(manifest.timeRange.end, scope.generatedAt);
  assert.ok(['restricted', 'regulated'].includes(manifest.privacy.classification));
  assert.equal(manifest.privacy.containsSensitiveTelemetry, true);
  assert.ok(manifest.featureRecordIds.length >= 4);
  assert.ok(manifest.lineage.featureRecordIds.length >= 4);
  assert.ok(manifest.lineage.auditIds.length > 0);
  assert.ok(manifest.lineage.eventIds.length > 0);
});

test('data lake export returns descriptor-only storage target metadata', () => {
  const manifest = createDataLakeExportManifest({ scope });

  assert.equal(manifest.status, 'ready');
  assert.equal(manifest.noCloudUpload, true);
  assert.equal(manifest.storageTargets.length, 1);
  assert.equal(manifest.storageTargets[0].storeKind, 'data-lake');
  assert.equal(manifest.storageTargets[0].executionEndpointPaths.length, 0);
  assert.equal(manifest.storageTargetDescriptors[0].targetStoreId, 'artifact-store:data-lake:regulated-archive');
  assert.equal(manifest.storageTargetDescriptors[0].cloudUploadImplemented, false);
  assert.ok(manifest.storageTargetDescriptors[0].targetPathTemplate.includes('lake/'));
  assert.ok(manifest.partitionKeys.includes('artifactType'));
  assert.ok(manifest.artifactIds.some((artifactId) => artifactId.startsWith('feature:')));
});
