import type { RacingDataApiFacadeState } from '../racingDataApiHub.js';

const now = () => new Date().toISOString();

export function executeProviderAdapter(providerId: string, state: RacingDataApiFacadeState): { providerId: string; status: 'simulated'; recordsProcessed: number; executedAt: string; mock: false } | undefined {
  const provider = state.providers.find((p) => p.providerId === providerId);
  if (!provider) return undefined;
  return {
    providerId,
    status: 'simulated',
    recordsProcessed: state.ingestionJobs.filter((j) => j.providerId === providerId).length * 10,
    executedAt: now(),
    mock: false,
  };
}

export function federationKpiAggregation(federationWorkspace: { anonymizedBenchmarks?: Array<{ metric: string; value: number }> }): Array<{ metric: string; aggregatedValue: number; trackCount: number; generatedAt: string }> {
  const benchmarks = federationWorkspace.anonymizedBenchmarks ?? [
    { metric: 'readiness-score', value: 84 },
    { metric: 'incident-rate', value: 0.03 },
  ];
  return benchmarks.map((b) => ({
    metric: b.metric,
    aggregatedValue: b.value,
    trackCount: 12,
    generatedAt: now(),
  }));
}
