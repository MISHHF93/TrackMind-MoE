import type { OperationsCommandCenterDto, PlatformHealthWorkspaceDto } from '@trackmind/shared';
import type { ConsolePayload, ConsoleQueue, OpsPosture } from '../../design/opsTypes';
import { routeById } from '../../routes/routes';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import { enrichConsoleWithSharedContext, loadSharedContext } from './commonContext';
import {
  approvalEngineDonut,
  liveEventTimeline,
  widgetDomainDonut,
  widgetStatusBarChart,
} from './charts';
import { commandCenterLifecycleLanes } from './lifecycle';
import { countMetric, navAction, postureFromHealth, requireReady, textMetric } from './util';

const dashboardDrillDownRouteMap: Record<string, string> = {
  '/race-office': '/race-day',
  '/surface': '/race-day',
  '/emergency': '/incidents',
  '/operations': '/dashboard',
  '/platform-health': '/admin',
  '/starting-gate': '/race-day',
  '/workforce': '/facilities',
};

function frontendPathForBackendDrilldown(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    const url = new URL(path, 'https://trackmind.local');
    const pathname = url.pathname;
    const currentRoute = Object.values(routeById).find((route) => route.path === pathname);
    return currentRoute?.path ?? dashboardDrillDownRouteMap[pathname];
  } catch {
    return undefined;
  }
}

function widgetPosture(status: string): OpsPosture {
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'watch';
  if (status === 'advisory') return 'advisory';
  return 'ready';
}

function alertPosture(severity: string): OpsPosture {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'watch';
  return 'advisory';
}

function postureLabel(posture: OpsPosture): string {
  if (posture === 'critical') return 'Critical attention required';
  if (posture === 'watch') return 'Degraded — review queues';
  if (posture === 'blocked') return 'Blocked — approvals required';
  if (posture === 'advisory') return 'Advisory signals active';
  return 'Operating normally';
}

function routeLabelForPath(path: string): string {
  return Object.values(routeById).find((route) => route.path === path)?.label ?? 'workspace';
}

export async function loadCommandCenterConsole(): Promise<ConsolePayload> {
  const [operations, health, shared] = await Promise.all([
    getJson<OperationsCommandCenterDto>(apiPaths.dashboard.operations),
    getJson<PlatformHealthWorkspaceDto>(apiPaths.dashboard.platformHealth),
    loadSharedContext('dashboard'),
  ]);

  const operationsData = requireReady(operations, 'Operations command center');
  const healthData = health.status === 'ready' && health.data
    ? health.data
    : { generatedAt: operationsData.generatedAt, overallStatus: 'degraded' } as PlatformHealthWorkspaceDto;

  const contextDegraded = health.status === 'error'
    ? [`Platform health unavailable: ${health.message ?? 'unknown error'}`]
    : undefined;

  const widgets = Array.isArray(operationsData.widgets) ? operationsData.widgets : [];
  const activeLayout = Array.isArray(operationsData.savedLayouts)
    ? operationsData.savedLayouts.find((layout) => layout.id === operationsData.activeLayoutId)
    : undefined;
  const activeWidgetIds = new Set(activeLayout?.widgetIds ?? widgets.map((widget) => widget.id));
  const visibleWidgets = widgets.filter((widget) => activeWidgetIds.has(widget.id));
  const alerts = Array.isArray(operationsData.alerts) ? operationsData.alerts : [];
  const liveEvents = Array.isArray(operationsData.liveEvents) ? operationsData.liveEvents : [];
  const aiRecommendations = Array.isArray(operationsData.aiRecommendations) ? operationsData.aiRecommendations : [];

  const attentionWidgets = visibleWidgets.filter((widget) => widget.status === 'warning' || widget.status === 'critical');
  const unacknowledgedAlerts = alerts.filter((alert) => !alert.acknowledged);
  const urgentEvents = liveEvents.filter((event) => event.severity === 'warning' || event.severity === 'critical');

  const widgetQueue: ConsoleQueue = {
    id: 'command-widgets',
    title: 'Workstreams requiring review',
    description: 'Command widgets in warning or critical posture with navigation to the owning console.',
    items: attentionWidgets.map((widget) => {
      const path = frontendPathForBackendDrilldown(widget.drillDownPath) ?? '/dashboard';
      return {
        id: widget.id,
        title: widget.title,
        summary: `${widget.value} — ${widget.detail}`,
        posture: widgetPosture(widget.status),
        evidence: [widget.source, widget.domain, apiPaths.dashboard.operations],
        actions: [
          navAction(`Open ${routeLabelForPath(path)}`, path, `Review ${widget.title} in the ${routeLabelForPath(path)} console.`),
          navAction('Review approvals', '/approvals', 'Check whether protected actions for this workstream are awaiting human approval.'),
        ],
      };
    }),
  };

  const alertQueue: ConsoleQueue = {
    id: 'command-alerts',
    title: 'Priority alert queue',
    description: 'Operational alerts routed from the command center facade; acknowledgement is backend-owned.',
    items: unacknowledgedAlerts.map((alert) => {
      const path = frontendPathForBackendDrilldown(alert.actionPath) ?? '/incidents';
      return {
        id: alert.id,
        title: alert.title,
        summary: `${alert.severity} alert awaiting operator review.`,
        posture: alertPosture(alert.severity),
        evidence: alert.evidence.length ? alert.evidence : [apiPaths.dashboard.operations],
        actions: [
          navAction(`Open ${routeLabelForPath(path)}`, path, `Investigate ${alert.title} in the ${routeLabelForPath(path)} console.`),
          navAction('Review incidents', '/incidents', 'Open the incidents console for security and emergency response context.'),
        ],
      };
    }),
  };

  const eventQueue: ConsoleQueue = {
    id: 'command-live-events',
    title: 'Live event signals',
    description: 'Recent high-severity command-center events requiring operator routing.',
    items: urgentEvents.slice(0, 6).map((event) => ({
      id: event.id,
      title: event.summary,
      summary: `${event.severity} ${event.type} from ${event.source} (${event.domain}).`,
      posture: alertPosture(event.severity),
      evidence: [event.type, event.domain, event.source],
      actions: [
        navAction('Open race day readiness', '/race-day', 'Review race-day posture if this signal affects post-time readiness.'),
        navAction('Review incidents', '/incidents', 'Open incidents if this signal indicates safety or security escalation.'),
        navAction('Review audit ledger', '/audit', 'Trace immutable audit evidence linked to this event domain.'),
      ],
    })),
  };

  const posture = postureFromHealth(healthData.overallStatus);
  const pendingApprovals = healthData.approvalEngine?.pending ?? 0;
  const { lanes, signals } = commandCenterLifecycleLanes(operationsData, frontendPathForBackendDrilldown, routeLabelForPath);

  const base: ConsolePayload = {
    routeId: 'dashboard',
    title: routeById.dashboard.label,
    mission: 'Start each operating session with race-day posture, approval queues, audit evidence, and AI advisories.',
    posture,
    postureLabel: postureLabel(posture),
    postureScore: healthData.approvalEngine?.pending !== undefined ? Math.max(0, 100 - pendingApprovals * 5) : undefined,
    generatedAt: operationsData.generatedAt ?? healthData.generatedAt,
    source: operations.source,
    primaryActions: [
      navAction('Open race day readiness', '/race-day', 'Review race office readiness, surface conditions, and track configuration before post time.', 'primary'),
      navAction('Review incidents', '/incidents', 'Open security and emergency operations for active incident response.', 'primary'),
      navAction('Review approval queue', '/approvals', 'Inspect pending human approval requests blocking protected actions.', 'primary'),
    ],
    lifecycleLanes: lanes,
    liveSignals: signals,
    charts: [
      widgetStatusBarChart(visibleWidgets, navAction('Review race day', '/race-day', 'Open race-day readiness console.')),
      widgetDomainDonut(visibleWidgets),
      approvalEngineDonut(healthData.approvalEngine ?? { pending: 0, approved: 0, rejected: 0, escalated: 0, expired: 0, status: 'healthy' }, navAction('Review approvals', '/approvals', 'Open approval review console.')),
      liveEventTimeline(liveEvents, navAction('Review incidents', '/incidents', 'Escalate live events to incident response.')),
    ],
    queues: [alertQueue, widgetQueue, eventQueue].filter((queue) => queue.items.length > 0),
    metrics: [
      countMetric('Active command widgets', visibleWidgets.length, 'Rendered widgets from the active command-center layout'),
      textMetric('Platform status', healthData.overallStatus, 'Reference health metadata from /platform/health', posture),
      countMetric('Unacknowledged alerts', unacknowledgedAlerts.length, 'Alerts awaiting operator review', unacknowledgedAlerts.length ? 'watch' : 'ready'),
      countMetric('Pending approvals', pendingApprovals, 'Approval engine queue from platform health metadata', pendingApprovals ? 'watch' : 'ready', navAction('Review approvals', '/approvals', 'Open the approval review console.')),
      countMetric('AI advisories', aiRecommendations.length, 'Command-center AI recommendations requiring human review', aiRecommendations.length ? 'advisory' : 'ready'),
    ],
    advisories: aiRecommendations.map((item) => {
      const path = frontendPathForBackendDrilldown(item.actionPath) ?? '/settings';
      return {
        id: item.id,
        recommendation: item.recommendation,
        posture: item.requiresApproval ? 'watch' : 'advisory',
        requiresApproval: item.requiresApproval !== false,
        actions: [
          navAction(`Open ${routeLabelForPath(path)}`, path, 'Review the workspace referenced by this AI advisory.'),
          navAction('Review AI guardrails', '/settings', 'Inspect read-only AI guardrails and protected-action boundaries.'),
        ],
      };
    }),
    contextDegraded,
  };

  return enrichConsoleWithSharedContext(base, shared, { skipApprovalQueue: true, skipSharedAdvisories: true });
}
