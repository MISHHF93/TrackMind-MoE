import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import type { WorkspaceCardAction, WorkspacePanel, WorkspaceViewModel } from '../domain/workspaceModel';
import { backendSupportLabels } from '../domain/support';
import type { AppRoute } from '../routes/routes';
import { currentSearch, navigate } from '../routes/navigation';
import { ActionButtons, AlertPanel, ApprovalCard, AuditCard, DataTable, EmptyState, ErrorState, KPICard, LoadingState, MetricCard, PageHeader, RecommendationCard, SectionCard, StatusBadge, TagList, WorkspaceRecordCard, supportStatusToTone } from '../components/ui';

interface WorkspacePageProps {
  route: AppRoute;
  state: {
    loading: boolean;
    data?: WorkspaceViewModel;
    error?: string;
  };
}

export function WorkspacePage({ route, state }: WorkspacePageProps): ReactElement {
  const supportLabel = backendSupportLabels[route.supportStatus];
  const [search, setSearch] = useState(() => currentSearch());
  const focus = focusFromSearch(search);

  useEffect(() => {
    const onPopState = () => setSearch(currentSearch());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (state.loading) {
    return <LoadingState label={route.label} source={route.dataSource} />;
  }

  if (state.error || !state.data) {
    return <ErrorState title={route.label} message={state.error ?? 'No route data returned.'} detail={`Support status: ${supportLabel}. This screen fails closed.`} />;
  }

  const { data } = state;
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const panels = Array.isArray(data.panels) ? data.panels : [];
  const approvals = Array.isArray(data.approvals) ? data.approvals : [];
  const auditEvents = Array.isArray(data.auditEvents) ? data.auditEvents : [];
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];
  const modelReadableKpiContext = Array.isArray(data.modelReadableKpiContext) ? data.modelReadableKpiContext : [];
  const aiRecommendations = Array.isArray(data.aiRecommendations) ? data.aiRecommendations : [];
  return (
    <section className="workspace">
      <PageHeader
        eyebrow={`${route.navigationGroup} / ${supportLabel}`}
        title={route.label}
        description={route.dataSource}
        accessory={<RouteContractCard route={route} supportLabel={supportLabel} />}
      />

      {focus ? (
        <aside className="focus-banner" aria-label="Navigation context">
          <strong>Navigation context</strong>
          <span>{focus.label}: {focus.value}</span>
          <button type="button" onClick={() => navigateWithinShell(route.path)}>Clear context</button>
        </aside>
      ) : null}

      <div className="metric-grid" aria-label={`${route.label} metrics`}>
        {metrics.map((metric) => (
          <MetricCard
            metric={metric}
            actions={<ActionButtons actions={metric.actions ?? actionsForMetric(metric.label, metric.value, metric.detail, route.path)} onNavigate={navigateWithinShell} />}
            key={metric.label}
          />
        ))}
      </div>

      <div className="workspace-grid">
        <SectionCard title="Route Data Cards" description="Cards show the route data and evidence returned by wired API or facade adapters. They do not execute regulated operations.">
          {panels.length === 0 ? (
            <EmptyState message="No records returned by the adapter." actions={<ActionButtons actions={[{ label: 'Open audit', path: '/audit', detail: 'Review available evidence for this route.' }]} onNavigate={navigateWithinShell} />} />
          ) : (
            panels.map((panel) => (
              <WorkspaceRecordCard
                panel={panel}
                actions={<ActionButtons actions={panel.actions ?? actionsForPanel(panel, route.path)} onNavigate={navigateWithinShell} />}
                key={panel.id}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="Approval And Audit Boundary" description="Regulated actions stay human-governed, approval-backed, and audit-linked.">
          <ApprovalBoundary approvals={approvals} auditEvents={auditEvents} />
          <AlertPanel title="Execution Guardrail" tone="critical">
            <p>Direct race starts, race stops, results, scratches, medication decisions, emergency actions, payouts, discipline, and enforcement are not rendered as buttons.</p>
            <ActionButtons actions={[{ label: 'Review AI policy', path: '/settings', detail: 'Open advisory-only AI policy context.' }]} onNavigate={navigateWithinShell} />
          </AlertPanel>
        </SectionCard>
      </div>

      <SectionCard title="Governed KPI Artifacts" description="KPI artifacts are rendered from typed contract fields with audit and model-use metadata.">
        {kpis.length === 0 ? (
          <EmptyState message="No KPI artifacts are visible for this route and role." actions={<ActionButtons actions={[{ label: 'Open audit', path: '/audit', detail: 'Review available KPI evidence.' }]} onNavigate={navigateWithinShell} />} />
        ) : (
          <div className="kpi-grid">
            {kpis.map((kpi) => (
              <KPICard
                kpi={kpi}
                modelContext={modelReadableKpiContext.find((context) => context.kpiId === kpi.kpiId)}
                actions={<ActionButtons actions={[
                  { label: 'View audit context', path: `/audit?kpi=${encodeURIComponent(kpi.kpiId)}`, detail: 'Open audit workspace with KPI context.' },
                  { label: 'Open approvals workspace', path: '/approvals', detail: 'Review approval boundary.' },
                ]} onNavigate={navigateWithinShell} />}
                key={kpi.kpiId}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Advisory AI" description="Recommendations expose evidence, confidence, model version, approval state, and audit references without execution controls.">
        {aiRecommendations.length === 0 ? (
          <EmptyState message="No AI recommendations returned for this route." actions={<ActionButtons actions={[{ label: 'Review AI policy', path: '/settings', detail: 'Open advisory-only AI policy.' }]} onNavigate={navigateWithinShell} />} />
        ) : (
          <div className="ai-grid">
            {aiRecommendations.slice(0, 6).map((recommendation) => (
              <RecommendationCard
                recommendation={recommendation}
                actions={<RecommendationActions recommendation={recommendation} />}
                key={recommendation.recommendationId}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}

function RouteContractCard({ route, supportLabel }: { route: AppRoute; supportLabel: string }): ReactElement {
  return (
    <div className="contract-card">
      <div className="contract-card__header">
        <strong>Contract surface</strong>
        <div className="contract-meta" aria-label="Route contract summary">
          <StatusBadge label={supportLabel} tone={supportStatusToTone(route.supportStatus)} />
          <StatusBadge label={`${route.backendPaths.length} endpoint${route.backendPaths.length === 1 ? '' : 's'}`} />
          <StatusBadge label={`${route.sharedTypes.length} shared type${route.sharedTypes.length === 1 ? '' : 's'}`} />
          <StatusBadge label={`${route.databaseSupport} data`} tone={route.databaseSupport === 'none' ? 'warning' : 'advisory'} />
        </div>
      </div>
      <DataTable
        ariaLabel="Route contract summary"
        rows={[
          { label: 'Canonical route', value: <button type="button" onClick={() => navigateWithinShell(route.path)}>{route.path}</button> },
          { label: 'Boundary', value: route.limitations[0] ?? 'Read-only governed route.' },
        ]}
      />
      <TagList label="APIs" values={route.backendPaths} emptyLabel="No backend route" />
      <TagList label="Shared DTOs" values={route.sharedTypes} emptyLabel="No shared DTOs" />
    </div>
  );
}

function ApprovalBoundary({ approvals, auditEvents }: { approvals: WorkspaceViewModel['approvals']; auditEvents: WorkspaceViewModel['auditEvents'] }): ReactElement {
  const approvalPreview = (Array.isArray(approvals) ? approvals : []).slice(0, 2);
  const auditPreview = (Array.isArray(auditEvents) ? auditEvents : []).slice(0, 2);
  return (
    <div className="boundary-grid">
      {approvalPreview.length ? (
        approvalPreview.map((approval) => (
          <ApprovalCard
            approval={approval}
            actions={<ActionButtons actions={[{ label: 'View approval context', path: `/approvals?approval=${encodeURIComponent(approval.id)}`, detail: 'Open approvals workspace with approval context.' }]} onNavigate={navigateWithinShell} />}
            key={approval.id}
          />
        ))
      ) : (
        <EmptyState message="No pending approval records are visible for this route." actions={<ActionButtons actions={[{ label: 'Open approvals workspace', path: '/approvals', detail: 'Review human approval queue.' }]} onNavigate={navigateWithinShell} />} />
      )}
      {auditPreview.length ? (
        auditPreview.map((event) => (
          <AuditCard
            event={event}
            actions={<ActionButtons actions={[{ label: 'View audit context', path: `/audit?event=${encodeURIComponent(event.auditEventId)}`, detail: 'Open audit workspace with event context.' }]} onNavigate={navigateWithinShell} />}
            key={event.id}
          />
        ))
      ) : (
        <EmptyState message="No audit events are visible for this route." actions={<ActionButtons actions={[{ label: 'Open audit', path: '/audit', detail: 'Review audit ledger.' }]} onNavigate={navigateWithinShell} />} />
      )}
    </div>
  );
}

function RecommendationActions({ recommendation }: { recommendation: WorkspaceViewModel['aiRecommendations'][number] }): ReactElement {
  return (
    <div className="action-row" aria-label="Allowed AI actions">
      <button type="button" onClick={() => navigateWithinShell(`/audit?recommendation=${encodeURIComponent(recommendation.recommendationId)}`)} title="Open audit workspace with recommendation context.">View audit context</button>
      {recommendation.approvalRequirement?.required ? (
        <button type="button" onClick={() => navigateWithinShell(`/approvals?recommendation=${encodeURIComponent(recommendation.recommendationId)}`)} title="Open approvals workspace with recommendation context.">View approval context</button>
      ) : (
        <span className="action-note">No approval request is required for this advisory record.</span>
      )}
      <button type="button" onClick={() => navigateWithinShell('/settings')} title="Open advisory-only AI policy.">Review AI policy</button>
      <span className="action-note">Draft and evaluate APIs are backend-owned; this screen only links to read-only policy, audit, and approval context. Execution remains blocked.</span>
    </div>
  );
}

function actionsForPanel(panel: WorkspacePanel, routePath: string): WorkspaceCardAction[] {
  const evidence = panel.evidence ?? [];
  const content = `${panel.title} ${panel.body} ${panel.status} ${evidence.join(' ')}`.toLowerCase();
  const actions: WorkspaceCardAction[] = [];
  if (content.includes('approval')) {
    actions.push({ label: 'Open approvals', path: '/approvals', detail: 'Review governed approval records.' });
  }
  if (content.includes('audit') || content.includes('hash') || content.includes('evidence')) {
    actions.push({ label: 'Open audit', path: '/audit', detail: 'Review audit evidence.' });
  }
  if (content.includes('policy') || content.includes('protected') || content.includes('execution') || content.includes('documented-stub')) {
    actions.push({ label: 'Review AI policy', path: '/settings', detail: 'Review advisory-only AI policy context.' });
  }
  if (content.includes('incident') || content.includes('emergency')) {
    actions.push({ label: 'Open incidents', path: '/incidents', detail: 'Review incident and emergency workspace.' });
  }
  if (content.includes('provider') || content.includes('quality') || content.includes('lineage')) {
    actions.push({ label: 'Open data hub', path: '/data-hub', detail: 'Review data hub lineage and quality metadata.' });
  }
  if (content.includes('race') || content.includes('readiness')) {
    actions.push({ label: 'Open race day', path: '/race-day', detail: 'Review race-day readiness.' });
  }
  if (content.includes('asset') || content.includes('maintenance') || content.includes('work order')) {
    actions.push({ label: 'Open facilities', path: '/facilities', detail: 'Review facilities service workspace.' });
  }
  if (actions.length === 0) {
    actions.push({ label: 'Open audit', path: `/audit?route=${encodeURIComponent(routePath)}`, detail: 'Review available route evidence.' });
  }
  return dedupeActions(actions);
}

function actionsForMetric(label: string, value: string, detail: string, routePath: string): WorkspaceCardAction[] {
  const content = `${label} ${value} ${detail}`.toLowerCase();
  if (content.includes('privacy') || content.includes('veterinary')) return [{ label: 'View audit context', path: '/audit', detail: 'Review available evidence for veterinary or privacy-scoped records.' }];
  if (content.includes('mock adapter') || content.includes('documented stub')) return [{ label: 'Review AI policy', path: '/settings', detail: 'Review advisory-only AI policy context.' }];
  if (content.includes('approval')) return [{ label: 'Open approvals', path: '/approvals', detail: 'Review approval queue.' }];
  if (content.includes('audit') || content.includes('evidence')) return [{ label: 'Open audit', path: '/audit', detail: 'Review audit ledger.' }];
  if (content.includes('policy') || content.includes('execution') || content.includes('protected')) return [{ label: 'Review AI policy', path: '/settings', detail: 'Review advisory-only AI policy context.' }];
  if (content.includes('health') || content.includes('platform') || content.includes('dependency') || content.includes('observability')) return [{ label: 'Open admin', path: '/admin', detail: 'Review platform health metadata.' }];
  if (content.includes('incident') || content.includes('emergency') || content.includes('security')) return [{ label: 'Open incidents', path: '/incidents', detail: 'Review incident and emergency data.' }];
  if (content.includes('provider') || content.includes('data') || content.includes('quality') || content.includes('lineage')) return [{ label: 'Open data hub', path: '/data-hub', detail: 'Review data hub metadata.' }];
  if (content.includes('race') || content.includes('readiness')) return [{ label: 'Open race day', path: '/race-day', detail: 'Review race-day readiness.' }];
  if (content.includes('asset') || content.includes('maintenance') || content.includes('work order')) return [{ label: 'Open facilities', path: '/facilities', detail: 'Review facilities service data.' }];
  return [{ label: 'Open audit', path: `/audit?route=${encodeURIComponent(routePath)}`, detail: 'Review available route evidence.' }];
}

function dedupeActions(actions: WorkspaceCardAction[]): WorkspaceCardAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.label}:${action.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function navigateWithinShell(path: string): void {
  navigate(path);
}

function focusFromSearch(search: string): { label: string; value: string } | undefined {
  const params = new URLSearchParams(search);
  const first = [...params.entries()][0];
  if (!first) return undefined;
  return { label: first[0], value: first[1] };
}
