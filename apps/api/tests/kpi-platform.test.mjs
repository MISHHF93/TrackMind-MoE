import assert from 'node:assert/strict';
import test from 'node:test';
import { apiEndpointContracts, validateKpiLineage } from '@trackmind/shared';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const adminHeaders = {
  'x-trackmind-role': 'platform-super-admin',
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
};

const wave07Paths = [
  '/api/v1/kpis/registry',
  '/api/v1/kpis/definitions',
  '/api/v1/kpis/thresholds',
  '/api/v1/kpis/sources',
  '/api/v1/kpis/definitions/draft-requests',
  '/api/v1/kpis/thresholds/draft-requests',
];

test('wave 07: KPI admin endpoints are registered in contracts', () => {
  for (const path of wave07Paths) {
    assert.ok(apiEndpointContracts.some((entry) => entry.path === path), `missing contract for ${path}`);
  }
});

test('wave 07: KPI registry and definitions expose ownership metadata', async () => {
  const state = createApiFacadeState();
  const registry = await handleApiRequest('GET', '/api/v1/kpis/registry', undefined, state, adminHeaders);
  const definitions = await handleApiRequest('GET', '/api/v1/kpis/definitions', undefined, state, adminHeaders);
  assert.equal(registry.status, 200);
  assert.equal(definitions.status, 200);
  assert.ok(registry.body.entries.length >= 28);
  assert.ok(definitions.body.definitions.length >= 28);
  assert.ok(registry.body.entries.every((entry) => entry.ownerRole && entry.thresholdStatus));
});

test('wave 07: consolidated KPI sources dedupe event references', async () => {
  const state = createApiFacadeState();
  const sources = await handleApiRequest('GET', '/api/v1/kpis/sources', undefined, state, adminHeaders);
  assert.equal(sources.status, 200);
  assert.ok(sources.body.mappings.length >= 28);
  assert.ok(sources.body.consolidatedEventRefs.length > 0);
  assert.equal(new Set(sources.body.consolidatedEventRefs).size, sources.body.consolidatedEventRefs.length);
});

test('wave 07: KPI recalculate persists snapshots from event projections', async () => {
  const state = createApiFacadeState();
  const before = await handleApiRequest('GET', '/api/v1/kpis/kpi-race-day-operations', undefined, state, adminHeaders);
  const recalculated = await handleApiRequest('POST', '/api/v1/kpis/recalculate', undefined, state, adminHeaders);
  const after = await handleApiRequest('GET', '/api/v1/kpis/kpi-race-day-operations', undefined, state, adminHeaders);
  assert.equal(recalculated.status, 200);
  assert.ok(recalculated.body.kpis.length >= 28);
  const raceDay = recalculated.body.kpis.find((kpi) => kpi.domain === 'race-day-operations');
  assert.ok(raceDay);
  assert.ok(raceDay.historicalSnapshots.length >= 1);
  assert.ok(after.body.historicalSnapshots.length >= before.body.historicalSnapshots.length);
  assert.equal(validateKpiLineage(raceDay).valid, true);
});

test('wave 07: threshold draft creates approval for governed KPIs', async () => {
  const state = createApiFacadeState();
  const draft = await handleApiRequest('POST', '/api/v1/kpis/thresholds/draft-requests', {
    kpiId: 'kpi-race-day-operations',
    warning: 80,
    critical: 65,
    targetDirection: 'above',
    description: 'Raised readiness threshold for test',
    requestedBy: 'kpi-platform-test',
    reason: 'Wave 07 threshold approval test',
    evidence: ['kpi-platform.test.mjs'],
  }, state, adminHeaders);
  assert.equal(draft.status, 202);
  assert.equal(draft.body.approvalRequired, true);
  assert.ok(draft.body.approvalId);
  const thresholds = await handleApiRequest('GET', '/api/v1/kpis/thresholds', undefined, state, adminHeaders);
  assert.ok(thresholds.body.thresholds.some((record) => record.kpiId === 'kpi-race-day-operations' && record.status === 'pending-approval'));
});

test('wave 07: definition draft records audit linkage without mutating workspace count', async () => {
  const state = createApiFacadeState();
  const before = await handleApiRequest('GET', '/api/v1/kpis', undefined, state, adminHeaders);
  const draft = await handleApiRequest('POST', '/api/v1/kpis/definitions/draft-requests', {
    kpiId: 'kpi-wave07-custom',
    domain: 'system-health',
    name: 'Wave 07 Custom Health KPI',
    description: 'Draft-only KPI definition for Wave 07',
    metricType: 'score',
    unit: 'score',
    target: 95,
    ownerRole: 'admin',
    visibility: 'tenant-internal',
    approvalSensitivity: 'none',
    sourceEvents: ['platform.health.checked'],
    sourceEntities: [{ entityType: 'platform-health', entityId: 'trackmind-api' }],
    requestedBy: 'kpi-platform-test',
    reason: 'Wave 07 definition draft test',
    evidence: ['kpi-platform.test.mjs'],
  }, state, adminHeaders);
  const after = await handleApiRequest('GET', '/api/v1/kpis', undefined, state, adminHeaders);
  assert.equal(draft.status, 202);
  assert.equal(draft.body.eventType, 'kpi.definition.draft.created');
  assert.equal(after.body.kpis.length, before.body.kpis.length);
});
