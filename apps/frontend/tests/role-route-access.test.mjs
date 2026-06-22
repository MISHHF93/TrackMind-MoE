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
  assert.equal(homeRouteForRole('facilities-manager'), 'facilities');
  assert.equal(homeRouteForRole('compliance-officer'), 'compliance');
  assert.equal(canRoleViewRoute('steward', 'stewarding'), true);
  assert.equal(canRoleViewRoute('security-manager', 'security'), true);
  assert.equal(canRoleViewRoute('steward', 'security'), false);
});

test('executive can access compliance and finance via operating model', () => {
  assert.equal(canRoleViewRoute('executive', 'compliance'), true);
  assert.equal(canRoleViewRoute('executive', 'finance'), true);
  assert.equal(canRoleViewRoute('executive', 'analytics'), true);
});

test('data analytics user can access data hub', () => {
  assert.equal(canRoleViewRoute('data-analytics-user', 'dataHub'), true);
  assert.equal(canRoleViewRoute('data-analytics-user', 'stewarding'), false);
});

test('organization admin lands on executive analytics workspace', () => {
  assert.equal(homeRouteForRole('organization-admin'), 'analytics');
  assert.ok(canRoleViewRoute('organization-admin', 'analytics'));
  assert.ok(canRoleViewRoute('organization-admin', 'admin'));
});

test('racetrack admin cannot access platform admin workspace', () => {
  assert.equal(canRoleViewRoute('racetrack-admin', 'admin'), false);
});

test('all assignable roles have accessible home routes', () => {
  for (const role of assignableRoles) {
    const homeRoute = homeRouteForRole(role);
    assert.ok(canRoleViewRoute(role, homeRoute), `${role} home ${homeRoute}`);
  }
});

test('every workspace route has buildRouteActions entries', async () => {
  const routes = await readFile(resolve(root, 'src/routes/routes.ts'), 'utf8');
  const routeActions = await readFile(resolve(root, 'src/domain/routeActions.ts'), 'utf8');
  const routeIds = [...routes.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  assert.ok(routeIds.length >= 23, 'expected at least 23 routes');
  for (const routeId of routeIds) {
    assert.match(routeActions, new RegExp(`${routeId}:\\s*\\[`), `buildRouteActions missing ${routeId}`);
  }
});
