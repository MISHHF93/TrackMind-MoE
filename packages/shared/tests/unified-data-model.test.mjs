import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiContractSchemas,
  apiEndpointContracts,
  canonicalStoreDescriptors,
  createUnifiedDataModelWorkspace,
  domainSchemas,
  featureStoreSchemaVersion,
  findStoresForTUSEntity,
  unifiedTusEntityStoreMappings,
  validateContract,
  validateUnifiedDataModelWorkspace,
} from '../dist/index.js';

test('unified data model declares canonical stores and dependency-free facade metadata', () => {
  const workspace = createUnifiedDataModelWorkspace('2026-06-14T12:00:00.000Z', { tenantId: 'trackmind', racetrackId: 'main-track' });
  assert.deepEqual(validateUnifiedDataModelWorkspace(workspace), { valid: true, errors: [] });
  assert.deepEqual(validateContract('UnifiedDataModelWorkspaceDto', workspace, apiContractSchemas.UnifiedDataModelWorkspaceDto), { valid: true, errors: [] });

  const storeTypes = new Set(workspace.stores.map((store) => store.storeType));
  for (const type of ['data-lake', 'feature-store', 'knowledge-graph', 'digital-twin-graph', 'event-store', 'audit-store']) {
    assert.ok(storeTypes.has(type), `${type} missing`);
  }
  assert.ok(workspace.stores.every((store) => store.storeId.startsWith(`store:${store.storeType}:`)));
  assert.ok(workspace.stores.every((store) => store.scope.tenantScoped));
  assert.ok(workspace.stores.every((store) => store.governanceControls.controls.includes('tenant-isolation')));
  assert.ok(workspace.stores.every((store) => store.runtimeFacade.facadeOnly && store.runtimeFacade.backingDependency === 'none'));
});

test('each TUS entity mapping resolves to one or more stores with governance metadata', () => {
  const mappedKinds = new Set(unifiedTusEntityStoreMappings.map((mapping) => mapping.entityKind));
  for (const kind of ['tus-asset-standard', 'tus-twin-standard', 'feature-record', 'nexus-event', 'audit-log-entry', ...Object.keys(domainSchemas)]) {
    assert.ok(mappedKinds.has(kind), `${kind} mapping missing`);
    const mapping = unifiedTusEntityStoreMappings.find((item) => item.entityKind === kind);
    assert.ok(mapping.storeIds.length > 0, `${kind} must map to at least one store`);
    assert.ok(mapping.requiredScope.tenantScoped, `${kind} must be tenant scoped`);
    assert.ok(mapping.governanceControls.includes('retention-policy'), `${kind} missing governance controls`);
    assert.equal(findStoresForTUSEntity(kind).length, mapping.storeIds.length);
  }
});

test('event, audit, twin, and feature stores carry lineage links', () => {
  const byType = new Map(canonicalStoreDescriptors.map((store) => [store.storeType, store]));
  assert.ok(byType.get('event-store').lineage.eventTypes.includes('asset.registry.changed.v1'));
  assert.ok(byType.get('audit-store').governanceControls.immutableHashChain);
  assert.ok(byType.get('digital-twin-graph').lineage.twinKinds.includes('ai-agent'));
  assert.ok(byType.get('feature-store').lineage.featureSets.includes(featureStoreSchemaVersion));

  const recommendationMapping = unifiedTusEntityStoreMappings.find((mapping) => mapping.entityKind === 'ai-recommendation');
  assert.ok(recommendationMapping.lineageRequired.includes('event'));
  assert.ok(recommendationMapping.lineageRequired.includes('audit'));
  assert.ok(recommendationMapping.lineageRequired.includes('twin'));
  assert.ok(recommendationMapping.lineageRequired.includes('feature'));
  assert.ok(recommendationMapping.lineageRequired.includes('recommendation'));
});

test('unified data model endpoint is registered in API contracts', () => {
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/tus/data-model' && endpoint.response === 'UnifiedDataModelWorkspaceDto'));
});
