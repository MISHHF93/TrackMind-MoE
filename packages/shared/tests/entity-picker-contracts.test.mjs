import test from 'node:test';
import assert from 'node:assert/strict';
import { apiEndpointContracts } from '../dist/index.js';

const entityPickerPaths = [
  '/api/v1/entity-picker/kinds',
  '/api/v1/entity-picker/search',
];

const bulkPaths = [
  '/api/v1/data-entry/bulk/operations',
  '/api/v1/data-entry/bulk/preview',
  '/api/v1/data-entry/bulk/commit',
  '/api/v1/data-entry/quality-validate',
];

test('entity-picker routes are contracted', () => {
  for (const path of entityPickerPaths) {
    const contract = apiEndpointContracts.find((c) => c.path === path);
    assert.ok(contract, `missing contract for ${path}`);
  }
});

test('bulk and quality data-entry routes are contracted', () => {
  for (const path of bulkPaths) {
    const contract = apiEndpointContracts.find((c) => c.path === path);
    assert.ok(contract, `missing contract for ${path}`);
  }
});
