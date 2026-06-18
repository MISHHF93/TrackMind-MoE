import type { AnalyticsWorkspaceDto, ExecutiveScorecardDto, KPIArtifact } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createAnalyticsWorkspace(
  kpiTrends: AnalyticsWorkspaceDto['kpiTrends'] = [],
  executive?: ExecutiveScorecardDto,
  kpis: KPIArtifact[] = [],
): AnalyticsWorkspaceDto {
  const readiness = kpis.find((kpi) => kpi.domain === 'race-day-operations')?.value ?? executive?.operations ?? 88;
  const openApprovals = kpis.find((kpi) => kpi.domain === 'approval-workflows')?.value ?? 4;
  const incidents = kpis.find((kpi) => kpi.domain === 'safety-incidents')?.value ?? 1;
  const attendance = kpis.find((kpi) => kpi.domain === 'fan-experience')?.value ?? 8420;
  const dataQuality = kpis.find((kpi) => kpi.domain === 'data-quality')?.value ?? 91;

  return {
    generatedAt: now(),
    executiveSummary: executive
      ? [
          { label: 'Overall executive score', value: executive.overall, trend: 'up', unit: 'score' },
          { label: 'Safety posture', value: executive.safety, trend: 'flat', unit: 'score' },
          { label: 'Compliance posture', value: executive.compliance, trend: 'flat', unit: 'score' },
          { label: 'Operations posture', value: executive.operations, trend: 'up', unit: 'score' },
        ]
      : [
          { label: 'Race-day readiness', value: readiness, trend: 'up', unit: 'score' },
          { label: 'Open approvals', value: openApprovals, trend: 'flat' },
          { label: 'Active incidents', value: incidents, trend: 'down' },
          { label: 'Fan attendance', value: attendance, trend: 'up', unit: 'guests' },
        ],
    kpiTrends: kpiTrends.length
      ? kpiTrends
      : kpis.slice(0, 4).map((kpi) => ({
          kpiId: kpi.kpiId,
          label: kpi.name,
          points: (kpi.historicalSnapshots ?? []).slice(-3).map((snapshot) => ({
            at: snapshot.calculatedAt,
            value: snapshot.value,
          })),
        })),
    forecastingReadiness: { score: Math.round(dataQuality * 0.8), modelsAvailable: ['readiness-forecast-v1', 'attendance-forecast-v1'], dataQualityScore: dataQuality },
    federationBenchmarks: [
      { metric: 'readiness-score', trackValue: readiness, industryMedian: Math.max(0, readiness - 4), anonymized: true },
      { metric: 'incident-rate', trackValue: 0.02, industryMedian: 0.03, anonymized: true },
    ],
    mock: false,
  };
}
