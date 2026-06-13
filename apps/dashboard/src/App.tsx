import type { Role } from '@trackmind/shared';
import { createNexusClient, type NexusApiClient } from './api/client.js';
import { SafetyButton } from './components/states.js';
import { ApprovalsPanel } from './domains/approvals/ApprovalsPanel.js';
import { AuditReviewPanel } from './domains/audit/AuditReviewPanel.js';
import { TrackMap } from './domains/track-map/TrackMap.js';
import { domainScreens } from './shell/domains.js';
import { visibleNavItems } from './shell/navigation.js';

export async function loadCommandCenter(client: NexusApiClient) {
  const [approvals, auditEvents, trackMap] = await Promise.all([
    client.listApprovals(),
    client.listAuditEvents(),
    client.getTrackMap(),
  ]);
  return { approvals, auditEvents, trackMap, streamUrl: client.eventStreamUrl(), mode: client.mode };
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

export function CommandCenter({ data, roles, authenticated = true }: { data: Awaited<ReturnType<typeof loadCommandCenter>>; roles: Role[]; authenticated?: boolean }) {
  const nav = visibleNavItems(roles);
  const visibleIds = new Set(nav.map((item) => item.id));
  const canExecute = isSafetyCriticalEnabled({ authenticated, hasApprovalToken: false, backendMode: data.mode });

  return (
    <main>
      <header>
        <h1>TrackMind Nexus</h1>
        <p>Enterprise command-center shell with authentication-aware, role-filtered navigation.</p>
        <p>Event stream ready: <code>{data.streamUrl}</code></p>
        <p>Deployment assumption: internet-facing frontend should sit behind Azure Front Door with HTTPS, managed TLS certificates, WAF, CDN/global routing, and centralized access/security logs.</p>
      </header>
      <nav aria-label="Primary navigation">{nav.map((item) => <a key={item.id} href={item.path}>{item.label}</a>)}</nav>
      {data.mode === 'mock' && <aside role="note">Mock adapter active: panels are placeholders until matching backend APIs are available.</aside>}
      <TrackMap map={data.trackMap} />
      <ApprovalsPanel approvals={data.approvals} />
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
        <SafetyButton disabled={!canExecute}>Release starting gate</SafetyButton>
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
      <p>Use <code>loadCommandCenter</code> with a Nexus API client to render the modular command center.</p>
    </main>
  );
}
