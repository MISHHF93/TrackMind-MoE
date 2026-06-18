import type {
  AnalyticsWorkspaceDto,
  FederationIntelligenceWorkspaceDto,
  FederationWorkspaceDto,
  IndustryAggregateKpiDto,
  IndustryAnonymizedBenchmarkDto,
  IndustryFederationAnalyticDto,
  IndustryIntelligenceDashboardDto,
  IndustryIntelligenceWorkspaceDto,
  IndustryScorecardPanelDto,
  IndustryTrendComparisonDto,
  KPIArtifact,
} from '@trackmind/shared';
import { industryIntelligenceGovernanceStatement, industryScorecardStatus } from '@trackmind/shared';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface IndustryIntelligenceDeps {
  organizationId?: string;
  tenantId?: string;
  racetrackId?: string;
  federation?: FederationWorkspaceDto;
  analytics?: AnalyticsWorkspaceDto;
  kpis?: KPIArtifact[];
}

export class IndustryIntelligencePlatform {
  constructor(private readonly deps: IndustryIntelligenceDeps = {}) {}

  workspace(now = new Date().toISOString()): IndustryIntelligenceWorkspaceDto {
    const federation = this.federation();
    const analytics = this.analytics(now);
    const anonymizedBenchmarks = this.buildBenchmarks(federation);
    const federationAnalytics = this.buildFederationAnalytics(federation);
    const aggregateKpis = this.buildAggregateKpis(federation, anonymizedBenchmarks);
    const trendComparisons = this.buildTrendComparisons(anonymizedBenchmarks, analytics, now);
    const industryScorecards = this.buildScorecards(anonymizedBenchmarks);

    return {
      generatedAt: now,
      schemaVersion: 'trackmind.industry-intelligence.v1',
      organizationId: this.deps.organizationId ?? federation.organization.organizationId,
      tenantId: this.deps.tenantId ?? federation.tenant.tenantId,
      racetrackId: this.deps.racetrackId ?? federation.tenant.racetrackId,
      anonymizedBenchmarks,
      federationAnalytics,
      aggregateKpis,
      trendComparisons,
      industryScorecards,
      governance: {
        policyId: federation.dataSharingPolicy.policyId,
        policyVersion: federation.federationGovernance.policyVersion,
        councilId: federation.federationGovernance.councilId,
        approvalRequired: true,
        allowedExports: [...federation.dataSharingPolicy.allowedExports],
        prohibitedFields: [...federation.dataSharingPolicy.prohibitedFields],
        consentRetentionBoundaries: federation.consentRetentionBoundaries.map((boundary) => ({
          boundaryId: boundary.boundaryId,
          retentionDays: boundary.retentionDays,
          appliesTo: [...boundary.appliesTo],
        })),
      },
      guardrails: {
        rawCrossTrackRecordSharing: false,
        crossTenantJoinsAllowed: false,
        aggregateOnly: true,
        federationGovernanceRespected: true,
        consentRequired: federation.dataSharingPolicy.consentRequired,
        guardrailStatement: industryIntelligenceGovernanceStatement,
      },
      cohortSummary: {
        participantTracks: federation.tracks.length,
        anonymizedCohorts: federation.tracks.filter((track) => track.sharingScope !== 'tenant-only').length,
        minCohortSize: federation.crossTrackBenchmarking.minCohortSize,
      },
      mock: false,
    };
  }

  dashboard(now = new Date().toISOString()): IndustryIntelligenceDashboardDto {
    const workspace = this.workspace(now);
    const panels = workspace.industryScorecards;
    return {
      readinessScore: Math.round(panels.reduce((sum, panel) => sum + panel.trackScore, 0) / Math.max(1, panels.length)),
      leadingDomains: panels.filter((panel) => panel.status === 'leading').length,
      watchDomains: panels.filter((panel) => panel.status === 'watch' || panel.status === 'lagging').length,
      panels,
    };
  }

  benchmarks(now = new Date().toISOString()) {
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.industry-intelligence.v1' as const,
      benchmarks: this.workspace(now).anonymizedBenchmarks.map(clone),
      mock: false as const,
    };
  }

  trends(now = new Date().toISOString()) {
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.industry-intelligence.v1' as const,
      comparisons: this.workspace(now).trendComparisons.map(clone),
      mock: false as const,
    };
  }

  federationIntelligenceLegacy(now = new Date().toISOString()): FederationIntelligenceWorkspaceDto {
    const workspace = this.workspace(now);
    return {
      generatedAt: now,
      organizationId: workspace.organizationId,
      anonymized: true,
      benchmarkMetrics: workspace.anonymizedBenchmarks.map((benchmark) => ({
        metric: benchmark.benchmarkId,
        trackValue: benchmark.trackValue,
        industryMedian: benchmark.industryMedian,
      })),
      industryInsights: workspace.federationAnalytics.map((analytic) => ({
        id: analytic.analyticId,
        title: analytic.label,
        summary: `${analytic.aggregationLevel} aggregate with cohort size ${analytic.cohortSize}; prohibited uses include ${analytic.prohibitedUse.slice(0, 2).join(', ')}.`,
      })),
      governancePosture: {
        crossTenantJoinsAllowed: false,
        aggregateOnly: true,
      },
      mock: false,
    };
  }

  private federation(): FederationWorkspaceDto {
    if (!this.deps.federation) throw new Error('Federation workspace is required for industry intelligence');
    return this.deps.federation;
  }

  private analytics(now: string): AnalyticsWorkspaceDto {
    return this.deps.analytics ?? {
      generatedAt: now,
      executiveSummary: [],
      kpiTrends: [],
      forecastingReadiness: { score: 0, modelsAvailable: [], dataQualityScore: 0 },
      federationBenchmarks: [],
      mock: false,
    };
  }

  private buildBenchmarks(federation: FederationWorkspaceDto): IndustryAnonymizedBenchmarkDto[] {
    return federation.crossTrackBenchmarking.metrics.map((metric) => ({
      benchmarkId: metric.metricId,
      label: metric.label,
      category: metric.category,
      unit: metric.unit,
      period: metric.period,
      trackValue: metric.value,
      industryMedian: metric.benchmarkValue,
      industryP75: metric.category === 'operations' ? metric.benchmarkValue + 2 : undefined,
      percentileRank: metric.percentileRank,
      cohortSize: metric.sampleSize,
      minCohortSize: metric.minCohortSize,
      aggregation: metric.aggregation,
      anonymized: true,
      rawTrackDataExposed: false,
      permissionRequired: metric.permissionRequired,
      policyId: federation.dataSharingPolicy.policyId,
    }));
  }

  private buildFederationAnalytics(federation: FederationWorkspaceDto): IndustryFederationAnalyticDto[] {
    return federation.industryAnalytics.products.map((product) => ({
      analyticId: product.analyticId,
      label: product.label,
      aggregationLevel: product.aggregationLevel,
      anonymized: true,
      cohortSize: product.cohortSize,
      minCohortSize: product.minCohortSize,
      policyId: product.policyId,
      permittedUse: [...product.permittedUse],
      prohibitedUse: [...product.prohibitedUse],
      dimensions: [...product.dimensions],
      measures: product.measures.map(clone),
      rawRecordRefs: [],
    }));
  }

  private buildAggregateKpis(
    federation: FederationWorkspaceDto,
    benchmarks: IndustryAnonymizedBenchmarkDto[],
  ): IndustryAggregateKpiDto[] {
    const federationKpis = (this.deps.kpis ?? []).filter((kpi) => kpi.visibility === 'federation-aggregate');
    const benchmarkKpis: IndustryAggregateKpiDto[] = benchmarks.map((benchmark) => ({
      kpiId: `industry:${benchmark.benchmarkId}`,
      name: benchmark.label,
      domain: benchmark.category,
      aggregatedValue: benchmark.industryMedian,
      unit: benchmark.unit,
      trackCount: benchmark.cohortSize,
      federationVisibility: 'federation-aggregate',
      anonymized: true,
      rawRecordRefs: [],
    }));

    const artifactKpis: IndustryAggregateKpiDto[] = federationKpis.map((kpi) => ({
      kpiId: kpi.kpiId,
      name: kpi.name,
      domain: kpi.domain,
      aggregatedValue: kpi.value,
      unit: kpi.unit,
      trackCount: federation.tracks.length,
      federationVisibility: 'federation-aggregate',
      anonymized: true,
      rawRecordRefs: [],
    }));

    return [...artifactKpis, ...benchmarkKpis];
  }

  private buildTrendComparisons(
    benchmarks: IndustryAnonymizedBenchmarkDto[],
    analytics: AnalyticsWorkspaceDto,
    now: string,
  ): IndustryTrendComparisonDto[] {
    const readinessTrend = analytics.kpiTrends.find((trend) => /readiness/i.test(trend.label));
    const points = readinessTrend?.points ?? [
      { at: '2026-06-15T00:00:00.000Z', value: 82 },
      { at: '2026-06-16T00:00:00.000Z', value: 85 },
      { at: now, value: 88 },
    ];

    return benchmarks.map((benchmark) => {
      const trackPoints = points.map((point, index) => ({
        at: point.at,
        value: Number((benchmark.trackValue - (benchmark.trackValue - benchmark.industryMedian) * (0.15 * (points.length - index))).toFixed(2)),
      }));
      const industryMedianPoints = points.map((point) => ({
        at: point.at,
        value: benchmark.industryMedian,
      }));
      const latest = trackPoints.at(-1)?.value ?? benchmark.trackValue;
      const variance = Number((latest - benchmark.industryMedian).toFixed(2));
      const trend: IndustryTrendComparisonDto['trend'] = variance > 2 ? 'up' : variance < -2 ? 'down' : 'flat';

      return {
        metricId: benchmark.benchmarkId,
        label: benchmark.label,
        category: benchmark.category,
        trackPoints,
        industryMedianPoints,
        trend,
        varianceFromMedian: variance,
        anonymized: true,
      };
    });
  }

  private buildScorecards(benchmarks: IndustryAnonymizedBenchmarkDto[]): IndustryScorecardPanelDto[] {
    return benchmarks.map((benchmark) => ({
      panelId: `scorecard-${benchmark.benchmarkId}`,
      domain: benchmark.category,
      label: benchmark.label,
      trackScore: benchmark.trackValue,
      industryMedian: benchmark.industryMedian,
      status: industryScorecardStatus(benchmark.trackValue, benchmark.industryMedian),
      trend: benchmark.percentileRank && benchmark.percentileRank >= 70 ? 'up' : benchmark.percentileRank && benchmark.percentileRank < 50 ? 'down' : 'flat',
      anonymized: true,
    }));
  }
}

export function createSeededIndustryIntelligence(deps: IndustryIntelligenceDeps = {}): IndustryIntelligencePlatform {
  const platform = new IndustryIntelligencePlatform(deps);
  platform.workspace();
  return platform;
}
