import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { operatingModule } from '../../domain/operatingSystem';
import type { WorkspaceViewModel } from '../../domain/workspaceModel';
import type { AppRoute } from '../../routes/routes';
import { ExperienceLayout, OperatingModuleConsole } from '../../components/experience';
import { AIOperatingConsole, ContextDegradationBanner } from '../../components/aiOperating';
import { AlertPanel, ApprovalCard, AuditCard, EmptyState, KPICard, PageHeader, RecommendationCard, SectionCard, StatusBadge, supportStatusToTone } from '../../components/ui';
import { experienceFromViewModel } from './buildExperience';

type NavigationFocus = { label: string; value: string };

interface RouteExperienceProps {
  route: AppRoute;
  supportLabel: string;
  focus?: NavigationFocus;
  stateError?: string;
  data: WorkspaceViewModel;
  metrics: WorkspaceViewModel['metrics'];
  panels: WorkspaceViewModel['panels'];
  approvals: WorkspaceViewModel['approvals'];
  auditEvents: WorkspaceViewModel['auditEvents'];
  kpis: WorkspaceViewModel['kpis'];
  modelReadableKpiContext: WorkspaceViewModel['modelReadableKpiContext'];
  aiRecommendations: WorkspaceViewModel['aiRecommendations'];
  renderContractCard: ReactElement;
  renderFocusBanner: ReactElement | null;
  renderRecordActions: (recordId: string, presetActions?: WorkspaceViewModel['panels'][number]['actions']) => ReactElement;
  renderMetricActions: (metric: WorkspaceViewModel['metrics'][number]) => ReactElement;
  renderRecommendationActions: (recommendation: WorkspaceViewModel['aiRecommendations'][number]) => ReactElement;
}

export function RouteExperience({
  route,
  supportLabel,
  focus,
  stateError,
  data,
  metrics,
  approvals,
  auditEvents,
  kpis,
  modelReadableKpiContext,
  aiRecommendations,
  renderContractCard,
  renderFocusBanner,
  renderRecordActions,
  renderMetricActions,
  renderRecommendationActions,
}: RouteExperienceProps): ReactElement {
  const [stageId, setStageId] = useState<string | undefined>(undefined);
  const operating = operatingModule(route.id);
  const dataSourceLabel = data.source === 'live-api' ? 'Live service data' : data.source === 'facade-api' ? 'Reference read model' : 'Offline fallback';
  const experience = useMemo(() => experienceFromViewModel(route, data, focus, stageId), [route, data, focus, stageId]);
  const approvalPreview = approvals.slice(0, 3);
  const auditPreview = auditEvents.slice(0, 3);
  const kpiPreview = kpis.slice(0, 4);
  const aiPreview = aiRecommendations.slice(0, 4);

  return (
    <section className="workspace experience-workspace">
      <PageHeader
        eyebrow={`${route.navigationGroup} / ${supportLabel}`}
        title={route.label}
        description={route.dataSource}
        accessory={renderContractCard}
      />

      {stateError ? (
        <aside className="focus-banner" role="status" aria-label="Workspace degraded fallback">
          <strong>Offline workspace fallback</strong>
          <span>{stateError}</span>
        </aside>
      ) : null}

      {renderFocusBanner}

      <ContextDegradationBanner degradations={data.contextDegraded ?? []} />

      <AIOperatingConsole
        operating={data.aiOperating}
        recommendations={aiRecommendations}
        renderRecommendationActions={renderRecommendationActions}
      />

      <ExperienceLayout
        experience={experience}
        metrics={metrics}
        metricActions={renderMetricActions}
        stageId={stageId}
        onStageChange={setStageId}
        renderRecordActions={(record) => renderRecordActions(record.id, record.actions)}
        moduleConsole={<OperatingModuleConsole module={operating} dataSourceLabel={dataSourceLabel} />}
      >
        <div className="experience-rail">
          <SectionCard title="Governance rail" description="Approvals, audit evidence, KPI artifacts, and AI recommendations linked to this workspace.">
            <div className="experience-rail__grid">
              <SectionCard title="Approval queue preview" description={`Showing ${approvalPreview.length} of ${approvals.length} approval record(s).`}>
                {approvalPreview.length ? approvalPreview.map((approval, index) => (
                  <ApprovalCard approval={approval} key={`${approval.id ?? approval.approvalRequestId ?? 'approval'}-${index}`} />
                )) : <EmptyState message="No approval records are visible for this workspace." />}
              </SectionCard>
              <SectionCard title="Audit evidence preview" description={`Showing ${auditPreview.length} of ${auditEvents.length} audit event(s).`}>
                {auditPreview.length ? auditPreview.map((event, index) => (
                  <AuditCard event={event} key={`${event.id ?? event.auditEventId ?? 'audit'}-${index}`} />
                )) : <EmptyState message="No audit events are visible for this workspace." />}
              </SectionCard>
            </div>
          </SectionCard>

          <div className="experience-rail__secondary">
            <SectionCard title="KPI artifacts" description={`Showing ${kpiPreview.length} of ${kpis.length} governed KPI artifact(s).`}>
              {kpiPreview.length ? (
                <div className="kpi-grid">
                  {kpiPreview.map((kpi, index) => (
                    <KPICard kpi={kpi} modelContext={modelReadableKpiContext.find((context) => context.kpiId === kpi.kpiId)} key={`${kpi.kpiId || 'kpi'}-${index}`} />
                  ))}
                </div>
              ) : <EmptyState message="No KPI artifacts are visible for this route and role." />}
            </SectionCard>

            <SectionCard title="AI recommendations" description={`Showing ${aiPreview.length} of ${aiRecommendations.length} advisory recommendation(s).`}>
              {aiPreview.length ? (
                <div className="ai-grid">
                  {aiPreview.map((recommendation, index) => (
                    <RecommendationCard recommendation={recommendation} actions={renderRecommendationActions(recommendation)} key={`${recommendation.recommendationId || 'recommendation'}-${index}`} />
                  ))}
                </div>
              ) : <EmptyState message="No AI recommendations returned for this route." />}
            </SectionCard>
          </div>

          <AlertPanel title="Protected action boundary" tone="critical">
            <p>{operating.protectedBoundary}</p>
            <div className="contract-meta">
              <StatusBadge label={supportLabel} tone={supportStatusToTone(route.supportStatus)} />
              <StatusBadge label={dataSourceLabel} tone={data.source === 'live-api' ? 'nominal' : 'advisory'} />
            </div>
          </AlertPanel>
        </div>
      </ExperienceLayout>
    </section>
  );
}
