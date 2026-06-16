import type { FederationWorkspaceDto } from '@trackmind/shared';

export function createFederationWorkspace(generatedAt = new Date().toISOString(), mock = false): FederationWorkspaceDto {
  return {
    schemaVersion: 'trackmind.federation.v1',
    generatedAt,
    organization: {
      organizationId: 'org-trackmind-network',
      name: 'TrackMind Racing Intelligence Network',
      governanceModel: 'federated',
    },
    tenant: {
      organizationId: 'org-trackmind-network',
      tenantId: 'tenant-main-track',
      racetrackId: 'main-track',
      displayName: 'Main Track tenant cell',
      certificationStatus: 'ready-for-trackmind-review',
      certificationEvidence: ['trackmind-certified-track-candidate', 'audit-ledger-active', 'ai-governance-active'],
      schemaVersion: 'trackmind.tenant.v1',
    },
    tracks: [
      { organizationId: 'org-trackmind-network', tenantId: 'tenant-main-track', racetrackId: 'main-track', displayName: 'Main Track tenant cell', certificationStatus: 'ready-for-trackmind-review', schemaVersion: 'trackmind.track-profile.v1', dataResidency: 'tenant-us-east', sharingScope: 'tenant-only' },
      { organizationId: 'org-trackmind-network', tenantId: 'cohort-anonymized-east', racetrackId: 'cohort-east-dirt', displayName: 'Anonymized eastern dirt cohort', certificationStatus: 'candidate', schemaVersion: 'trackmind.track-profile.v1', dataResidency: 'aggregate-only', sharingScope: 'federation-aggregate' },
      { organizationId: 'org-trackmind-network', tenantId: 'cohort-anonymized-synthetic', racetrackId: 'cohort-synthetic', displayName: 'Anonymized synthetic-surface cohort', certificationStatus: 'candidate', schemaVersion: 'trackmind.track-profile.v1', dataResidency: 'aggregate-only', sharingScope: 'industry-anonymized' },
    ],
    standardizedSchemas: [
      { schemaId: 'federation-track-profile', version: 'trackmind.track-profile.v1', requiredMetadata: ['organizationId', 'tenantId', 'racetrackId', 'certificationStatus', 'schemaVersion'], tenantScoped: true, rawCrossTenantJoinAllowed: false },
      { schemaId: 'federation-benchmark', version: 'trackmind.federation.benchmark.v1', requiredMetadata: ['organizationId', 'tenantId', 'racetrackId', 'period', 'aggregation', 'minCohortSize'], tenantScoped: true, rawCrossTenantJoinAllowed: false },
      { schemaId: 'federation-analytics', version: 'trackmind.federation.analytics.v1', requiredMetadata: ['policyId', 'aggregationLevel', 'anonymized', 'cohortSize'], tenantScoped: true, rawCrossTenantJoinAllowed: false },
    ],
    tenantIsolation: {
      mode: 'strict',
      isolationKeys: ['organizationId', 'tenantId', 'racetrackId'],
      rawCrossTenantAccessAllowed: false,
      crossTenantJoinsAllowed: false,
      enforcement: ['tenant-scoped query filters', 'aggregate export review', 'audit evidence on every federation read'],
    },
    dataSharingPolicy: {
      policyId: 'federation-data-sharing-v1',
      scope: 'federation-aggregate',
      approvalRequired: true,
      allowedExports: ['aggregated-benchmark', 'anonymized-industry-analytics'],
      prohibitedFields: ['horseId', 'personId', 'ownerId', 'trainerId', 'jockeyId', 'microchipId', 'credentialId', 'cameraClipUri', 'rawTelemetry'],
      consentRequired: true,
      retentionBoundary: 'industry-analytics-export:365d; regulated-racing-records:2555d',
    },
    federationGovernance: {
      councilId: 'federation-governance-council',
      stewards: ['compliance-officer', 'data-governance-lead', 'racing-operations-lead'],
      decisionRights: ['schema-version approval', 'benchmark-publication approval', 'retention-boundary review'],
      auditActions: ['federation.workspace.read', 'federation.benchmark.published', 'federation.policy.updated'],
      policyVersion: '2026.06',
    },
    consentRetentionBoundaries: [
      { boundaryId: 'regulated-racing-records', subject: 'race operations and compliance evidence', consentBasis: 'regulatory obligation', retentionDays: 2555, deletionReview: 'legal-hold-and-regulator-review', appliesTo: ['audit', 'approval', 'race-day-readiness'] },
      { boundaryId: 'industry-analytics-export', subject: 'anonymized aggregate analytics', consentBasis: 'tenant data-sharing policy approval', retentionDays: 365, deletionReview: 'federation-governance-council', appliesTo: ['benchmark', 'industry-analytics'] },
    ],
    crossTrackBenchmarking: {
      schemaVersion: 'trackmind.federation.benchmark.v1',
      aggregationLevel: 'federation-aggregate',
      anonymized: true,
      permissionGoverned: true,
      rawTrackDataExposed: false,
      minCohortSize: 5,
      metrics: [
        { metricId: 'surface-readiness-score', label: 'Surface readiness score', category: 'surface', unit: 'score', period: 'P30D', value: 87, benchmarkValue: 82, percentileRank: 68, sampleSize: 12, aggregation: 'median', anonymized: true, minCohortSize: 5, permissionRequired: 'federation:benchmark:read', rawTrackDataExposed: false },
        { metricId: 'approval-sla-minutes-p95', label: 'Approval SLA p95', category: 'operations', unit: 'minutes', period: 'P30D', value: 11, benchmarkValue: 14, percentileRank: 72, sampleSize: 12, aggregation: 'p95', anonymized: true, minCohortSize: 5, permissionRequired: 'federation:benchmark:read', rawTrackDataExposed: false },
        { metricId: 'platform-health-uptime-rate', label: 'Platform health uptime', category: 'platform-health', unit: 'percent', period: 'P30D', value: 99.4, benchmarkValue: 98.8, percentileRank: 75, sampleSize: 12, aggregation: 'rate', anonymized: true, minCohortSize: 5, permissionRequired: 'federation:benchmark:read', rawTrackDataExposed: false },
      ],
    },
    industryAnalytics: {
      schemaVersion: 'trackmind.federation.analytics.v1',
      anonymized: true,
      permissionGoverned: true,
      rawTrackDataExposed: false,
      products: [
        { analyticId: 'surface-condition-industry-trend', label: 'Surface condition industry trend', schemaVersion: 'trackmind.federation.analytics.v1', aggregationLevel: 'surface-type', anonymized: true, cohortSize: 18, minCohortSize: 10, policyId: 'federation-data-sharing-v1', permittedUse: ['industry safety benchmarking', 'operator readiness planning'], prohibitedUse: ['track re-identification', 'horse-level analysis', 'personnel performance ranking'], dimensions: ['surfaceType', 'month'], measures: [{ name: 'medianReadinessScore', value: 82, unit: 'score', aggregation: 'median' }], rawRecordRefs: [] },
        { analyticId: 'internal-readiness-industry-summary', label: 'Internal readiness industry summary', schemaVersion: 'trackmind.federation.analytics.v1', aggregationLevel: 'industry', anonymized: true, cohortSize: 18, minCohortSize: 10, policyId: 'federation-data-sharing-v1', permittedUse: ['internal readiness capacity planning'], prohibitedUse: ['operator ranking without consent', 'raw control evidence review'], dimensions: ['readinessStatus'], measures: [{ name: 'candidateTracks', value: 12, unit: 'count', aggregation: 'count' }], rawRecordRefs: [] },
      ],
    },
    rawDataExposure: {
      exposed: false,
      reason: 'Federation facade returns metadata and anonymized aggregate contracts only; raw per-track records remain tenant scoped.',
      endpoints: [],
    },
    mock,
  };
}
