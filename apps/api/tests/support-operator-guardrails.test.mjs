import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IdentityService } from '../dist/platform/identityService.js';

test('support-operator is denied regulated permissions via tenant deny policy', () => {
  const identity = new IdentityService();
  assert.equal(identity.evaluatePolicy('trackmind', 'support-operator', 'finance:payout'), false);
  assert.equal(identity.evaluatePolicy('trackmind', 'support-operator', 'vet:clear-flag'), false);
  assert.equal(identity.evaluatePolicy('trackmind', 'support-operator', 'audit:export'), false);
});

test('support-operator retains diagnostics permissions', () => {
  const identity = new IdentityService();
  assert.equal(identity.evaluatePolicy('trackmind', 'support-operator', 'support:operate'), true);
  assert.equal(identity.evaluatePolicy('trackmind', 'support-operator', 'read:any'), true);
});
