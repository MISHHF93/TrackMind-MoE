import assert from 'node:assert/strict';
import test from 'node:test';
import { apiEndpointContracts, kpiDomains } from '@trackmind/shared';
import { createApiFacadeState, handleApiRequest } from '../dist/index.js';

const nexusExpansionPaths = [
  '/horse-registry/workspace',
  '/trainer-management/workspace',
  '/jockey-management/workspace',
  '/veterinary-operations/workspace',
  '/racing-calendar/workspace',
  '/race-cards/workspace',
  '/paddock-operations/workspace',
  '/starting-gate-operations/workspace',
  '/identity/workspace',
  '/reporting/workspace',
  '/industry-intelligence/workspace',
  '/federation-intelligence/workspace',
  '/equine-welfare/workspace',
  '/search/global',
];

const frontendMappedPaths = [
  '/horse-registry/workspace',
  '/trainer-management/workspace',
  '/jockey-management/workspace',
  '/veterinary-operations/workspace',
  '/racing-calendar/workspace',
  '/race-cards/workspace',
  '/paddock-operations/workspace',
  '/starting-gate-operations/workspace',
  '/identity/workspace',
  '/reporting/workspace',
  '/industry-intelligence/workspace',
  '/federation-intelligence/workspace',
  '/equine-welfare/workspace',
  '/equine-welfare/audit-trail',
  '/search/global',
];

test('platform verification: core domain workspaces respond with DTO contracts', async () => {
  const state = createApiFacadeState();
  for (const path of nexusExpansionPaths) {
    const suffix = path === '/search/global' ? '?q=horse' : '';
    const response = await handleApiRequest('GET', `/api/v1${path}${suffix}`, undefined, state);
    assert.equal(response.status, 200, `${path} should return 200`);
    assert.equal(response.body.mock, false, `${path} should not be mock`);
  }
});

test('platform verification: frontend-mapped backend paths are registered in api contracts', () => {
  for (const path of frontendMappedPaths) {
    const match = apiEndpointContracts.find((entry) => entry.path === `/api/v1${path}` || entry.path.endsWith(path));
    assert.ok(match, `missing API contract for ${path}`);
  }
});

test('platform verification: KPI artifacts cover every declared domain', async () => {
  const state = createApiFacadeState();
  const kpis = await handleApiRequest('GET', '/api/v1/kpis', undefined, state, { 'x-trackmind-role': 'admin' });
  assert.equal(kpis.status, 200);
  const domains = new Set((kpis.body.kpis ?? []).map((kpi) => kpi.domain));
  for (const domain of kpiDomains) {
    assert.ok(domains.has(domain), `KPI workspace missing domain ${domain}`);
  }
});

test('platform verification: AI recommendations include governance metadata', async () => {
  const state = createApiFacadeState();
  const response = await handleApiRequest('GET', '/api/v1/ai-control-plane/recommendations', undefined, state);
  assert.equal(response.status, 200);
  const items = Array.isArray(response.body) ? response.body : response.body.recommendations ?? [];
  assert.ok(items.length >= 1, 'expected seeded AI recommendations');
  for (const item of items) {
    assert.ok(item.confidence && typeof item.confidence.raw === 'number', 'recommendation missing confidence score');
    assert.ok(item.evidencePackage?.evidence?.length >= 1, 'recommendation missing evidence package');
    assert.ok(typeof item.approvalRequirement?.required === 'boolean', 'recommendation missing approval requirement');
    assert.ok(item.auditReference?.auditIds?.length >= 1, 'recommendation missing audit linkage');
  }
});

test('platform verification: global search indexes supported artifact kinds', async () => {
  const state = createApiFacadeState();
  const search = await handleApiRequest('GET', '/api/v1/search/global?q=horse', undefined, state);
  assert.equal(search.status, 200);
  const kinds = new Set((search.body.results ?? []).map((result) => result.kind));
  assert.ok(kinds.has('horse'), 'search should index horses');
});

test('platform verification: reporting workspace exposes templates and jobs', async () => {
  const state = createApiFacadeState();
  const reporting = await handleApiRequest('GET', '/api/v1/reporting/workspace', undefined, state);
  assert.equal(reporting.status, 200);
  assert.ok(Array.isArray(reporting.body.templates));
  assert.ok(Array.isArray(reporting.body.recentJobs));
});

test('platform verification: federation industry intelligence remains aggregate-only', async () => {
  const state = createApiFacadeState();
  const industry = await handleApiRequest('GET', '/api/v1/industry-intelligence/workspace', undefined, state);
  assert.equal(industry.status, 200);
  const serialized = JSON.stringify(industry.body).toLowerCase();
  assert.doesNotMatch(serialized, /ssn|social security|email@/);
  assert.ok(industry.body.mock === false);
});

test('platform verification: regulated approval drafts append audit events', async () => {
  const state = createApiFacadeState();
  const beforeResponse = await handleApiRequest('GET', '/api/v1/approvals/requests', undefined, state);
  const beforeApprovals = Array.isArray(beforeResponse.body) ? beforeResponse.body.length : beforeResponse.body.requests?.length ?? 0;
  const created = await handleApiRequest('POST', '/api/v1/approvals/draft-requests', {
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    action: 'race-start',
    target: 'race-7',
    actorId: 'platform-verification',
    actorType: 'human',
    roles: ['steward'],
    reason: 'verification test',
    evidence: ['platform-verification'],
  }, state, { 'x-trackmind-role': 'steward' });
  assert.equal(created.status, 202);
  assert.equal(created.body.audited, true);
  assert.ok(created.body.approvalId);
  const afterResponse = await handleApiRequest('GET', '/api/v1/approvals/requests', undefined, state);
  const afterApprovals = Array.isArray(afterResponse.body) ? afterResponse.body.length : afterResponse.body.requests?.length ?? 0;
  assert.ok(afterApprovals > beforeApprovals, 'approval draft should enqueue governed approval request');
});
