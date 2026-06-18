import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('subscription APIs load plans from configuration registry', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const plans = await handleApiRequest('GET', '/api/v1/subscriptions/plans', undefined, state);
  assert.equal(plans.status, 200);
  assert.ok(Array.isArray(plans.body));
  assert.ok(plans.body.length >= 4);
  assert.ok(plans.body.every((p) => p.id && p.entitlements && p.limits));
  assert.ok(!plans.body.some((p) => p.id === 'starter'));
});

test('entitlement evaluation reflects active subscription and plan limits', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const entitlements = await handleApiRequest(
    'GET',
    '/api/v1/subscriptions/entitlements?organizationId=org-trackmind-network&tenantId=trackmind',
    undefined,
    state,
  );
  assert.equal(entitlements.status, 200);
  assert.equal(entitlements.body.planId, 'plan-enterprise-monthly');
  assert.equal(entitlements.body.subscriptionStatus, 'active');
  assert.equal(entitlements.body.entitled, true);
  assert.ok(entitlements.body.modules.some((m) => m.key === 'raceDay' && m.enabled));
});

test('organization onboarding creates organization and trial subscription', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const result = await handleApiRequest('POST', '/api/v1/onboarding/organization', {
    organizationName: 'SaaS Test Org',
    planId: 'plan-starter-monthly',
  }, state);
  assert.equal(result.status, 201);
  assert.ok(result.body.organizationId.startsWith('org-'));
  assert.equal(result.body.planId, 'plan-starter-monthly');
  assert.equal(result.body.status, 'trialing');
});

test('racetrack onboarding enforces plan racetrack limits', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const tenantResult = await handleApiRequest('POST', '/api/v1/onboarding/tenant', {
    organizationId: 'org-limit-test',
    tenantName: 'Limit Test Tenant',
    planId: 'plan-starter-monthly',
  }, state);
  assert.equal(tenantResult.status, 201);
  const firstTrack = await handleApiRequest('POST', '/api/v1/onboarding/racetrack', {
    organizationId: tenantResult.body.organizationId,
    tenantId: tenantResult.body.tenantId,
    racetrackName: 'Track One',
    jurisdiction: 'US-NY',
  }, state);
  assert.equal(firstTrack.status, 201);
  const secondTrack = await handleApiRequest('POST', '/api/v1/onboarding/racetrack', {
    organizationId: tenantResult.body.organizationId,
    tenantId: tenantResult.body.tenantId,
    racetrackName: 'Track Two',
    jurisdiction: 'US-NY',
  }, state);
  assert.equal(secondTrack.status, 400);
  assert.equal(secondTrack.body.error.code, 'plan_limit_exceeded');
});

test('billing checkout session uses provider abstraction', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const provider = await handleApiRequest('GET', '/api/v1/billing/provider', undefined, state);
  assert.equal(provider.status, 200);
  assert.ok(provider.body.provider.providerId);
  const checkout = await handleApiRequest('POST', '/api/v1/billing/checkout-session', {
    organizationId: 'org-trackmind-network',
    planId: 'plan-enterprise-monthly',
    successUrl: 'https://example.com/success',
  }, state);
  assert.equal(checkout.status, 202);
  assert.ok(checkout.body.sessionId);
});

test('usage tracking records API call metrics', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const recorded = await handleApiRequest('POST', '/api/v1/subscriptions/usage', {
    organizationId: 'org-trackmind-network',
    tenantId: 'trackmind',
    metricKey: 'api_call',
    quantity: 5,
  }, state);
  assert.equal(recorded.status, 201);
  assert.equal(recorded.body.quantity, 5);
  const summary = await handleApiRequest(
    'GET',
    '/api/v1/subscriptions/usage?organizationId=org-trackmind-network&tenantId=trackmind',
    undefined,
    state,
  );
  assert.equal(summary.status, 200);
  assert.ok(summary.body.summary.apiCallsPerMonth >= 5);
});
