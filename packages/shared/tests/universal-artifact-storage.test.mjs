import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateUniversalArtifactGraph,
  listUniversalArtifactStorageAdapters,
  routeUniversalArtifactToStores,
  serializeUniversalArtifactDescriptor,
  universalArtifactStorageArtifactTypes,
  universalArtifactStoreKinds,
  validateUniversalArtifactStorageAdapters,
} from '../dist/index.js';

const privacy = {
  classification: 'regulated',
  containsPii: true,
  containsProtectedHealthInfo: false,
  containsFinancialData: false,
  containsCredentialData: false,
  containsSensitiveTelemetry: true,
  restrictedFields: ['horseId', 'rawTelemetry'],
  redactionRequired: true,
};

function artifact(artifactType, overrides = {}) {
  return {
    artifactId: `${artifactType}:sample`,
    artifactType,
    tenantId: 'tenant-main-track',
    racetrackId: 'main-track',
    displayName: `${artifactType} sample`,
    sourceSystem: 'trackmind-nexus-tests',
    sourceUri: `urn:trackmind:test:${artifactType}`,
    payloadShape: {
      schemaRef: `trackmind.artifact.${artifactType}.v1`,
      recordType: artifactType,
      fields: ['id', 'tenantId', 'racetrackId'],
      descriptorOnly: true,
    },
    references: {},
    lineage: {
      upstreamArtifactIds: [],
      downstreamArtifactIds: [],
      eventIds: [],
      auditIds: [],
      twinIds: [],
      featureRecordIds: [],
      approvalIds: [],
      evidenceIds: [`evidence:${artifactType}`],
      sourceSystems: ['trackmind-nexus-tests'],
      correlationId: 'corr-universal-artifact-storage',
    },
    privacy,
    complianceFrameworks: ['SOC-2', 'HISA'],
    ...overrides,
  };
}

test('Universal Artifact storage adapters cover all read-only store targets', () => {
  const adapters = listUniversalArtifactStorageAdapters();

  assert.deepEqual(validateUniversalArtifactStorageAdapters(adapters), { valid: true, errors: [] });
  assert.deepEqual(new Set(adapters.map((adapter) => adapter.storeKind)), new Set(universalArtifactStoreKinds));
  assert.ok(adapters.some((adapter) => adapter.storeKind === 'document-store'), 'document store adapter missing');

  for (const adapter of adapters) {
    assert.equal(adapter.readOnly, true, adapter.storeId);
    assert.equal(adapter.adapterMode, 'metadata-only', adapter.storeId);
    assert.equal(adapter.infrastructure.provisioned, false, adapter.storeId);
    assert.equal(adapter.infrastructure.backingDependency, 'none', adapter.storeId);
    assert.deepEqual(adapter.execution.endpointPaths, [], adapter.storeId);
    assert.deepEqual(adapter.execution.mutationMethods, [], adapter.storeId);
    assert.equal(adapter.execution.autonomousExecutionAllowed, false, adapter.storeId);
    assert.equal(adapter.tenantPartitioning.tenantScoped, true, adapter.storeId);
    assert.equal(adapter.tenantPartitioning.rawCrossTenantAccessAllowed, false, adapter.storeId);
    assert.ok(adapter.retention.policyId.length > 0, adapter.storeId);
    assert.ok(adapter.complianceMappings.length > 0, adapter.storeId);
    assert.ok(adapter.privacy.restrictedFields.length > 0, adapter.storeId);
  }
});

test('artifact-to-store routing includes partitioning, lineage, retention, and privacy metadata', () => {
  const assetRoutes = routeUniversalArtifactToStores(artifact('asset', {
    artifactId: 'asset:gate-1',
    references: { twinIds: ['twin:asset:gate-1'] },
    lineage: { ...artifact('asset').lineage, twinIds: ['twin:asset:gate-1'], auditIds: ['audit:asset-1'], eventIds: ['event:asset-1'] },
  }));
  const assetKinds = new Set(assetRoutes.map((route) => route.storeKind));
  assert.ok(assetKinds.has('digital-twin-store'));
  assert.ok(assetKinds.has('knowledge-graph'));
  assert.ok(assetKinds.has('data-lake'));
  assert.ok(assetRoutes.every((route) => route.readOnly && route.executionEndpointPaths.length === 0));
  assert.ok(assetRoutes.every((route) => route.tenantPartition.tenantId === 'tenant-main-track'));
  assert.ok(assetRoutes.some((route) => route.tenantPartition.partitionKey === 'tenant-main-track/main-track/asset'));
  assert.ok(assetRoutes.every((route) => route.privacy.redactionRequired));
  assert.ok(assetRoutes.every((route) => route.retention.policyId.length > 0));

  const recommendationRoutes = routeUniversalArtifactToStores(artifact('recommendation', {
    artifactId: 'rec:surface-1',
    references: { approvalIds: ['approval:surface-1'], featureRecordIds: ['feature:surface:1'] },
    lineage: { ...artifact('recommendation').lineage, approvalIds: ['approval:surface-1'], featureRecordIds: ['feature:surface:1'], eventIds: ['event:rec-1'], auditIds: ['audit:rec-1'] },
  }));
  const recommendationKinds = new Set(recommendationRoutes.map((route) => route.storeKind));
  for (const kind of ['feature-store', 'event-store', 'audit-store', 'knowledge-graph', 'document-store', 'data-lake']) {
    assert.ok(recommendationKinds.has(kind), `${kind} missing`);
  }

  const documentRoutes = routeUniversalArtifactToStores(artifact('document', { artifactId: 'doc:evidence-1' }));
  assert.ok(documentRoutes.some((route) => route.storeKind === 'document-store'));
});

test('graph projection creates required artifact relationship edges', () => {
  const assetGraph = generateUniversalArtifactGraph(artifact('asset', {
    artifactId: 'asset:gate-1',
    references: { twinIds: ['twin:asset:gate-1'] },
    lineage: { ...artifact('asset').lineage, twinIds: ['twin:asset:gate-1'] },
  }));
  assert.ok(assetGraph.edges.some((edge) => edge.type === 'ASSET_REPRESENTED_BY_TWIN' && edge.from === 'universal-artifact:asset:asset:gate-1' && edge.to === 'universal-artifact:digital-twin:twin:asset:gate-1'));
  assert.equal(assetGraph.executionEndpointsAvailable, false);

  const eventGraph = generateUniversalArtifactGraph(artifact('event', {
    artifactId: 'event:surface-measured',
    references: { auditIds: ['audit:event-1'] },
    lineage: { ...artifact('event').lineage, auditIds: ['audit:event-1'] },
  }));
  assert.ok(eventGraph.edges.some((edge) => edge.type === 'EVENT_HAS_AUDIT_RECORD' && edge.from === 'universal-artifact:event:event:surface-measured' && edge.to === 'universal-artifact:audit-record:audit:event-1'));

  const recommendationGraph = generateUniversalArtifactGraph(artifact('recommendation', {
    artifactId: 'rec:surface-1',
    references: { approvalIds: ['approval:surface-1'] },
    lineage: { ...artifact('recommendation').lineage, approvalIds: ['approval:surface-1'] },
  }));
  assert.ok(recommendationGraph.edges.some((edge) => edge.type === 'RECOMMENDATION_REQUIRES_APPROVAL' && edge.from === 'universal-artifact:recommendation:rec:surface-1' && edge.to === 'universal-artifact:approval:approval:surface-1'));
});

test('serialization descriptors do not expose execution endpoints', () => {
  for (const artifactType of universalArtifactStorageArtifactTypes) {
    const descriptor = serializeUniversalArtifactDescriptor(artifact(artifactType));
    assert.equal(descriptor.noExecutionEndpoints, true, artifactType);
    assert.equal(descriptor.graph.executionEndpointsAvailable, false, artifactType);
    assert.ok(descriptor.storageTargets.length > 0, artifactType);
    assert.ok(descriptor.storageTargets.every((target) => target.readOnly && target.executionEndpointPaths.length === 0), artifactType);
  }
});
