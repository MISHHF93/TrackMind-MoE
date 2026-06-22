import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignableRoles,
  homeRouteForRole,
  homePathForRole,
  canRoleViewRoute,
  visibleKpiDomainsForRole,
  functionalCategoryForRole,
  quickActionsForRole,
} from '../dist/index.js';

test('each assignable role has home route and KPI domains', () => {
  for (const role of assignableRoles) {
    const home = homeRouteForRole(role);
    assert.ok(home, `${role} home route`);
    assert.ok(homePathForRole(role).startsWith('/'), `${role} home path`);
    assert.ok(visibleKpiDomainsForRole(role).length > 0, `${role} kpi domains`);
    assert.ok(functionalCategoryForRole(role), `${role} category`);
  }
});

test('executive sees analytics not admin by default', () => {
  assert.equal(homeRouteForRole('executive'), 'analytics');
  assert.equal(canRoleViewRoute('executive', 'analytics'), true);
  assert.equal(canRoleViewRoute('executive', 'platform-super-admin'), false);
});

test('race-day operations manager quick actions include approvals', () => {
  const actions = quickActionsForRole('race-day-operations-manager');
  assert.ok(actions.includes('open-approvals'));
});

test('veterinarian lands in equine workspace', () => {
  assert.equal(homePathForRole('veterinarian'), '/equine');
  assert.equal(canRoleViewRoute('veterinarian', 'equine'), true);
});
