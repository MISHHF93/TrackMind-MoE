import type { ReactElement } from 'react';
import type { KPIArtifact } from '@trackmind/shared';
import type { AdvisoryAIRecommendation, WorkspaceViewModel } from '../domain/workspaceModel';
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
  if (state.loading) {
    return <section className="workspace-state">Loading {route.label} from {route.dataSource}</section>;
  }

  if (state.error || !state.data) {
    return (
      <section className="workspace-state workspace-state--error">
        <h1>{route.label}</h1>
        <p>{state.error ?? 'No route data returned.'}</p>
        <p>Support status: {route.supportStatus}. This screen fails closed.</p>
      </section>
    );
  }

  const { data } = state;
  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">{route.navigationGroup} / {route.supportStatus}</p>
          <h1>{route.label}</h1>
          <p>{route.dataSource}</p>
        </div>
        <div className="support-card">
          <strong>Backend support</strong>
          <span>{route.backendPaths.length ? route.backendPaths.join(', ') : 'Explicit mock adapter only'}</span>
        </div>
      </header>

      <div className="metric-grid">
        {data.metrics.map((metric) => (
          <article className={`metric metric--${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <div className="workspace-grid">
        <section className="panel-stack">
          <h2>Backend-Derived Workspace</h2>
          {data.panels.length === 0 ? (
            <EmptyState message="No records returned by the adapter." />
          ) : (
            data.panels.map((panel) => (
              <article className="record-card" key={panel.id}>
                <div>
                  <span className={`status-pill status-pill--${panel.status}`}>{panel.status}</span>
                  <h3>{panel.title}</h3>
                </div>
                <p>{panel.body}</p>
                <small>Evidence: {panel.evidence.join(' | ')}</small>
              </article>
            ))
          )}
        </section>

        <section className="panel-stack">
          <h2>Approval And Audit Boundary</h2>
          <article className="record-card">
            <h3>Human Approval Queue</h3>
            <p>{data.approvals.length} approval record(s) are visible. Regulated actions can only request approval.</p>
          </article>
          <article className="record-card">
            <h3>Audit Evidence</h3>
            <p>{data.auditEvents.length} audit event(s) available through the adapter.</p>
          </article>
          <article className="record-card record-card--locked">
            <h3>Execution Guardrail</h3>
            <p>Direct race starts, race stops, results, scratches, medication decisions, emergency actions, payouts, discipline, and enforcement are not rendered as buttons.</p>
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
        {['View details', 'Create draft', 'Evaluate', 'Request approval', 'Open audit trail', 'Open evidence'].map((label) => (
          <button type="button" disabled title="Read-only until a governed endpoint is wired." key={label}>{label}</button>
        ))}
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }): ReactElement {
  return <div className="empty-state">{message}</div>;
}

function navigateWithinShell(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
