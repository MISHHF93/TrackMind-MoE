import test from 'node:test';
import assert from 'node:assert/strict';
import { canRoleViewRoute, viewerRolesForRoute } from '@trackmind/shared';

test('account route resonates for every role', () => {
  const viewers = viewerRolesForRoute('account');
  assert.equal(viewers.length, 21);
  for (const role of viewers) {
    assert.equal(canRoleViewRoute(role, 'account'), true);
  }
});

test('steward cannot view finance route', () => {
  assert.equal(canRoleViewRoute('steward', 'finance'), false);
});

test('auditor can view audit route and remains read-only operational', () => {
  assert.equal(canRoleViewRoute('read-only-auditor', 'audit'), true);
});
