import type { ReactElement } from 'react';
import type { AICommandDeckData } from '../domain/controlPlaneModel';
import { navigate } from '../routes/navigation';
import { ContextDegradationBanner } from './aiOperating';
import { DataTable, EmptyState, RecommendationCard, SectionCard, StatusBadge, TagList, Timeline } from './ui';
import { aiCardsFromControlPlane } from '../api/services';

export function AICommandDeck({ deck }: { deck: AICommandDeckData }): ReactElement {
  const recommendations = aiCardsFromControlPlane(deck.recommendations);
  const blocked = aiCardsFromControlPlane(deck.blockedActions);
  const expertModules = deck.workspace?.expertModules ?? deck.modelRegistry?.expertModules ?? [];
  const models = deck.modelRegistry?.models ?? deck.workspace?.modelRegistry?.models ?? [];
  const evaluations = deck.modelRegistry?.evaluations ?? deck.workspace?.modelRegistry?.evaluations ?? [];
  const featureStore = deck.featureStore ?? deck.workspace?.featureStoreSummary ?? deck.modelRegistry?.featureStore;
  const events = deck.events ?? [];

  return (
    <section className="ai-command-deck" aria-label="AI command deck">
      <header className="ai-command-deck__header">
        <div className="contract-meta">
          <StatusBadge label="AI Command Deck" tone="advisory" />
          <StatusBadge label="Advisory-only control plane" tone="nominal" />
          <StatusBadge label="Execution blocked" tone="critical" />
          {deck.generatedAt ? <StatusBadge label={`Generated ${deck.generatedAt}`} /> : null}
        </div>
        <h2>Responsible AI control plane</h2>
        <p>Full read-model visibility into policy, expert modules, model registry, governed recommendations, blocked actions, feature store, and governance events. Protected execution remains backend-governed.</p>
      </header>

      <ContextDegradationBanner degradations={deck.degradations} />

      <div className="ai-command-deck__grid">
        <SectionCard title="Safety policy" description="Advisory-only posture, protected actions, and human approval requirements.">
          <DataTable
            ariaLabel="AI control plane policy"
            rows={[
              { label: 'Policy ID', value: deck.policy.policyId },
              { label: 'Draft-only state changes', value: deck.policy.draftOnlyStateChanges ? 'Yes' : 'No' },
              { label: 'Execution endpoints', value: deck.policy.executionEndpointsAvailable ? 'Declared' : 'Unavailable from frontend' },
            ]}
          />
          <TagList label="Allowed activities" values={deck.policy.allowedActivities} />
          <TagList label="Protected actions" values={deck.policy.protectedActions} />
          <TagList label="Human approval required for" values={deck.policy.humanApprovalRequiredFor} />
          <TagList label="Required evidence" values={deck.policy.requiredEvidence} />
        </SectionCard>

        <SectionCard title="Governance mappings" description="ISO 42001 and NIST AI RMF control mappings.">
          {deck.policy.governanceMapping.length ? deck.policy.governanceMapping.map((mapping) => (
            <article className="ai-command-deck__mapping" key={mapping.framework}>
              <h3>{mapping.framework}</h3>
              <TagList label="Controls" values={mapping.controls} />
              <TagList label="Evidence" values={mapping.evidence} />
            </article>
          )) : <EmptyState message="No governance mappings are visible." />}
        </SectionCard>
      </div>

      <SectionCard title="Expert modules" description={`${expertModules.length} routed expert module(s) in the control plane registry.`}>
        {expertModules.length ? (
          <div className="ai-expert-grid">
            {expertModules.map((module) => (
              <article className="ai-expert-card" key={module.id}>
                <h3>{module.name}</h3>
                <DataTable
                  ariaLabel={`${module.name} module`}
                  rows={[
                    { label: 'Module ID', value: module.id },
                    { label: 'Owner', value: module.owner },
                    { label: 'Model version', value: module.modelVersionId },
                    { label: 'Prompt template', value: module.promptTemplateId },
                  ]}
                />
                <TagList label="Allowed activities" values={module.allowedActivities} />
                <TagList label="Restricted actions" values={module.restrictedActions} />
                <TagList label="Digital twin refs" values={module.digitalTwinRefs} />
              </article>
            ))}
          </div>
        ) : <EmptyState message="No expert modules are visible." />}
      </SectionCard>

      <div className="ai-command-deck__grid">
        <SectionCard title="Model registry" description={`${models.length} registered model version(s); ${evaluations.length} evaluation record(s).`}>
          {models.length ? models.slice(0, 6).map((model) => (
            <article className="ai-command-deck__model" key={model.id}>
              <h3>{model.name}</h3>
              <DataTable
                ariaLabel={`Model ${model.id}`}
                rows={[
                  { label: 'Model ID', value: model.id },
                  { label: 'Version', value: model.version },
                  { label: 'Status', value: model.status },
                  { label: 'Risk level', value: model.riskLevel },
                  { label: 'Intended use', value: model.intendedUse?.join(', ') || 'not declared' },
                ]}
              />
              <TagList label="Evidence" values={model.evidence} />
            </article>
          )) : <EmptyState message="No model registry records are visible." />}
        </SectionCard>

        <SectionCard title="Feature store summary" description="Telemetry streams, datasets, and lineage references feeding expert models.">
          {featureStore ? (
            <>
              <TagList label="Datasets" values={featureStore.datasets} />
              <TagList label="Telemetry streams" values={featureStore.telemetryStreams} />
              <TagList label="Lineage refs" values={featureStore.lineageRefs} />
              <TagList label="Evidence refs" values={featureStore.evidenceRefs} />
            </>
          ) : <EmptyState message="Feature store summary is unavailable." />}
        </SectionCard>
      </div>

      <SectionCard title="Governed recommendation queue" description={`${recommendations.length} active recommendation(s) from the control plane.`}>
        {recommendations.length ? (
          <div className="ai-grid">
            {recommendations.map((recommendation, index) => (
              <RecommendationCard recommendation={recommendation} key={`${recommendation.recommendationId}-${index}`} actions={
                <button type="button" onClick={() => navigate('/approvals')}>Review approval queue</button>
              } />
            ))}
          </div>
        ) : <EmptyState message="No governed recommendations are visible." />}
      </SectionCard>

      <SectionCard title="Governor-blocked actions" description={`${blocked.length} protected action attempt(s) blocked by the Responsible AI Governor.`} >
        {blocked.length ? (
          <div className="ai-grid">
            {blocked.map((recommendation, index) => (
              <RecommendationCard recommendation={recommendation} key={`blocked-${recommendation.recommendationId}-${index}`} />
            ))}
          </div>
        ) : <EmptyState message="No blocked actions are visible." />}
      </SectionCard>

      <SectionCard title="Governance events" description={`${events.length} control-plane governance event(s).`}>
        {events.length ? (
          <Timeline
            ariaLabel="AI governance events"
            items={events.slice(0, 12).map((event) => ({
              id: event.id,
              title: event.type,
              meta: `${event.timestamp} · ${event.actor ?? 'system'}`,
              detail: (
                <>
                  <p>Subject: {event.subjectId}</p>
                  <TagList label="Evidence" values={event.evidence} />
                  <TagList label="Lineage" values={event.lineage} />
                </>
              ),
            }))}
          />
        ) : <EmptyState message="No governance events are visible." />}
      </SectionCard>

      {deck.workspace ? (
        <SectionCard title="Workspace inputs summary" description="Protected intents and affected assets visible to the control plane.">
          <TagList label="Telemetry streams" values={deck.workspace.inputsSummary.telemetryStreams} />
          <TagList label="Evidence refs" values={deck.workspace.inputsSummary.evidenceRefs} />
          <TagList label="Affected assets" values={deck.workspace.inputsSummary.affectedAssets} />
          <TagList label="Protected intents" values={deck.workspace.inputsSummary.protectedIntents} />
        </SectionCard>
      ) : null}
    </section>
  );
}
