import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiContractSchemas,
  encodeMediaAssetRef,
  mediaViewerSchemaVersion,
  parseMediaAssetRef,
  validateContract,
} from '../dist/index.js';

test('media viewer contract schemas validate sample workspace', () => {
  const sample = {
    generatedAt: '2026-06-23T00:00:00.000Z',
    schemaVersion: mediaViewerSchemaVersion,
    organizationId: 'org-1',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    streamGatewayConfigured: false,
    activeIntegrationClaimed: false,
    defaultLayout: '2x2',
    tiles: [],
    clips: [],
    inputs: [],
    outputCapabilities: [],
    zoneFilterOptions: [],
    disclaimer: 'test',
    mock: false,
  };
  const result = validateContract('MediaViewerWorkspaceDto', sample, apiContractSchemas.MediaViewerWorkspaceDto);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('media asset ref encoding round-trips', () => {
  const ref = { kind: 'steward-evidence', id: 'ev-headon', inquiryId: 'inquiry-1' };
  const encoded = encodeMediaAssetRef(ref);
  assert.equal(encoded, 'steward-evidence:ev-headon');
  const parsed = parseMediaAssetRef(encoded);
  assert.deepEqual(parsed, { kind: 'steward-evidence', id: 'ev-headon' });
});
