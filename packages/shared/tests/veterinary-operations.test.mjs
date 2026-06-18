import test from 'node:test';
import assert from 'node:assert/strict';
import { veterinaryOperationsSchemaVersion, veterinaryPrivacyScopesByRole } from '../dist/index.js';

test('veterinary operations schema version is stable', () => {
  assert.equal(veterinaryOperationsSchemaVersion, 'trackmind.veterinary-operations.v1');
});

test('veterinary privacy scopes exclude confidential data for racing secretary', () => {
  assert.ok(!veterinaryPrivacyScopesByRole['racing-secretary'].includes('veterinary-confidential'));
  assert.ok(veterinaryPrivacyScopesByRole.veterinarian.includes('veterinary-confidential'));
});
