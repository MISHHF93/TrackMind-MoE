import type { ReactElement, ReactNode } from 'react';
import type { OperatingModule } from '../domain/operatingSystem';
import { capabilityModeLabel, operatingPhaseLabels } from '../domain/operatingSystem';
import type { ExperienceLane, ExperienceRecord, ExperienceStage, WorkspaceExperience } from '../domain/experienceModel';
import type { WorkspaceMetric } from '../domain/workspaceModel';
import { routeById } from '../routes/routes';
import { DataTable, EmptyState, MetricCard, SectionCard, StatusBadge, TagList } from './ui';

export function OperatingModuleConsole({ module, dataSourceLabel }: { module: OperatingModule; dataSourceLabel: string }): ReactElement {
  return (
    <section className="operating-module-console" aria-label="Operating module console">
      <div className="contract-meta">
        <StatusBadge label={operatingPhaseLabels[module.phase]} tone="advisory" />
        <StatusBadge label={dataSourceLabel} tone="nominal" />
        <StatusBadge label={`Operator: ${module.operatorRole}`} />
      </div>
      <h2>{module.mission}</h2>
      <p className="operating-module-console__functional">{module.functionalToday}</p>
      <DataTable
        ariaLabel="Operating module wiring"
        rows={[
          { label: 'Functional today', value: module.functionalToday },
          { label: 'Protected boundary', value: module.protectedBoundary },
          { label: 'Upstream consoles', value: module.upstreamModules.map((id) => routeById[id].label).join(', ') || 'Command center' },
          { label: 'Downstream consoles', value: module.downstreamModules.map((id) => routeById[id].label).join(', ') || 'None listed' },
        ]}
      />
    </section>
  );
}

export function ExperienceHero({ headline, subheadline, badges }: { headline: string; subheadline: string; badges?: ReactNode }): ReactElement {
  return (
    <section className="experience-hero" aria-label="Workspace experience overview">
      {badges ? <div className="contract-meta">{badges}</div> : null}
      <h2>{headline}</h2>
      <p>{subheadline}</p>
    </section>
  );
}

export function ExperienceMetrics({ metrics, actions }: { metrics: WorkspaceMetric[]; actions?: (metric: WorkspaceMetric) => ReactNode }): ReactElement {
  if (!metrics.length) return <EmptyState message="No operating signals are available for this console." />;
  return (
    <div className="experience-metrics" aria-label="Operating signals">
      {metrics.map((metric, index) => (
        <MetricCard metric={metric} actions={actions?.(metric)} key={`${metric.label}-${index}`} />
      ))}
    </div>
  );
}

export function ExperienceStageNav({ stages, activeStageId, onSelect }: { stages: ExperienceStage[]; activeStageId?: string; onSelect: (stageId: string | undefined) => void }): ReactElement | null {
  if (stages.length <= 1) return null;
  return (
    <nav className="experience-stage-nav" aria-label="Operating stages">
      <button type="button" className={!activeStageId ? 'experience-stage-nav__button experience-stage-nav__button--active' : 'experience-stage-nav__button'} onClick={() => onSelect(undefined)}>All stages</button>
      {stages.map((stage) => (
        <button
          type="button"
          className={activeStageId === stage.id ? 'experience-stage-nav__button experience-stage-nav__button--active' : 'experience-stage-nav__button'}
          key={stage.id}
          onClick={() => onSelect(stage.id)}
        >
          {stage.label}
        </button>
      ))}
    </nav>
  );
}

export function ExperienceLanes({ lanes, renderActions }: { lanes: ExperienceLane[]; renderActions?: (record: ExperienceRecord) => ReactNode }): ReactElement {
  if (!lanes.length) return <EmptyState message="No operating lanes are available for this stage." />;
  return (
    <div className="experience-lanes">
      {lanes.map((laneEntry) => (
        <SectionCard key={laneEntry.id} title={laneEntry.title} description={laneEntry.description} className={`experience-lane experience-lane--${laneEntry.kind}`}>
          <div className="experience-record-grid">
            {laneEntry.records.length ? laneEntry.records.map((record) => (
              <CapabilitySurface record={record} actions={renderActions?.(record)} key={record.id} />
            )) : <EmptyState message={`No ${laneEntry.title.toLowerCase()} capabilities are visible.`} />}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

export function CapabilitySurface({ record, actions }: { record: ExperienceRecord; actions?: ReactNode }): ReactElement {
  const wiring = record.wiring;
  return (
    <article className={`capability-surface${record.highlight ? ' capability-surface--highlight' : ''}`}>
      <div className="capability-surface__header">
        <StatusBadge label={wiring ? capabilityModeLabel(wiring.capabilityMode) : (record.statusLabel ?? 'Capability')} tone={record.tone === 'critical' ? 'critical' : record.tone === 'warning' ? 'warning' : record.tone === 'nominal' ? 'nominal' : 'advisory'} />
        <h3>{record.title}</h3>
      </div>
      <p className="capability-surface__summary">{record.summary}</p>
      {record.operatorNote ? <p className="capability-surface__operator-note">{record.operatorNote}</p> : null}
      {wiring ? (
        <details className="capability-wiring">
          <summary>What powers this capability</summary>
          <DataTable
            ariaLabel={`${record.title} wiring`}
            rows={[
              { label: 'Service posture', value: wiring.serviceLabel },
              { label: 'Capability mode', value: capabilityModeLabel(wiring.capabilityMode) },
              { label: 'Functional note', value: wiring.functionalNote },
            ]}
          />
          <TagList label="Wired references" values={wiring.evidenceRefs} />
        </details>
      ) : null}
      {record.fields?.length ? <DataTable ariaLabel={`${record.title} details`} rows={record.fields.map((field) => ({ label: field.label, value: field.value }))} /> : null}
      {record.evidence?.length ? <TagList label="Evidence" values={record.evidence} /> : null}
      {actions}
    </article>
  );
}

export function ExperienceRecordCard({ record, actions }: { record: ExperienceRecord; actions?: ReactNode }): ReactElement {
  return <CapabilitySurface record={record} actions={actions} />;
}

export function ExperienceLayout({ experience, metrics, metricActions, stageId, onStageChange, renderRecordActions, moduleConsole, children }: {
  experience: WorkspaceExperience;
  metrics: WorkspaceMetric[];
  metricActions?: (metric: WorkspaceMetric) => ReactNode;
  stageId?: string;
  onStageChange: (stageId: string | undefined) => void;
  renderRecordActions?: (record: ExperienceRecord) => ReactNode;
  moduleConsole?: ReactNode;
  children?: ReactNode;
}): ReactElement {
  return (
    <div className="experience-layout">
      {moduleConsole}
      <ExperienceHero headline={experience.headline} subheadline={experience.subheadline} />
      <ExperienceMetrics metrics={metrics} actions={metricActions} />
      <ExperienceStageNav stages={experience.stages} activeStageId={stageId} onSelect={onStageChange} />
      <ExperienceLanes lanes={experience.lanes} renderActions={renderRecordActions} />
      {children}
    </div>
  );
}
