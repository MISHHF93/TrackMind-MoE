import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import type { WorkspaceCardAction, WorkspacePanel, WorkspaceViewModel } from '../domain/workspaceModel';
import { backendSupportLabels, canViewRoute, defaultTenantContext } from '../domain/support';
import { routeById, routeForPathname, type AppRoute } from '../routes/routes';
import { currentSearch, navigate } from '../routes/navigation';
import { ActionButtons, AlertPanel, ApprovalCard, AuditCard, DataTable, EmptyState, ErrorState, KPICard, LoadingState, MetricCard, PageHeader, RecommendationCard, SectionCard, StatusBadge, TagList, Timeline, WorkspaceRecordCard, supportStatusToTone, workspacePanelStatusLabel } from '../components/ui';

interface WorkspacePageProps {
  route: AppRoute;
  state: {
    loading: boolean;
    data?: WorkspaceViewModel;
    error?: string;
  };
}

type NavigationFocus = { label: string; value: string };

export function WorkspacePage({ route, state }: WorkspacePageProps): ReactElement {
  const supportLabel = backendSupportLabels[route.supportStatus];
  const [search, setSearch] = useState(() => currentSearch());
  const focus = focusFromSearch(search, route.id);

  useEffect(() => {
    const onPopState = () => setSearch(currentSearch());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (state.loading) {
    return <LoadingState label={route.label} source={route.dataSource} />;
  }

  if (!state.data) {
    return <ErrorState title={route.label} message={state.error ?? 'No route data returned.'} detail={`Support status: ${supportLabel}. This screen fails closed.`} />;
  }

  const { data } = state;
  const metrics = Array.isArray(data.metrics) ? data.metrics.filter(isRenderableMetric) : [];
  const panels = Array.isArray(data.panels) ? data.panels.filter(isRenderablePanel) : [];
  const approvals = Array.isArray(data.approvals) ? data.approvals.filter(isRenderableApproval) : [];
  const auditEvents = Array.isArray(data.auditEvents) ? data.auditEvents.filter(isRenderableAuditEvent) : [];
  const kpis = Array.isArray(data.kpis) ? data.kpis.filter(isRenderableKpi) : [];
  const modelReadableKpiContext = Array.isArray(data.modelReadableKpiContext) ? data.modelReadableKpiContext.filter(isRenderableKpiContext) : [];
  const aiRecommendations = Array.isArray(data.aiRecommendations) ? data.aiRecommendations.filter(isRenderableRecommendation) : [];
  if (route.id === 'dashboard') {
    return (
      <DashboardWorkspace
        route={route}
        supportLabel={supportLabel}
        stateError={state.error}
        focus={focus}
        metrics={metrics}
        panels={panels}
        approvals={approvals}
        auditEvents={auditEvents}
        kpis={kpis}
        modelReadableKpiContext={modelReadableKpiContext}
        aiRecommendations={aiRecommendations}
        generatedAt={data.generatedAt}
        source={data.source}
      />
    );
  }
  return (
    <section className="workspace">
      <PageHeader
        eyebrow={`${route.navigationGroup} / ${supportLabel}`}
        title={route.label}
        description={route.dataSource}
        accessory={<RouteContractCard route={route} supportLabel={supportLabel} />}
      />

      {state.error ? (
        <aside className="focus-banner" role="status" aria-label="Workspace degraded fallback">
          <strong>Offline workspace fallback</strong>
          <span>{state.error}</span>
        </aside>
      ) : null}

      {focus ? (
        <aside className="focus-banner" aria-label="Navigation context note">
          <strong>Navigation context note</strong>
          <span>{focus.label}: {focus.value}</span>
          <button type="button" onClick={() => navigateWithinShell(route.path)}>Clear context</button>
        </aside>
      ) : null}

      <div className="metric-grid" aria-label={`${route.label} metrics`}>
        {metrics.map((metric, index) => (
          <MetricCard
            metric={metric}
            actions={<RouteActionButtons actions={metric.actions ?? actionsForMetric(metric.label, metric.value, metric.detail, route.path, route.id)} />}
            key={`${metric.label}-${index}`}
          />
        ))}
      </div>

      <div className="workspace-grid">
        <SectionCard title="Workspace Evidence" description="Read-only records and supporting evidence from TrackMind services. Protected actions stay in human approval workflows.">
          {panels.length === 0 ? (
            <EmptyState message="No workspace records are available for this role." actions={<RouteActionButtons actions={[{ label: 'View audit evidence', path: '/audit', detail: 'Review available evidence for this workspace.' }]} />} />
          ) : (
            panels.map((panel, index) => (
              <WorkspaceRecordCard
                panel={panel}
                actions={<RouteActionButtons actions={panel.actions ?? actionsForPanel(panel, route.path)} />}
                key={`${panel.id || 'panel'}-${index}`}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="Governance Summary" description="Protected actions stay human-governed, approval-backed, and audit-linked.">
          <ApprovalBoundary approvals={approvals} auditEvents={auditEvents} />
          <AlertPanel title="Protected Action Boundary" tone="critical">
            <p>Direct race starts, race stops, results, scratches, medication decisions, emergency actions, payouts, discipline, and enforcement are not rendered as buttons.</p>
            <RouteActionButtons actions={[{ label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrail context.' }]} />
          </AlertPanel>
        </SectionCard>
      </div>

      <SectionCard title="Governed KPI Artifacts" description="KPI artifacts are rendered from typed contract fields with audit and model-use metadata.">
        {kpis.length === 0 ? (
          <EmptyState message="No KPI artifacts are visible for this route and role." actions={<RouteActionButtons actions={[{ label: 'View audit context', path: '/audit', detail: 'Review available KPI evidence.' }]} />} />
        ) : (
          <div className="kpi-grid">
            {kpis.map((kpi, index) => (
              <KPICard
                kpi={kpi}
                modelContext={modelReadableKpiContext.find((context) => context.kpiId === kpi.kpiId)}
                actions={<RouteActionButtons actions={[
                  { label: 'View audit context note', path: `/audit?kpi=${encodeURIComponent(kpi.kpiId)}`, detail: 'Review audit workspace with a KPI context note; records are not filtered by this link.' },
                  { label: 'View approval context', path: '/approvals', detail: 'Review approval boundary.' },
                ]} />}
                key={`${kpi.kpiId || 'kpi'}-${index}`}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="AI Recommendations" description="Recommendations expose evidence, confidence, model version, approval state, and audit references with review-only links.">
        {aiRecommendations.length === 0 ? (
          <EmptyState message="No AI recommendations returned for this route." actions={<RouteActionButtons actions={[{ label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrails.' }]} />} />
        ) : (
          <div className="ai-grid">
            {aiRecommendations.slice(0, 6).map((recommendation, index) => (
              <RecommendationCard
                recommendation={recommendation}
                actions={<RecommendationActions recommendation={recommendation} />}
                key={`${recommendation.recommendationId || 'recommendation'}-${index}`}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}

function DashboardWorkspace({
  route,
  supportLabel,
  stateError,
  focus,
  metrics,
  panels,
  approvals,
  auditEvents,
  kpis,
  modelReadableKpiContext,
  aiRecommendations,
  generatedAt,
  source,
}: {
  route: AppRoute;
  supportLabel: string;
  stateError?: string;
  focus?: NavigationFocus;
  metrics: WorkspaceViewModel['metrics'];
  panels: WorkspacePanel[];
  approvals: WorkspaceViewModel['approvals'];
  auditEvents: WorkspaceViewModel['auditEvents'];
  kpis: WorkspaceViewModel['kpis'];
  modelReadableKpiContext: WorkspaceViewModel['modelReadableKpiContext'];
  aiRecommendations: WorkspaceViewModel['aiRecommendations'];
  generatedAt?: string;
  source: WorkspaceViewModel['source'];
}): ReactElement {
  const primaryPanels = panels.filter((panel) => !panel.id.startsWith('supplemental-'));
  const supplementalPanels = panels.filter((panel) => panel.id.startsWith('supplemental-')).slice(0, 4);
  const criticalMetricCount = metrics.filter((metric) => metric.tone === 'critical' || metric.tone === 'warning').length;
  const pendingApprovals = approvals.filter((approval) => String(approval.status ?? approval.canonicalStatus ?? '').includes('pending')).length;
  const latestAudit = auditEvents.slice(0, 4);
  const topKpis = kpis.slice(0, 4);
  const topRecommendations = aiRecommendations.slice(0, 3);
  return (
    <section className="workspace dashboard-workspace">
      <PageHeader
        eyebrow={`${route.navigationGroup} / ${supportLabel}`}
        title="Command Center"
        description="A racetrack operations command surface for readiness, workstream risk, approvals, audit evidence, and AI recommendations. Every control below is navigation-only."
        accessory={<RouteContractCard route={route} supportLabel={supportLabel} />}
      />

      {stateError ? (
        <aside className="focus-banner" role="status" aria-label="Workspace degraded fallback">
          <strong>Offline workspace fallback</strong>
          <span>{stateError}</span>
        </aside>
      ) : null}

      {focus ? (
        <aside className="focus-banner" aria-label="Navigation context note">
          <strong>Navigation context note</strong>
          <span>{focus.label}: {focus.value}</span>
          <button type="button" onClick={() => navigateWithinShell(route.path)}>Clear context</button>
        </aside>
      ) : null}

      <section className="dashboard-hero" aria-label="Command center overview">
        <div className="dashboard-hero__copy">
          <div className="contract-meta">
            <StatusBadge label={source === 'live-api' ? 'Live service data' : source === 'facade-api' ? 'Reference read model' : 'Offline fallback'} tone={source === 'live-api' ? 'nominal' : 'advisory'} />
            <StatusBadge label={generatedAt ? `Generated ${generatedAt}` : 'Generated time unavailable'} />
            <StatusBadge label={`${criticalMetricCount} watch item${criticalMetricCount === 1 ? '' : 's'}`} tone={criticalMetricCount > 0 ? 'warning' : 'nominal'} />
          </div>
          <h2>Race-day command board</h2>
          <p>Use this surface to choose a workstream, scan operational readiness, and jump into the owning workspace for details. Protected actions require backend approval workflows and human operators.</p>
          <RouteActionButtons actions={[
            { label: 'Review race-day readiness', path: '/race-day', detail: 'Open race-day readiness and track configuration context.' },
            { label: 'Review approval queue', path: '/approvals', detail: 'Open view-only approval records.' },
            { label: 'Review audit evidence', path: '/audit', detail: 'Open immutable audit evidence.' },
            { label: 'Review AI guardrails', path: '/settings', detail: 'Open read-only AI guardrails.' },
          ]} />
        </div>
        <div className="dashboard-hero__status" aria-label="Operational summary">
          <span>Workstreams In View</span>
          <strong>{primaryPanels.length + supplementalPanels.length}</strong>
          <small>command cards rendered from route-safe panels</small>
          <DataTable
            ariaLabel="Dashboard coverage summary"
            rows={[
              { label: 'Pending approvals', value: pendingApprovals },
              { label: 'Audit events', value: latestAudit.length },
              { label: 'AI advisories', value: topRecommendations.length },
              { label: 'KPI artifacts', value: topKpis.length },
            ]}
          />
        </div>
      </section>

      <WorkstreamLauncher />

      <div className="dashboard-status-grid" aria-label="Dashboard status metrics">
        {metrics.length ? metrics.map((metric, index) => (
          <MetricCard
            metric={metric}
            actions={<RouteActionButtons actions={metric.actions ?? actionsForMetric(metric.label, metric.value, metric.detail, route.path, route.id)} />}
            key={`${metric.label}-${index}`}
          />
        )) : <EmptyState message="No dashboard metrics are available." />}
      </div>

      <div className="dashboard-grid dashboard-grid--primary">
        <SectionCard title="Operations Command Cards" description="Primary command cards mapped to workstream-safe review destinations.">
          <div className="dashboard-card-grid">
            {primaryPanels.length ? primaryPanels.map((panel, index) => (
              <WorkspaceRecordCard
                panel={panel}
                actions={<RouteActionButtons actions={panel.actions ?? actionsForPanel(panel, route.path)} />}
                key={`${panel.id || 'panel'}-${index}`}
              />
            )) : <EmptyState message="No command cards are visible for this role." actions={<RouteActionButtons actions={[{ label: 'Review race-day readiness', path: '/race-day', detail: 'Open the primary operations workspace.' }, { label: 'Review service status', path: '/admin', detail: 'Open service status metadata.' }]} />} />}
          </div>
        </SectionCard>

        <SectionCard title="Command Timeline" description="Recent supplemental alerts, event snapshots, and audit references.">
          <Timeline
            ariaLabel="Dashboard operational timeline"
            items={[
              ...supplementalPanels.map((panel) => ({ id: panel.id, title: panel.title, meta: workspacePanelStatusLabel(panel.status), detail: panel.body })),
              ...latestAudit.map((event, index) => ({ id: displayId(event.auditEventId ?? event.id, `audit-${index}`), title: event.action ?? 'Audit event', meta: event.timestamp, detail: event.reason ?? event.type })),
            ]}
          />
          {supplementalPanels.length || latestAudit.length ? null : <EmptyState message="No supplemental events or audit records are visible." actions={<RouteActionButtons actions={[{ label: 'Review audit evidence', path: '/audit', detail: 'Open audit evidence records.' }]} />} />}
        </SectionCard>
      </div>

      <div className="dashboard-grid dashboard-grid--secondary">
        <SectionCard title="Governance Queue" description="Approval and audit previews remain read-only and context-linked.">
          <ApprovalBoundary approvals={approvals} auditEvents={auditEvents} />
        </SectionCard>

        <SectionCard title="Readiness KPIs" description="Top governed KPI artifacts with model-readable metadata.">
          <div className="dashboard-card-grid dashboard-card-grid--compact">
            {topKpis.length ? topKpis.map((kpi, index) => (
              <KPICard
                kpi={kpi}
                modelContext={modelReadableKpiContext.find((context) => context.kpiId === kpi.kpiId)}
                actions={<RouteActionButtons actions={[
                  { label: 'View audit context note', path: `/audit?kpi=${encodeURIComponent(kpi.kpiId)}`, detail: 'Review audit workspace with a KPI context note; records are not filtered by this link.' },
                  { label: 'View approval context', path: '/approvals', detail: 'Review approval boundary.' },
                ]} />}
                key={`${kpi.kpiId || 'kpi'}-${index}`}
              />
            )) : <EmptyState message="No dashboard KPI artifacts are visible." actions={<RouteActionButtons actions={[{ label: 'Review audit evidence', path: '/audit', detail: 'Open available KPI evidence.' }]} />} />}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="AI Recommendations & Guardrails" description="Evidence-backed recommendations are review links only; no protected action starts from this dashboard.">
        <div className="dashboard-ai-layout">
          <div className="ai-grid">
            {topRecommendations.length ? topRecommendations.map((recommendation, index) => (
              <RecommendationCard
                recommendation={recommendation}
                actions={<RecommendationActions recommendation={recommendation} />}
                key={`${recommendation.recommendationId || 'recommendation'}-${index}`}
              />
            )) : <EmptyState message="No AI recommendations returned for the dashboard." actions={<RouteActionButtons actions={[{ label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrails.' }]} />} />}
          </div>
          <AlertPanel title="Protected Action Boundary" tone="critical">
            <p>Direct race starts, race stops, results, scratches, medication decisions, emergency actions, payouts, discipline, and enforcement are not rendered as dashboard buttons.</p>
            <RouteActionButtons actions={[
              { label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrail context.' },
              { label: 'Review audit evidence', path: '/audit', detail: 'Review evidence for protected action boundaries.' },
            ]} />
          </AlertPanel>
        </div>
      </SectionCard>
    </section>
  );
}

const commandWorkstreams: Array<{ routeId: AppRoute['id']; title: string; owner: string; reason: string; signals: string[] }> = [
  { routeId: 'raceDay', title: 'Race-Day Readiness', owner: 'Racing office and stewards', reason: 'Confirm readiness, surface, gate, lifecycle, and locked approval posture before post time.', signals: ['Post-time readiness', 'Surface and gate verification', 'Race office lifecycle'] },
  { routeId: 'equine', title: 'Equine & Barn Review', owner: 'Veterinary and barn teams', reason: 'Review horse welfare, eligibility, barn readiness, and privacy-scoped veterinary status.', signals: ['Eligibility flags', 'Barn restrictions', 'No medical clearance action'] },
  { routeId: 'incidents', title: 'Incident Command', owner: 'Security and operations command', reason: 'Review incident posture, emergency resources, communications, and response evidence.', signals: ['Emergency status', 'Incident queue', 'AI cannot block humans'] },
  { routeId: 'facilities', title: 'Facilities Readiness', owner: 'Track superintendent', reason: 'Scan asset health, work orders, inspections, and return-to-service approval boundaries.', signals: ['Work orders', 'Asset health', 'Digital Twin sync'] },
  { routeId: 'approvals', title: 'Approval Review', owner: 'Authorized human approvers', reason: 'Review protected action requests, escalation posture, required roles, and evidence.', signals: ['Pending approvals', 'Escalation timers', 'Human-only decisions'] },
  { routeId: 'dataHub', title: 'Racing Data Governance', owner: 'Compliance and data operations', reason: 'Review provider readiness, lineage, license posture, and export controls without live provider pulls.', signals: ['Provider posture', 'Lineage', 'Export controls'] },
];

function WorkstreamLauncher(): ReactElement {
  return (
    <SectionCard title="Start By Workstream" description="Choose the racetrack operating lane you need today. Each lane opens a review workspace; protected actions stay behind backend approval workflows.">
      <div className="workstream-grid">
        {commandWorkstreams.map((item) => {
          const route = routeById[item.routeId];
          return (
            <article className="workstream-card" key={item.routeId}>
              <div className="workstream-card__header">
                <StatusBadge label={route.navigationGroup} tone={supportStatusToTone(route.supportStatus)} />
                <strong>{item.title}</strong>
              </div>
              <p>{item.reason}</p>
              <TagList label={`Signals for ${item.owner}`} values={item.signals} />
              <RouteActionButtons actions={[{ label: `Open ${route.label}`, path: route.path, detail: `Open ${item.title} review workspace.` }]} />
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}

function RouteContractCard({ route, supportLabel }: { route: AppRoute; supportLabel: string }): ReactElement {
  return (
    <div className="contract-card">
      <div className="contract-card__header">
        <strong>Workspace source</strong>
        <div className="contract-meta" aria-label="Workspace source summary">
          <StatusBadge label={supportLabel} tone={supportStatusToTone(route.supportStatus)} />
          <StatusBadge label={`${route.backendPaths.length} endpoint${route.backendPaths.length === 1 ? '' : 's'}`} />
          <StatusBadge label={`${route.sharedTypes.length} data contract${route.sharedTypes.length === 1 ? '' : 's'}`} />
          <StatusBadge label={`${route.databaseSupport} data`} tone={route.databaseSupport === 'none' ? 'warning' : 'advisory'} />
        </div>
      </div>
      <DataTable
        ariaLabel="Workspace source summary"
        rows={[
          { label: 'Workspace path', value: <button type="button" onClick={() => navigateWithinShell(route.path)}>{route.path}</button> },
          { label: 'Boundary', value: route.limitations[0] ?? 'Read-only governed route.' },
        ]}
      />
      <TagList label="Service routes" values={route.backendPaths} emptyLabel="No service route listed" />
      <TagList label="Data contracts" values={route.sharedTypes} emptyLabel="No data contracts listed" />
    </div>
  );
}

function ApprovalBoundary({ approvals, auditEvents }: { approvals: WorkspaceViewModel['approvals']; auditEvents: WorkspaceViewModel['auditEvents'] }): ReactElement {
  const approvalPreview = (Array.isArray(approvals) ? approvals : []).slice(0, 2);
  const auditPreview = (Array.isArray(auditEvents) ? auditEvents : []).slice(0, 2);
  return (
    <div className="boundary-grid">
      {approvalPreview.length ? (
        approvalPreview.map((approval, index) => {
          const approvalId = displayId(approval.id ?? approval.approvalRequestId, `approval-${index}`);
          return (
          <ApprovalCard
            approval={approval}
            actions={<RouteActionButtons actions={[{ label: 'View approval context note', path: `/approvals?approval=${encodeURIComponent(approvalId)}`, detail: 'Review approvals workspace with a context note; records are not filtered by this link.' }]} />}
            key={`${approvalId}-${index}`}
          />
        );
        })
      ) : (
        <EmptyState message="No pending approval records are visible for this route." actions={<RouteActionButtons actions={[{ label: 'View approval context', path: '/approvals', detail: 'Review human approval queue.' }]} />} />
      )}
      {auditPreview.length ? (
        auditPreview.map((event, index) => {
          const eventId = displayId(event.auditEventId ?? event.id, `event-${index}`);
          return (
          <AuditCard
            event={event}
            actions={<RouteActionButtons actions={[{ label: 'View audit context note', path: `/audit?event=${encodeURIComponent(eventId)}`, detail: 'Review audit workspace with a context note; records are not filtered by this link.' }]} />}
            key={`${eventId}-${index}`}
          />
        );
        })
      ) : (
        <EmptyState message="No audit events are visible for this route." actions={<RouteActionButtons actions={[{ label: 'View audit context', path: '/audit', detail: 'Review audit ledger.' }]} />} />
      )}
    </div>
  );
}

function RecommendationActions({ recommendation }: { recommendation: WorkspaceViewModel['aiRecommendations'][number] }): ReactElement {
  const recommendationId = recommendation.recommendationId || (recommendation as { id?: string }).id;
  const actions: WorkspaceCardAction[] = [];
  if (recommendationId) {
    actions.push({ label: 'View audit context note', path: `/audit?recommendation=${encodeURIComponent(recommendationId)}`, detail: 'Review audit workspace with a recommendation context note; records are not filtered by this link.' });
  }
  if (recommendation.approvalRequirement?.required && recommendationId) {
    actions.push({ label: 'View approval context note', path: `/approvals?recommendation=${encodeURIComponent(recommendationId)}`, detail: 'Review approvals workspace with a recommendation context note; records are not filtered by this link.' });
  }
  actions.push({ label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrails.' });
  return (
    <div className="action-row" aria-label="AI review links">
      <RouteActionButtons actions={actions} />
      {!recommendation.approvalRequirement?.required ? <span className="action-note">Approval state is advisory-only or unavailable for this record.</span> : null}
      <span className="action-note">Draft and evaluate workflows are service-owned; this screen only links to read-only guardrails, audit, and approval context. No protected action can be started here.</span>
    </div>
  );
}

function actionsForPanel(panel: WorkspacePanel, routePath: string): WorkspaceCardAction[] {
  const evidence = panel.evidence ?? [];
  const content = `${panel.title} ${panel.body} ${panel.status} ${evidence.join(' ')}`.toLowerCase();
  const actions: WorkspaceCardAction[] = [];
  if (content.includes('approval')) {
    actions.push({ label: 'View approval context', path: '/approvals', detail: 'Review governed approval records.' });
  }
  if (content.includes('audit') || content.includes('hash') || content.includes('evidence')) {
    actions.push({ label: 'View audit context', path: '/audit', detail: 'Review audit evidence.' });
  }
  if (content.includes('policy') || content.includes('protected') || content.includes('execution') || content.includes('documented-stub')) {
    actions.push({ label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrail context.' });
  }
  if (content.includes('incident') || content.includes('emergency')) {
    actions.push({ label: 'View incident context', path: '/incidents', detail: 'Review incident and emergency workspace.' });
  }
  if (content.includes('provider') || content.includes('quality') || content.includes('lineage')) {
    actions.push({ label: 'View data context', path: '/data-hub', detail: 'Review data hub lineage and quality metadata.' });
  }
  if (content.includes('race') || content.includes('readiness')) {
    actions.push({ label: 'View race-day context', path: '/race-day', detail: 'Review race-day readiness.' });
  }
  if (content.includes('asset') || content.includes('maintenance') || content.includes('work order')) {
    actions.push({ label: 'View facilities context', path: '/facilities', detail: 'Review facilities service workspace.' });
  }
  if (actions.length === 0) {
    actions.push({ label: 'View audit context note', path: `/audit?route=${encodeURIComponent(routePath)}`, detail: 'Review audit workspace with a route context note; records are not filtered by this link.' });
  }
  return dedupeActions(actions);
}

function actionsForMetric(label: string, value: string, detail: string, routePath: string, routeId: AppRoute['id']): WorkspaceCardAction[] {
  const content = `${label} ${value} ${detail}`.toLowerCase();
  if (routeId === 'security') return [{ label: 'View security context', path: '/security', detail: 'Review security workspace records.' }];
  if (routeId === 'facilities') return [{ label: 'View facilities context', path: '/facilities', detail: 'Review facilities service data.' }];
  if (routeId === 'compliance') return [{ label: 'View compliance context', path: '/compliance', detail: 'Review compliance control-library metadata.' }];
  if (routeId === 'federation') return [{ label: 'View federation context', path: '/federation', detail: 'Review aggregate federation metadata.' }];
  if (routeId === 'equine') return [{ label: 'View equine context', path: '/equine', detail: 'Review equine and barn facade metadata.' }];
  if (content.includes('privacy') || content.includes('veterinary')) return [{ label: 'View audit context', path: '/audit', detail: 'Review available evidence for veterinary or privacy-scoped records.' }];
  if (content.includes('mock adapter') || content.includes('documented stub')) return [{ label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrail context.' }];
  if (content.includes('approval')) return [{ label: 'View approval context', path: '/approvals', detail: 'Review approval queue.' }];
  if (content.includes('audit') || content.includes('evidence')) return [{ label: 'View audit context', path: '/audit', detail: 'Review audit ledger.' }];
  if (content.includes('policy') || content.includes('execution') || content.includes('protected')) return [{ label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrail context.' }];
  if (content.includes('health') || content.includes('platform') || content.includes('dependency') || content.includes('observability')) return [{ label: 'View service status', path: '/admin', detail: 'Review service health metadata.' }];
  if (content.includes('incident') || content.includes('emergency') || content.includes('security')) return [{ label: 'View incident context', path: '/incidents', detail: 'Review incident and emergency data.' }];
  if (content.includes('provider') || content.includes('data') || content.includes('quality') || content.includes('lineage')) return [{ label: 'View data context', path: '/data-hub', detail: 'Review data hub metadata.' }];
  if (content.includes('race') || content.includes('readiness')) return [{ label: 'View race-day context', path: '/race-day', detail: 'Review race-day readiness.' }];
  if (content.includes('asset') || content.includes('maintenance') || content.includes('work order')) return [{ label: 'View facilities context', path: '/facilities', detail: 'Review facilities service data.' }];
  return [{ label: 'View audit context note', path: `/audit?route=${encodeURIComponent(routePath)}`, detail: 'Review audit workspace with a route context note; records are not filtered by this link.' }];
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

function RouteActionButtons({ actions }: { actions?: WorkspaceCardAction[] }): ReactElement {
  const visibleActions = Array.isArray(actions) ? actions.filter((action) => canNavigateToPath(action.path)) : [];
  if (Array.isArray(actions) && actions.length > 0 && visibleActions.length === 0) {
    return <span className="action-note">No permitted context links for this role.</span>;
  }
  return <ActionButtons actions={visibleActions} onNavigate={navigateWithinShell} />;
}

function canNavigateToPath(path: string): boolean {
  try {
    const url = new URL(path, 'https://trackmind.local');
    if (url.origin !== 'https://trackmind.local') return false;
    const route = routeForPathname(url.pathname);
    return Boolean(route && canViewRoute(route, defaultTenantContext.role));
  } catch {
    return false;
  }
}

function navigateWithinShell(path: string): void {
  navigate(path);
}

function displayId(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function focusFromSearch(search: string, routeId: AppRoute['id']): { label: string; value: string } | undefined {
  const params = new URLSearchParams(search);
  const allowed = queryLabelsByRoute[routeId] ?? {};
  const first = [...params.entries()].find(([key]) => key in allowed);
  if (!first || !first[1]) return undefined;
  return { label: allowed[first[0]], value: first[1] };
}

const queryLabelsByRoute: Partial<Record<AppRoute['id'], Record<string, string>>> = {
  approvals: { approval: 'Approval context', recommendation: 'Recommendation context' },
  audit: { event: 'Audit event context', recommendation: 'Recommendation context', kpi: 'KPI context', route: 'Route context', surface: 'Surface context', trackConfiguration: 'Track configuration context', barn: 'Barn context', ticket: 'Ticket context', payout: 'Payout context' },
};

function isRenderableMetric(metric: unknown): metric is WorkspaceViewModel['metrics'][number] {
  return Boolean(metric && typeof metric === 'object' && nonEmptyString((metric as { label?: unknown }).label) && nonEmptyString((metric as { value?: unknown }).value) && nonEmptyString((metric as { detail?: unknown }).detail));
}

function isRenderablePanel(panel: unknown): panel is WorkspacePanel {
  return Boolean(panel && typeof panel === 'object' && nonEmptyString((panel as { id?: unknown }).id) && nonEmptyString((panel as { title?: unknown }).title) && nonEmptyString((panel as { body?: unknown }).body) && nonEmptyString((panel as { status?: unknown }).status));
}

function isRenderableApproval(approval: unknown): approval is WorkspaceViewModel['approvals'][number] {
  return Boolean(approval && typeof approval === 'object' && (nonEmptyString((approval as { id?: unknown }).id) || nonEmptyString((approval as { approvalRequestId?: unknown }).approvalRequestId)));
}

function isRenderableAuditEvent(event: unknown): event is WorkspaceViewModel['auditEvents'][number] {
  return Boolean(event && typeof event === 'object' && (nonEmptyString((event as { id?: unknown }).id) || nonEmptyString((event as { auditEventId?: unknown }).auditEventId)));
}

function isRenderableKpi(kpi: unknown): kpi is WorkspaceViewModel['kpis'][number] {
  return Boolean(kpi && typeof kpi === 'object' && nonEmptyString((kpi as { kpiId?: unknown }).kpiId));
}

function isRenderableKpiContext(context: unknown): context is WorkspaceViewModel['modelReadableKpiContext'][number] {
  return Boolean(context && typeof context === 'object' && nonEmptyString((context as { kpiId?: unknown }).kpiId));
}

function isRenderableRecommendation(recommendation: unknown): recommendation is WorkspaceViewModel['aiRecommendations'][number] {
  return Boolean(recommendation && typeof recommendation === 'object' && (nonEmptyString((recommendation as { recommendationId?: unknown }).recommendationId) || nonEmptyString((recommendation as { id?: unknown }).id)));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
