import { useEffect, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Role } from '@trackmind/shared';
import { backendSupportLabels } from '@/domain/support';
import {
  extractApprovalControls,
  mergeWorkspaceActions,
  resolveDefaultRaceTarget,
  roleCanUseAction,
} from '@/domain/approvalControls';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { routeById, type DomainRouteId } from '@/routes/routes';
import { useWorkspaceData, extractArray, stringField, type WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { useWorkspaceContext } from '@/hooks/useWorkspaceContext';
import { LoadingState, ErrorState, EmptyState } from '@/design/components/states';
import { SupportStatusBadge } from '@/shell/SupportStatusBadge';
import { Badge } from '@/design/components/badge';
import { DegradedStateBanner } from '@/shell/DegradedStateBanner';
import {
  AdvisoryCard,
  DataTable,
  EvidencePanel,
  JsonPanel,
  MetricGrid,
  PriorityQueue,
  type OpsPosture,
  type WorkspaceAction,
  type WorkspaceAdvisory,
  type WorkspaceMetric,
  type WorkspaceQueueItem,
} from '@/design/components/workspace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/design/components/tabs';
import { isRecord as isObj } from '@/lib/utils';
import { extractAllRecommendations, extractAllWarnings, extractAllIncidents, numericField } from './feedUtils';
import { WorkspaceDomainPanels } from './views/WorkspaceDomainPanels';

function postureFromErrors(errors: number, warnings: number): OpsPosture {
  if (errors > 0) return 'critical';
  if (warnings > 0) return 'watch';
  return 'ready';
}

function buildMetrics(routeId: DomainRouteId, results: Array<{ path: string; status: string; data?: unknown }>): WorkspaceMetric[] {
  const readyCount = results.filter((r) => r.status === 'ready').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const metrics: WorkspaceMetric[] = [
    { id: 'feeds', label: 'Data feeds', value: String(readyCount), detail: `${results.length} backend paths`, posture: postureFromErrors(errorCount, results.length - readyCount - errorCount) },
    { id: 'route', label: 'Console', value: routeById[routeId].label, detail: backendSupportLabels[routeById[routeId].supportStatus] },
  ];

  for (const result of results) {
    if (!isObj(result.data)) continue;
    const primary = result.data;
    if (typeof primary.overallStatus === 'string' && !metrics.some((m) => m.id === 'status')) {
      metrics.push({ id: 'status', label: 'Overall status', value: primary.overallStatus, posture: primary.overallStatus === 'healthy' ? 'ready' : 'watch' });
    }
    if (typeof primary.generatedAt === 'string' && !metrics.some((m) => m.id === 'generated')) {
      metrics.push({ id: 'generated', label: 'Generated', value: new Date(primary.generatedAt).toLocaleString() });
    }
    const readiness = numericField(primary, 'readinessScore') ?? numericField(primary, 'averageScore');
    if (readiness != null && !metrics.some((m) => m.id === 'readiness')) {
      metrics.push({ id: 'readiness', label: 'Readiness', value: `${readiness}%`, posture: readiness >= 80 ? 'ready' : 'watch' });
    }
    const surfaceScore = numericField(primary, 'overallScore');
    if (surfaceScore != null && !metrics.some((m) => m.id === 'surface')) {
      metrics.push({ id: 'surface', label: 'Surface score', value: String(surfaceScore) });
    }
  }

  return metrics.slice(0, 6);
}

function buildQueue(routeId: DomainRouteId, results: WorkspaceDataResult[]): WorkspaceQueueItem[] {
  const items: WorkspaceQueueItem[] = [];

  for (const result of results) {
    const approvals = extractArray<Record<string, unknown>>(result.data, 'approvals');
    for (const approval of approvals) {
      items.push({
        id: String(approval.id ?? approval.approvalRequestId ?? Math.random()),
        title: String(approval.action ?? approval.actionType ?? approval.title ?? 'Approval request'),
        detail: String(approval.status ?? approval.state ?? 'pending'),
        posture: String(approval.status).includes('reject') ? 'critical' : 'watch',
        meta: String(approval.target ?? ''),
        href: '/approvals',
      });
    }

    const alerts = extractArray<Record<string, unknown>>(result.data, 'alerts');
    for (const alert of alerts) {
      items.push({
        id: String(alert.id ?? Math.random()),
        title: String(alert.title ?? alert.summary ?? 'Alert'),
        detail: String(alert.detail ?? alert.message ?? ''),
        posture: alert.severity === 'critical' ? 'critical' : 'advisory',
      });
    }

    if (routeId === 'audit') {
      const events = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : extractArray<Record<string, unknown>>(result.data, 'events');
      for (const event of events.slice(0, 8)) {
        items.push({
          id: String(event.id ?? event.eventId ?? Math.random()),
          title: String(event.action ?? event.eventType ?? 'Audit event'),
          detail: String(event.target ?? event.summary ?? ''),
          meta: String(event.timestamp ?? ''),
        });
      }
    }
  }

  for (const warning of extractAllWarnings(results)) {
    items.push({
      id: String(warning.id ?? Math.random()),
      title: String(warning.title ?? warning.summary ?? 'Warning'),
      detail: String(warning.detail ?? warning.recommendedAction ?? ''),
      posture: 'watch',
    });
  }

  for (const incident of extractAllIncidents(results)) {
    items.push({
      id: String(incident.id ?? Math.random()),
      title: String(incident.title ?? incident.summary ?? 'Incident'),
      detail: String(incident.status ?? incident.severity ?? ''),
      posture: incident.severity === 'critical' ? 'critical' : 'advisory',
      href: '/incidents',
    });
  }

  return items.slice(0, 12);
}

function buildAdvisories(results: WorkspaceDataResult[]): WorkspaceAdvisory[] {
  const advisories: WorkspaceAdvisory[] = [];
  for (const rec of extractAllRecommendations(results)) {
    advisories.push({
      id: String(rec.id ?? Math.random()),
      title: String(rec.title ?? rec.summary ?? rec.action ?? 'AI recommendation'),
      detail: String(rec.detail ?? rec.rationale ?? rec.recommendation ?? rec.reason ?? ''),
      confidence: rec.confidence != null ? String(rec.confidence) : undefined,
      domain: typeof rec.domain === 'string' ? rec.domain : undefined,
    });
  }
  return advisories.slice(0, 6);
}

function buildActions(routeId: DomainRouteId, results: WorkspaceDataResult[], role: Role): WorkspaceAction[] {
  const raceTarget = resolveDefaultRaceTarget(results);
  const common: WorkspaceAction[] = [
    { id: 'nav-approvals', label: 'Open approvals', detail: 'Review the human approval queue.', href: '/approvals' },
  ];

  const byRoute: Partial<Record<DomainRouteId, WorkspaceAction[]>> = {
    raceDay: [
      { id: 'request-race-start', label: 'Request race start approval', detail: 'Create an approval-gated race start draft.', protectedAction: 'race-start', target: raceTarget, approvalApi: 'controlled-actions' },
      { id: 'request-scratch', label: 'Request scratch approval', detail: 'Create an approval-gated scratch draft.', protectedAction: 'scratch-horse', target: raceTarget, approvalApi: 'controlled-actions' },
    ],
    finance: [
      { id: 'request-payout', label: 'Request payout approval', detail: 'Dual-control payout request draft.', protectedAction: 'payout', target: 'payout-1', approvalApi: 'controlled-actions' },
    ],
    facilities: [
      { id: 'request-maintenance', label: 'Request maintenance approval', detail: 'Safety-critical maintenance draft.', protectedAction: 'facility-maintenance-execution', target: 'GATE_MAIN_01', approvalApi: 'controlled-actions' },
    ],
    emergency: [
      { id: 'request-emergency', label: 'Request emergency action approval', detail: 'Human-governed emergency workflow draft.', protectedAction: 'emergency-action', target: 'incident-1', approvalApi: 'controlled-actions' },
    ],
  };

  return mergeWorkspaceActions(
    extractApprovalControls(results),
    byRoute[routeId] ?? [],
    common,
  ).filter((action) => roleCanUseAction(action, role));
}

export function WorkspacePage({ routeId }: { routeId: DomainRouteId }): ReactElement {
  const route = routeById[routeId];
  const { session } = useTenantSession();
  const { data, isLoading, isError, error, refetch } = useWorkspaceData(routeId);
  const { setWorkspaceState } = useWorkspaceContext();
  const [searchParams] = useSearchParams();
  const focus = searchParams.get('event') ?? searchParams.get('payout') ?? searchParams.get('approval');

  useEffect(() => {
    if (!data) return;
    const errors = data.filter((item) => item.status === 'error').length;
    const posture = postureFromErrors(errors, 0);
    setWorkspaceState({
      posture,
      postureLabel: errors > 0 ? 'Degraded — some backend feeds unavailable' : `${route.label} operating normally`,
      primaryActions: buildActions(routeId, data, session.role),
    });
  }, [data, route.label, routeId, session.role, setWorkspaceState]);

  if (isLoading) return <LoadingState label={`Loading ${route.label}…`} />;

  const results = data ?? [];
  const allFailed = results.length > 0 && results.every((item) => item.status === 'error');
  const allEmpty = results.length > 0 && results.every((item) => item.status === 'empty');
  if (isError || allFailed) {
    const message = allFailed
      ? results.find((item) => item.message)?.message ?? 'All backend feeds are unavailable. Start the API with npm run start:api.'
      : (error as Error)?.message;
    return <ErrorState title="Backend unavailable" message={message} onRetry={() => void refetch()} />;
  }
  if (allEmpty) {
    return (
      <EmptyState
        title={`No ${route.label} data yet`}
        description="Backend feeds returned empty collections. Retry when race-day or governance data is available."
        onRetry={() => void refetch()}
      />
    );
  }

  const metrics = buildMetrics(routeId, results);
  const queue = buildQueue(routeId, results);
  const advisories = buildAdvisories(results);
  const hasErrors = results.some((item) => item.status === 'error');

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{route.label}</h1>
          <SupportStatusBadge status={route.supportStatus} />
          {hasErrors ? <Badge variant="warning">degraded</Badge> : <Badge variant="nominal">connected</Badge>}
        </div>
        <p className="text-sm text-[var(--muted-foreground)] max-w-3xl">{route.dataSource}</p>
        {focus ? <p className="text-xs text-[var(--muted-foreground)]">Deep link focus: <code>{focus}</code></p> : null}
      </header>

      <MetricGrid metrics={metrics} />

      {hasErrors ? (
        <DegradedStateBanner message="Some backend feeds are unavailable. The console remains accessible in degraded mode." />
      ) : null}

      <WorkspaceDomainPanels routeId={routeId} results={results} />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriorityQueue title="Cross-console queue" items={queue} emptyLabel="No queue items returned from backend feeds." />
        <AdvisoryCard advisories={advisories} />
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="feeds">Backend feeds</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <EvidencePanel title="Workspace summary">
            <DataTable
              columns={['Feed', 'Status', 'Preview']}
              rows={results.map((item) => [
                item.path,
                item.status,
                item.status === 'ready' ? stringField(item.data, 'summary', stringField(item.data, 'title', 'Ready')) : item.message ?? 'Unavailable',
              ])}
            />
          </EvidencePanel>
        </TabsContent>
        <TabsContent value="feeds" className="space-y-4">
          {results.map((item) => (
            <JsonPanel key={item.path} title={item.path} data={item.status === 'ready' ? item.data : { error: item.message }} />
          ))}
        </TabsContent>
      </Tabs>

    </div>
  );
}
