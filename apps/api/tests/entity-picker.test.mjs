import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiFacadeState } from '../dist/server.js';
import { handleEntityPickerRoute } from '../dist/entityPicker/entityPickerRoutes.js';

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
  requestId: 'req-picker-1',
};

test('entity picker kinds route returns role-filtered catalog', () => {
  const state = createApiFacadeState();
  const response = handleEntityPickerRoute(
    state.entityPickerService,
    'GET',
    '/entity-picker/kinds',
    scope,
  );
  assert.equal(response?.status, 200);
  assert.ok(Array.isArray(response?.body.kinds));
  assert.ok(response?.body.kinds.some((entry) => entry.kind === 'horse'));
});

test('entity picker search returns scoped horse results', () => {
  const state = createApiFacadeState();
  const params = new URLSearchParams({ kind: 'horse', q: 'horse', limit: '5' });
  const response = handleEntityPickerRoute(
    state.entityPickerService,
    'GET',
    '/entity-picker/search',
    scope,
    params,
  );
  assert.equal(response?.status, 200);
  assert.equal(response?.body.kind, 'horse');
  assert.ok(Array.isArray(response?.body.results));
});

test('entity picker search allows KPI kind for auditor role', () => {
  const state = createApiFacadeState();
  const params = new URLSearchParams({ kind: 'kpi-definition', q: 'readiness' });
  const response = handleEntityPickerRoute(
    state.entityPickerService,
    'GET',
    '/entity-picker/search',
    { ...scope, role: 'read-only-auditor' },
    params,
  );
  assert.equal(response?.status, 200);
});

test('entity picker search supports coverage audit kinds', () => {
  const state = createApiFacadeState();
  for (const kind of ['compliance-evidence', 'audit-record', 'federation-participant', 'security-event']) {
    const params = new URLSearchParams({ kind, q: '', limit: '5' });
    const response = handleEntityPickerRoute(
      state.entityPickerService,
      'GET',
      '/entity-picker/search',
      scope,
      params,
    );
    assert.equal(response?.status, 200, kind);
    assert.equal(response?.body.kind, kind);
    assert.ok(Array.isArray(response?.body.results));
  }
});
