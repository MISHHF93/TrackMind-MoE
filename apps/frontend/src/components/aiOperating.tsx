import type { ReactElement } from 'react';
import type { AIOperatingContext, ContextDegradation } from '../domain/aiOperatingModel';
import type { AdvisoryAIRecommendation } from '../domain/workspaceModel';
import { navigate } from '../routes/navigation';
import { AlertPanel, DataTable, EmptyState, RecommendationCard, SectionCard, StatusBadge, TagList } from './ui';

function postureTone(posture: AIOperatingContext['posture']): 'nominal' | 'advisory' | 'warning' | 'critical' {
  if (posture === 'blocked') return 'critical';
  if (posture === 'routing') return 'nominal';
  return 'advisory';
}

function postureLabel(posture: AIOperatingContext['posture']): string {
  if (posture === 'blocked') return 'Governor blocked';
  if (posture === 'routing') return 'Expert routing active';
  return 'Advisory only';
}

export function ContextDegradationBanner({ degradations }: { degradations: ContextDegradation[] }): ReactElement | null {
  if (!degradations.length) return null;
  return (
    <AlertPanel title="Partial workspace enrichment" tone="warning">
      <p>Primary workspace data loaded, but some governance or AI enrichment endpoints were unavailable for this role or scope.</p>
      <DataTable
        ariaLabel="Unavailable enrichment endpoints"
        rows={degradations.map((entry) => ({ label: entry.label, value: entry.message }))}
      />
    </AlertPanel>
  );
}

export function AIOperatingConsole({
  operating,
  recommendations,
  renderRecommendationActions,
  compact = false,
}: {
  operating: AIOperatingContext;
  recommendations: AdvisoryAIRecommendation[];
  renderRecommendationActions?: (recommendation: AdvisoryAIRecommendation) => ReactElement;
  compact?: boolean;
}): ReactElement {
  const routedExperts = operating.expertModules.filter((module) => operating.routedExpertIds.includes(module.id));
  const preview = recommendations.slice(0, compact ? 2 : 4);
  return (
    <section className={`ai-operating-console${compact ? ' ai-operating-console--compact' : ''}`} aria-label="AI operating layer">
      <div className="ai-operating-console__header">
        <div className="contract-meta">
          <StatusBadge label="AI Operating Layer" tone="advisory" />
          <StatusBadge label={postureLabel(operating.posture)} tone={postureTone(operating.posture)} />
          <StatusBadge label="Human approval required" tone="critical" />
          <StatusBadge label="No autonomous execution" tone="nominal" />
        </div>
        <h2>Mixture-of-experts operating intelligence</h2>
        <p>{operating.summary}</p>
      </div>

      <div className="ai-operating-console__grid">
        <SectionCard title="Routed experts for this console" description="Expert models selected for the active operating workspace. Routing is advisory; protected actions remain backend-governed.">
          {routedExperts.length ? (
            <div className="ai-expert-grid">
              {routedExperts.map((expert) => (
                <article className="ai-expert-card" key={expert.id}>
                  <h3>{expert.name}</h3>
                  <p>{expert.owner}</p>
                  <TagList label="Allowed activities" values={expert.allowedActivities.slice(0, 4)} />
                  <TagList label="Restricted actions" values={expert.restrictedActions.slice(0, 4)} />
                </article>
              ))}
            </div>
          ) : <EmptyState message="No routed expert modules are visible for this console." />}
        </SectionCard>

        <SectionCard title="Operating signals" description="Live AI control-plane posture for this workspace session.">
          <DataTable
            ariaLabel="AI operating signals"
            rows={[
              { label: 'Policy', value: operating.policyId },
              { label: 'Queued advisories', value: operating.queuedRecommendationCount },
              { label: 'Governor-blocked actions', value: operating.blockedActionCount },
              { label: 'Registered models', value: operating.modelCount },
              { label: 'Governance events', value: operating.eventCount },
            ]}
          />
          <div className="ai-operating-console__actions">
            <button type="button" onClick={() => navigate('/settings')}>Review AI guardrails</button>
            <button type="button" onClick={() => navigate('/approvals')}>Review approval queue</button>
            <button type="button" onClick={() => navigate('/audit')}>Review audit evidence</button>
          </div>
        </SectionCard>
      </div>

      {!compact ? (
        <SectionCard title="Active advisories" description={`Showing ${preview.length} of ${recommendations.length} recommendation(s) routed through the AI operating layer.`}>
          {preview.length ? (
            <div className="ai-grid">
              {preview.map((recommendation, index) => (
                <RecommendationCard
                  recommendation={recommendation}
                  actions={renderRecommendationActions?.(recommendation)}
                  key={`${recommendation.recommendationId || recommendation.id}-${index}`}
                />
              ))}
            </div>
          ) : <EmptyState message="No AI advisories are visible for this workspace and role." />}
        </SectionCard>
      ) : null}
    </section>
  );
}
