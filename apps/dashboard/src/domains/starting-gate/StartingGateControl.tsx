import { ApprovalChip, CollaborationPanel, DataFreshness, DataTable, EventTimeline, MetricStrip, SafetyCriticalActionButton, TrackMapPanel, WorkspaceFrame } from '../../components/nexus-ui.js';
import { TrackMap } from '../track-map/TrackMap.js';
import type { AdapterMode, ApprovalDto, AuditEventDto, DigitalTwinStateDto, GatePositionDto, RaceDayReadinessDashboardDto, RaceDistanceConfigurationDto, TrackConfigurationWorkOrderDto, TrackMapDto, TrackSectorDto } from '../../types.js';

const defaultGateApprovalRoles = ['racing-secretary', 'track-superintendent', 'steward', 'timer'];
const gateMoveEvidence = ['race-distance-configuration', 'current-gate-position', 'target-position-calculation', 'gps-verification', 'human-approval-record'];
const approvedGateStatuses = new Set(['approved', 'satisfied']);

export function calculateRequiredGatePosition(trackDistanceMeters: number, raceDistanceConfiguration: RaceDistanceConfigurationDto, sectors: TrackSectorDto[]) {
  const targetMetersFromStart = Math.max(0, trackDistanceMeters - raceDistanceConfiguration.distanceMeters);
  const targetSectorId = sectors.find((sector) => targetMetersFromStart >= sector.startMeters && targetMetersFromStart <= sector.endMeters)?.id ?? raceDistanceConfiguration.gateSectorId;
  return { targetMetersFromStart, targetSectorId };
}

function isGateApproval(approval: ApprovalDto, gateId: string, raceId: string) {
  return approval.action === 'starting-gate-move'
    || approval.action === 'race-distance-configuration'
    || approval.target === gateId
    || approval.target === raceId
    || (approval.affectedAssets ?? []).some((asset) => asset.includes(gateId) || asset.includes(raceId));
}

export function hasApprovedGateMoveRequest(approvals: ApprovalDto[], gateId: string, raceDistanceConfiguration: RaceDistanceConfigurationDto, gatePosition: GatePositionDto) {
  const approvedRequestIds = [gatePosition.lastApprovedRequestId, raceDistanceConfiguration.approvedRequestId].filter(Boolean);
  return approvals
    .filter((approval) => isGateApproval(approval, gateId, raceDistanceConfiguration.raceId))
    .some((approval) => approvedGateStatuses.has(String(approval.status)) && (approvedRequestIds.length === 0 || approvedRequestIds.includes(approval.id)));
}

function gateAuditEvents(auditEvents: AuditEventDto[], gateId: string, raceId: string) {
  return auditEvents.filter((event) => event.type.includes('approval') || event.type.includes('configuration') || event.subjectId === gateId || event.subjectId === raceId || (event.affectedAssets ?? []).some((asset) => asset.includes(gateId) || asset.includes(raceId)));
}

function fallbackGateWorkOrder(raceId: string, gatePosition: GatePositionDto, target: ReturnType<typeof calculateRequiredGatePosition>): TrackConfigurationWorkOrderDto {
  return {
    id: `wo-${raceId}-${gatePosition.gateId}`,
    crew: 'gate-crew',
    status: 'approval-blocked',
    tasks: [
      `Confirm race ${raceId} distance calculation`,
      `Stage ${gatePosition.gateId} for ${target.targetSectorId} at ${target.targetMetersFromStart}m`,
      'Capture GPS proof and photo evidence',
      'Hold for starter, steward, and timing verification',
    ],
    evidenceRequired: gateMoveEvidence,
    dueAt: 'pending approved draft request',
  };
}

export function StartingGateControl({ trackMap, gatePosition, raceDistanceConfiguration, readiness, approvals, auditEvents, digitalTwinState, mode, authenticated, canExecute }: {
  trackMap: TrackMapDto;
  gatePosition: GatePositionDto;
  raceDistanceConfiguration: RaceDistanceConfigurationDto;
  readiness: RaceDayReadinessDashboardDto;
  approvals: ApprovalDto[];
  auditEvents: AuditEventDto[];
  digitalTwinState: DigitalTwinStateDto[];
  mode: AdapterMode;
  authenticated: boolean;
  canExecute: boolean;
}) {
  const selectedRace = readiness.races.find((race) => race.raceId === raceDistanceConfiguration.raceId) ?? readiness.races[0];
  const target = calculateRequiredGatePosition(trackMap.distanceMeters, raceDistanceConfiguration, trackMap.sectors);
  const gateDeltaMeters = target.targetMetersFromStart - gatePosition.metersFromStart;
  const gateApprovals = approvals.filter((approval) => isGateApproval(approval, gatePosition.gateId, raceDistanceConfiguration.raceId));
  const approvedGateApprovalExists = hasApprovedGateMoveRequest(approvals, gatePosition.gateId, raceDistanceConfiguration, gatePosition);
  const raceReadinessApprovals = readiness.approvals.filter((approval) => approval.raceId === raceDistanceConfiguration.raceId);
  const approvalRoles = [...new Set([...gateApprovals.flatMap((approval) => approval.requiredRoles ?? []), ...raceReadinessApprovals.flatMap((approval) => approval.requiredRoles), ...defaultGateApprovalRoles])];
  const configuredWorkOrder = trackMap.trackConfiguration?.workOrders.find((order) => order.crew === 'gate-crew');
  const gateWorkOrder = configuredWorkOrder ?? fallbackGateWorkOrder(raceDistanceConfiguration.raceId, gatePosition, target);
  const audits = gateAuditEvents(auditEvents, gatePosition.gateId, raceDistanceConfiguration.raceId);
  const eventEvidence = trackMap.trackConfiguration?.events.filter((event) => event.includes('gate') || event.includes('approval') || event.includes('workflow') || event.includes('configuration')) ?? ['approval.requested', 'gate.movement.requested.v1'];
  const gateApproval = gateApprovals[0];
  const gateMoveTargetArtifactId = gateApproval?.id ?? gatePosition.lastApprovedRequestId ?? `draft-${raceDistanceConfiguration.raceId}-${gatePosition.gateId}`;
  const gateMoveWorkflowRef = gateApproval?.workflowId ?? trackMap.trackConfiguration?.verificationWorkflow.id;
  const gateMoveAuditRefs = Array.from(new Set([...audits.map((event) => event.id), ...(trackMap.trackConfiguration?.auditIds ?? [])]));
  const gateMoveTwinRefs = Array.from(new Set([trackMap.trackConfiguration?.digitalTwinSync.twinId, ...digitalTwinState.map((state) => state.twinId)].filter(Boolean) as string[]));
  const gateMoveEvidenceRefs = Array.from(new Set([...gateMoveEvidence, ...eventEvidence, ...audits.flatMap((event) => event.evidenceIds ?? [])]));
  const executionPrerequisitesSatisfied = canExecute && approvedGateApprovalExists;
  const gatePlan = {
    raceId: raceDistanceConfiguration.raceId,
    currentSectorId: gatePosition.sectorId,
    currentMetersFromStart: gatePosition.metersFromStart,
    targetSectorId: target.targetSectorId,
    targetMetersFromStart: target.targetMetersFromStart,
    deltaMeters: gateDeltaMeters,
    gpsVerified: gatePosition.gpsVerified,
    approvalRequired: true,
    workOrderId: gateWorkOrder.id,
  };
  const mockLabel = gatePosition.mock || raceDistanceConfiguration.mock || trackMap.mock ? 'MOCK DATA - draft-only placeholder; no live motion command is available.' : 'LIVE DATA - still request-only until approval, work order, GPS verification, audit, and backend execution token complete.';

  return <WorkspaceFrame
    title="Starting Gate Control Workspace"
    label="Starting Gate Control workspace"
    eyebrow="Safety-critical gate workflow"
    description={<>Guided race selection, distance calculation, work-order review, approval proof, GPS verification, audit history, and backend-only gate execution controls. {mockLabel}</>}
    mock={gatePosition.mock || raceDistanceConfiguration.mock || trackMap.mock || mode === 'mock'}
    operationalSummary={<><DataFreshness label="Starting gate and distance" timestamp={digitalTwinState[0]?.lastUpdatedAt} mode={mode} /><MetricStrip items={[
      { label: 'Race distance', value: `${raceDistanceConfiguration.distanceMeters}m`, detail: `Configured by ${raceDistanceConfiguration.configuredBy}` },
      { label: 'Current gate', value: `${gatePosition.metersFromStart}m`, detail: `${gatePosition.gateId} in ${gatePosition.sectorId}; GPS verified ${String(gatePosition.gpsVerified)}` },
      { label: 'Target gate', value: `${target.targetMetersFromStart}m`, detail: `${target.targetSectorId}; delta ${gateDeltaMeters === 0 ? '0m' : `${gateDeltaMeters > 0 ? '+' : ''}${gateDeltaMeters}m`}` },
      { label: 'Approval roles', value: String(approvalRoles.length), detail: approvalRoles.join(', ') },
    ]} /></>}
    evidenceDetailPanel={<><p>Work order <code>{gateWorkOrder.id}</code> requires {gateWorkOrder.evidenceRequired.join(', ')}.</p><p>Event evidence path: {eventEvidence.join(' -> ')}.</p><p>Approval APIs: <code>POST /api/v1/approvals/draft-requests</code> and <code>POST /api/v1/track-configuration/draft-requests</code>.</p></>}
    eventTimeline={audits.length ? <EventTimeline events={audits.map((event) => ({ time: event.timestamp, label: `${event.type}: ${event.subjectId ?? gatePosition.gateId}; hash ${event.hash}`, tone: event.severity }))} /> : <p>No gate-specific audit events yet; draft creation will record approval.requested and audit evidence.</p>}
    approvalContext={<><p>Approved gate request exists: <strong>{String(approvedGateApprovalExists)}</strong>. Backend execution token accepted: <strong>{String(canExecute)}</strong>.</p><p>Gate approvals: {gateApprovals.map((approval) => `${approval.id}:${approval.status}:${approval.action}`).join('; ') || 'none yet'}.</p></>}
    auditContext={<><p>Audit records: {audits.map((event) => `${event.id}:${event.hash}`).join('; ') || 'none yet'}.</p><p>Track configuration audit IDs: {trackMap.trackConfiguration?.auditIds.join(', ') ?? 'pending draft audit'}.</p></>}
    digitalTwinContext={<><p>Digital Twin sync preview: {trackMap.trackConfiguration?.digitalTwinSync.status ?? 'approval-required'} for {trackMap.trackConfiguration?.digitalTwinSync.twinId ?? gatePosition.gateId}.</p><p>Runtime twins loaded: {digitalTwinState.length}; patch remains blocked until approval and GPS verification complete.</p></>}
    primary={<>
    <p>Guided flow for selecting a race, reviewing distance, calculating target gate position, creating a draft move request, reviewing required approvals, tracking work order status, verifying GPS/location status, and reviewing audit history. {mockLabel}</p>
    <section aria-label="Starting gate race selection">
      <h3>1. Select race</h3>
      <label>Race <select aria-label="Select race for starting gate workflow" defaultValue={raceDistanceConfiguration.raceId} disabled>{(readiness.races.length ? readiness.races : [{ raceId: raceDistanceConfiguration.raceId }]).map((race) => <option key={race.raceId} value={race.raceId}>{race.raceId}</option>)}</select></label>
      <p>Selected race {raceDistanceConfiguration.raceId}{selectedRace ? ` posts at ${selectedRace.postTime} with readiness ${selectedRace.status}` : ''}. Selection is read-only in this shell; race and gate configuration changes are drafted through <code>POST /api/v1/track-configuration/draft-requests</code>.</p>
    </section>
    <section aria-label="Starting gate current distance">
      <h3>2. View current distance and gate position</h3>
      <MetricStrip items={[
        { label: 'Race distance', value: `${raceDistanceConfiguration.distanceMeters}m`, detail: `Configured by ${raceDistanceConfiguration.configuredBy}` },
        { label: 'Current gate', value: `${gatePosition.metersFromStart}m`, detail: `${gatePosition.gateId} in ${gatePosition.sectorId}; GPS verified ${String(gatePosition.gpsVerified)}` },
        { label: 'Track distance', value: `${trackMap.distanceMeters}m`, detail: `Gate sector ${raceDistanceConfiguration.gateSectorId}` },
        { label: 'Approval roles', value: String(approvalRoles.length), detail: approvalRoles.join(', ') },
      ]} />
    </section>
    <section id="track-map-region" aria-label="Starting gate map overlays">
      <h3>Track map and gate overlays</h3>
      <TrackMapPanel map={trackMap} routeContext="starting-gate" />
      <TrackMap map={trackMap} gatePlan={gatePlan} routeContext="starting-gate" />
    </section>
    <section aria-label="Starting gate required position calculation">
      <h3>3. Calculate required gate position</h3>
      <p>Target gate position: <strong>{target.targetMetersFromStart}m from start in {target.targetSectorId}</strong>. Move delta: <strong>{gateDeltaMeters === 0 ? '0m; current placement matches configured distance' : `${gateDeltaMeters > 0 ? '+' : ''}${gateDeltaMeters}m`}</strong>.</p>
      <p>Calculation basis: track distance {trackMap.distanceMeters}m minus configured race distance {raceDistanceConfiguration.distanceMeters}m. This is a target calculation only and does not mutate gate state.</p>
    </section>
    <section aria-label="Starting gate move request package">
      <h3>4. Create gate move request</h3>
      <p>Draft payload for {gatePosition.gateId}: current {gatePosition.sectorId} {gatePosition.metersFromStart}m, target {target.targetSectorId} {target.targetMetersFromStart}m, approvalRequired=true, liveExecutionAllowed=false.</p>
      <button type="button" disabled aria-disabled="true" aria-label="Create draft starting gate move request">Create draft move request (approval API only)</button>
      <button type="button" disabled aria-disabled="true" aria-label="Draft race distance configuration request">Draft distance change requires approval</button>
      <p>Client helpers: <code>requestStartingGateMoveDraft()</code> creates generic approval drafts, while <code>requestTrackConfigurationDraft()</code> uses <code>client.createTrackConfigurationDraft()</code> for track-configuration changes; neither calls a live gate actuator.</p>
      <CollaborationPanel
        routeScope="starting-gate"
        title="Gate Move Request Room"
        targetArtifactId={gateMoveTargetArtifactId}
        targetArtifactType="gate-move-request"
        tenantId={trackMap.trackId}
        racetrackId={trackMap.trackId}
        workflowRef={gateMoveWorkflowRef}
        approvalRef={gateApproval?.id ?? raceDistanceConfiguration.approvedRequestId}
        auditRefs={gateMoveAuditRefs}
        twinRefs={gateMoveTwinRefs}
        evidenceRefs={gateMoveEvidenceRefs}
        variant="approval-discussion"
        activityItems={[
          { id: 'gate-calc', actor: 'starting-gate-workspace', message: `Target ${target.targetSectorId} at ${target.targetMetersFromStart}m calculated for ${raceDistanceConfiguration.raceId}.`, at: digitalTwinState[0]?.lastUpdatedAt ?? 'pending', tone: 'info' },
          { id: 'gate-approval', actor: gateApproval?.requestedBy ?? 'approval-service', message: `Approval ${gateApproval?.status ?? 'pending draft'} for ${gatePosition.gateId}; execution remains locked.`, at: gateApproval?.createdAt ?? 'pending', tone: gateApproval?.status === 'approved' ? 'ok' : 'warning' },
        ]}
      />
    </section>
    <section aria-label="Starting gate approval requirement">
      <h3>5. Review required approvals</h3>
      <p>Required roles: {approvalRoles.join(', ')}. Approved gate request exists: <strong>{String(approvedGateApprovalExists)}</strong>; approval token accepted by backend: <strong>{String(canExecute)}</strong>; execution remains locked unless both are true.</p>
      <p>Gate approval requests: {gateApprovals.map((approval) => `${approval.id}:${approval.status}:${approval.action}`).join('; ') || 'none yet'}.</p>
      <p>Approval routes: <code>POST /api/v1/approvals/draft-requests</code>, <code>POST /api/v1/track-configuration/draft-requests</code>, and review via <code>GET /api/v1/approvals/requests</code>.</p>
      <DataTable label="Starting gate approval-required requests" rows={gateApprovals} getRowKey={(approval) => approval.id} emptyMessage="No active gate approval request yet; create a draft request to route approvals." columns={[
        { key: 'status', header: 'Status', render: (approval) => <ApprovalChip status={approval.status} /> },
        { key: 'action', header: 'Action', render: (approval) => approval.action },
        { key: 'target', header: 'Target', render: (approval) => approval.target },
        { key: 'evidence', header: 'Evidence', render: (approval) => approval.evidence.join(', ') },
      ]} />
      {raceReadinessApprovals.map((approval) => <article key={approval.id}><ApprovalChip status={approval.status === 'satisfied' ? 'approved' : 'pending-approval'} /><strong>{approval.action}</strong><p>{approval.reason}; roles {approval.requiredRoles.join(', ')}; evidence {approval.evidence.join(', ')}</p></article>)}
    </section>
    <section aria-label="Starting gate work order">
      <h3>6. Generate work order status</h3>
      <article aria-label="Starting gate work order draft" data-placeholder={String(!configuredWorkOrder)} data-execution-allowed="false">
        <strong>{gateWorkOrder.id}</strong>
        <p>Crew {gateWorkOrder.crew}; status {gateWorkOrder.status}; due {gateWorkOrder.dueAt}.</p>
        <p>Tasks: {gateWorkOrder.tasks.join(' -> ')}</p>
        <p>Evidence required: {gateWorkOrder.evidenceRequired.join(', ')}.</p>
        <p role="status">{configuredWorkOrder ? 'Placeholder work order status derived from current DTOs is superseded by the configured TrackMapDto gate work order.' : 'Placeholder work order status derived from current DTOs until the backend returns a specific gate work order.'}</p>
      </article>
      <button type="button" disabled aria-disabled="true" aria-label="Generate approval-blocked starting gate work order">Generate work order disabled until draft approval is accepted</button>
    </section>
    <section aria-label="Starting gate GPS verification">
      <h3>7. Verify GPS/location status</h3>
      <p>Current GPS verified: <strong>{String(gatePosition.gpsVerified)}</strong>. Target GPS verification: <strong>pending field evidence</strong>. Last approved request: {gatePosition.lastApprovedRequestId ?? 'none'}.</p>
      <p>Digital Twin sync preview: {trackMap.trackConfiguration?.digitalTwinSync.status ?? 'approval-required'}; actuator available {String(trackMap.trackConfiguration?.verificationWorkflow.actuatorControlAvailable ?? false)}.</p>
      <button type="button" disabled aria-disabled="true" aria-label="Verify starting gate GPS location">Verify GPS disabled until field evidence and approval workflow exist</button>
    </section>
    <section aria-label="Starting gate audit trail">
      <h3>8. Review audit and event evidence</h3>
      <p>Audit records: {audits.map((event) => `${event.id}:${event.hash}`).join('; ') || 'none yet'}.</p>
      <p>Event path: {eventEvidence.join(' -> ')}. Audit IDs from track configuration: {trackMap.trackConfiguration?.auditIds.join(', ') ?? 'pending draft audit'}.</p>
      {audits.length ? <EventTimeline events={audits.map((event) => ({ time: event.timestamp, label: `${event.type}: ${event.subjectId ?? gatePosition.gateId}; hash ${event.hash}`, tone: event.severity }))} /> : <p>No gate-specific audit events yet; draft creation will record approval.requested and audit evidence.</p>}
      <p>Digital Twin patch preview remains blocked until approval and GPS verification complete.</p>
    </section>
    <section id="safety-controls" aria-label="Starting gate safety critical execution lock">
      <h3>Safety-critical execution</h3>
      <SafetyCriticalActionButton approvalsSatisfied={executionPrerequisitesSatisfied} backendLive={mode === 'live'} authenticated={authenticated} ariaLabel="Execute approved starting gate move requires approval token">Execute approved gate move</SafetyCriticalActionButton>
      <p>Disabled until an approved gate request exists and the authenticated live backend returns a valid approval token. This UI does not mutate gate state locally or expose a live actuator path.</p>
    </section>
    </>}
  />;
}
