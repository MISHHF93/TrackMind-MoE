import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApiRequest } from '../dist/index.js';
import {
  apiContractSchemas,
  trackMindIntelligenceCoreModuleIds,
  trackMindIntelligenceCoreSharedLayerIds,
  validateContract,
  validateTrackMindIntelligenceCoreMetadata,
} from '../../../packages/shared/dist/index.js';

test('intelligence core metadata endpoint composes the AI control plane without execution paths', async () => {
  const response = await handleApiRequest('GET', '/api/v1/intelligence-core/metadata');

  assert.equal(response.status, 200);
  assert.deepEqual(validateContract('TrackMindIntelligenceCoreDto', response.body, apiContractSchemas.TrackMindIntelligenceCoreDto), { valid: true, errors: [] });
  assert.deepEqual(validateTrackMindIntelligenceCoreMetadata(response.body), { valid: true, errors: [] });

  const body = response.body;
  assert.equal(body.recommendationsOnly, true);
  assert.equal(body.executionEndpointsAvailable, false);
  assert.deepEqual(body.modules.map((module) => module.id).sort(), [...trackMindIntelligenceCoreModuleIds].sort());
  assert.deepEqual(body.sharedLayers.map((layer) => layer.id).sort(), [...trackMindIntelligenceCoreSharedLayerIds].sort());
  assert.ok(body.controlPlaneComposition.sharedAIControlPlaneModuleIds.includes('responsible-ai-governor'));
  assert.ok(body.modules.every((module) => module.outputs.every((output) => output.kind === 'recommendation' && output.executionAllowed === false)));
  assert.ok(body.modules.every((module) => module.approvalBoundary.approvalApi === 'POST /api/v1/approvals/controlled-actions'));
  assert.ok(body.auditEventTwinReferences.auditRefs.length > 0);
  assert.ok(body.auditEventTwinReferences.eventRefs.length > 0);
  assert.ok(body.auditEventTwinReferences.digitalTwinRefs.length > 0);

  const missingExecute = await handleApiRequest('POST', '/api/v1/intelligence-core/execute', { action: 'race-start' });
  assert.equal(missingExecute.status, 404);
});
