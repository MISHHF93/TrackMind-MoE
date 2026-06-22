import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assignableRoles,
  assignableRoleResonanceMatrix,
  filterKpisForRole,
  homeRouteForRole,
  validateRoleResonanceMatrix,
} from '../dist/index.js';

test('role resonance matrix validates all assignable personas', () => {
  const errors = validateRoleResonanceMatrix();
  assert.deepEqual(errors, [], errors.join('; '));
  assert.equal(Object.keys(assignableRoleResonanceMatrix).length, assignableRoles.length);
});

test('organization admin lands on executive analytics workspace', () => {
  assert.equal(homeRouteForRole('organization-admin'), 'analytics');
});

test('staff-limited has no editor routes in resonance matrix', () => {
  const entry = assignableRoleResonanceMatrix['staff-limited'];
  assert.equal(entry.editorRoutes.length, 0);
});

test('support-operator cannot create veterinary or financial entities', () => {
  const entry = assignableRoleResonanceMatrix['support-operator'];
  assert.equal(entry.entityAccess.veterinary.create, false);
  assert.equal(entry.entityAccess.financial.create, false);
  assert.equal(entry.approverActions.length, 0);
});

test('filterKpisForRole respects role domain visibility', () => {
  const kpis = [
    { id: 'k1', domain: 'finance', label: 'Finance' },
    { id: 'k2', domain: 'steward-operations', label: 'Steward' },
  ];
  const financeOnly = filterKpisForRole(kpis, 'finance-manager');
  assert.equal(financeOnly.length, 1);
  assert.equal(financeOnly[0].id, 'k1');
});
