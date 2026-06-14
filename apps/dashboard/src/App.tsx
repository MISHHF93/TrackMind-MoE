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
  const [approvals, auditEvents, trackMap, operations, readiness, gatePosition, raceDistanceConfiguration, digitalTwinState] = await Promise.all([
    client.listApprovals(),
    client.listAuditEvents(),
    client.getTrackMap(),
    client.getOperationsCommandCenter(),
    client.getRaceDayReadinessDashboard(),
    client.getGatePosition(),
    client.getRaceDistanceConfiguration(),
    client.listDigitalTwinState(),
  ]);
  return { approvals, auditEvents, trackMap, operations, readiness, gatePosition, raceDistanceConfiguration, digitalTwinState, streamUrl: client.eventStreamUrl(), mode: client.mode };
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
      <section aria-label="Command center overview"><StatusCard title="Race readiness" status="On schedule" detail="Paddock, gate, and steward channels are linked." /><KpiTile label="Open approvals" value={String(data.approvals.length)} trend="Needs human review" /><RiskBadge level={serviceState === 'offline' ? 'critical' : 'medium'} /><ApprovalChip status={data.approvals[0]?.status ?? 'pending-approval'} /><EventTimeline events={[{ time: 'T-15', label: 'Gate readiness check', tone: 'advisory' }]} /></section>

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
