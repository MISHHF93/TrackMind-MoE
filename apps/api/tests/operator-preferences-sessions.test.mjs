import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const stewardHeaders = {
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
  'x-trackmind-role': 'steward',
};

test('operator preferences default and patch', async () => {
  const state = createApiFacadeState();
  const create = await handleApiRequest('POST', '/api/v1/platform/session', { userId: 'user-steward-1', tenantId: 'trackmind' }, state);
  assert.equal(create.status, 201);
  const session = create.body;
  const bearer = { authorization: `Bearer ${session.sessionId}` };

  const read = await handleApiRequest('GET', '/api/v1/platform/operator-preferences', undefined, state, { ...stewardHeaders, ...bearer });
  assert.equal(read.status, 200);
  assert.equal(read.body.theme, 'system');
  assert.equal(read.body.locale, 'en-US');

  const patched = await handleApiRequest(
    'PATCH',
    '/api/v1/platform/operator-preferences',
    { theme: 'dark', locale: 'en-GB', timezone: 'Europe/London', density: 'compact' },
    state,
    { ...stewardHeaders, ...bearer },
  );
  assert.equal(patched.status, 200);
  assert.equal(patched.body.theme, 'dark');
  assert.equal(patched.body.locale, 'en-GB');
});

test('operator session list and revoke other sessions', async () => {
  const state = createApiFacadeState();
  const first = await handleApiRequest('POST', '/api/v1/platform/session', { userId: 'user-vet-1', tenantId: 'trackmind', clientHint: 'Chrome' }, state);
  const second = await handleApiRequest('POST', '/api/v1/platform/session', { userId: 'user-vet-1', tenantId: 'trackmind', clientHint: 'Edge' }, state);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const vetHeaders = {
    'x-trackmind-tenant-id': 'trackmind',
    'x-trackmind-racetrack-id': 'main-track',
    'x-trackmind-organization-id': 'org-trackmind-network',
    'x-trackmind-role': 'veterinarian',
    authorization: `Bearer ${second.body.sessionId}`,
  };

  const listed = await handleApiRequest('GET', '/api/v1/platform/sessions', undefined, state, vetHeaders);
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.body));
  assert.ok(listed.body.length >= 2);
  assert.equal(listed.body.filter((row) => row.current).length, 1);

  const revokeOthers = await handleApiRequest('DELETE', '/api/v1/platform/sessions?scope=others', undefined, state, vetHeaders);
  assert.equal(revokeOthers.status, 200);
  assert.match(String(revokeOthers.body.message), /Revoked/);

  const after = await handleApiRequest('GET', '/api/v1/platform/sessions', undefined, state, vetHeaders);
  assert.equal(after.body.length, 1);
  assert.equal(after.body[0].current, true);
});

test('access request uses authenticated user id', async () => {
  const state = createApiFacadeState();
  const create = await handleApiRequest('POST', '/api/v1/platform/session', { userId: 'user-auditor-1', tenantId: 'trackmind' }, state);
  const bearer = {
    authorization: `Bearer ${create.body.sessionId}`,
    'x-trackmind-tenant-id': 'trackmind',
    'x-trackmind-racetrack-id': 'main-track',
    'x-trackmind-organization-id': 'org-trackmind-network',
    'x-trackmind-role': 'read-only-auditor',
  };

  const submitted = await handleApiRequest(
    'POST',
    '/api/v1/platform/access-requests',
    { requestedRole: 'steward', justification: 'Need steward console for race review' },
    state,
    bearer,
  );
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.userId, 'user-auditor-1');
  assert.equal(submitted.body.requestedRole, 'steward');

  const mine = await handleApiRequest('GET', '/api/v1/platform/access-requests?mine=true', undefined, state, bearer);
  assert.equal(mine.status, 200);
  assert.ok(mine.body.some((row) => row.id === submitted.body.id));
});
