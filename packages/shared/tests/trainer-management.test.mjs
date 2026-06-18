import test from 'node:test';
import assert from 'node:assert/strict';
import { trainerManagementSchemaVersion } from '../dist/index.js';

test('trainer management schema version is stable', () => {
  assert.equal(trainerManagementSchemaVersion, 'trackmind.trainer-management.v1');
});
