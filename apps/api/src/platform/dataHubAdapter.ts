import type { AnalyticsWorkspaceDto, FederationWorkspaceDto } from '@trackmind/shared';
import type { KPIArtifact } from '@trackmind/shared';
import type { RacingDataApiFacadeState } from '../racingDataApiHub.js';
import { findRacingDataProvider, findRacingDataStatus } from '../racingDataApiHub.js';

const now = () => new Date().toISOString();

export interface ProviderAdapterInvokeResult {
  providerId: string;
  status: 'simulated';
  recordsProcessed: number;
  executedAt: string;
  mock: false;
}

export interface FederationKpiAggregationRow {
  metric: string;
  aggregatedValue: number;
  trackCount: number;
  generatedAt: string;
}

function federationTrackCount(workspace: FederationWorkspaceDto): number {
  const cohortTracks = workspace.tracks.filter((track) => track.sharingScope !== 'tenant-only').length;
  const benchmarkSample = workspace.crossTrackBenchmarking?.metrics?.[0]?.sampleSize;
  return benchmarkSample ?? cohortTracks ?? workspace.tracks.length;
}

export function federationKpiAggregation(federationWorkspace: FederationWorkspaceDto | Record<string, unknown>): FederationKpiAggregationRow[] {
  const workspace = federationWorkspace as FederationWorkspaceDto;
  const metrics = workspace.crossTrackBenchmarking?.metrics ?? [];
  if (metrics.length > 0) {
    const trackCount = federationTrackCount(workspace);
    const generatedAt = workspace.generatedAt ?? now();
    return metrics.map((metric) => ({
      metric: metric.metricId,
      aggregatedValue: metric.benchmarkValue ?? metric.value,
      trackCount: metric.sampleSize ?? trackCount,
      generatedAt,
    }));
  }
  return [
    { metric: 'readiness-score', aggregatedValue: 84, trackCount: federationTrackCount(workspace), generatedAt: now() },
    { metric: 'incident-rate', aggregatedValue: 0.03, trackCount: federationTrackCount(workspace), generatedAt: now() },
  ];
}

function localTrackValueForMetric(metric: string, kpis: KPIArtifact[], fallback: number): number {
  if (/surface|readiness/i.test(metric)) {
    return kpis.find((kpi) => kpi.domain === 'race-day-operations' || kpi.domain === 'surface-intelligence')?.value ?? fallback;
  }
  if (/approval|sla/i.test(metric)) {
    return kpis.find((kpi) => kpi.domain === 'approval-workflows')?.value ?? fallback;
  }
  if (/platform-health|uptime/i.test(metric)) {
    return kpis.find((kpi) => kpi.domain === 'system-health')?.value ?? fallback;
  }
  if (/incident/i.test(metric)) {
    return kpis.find((kpi) => kpi.domain === 'safety-incidents')?.value ?? fallback;
  }
  if (/federation/i.test(metric)) {
    return kpis.find((kpi) => kpi.domain === 'multi-track-federation')?.value ?? fallback;
  }
  return fallback;
}

export function federationBenchmarksForAnalytics(
  aggregation: FederationKpiAggregationRow[],
  kpis: KPIArtifact[] = [],
): AnalyticsWorkspaceDto['federationBenchmarks'] {
  return aggregation.map((row) => {
    const industryMedian = row.aggregatedValue;
    const trackValue = localTrackValueForMetric(row.metric, kpis, industryMedian);
    return {
      metric: row.metric,
      trackValue,
      industryMedian,
      anonymized: true as const,
    };
  });
}

export function executeProviderAdapter(providerId: string, state: RacingDataApiFacadeState): ProviderAdapterInvokeResult | undefined {
  const provider = findRacingDataProvider(state, providerId);
  if (!provider) return undefined;
  const status = findRacingDataStatus(state, providerId);
  if (status?.status === 'suspended') return undefined;
  const jobRecords = state.ingestionJobs.filter((job) => job.providerId === providerId).length;
  const canonicalRecords = [
    ...state.canonical.raceCards,
    ...state.canonical.races,
    ...state.canonical.horses,
    ...state.canonical.entries,
    ...state.canonical.results,
  ].filter((envelope) => envelope.providerId === providerId).length;
  const recordsProcessed = Math.max(1, jobRecords * 10 + canonicalRecords);
  return {
    providerId,
    status: 'simulated',
    recordsProcessed,
    executedAt: now(),
    mock: false,
  };
}
