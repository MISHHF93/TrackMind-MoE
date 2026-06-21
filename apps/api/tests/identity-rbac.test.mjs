import test from 'node:test';
import assert from 'node:assert/strict';
import { apiEndpointContracts } from '@trackmind/shared';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const adminHeaders = {
  'x-trackmind-role': 'admin',
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
};

const opsAdminHeaders = {
  ...adminHeaders,
  'x-trackmind-role': 'operations-admin',
};

const stewardHeaders = {
  ...adminHeaders,
  'x-trackmind-role': 'steward',
};

const wave04Paths = [
  '/api/v1/platform/users',
  '/api/v1/platform/roles',
  '/api/v1/platform/access-requests',
];

test('wave 04 identity RBAC contracts are registered', () => {
  for (const path of wave04Paths) {
    assert.ok(apiEndpointContracts.some((c) => c.path === path && c.method === 'GET'), `missing GET contract for ${path}`);
    assert.ok(apiEndpointContracts.some((c) => c.path === path && c.method === 'POST'), `missing POST contract for ${path}`);
  }
  const listUsers = apiEndpointContracts.find((c) => c.operationId === 'listPlatformUsers');
  assert.equal(listUsers?.requiredPermission, 'identity:read');
  const assignRole = apiEndpointContracts.find((c) => c.operationId === 'assignPlatformRole');
  assert.equal(assignRole?.requiredPermission, 'identity:write');
  const createAccess = apiEndpointContracts.find((c) => c.operationId === 'createPlatformAccessRequest');
  assert.equal(createAccess?.requiredPermission, 'access:request');
});

test('wave 04 platform users list and create with tenant scope', async () => {
  const state = createApiFacadeState();
  const listed = await handleApiRequest('GET', '/api/v1/platform/users', undefined, state, opsAdminHeaders);
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.body));
  assert.ok(listed.body.every((user) => user.tenantId === 'trackmind'));

  const created = await handleApiRequest('POST', '/api/v1/platform/users', {
    displayName: 'Wave 04 Tester',
    email: 'wave04@trackmind.local',
    tenantId: 'trackmind',
    organizationId: 'org-trackmind-network',
    roles: ['read-only-auditor'],
  }, state, opsAdminHeaders);
  assert.equal(created.status, 201);
  assert.equal(created.body.displayName, 'Wave 04 Tester');
  assert.ok(created.body.roles.includes('read-only-auditor'));
});

test('wave 04 platform roles list and assign', async () => {
  const state = createApiFacadeState();
  const roles = await handleApiRequest('GET', '/api/v1/platform/roles', undefined, state, opsAdminHeaders);
  assert.equal(roles.status, 200);
  assert.ok(roles.body.some((role) => role.role === 'steward' && role.assignable));

  const created = await handleApiRequest('POST', '/api/v1/platform/users', {
    displayName: 'Role Target',
    email: 'role-target@trackmind.local',
  }, state, opsAdminHeaders);

  const assigned = await handleApiRequest('POST', '/api/v1/platform/roles', {
    userId: created.body.id,
    role: 'racing-secretary',
    tenantId: 'trackmind',
  }, state, opsAdminHeaders);
  assert.equal(assigned.status, 201);
  assert.equal(assigned.body.role, 'racing-secretary');
  assert.ok(assigned.body.user.roles.includes('racing-secretary'));
});

test('wave 04 access requests create, list, and review', async () => {
  const state = createApiFacadeState();
  const request = await handleApiRequest('POST', '/api/v1/platform/access-requests', {
    userId: 'user-steward-1',
    requestedRole: 'racing-secretary',
    tenantId: 'trackmind',
  }, state, opsAdminHeaders);
  assert.equal(request.status, 201);
  assert.equal(request.body.status, 'pending');
  assert.equal(request.body.tenantId, 'trackmind');

  const listed = await handleApiRequest('GET', '/api/v1/platform/access-requests', undefined, state, opsAdminHeaders);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.some((entry) => entry.id === request.body.id));

  const reviewed = await handleApiRequest('POST', '/api/v1/platform/access-requests', {
    requestId: request.body.id,
    decision: 'approved',
  }, state, adminHeaders);
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.status, 'approved');

  const user = await handleApiRequest('GET', '/api/v1/platform/users', undefined, state, adminHeaders);
  const steward = user.body.find((entry) => entry.id === 'user-steward-1');
  assert.ok(steward.roles.includes('racing-secretary'));
});

test('wave 04 RBAC enforcement denies unauthorized roles', async () => {
  const state = createApiFacadeState();
  const deniedUsers = await handleApiRequest('GET', '/api/v1/platform/users', undefined, state, stewardHeaders);
  assert.equal(deniedUsers.status, 403);
  assert.match(deniedUsers.body.error.message, /lacks permission|not allowed/i);

  const deniedAssign = await handleApiRequest('POST', '/api/v1/platform/roles', {
    userId: 'user-steward-1',
    role: 'finance',
    tenantId: 'trackmind',
  }, state, stewardHeaders);
  assert.equal(deniedAssign.status, 403);

  const request = await handleApiRequest('POST', '/api/v1/platform/access-requests', {
    userId: 'user-steward-1',
    requestedRole: 'finance',
    tenantId: 'trackmind',
  }, state, stewardHeaders);
  assert.equal(request.status, 403);

  const opsRequest = await handleApiRequest('POST', '/api/v1/platform/access-requests', {
    userId: 'user-steward-1',
    requestedRole: 'finance',
    tenantId: 'trackmind',
  }, state, opsAdminHeaders);
  assert.equal(opsRequest.status, 201);

  const deniedReview = await handleApiRequest('POST', '/api/v1/platform/access-requests', {
    requestId: opsRequest.body.id,
    decision: 'approved',
  }, state, stewardHeaders);
  assert.equal(deniedReview.status, 403);
});

test('wave 04 identity service exposes tenant RBAC policy store', async () => {
  const state = createApiFacadeState();
  const workspace = await handleApiRequest('GET', '/api/v1/identity/workspace', undefined, state, opsAdminHeaders);
  assert.equal(workspace.status, 200);
  assert.ok(workspace.body.users.length >= 2);
  assert.ok(Array.isArray(workspace.body.roleAssignments));
  assert.ok(Array.isArray(workspace.body.accessRequests));
});
