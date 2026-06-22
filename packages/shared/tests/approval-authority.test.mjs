import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvalActorRegistry,
  canRoleApproveAction,
  canRoleRequestApprovalAction,
  protectedActions,
} from '../dist/index.js';

test('requestors and approvers are separated for regulated payout', () => {
  const binding = approvalActorRegistry.payout;
  assert.ok(binding.requestors.includes('finance-manager'));
  assert.ok(binding.approvers.includes('compliance-officer'));
  assert.equal(canRoleRequestApprovalAction('finance-manager', 'payout'), true);
  assert.equal(canRoleApproveAction('finance-manager', 'payout'), true);
  assert.equal(canRoleApproveAction('staff-limited', 'payout'), false);
});

test('steward approves race start; starter may only request', () => {
  assert.equal(canRoleRequestApprovalAction('starter-official', 'race-start'), true);
  assert.equal(canRoleApproveAction('starter-official', 'race-start'), false);
  assert.equal(canRoleApproveAction('steward', 'race-start'), true);
});

test('every protected action has approval actor binding', () => {
  for (const action of protectedActions) {
    assert.ok(approvalActorRegistry[action], `missing binding for ${action}`);
  }
});
