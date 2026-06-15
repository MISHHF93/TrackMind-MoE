import type { ReactElement } from 'react';
import type { KPIArtifact } from '@trackmind/shared';
import type { AdvisoryAIRecommendation, WorkspaceCardAction, WorkspacePanel, WorkspaceViewModel } from '../domain/workspaceModel';
import { backendSupportLabels } from '../domain/support';
import type { AppRoute } from '../routes/routes';

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

  if (state.loading) {
    return <section className="workspace-state">Loading {route.label} from {route.dataSource}</section>;
  }

  if (state.error || !state.data) {
    return (
      <section className="workspace-state workspace-state--error">
        <h1>{route.label}</h1>
        <p>{state.error ?? 'No route data returned.'}</p>
        <p>Support status: {supportLabel}. This screen fails closed.</p>
      </section>
    );
  }

  const { data } = state;
  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">{route.navigationGroup} / {supportLabel}</p>
          <h1>{route.label}</h1>
          <p>{route.dataSource}</p>
        </div>
        <div className="contract-card">
          <strong>Contract surface</strong>
          <div className="contract-meta" aria-label="Route contract summary">
            <span className={`status-chip status-chip--${route.supportStatus}`}>{supportLabel}</span>
            <span>{route.backendPaths.length} endpoint{route.backendPaths.length === 1 ? '' : 's'}</span>
            <span>{route.sharedTypes.length} shared type{route.sharedTypes.length === 1 ? '' : 's'}</span>
            <span>{route.databaseSupport} data</span>
          </div>
          <div className="route-map" aria-label="Route navigation map">
            <span>Canonical route</span>
            <button type="button" onClick={() => navigateWithinShell(route.path)}>{route.path}</button>
            {(route.aliases?.length ?? 0) > 0 ? (
              <>
                <span>Aliases</span>
                <div className="route-chip-list">
                  {route.aliases?.map((alias) => (
                    <button type="button" onClick={() => navigateWithinShell(alias)} key={alias}>{alias}</button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <dl className="contract-list">
            <div><dt>APIs</dt><dd>{route.backendPaths.length ? route.backendPaths.join(', ') : 'No backend route'}</dd></div>
            <div><dt>Shared DTOs</dt><dd>{route.sharedTypes.join(', ') || 'none'}</dd></div>
            <div><dt>Boundary</dt><dd>{route.limitations[0] ?? 'Read-only governed route.'}</dd></div>
          </dl>
        </div>
      </header>

      <div className="metric-grid">
        {data.metrics.map((metric) => (
          <article className={`metric metric--${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
            <CardActions actions={metric.actions ?? actionsForMetric(metric.label, metric.value, metric.detail, route.path)} />
          </article>
        ))}
      </div>

      <div className="workspace-grid">
        <section className="panel-stack">
          <h2>Backend-Derived Workspace</h2>
          {data.panels.length === 0 ? (
            <EmptyState message="No records returned by the adapter." />
          ) : (
            data.panels.map((panel) => <RecordCard panel={panel} routePath={route.path} key={panel.id} />)
          )}
        </section>

        <section className="panel-stack">
          <h2>Approval And Audit Boundary</h2>
          <article className="record-card">
            <h3>Human Approval Queue</h3>
            <p>{data.approvals.length} approval record(s) are visible. Regulated actions can only request approval.</p>
            <CardActions actions={[{ label: 'Open approvals', path: '/approvals', detail: 'Review human approval queue.' }]} />
          </article>
          <article className="record-card">
            <h3>Audit Evidence</h3>
            <p>{data.auditEvents.length} audit event(s) available through the adapter.</p>
            <CardActions actions={[{ label: 'Open audit ledger', path: '/audit', detail: 'Review hash-chained evidence.' }]} />
          </article>
          <article className="record-card record-card--locked">
            <h3>Execution Guardrail</h3>
            <p>Direct race starts, race stops, results, scratches, medication decisions, emergency actions, payouts, discipline, and enforcement are not rendered as buttons.</p>
            <CardActions actions={[{ label: 'Review policy', path: '/settings', detail: 'Open governed AI/control policy.' }]} />
          </article>
        </section>
      </div>

      <section className="panel-stack">
        <h2>Governed KPI Artifacts</h2>
        {data.kpis.length === 0 ? (
          <EmptyState message="No KPI artifacts are visible for this route and role." />
        ) : (
          <div className="kpi-grid">
            {data.kpis.map((kpi) => (
              <KPICard kpi={kpi} key={kpi.kpiId} />
            ))}
          </div>
        )}
      </section>

      <section className="panel-stack">
        <h2>Advisory AI</h2>
        {data.aiRecommendations.length === 0 ? (
          <EmptyState message="No AI recommendations returned for this route." />
        ) : (
          <div className="ai-grid">
            {data.aiRecommendations.slice(0, 6).map((recommendation) => (
              <AICard recommendation={recommendation} key={recommendation.recommendationId} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function RecordCard({ panel, routePath }: { panel: WorkspacePanel; routePath: string }): ReactElement {
  const defaultActions = actionsForPanel(panel, routePath);
  return (
    <article className="record-card">
      <div>
        <span className={`status-pill status-pill--${panel.status}`}>{panel.status}</span>
        <h3>{panel.title}</h3>
      </div>
      <p>{panel.body}</p>
      <small>Evidence: {panel.evidence.join(' | ')}</small>
      <CardActions actions={panel.actions ?? defaultActions} />
    </article>
  );
}

function KPICard({ kpi }: { kpi: KPIArtifact }): ReactElement {
  return (
    <article className={`kpi-card kpi-card--${kpi.status}`}>
      <div className="kpi-card__header">
        <span>{kpi.domain}</span>
        <button type="button" onClick={() => navigateWithinShell(`/audit?kpi=${encodeURIComponent(kpi.kpiId)}`)}>Audit link</button>
      </div>
      <h3>{kpi.name}</h3>
      <div className="kpi-card__value">
        <strong>{kpi.value}</strong>
        <span>{kpi.unit}</span>
      </div>
      <dl>
        <div><dt>Status</dt><dd>{kpi.status}</dd></div>
        <div><dt>Trend</dt><dd>{kpi.trend}</dd></div>
        <div><dt>Confidence</dt><dd>{Math.round(kpi.confidence * 100)}%</dd></div>
        <div><dt>Data quality</dt><dd>{Math.round(kpi.dataQualityScore * 100)}%</dd></div>
        <div><dt>Last updated</dt><dd>{kpi.lastCalculatedAt}</dd></div>
        <div><dt>Threshold</dt><dd>{kpi.threshold.description}</dd></div>
      </dl>
      <p>{kpi.description}</p>
      <small>Audit refs: {kpi.auditReference.auditEventIds.join(', ')}</small>
      <CardActions actions={[
        { label: 'Open audit trail', path: `/audit?kpi=${encodeURIComponent(kpi.kpiId)}`, detail: 'Open KPI audit references.' },
        { label: 'Open approvals', path: '/approvals', detail: 'Review approval boundary.' },
      ]} />
    </article>
  );
}

function AICard({ recommendation }: { recommendation: AdvisoryAIRecommendation }): ReactElement {
  return (
    <article className={`ai-card ai-card--${recommendation.riskLevel ?? 'medium'}`}>
      <div className="ai-card__header">
        <span>{recommendation.recommendationId}</span>
        <strong>{Math.round(recommendation.confidence * 100)}%</strong>
      </div>
      <h3>{recommendation.recommendation}</h3>
      <dl>
        <div><dt>Model</dt><dd>{recommendation.modelVersion}</dd></div>
        <div><dt>Governor</dt><dd>{recommendation.governorAllowed === false ? 'Execution blocked' : 'Advisory only'}</dd></div>
        <div><dt>Generated</dt><dd>{recommendation.generatedAt}</dd></div>
        <div><dt>Approval</dt><dd>{recommendation.approvalRequirement.required ? recommendation.approvalRequirement.policy : 'Not required'}</dd></div>
        <div><dt>Audit</dt><dd>{recommendation.auditReference.auditIds.join(', ') || recommendation.auditId}</dd></div>
        <div><dt>Risk</dt><dd>{recommendation.riskLevel ?? 'medium'}</dd></div>
      </dl>
      {recommendation.governorReason ? <p>Governor reason: {recommendation.governorReason}</p> : null}
      <p>Evidence: {recommendation.evidence.join(' | ')}</p>
      <div className="action-row" aria-label="Allowed AI actions">
        <button type="button" onClick={() => navigateWithinShell(`/audit?recommendation=${encodeURIComponent(recommendation.recommendationId)}`)} title="Open audit references for this recommendation.">Open audit trail</button>
        <button type="button" onClick={() => navigateWithinShell('/approvals')} title="Open human approval queue.">Request approval</button>
        <button type="button" onClick={() => navigateWithinShell('/settings')} title="Open advisory-only AI policy.">Review policy</button>
        <span className="action-note">Draft, evaluate, and execution flows require governed backend endpoints.</span>
      </div>
    </article>
  );
}

function CardActions({ actions }: { actions: WorkspaceCardAction[] }): ReactElement {
  return (
    <div className="card-actions" aria-label="Card actions">
      {actions.map((action) => (
        <button type="button" title={action.detail} onClick={() => navigateWithinShell(action.path)} key={`${action.label}-${action.path}`}>{action.label}</button>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }): ReactElement {
  return (
    <div className="empty-state">
      {message}
      <CardActions actions={[{ label: 'Open audit', path: '/audit', detail: 'Review available evidence for this route.' }]} />
    </div>
  );
}

function actionsForPanel(panel: WorkspacePanel, routePath: string): WorkspaceCardAction[] {
  const content = `${panel.title} ${panel.body} ${panel.status} ${panel.evidence.join(' ')}`.toLowerCase();
  const actions: WorkspaceCardAction[] = [];
  if (content.includes('approval')) {
    actions.push({ label: 'Open approvals', path: '/approvals', detail: 'Review governed approval records.' });
  }
  if (content.includes('audit') || content.includes('hash') || content.includes('evidence')) {
    actions.push({ label: 'Open audit', path: '/audit', detail: 'Review audit evidence.' });
  }
  if (content.includes('policy') || content.includes('protected') || content.includes('execution') || content.includes('mock-adapter') || content.includes('documented-stub')) {
    actions.push({ label: 'Open policy', path: '/settings', detail: 'Review advisory and protected-action policies.' });
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
    actions.push({ label: 'Review workspace', path: routePath, detail: 'Review this route workspace.' });
  }
  return dedupeActions(actions);
}

function actionsForMetric(label: string, value: string, detail: string, routePath: string): WorkspaceCardAction[] {
  const content = `${label} ${value} ${detail}`.toLowerCase();
  if (content.includes('privacy') || content.includes('veterinary') || content.includes('mock adapter') || content.includes('documented stub')) return [{ label: 'Open policy', path: '/settings', detail: 'Review policy and protected-data boundaries.' }];
  if (content.includes('approval')) return [{ label: 'Open approvals', path: '/approvals', detail: 'Review approval queue.' }];
  if (content.includes('audit') || content.includes('evidence')) return [{ label: 'Open audit', path: '/audit', detail: 'Review audit ledger.' }];
  if (content.includes('policy') || content.includes('execution') || content.includes('protected')) return [{ label: 'Open policy', path: '/settings', detail: 'Review protected-action policy.' }];
  if (content.includes('health') || content.includes('service') || content.includes('platform')) return [{ label: 'Open admin', path: '/admin', detail: 'Review platform health metadata.' }];
  if (content.includes('incident') || content.includes('emergency') || content.includes('security')) return [{ label: 'Open incidents', path: '/incidents', detail: 'Review incident and emergency data.' }];
  if (content.includes('provider') || content.includes('data') || content.includes('quality') || content.includes('lineage')) return [{ label: 'Open data hub', path: '/data-hub', detail: 'Review data hub metadata.' }];
  if (content.includes('race') || content.includes('readiness')) return [{ label: 'Open race day', path: '/race-day', detail: 'Review race-day readiness.' }];
  if (content.includes('asset') || content.includes('maintenance') || content.includes('work order')) return [{ label: 'Open facilities', path: '/facilities', detail: 'Review facilities service data.' }];
  return [{ label: 'Review workspace', path: routePath, detail: 'Review this route workspace.' }];
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
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
