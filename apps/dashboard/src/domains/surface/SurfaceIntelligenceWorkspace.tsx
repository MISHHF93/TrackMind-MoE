import { ActionRail, ApprovalChip, CollaborationPanel, DataFreshness, DataTable, EventTimeline, KpiTile, MetricStrip, MockDataBanner, RiskBadge, StatusCard, WorkspaceFrame, WorkspacePanel } from '../../components/nexus-ui.js';
import type { AdapterMode, SurfaceIntelligenceDto } from '../../types.js';

const surfaceRiskBadgeLevel = (level?: 'low' | 'moderate' | 'high' | 'critical') => !level ? 'medium' : level === 'moderate' ? 'medium' : level;

export function SurfaceIntelligenceWorkspace({ workspace, mode }: { workspace: SurfaceIntelligenceDto; mode: AdapterMode }) {
  const watchedSectorCount = workspace.sectors.filter((sector) => sector.status !== 'open').length;
  const weatherLabel = workspace.mock ? 'MOCK WEATHER PLACEHOLDER' : 'LIVE WEATHER PLACEHOLDER';
  const timelineEvents = workspace.timeline.map((point) => ({
    time: point.observedAt,
    label: `${point.kind}: ${point.label} ${point.value}; event ${point.eventId}; audit ${point.auditId}`,
    tone: point.kind,
  }));
  const inspectionEvents = workspace.inspectionTimeline.map((inspection) => ({
    time: inspection.inspectedAt,
    label: `${inspection.sectorId}: ${inspection.summary}; findings ${inspection.findings.join(', ')}; event ${inspection.eventId}; audit ${inspection.auditId}`,
    tone: inspection.requiresFollowUp ? 'warning' as const : 'info' as const,
  }));
  const collaborationRecommendation = workspace.recommendations[0];
  const collaborationTwinRefs = workspace.digitalTwinSync
    .filter((sync) => !collaborationRecommendation || sync.eventId === collaborationRecommendation.eventId || sync.auditId === collaborationRecommendation.auditId || sync.twinId.includes(collaborationRecommendation.sectorId))
    .map((sync) => sync.twinId);

  return <WorkspaceFrame
    title="Surface Intelligence"
    label="Surface Intelligence workspace"
    eyebrow="Track surface operations"
    description="Condition scorecards, weather placeholders, inspections, maintenance recommendations, heatmap overlays, event audit trails, and Digital Twin evidence."
    mock={workspace.mock || mode === 'mock'}
    operationalSummary={<><DataFreshness label="Surface intelligence" timestamp={workspace.generatedAt} mode={mode} /><MockDataBanner active={workspace.mock || mode === 'mock'} source="Surface Intelligence approved mock/weather adapter" /><MetricStrip items={[
      { label: 'Condition score', value: String(workspace.overallScore), detail: `Approval ${workspace.approvalState}` },
      { label: 'Sectors watched', value: String(watchedSectorCount), detail: `${workspace.sectors.length} sectors monitored` },
      { label: 'Weather impact', value: `${workspace.weatherObservation.forecastRainMm}mm`, detail: weatherLabel },
      { label: 'Approval actions', value: String(workspace.approvalActions.length), detail: 'All locked pending authorization' },
    ]} /></>}
    evidenceDetailPanel={<><p>Recommendation evidence: {workspace.recommendations.map((item) => `${item.eventId}/${item.auditId}`).join('; ') || 'none loaded'}.</p><p>Maintenance evidence: {(workspace.maintenanceRecords ?? []).flatMap((record) => record.auditEvidence).join(', ') || 'none loaded'}.</p><p>Weather labels are placeholders until the governed weather impact service is connected.</p></>}
    eventTimeline={<><EventTimeline events={timelineEvents} label="Surface measurement event timeline" /><EventTimeline events={inspectionEvents} label="Surface inspection event timeline" /></>}
    approvalContext={<p>Operational actions require human approval: {String(workspace.operationalActionsRequireHumanApproval)}. Approval state {workspace.approvalState}. Locked controls remain in the primary Surface approval gates section.</p>}
    auditContext={<p>Surface audit references: {workspace.recommendations.map((item) => item.auditId).join(', ') || 'none loaded'}; inspection audits {workspace.inspectionTimeline.map((inspection) => inspection.auditId).join(', ') || 'none loaded'}.</p>}
    digitalTwinContext={<>{workspace.digitalTwinSync.map((sync) => <article key={`${sync.twinId}-frame-context`}><strong>{sync.twinId}</strong><p>{sync.status}; event {sync.eventId}; audit {sync.auditId}; patch keys {Object.keys(sync.patch).join(', ')}</p></article>)}</>}
    primary={<>
    <p>Surface Intelligence is a routed workspace for condition scorecards, sector telemetry, moisture, compaction, cushion depth, drainage, weather observations, inspections, maintenance recommendations, heatmap-ready overlays, weather impact placeholders, event audit trails, and Digital Twin evidence.</p>
    <p role="note">AI and surface recommendations are advisory only. Irrigation, harrowing, rolling, closure, and surface configuration actions require human approval and never mutate critical local surface or Digital Twin state directly.</p>
    <MetricStrip items={[
      { label: 'Condition score', value: String(workspace.overallScore), detail: `Approval ${workspace.approvalState}` },
      { label: 'Sectors watched', value: String(watchedSectorCount), detail: `${workspace.sectors.length} sectors monitored` },
      { label: 'Weather impact', value: `${workspace.weatherObservation.forecastRainMm}mm`, detail: weatherLabel },
      { label: 'Approval actions', value: String(workspace.approvalActions.length), detail: 'All locked pending authorization' },
    ]} />

    <section aria-label="Surface advisory and approval boundary" role="note">
      <h3>Advisory Boundary</h3>
      <p>Operational actions require backend approval requests. The controls below are approval-required action controls only; they do not issue irrigation, harrow, roll, closure, or actuator commands.</p>
      <p>Operational actions require approval: {String(workspace.operationalActionsRequireHumanApproval)}; approval state {workspace.approvalState}; source {workspace.mock ? 'approved mock adapter' : 'live read-only facade'}.</p>
    </section>

    <section aria-label="Surface status cards">
      <h3>Status cards</h3>
      {workspace.statusCards.map((card) => <StatusCard key={card.label} title={card.label} status={card.value} detail={`${card.detail} Tone: ${card.tone}`} tone={card.tone} />)}
    </section>

    <section aria-label="Surface condition scorecards">
      <h3>Condition scorecards</h3>
      {workspace.conditionScorecards.map((card) => <WorkspacePanel key={card.id} title={card.label} eyebrow={`Status ${card.status}`}>
        <RiskBadge level={surfaceRiskBadgeLevel(card.riskLevel)} />
        <KpiTile label="Condition score" value={String(card.score)} trend={card.detail} />
        <p>Drivers: {card.drivers.join(', ') || 'within target'}</p>
      </WorkspacePanel>)}
    </section>

    <section aria-label="Surface factor panels">
      <h3>Moisture, compaction, cushion-depth, and drainage</h3>
      {workspace.metricPanels.map((panel) => <WorkspacePanel key={panel.id} title={panel.label} eyebrow={panel.factor}>
        <MetricStrip items={[
          { label: 'Observed', value: panel.value, detail: panel.detail },
          { label: 'Target', value: panel.target, detail: panel.trend },
          { label: 'Status', value: panel.status, detail: panel.sectorId ? `Focus ${panel.sectorId}` : 'Track-wide' },
        ]} />
      </WorkspacePanel>)}
    </section>

    <section aria-label="Surface sector table">
      <h3>Track sectors</h3>
      <DataTable label="Surface sector data" rows={workspace.sectors} getRowKey={(sector) => sector.id} columns={[
        { key: 'sector', header: 'Sector', render: (sector) => <><RiskBadge level={surfaceRiskBadgeLevel(sector.riskLevel)} /> {sector.name}</> },
        { key: 'surface', header: 'Surface', render: (sector) => sector.surfaceType },
        { key: 'score', header: 'Score', align: 'right', render: (sector) => sector.conditionScore },
        { key: 'moisture', header: 'Moisture', align: 'right', render: (sector) => `${sector.moisture}%` },
        { key: 'compaction', header: 'Compaction', align: 'right', render: (sector) => sector.compaction },
        { key: 'cushion', header: 'Cushion depth', align: 'right', render: (sector) => sector.cushionDepth },
        { key: 'drainage', header: 'Drainage', align: 'right', render: (sector) => sector.drainageRate },
        { key: 'inspection', header: 'Latest inspection', render: (sector) => sector.latestInspectionAt },
      ]} />
    </section>

    <section aria-label="Surface measurement timeline"><h3>Measurement timeline</h3><EventTimeline events={timelineEvents} /></section>
    <section aria-label="Surface inspection timeline"><h3>Inspection timeline</h3><EventTimeline events={inspectionEvents} /></section>

    <section aria-label="Surface risk badges">
      <h3>Risk badges</h3>
      {workspace.riskBadges.map((risk) => <article key={risk.sectorId}><RiskBadge level={surfaceRiskBadgeLevel(risk.level)} /><p>{risk.sectorId}: {risk.drivers.join(', ') || 'within target'}</p></article>)}
    </section>

    <section aria-label="Surface drainage analysis">
      <h3>Drainage analysis</h3>
      {(workspace.drainageAnalysis ?? []).map((item) => <article key={item.sectionId} data-status={item.status}><strong>{item.sectionId}: {item.status}</strong><p>Capacity gap {item.capacityGap}; forecast rain {item.forecastRainMm}mm; standing water {String(item.standingWater)}. {item.recommendation}</p></article>)}
    </section>

    <section aria-label="Surface maintenance records">
      <h3>Maintenance records</h3>
      {(workspace.maintenanceRecords ?? []).map((record) => <article key={record.id}><strong>{record.action}: {record.sectionId}</strong><p>Effectiveness {record.effectiveness}; completed {record.completedAt}; evidence {record.auditEvidence.join(', ')}</p><p>{record.notes}</p></article>)}
    </section>

    <section aria-label="Surface irrigation recommendations">
      <h3>Irrigation recommendations</h3>
      {(workspace.irrigationRecommendations ?? []).map((item) => <article key={item.sectionId}><ApprovalChip status="pending-approval" /><strong>{item.sectionId}: {item.waterMm}mm draft</strong><p>{item.reason}; advisory only {String(item.advisoryOnly)}; approval {item.approvalAction}</p></article>)}
    </section>

    <section aria-label="Surface weather impact placeholder">
      <h3>Weather impact placeholder</h3>
      <StatusCard title={weatherLabel} status={`${workspace.weatherObservation.forecastRainMm}mm forecast rain`} detail={`Observed ${workspace.weatherObservation.rainfallMm}mm rain, ${workspace.weatherObservation.temperature}F, wind ${workspace.weatherObservation.windMph}mph. Weather labels are placeholders until the governed weather impact service is connected.`} tone={workspace.mock ? 'warning' : 'info'} />
    </section>

    <section aria-label="Surface forecasts">
      <h3>Forecasts</h3>
      {(workspace.forecasts ?? []).map((forecast) => <article key={`${forecast.sectionId}-${forecast.horizonHours ?? forecast.horizonMinutes ?? 'forecast'}`}><RiskBadge level={surfaceRiskBadgeLevel(forecast.predictedRisk ?? forecast.riskLevel ?? 'moderate')} /><strong>{forecast.sectionId}: next {forecast.horizonHours ?? Math.round((forecast.horizonMinutes ?? 0) / 60)}h</strong><p>Moisture {forecast.predictedMoisture ?? 'n/a'}; compaction {forecast.predictedCompaction ?? 'n/a'}; cushion {forecast.predictedCushionDepth ?? 'n/a'}; drainage {forecast.predictedDrainageRate ?? 'n/a'}; confidence {Math.round((forecast.confidence ?? 0) * 100)}%.</p><p>Drivers {forecast.drivers.join(', ')}; advisory only {String(forecast.advisoryOnly ?? true)}</p></article>)}
    </section>

    <section aria-label="Surface anomalies">
      <h3>Anomalies</h3>
      {(workspace.anomalies ?? []).map((anomaly) => <article key={anomaly.id} role={anomaly.severity === 'critical' ? 'alert' : 'status'}><RiskBadge level={surfaceRiskBadgeLevel(anomaly.severity)} /><strong>{anomaly.sectionId}: {anomaly.metric}</strong><p>{anomaly.message}; observed {anomaly.observedValue}; expected {anomaly.expectedValue}; event {anomaly.eventId ?? 'pending'}; audit {anomaly.auditId ?? 'pending'}</p></article>)}
    </section>

    <section aria-label="Surface risk analysis">
      <h3>Risk analysis</h3>
      {(workspace.surfaceRiskAnalysis ?? []).map((risk) => <article key={risk.sectionId}><RiskBadge level={surfaceRiskBadgeLevel(risk.level)} /><strong>{risk.sectionId}: {risk.score}</strong><p>Drivers {risk.drivers.join(', ') || 'within target'}; advisory-only actions {String(risk.operationalActionsAdvisoryOnly)}</p></article>)}
    </section>

    <section aria-label="Surface maintenance recommendations">
      <h3>Maintenance recommendations requiring approval</h3>
      {workspace.recommendations.map((item) => <WorkspacePanel key={item.id} title={item.recommendation} eyebrow={`${item.type} recommendation`}>
        <RiskBadge level={surfaceRiskBadgeLevel(item.priority)} />
        <ApprovalChip status={item.executionState === 'approval-required' ? 'pending-approval' : 'approved'} />
        <p>Sector {item.sectorId}; approval required {String(item.requiresHumanApproval)}; execution {item.executionState}</p>
        <p>Event {item.eventId}; audit {item.auditId}</p>
      </WorkspacePanel>)}
      {collaborationRecommendation && <CollaborationPanel
        routeScope="surface"
        title="Surface Recommendation Discussion"
        targetArtifactId={collaborationRecommendation.id}
        targetArtifactType="surface-recommendation"
        tenantId={workspace.trackId}
        racetrackId={workspace.trackId}
        workflowRef={workspace.approvalActions.find((action) => action.id.includes(collaborationRecommendation.type))?.id ?? `surface-workflow:${collaborationRecommendation.sectorId}`}
        approvalRef={workspace.approvalActions.find((action) => action.id.includes(collaborationRecommendation.type))?.id}
        auditRefs={[collaborationRecommendation.auditId]}
        twinRefs={collaborationTwinRefs}
        evidenceRefs={[collaborationRecommendation.eventId, collaborationRecommendation.auditId, ...workspace.timeline.filter((point) => point.sectorId === collaborationRecommendation.sectorId).map((point) => point.id)]}
        variant="approval-discussion"
        activityItems={[
          { id: `${collaborationRecommendation.id}-generated`, actor: 'surface-intelligence', message: collaborationRecommendation.recommendation, at: workspace.generatedAt, tone: surfaceRiskBadgeLevel(collaborationRecommendation.priority) },
          { id: `${collaborationRecommendation.id}-approval`, actor: 'approval-router', message: `Human approval required: ${String(collaborationRecommendation.requiresHumanApproval)}; execution ${collaborationRecommendation.executionState}.`, at: workspace.generatedAt, tone: 'warning' },
        ]}
      />}
    </section>

    <section aria-label="Heatmap-ready sector view">
      <h3>Heatmap-ready sector view</h3>
      <p>{workspace.mock ? 'MOCK SAFE MAP OVERLAY - no operational surface state is mutated.' : 'Live read-only overlay; actions still require approval.'}</p>
      {workspace.heatmapSectors.map((sector) => <article key={sector.sectorId} data-risk={sector.riskLevel} data-cell-ids={sector.cellIds.join(',')}><RiskBadge level={surfaceRiskBadgeLevel(sector.riskLevel)} /><strong>{sector.label}</strong><p>Risk index {sector.riskIndex}; cells {sector.cellIds.join(', ')}; points {sector.coordinates.map((point) => `${point.latitude},${point.longitude}`).join('; ')}</p><p>Moisture {sector.metrics.moisture}; compaction {sector.metrics.compaction}; drainage {sector.metrics.drainage}</p></article>)}
    </section>

    <section aria-label="Mock-safe surface map overlay">
      <h3>Raw heatmap cells</h3>
      {workspace.heatmap.map((cell) => <article key={cell.id} data-latitude={cell.latitude} data-longitude={cell.longitude}><strong>{cell.sectorId}</strong><p>Moisture {cell.averageMoisture}; compaction {cell.averageCompaction}; drainage {cell.averageDrainage}; risk index {cell.riskIndex}; latest {cell.latestObservedAt}</p></article>)}
    </section>

    <section aria-label="Surface event audit evidence">
      <h3>Event, audit, and twin evidence</h3>
      {workspace.recommendations.map((item) => <article key={`${item.id}-evidence`}><strong>{item.id}</strong><p>{`Event ${item.eventId}; audit ${item.auditId}; sector ${item.sectorId}; priority ${item.priority}.`}</p></article>)}
    </section>

    <section aria-label="Surface Digital Twin sync">
      <h3>Digital Twin updates</h3>
      {workspace.digitalTwinSync.map((sync) => <article key={sync.twinId}><strong>{sync.twinId}</strong><p>{sync.status}; event {sync.eventId}; audit {sync.auditId}; patch keys {Object.keys(sync.patch).join(', ')}</p></article>)}
    </section>

    <section aria-label="Surface approval gates">
      <h3>Approval-required action controls</h3>
      <ActionRail actions={workspace.approvalActions} />
    </section>
    </>}
  />;
}
