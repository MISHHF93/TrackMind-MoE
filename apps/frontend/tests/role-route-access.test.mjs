import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';
import {
  assignableRoles,
  canRoleViewRoute,
  homePathForRole,
  homeRouteForRole,
  legacyRoleAliases,
  normalizeRole,
} from '../../../packages/shared/dist/index.js';

const root = resolve(import.meta.dirname, '..');

test('legacy role aliases normalize to canonical personas', () => {
  assert.equal(normalizeRole('admin'), 'platform-super-admin');
  assert.equal(normalizeRole('racing-secretary'), 'horse-operations-coordinator');
  assert.equal(normalizeRole('security'), 'security-manager');
  assert.ok(Object.keys(legacyRoleAliases).length >= 10);
});

test('each assignable role home route is accessible to that role', () => {
  for (const role of assignableRoles) {
    const homeRoute = homeRouteForRole(role);
    assert.ok(canRoleViewRoute(role, homeRoute), `${role} should view home route ${homeRoute}`);
    assert.ok(homePathForRole(role).startsWith('/'), `${role} home path`);
  }
});

test('frontend guards redirect denied users to role home', async () => {
  const guards = await readFile(resolve(root, 'src/auth/guards.tsx'), 'utf8');
  const router = await readFile(resolve(root, 'src/app/router.tsx'), 'utf8');
  const support = await readFile(resolve(root, 'src/domain/support.ts'), 'utf8');
  const session = await readFile(resolve(root, 'src/auth/session.ts'), 'utf8');

  assert.match(guards, /homePathForSessionRole/);
  assert.match(router, /RoleHomeRedirect/);
  assert.match(support, /canRoleViewRoute/);
  assert.match(session, /normalizeRole/);
});

test('steward and security personas have distinct workspace homes', () => {
  assert.equal(homeRouteForRole('steward'), 'stewarding');
  assert.equal(homeRouteForRole('security-manager'), 'security');
  assert.equal(canRoleViewRoute('steward', 'stewarding'), true);
  assert.equal(canRoleViewRoute('security-manager', 'security'), true);
  assert.equal(canRoleViewRoute('steward', 'security'), false);
});
