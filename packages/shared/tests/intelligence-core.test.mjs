import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiControlPlaneBlockedActions,
  apiContractSchemas,
  apiEndpointContracts,
  createTrackMindIntelligenceCoreMetadata,
  trackMindIntelligenceCoreModuleIds,
  trackMindIntelligenceCoreSharedLayerIds,
  validateContract,
  validateTrackMindIntelligenceCoreMetadata,
} from '../dist/index.js';

test('TrackMind Intelligence Core covers all Tier 10 modules', () => {
  const core = createTrackMindIntelligenceCoreMetadata();
  const moduleIds = core.modules.map((module) => module.id);

  assert.deepEqual(moduleIds.sort(), [...trackMindIntelligenceCoreModuleIds].sort());
  assert.equal(new Set(moduleIds).size, trackMindIntelligenceCoreModuleIds.length);
  for (const module of core.modules) {
    assert.ok(module.displayName.endsWith('Intelligence') || module.displayName === 'Race Readiness');
    assert.ok(module.capabilities.length > 0);
    assert.ok(module.requiredInputs.length > 0);
    assert.ok(module.references.aiControlPlaneModuleRefs.includes('responsible-ai-governor'));
    assert.ok(module.references.modelRegistryRefs.length > 0);
  }
});

test('TrackMind Intelligence Core composes shared AI control-plane layers', () => {
  const core = createTrackMindIntelligenceCoreMetadata();
  const layerIds = core.sharedLayers.map((layer) => layer.id);

  assert.deepEqual(layerIds.sort(), [...trackMindIntelligenceCoreSharedLayerIds].sort());
  assert.equal(core.architecture, 'composed-ai-control-plane-metadata');
  assert.equal(core.controlPlaneComposition.featureStoreSchemaVersion, 'trackmind.feature-store.v1');
  assert.ok(core.controlPlaneComposition.controlPlaneFlow.includes('Feature Store'));
  assert.ok(core.controlPlaneComposition.controlPlaneFlow.includes('Model Registry'));
  assert.ok(core.controlPlaneComposition.sharedAIControlPlaneModuleIds.includes('responsible-ai-governor'));
  assert.ok(core.sharedLayers.every((layer) => layer.recommendationOnlyInvariant));
});

test('TrackMind Intelligence Core keeps every output recommendation-only', () => {
  const core = createTrackMindIntelligenceCoreMetadata();

  assert.equal(core.recommendationsOnly, true);
  assert.equal(core.executionEndpointsAvailable, false);
  for (const module of core.modules) {
    assert.equal(module.recommendationOnly, true);
    assert.equal(module.autonomousExecutionAllowed, false);
    for (const output of module.outputs) {
      assert.equal(output.kind, 'recommendation');
      assert.equal(output.recommendationOnly, true);
      assert.equal(output.advisoryOnly, true);
      assert.equal(output.executionAllowed, false);
      assert.equal(output.mayMutateOperationalState, false);
    }
  }
});

test('TrackMind Intelligence Core blocks safety-critical controls through existing policy', () => {
  const core = createTrackMindIntelligenceCoreMetadata();

  for (const module of core.modules) {
    assert.ok(module.approvalBoundary.safetyCriticalControlsBlocked.length > 0, `${module.id} has no blocked controls`);
    for (const action of module.approvalBoundary.safetyCriticalControlsBlocked) {
      assert.ok(aiControlPlaneBlockedActions.includes(action), `${module.id} uses unmanaged blocked action ${action}`);
      assert.ok(core.controlPlaneComposition.blockedActions.includes(action), `${module.id} action ${action} missing from composed policy`);
    }
  }

  const allBlocked = new Set(core.modules.flatMap((module) => module.approvalBoundary.safetyCriticalControlsBlocked));
  for (const action of ['race-start', 'race-stop', 'starting-gate-move', 'emergency-action', 'safety-critical-control']) {
    assert.ok(allBlocked.has(action), `${action} should be blocked by intelligence core metadata`);
  }
});

test('TrackMind Intelligence Core exposes approval integration and validates as an API DTO', () => {
  const core = { ...createTrackMindIntelligenceCoreMetadata(), generatedAt: '2026-06-14T12:00:00.000Z', mock: false };

  assert.deepEqual(validateTrackMindIntelligenceCoreMetadata(core), { valid: true, errors: [] });
  assert.equal(core.approvalIntegration.approvalEngineRef, 'centralized-approval-service');
  assert.equal(core.approvalIntegration.approvalApi, 'POST /api/v1/approvals/controlled-actions');
  assert.equal(core.approvalIntegration.nonHumanApprovalAllowed, false);
  assert.ok(core.modules.every((module) => module.approvalBoundary.approvalRequiredForOperationalUse));
  assert.ok(core.modules.every((module) => module.approvalBoundary.autonomousExecutionAllowed === false));

  assert.deepEqual(validateContract('TrackMindIntelligenceCoreDto', core, apiContractSchemas.TrackMindIntelligenceCoreDto), { valid: true, errors: [] });
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/intelligence-core/metadata' && endpoint.response === 'TrackMindIntelligenceCoreDto'));
});
