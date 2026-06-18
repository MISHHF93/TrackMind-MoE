import test from 'node:test';
import assert from 'node:assert/strict';
import { horseRegistrySchemaVersion } from '../dist/index.js';

test('horse registry schema version is stable', () => {
  assert.equal(horseRegistrySchemaVersion, 'trackmind.horse-registry.v1');
});
