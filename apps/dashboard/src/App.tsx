import type { Role } from '@trackmind/shared';
import { createNexusClient, type NexusApiClient } from './api/client.js';
import { DataState } from './components/states.js';
import { ApprovalChip, AssetHealthIndicator, AuditEventRow, DigitalTwinRelationshipCard, EventTimeline, KpiTile, RiskBadge, SafetyCriticalActionButton, StatusCard, TrackMapPanel } from './components/nexus-ui.js';
import { ApprovalsPanel } from './domains/approvals/ApprovalsPanel.js';
import { AuditReviewPanel } from './domains/audit/AuditReviewPanel.js';
import { TrackMap } from './domains/track-map/TrackMap.js';
import { domainScreens } from './shell/domains.js';
import { breadcrumbForPath, filterCommandPalette, selectTenant, serviceBanner, tenants, type ServiceState, type UserProfile } from './shell/experience.js';
import { groupedVisibleNavItems, visibleNavItems } from './shell/navigation.js';


const commandCenterWorkspaces = [
  { title: 'Operations Command Homepage', purpose: 'Above-the-fold race readiness, surface, safety, weather, digital twin, incidents, approvals, and AI decision cues.', items: ['Race Readiness', 'Surface', 'Safety', 'Weather', 'Track Digital Twin', 'Incidents', 'Approvals', 'AI'] },
  { title: 'Racetrack Digital Twin', purpose: 'Interactive track map with clickable sectors, starting gate, barns, cameras, horses, assets, telemetry, event history, and relationships.', items: ['Interactive Track Map', 'Details', 'History', 'Events', 'Approvals', 'Telemetry', 'Relationships'] },
  { title: 'Race Office Workspace', purpose: 'Airline-style scheduling console for the racing office and day-of-card operations.', items: ['Race Calendar', "Today's Card", 'Entries', 'Declarations', 'Scratches', 'Conditions Book', 'Readiness'] },
  { title: 'Surface Intelligence Workspace', purpose: 'GIS-style surface health, heatmaps, maintenance queues, and AI recommendations.', items: ['Surface Health Score', 'Moisture Heatmap', 'Compaction Heatmap', 'Drainage Heatmap', 'Maintenance Queue', 'AI Recommendations'] },
  { title: 'Starting Gate Control Workspace', purpose: 'Controlled gate movement workflow from distance change through GPS verification and activation.', items: ['Track Map', 'Current Position', 'Target Position', 'Distance Calculator', 'Move Request', 'Approval Status'] },
  { title: 'Approvals Center', purpose: 'Single queue for race day, surface, veterinary, security, compliance, and AI decisions requiring human approval.', items: ['Pending Approvals', 'Race Day', 'Surface', 'Veterinary', 'Security', 'Compliance', 'AI'] },
  { title: 'AI Command Center', purpose: 'Decision-support interface for governed recommendations, risks, predictions, forecasts, reviews, and expert consensus.', items: ['Recommendations', 'Risks', 'Predictions', 'Forecasts', 'Pending Reviews', 'Expert Consensus'] },
  { title: 'Executive Center', purpose: 'Real-time executive visibility across safety, operations, revenue, compliance, maintenance, and AI KPIs.', items: ['Safety KPI', 'Operational KPI', 'Revenue KPI', 'Compliance KPI', 'Maintenance KPI', 'AI KPI'] },
  { title: 'Mobile Command Surface', purpose: 'Focused mobile companion for alerts, approvals, incidents, track status, and emergency actions only.', items: ['Alerts', 'Approvals', 'Incidents', 'Track Status', 'Emergency Actions'] },
];

const startingGateWorkflow = ['Change Distance', 'Move Gate', 'Approve', 'Work Order', 'Verify GPS', 'Activate'];

export async function loadCommandCenter(client: NexusApiClient) {
  const [approvals, auditEvents, trackMap, operations, readiness, gatePosition, raceDistanceConfiguration, digitalTwinState, raceOffice, surfaceIntelligence, equineIntelligence, barnOperations, stewardCenter, securityOperations, emergencyOperations, complianceLibrary, aiGovernance] = await Promise.all([
    client.listApprovals(),
    client.listAuditEvents(),
    client.getTrackMap(),
    client.getOperationsCommandCenter(),
    client.getRaceDayReadinessDashboard(),
    client.getGatePosition(),
    client.getRaceDistanceConfiguration(),
    client.listDigitalTwinState(),
    client.getRaceOffice(),
    client.getSurfaceIntelligence(),
    client.getEquineIntelligence(),
    client.getBarnOperations(),
    client.getStewardCenter(),
    client.getSecurityOperations(),
    client.getEmergencyOperations(),
    client.getComplianceLibrary(),
    client.getAIGovernanceWorkspace(),
  ]);
  return { approvals, auditEvents, trackMap, operations, readiness, gatePosition, raceDistanceConfiguration, digitalTwinState, raceOffice, surfaceIntelligence, equineIntelligence, barnOperations, stewardCenter, securityOperations, emergencyOperations, complianceLibrary, aiGovernance, streamUrl: client.eventStreamUrl(), mode: client.mode };
}

export function isSafetyCriticalEnabled(args: { authenticated: boolean; hasApprovalToken: boolean; backendMode: 'live' | 'mock' }) {
  return args.authenticated && args.hasApprovalToken && args.backendMode === 'live';
}

export async function requestRaceStartApproval(client: NexusApiClient, actor: string, raceId: string) {
  return client.requestControlledAction({
    action: 'race-start',
    target: raceId,
    reason: 'Frontend requested protected race start approval; execution remains disabled until backend approval token is issued.',
    actor,
  });
}

export function CommandCenter({ data, roles, authenticated = true, tenantId = 'saratoga', path = '/operations', serviceState = 'online', paletteQuery = '', user = { name: 'Avery Chen', title: 'Race Day Commander', roles } }: { data: Awaited<ReturnType<typeof loadCommandCenter>>; roles: Role[]; authenticated?: boolean; tenantId?: string; path?: string; serviceState?: ServiceState; paletteQuery?: string; user?: UserProfile }) {
  const nav = visibleNavItems(roles);
  const navGroups = groupedVisibleNavItems(roles);
  const visibleIds = new Set(nav.map((item) => item.id));
  const tenant = selectTenant(tenantId);
  const banner = serviceBanner(serviceState, data.mode === 'mock');
  const breadcrumbs = breadcrumbForPath(path);
  const paletteItems = filterCommandPalette(paletteQuery, roles);
  const canExecute = isSafetyCriticalEnabled({ authenticated, hasApprovalToken: false, backendMode: data.mode });

  if (!authenticated) return <main aria-label="Login ready route"><h1>TrackMind Nexus</h1><p>Please sign in to continue to the racetrack command center.</p></main>;

  return (
    <main className="nexus-shell">
      <aside aria-label="Persistent sidebar"><nav aria-label="Primary navigation">{navGroups.map((group) => <section key={group.section.id} aria-label={`${group.section.label} navigation group`}><h2>{group.section.label}</h2>{group.items.map((item) => <a key={item.id} href={item.path}>{item.label}</a>)}</section>)}</nav></aside>
      <header aria-label="Top command bar">
        <h1>TrackMind Nexus</h1>
        <p>Enterprise command-center shell with authentication-aware, role-filtered navigation.</p>
        <form role="search" aria-label="Global search"><label>Global search <input aria-label="Search races, assets, horses, people, and incidents" placeholder="Search Nexus" /></label></form>
        <nav aria-label="Breadcrumb">{breadcrumbs.map((crumb, index) => <span key={crumb}>{index > 0 ? ' / ' : ''}{crumb}</span>)}</nav>
        <label>Racetrack <select aria-label="Tenant racetrack selector" defaultValue={tenant.id}>{tenants.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <p aria-label="Race day status"><span aria-hidden="true">●</span> {tenant.name}: {tenant.status}</p>
        <section aria-label="Notification center"><h2>Notifications</h2><p>2 operational advisories pending review.</p></section>
        <details aria-label="User profile menu"><summary>{user.name}</summary><p>{user.title}</p><p>Roles: {user.roles.join(', ')}</p></details>
        <p>Event stream ready: <code>{data.streamUrl}</code></p>
        <p>Deployment assumption: internet-facing frontend should sit behind Azure Front Door with HTTPS, managed TLS certificates, WAF, CDN/global routing, and centralized access/security logs.</p>
      </header>
      <aside role="status" aria-label="Service status banner" data-tone={banner.tone}>{banner.message}</aside>
      <section aria-label="Emergency action banner area"><h2>Emergency Ops</h2><p>No emergency action is active. Escalation controls require commander approval.</p></section>
      <section aria-label="Quick-access command palette"><h2>Command Palette</h2><input aria-label="Command palette query" defaultValue={paletteQuery} /><ul>{paletteItems.map((item) => <li key={item.id}><a href={item.path}>{item.label}</a></li>)}</ul></section>
      {data.mode === 'mock' && <aside role="note">Mock adapter active: panels are placeholders until matching backend APIs are available.</aside>}
      <section aria-label="Operational state examples"><DataState state={{ status: 'loading' }}>{() => null}</DataState><DataState state={{ status: 'empty', mock: data.mode === 'mock' }}>{() => null}</DataState><DataState state={{ status: 'error', message: 'Example degraded feed', mock: data.mode === 'mock' }}>{() => null}</DataState><p role="alert">Permission denied state: request a role grant to unlock restricted workflows.</p><p role="status">Offline/degraded-service state: cached read-only view is available.</p></section>
      <section aria-label="Unified Operations Command Center">
        <h2>Unified Operations Command Center</h2>
        <p>Primary landing page aggregating race readiness, surface, weather, incidents, approvals, stewarding, assets, workforce, emergency resources, facilities, and AI recommendations from governed sources.</p>
        <div aria-label="Configurable widget grid">{data.operations.widgets.map((widget) => <article key={widget.id} aria-label={`${widget.title} widget`} data-source={widget.source} data-configurable={widget.configurable}><h3><a href={widget.drillDownPath}>{widget.title}</a></h3><RiskBadge level={widget.status === 'nominal' ? 'low' : widget.status === 'advisory' ? 'medium' : widget.status === 'warning' ? 'high' : 'critical'} /><strong>{widget.value}</strong><p>{widget.detail}</p><small>Source: {widget.source}; domain: {widget.domain}; drill-down: {widget.drillDownPath}</small></article>)}</div>
        <section aria-label="Saved layouts and role-specific views"><h3>Saved layouts</h3>{data.operations.savedLayouts.map((layout) => <article key={layout.id}><strong>{layout.name}</strong><p>Role view: {layout.role}; widgets: {layout.widgetIds.join(', ')}</p></article>)}</section>
        <section aria-label="Operational alerts"><h3>Operational alerts</h3>{data.operations.alerts.map((alert) => <article key={alert.id} role={alert.severity === 'critical' ? 'alert' : 'status'}><strong>{alert.title}</strong><p>{alert.severity}; acknowledged: {String(alert.acknowledged)}; action: <a href={alert.actionPath}>{alert.actionPath}</a></p><p>Evidence: {alert.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Live event streaming"><h3>Live event streaming</h3><p>Subscribed to <code>{data.streamUrl}</code></p><EventTimeline events={data.operations.liveEvents.map((event) => ({ time: event.timestamp, label: `${event.domain}: ${event.summary}`, tone: event.severity }))} /></section>
        <section aria-label="AI recommendations"><h3>AI recommendations</h3>{data.operations.aiRecommendations.map((item) => <article key={item.id}><strong>{item.recommendation}</strong><p>Confidence {Math.round(item.confidence * 100)}%; approval required: {String(item.requiresApproval)}; action: <a href={item.actionPath}>{item.actionPath}</a></p><p>Evidence: {item.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Data lineage"><h3>Data lineage</h3>{data.operations.dataLineage.map((lineage) => <p key={`${lineage.domain}-${lineage.reference}`}>{lineage.domain}: {lineage.source} via <code>{lineage.reference}</code></p>)}</section>
      </section>

      <section aria-label="AI Governance workspace">
        <h2>AI Governance Workspace</h2>
        <p>Responsible AI workspace for active agents, model versions, prompt templates, recommendation records, risk classifications, approval requirements, evidence packages, overrides, rollback records, monitoring metrics, events, and audit trails.</p>
        <section aria-label="Active AI agents"><h3>Active agents</h3>{data.aiGovernance.activeAgents.map((agent: any) => <article key={agent.id}><strong>{agent.name}</strong><p>{agent.status}; model {agent.modelVersionId}; prompt {agent.promptTemplateId}; restricted {agent.restrictedActions.join(', ')}</p></article>)}</section>
        <section aria-label="AI recommendation queue"><h3>Recommendation queue</h3>{data.aiGovernance.recommendationQueue.map((rec: any) => <article key={rec.id}><RiskBadge level={rec.riskLevel} /><strong>{rec.recommendation}</strong><p>Confidence {Math.round(rec.confidence * 100)}%; affected assets {rec.affectedAssets.join(', ')}; approval policy {rec.approvalPolicy}; status {rec.status}</p><p>Evidence {rec.evidence.join(', ')}; lineage {rec.lineage.join(' → ')}</p></article>)}</section>
        <section aria-label="Safety-blocked AI actions"><h3>Safety-blocked actions</h3>{data.aiGovernance.safetyBlockedActions.map((blocked: any) => <article key={blocked.id} role="alert"><strong>{blocked.action}: {blocked.target}</strong><p>{blocked.reason}; approval policy {blocked.approvalPolicy}; confidence {Math.round(blocked.confidence * 100)}%</p><p>Evidence {blocked.evidence.join(', ')}; affected assets {blocked.affectedAssets.join(', ')}</p></article>)}</section>
        <section aria-label="AI evaluation status"><h3>Evaluation status</h3>{data.aiGovernance.evaluationStatus.map((item: any) => <article key={item.modelVersionId}><strong>{item.modelVersionId}: {item.status}</strong><p>Deployable {String(item.readiness.deployable)}; gaps {(item.readiness.gaps ?? []).join(', ') || 'none'}; explainability {item.latestEvaluation?.explainabilityScore}</p></article>)}</section>
        <section aria-label="AI evidence packages"><h3>Evidence packages</h3>{data.aiGovernance.evidencePackages.map((pkg: any) => <article key={pkg.id}><code>{pkg.hash}</code><p>{pkg.recommendationId}; evidence {pkg.evidence.join(', ')}; lineage {pkg.lineage.join(' → ')}</p></article>)}</section>
        <section aria-label="AI approval requirements"><h3>Approval requirements</h3>{data.aiGovernance.approvalRequirements.map((req: any) => <article key={req.id}><ApprovalChip status="pending-approval" /><strong>{req.policy}</strong><p>Roles {req.requiredRoles.join(', ')}; status {req.status}; evidence {req.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="AI overrides and rollback records"><h3>Overrides and rollbacks</h3>{data.aiGovernance.overrides.map((o: any) => <p key={o.id}>Override {o.recommendationId}: {o.reason}; evidence {o.evidence.join(', ')}</p>)}{data.aiGovernance.rollbackRecords.map((r: any) => <p key={r.id}>Rollback {r.recommendationId} to {r.restoredVersionId}: {r.reason}; evidence {r.evidence.join(', ')}</p>)}</section>
        <section aria-label="AI monitoring metrics"><h3>Monitoring metrics</h3>{data.aiGovernance.monitoringMetrics.map((m: any) => <article key={`${m.modelId}-${m.metric}`}><strong>{m.metric}</strong><p>{m.modelId}; value {m.value}; threshold {m.threshold}; evidence {m.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="AI audit trails"><h3>Audit trails</h3>{data.aiGovernance.auditTrails.map((audit: any) => <article key={audit.id}><code>{audit.action}</code><p>{audit.actor}; subject {audit.subject}; evidence {audit.evidence.join(', ')}</p></article>)}</section>
      </section>

      <section aria-label="Command center overview"><StatusCard title="Race readiness" status="On schedule" detail="Paddock, gate, and steward channels are linked." /><KpiTile label="Open approvals" value={String(data.approvals.length)} trend="Needs human review" /><RiskBadge level={serviceState === 'offline' ? 'critical' : 'medium'} /><ApprovalChip status={data.approvals[0]?.status ?? 'pending-approval'} /><EventTimeline events={[{ time: 'T-15', label: 'Gate readiness check', tone: 'advisory' }]} /></section>

      <section aria-label="Compliance Control Library dashboard">
        <h2>Compliance Control Library</h2>
        <p>Framework placeholders, controls, obligations, evidence records, owners, assessments, findings, corrective actions, review cycles, and audit readiness scores are linked to audit records and workflow evidence collection.</p>
        <p>Audit readiness score: {data.complianceLibrary.readiness.score}; evidence coverage {data.complianceLibrary.readiness.evidenceCoverage}%.</p><KpiTile label="Audit readiness score" value={String(data.complianceLibrary.readiness.score)} trend={`${data.complianceLibrary.readiness.evidenceCoverage}% evidence coverage`} />
        <section aria-label="Compliance framework placeholders"><h3>Framework placeholders</h3>{data.complianceLibrary.frameworks.map((framework: any) => <article key={framework.id}><strong>{framework.id}</strong><p>{framework.name}; placeholder: {String(framework.placeholder)}</p></article>)}</section>
        <section aria-label="Compliance controls"><h3>Controls</h3>{data.complianceLibrary.controls.map((control: any) => <article key={control.id}><strong>{control.title}</strong><p>{control.status}; owner {control.ownerId}; frameworks {control.frameworkIds.join(', ')}</p><p>Evidence {control.evidenceIds.join(', ')}; audit records {control.auditRecordIds.join(', ')}; workflows {control.workflowInstanceIds.join(', ')}</p></article>)}</section>
        <section aria-label="Compliance obligations"><h3>Obligations</h3>{data.complianceLibrary.obligations.map((obligation: any) => <p key={obligation.id}>{obligation.frameworkId}: {obligation.citation} — {obligation.summary}</p>)}</section>
        <section aria-label="Control owners and permissions"><h3>Control owners</h3>{data.complianceLibrary.owners.map((owner: any) => <p key={owner.id}>{owner.displayName}: {owner.role}; permissions {owner.permissions.join(', ')}</p>)}</section>
        <section aria-label="Compliance findings and corrective actions"><h3>Findings and corrective actions</h3>{data.complianceLibrary.findings.map((finding: any) => <article key={finding.id}><strong>{finding.severity}: {finding.summary}</strong><p>Status {finding.status}; actions {finding.correctiveActionIds.join(', ')}</p></article>)}{data.complianceLibrary.correctiveActions.map((action: any) => <p key={action.id}>{action.action}; due {action.dueAt}; workflow {action.workflowInstanceId}</p>)}</section>
        <section aria-label="Compliance review cycles"><h3>Review cycles</h3>{data.complianceLibrary.reviewCycles.map((cycle: any) => <p key={cycle.id}>{cycle.frameworkId} {cycle.periodStart}–{cycle.periodEnd}: {cycle.status}; score {cycle.readinessScore}</p>)}</section>
        <section aria-label="Audit readiness score by framework"><h3>Audit readiness by framework</h3>{data.complianceLibrary.readiness.byFramework.map((item: any) => <p key={item.frameworkId}>{item.frameworkId}: {item.score}% across {item.controls} controls</p>)}</section>
      </section>

      <section aria-label="Race Office workspace">
        <h2>Race Office</h2>
        <p>Vertical slice for race meets, race days, cards, conditions, entries, declarations, scratches, post positions, and readiness. Safety-critical changes are approval-gated, audited, event-emitting, and synchronized to Digital Twin state by the backend.</p>
        <section aria-label="Race meets">{data.raceOffice.meets.map((meet: any) => <article key={meet.id}><h3>{meet.name ?? meet.id}</h3><p>{meet.trackId} · {meet.status}</p></article>)}</section>
        <section aria-label="Race days">{data.raceOffice.raceDays.map((day: any) => <article key={day.id}><h3>{day.raceDate}</h3><p>{day.status}; races {(day.raceIds ?? []).join(', ')}</p></article>)}</section>
        <section aria-label="Race cards">{data.raceOffice.cards.map((card: any) => <article key={card.id}><h3>Race {card.raceNumber}</h3><p>Status {card.status}; entries {card.entries}; scratches {card.scratches}; post positions {String(card.postPositionsDrawn)}.</p></article>)}</section>
        <section aria-label="Race office approval gates"><button type="button" disabled aria-label="Request scratch approval">Request scratch approval</button><button type="button" disabled aria-label="Request race cancellation approval">Request cancellation approval</button><button type="button" disabled aria-label="Request official configuration approval">Request official configuration approval</button></section>
      </section>


      <section aria-label="Surface Intelligence workspace">
        <h2>Surface Intelligence</h2>
        <p>Vertical slice for sectors, surface measurements, moisture, compaction, cushion depth, drainage, weather observations, inspections, surface condition scores, recommendations, event audit trails, and Digital Twin updates.</p>
        <p>Operational actions such as irrigation, harrowing, rolling, track closure recommendations, and surface configuration changes are draft-only until an authorized human approval is recorded.</p>
        <div aria-label="Surface status cards">{data.surfaceIntelligence.statusCards.map((card: any) => <StatusCard key={card.label} title={card.label} status={card.value} detail={`${card.detail} Tone: ${card.tone}`} />)}</div>
        <section aria-label="Surface sector table"><h3>Track sectors</h3><table><thead><tr><th>Sector</th><th>Surface</th><th>Score</th><th>Moisture</th><th>Compaction</th><th>Cushion</th><th>Drainage</th></tr></thead><tbody>{data.surfaceIntelligence.sectors.map((sector: any) => <tr key={sector.id}><td>{sector.name}</td><td>{sector.surfaceType}</td><td>{sector.conditionScore}</td><td>{sector.moisture}%</td><td>{sector.compaction}</td><td>{sector.cushionDepth}</td><td>{sector.drainageRate}</td></tr>)}</tbody></table></section>
        <section aria-label="Surface measurement timeline"><h3>Measurement timeline</h3><EventTimeline events={data.surfaceIntelligence.timeline.map((point: any) => ({ time: point.observedAt, label: `${point.kind}: ${point.label} ${point.value}; event ${point.eventId}; audit ${point.auditId}`, tone: point.kind }))} /></section>
        <section aria-label="Surface risk badges"><h3>Risk badges</h3>{data.surfaceIntelligence.riskBadges.map((risk: any) => <article key={risk.sectorId}><RiskBadge level={risk.level === 'moderate' ? 'medium' : risk.level} /><p>{risk.sectorId}: {risk.drivers.join(', ')}</p></article>)}</section>
        <section aria-label="Surface recommendation panel"><h3>Recommendations requiring approval</h3>{data.surfaceIntelligence.recommendations.map((item: any) => <article key={item.id}><strong>{item.recommendation}</strong><p>{item.type}; priority {item.priority}; approval required {String(item.requiresHumanApproval)}; execution {item.executionState}</p><p>Event {item.eventId}; audit {item.auditId}</p></article>)}</section>
        <section aria-label="Mock-safe surface map overlay"><h3>Heatmap-ready overlay</h3><p>{data.surfaceIntelligence.mock ? 'MOCK SAFE MAP OVERLAY - no operational surface state is mutated.' : 'Live read-only overlay; actions still require approval.'}</p>{data.surfaceIntelligence.heatmap.map((cell: any) => <article key={cell.id} data-latitude={cell.latitude} data-longitude={cell.longitude}><strong>{cell.sectorId}</strong><p>Moisture {cell.averageMoisture}; compaction {cell.averageCompaction}; drainage {cell.averageDrainage}; risk index {cell.riskIndex}</p></article>)}</section>
        <section aria-label="Surface Digital Twin sync"><h3>Digital Twin updates</h3>{data.surfaceIntelligence.digitalTwinSync.map((sync: any) => <article key={sync.twinId}><strong>{sync.twinId}</strong><p>{sync.status}; event {sync.eventId}; audit {sync.auditId}</p></article>)}</section>
        <section aria-label="Surface approval gates"><button type="button" disabled aria-label="Request irrigation approval">Request irrigation approval</button><button type="button" disabled aria-label="Request harrowing approval">Request harrowing approval</button><button type="button" disabled aria-label="Request rolling approval">Request rolling approval</button><button type="button" disabled aria-label="Request track closure recommendation approval">Request closure recommendation approval</button><button type="button" disabled aria-label="Request surface configuration change approval">Request surface configuration change approval</button></section>
      </section>

      <section aria-label="Equine Intelligence workspace">
        <h2>Equine Intelligence</h2>
        <p>Vertical slice for horse profiles, ownership, trainer assignment, race history, workout history, veterinary status placeholders, eligibility, welfare, barn assignment, and read-only Digital Twin references.</p>
        <p>AI or system-generated equine risk recommendations are advisory only and require licensed veterinarian review before affecting operations.</p>
        <section aria-label="Horse profile detail"><h3>{data.equineIntelligence.horse.name}</h3><p>{data.equineIntelligence.horse.horseId} · {data.equineIntelligence.horse.lifecycleStatus} · microchip {data.equineIntelligence.horse.microchipId}</p></section>
        <section aria-label="Horse ownership"><h3>Ownership</h3>{data.equineIntelligence.ownership.map((owner: any) => <article key={owner.ownerId}><strong>{owner.ownerName}</strong><p>{owner.percentage}% from {owner.effectiveFrom}</p></article>)}</section>
        <section aria-label="Trainer assignment"><h3>Trainer</h3>{data.equineIntelligence.trainerAssignments.map((trainer: any) => <article key={trainer.trainerId}><strong>{trainer.trainerName}</strong><p>License {trainer.licenseStatus}; effective {trainer.effectiveFrom}</p></article>)}</section>
        <section aria-label="Race history"><h3>Race history</h3>{data.equineIntelligence.raceHistory.map((race: any) => <article key={race.raceId}><strong>{race.raceId}</strong><p>{race.date}; {race.trackId}; {race.status}; finish {race.finishPosition ?? 'n/a'}</p></article>)}</section>
        <section aria-label="Workout history"><h3>Workout history</h3>{data.equineIntelligence.workoutHistory.map((workout: any) => <article key={workout.workoutId}><strong>{workout.distanceFurlongs}f in {workout.timeSeconds}s</strong><p>{workout.date}; {workout.surface}</p></article>)}</section>
        <section aria-label="Veterinary status placeholder"><h3>Veterinary status</h3><p>{data.equineIntelligence.veterinaryStatus.status}: {data.equineIntelligence.veterinaryStatus.summary}; veterinarian required {String(data.equineIntelligence.veterinaryStatus.requiresVeterinarian)}</p></section>
        <section aria-label="Eligibility status"><h3>Eligibility</h3><p>Eligible {String(data.equineIntelligence.eligibilityStatus.eligible)}; compliance {data.equineIntelligence.eligibilityStatus.complianceStatus}; flags {data.equineIntelligence.eligibilityStatus.flags.join(', ')}</p></section>
        <section aria-label="Welfare status"><h3>Welfare</h3><p>{data.equineIntelligence.welfareStatus.level}; score {data.equineIntelligence.welfareStatus.latestScore ?? 'unknown'}; interventions {data.equineIntelligence.welfareStatus.interventions.join(', ') || 'none'}</p></section>
        <section aria-label="Barn assignment"><h3>Barn assignment</h3><p>{data.equineIntelligence.barnAssignment.barnId} stall {data.equineIntelligence.barnAssignment.stallId}; assigned {data.equineIntelligence.barnAssignment.assignedAt}</p></section>
        <section aria-label="Equine Digital Twin references"><h3>Digital Twin references</h3>{data.equineIntelligence.digitalTwinReferences.map((ref: any) => <article key={ref.twinId}><strong>{ref.twinId}</strong><p>{ref.twinType}; {ref.relationship}; source {ref.sourceSystem}; read-only {String(ref.readOnly)}</p></article>)}</section>
        <section aria-label="Equine advisory AI recommendations"><h3>Advisory AI risk recommendations</h3>{data.equineIntelligence.aiRiskRecommendations.map((rec: any) => <article key={rec.id}><strong>{rec.summary}</strong><p>Advisory only {String(rec.advisoryOnly)}; veterinarian review required {String(rec.veterinarianReviewRequired)}; status {rec.status}</p></article>)}</section>
        <section aria-label="Equine approvals"><h3>Approvals</h3>{data.equineIntelligence.approvals.map((approval: any) => <article key={approval.id}><strong>{approval.action}</strong><p>{approval.status}; required role {approval.requiredRole}</p></article>)}</section>
        <section aria-label="Equine audit records"><h3>Audit records</h3>{data.equineIntelligence.audit.map((audit: any) => <article key={audit.id}><code>{audit.id}</code><p>{audit.actor}; {audit.action}; {audit.timestamp}</p></article>)}</section>
        <section aria-label="Equine event stream"><h3>Events</h3>{data.equineIntelligence.events.map((event: any) => <article key={event.eventId}><strong>{event.type}</strong><p>audit {event.auditId}</p></article>)}</section>
        <section aria-label="Equine approval gates"><button type="button" disabled aria-label="Request veterinarian AI risk review">Request veterinarian review</button><button type="button" disabled aria-label="Request eligibility change approval">Request eligibility change approval</button><button type="button" disabled aria-label="Request barn transfer approval">Request barn transfer approval</button></section>
      </section>

      <section aria-label="Steward Center workspace">
        <h2>Steward Center</h2>
        <p>Vertical slice for inquiry queue, case detail, evidence timeline, rule references, decision drafts, approval controls, final rulings, appeal packages, and immutable audit records.</p>
        <p>AI may summarize evidence and draft recommendations, but official rulings and official result changes remain locked to authorized human stewards; this workspace never modifies official results.</p>
        <section aria-label="Steward inquiry queue"><h3>Inquiry queue</h3>{data.stewardCenter.inquiries.map((inq: any) => <article key={inq.id}><strong>{inq.raceId}: {inq.status}</strong><p>Opened {inq.openedAt}; objections {inq.objections.length}; incidents {inq.incidentsUnderReview.length}</p></article>)}</section>
        {data.stewardCenter.inquiries.map((inq: any) => <section key={`${inq.id}-detail`} aria-label="Steward case detail"><h3>Case detail {inq.id}</h3><p>Horses: {inq.involvedHorses.map((h: any) => `${h.programNumber} ${h.name} locked=${h.officialResultLocked}`).join('; ')}</p><p>Jockeys: {inq.involvedJockeys.map((j: any) => `${j.name} (${j.licenseId})`).join('; ')}</p><p>Objections: {inq.objections.map((o: any) => `${o.allegation} [${o.status}]`).join('; ')}</p></section>)}
        <section aria-label="Steward evidence timeline"><h3>Evidence timeline</h3>{data.stewardCenter.inquiries.flatMap((inq: any) => inq.evidenceReferences).map((ev: any) => <article key={ev.id}><strong>{ev.kind}: {ev.description}</strong><p>{ev.capturedAt}; {ev.uri}; hash {ev.hash}; AI generated {String(Boolean(ev.aiGenerated))}</p></article>)}</section>
        <section aria-label="Steward rule reference panel"><h3>Rule reference panel</h3>{data.stewardCenter.inquiries.flatMap((inq: any) => inq.ruleReferences).map((rule: any) => <article key={rule.id}><strong>{rule.jurisdiction} {rule.rulebook} §{rule.section}</strong><p>{rule.citation}: {rule.summary}</p></article>)}</section>
        <section aria-label="Steward decision draft workflow"><h3>Decision draft workflow</h3>{data.stewardCenter.inquiries.flatMap((inq: any) => inq.decisionDrafts).map((draft: any) => <article key={draft.id}><strong>{draft.recommendation}</strong><p>Author {draft.authorRole}; AI {String(draft.aiGenerated)}; official ruling {String(draft.officialRuling)}</p><p>{draft.rationale}</p></article>)}</section>
        <section aria-label="Steward approval and finalization controls"><h3>Approval and finalization controls</h3><button type="button" disabled={!data.stewardCenter.permissions.canDraft} aria-label="Save steward decision draft">Save draft</button><button type="button" disabled aria-label="Issue human-only final ruling">Issue final ruling (human steward only)</button><button type="button" disabled={!data.stewardCenter.permissions.canExportAppeal} aria-label="Export steward appeal package">Export appeal package</button><p>Finalization is disabled in mock/read-only UI until live backend verifies steward role, audit completeness, and no official-result mutation.</p></section>
        <section aria-label="Steward audit records"><h3>Audit records</h3>{data.stewardCenter.inquiries.flatMap((inq: any) => inq.auditRecords).map((audit: any) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.actorId}; {audit.action}; subject {audit.subjectId}; previous {audit.previousHash}</p></article>)}</section>
      </section>

      <section aria-label="Security Operations workspace">
        <h2>Security Operations</h2>
        <p>End-to-end security command surface for access-control events, restricted zones, camera assets, incidents, investigations, watchlist placeholders, visitor logs, credential checks, and escalation workflows.</p>
        <section aria-label="Security dashboard widgets"><h3>Dashboard widgets</h3><KpiTile label="Active alerts" value={String(data.securityOperations.dashboard.activeAlerts)} trend="security" /><KpiTile label="Restricted-zone events" value={String(data.securityOperations.dashboard.restrictedZoneEvents)} trend="security" /><KpiTile label="Camera health" value={`Online ${data.securityOperations.dashboard.cameraHealth.online} / degraded ${data.securityOperations.dashboard.cameraHealth.degraded} / offline ${data.securityOperations.dashboard.cameraHealth.offline}`} trend="security" /><KpiTile label="Investigation queue" value={String(data.securityOperations.dashboard.investigationQueue)} trend="security" /></section>
        <section aria-label="Restricted zones"><h3>Restricted zones</h3>{data.securityOperations.restrictedZones.map((zone: any) => <article key={zone.id}><strong>{zone.name}</strong><p>{zone.classification}; credential {zone.requiredCredential}; cameras {zone.cameraIds.join(', ')}</p></article>)}</section>
        <section aria-label="Access-control events"><h3>Access-control events</h3>{data.securityOperations.accessEvents.map((event: any) => <article key={event.id}><strong>{event.personDisplayName}: {event.decision}</strong><p>{event.zoneId}; credential {event.credentialId}; reason {event.reason}; event {event.eventId}; audit {event.auditId}</p></article>)}</section>
        <section aria-label="Camera assets"><h3>Camera assets</h3>{data.securityOperations.cameras.map((camera: any) => <article key={camera.id}><AssetHealthIndicator label={camera.label} status={camera.health === 'online' ? 'healthy' : camera.health === 'degraded' ? 'degraded' : 'offline'} /><strong>{camera.label}</strong><p>{camera.zoneId}; privacy masking {String(camera.privacyMasking)}; last heartbeat {camera.lastHeartbeatAt}</p></article>)}</section>
        <section aria-label="Security incidents"><h3>Security incidents</h3>{data.securityOperations.incidents.map((incident: any) => <article key={incident.id}><RiskBadge level={incident.severity} /><strong>{incident.title}</strong><p>{incident.status}; zone {incident.zoneId}; events {incident.eventIds.join(', ')}; audit {incident.auditId}</p></article>)}</section>
        <section aria-label="Incident timeline widget"><h3>Incident timeline</h3><EventTimeline events={data.securityOperations.dashboard.incidentTimeline.map((entry: any) => ({ time: entry.at, label: entry.label, tone: entry.severity }))} /></section>
        <section aria-label="Investigation queue widget"><h3>Investigation queue</h3>{data.securityOperations.investigations.map((item: any) => <article key={item.id}><strong>{item.incidentId}: {item.status}</strong><p>Lead {item.lead}; evidence {item.evidence.join(', ')}; audit {item.auditId}</p></article>)}</section>
        <section aria-label="Watchlist placeholders"><h3>Watchlist placeholders</h3>{data.securityOperations.watchlistPlaceholders.map((item: any) => <article key={item.id}><strong>{item.displayLabel}</strong><p>{item.category}; notes {item.sensitiveNotes}; human review required {String(item.requiresHumanReview)}</p></article>)}</section>
        <section aria-label="Visitor logs"><h3>Visitor logs</h3>{data.securityOperations.visitorLogs.map((visitor: any) => <article key={visitor.id}><strong>{visitor.visitorDisplayName}</strong><p>Host {visitor.host}; zone {visitor.zoneId}; credential check {visitor.credentialCheckId}; audit {visitor.auditId}</p></article>)}</section>
        <section aria-label="Credential checks"><h3>Credential checks</h3>{data.securityOperations.credentialChecks.map((check: any) => <article key={check.id}><strong>{check.holderDisplayName}: {check.status}</strong><p>Decision {check.decision}; credential {check.credentialId}; audit {check.auditId}</p></article>)}</section>
        <section aria-label="Escalation workflows"><h3>Escalation workflows</h3>{data.securityOperations.escalations.map((flow: any) => <article key={flow.id}><strong>{flow.status}: {flow.reason}</strong><p>Route {flow.routeTo.join(' → ')}; audit {flow.auditId}</p></article>)}</section>
        <section aria-label="Security audit records"><h3>Audit records</h3>{data.securityOperations.auditRecords.map((audit: any) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.action}; actor {audit.actorId}; subject {audit.subjectId}; previous {audit.previousHash}; sensitive fields {audit.sensitiveFields.join(', ') || 'none'}</p></article>)}</section>
        <section aria-label="Security approval gates"><button type="button" disabled aria-label="Escalate security incident">Escalate security incident</button><button type="button" disabled aria-label="Open security investigation">Open investigation</button><button type="button" disabled aria-label="Reveal sensitive security fields">Reveal sensitive fields requires permission</button></section>
      </section>

      <section aria-label="Emergency Operations command view">
        <h2>Emergency Operations</h2>
        <p>Active emergency status: <strong>{data.emergencyOperations.activeEmergencyStatus}</strong></p>
        <p>Emergency guardrail: {data.emergencyOperations.emergencyActions.reason} AI may block actions: {String(data.emergencyOperations.emergencyActions.aiMayBlock)}.</p>
        <section aria-label="Emergency plans"><h3>Emergency plans</h3>{data.emergencyOperations.plans.map((plan: any) => <article key={plan.id}><strong>{plan.name}</strong><p>Scenarios {plan.scenarios.join(', ')}; criteria {plan.activationCriteria.join(', ')}; drill cadence {plan.drillCadenceDays} days.</p></article>)}</section>
        <section aria-label="Incident command roles"><h3>Incident command roles</h3>{data.emergencyOperations.commandRoles.map((role: any) => <article key={role.id}><strong>{role.role}: {role.assignee}</strong><p>Permissions {role.permissions.join(', ')}</p></article>)}</section>
        <section aria-label="Emergency resource map"><h3>Resource map</h3>{data.emergencyOperations.resourceMap.map((resource: any) => <article key={resource.id} data-status={resource.status}><strong>{resource.label}</strong><p>{resource.kind}; {resource.zoneId}; {resource.coordinates.latitude}, {resource.coordinates.longitude}</p></article>)}</section>
        <section aria-label="Medical fire and severe weather response"><h3>Response plans</h3><article><strong>Medical</strong><p>{data.emergencyOperations.medicalResponse.lead}: {data.emergencyOperations.medicalResponse.checklist.join(' → ')}; AI blocks {String(data.emergencyOperations.medicalResponse.aiMayBlock)}</p></article><article><strong>Fire</strong><p>{data.emergencyOperations.fireResponse.lead}: {data.emergencyOperations.fireResponse.checklist.join(' → ')}; AI blocks {String(data.emergencyOperations.fireResponse.aiMayBlock)}</p></article><article><strong>Severe weather</strong><p>{data.emergencyOperations.severeWeatherResponse.lead}: {data.emergencyOperations.severeWeatherResponse.checklist.join(' → ')}; AI blocks {String(data.emergencyOperations.severeWeatherResponse.aiMayBlock)}</p></article></section>
        <section aria-label="Evacuation zones"><h3>Evacuation zones</h3>{data.emergencyOperations.evacuationZones.map((zone: any) => <article key={zone.id}><strong>{zone.name}: {zone.status}</strong><p>Route {zone.route.join(' → ')}; assembly {zone.assemblyArea}; capacity {zone.capacity}</p></article>)}</section>
        <section aria-label="Checklist progress"><h3>Checklist progress</h3><p>{data.emergencyOperations.checklist.filter((item: any) => item.completed).length} of {data.emergencyOperations.checklist.length} complete.</p>{data.emergencyOperations.checklist.map((item: any) => <label key={item.id}><input type="checkbox" checked={item.completed} readOnly /> {item.label} — human override {String(item.humanOverrideAvailable)}; AI blocking {String(item.aiBlockingAllowed)}</label>)}</section>
        <section aria-label="Communication log"><h3>Communication log</h3>{data.emergencyOperations.communicationLog.map((item: any) => <article key={item.id}><strong>{item.channel} to {item.audience}</strong><p>{item.message}; completed {String(item.completed)} {item.completedBy ? `by ${item.completedBy}` : ''}</p></article>)}</section>
        <section aria-label="Drills and after-action reports"><h3>Drills and after-action reports</h3>{data.emergencyOperations.drills.map((drill: any) => <article key={drill.id}><strong>{drill.scenario}</strong><p>Participants {drill.participants.join(', ')}; criteria {drill.successCriteria.join(', ')}</p></article>)}{data.emergencyOperations.afterActionReports.map((report: any) => <article key={report.incidentId}><strong>After-action {report.incidentId}</strong><p>Findings {report.findings.map((finding: any) => `${finding.finding} (${finding.owner})`).join('; ')}</p><p>Corrective actions {report.correctiveActions.map((action: any) => `${action.action} due ${action.dueDays}d`).join('; ')}</p></article>)}</section>
        <section aria-label="Emergency event stream"><h3>Events</h3><EventTimeline events={data.emergencyOperations.events.map((event: any) => ({ time: event.timestamp, label: `${event.type}: ${event.subjectId}; audit ${event.auditId}`, tone: event.severity }))} /></section>
        <section aria-label="Emergency audit timeline"><h3>Audit timeline</h3>{data.emergencyOperations.auditTimeline.map((audit: any) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.action}; actor {audit.actor}; subject {audit.subjectId}; human override {String(audit.humanOverride)}; AI blocked {String(audit.aiBlocked)}; previous {audit.previousHash}</p></article>)}</section>
      </section>

      <section aria-label="Race-day readiness dashboard">
        <h2>Race-day Readiness</h2>
        <p>Continuous readiness score: <strong>{data.readiness.averageScore}</strong>; ready {data.readiness.ready}, watch {data.readiness.watch}, blocked {data.readiness.blocked}.</p>
        <div aria-label="Race readiness scorecards">{data.readiness.races.map((race) => <article key={race.raceId} data-status={race.status}><h3>{race.raceId}</h3><RiskBadge level={race.status === 'ready' ? 'low' : race.status === 'watch' ? 'high' : 'critical'} /><p>{race.trackId} post time {race.postTime}; score {race.score}; warnings {race.warnings}; approvals {race.approvals}.</p></article>)}</div>
        <section aria-label="Readiness domain scores"><h3>Domain scores</h3>{data.readiness.domainScores.map((domain) => <article key={domain.domain}><strong>{domain.domain}</strong><meter min={0} max={100} value={domain.averageScore}>{domain.averageScore}</meter><p>Average {domain.averageScore}; watch {domain.watch}; blocked {domain.blocked}.</p></article>)}</section>
        <section aria-label="Operational readiness warnings"><h3>Operational warnings</h3>{data.readiness.warnings.map((warning) => <article key={warning.id} role={warning.severity === 'critical' ? 'alert' : 'status'}><strong>{warning.domain}: {warning.message}</strong><p>Action: {warning.recommendedAction}</p><p>Evidence: {warning.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Readiness approval requirements"><h3>Approval requirements</h3>{data.readiness.approvals.map((approval) => <article key={approval.id}><ApprovalChip status={approval.status === 'satisfied' ? 'approved' : 'pending-approval'} /><strong>{approval.action}</strong><p>{approval.reason}; roles: {approval.requiredRoles.join(', ')}</p><p>Evidence: {approval.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Readiness events"><h3>Readiness events</h3><EventTimeline events={data.readiness.events.map((event) => ({ time: event.timestamp, label: `${event.type}: ${event.message}`, tone: event.severity }))} /></section>
        <section aria-label="Readiness audit records"><h3>Audit records</h3>{data.readiness.auditRecords.map((record) => <article key={record.id}><code>{record.summaryHash}</code><p>{record.actor} scored {record.score} for {record.raceId}; previous hash {record.previousHash}; evidence {record.evidence.join(', ')}.</p></article>)}</section>
      </section>


      <section aria-label="Barn Operations workspace">
        <h2>Barn Operations</h2>
        <p>Coordinated frontend-backend module for barns, stalls, occupancy, trainer assignments, veterinary visits, access control, inspections, restrictions, incidents, audited movement events, and Digital Twin updates.</p>
        <section aria-label="Barn map and list">
          <h3>Barn map/list</h3>
          {data.barnOperations.barns.map((barn) => <article key={barn.id} data-status={barn.status}><h4>{barn.name}</h4><p>{barn.location}; capacity {barn.capacity}; trainers {barn.trainerIds.join(', ')}; linked incidents {barn.incidentIds.join(', ')}.</p></article>)}
        </section>
        <section aria-label="Stall occupancy grid">
          <h3>Stall occupancy</h3>
          {data.barnOperations.stalls.map((stall) => <article key={stall.id} data-status={stall.status}><strong>{stall.label}</strong><p>{stall.status}{stall.occupancyHorseId ? ` — ${stall.occupancyHorseId}` : ''}; restrictions {stall.restrictionIds.join(', ') || 'none'}.</p></article>)}
        </section>
        <section aria-label="Horse movement timeline">
          <h3>Horse movement timeline</h3>
          <EventTimeline events={data.barnOperations.movements.map((movement) => ({ time: movement.movedAt, label: `${movement.horseId}: ${movement.fromStallId ?? 'arrival'} → ${movement.toStallId}; event ${movement.eventId}; audit ${movement.auditId}`, tone: 'info' }))} />
          {data.barnOperations.movements.map((movement) => <p key={`${movement.id}-evidence`}>Movement evidence: {movement.eventId} / {movement.auditId}</p>)}
        </section>
        <section aria-label="Barn access history">
          <h3>Access history</h3>
          {data.barnOperations.access.map((record) => <article key={record.id}><strong>{record.actorId}</strong><p>{record.decision} for {record.purpose} at {record.accessAt}; event {record.eventId}; audit {record.auditId}.</p></article>)}
        </section>
        <section aria-label="Barn readiness dashboard">
          <h3>Barn readiness</h3>
          {data.barnOperations.readiness.map((ready) => <article key={ready.barnId} data-status={ready.status}><RiskBadge level={ready.status === 'ready' ? 'low' : ready.status === 'watch' ? 'high' : 'critical'} /><strong>{ready.barnId}: {ready.score}</strong><p>{ready.occupiedStalls}/{ready.capacity} stalls occupied; restrictions {ready.openRestrictions}; blockers {ready.blockers.join(', ') || 'none'}.</p></article>)}
        </section>
        <section aria-label="Barn inspections restrictions trainer assignments veterinary visits">
          <h3>Inspections, restrictions, trainers, veterinary visits</h3>
          <p>Inspections: {data.barnOperations.inspections.map((i) => `${i.barnId} score ${i.score}`).join('; ')}.</p>
          <p>Restrictions: {data.barnOperations.restrictions.map((r) => `${r.type} ${r.reason} (${r.eventId}/${r.auditId})`).join('; ')}.</p>
          <p>Trainer assignments: {data.barnOperations.trainers.map((t) => `${t.trainerId} active=${t.active}`).join('; ')}.</p>
          <p>Veterinary visits: {data.barnOperations.vetVisits.map((v) => `${v.horseId} by ${v.veterinarianId}`).join('; ')}.</p>
        </section>
      </section>
      <section aria-label="Digital Twin workspace shell">
        <h2>Digital Twin Workspace</h2>
        <p>Shared typed client source: <code>{data.mode}</code>; Digital Twin updates are read-only until an approved backend execution path emits the patch event.</p>
        {data.digitalTwinState.map((state) => <article key={state.twinId}><h3>{state.twinId}</h3><p>{state.assetId} · {state.health} · version {state.version} · {state.mock ? 'MOCK DATA' : 'LIVE DATA'}</p></article>)}
      </section>
      <section aria-label="Starting Gate Control workspace">
        <h2>Starting Gate Control Workspace</h2>
        <p>Current gate: {data.gatePosition.gateId} in {data.gatePosition.sectorId} at {data.gatePosition.metersFromStart}m; GPS verified: {String(data.gatePosition.gpsVerified)}; {data.gatePosition.mock ? 'MOCK DATA - no live motion command is available.' : 'LIVE DATA'}.</p>
        <p>Race distance configuration: {data.raceDistanceConfiguration.raceId} is {data.raceDistanceConfiguration.distanceMeters}m from {data.raceDistanceConfiguration.gateSectorId}; {data.raceDistanceConfiguration.mock ? 'MOCK DATA' : 'LIVE DATA'}.</p>
        <button type="button" disabled aria-label="Draft starting gate move request">Draft move request requires approval</button>
        <button type="button" disabled aria-label="Draft race distance configuration request">Draft distance change requires approval</button>
        <p>State-changing controls are disabled in the shell; submit a draft request through the shared API client, then execute only after the live backend returns an approval token.</p>
      </section>
      <TrackMapPanel map={data.trackMap} />
      <TrackMap map={data.trackMap} />
      <ApprovalsPanel approvals={data.approvals} />
      <section aria-label="Audit event rows">{data.auditEvents.map((event) => <AuditEventRow key={event.id} event={event} />)}</section>
      <section aria-label="Asset and twin foundations">{data.trackMap.assets.map((asset) => <AssetHealthIndicator key={asset.id} label={asset.label} status={asset.status} />)}<DigitalTwinRelationshipCard source="Gate Twin" relationship="controls" target="Starting Gate" /></section>
      <AuditReviewPanel events={data.auditEvents} />
      <section aria-label="Domain screens">
        {domainScreens.filter((screen) => visibleIds.has(screen.id)).map((screen) => (
          <article key={screen.id}>
            <h2>{screen.title}</h2>
            <p>Route <code>{screen.route}</code> is owned by {screen.owner}; shell owns authentication, layout, and top-level routing.</p>
            <p>{screen.liveApi ? <>Live API target: <code>{screen.liveApi}</code>.</> : 'No state-changing API target is configured for this read-only module.'}</p>
            {data.mode === 'mock' && screen.mockReason && <p><strong>Mock/read-only:</strong> {screen.mockReason}.</p>}
            <p>Event-stream ready topics: {screen.eventStreams.join(', ')}.</p>
            <p>State changes: {screen.stateChangingActions.length ? screen.stateChangingActions.join(', ') : 'none; review-only screen'}; never direct local mutation.</p>
          </article>
        ))}
      </section>
      <section aria-label="Nexus operational workspace blueprint">
        <h2>Command-center workspace blueprint</h2>
        <p>TrackMind Nexus is modeled as a hybrid Airport Operations Center, Emergency Command Center, Digital Twin Platform, Smart City Control Room, and Enterprise Operations Dashboard.</p>
        <div aria-label="Ten-screen operational experience">{commandCenterWorkspaces.map((workspace) => <article key={workspace.title} aria-label={`${workspace.title} blueprint`}><h3>{workspace.title}</h3><p>{workspace.purpose}</p><ul>{workspace.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
      </section>
      <section aria-label="Safety critical controls">
        <h2>Starting Gate Control</h2>
        <ol aria-label="Starting gate approval workflow">{startingGateWorkflow.map((step) => <li key={step}>{step}</li>)}</ol>
        <SafetyCriticalActionButton approvalsSatisfied={canExecute} backendLive={data.mode === 'live'} authenticated={authenticated}>Release starting gate</SafetyCriticalActionButton>
        <p>Disabled until authenticated live backend returns a valid approval token.</p>
      </section>
    </main>
  );
}

export function App() {
  const client = createNexusClient(false);
  void client;
  return (
    <main>
      <h1>TrackMind Nexus</h1>
      <p>The Unified Operations Command Center is a desktop-first hybrid of airport operations, emergency command, digital twin, smart city control room, and enterprise operations experiences.</p>
    </main>
  );
}
