import type { AnalyticsWorkspaceDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createAnalyticsWorkspace(kpiTrends: AnalyticsWorkspaceDto['kpiTrends'] = []): AnalyticsWorkspaceDto {
  return {
    generatedAt: now(),
    executiveSummary: [
      { label: 'Race-day readiness', value: 88, trend: 'up', unit: 'score' },
      { label: 'Open approvals', value: 4, trend: 'flat' },
      { label: 'Active incidents', value: 1, trend: 'down' },
      { label: 'Fan attendance', value: 8420, trend: 'up', unit: 'guests' },
    ],
    kpiTrends: kpiTrends.length
      ? kpiTrends
      : [
          {
            kpiId: 'race-day-readiness-score',
            label: 'Race Day Readiness',
            points: [
              { at: '2026-06-15T00:00:00.000Z', value: 82 },
              { at: '2026-06-16T00:00:00.000Z', value: 85 },
              { at: now(), value: 88 },
            ],
          },
        ],
    forecastingReadiness: { score: 72, modelsAvailable: ['readiness-forecast-v1', 'attendance-forecast-v1'], dataQualityScore: 91 },
    federationBenchmarks: [
      { metric: 'readiness-score', trackValue: 88, industryMedian: 84, anonymized: true },
      { metric: 'incident-rate', trackValue: 0.02, industryMedian: 0.03, anonymized: true },
    ],
    mock: false,
  };
}
