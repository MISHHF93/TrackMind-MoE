import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const adminHeaders = {
  'x-trackmind-role': 'admin',
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
};

test('wave 01 foundation platform endpoints', async () => {
  const state = createApiFacadeState();
  const foundation = await handleApiRequest('GET', '/api/v1/platform/foundation', undefined, state, adminHeaders);
  assert.equal(foundation.status, 200);
  assert.ok(foundation.body.organizations);

  const flags = await handleApiRequest('GET', '/api/v1/platform/feature-flags/evaluate?key=race-day-ops', undefined, state, adminHeaders);
  assert.equal(flags.status, 200);
  assert.equal(flags.body.enabled, true);

  const env = await handleApiRequest('GET', '/api/v1/platform/environment', undefined, state, adminHeaders);
  assert.equal(env.status, 200);
  assert.equal(env.body.persistenceMode, 'in-memory');
});

test('wave 04 identity and wave 05 audit search', async () => {
  const state = createApiFacadeState();
  const identity = await handleApiRequest('GET', '/api/v1/identity/workspace', undefined, state, adminHeaders);
  assert.equal(identity.status, 200);
  assert.ok(identity.body.users.length > 0);

  const search = await handleApiRequest('GET', '/api/v1/audit/search?domain=api', undefined, state, adminHeaders);
  assert.equal(search.status, 200);
  assert.ok(Array.isArray(search.body));
});

test('wave 09 paddock and schedule plus wave 11 incidents', async () => {
  const state = createApiFacadeState();
  const paddock = await handleApiRequest('GET', '/api/v1/race-operations/paddock', undefined, state, adminHeaders);
  assert.equal(paddock.status, 200);
  assert.ok(paddock.body.assignments.length > 0);

  const schedule = await handleApiRequest('GET', '/api/v1/race-operations/schedule', undefined, state, adminHeaders);
  assert.equal(schedule.status, 200);
  assert.ok(schedule.body.races.length > 0);

  const incidents = await handleApiRequest('GET', '/api/v1/incidents', undefined, state, adminHeaders);
  assert.equal(incidents.status, 200);
  assert.ok(incidents.body.length > 0);
});

test('wave 16 fan experience and wave 17 finance workspace', async () => {
  const state = createApiFacadeState();
  const fan = await handleApiRequest('GET', '/api/v1/fan-experience/workspace', undefined, state, adminHeaders);
  assert.equal(fan.status, 200);
  assert.ok(fan.body.attendance);

  const finance = await handleApiRequest('GET', '/api/v1/finance/workspace', undefined, state, adminHeaders);
  assert.equal(finance.status, 200);
  assert.ok(finance.body.revenue);
});

test('wave 18 model registry and wave 19 federation KPIs', async () => {
  const state = createApiFacadeState();
  const registry = await handleApiRequest('GET', '/api/v1/ai-governance/model-registry', undefined, state, adminHeaders);
  assert.equal(registry.status, 200);
  assert.ok(registry.body.modelCards.length > 0);

  const federation = await handleApiRequest('GET', '/api/v1/federation/kpi-aggregation', undefined, state, adminHeaders);
  assert.equal(federation.status, 200);
});

test('wave 20 global search and notifications', async () => {
  const state = createApiFacadeState();
  const search = await handleApiRequest('GET', '/api/v1/search/global?q=horse', undefined, state, adminHeaders);
  assert.equal(search.status, 200);
  assert.ok(Array.isArray(search.body.results));

  const inbox = await handleApiRequest('GET', '/api/v1/notifications/inbox?role=admin', undefined, state, adminHeaders);
  assert.equal(inbox.status, 200);
  assert.ok(inbox.body.notifications.length > 0);
});
