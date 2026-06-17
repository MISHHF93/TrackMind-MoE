import type { RacingDataWorkspaceDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsolePayload } from '../../design/opsTypes';
import { loadSharedContext } from './commonContext';
import { dataHubLifecycleLanes } from './lifecycle';
import { countBarChart, lineageGraphFromWorkspace } from './charts';
import { countMetric, navAction, requireReady } from './util';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export async function loadDataHubConsole(): Promise<ConsolePayload> {
  const [workspace, shared] = await Promise.all([
    getJson<RacingDataWorkspaceDto>(apiPaths.dataHub.workspace),
    loadSharedContext(),
  ]);
  const data = requireReady(workspace, 'Racing data hub');
  const providers = Array.isArray(data.providers) ? data.providers : [];
  const qualityReports = Array.isArray(data.qualityReports) ? data.qualityReports : [];
  const lineageChart = lineageGraphFromWorkspace(data);

  return {
    routeId: 'dataHub',
    title: 'Racing Data Governance',
    mission: 'Govern licensed providers, lineage, and exports — no live external scrape from the frontend.',
    posture: qualityReports.length ? 'watch' : 'ready',
    postureLabel: 'Provider readiness review',
    generatedAt: data.generatedAt,
    source: workspace.source,
    primaryActions: [
      navAction('Compliance lane', '/compliance', 'License and control mapping.', 'primary'),
      navAction('Federation policy', '/federation', 'Cross-track sharing rules.'),
      navAction('AI guardrails', '/settings', 'Data quality AI policy.'),
    ],
    lifecycleLanes: dataHubLifecycleLanes(data),
    charts: [
      countBarChart(
        'provider-counts',
        'Provider readiness',
        'Licensed providers by sync mode.',
        providers.slice(0, 8).map((provider, index) => {
          const record = asRecord(provider);
          const id = String(record.id ?? record.providerId ?? `provider-${index}`);
          return {
            id,
            label: String(record.displayName ?? record.name ?? id).slice(0, 8),
            value: record.enabled === false ? 0 : 1,
            posture: record.enabled === false ? 'watch' : 'ready',
            detail: String(record.syncMode ?? 'declared sync'),
          };
        }),
        'active',
        navAction('Audit context', '/audit', 'Provider governance evidence.'),
      ),
      ...(lineageChart ? [lineageChart] : []),
    ],
    queues: [
      {
        id: 'provider-readiness',
        title: 'Provider readiness',
        items: providers.slice(0, 8).map((provider, index) => {
          const record = asRecord(provider);
          const id = String(record.id ?? record.providerId ?? `provider-${index}`);
          return {
            id,
            title: String(record.displayName ?? record.name ?? id),
            summary: String(record.syncMode ?? 'declared sync'),
            posture: record.enabled === false ? 'watch' : 'ready',
            evidence: ['RacingDataWorkspaceDto', id],
            actions: [navAction('Audit context', '/audit', 'Provider governance evidence.')],
          };
        }),
      },
      {
        id: 'quality-issues',
        title: 'Quality reports',
        items: qualityReports.slice(0, 6).map((report, index) => {
          const record = asRecord(report);
          return {
            id: String(record.id ?? record.reportId ?? `quality-${index}`),
            title: String(record.kind ?? 'Quality report'),
            summary: String(record.dataQualityImpactSummary ?? 'Provider data check'),
            posture: 'watch',
            evidence: ['data-quality-report'],
            actions: [navAction('Review compliance', '/compliance', 'License impact review.')],
          };
        }),
      },
    ],
    metrics: [
      countMetric('Providers', providers.length, 'Licensed provider metadata', 'ready'),
      countMetric('Quality reports', qualityReports.length, 'Data quality findings', qualityReports.length ? 'watch' : 'ready'),
      countMetric('Ingestion jobs', Array.isArray(data.ingestionJobs) ? data.ingestionJobs.length : 0, 'Local job metadata only', 'advisory'),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
