import assert from 'node:assert/strict';
import test from 'node:test';
import { apiEndpointContracts, validateKpiLineage } from '@trackmind/shared';
import { createApiFacadeState, handleApiRequest } from '../dist/index.js';
import { createKPIWorkspace } from '../dist/kpiArtifacts.js';

const governancePaths = [
  '/platform/domain-ownership',
  '/platform/governance-lineage/validation',
  '/platform/readiness-scorecards',
  '/platform/executive-scorecard',
  '/platform/workflow-health',
  '/platform/maturity-review',
  '/platform/governed-artifacts',
];

test('governance wave: platform governance endpoints are registered in contracts', () => {
  for (const path of governancePaths) {
    assert.ok(apiEndpointContracts.some((entry) => entry.path === `/api/v1${path}`), `missing contract for ${path}`);
  }
});

test('governance wave: domain ownership registry maps workspaces and KPI domains', async () => {
  const state = createApiFacadeState();
  const response = await handleApiRequest('GET', '/api/v1/platform/domain-ownership', undefined, state, { 'x-trackmind-role': 'admin' });
  assert.equal(response.status, 200);
  assert.ok(response.body.entries.length >= 28);
  assert.ok(response.body.entries.some((entry) => entry.domainId === 'race-day-operations'));
  assert.ok(response.body.entries.some((entry) => entry.kpiIds.length >= 1));
});

test('governance wave: KPI artifacts include complete lineage metadata', () => {
  const workspace = createKPIWorkspace({ generatedAt: new Date().toISOString() });
  for (const kpi of workspace.kpis) {
    const result = validateKpiLineage(kpi);
    assert.equal(result.valid, true, `${kpi.kpiId}: ${result.issues.join(', ')}`);
    assert.ok(kpi.auditReference.auditIds?.length);
  }
});

test('governance wave: readiness and executive scorecards derive from KPI workspace', async () => {
  const state = createApiFacadeState();
  const readiness = await handleApiRequest('GET', '/api/v1/platform/readiness-scorecards', undefined, state);
  const executive = await handleApiRequest('GET', '/api/v1/platform/executive-scorecard', undefined, state);
  assert.equal(readiness.status, 200);
  assert.equal(executive.status, 200);
  assert.ok(readiness.body.operational.score >= 0);
  assert.ok(executive.body.overall >= 0);
  assert.ok(executive.body.kpis.length >= 1);
});

test('governance wave: lineage validation report covers events, KPIs, and notifications', async () => {
  const state = createApiFacadeState();
  const report = await handleApiRequest('GET', '/api/v1/platform/governance-lineage/validation', undefined, state, { 'x-trackmind-role': 'admin' });
  assert.equal(report.status, 200);
  assert.ok(report.body.summary.total >= 1);
  assert.ok(Array.isArray(report.body.kpis));
  assert.ok(Array.isArray(report.body.notifications));
});

test('governance wave: approval requests publish operational notifications', async () => {
  const state = createApiFacadeState();
  const before = (await handleApiRequest('GET', '/api/v1/notifications/inbox', undefined, state)).body.notifications.length;
  await handleApiRequest('POST', '/api/v1/approvals/draft-requests', {
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    action: 'race-start',
    target: 'race-7',
    actorId: 'governance-test',
    actorType: 'human',
    roles: ['steward'],
    reason: 'notification coverage test',
    evidence: ['governance-lineage-test'],
  }, state, { 'x-trackmind-role': 'steward' });
  const after = (await handleApiRequest('GET', '/api/v1/notifications/inbox', undefined, state)).body.notifications.length;
  assert.ok(after > before);
});

test('governance wave: KPI recalculate applies readiness domain scores', async () => {
  const state = createApiFacadeState();
  const recalculated = await handleApiRequest('POST', '/api/v1/kpis/recalculate', undefined, state, { 'x-trackmind-role': 'admin' });
  assert.equal(recalculated.status, 200);
  const raceDay = recalculated.body.kpis.find((kpi) => kpi.domain === 'race-day-operations');
  assert.ok(raceDay);
  assert.ok(raceDay.historicalSnapshots.length >= 1);
});

test('governance wave: platform maturity review returns graded dimensions', async () => {
  const state = createApiFacadeState();
  const maturity = await handleApiRequest('GET', '/api/v1/platform/maturity-review', undefined, state, { 'x-trackmind-role': 'admin' });
  assert.equal(maturity.status, 200);
  assert.ok(['A', 'B', 'C', 'D', 'F'].includes(maturity.body.overallGrade));
  assert.ok(maturity.body.dimensions.length >= 7);
});

test('governance wave: analytics workspace reflects executive scorecard KPIs', async () => {
  const state = createApiFacadeState();
  const analytics = await handleApiRequest('GET', '/api/v1/analytics/workspace', undefined, state);
  assert.equal(analytics.status, 200);
  assert.ok(analytics.body.executiveSummary.some((item) => /executive|readiness|safety|compliance|operations/i.test(item.label)));
});
