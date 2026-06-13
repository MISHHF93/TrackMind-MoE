import type { Role } from '@trackmind/shared';
import { createNexusClient, type NexusApiClient } from './api/client.js';
import { DataState } from './components/states.js';
import { ApprovalChip, AssetHealthIndicator, AuditEventRow, DigitalTwinRelationshipCard, EventTimeline, KpiTile, RiskBadge, SafetyCriticalActionButton, StatusCard, TrackMapPanel } from './components/nexus-ui.js';
import { ApprovalsPanel } from './domains/approvals/ApprovalsPanel.js';
import { AuditReviewPanel } from './domains/audit/AuditReviewPanel.js';
import { TrackMap } from './domains/track-map/TrackMap.js';
import { domainScreens } from './shell/domains.js';
import { breadcrumbForPath, filterCommandPalette, selectTenant, serviceBanner, tenants, type ServiceState, type UserProfile } from './shell/experience.js';
import { visibleNavItems } from './shell/navigation.js';

export async function loadCommandCenter(client: NexusApiClient) {
  const [approvals, auditEvents, trackMap, operations] = await Promise.all([
    client.listApprovals(),
    client.listAuditEvents(),
    client.getTrackMap(),
    client.getOperationsCommandCenter(),
  ]);
  return { approvals, auditEvents, trackMap, operations, streamUrl: client.eventStreamUrl(), mode: client.mode };
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
  const visibleIds = new Set(nav.map((item) => item.id));
  const tenant = selectTenant(tenantId);
  const banner = serviceBanner(serviceState, data.mode === 'mock');
  const breadcrumbs = breadcrumbForPath(path);
  const paletteItems = filterCommandPalette(paletteQuery, roles);
  const canExecute = isSafetyCriticalEnabled({ authenticated, hasApprovalToken: false, backendMode: data.mode });

  if (!authenticated) return <main aria-label="Login ready route"><h1>TrackMind Nexus</h1><p>Please sign in to continue to the racetrack command center.</p></main>;

  return (
    <main className="nexus-shell">
      <aside aria-label="Persistent sidebar"><nav aria-label="Primary navigation">{nav.map((item) => <a key={item.id} href={item.path}>{item.label}</a>)}</nav></aside>
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
      <section aria-label="Safety critical controls">
        <h2>Starting Gate Control</h2>
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
      <p>The Unified Operations Command Center is the primary landing experience for race-day readiness, incident response, operational alerts, live streams, and role-specific saved layouts.</p>
    </main>
  );
}
