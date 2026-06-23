import { useEffect, useState, type ReactElement } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { Role } from '@trackmind/shared';
import { isReadOnlyOperationalRole } from '@trackmind/shared';
import { backendSupportLabels } from '@/domain/support';
import { extractApprovalControls, roleCanUseAction } from '@/domain/approvalControls';
import { mergeRoleQuickActions } from '@/domain/roleQuickActions';
import { buildRouteActions, roleFilterActions } from '@/domain/routeActions';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { routeById, type DomainRouteId } from '@/routes/routes';
import { useWorkspaceData, extractArray, stringField, type WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { useWorkspaceContext } from '@/hooks/useWorkspaceContext';
import { LoadingState, ErrorState, EmptyState } from '@/design/components/states';
import { SupportStatusBadge } from '@/shell/SupportStatusBadge';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import { DegradedStateBanner } from '@/shell/DegradedStateBanner';
import {
  AdvisoryCard,
  DataTable,
  EvidencePanel,
  JsonPanel,
  MetricGrid,
  PriorityQueue,
  type OpsPosture,
  type WorkspaceAdvisory,
  type WorkspaceMetric,
  type WorkspaceQueueItem,
} from '@/design/components/workspace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/design/components/tabs';
import { isRecord as isObj } from '@/lib/utils';
import { isDevJsonEnabled, toggleDevJsonEnabled } from '@/lib/devMode';
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

function buildQueue(routeId: DomainRouteId, results: WorkspaceDataResult[], role: Role, notificationChannels: readonly string[]): WorkspaceQueueItem[] {
  const items: WorkspaceQueueItem[] = [];

  for (const result of results) {
    const approvals = extractArray<Record<string, unknown>>(result.data, 'approvals');
    for (const approval of approvals) {
      const approvalId = String(approval.id ?? approval.approvalRequestId ?? '');
      const status = String(approval.status ?? approval.state ?? 'pending');
      items.push({
        id: approvalId || String(Math.random()),
        title: String(approval.action ?? approval.actionType ?? approval.title ?? 'Approval request'),
        detail: status,
        posture: status.includes('reject') ? 'critical' : 'watch',
        meta: String(approval.target ?? ''),
        href: approvalId ? undefined : '/approvals',
        approvalId: approvalId || undefined,
        itemKind: 'approval',
        focusHref: approvalId ? `/approvals?approval=${encodeURIComponent(approvalId)}` : undefined,
      });
    }

    const escalations = extractArray<Record<string, unknown>>(result.data, 'escalations');
    for (const escalation of escalations) {
      items.push({
        id: String(escalation.id ?? Math.random()),
        title: String(escalation.title ?? escalation.summary ?? 'Escalation'),
        detail: String(escalation.status ?? escalation.state ?? 'open'),
        posture: 'watch',
        itemKind: 'escalation',
        focusHref: `/security?focus=escalation-${String(escalation.id ?? '')}`,
      });
    }

    const alerts = extractArray<Record<string, unknown>>(result.data, 'alerts');
    for (const alert of alerts) {
      items.push({
        id: String(alert.id ?? Math.random()),
        title: String(alert.title ?? alert.summary ?? 'Alert'),
        detail: String(alert.detail ?? alert.message ?? ''),
        posture: alert.severity === 'critical' ? 'critical' : 'advisory',
        itemKind: 'alert',
        focusHref: routeId === 'incidents' ? undefined : '/incidents',
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
          focusHref: '/audit',
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
      itemKind: 'alert',
    });
  }

  for (const incident of extractAllIncidents(results)) {
    const incidentId = String(incident.id ?? '');
    items.push({
      id: incidentId || String(Math.random()),
      title: String(incident.title ?? incident.summary ?? 'Incident'),
      detail: String(incident.status ?? incident.severity ?? ''),
      posture: incident.severity === 'critical' ? 'critical' : 'advisory',
      href: '/incidents',
      incidentId: incidentId || undefined,
      itemKind: 'incident',
      focusHref: incidentId ? `/incidents?event=${encodeURIComponent(incidentId)}` : '/incidents',
    });
  }

  return items
    .filter((item) => {
      const channel = item.itemKind ?? 'operations';
      return notificationChannels.some((allowed) => channel.includes(allowed) || allowed.includes(channel));
    })
    .slice(0, 12);
}

function buildAdvisories(results: WorkspaceDataResult[]): WorkspaceAdvisory[] {
  const advisories: WorkspaceAdvisory[] = [];
  for (const rec of extractAllRecommendations(results)) {
    const domain = typeof rec.domain === 'string' ? rec.domain : undefined;
    advisories.push({
      id: String(rec.id ?? Math.random()),
      title: String(rec.title ?? rec.summary ?? rec.action ?? 'AI recommendation'),
      detail: String(rec.detail ?? rec.rationale ?? rec.recommendation ?? rec.reason ?? ''),
      confidence: rec.confidence != null ? String(rec.confidence) : undefined,
      domain,
      target: typeof rec.target === 'string' ? rec.target : undefined,
      protectedAction: typeof rec.action === 'string' ? rec.action : undefined,
    });
  }
  return advisories.slice(0, 6);
}

function buildActions(routeId: DomainRouteId, results: WorkspaceDataResult[], role: Role, quickActions: readonly string[]) {
  if (isReadOnlyOperationalRole(role)) return [];
  const backendActions = extractApprovalControls(results);
  const routeActions = roleFilterActions(buildRouteActions(routeId, results, backendActions, role), role, roleCanUseAction);
  return mergeRoleQuickActions(routeId, routeActions, quickActions);
}

export function WorkspacePage({ routeId }: { routeId: DomainRouteId }): ReactElement {
  const route = routeById[routeId];
  const { session } = useTenantSession();
  const roleWorkspace = useRoleWorkspace();
  const params = useParams();
  let pathParams: Record<string, string> | undefined;
  if (routeId === 'cctvCameraDetail' && params.cameraId) {
    pathParams = { cameraId: params.cameraId };
  } else if (routeId === 'iotDeviceDetail' && params.deviceId) {
    pathParams = { deviceId: params.deviceId };
  }
  const { data, isLoading, isError, error, refetch } = useWorkspaceData(routeId, pathParams);
  const { setWorkspaceState } = useWorkspaceContext();
  const [searchParams] = useSearchParams();
  const [devJson, setDevJson] = useState(isDevJsonEnabled);
  const focus = searchParams.get('event') ?? searchParams.get('payout') ?? searchParams.get('approval') ?? searchParams.get('focus');

  useEffect(() => {
    if (!data) return;
    const errors = data.filter((item) => item.status === 'error').length;
    const posture = postureFromErrors(errors, 0);
    setWorkspaceState({
      posture,
      postureLabel: errors > 0 ? 'Degraded — some backend feeds unavailable' : `${route.label} operating normally`,
      primaryActions: buildActions(routeId, data, session.role, roleWorkspace.quickActions),
    });
  }, [data, route.label, routeId, session.role, roleWorkspace.quickActions, setWorkspaceState]);

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
  const queue = buildQueue(routeId, results, session.role, roleWorkspace.notificationChannels);
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

      <WorkspaceDomainPanels routeId={routeId} results={results} role={session.role} kpiDomains={roleWorkspace.kpiDomains} />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriorityQueue title="Cross-console queue" items={queue} emptyLabel="No queue items returned from backend feeds." />
        <AdvisoryCard advisories={advisories} />
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          {import.meta.env.DEV ? (
            <TabsTrigger value="feeds">{devJson ? 'Developer JSON' : 'Developer'}</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="summary">
          <EvidencePanel title="Workspace summary">
            <DataTable
              columns={['Feed', 'Status', 'Preview']}
              rows={results.map((item) => [
                item.path,
                item.status,
                item.status === 'ready'
                  ? stringField(item.data, 'summary', stringField(item.data, 'title', Array.isArray(item.data) ? `${item.data.length} items` : 'Ready'))
                  : item.status === 'empty'
                    ? (Array.isArray(item.data) ? `${item.data.length} items` : item.emptyReason ?? 'No data')
                    : item.message ?? 'Unavailable',
              ])}
            />
          </EvidencePanel>
        </TabsContent>
        {import.meta.env.DEV ? (
          <TabsContent value="feeds" className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDevJson(toggleDevJsonEnabled())}
              >
                {devJson ? 'Hide raw JSON' : 'Show raw JSON'}
              </Button>
              <p className="text-xs text-[var(--muted-foreground)]">Developer-only backend feed inspector.</p>
            </div>
            {devJson ? results.map((item) => (
              <JsonPanel key={item.path} title={item.path} data={item.status === 'ready' ? item.data : { error: item.message }} />
            )) : null}
          </TabsContent>
        ) : null}
      </Tabs>

    </div>
  );
}
