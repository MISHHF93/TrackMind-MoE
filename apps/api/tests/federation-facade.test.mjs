import assert from 'node:assert/strict';
import test from 'node:test';
import { apiContractSchemas, validateContract } from '@trackmind/shared';
import { createApiFacadeState, createFederationWorkspace, handleApiRequest } from '../dist/index.js';

test('federation facade exposes organization, tenant, racetrack, certification, and policy metadata', () => {
  const workspace = createFederationWorkspace('2026-06-14T21:00:00.000Z', false);
  assert.deepEqual(validateContract('FederationWorkspaceDto', workspace, apiContractSchemas.FederationWorkspaceDto), { valid: true, errors: [] });
  assert.equal(workspace.organization.organizationId, 'org-trackmind-network');
  assert.equal(workspace.tenant.tenantId, 'tenant-main-track');
  assert.equal(workspace.tenant.racetrackId, 'main-track');
  assert.equal(workspace.tenant.certificationStatus, 'ready-for-trackmind-review');
  assert.equal(workspace.dataSharingPolicy.approvalRequired, true);
  assert.equal(workspace.dataSharingPolicy.consentRequired, true);
  assert.ok(workspace.consentRetentionBoundaries.length >= 2);
});

test('federation tenant isolation blocks raw cross-track joins and access', () => {
  const workspace = createFederationWorkspace();
  assert.deepEqual(workspace.tenantIsolation.isolationKeys, ['organizationId', 'tenantId', 'racetrackId']);
  assert.equal(workspace.tenantIsolation.rawCrossTenantAccessAllowed, false);
  assert.equal(workspace.tenantIsolation.crossTenantJoinsAllowed, false);
  assert.ok(workspace.standardizedSchemas.every((schema) => schema.tenantScoped && !schema.rawCrossTenantJoinAllowed));
});

test('federation benchmarking and industry analytics expose anonymized aggregates only', () => {
  const workspace = createFederationWorkspace();
  assert.equal(workspace.crossTrackBenchmarking.anonymized, true);
  assert.equal(workspace.crossTrackBenchmarking.permissionGoverned, true);
  assert.equal(workspace.crossTrackBenchmarking.rawTrackDataExposed, false);
  assert.ok(workspace.crossTrackBenchmarking.metrics.every((metric) => metric.anonymized && !metric.rawTrackDataExposed && metric.minCohortSize >= 5 && metric.permissionRequired));
  assert.equal(workspace.industryAnalytics.rawTrackDataExposed, false);
  assert.ok(workspace.industryAnalytics.products.every((product) => product.anonymized && product.rawRecordRefs.length === 0 && product.cohortSize >= product.minCohortSize));
});

test('federation API route does not expose raw cross-track records or endpoints', async () => {
  const state = createApiFacadeState();
  const response = await handleApiRequest('GET', '/api/v1/federation/workspace', undefined, state);
  assert.equal(response.status, 200);
  const workspace = response.body;
  assert.equal(workspace.rawDataExposure.exposed, false);
  assert.deepEqual(workspace.rawDataExposure.endpoints, []);
  assert.equal(workspace.crossTrackBenchmarking.rawTrackDataExposed, false);
  assert.equal(workspace.industryAnalytics.rawTrackDataExposed, false);
  assert.ok(workspace.dataSharingPolicy.prohibitedFields.includes('rawTelemetry'));
});
