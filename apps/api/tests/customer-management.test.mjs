import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('customer management workspace loads configuration-driven support tiers', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const workspace = await handleApiRequest(
    'GET',
    '/api/v1/customer-management/workspace?organizationId=org-trackmind-network',
    undefined,
    state,
  );
  assert.equal(workspace.status, 200);
  assert.ok(workspace.body.customers.length >= 1);
  assert.ok(workspace.body.supportTiers.length >= 4);
  assert.equal(workspace.body.tenantIsolation.mode, 'strict');
  assert.equal(workspace.body.tenantIsolation.organizationId, 'org-trackmind-network');
});

test('executive dashboard reports customer health and adoption overview', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const dashboard = await handleApiRequest(
    'GET',
    '/api/v1/customer-management/executive-dashboard?organizationId=org-trackmind-network',
    undefined,
    state,
  );
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.tenantIsolation.crossTenantAccessAllowed, false);
  assert.ok(dashboard.body.portfolioSummary.totalCustomers >= 1);
  assert.ok(dashboard.body.adoptionOverview.averageHealthScore > 0);
  assert.ok(dashboard.body.customers.some((c) => c.customerId === 'cust-trackmind-demo'));
});

test('customer creation and contact management stay organization-scoped', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const customer = await handleApiRequest('POST', '/api/v1/customers', {
    organizationId: 'org-trackmind-network',
    legalName: 'Test Racing LLC',
    displayName: 'Test Racing',
    industry: 'Thoroughbred Racing',
    region: 'US-West',
    supportTierId: 'support-professional',
  }, state);
  assert.equal(customer.status, 201);
  assert.equal(customer.body.organizationId, 'org-trackmind-network');
  const contact = await handleApiRequest('POST', '/api/v1/customer-contacts', {
    organizationId: 'org-trackmind-network',
    customerId: customer.body.id,
    fullName: 'Pat Manager',
    email: 'pat@test.demo',
    role: 'operations-lead',
    isPrimary: true,
  }, state);
  assert.equal(contact.status, 201);
  assert.equal(contact.body.customerId, customer.body.id);
});

test('tenant isolation blocks cross-organization customer access', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const denied = await handleApiRequest(
    'GET',
    '/api/v1/customers/cust-trackmind-demo?organizationId=org-other&actorOrganizationId=org-other',
    undefined,
    state,
  );
  assert.equal(denied.status, 404);
});

test('onboarding workflow starts from configuration template and completes steps', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const started = await handleApiRequest('POST', '/api/v1/customer-onboarding/workflows', {
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    workflowTemplateId: 'workflow-tenant-go-live',
    tenantId: 'trackmind',
  }, state);
  assert.equal(started.status, 201);
  assert.equal(started.body.status, 'in-progress');
  const step = await handleApiRequest(
    'POST',
    `/api/v1/customer-onboarding/workflows/${started.body.id}/steps/tenant-provisioned`,
    { organizationId: 'org-trackmind-network', completedBy: 'csm-alex-morgan' },
    state,
  );
  assert.equal(step.status, 200);
  assert.equal(step.body.steps.find((s) => s.stepId === 'tenant-provisioned')?.status, 'completed');
});

test('racetrack portfolio tracks customer racetrack assets', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const portfolio = await handleApiRequest('POST', '/api/v1/customer-portfolios', {
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    tenantId: 'trackmind',
    name: 'Expansion Portfolio',
    jurisdiction: 'US-CA',
  }, state);
  assert.equal(portfolio.status, 201);
  const updated = await handleApiRequest(
    'POST',
    `/api/v1/customer-portfolios/${portfolio.body.id}/racetracks`,
    { organizationId: 'org-trackmind-network', racetrackId: 'track-expansion-1' },
    state,
  );
  assert.equal(updated.status, 200);
  assert.ok(updated.body.racetrackIds.includes('track-expansion-1'));
});

test('customer success manager assignment updates health plan', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const plan = await handleApiRequest('POST', '/api/v1/customer-success/assign', {
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    successManagerId: 'csm-jordan-lee',
    successManagerName: 'Jordan Lee',
    objectives: ['Improve module adoption'],
  }, state);
  assert.equal(plan.status, 201);
  assert.equal(plan.body.successManagerId, 'csm-jordan-lee');
  assert.ok(plan.body.healthScore >= 0);
});
