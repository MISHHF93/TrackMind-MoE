import test from 'node:test';
import assert from 'node:assert/strict';
import { jockeyManagementSchemaVersion } from '../dist/index.js';

test('jockey management schema version is stable', () => {
  assert.equal(jockeyManagementSchemaVersion, 'trackmind.jockey-management.v1');
});
