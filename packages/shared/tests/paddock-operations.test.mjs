import test from 'node:test';
import assert from 'node:assert/strict';
import { paddockOperationsSchemaVersion } from '../dist/index.js';

test('paddock operations schema version is stable', () => {
  assert.equal(paddockOperationsSchemaVersion, 'trackmind.paddock-operations.v1');
});
