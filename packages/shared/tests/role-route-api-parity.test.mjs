import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  apiEndpointContracts,
  frontendRoutePermissionRegistry,
  roles,
} from '../dist/index.js';

test('every API contract resolves requiredPermission', () => {
  for (const contract of apiEndpointContracts) {
    assert.ok(contract.requiredPermission, `${contract.method} ${contract.path} missing permission`);
  }
});

test('frontend route permission registry keys are non-empty', () => {
  const keys = Object.keys(frontendRoutePermissionRegistry);
  assert.ok(keys.length >= 20, 'expected route permission registry entries');
  for (const key of keys) {
    assert.ok(frontendRoutePermissionRegistry[key], `${key} permission missing`);
  }
});

test('authenticated endpoints remain minority of contracts', () => {
  const authenticated = apiEndpointContracts.filter((c) => c.roles === 'authenticated').length;
  assert.ok(authenticated < apiEndpointContracts.length / 2);
  assert.equal(roles.length, 21);
});
