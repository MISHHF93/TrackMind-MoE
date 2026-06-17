import type {
  OperationsCommandCenterDto,
  PlatformHealthWorkspaceDto,
  RaceDayReadinessDashboardDto,
  RacingDataWorkspaceDto,
} from '@trackmind/shared';
import type { ConsoleChart, ConsoleGraphEdge, ConsoleGraphNode, ConsoleChartPoint, OpsPosture } from '../../design/opsTypes';
import type { ConsoleAction } from '../../design/opsTypes';
import { navAction } from './util';

function point(id: string, label: string, value: number, posture?: OpsPosture, detail?: string): ConsoleChartPoint {
  return { id, label, value, posture, detail };
}

export function widgetStatusBarChart(widgets: OperationsCommandCenterDto['widgets'], action?: ConsoleAction): ConsoleChart {
  const counts = new Map<string, number>();
  for (const widget of widgets) {
    counts.set(widget.status, (counts.get(widget.status) ?? 0) + 1);
  }
  const postureForStatus = (status: string): OpsPosture => {
    if (status === 'critical') return 'critical';
    if (status === 'warning') return 'watch';
    if (status === 'advisory') return 'advisory';
    return 'ready';
  };

  return {
    id: 'widget-status-bar',
    title: 'Command widget posture',
    description: 'Distribution of widget status across the active command-center layout.',
    kind: 'bar',
    unit: 'widgets',
    series: [...counts.entries()].map(([status, value]) => point(`widget-${status}`, status, value, postureForStatus(status))),
    action,
  };
}

export function widgetDomainDonut(widgets: OperationsCommandCenterDto['widgets'], action?: ConsoleAction): ConsoleChart {
  const counts = new Map<string, number>();
  for (const widget of widgets) {
    counts.set(widget.domain, (counts.get(widget.domain) ?? 0) + 1);
  }

  return {
    id: 'widget-domain-donut',
    title: 'Operating domains',
    description: 'Widget coverage by backend operating domain.',
    kind: 'donut',
    unit: 'domains',
    series: [...counts.entries()].slice(0, 6).map(([domain, value], index) => point(`domain-${index}`, domain, value, 'advisory')),
    action,
  };
}

export function readinessGauge(averageScore: number, posture: OpsPosture, action?: ConsoleAction): ConsoleChart {
  return {
    id: 'readiness-gauge',
    title: 'Race-day readiness',
    description: 'Facade readiness score across race-day domains.',
    kind: 'gauge',
    unit: '%',
    maxValue: 100,
    series: [point('readiness-average', 'Average readiness', averageScore, posture)],
    action,
  };
}

export function readinessRaceBarChart(readiness: RaceDayReadinessDashboardDto, action?: ConsoleAction): ConsoleChart {
  return {
    id: 'race-readiness-bar',
    title: 'Per-race readiness',
    description: 'Readiness score by race on today\'s card.',
    kind: 'bar',
    unit: '%',
    maxValue: 100,
    series: readiness.races.slice(0, 8).map((race) => {
      const posture: OpsPosture = race.status === 'blocked' ? 'blocked' : race.status === 'watch' ? 'watch' : 'ready';
      return point(`race-${race.raceId}`, race.raceId, race.score, posture, race.postTime);
    }),
    action,
  };
}

export function surfaceSparkline(scores: number[], action?: ConsoleAction): ConsoleChart | undefined {
  if (scores.length < 2) return undefined;
  return {
    id: 'surface-sparkline',
    title: 'Surface score trend',
    description: 'Sector surface intelligence scores across the track map.',
    kind: 'sparkline',
    unit: 'score',
    maxValue: 100,
    series: scores.map((value, index) => point(`sector-${index}`, `S${index + 1}`, value, value >= 80 ? 'ready' : 'watch')),
    action,
  };
}

export function approvalEngineDonut(engine: PlatformHealthWorkspaceDto['approvalEngine'], action?: ConsoleAction): ConsoleChart {
  return {
    id: 'approval-engine-donut',
    title: 'Approval engine mix',
    description: 'Pending, approved, rejected, and escalated approval records.',
    kind: 'donut',
    series: [
      point('pending', 'Pending', engine.pending ?? 0, 'watch'),
      point('approved', 'Approved', engine.approved ?? 0, 'ready'),
      point('rejected', 'Rejected', engine.rejected ?? 0, 'blocked'),
      point('escalated', 'Escalated', engine.escalated ?? 0, 'critical'),
    ],
    action,
  };
}

export function serviceLatencyBar(services: PlatformHealthWorkspaceDto['services'], action?: ConsoleAction): ConsoleChart {
  return {
    id: 'service-latency-bar',
    title: 'Service latency',
    description: 'Facade service latency in milliseconds.',
    kind: 'bar',
    unit: 'ms',
    series: (services ?? []).slice(0, 8).map((service) => point(
      service.serviceId,
      service.serviceId.split('-').pop() ?? service.serviceId,
      service.latencyMs,
      service.status === 'critical' ? 'critical' : service.status === 'degraded' ? 'watch' : 'ready',
    )),
    action,
  };
}

export function liveEventTimeline(
  events: Array<{ id: string; summary: string; severity: string; timestamp: string }>,
  action?: ConsoleAction,
): ConsoleChart {
  const severityPosture = (severity: string): OpsPosture => {
    if (severity === 'critical') return 'critical';
    if (severity === 'warning') return 'watch';
    return 'advisory';
  };

  return {
    id: 'live-event-timeline',
    title: 'Live event timeline',
    description: 'Recent command-center events by severity.',
    kind: 'timeline',
    series: events.slice(0, 6).map((event) => point(event.id, event.timestamp, 1, severityPosture(event.severity), event.summary)),
    action,
  };
}

export function lineageGraphFromWorkspace(workspace: RacingDataWorkspaceDto, action?: ConsoleAction): ConsoleChart | undefined {
  const lineage = workspace.lineage && typeof workspace.lineage === 'object'
    ? workspace.lineage as Record<string, unknown>
    : {};
  const rawNodes = Array.isArray(lineage.nodes) ? lineage.nodes : [];
  const rawEdges = Array.isArray(lineage.edges) ? lineage.edges : [];
  if (!rawNodes.length) return undefined;

  const nodes: ConsoleGraphNode[] = rawNodes.slice(0, 12).map((entry, index) => {
    const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return {
      id: String(record.id ?? `node-${index}`),
      label: String(record.label ?? record.name ?? `Node ${index + 1}`),
      kind: String(record.kind ?? record.type ?? 'node'),
      posture: 'advisory',
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: ConsoleGraphEdge[] = rawEdges.slice(0, 16).flatMap((entry, index) => {
    const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const from = String(record.from ?? record.source ?? '');
    const to = String(record.to ?? record.target ?? '');
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) return [];
    return [{
      id: String(record.id ?? `edge-${index}`),
      from,
      to,
      label: typeof record.label === 'string' ? record.label : undefined,
    }];
  });

  return {
    id: 'data-lineage-graph',
    title: 'Data lineage graph',
    description: 'Provider-to-canonical lineage nodes and edges from the racing data hub.',
    kind: 'graph',
    nodes,
    edges,
    action: action ?? navAction('Open compliance', '/compliance', 'Review license and export controls for lineage paths.'),
  };
}

export function postureBreakdownDonut(
  id: string,
  title: string,
  counts: Record<string, number>,
  postureMap: Record<string, OpsPosture>,
  action?: ConsoleAction,
): ConsoleChart {
  return {
    id,
    title,
    description: 'Status distribution for operator review.',
    kind: 'donut',
    series: Object.entries(counts).map(([label, value]) => point(`${id}-${label}`, label, value, postureMap[label] ?? 'advisory')),
    action,
  };
}

export function countBarChart(
  id: string,
  title: string,
  description: string,
  entries: Array<{ id: string; label: string; value: number; posture?: OpsPosture; detail?: string }>,
  unit?: string,
  action?: ConsoleAction,
): ConsoleChart {
  return {
    id,
    title,
    description,
    kind: 'bar',
    unit,
    series: entries.map((entry) => point(entry.id, entry.label, entry.value, entry.posture, entry.detail)),
    action,
  };
}
