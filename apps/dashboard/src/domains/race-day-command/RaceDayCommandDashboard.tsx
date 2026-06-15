import type { ReactNode } from 'react';
import { DataTable, EvidencePanel, EventTimeline, MetricStrip, NexusCard, RecommendationCard, RiskBadge, SafetyCriticalActionButton, StatusIndicator, WorkspaceFrame, WorkspaceLayout } from '../../components/nexus-ui.js';
import type { NexusRole } from '../../types.js';
import { raceDayRealtimeSources, useApprovalNotifications, useAzureSignalRSync, useRaceStateWebSocket, type RaceDayLiveSnapshot, type SignalRSyncSnapshot } from './realtime.js';

export interface RaceDayTrackCondition {
  sectionId: string;
  label: string;
  status: 'nominal' | 'watch' | 'critical';
  moisture: number;
  compaction: number;
  evidence: string[];
}

export interface RaceDayApprovalAction {
  id: string;
  action: string;
  target: string;
  requiredRoles: string[];
  expiresAt: string;
  requestedAt: string;
  aiRecommendation: string;
  confidence: number;
  sensorEvidence: string[];
  rulebookCitations: string[];
  historicalContext: string[];
}

export interface RaceDayIncidentReview {
  id: string;
  raceId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  evidence: string[];
  rulebookRefs: string[];
}

export interface RaceDaySecurityZone {
  zoneId: string;
  label: string;
  occupancy: number;
  capacity: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export interface RaceDayCameraFeed {
  cameraId: string;
  label: string;
  zoneId: string;
  health: 'online' | 'degraded' | 'offline';
  privacyMasking: boolean;
}

export interface RaceDayHorseProfile {
  horseId: string;
  name: string;
  eligibilityStatus: 'eligible' | 'under-review' | 'ineligible';
  veterinaryRecord: string;
  publicSummary: string;
  location: string;
}

export interface RaceDayCommandData {
  generatedAt: string;
  race: { raceId: string; status: 'scheduled' | 'ready' | 'running' | 'stopped' | 'official'; postTime: string; activeRunners: number };
  trackConditions: RaceDayTrackCondition[];
  approvals: RaceDayApprovalAction[];
  incidents: RaceDayIncidentReview[];
  securityZones: RaceDaySecurityZone[];
  cameraFeeds: RaceDayCameraFeed[];
  horses: RaceDayHorseProfile[];
}

export interface RaceDayCommandDashboardProps {
  data?: RaceDayCommandData;
  roles?: NexusRole[];
  raceState?: RaceDayLiveSnapshot;
  signalR?: SignalRSyncSnapshot;
  approvalEvents?: Array<{ id: string; timestamp: string; type: string; summary: string; severity: 'info' | 'advisory' | 'warning' | 'critical'; source: string }>;
  onApprovalDecision?: (approvalId: string, decision: 'approve' | 'reject' | 'more-info') => void;
}

const nowForFixture = '2026-06-14T18:00:00.000Z';

function minutesRemaining(expiresAt: string, now = nowForFixture) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.parse(now)) / 60_000));
}

function canViewVeterinaryRecords(roles: NexusRole[]) {
  return roles.some((role) => ['veterinarian', 'steward', 'admin'].includes(role));
}

export function createRaceDayCommandFixture(): RaceDayCommandData {
  return {
    generatedAt: nowForFixture,
    race: { raceId: 'race-7', status: 'ready', postTime: '2026-06-14T18:10:00.000Z', activeRunners: 8 },
    trackConditions: [
      { sectionId: 'far-turn', label: 'Far Turn', status: 'watch', moisture: 27, compaction: 276, evidence: ['sensor:surface-live-1', 'inspection:standing-water'] },
      { sectionId: 'stretch', label: 'Home Stretch', status: 'nominal', moisture: 12, compaction: 212, evidence: ['sensor:surface-live-3'] },
    ],
    approvals: [
      { id: 'approval-race-start-7', action: 'race_start', target: 'race-7', requiredRoles: ['racing-secretary', 'steward', 'veterinarian'], requestedAt: nowForFixture, expiresAt: '2026-06-14T18:02:00.000Z', aiRecommendation: 'Start Race 7 only after steward and veterinarian confirm far-turn watch conditions.', confidence: 0.91, sensorEvidence: ['surface moisture 27%', 'gate GPS verified', 'weather cell west 11mi'], rulebookCitations: ['ARCI 004-105 race start authority', 'HISA safety review'], historicalContext: ['Race 4 delayed after similar far-turn moisture pattern'] },
      { id: 'approval-scratch-horse-1', action: 'scratch_decision', target: 'horse-1', requiredRoles: ['veterinarian', 'steward'], requestedAt: nowForFixture, expiresAt: '2026-06-14T18:02:00.000Z', aiRecommendation: 'Scratch Safety First pending lameness review and steward concurrence.', confidence: 0.84, sensorEvidence: ['vet exam: left fore soreness', 'paddock gait anomaly'], rulebookCitations: ['Medication and welfare scratch policy'], historicalContext: ['Prior workout flagged welfare watch'] },
    ],
    incidents: [{ id: 'incident-paddock-1', raceId: 'race-7', severity: 'high', summary: 'Credential mismatch at paddock gate under review.', evidence: ['camera:paddock-2', 'credential:denied'], rulebookRefs: ['restricted-zone access policy'] }],
    securityZones: [
      { zoneId: 'paddock', label: 'Paddock', occupancy: 18, capacity: 20, risk: 'high' },
      { zoneId: 'barn-2', label: 'Barn 2', occupancy: 9, capacity: 16, risk: 'medium' },
      { zoneId: 'winner-circle', label: 'Winner Circle', occupancy: 2, capacity: 12, risk: 'low' },
    ],
    cameraFeeds: [
      { cameraId: 'camera-paddock-2', label: 'Paddock Gate 2', zoneId: 'paddock', health: 'online', privacyMasking: true },
      { cameraId: 'camera-barn-2', label: 'Barn 2 Aisle', zoneId: 'barn-2', health: 'degraded', privacyMasking: true },
    ],
    horses: [
      { horseId: 'horse-1', name: 'Safety First', eligibilityStatus: 'under-review', veterinaryRecord: 'Private vet note: mild left fore soreness; flexion recheck pending.', publicSummary: 'Veterinary review pending before race-day clearance.', location: 'paddock' },
      { horseId: 'horse-2', name: 'Command Runner', eligibilityStatus: 'eligible', veterinaryRecord: 'Private vet note: cleared at morning exam.', publicSummary: 'Cleared for race-day participation.', location: 'barn-2' },
    ],
  };
}

function PendingApprovalBadge({ count }: { count: number }) {
  return <span className="pending-approval-badge" role="status" aria-label={`${count} pending approvals`} data-tone={count ? 'critical' : 'ok'}>{count ? `RED ${count}` : '0'}</span>;
}

function RaceControlView({ data }: { data: RaceDayCommandData }) {
  return (
    <section aria-labelledby="race-control-heading" data-view="race-control">
      <h3 id="race-control-heading">Race Control View</h3>
      <MetricStrip items={[
        { label: 'Race status', value: data.race.status, detail: `Race ${data.race.raceId} post ${data.race.postTime}` },
        { label: 'Active runners', value: String(data.race.activeRunners), detail: 'declared and not scratched' },
        { label: 'Pending approvals', value: String(data.approvals.length), detail: 'red badge safety queue' },
      ]} />
      <div aria-label="Race control pending approvals red badge"><PendingApprovalBadge count={data.approvals.length} /></div>
      <div className="card-grid" aria-label="Live track conditions">
        {data.trackConditions.map((condition) => (
          <NexusCard key={condition.sectionId} title={condition.label} status={condition.status} tone={condition.status === 'critical' ? 'critical' : condition.status === 'watch' ? 'warning' : 'ok'} detail={`Moisture ${condition.moisture}%, compaction ${condition.compaction}. Evidence ${condition.evidence.join(', ')}`} />
        ))}
      </div>
    </section>
  );
}

function ApprovalPanel({ approvals, onDecision }: { approvals: RaceDayApprovalAction[]; onDecision?: RaceDayCommandDashboardProps['onApprovalDecision'] }) {
  return (
    <section aria-labelledby="approval-panel-heading" data-view="approval-panel">
      <h3 id="approval-panel-heading">Approval Panel</h3>
      <p role="status" aria-live="polite">Every protected action waits for explicit human approval before mutation.</p>
      {approvals.map((approval) => {
        const remaining = minutesRemaining(approval.expiresAt);
        return (
          <article key={approval.id} aria-label={`Approval request ${approval.id}`} className="approval-request-card">
            <RecommendationCard id={approval.id} title={`${approval.action} for ${approval.target}`} recommendation={approval.aiRecommendation} confidence={approval.confidence} riskLevel="critical" evidenceRefs={[...approval.sensorEvidence, ...approval.rulebookCitations, ...approval.historicalContext]} approvalRequired />
            <output role="timer" aria-live="assertive" aria-label={`Approval window remaining for ${approval.id}`}>{remaining} minutes remaining</output>
            <EvidencePanel title={`${approval.id} supporting evidence`} evidenceRefs={approval.sensorEvidence} auditRefs={approval.rulebookCitations} eventRefs={approval.historicalContext} source="sensor data, rulebook citations, historical context" />
            <div role="group" aria-label={`Decision buttons for ${approval.id}`}>
              <button type="button" onClick={() => onDecision?.(approval.id, 'approve')}>Approve</button>
              <button type="button" onClick={() => onDecision?.(approval.id, 'reject')}>Reject</button>
              <button type="button" onClick={() => onDecision?.(approval.id, 'more-info')}>Request More Info</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function StewardingView({ incidents }: { incidents: RaceDayIncidentReview[] }) {
  return (
    <section aria-labelledby="stewarding-heading" data-view="stewarding">
      <h3 id="stewarding-heading">Stewarding View</h3>
      <form role="search" aria-label="Rulebook RAG query interface">
        <label htmlFor="rulebook-query">Rulebook RAG query</label>
        <input id="rulebook-query" name="rulebook-query" type="search" placeholder="Ask about interference, scratches, or race start authority" />
        <button type="button">Search rulebook</button>
      </form>
      <DataTable
        label="Incident review table"
        rows={incidents}
        getRowKey={(row) => row.id}
        columns={[
          { key: 'id', header: 'Incident', render: (row) => row.id },
          { key: 'severity', header: 'Severity', render: (row) => <RiskBadge level={row.severity} /> },
          { key: 'summary', header: 'Review', render: (row) => `${row.summary} Evidence ${row.evidence.join(', ')} Rules ${row.rulebookRefs.join(', ')}` },
        ]}
      />
    </section>
  );
}

function SecurityView({ zones, cameras }: { zones: RaceDaySecurityZone[]; cameras: RaceDayCameraFeed[] }) {
  return (
    <section aria-labelledby="security-heading" data-view="security">
      <h3 id="security-heading">Security View</h3>
      <ul className="zone-occupancy-heatmap" aria-label="Zone occupancy heatmap">
        {zones.map((zone) => <li key={zone.zoneId} data-risk={zone.risk} aria-label={`${zone.label} occupancy ${zone.occupancy} of ${zone.capacity}`}><strong>{zone.label}</strong> {zone.occupancy}/{zone.capacity} <RiskBadge level={zone.risk} /></li>)}
      </ul>
      <div aria-label="Camera feeds">
        {cameras.map((camera) => <figure key={camera.cameraId} data-camera-health={camera.health}><figcaption>{camera.label} camera feed <StatusIndicator label={camera.health} tone={camera.health === 'online' ? 'ok' : camera.health === 'degraded' ? 'warning' : 'critical'} /> Privacy masking {camera.privacyMasking ? 'enabled' : 'disabled'}</figcaption><div role="img" aria-label={`${camera.label} live camera placeholder`}>Live camera frame unavailable in tests</div></figure>)}
      </div>
      <form aria-label="Credential validation">
        <label htmlFor="credential-id">Credential ID</label>
        <input id="credential-id" name="credential-id" />
        <button type="button">Validate credential</button>
      </form>
    </section>
  );
}

function EquineView({ horses, roles }: { horses: RaceDayHorseProfile[]; roles: NexusRole[] }) {
  const showVet = canViewVeterinaryRecords(roles);
  return (
    <section aria-labelledby="equine-heading" data-view="equine">
      <h3 id="equine-heading">Equine View</h3>
      <div className="card-grid" aria-label="Horse profiles">
        {horses.map((horse) => (
          <NexusCard key={horse.horseId} title={horse.name} status={horse.eligibilityStatus} tone={horse.eligibilityStatus === 'eligible' ? 'ok' : horse.eligibilityStatus === 'under-review' ? 'warning' : 'critical'} detail={`Location ${horse.location}. Eligibility status ${horse.eligibilityStatus}.`}>
            <p>Veterinary records: {showVet ? horse.veterinaryRecord : 'redacted for veterinary privacy'}</p>
            <p>{horse.publicSummary}</p>
          </NexusCard>
        ))}
      </div>
    </section>
  );
}

function RealtimeStatus({ raceState, signalR, approvalEvents }: { raceState?: RaceDayLiveSnapshot; signalR?: SignalRSyncSnapshot; approvalEvents: RaceDayCommandDashboardProps['approvalEvents'] }) {
  return (
    <section aria-label="Realtime safety-system connections" aria-live="polite">
      <p>WebSocket race state: {raceState?.connection ?? 'not connected'} at {raceState?.url ?? raceDayRealtimeSources.raceStateWebSocket}</p>
      <p>SSE approval notifications: {raceDayRealtimeSources.approvalNotificationsSse}; events {approvalEvents?.length ?? 0}</p>
      <p>Azure SignalR multi-device sync: {signalR?.connection ?? 'not connected'} at {signalR?.hubUrl ?? raceDayRealtimeSources.azureSignalRHub}; devices {signalR?.deviceCount ?? 1}</p>
    </section>
  );
}

export function RaceDayCommandDashboard({ data = createRaceDayCommandFixture(), roles = ['steward'], raceState, signalR, approvalEvents = [], onApprovalDecision }: RaceDayCommandDashboardProps) {
  return (
    <WorkspaceLayout label="Race-day command dashboard" skipLink={{ href: '#race-day-command-main', label: 'Skip to race-day command content' }}>
      <WorkspaceFrame
        id="race-day-command-main"
        title="Race-Day Command"
        eyebrow="Safety-critical command center"
        description="Live race command surface with mandatory human approval workflows and accessible decision support."
        metadata={<RealtimeStatus raceState={raceState} signalR={signalR} approvalEvents={approvalEvents} />}
        summaryItems={[
          { label: 'WCAG', value: '2.1 AA', detail: 'landmarks, labels, contrast-ready tones, timers announced' },
          { label: 'Approval window', value: '120s', detail: 'race-critical maximum wait' },
          { label: 'Realtime', value: 'WS + SSE + SignalR', detail: 'race state, approvals, mobile sync' },
        ]}
        primary={<>
          <RaceControlView data={data} />
          <ApprovalPanel approvals={data.approvals} onDecision={onApprovalDecision} />
          <StewardingView incidents={data.incidents} />
          <SecurityView zones={data.securityZones} cameras={data.cameraFeeds} />
          <EquineView horses={data.horses} roles={roles} />
        </>}
        evidenceDetailPanel={<EvidencePanel title="Race-day command evidence packet" evidenceRefs={data.approvals.flatMap((approval) => approval.sensorEvidence)} auditRefs={data.approvals.flatMap((approval) => approval.rulebookCitations)} eventRefs={approvalEvents.map((event) => event.id)} />}
        eventTimeline={<EventTimeline events={approvalEvents.map((event) => ({ time: event.timestamp, label: event.type, tone: event.severity === 'critical' ? 'critical' : event.severity === 'warning' ? 'warning' : 'info' }))} label="Race-day realtime approval event timeline" />}
        approvalContext={<SafetyCriticalActionButton approvalsSatisfied={false} backendLive={Boolean(raceState && raceState.connection === 'connected')} authenticated ariaLabel="Execute race-day command">Execute race-day command</SafetyCriticalActionButton>}
        auditContext={<p>All decision buttons route to approval APIs and immutable audit/event records before operational mutation.</p>}
        digitalTwinContext={<p>Race, horse, and zone projections remain backend-owned and update through event projections.</p>}
      />
    </WorkspaceLayout>
  );
}

export function LiveRaceDayCommandDashboard(props: Omit<RaceDayCommandDashboardProps, 'raceState' | 'signalR' | 'approvalEvents'> & { children?: ReactNode }) {
  const raceState = useRaceStateWebSocket();
  const approvals = useApprovalNotifications();
  const signalR = useAzureSignalRSync();
  return <RaceDayCommandDashboard {...props} raceState={raceState} signalR={signalR} approvalEvents={approvals.events.map((event) => ({ id: event.id, timestamp: event.timestamp, type: event.type, summary: event.summary, severity: event.severity, source: event.source }))} />;
}
