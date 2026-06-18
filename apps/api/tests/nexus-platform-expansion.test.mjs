import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';
import { apiEndpointContracts } from '@trackmind/shared';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('nexus expansion manifest covers prompts 03-20', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const res = await handleApiRequest('GET', '/api/v1/platform/nexus-expansion/manifest', undefined, state);
  assert.equal(res.status, 200);
  assert.equal(res.body.prompts.length, 18);
  assert.ok(res.body.prompts.every((p) => p.status === 'implemented'));
});

test('marketplace enables and disables modules with entitlement checks', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const ws = await handleApiRequest('GET', '/api/v1/marketplace/workspace?tenantId=trackmind', undefined, state);
  assert.equal(ws.status, 200);
  assert.ok(ws.body.listings.length >= 10);
  const disable = await handleApiRequest('POST', '/api/v1/marketplace/modules/raceDay/disable', { tenantId: 'trackmind' }, state);
  assert.equal(disable.status, 200);
  assert.equal(disable.body.enabled, false);
  const enable = await handleApiRequest('POST', '/api/v1/marketplace/modules/raceDay/enable', { tenantId: 'trackmind' }, state);
  assert.equal(enable.status, 200);
  assert.equal(enable.body.enabled, true);
});

test('white label branding is configurable per organization', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const updated = await handleApiRequest('POST', '/api/v1/white-label/branding', {
    organizationId: 'org-trackmind-network',
    tenantId: 'trackmind',
    productName: 'Saratoga Nexus',
    primaryColor: '#003366',
  }, state);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.productName, 'Saratoga Nexus');
});

test('operational intelligence and executive suite return live posture', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const ops = await handleApiRequest('GET', '/api/v1/operational-intelligence/center?tenantId=trackmind', undefined, state);
  assert.equal(ops.status, 200);
  assert.ok(ops.body.liveKpis.length >= 3);
  const exec = await handleApiRequest('GET', '/api/v1/executive-intelligence/suite?organizationId=org-trackmind-network', undefined, state);
  assert.equal(exec.status, 200);
  assert.ok(exec.body.strategicKpis.length >= 3);
});

test('equine welfare delegates to canonical equine service', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const welfare = await handleApiRequest('GET', '/api/v1/equine-welfare/workspace', undefined, state);
  assert.equal(welfare.status, 200);
  assert.equal(welfare.body.schemaVersion, 'trackmind.equine-welfare-intelligence.v1');
  assert.equal(welfare.body.guardrails.aiRecommendationsAdvisoryOnly, true);
  assert.ok(welfare.body.welfareIndicators.length >= 1);
  assert.ok(welfare.body.digitalTwinLinks.length >= 1);
  const horse = welfare.body.horses.find((h) => h.horseId === 'horse-1');
  assert.ok(horse, 'expected canonical horse-1 welfare projection');
  const detail = await handleApiRequest('GET', '/api/v1/equine-welfare/horses/horse-1', undefined, state);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.horseId, 'horse-1');
  assert.ok(detail.body.observations.length >= 1);
});

test('workflow automation projects canonical template registry', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const workflow = await handleApiRequest('GET', '/api/v1/workflow-automation/workspace?tenantId=trackmind', undefined, state);
  assert.equal(workflow.status, 200);
  assert.ok(workflow.body.templates.some((t) => t.id.startsWith('tmwf.')));
});

test('compliance command center projects control library readiness', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const compliance = await handleApiRequest('GET', '/api/v1/compliance-command-center/workspace', undefined, state);
  assert.equal(compliance.status, 200);
  assert.ok(compliance.body.controlsMapped >= 10);
  assert.ok(compliance.body.readinessScore > 0);
});

test('equine welfare and predictive analytics workspaces', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const welfare = await handleApiRequest('GET', '/api/v1/equine-welfare/workspace', undefined, state);
  assert.equal(welfare.status, 200);
  assert.ok(welfare.body.horses.length >= 1);
  const predictive = await handleApiRequest('GET', '/api/v1/predictive-analytics/workspace', undefined, state);
  assert.equal(predictive.status, 200);
  assert.equal(predictive.body.forecasts.length, 5);
});

test('knowledge graph workspace connects canonical racing entities', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const graph = await handleApiRequest('GET', '/api/v1/knowledge-graph/workspace', undefined, state);
  assert.equal(graph.status, 200);
  assert.equal(graph.body.schemaVersion, 'trackmind.racing-knowledge-graph.v1');
  assert.ok(graph.body.entityCounts.horses >= 1);
  assert.ok(graph.body.entityCounts.trainers >= 1);
  assert.ok(graph.body.entityCounts.kpis >= 1);
});

test('industry intelligence workspace enforces anonymized federation governance', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const workspace = await handleApiRequest('GET', '/api/v1/industry-intelligence/workspace', undefined, state);
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.schemaVersion, 'trackmind.industry-intelligence.v1');
  assert.ok(workspace.body.anonymizedBenchmarks.length >= 3);
  assert.equal(workspace.body.guardrails.rawCrossTrackRecordSharing, false);
  assert.ok(workspace.body.federationAnalytics.every((analytic) => analytic.rawRecordRefs.length === 0));

  const federationLegacy = await handleApiRequest('GET', '/api/v1/federation-intelligence/workspace', undefined, state);
  assert.equal(federationLegacy.status, 200);
  assert.equal(federationLegacy.body.anonymized, true);
});

test('enterprise readiness convergence scorecard', async () => {
  process.env.TRACKMIND_REPO_ROOT = repoRoot;
  const state = createApiFacadeState();
  const readiness = await handleApiRequest('GET', '/api/v1/platform/enterprise-readiness', undefined, state);
  assert.equal(readiness.status, 200);
  assert.ok(readiness.body.overallScore >= 90);
  assert.equal(readiness.body.convergence.saasOperatingSystem, 'TrackMind Nexus ROS');
});

test('all nexus expansion endpoints are registered in api contracts', () => {
  const required = [
    '/api/v1/marketplace/workspace',
    '/api/v1/white-label/workspace',
    '/api/v1/digital-twin/platform/workspace',
    '/api/v1/operational-intelligence/center',
    '/api/v1/equine-welfare/workspace',
    '/api/v1/predictive-analytics/workspace',
    '/api/v1/reporting/workspace',
    '/api/v1/workflow-automation/workspace',
    '/api/v1/integration-hub/workspace',
    '/api/v1/mobile-operations/workspace',
    '/api/v1/compliance-command-center/workspace',
    '/api/v1/security-soc/workspace',
    '/api/v1/facilities-command/workspace',
    '/api/v1/federation-intelligence/workspace',
    '/api/v1/ai-governance-registry/workspace',
    '/api/v1/knowledge-graph/workspace',
    '/api/v1/executive-intelligence/suite',
    '/api/v1/platform/enterprise-readiness',
  ];
  for (const path of required) {
    assert.ok(apiEndpointContracts.some((e) => e.path === path), `missing contract for ${path}`);
  }
});
