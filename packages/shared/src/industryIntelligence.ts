export const industryIntelligenceSchemaVersion = 'trackmind.industry-intelligence.v1' as const;

export const industryIntelligenceGovernanceStatement =
  'Industry intelligence exposes anonymized aggregate benchmarks, federation analytics, and scorecards only; raw cross-track records, identifiable participant rows, and cross-tenant joins are prohibited by federation governance policy.';

export type IndustryBenchmarkCategory = 'safety' | 'operations' | 'surface' | 'compliance' | 'platform-health' | 'welfare' | 'finance';
export type IndustryTrendDirection = 'up' | 'down' | 'flat' | 'insufficient-history';
export type IndustryScorecardStatus = 'leading' | 'on-par' | 'watch' | 'lagging';

export interface IndustryAnonymizedBenchmarkDto {
  benchmarkId: string;
  label: string;
  category: IndustryBenchmarkCategory;
  unit: 'score' | 'percent' | 'count' | 'minutes' | 'rate';
  period: string;
  trackValue: number;
  industryMedian: number;
  industryP75?: number;
  percentileRank?: number;
  cohortSize: number;
  minCohortSize: number;
  aggregation: 'median' | 'p75' | 'p95' | 'rate' | 'count';
  anonymized: true;
  rawTrackDataExposed: false;
  permissionRequired: string;
  policyId: string;
}

export interface IndustryFederationAnalyticDto {
  analyticId: string;
  label: string;
  aggregationLevel: 'industry' | 'regional' | 'surface-type' | 'certification-tier';
  anonymized: true;
  cohortSize: number;
  minCohortSize: number;
  policyId: string;
  permittedUse: string[];
  prohibitedUse: string[];
  dimensions: string[];
  measures: Array<{ name: string; value: number; unit: string; aggregation: string }>;
  rawRecordRefs: [];
}

export interface IndustryAggregateKpiDto {
  kpiId: string;
  name: string;
  domain: string;
  aggregatedValue: number;
  unit: string;
  trackCount: number;
  federationVisibility: 'federation-aggregate';
  anonymized: true;
  rawRecordRefs: [];
}

export interface IndustryTrendComparisonDto {
  metricId: string;
  label: string;
  category: IndustryBenchmarkCategory;
  trackPoints: Array<{ at: string; value: number }>;
  industryMedianPoints: Array<{ at: string; value: number }>;
  trend: IndustryTrendDirection;
  varianceFromMedian: number;
  anonymized: true;
}

export interface IndustryScorecardPanelDto {
  panelId: string;
  domain: IndustryBenchmarkCategory | 'federation';
  label: string;
  trackScore: number;
  industryMedian: number;
  status: IndustryScorecardStatus;
  trend: IndustryTrendDirection;
  anonymized: true;
}

export interface IndustryIntelligenceGuardrailsDto {
  rawCrossTrackRecordSharing: false;
  crossTenantJoinsAllowed: false;
  aggregateOnly: true;
  federationGovernanceRespected: true;
  consentRequired: true;
  guardrailStatement: string;
}

export interface IndustryIntelligenceGovernanceDto {
  policyId: string;
  policyVersion: string;
  councilId: string;
  approvalRequired: true;
  allowedExports: string[];
  prohibitedFields: string[];
  consentRetentionBoundaries: Array<{ boundaryId: string; retentionDays: number; appliesTo: string[] }>;
}

export interface IndustryIntelligenceWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof industryIntelligenceSchemaVersion;
  organizationId: string;
  tenantId: string;
  racetrackId: string;
  anonymizedBenchmarks: IndustryAnonymizedBenchmarkDto[];
  federationAnalytics: IndustryFederationAnalyticDto[];
  aggregateKpis: IndustryAggregateKpiDto[];
  trendComparisons: IndustryTrendComparisonDto[];
  industryScorecards: IndustryScorecardPanelDto[];
  governance: IndustryIntelligenceGovernanceDto;
  guardrails: IndustryIntelligenceGuardrailsDto;
  cohortSummary: { participantTracks: number; anonymizedCohorts: number; minCohortSize: number };
  mock: false;
}

export interface IndustryIntelligenceDashboardDto {
  readinessScore: number;
  leadingDomains: number;
  watchDomains: number;
  panels: IndustryScorecardPanelDto[];
}

export function industryScorecardStatus(trackScore: number, industryMedian: number): IndustryScorecardStatus {
  const delta = trackScore - industryMedian;
  if (delta >= 5) return 'leading';
  if (delta >= -2) return 'on-par';
  if (delta >= -8) return 'watch';
  return 'lagging';
}
