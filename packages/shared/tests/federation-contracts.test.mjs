import assert from 'node:assert/strict';
import test from 'node:test';
import { apiContractSchemas, apiEndpointContracts, createTrackMindNexusUpgradePackage, validateContract, validateTrackMindNexusUpgradePackage } from '../dist/index.js';

function sampleFederationWorkspace() {
  return {
    schemaVersion: 'trackmind.federation.v1',
    generatedAt: '2026-06-14T21:00:00.000Z',
    organization: { organizationId: 'org-trackmind-network', name: 'TrackMind Racing Intelligence Network', governanceModel: 'federated' },
    tenant: { organizationId: 'org-trackmind-network', tenantId: 'tenant-main-track', racetrackId: 'main-track', displayName: 'Main Track tenant cell', certificationStatus: 'ready-for-trackmind-review', certificationEvidence: ['audit-ledger-active'], schemaVersion: 'trackmind.tenant.v1' },
    tracks: [{ organizationId: 'org-trackmind-network', tenantId: 'tenant-main-track', racetrackId: 'main-track', displayName: 'Main Track tenant cell', certificationStatus: 'ready-for-trackmind-review', schemaVersion: 'trackmind.track-profile.v1', dataResidency: 'tenant-us-east', sharingScope: 'tenant-only' }],
    standardizedSchemas: [{ schemaId: 'federation-track-profile', version: 'trackmind.track-profile.v1', requiredMetadata: ['organizationId','tenantId','racetrackId','schemaVersion'], tenantScoped: true, rawCrossTenantJoinAllowed: false }],
    tenantIsolation: { mode: 'strict', isolationKeys: ['organizationId','tenantId','racetrackId'], rawCrossTenantAccessAllowed: false, crossTenantJoinsAllowed: false, enforcement: ['tenant-scoped read models'] },
    dataSharingPolicy: { policyId: 'federation-data-sharing-v1', scope: 'federation-aggregate', approvalRequired: true, allowedExports: ['aggregated-benchmark','anonymized-industry-analytics'], prohibitedFields: ['horseId','personId','rawTelemetry'], consentRequired: true, retentionBoundary: 'industry-analytics-export:365d' },
    federationGovernance: { councilId: 'federation-governance-council', stewards: ['compliance-officer'], decisionRights: ['benchmark-publication approval'], auditActions: ['federation.workspace.read'], policyVersion: '2026.06' },
    consentRetentionBoundaries: [{ boundaryId: 'industry-analytics-export', subject: 'anonymized aggregate analytics', consentBasis: 'tenant policy approval', retentionDays: 365, deletionReview: 'governance-council', appliesTo: ['benchmark'] }],
    crossTrackBenchmarking: { schemaVersion: 'trackmind.federation.benchmark.v1', aggregationLevel: 'federation-aggregate', anonymized: true, permissionGoverned: true, rawTrackDataExposed: false, minCohortSize: 5, metrics: [{ metricId: 'surface-readiness-score', label: 'Surface readiness score', category: 'surface', unit: 'score', period: 'P30D', value: 87, benchmarkValue: 82, sampleSize: 12, aggregation: 'median', anonymized: true, minCohortSize: 5, permissionRequired: 'federation:benchmark:read', rawTrackDataExposed: false }] },
    industryAnalytics: { schemaVersion: 'trackmind.federation.analytics.v1', anonymized: true, permissionGoverned: true, rawTrackDataExposed: false, products: [{ analyticId: 'surface-condition-industry-trend', label: 'Surface condition trend', schemaVersion: 'trackmind.federation.analytics.v1', aggregationLevel: 'surface-type', anonymized: true, cohortSize: 18, minCohortSize: 10, policyId: 'federation-data-sharing-v1', permittedUse: ['industry safety benchmarking'], prohibitedUse: ['track re-identification'], dimensions: ['surfaceType'], measures: [{ name: 'medianReadinessScore', value: 82, unit: 'score', aggregation: 'median' }], rawRecordRefs: [] }] },
    rawDataExposure: { exposed: false, reason: 'metadata only', endpoints: [] },
    mock: false,
  };
}

test('federation workspace contract requires organization, tenant, racetrack, schema, and governance metadata', () => {
  const workspace = sampleFederationWorkspace();
  assert.deepEqual(validateContract('FederationWorkspaceDto', workspace, apiContractSchemas.FederationWorkspaceDto), { valid: true, errors: [] });
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/federation/workspace' && endpoint.response === 'FederationWorkspaceDto'));
});

test('Nexus upgrade package declares federation metadata without raw cross-track exposure', () => {
  const pkg = createTrackMindNexusUpgradePackage('2026-06-14T21:00:00.000Z');
  assert.deepEqual(validateTrackMindNexusUpgradePackage(pkg), { valid: true, errors: [] });
  assert.equal(pkg.federation.schemaVersion, 'trackmind.federation.v1');
  assert.equal(pkg.federation.tenantIsolation.rawCrossTenantAccessAllowed, false);
  assert.equal(pkg.federation.tenantIsolation.crossTenantJoinsAllowed, false);
  assert.equal(pkg.federation.rawCrossTrackDataExposed, false);
  assert.equal(pkg.federation.executionEndpointsAvailable, false);
});

test('federation benchmarks and industry analytics are anonymized aggregate contracts only', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  assert.ok(pkg.federation.crossTrackBenchmarkingMetrics.length > 0);
  assert.ok(pkg.federation.crossTrackBenchmarkingMetrics.every((metric) => metric.anonymized && !metric.rawTrackDataExposed && metric.minCohortSize >= 5));
  assert.ok(pkg.federation.anonymizedIndustryAnalytics.every((analytic) => analytic.anonymized && analytic.rawRecordRefs.length === 0 && analytic.minCohortSize >= 5));
});
