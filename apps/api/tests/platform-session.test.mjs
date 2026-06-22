import test from 'node:test';
import assert from 'node:assert/strict';
import { apiEndpointContracts } from '@trackmind/shared';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const baseHeaders = {
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
};

test('platform session contracts are registered', () => {
  const paths = [
    '/api/v1/platform/session',
    '/api/v1/platform/session/active-role',
    '/api/v1/platform/notification-preferences',
  ];
  for (const path of paths) {
    assert.ok(apiEndpointContracts.some((contract) => contract.path === path), `missing contract for ${path}`);
  }
});

test('platform session create and hydrate for seeded steward persona', async () => {
  const state = createApiFacadeState();
  const created = await handleApiRequest('POST', '/api/v1/platform/session', {
    userId: 'user-steward-1',
    tenantId: 'trackmind',
  }, state);
  assert.equal(created.status, 201);
  assert.equal(created.body.activeRole, 'steward');
  assert.ok(created.body.assignedRoles.includes('steward'));
  assert.ok(created.body.profile.resonance.viewerRoutes.includes('stewarding'));

  const bearerHeaders = {
    ...baseHeaders,
    authorization: `Bearer ${created.body.sessionId}`,
  };
  const session = await handleApiRequest('GET', '/api/v1/platform/session', undefined, state, bearerHeaders);
  assert.equal(session.status, 200);
  assert.equal(session.body.userId, 'user-steward-1');
});

test('active-role patch rejects unassigned persona', async () => {
  const state = createApiFacadeState();
  const created = await handleApiRequest('POST', '/api/v1/platform/session', {
    userId: 'user-vet-1',
    tenantId: 'trackmind',
  }, state);
  const bearerHeaders = {
    ...baseHeaders,
    authorization: `Bearer ${created.body.sessionId}`,
    'x-trackmind-role': 'veterinarian',
  };

  const forbidden = await handleApiRequest('PATCH', '/api/v1/platform/session/active-role', {
    activeRole: 'platform-super-admin',
  }, state, bearerHeaders);
  assert.equal(forbidden.status, 403);

  const allowed = await handleApiRequest('PATCH', '/api/v1/platform/session/active-role', {
    activeRole: 'veterinarian',
  }, state, bearerHeaders);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.activeRole, 'veterinarian');
});

test('entra mode ignores spoofed role header without bearer session', async () => {
  const previous = process.env.TRACKMIND_AUTH_PROVIDER;
  process.env.TRACKMIND_AUTH_PROVIDER = 'entra';
  try {
    const state = createApiFacadeState();
    const response = await handleApiRequest('GET', '/api/v1/operations/command-center', undefined, state, {
      ...baseHeaders,
      'x-trackmind-role': 'platform-super-admin',
    });
    assert.equal(response.status, 401);
  } finally {
    if (previous === undefined) delete process.env.TRACKMIND_AUTH_PROVIDER;
    else process.env.TRACKMIND_AUTH_PROVIDER = previous;
  }
});
