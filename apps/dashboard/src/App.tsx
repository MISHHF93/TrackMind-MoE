import type { Role } from '@trackmind/shared';
import { createNexusClient, type NexusApiClient } from './api/client.js';
import { SafetyButton } from './components/states.js';
import { ApprovalsPanel } from './domains/approvals/ApprovalsPanel.js';
import { AuditReviewPanel } from './domains/audit/AuditReviewPanel.js';
import { TrackMap } from './domains/track-map/TrackMap.js';
import { visibleNavItems } from './shell/navigation.js';

const screens = [
  'Operations Command',
  'Race Office',
  'Asset Registry',
  'Digital Twin View',
  'Starting Gate Control',
  'Surface Intelligence',
  'Equine Intelligence',
  'Steward Center',
  'Approvals',
  'Audit Ledger',
  'Security',
  'Emergency Ops',
  'Compliance',
  'AI Governance',
  'Executive Center',
];

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
        {screens.map((name) => (
          <article key={name}>
            <h2>{name}</h2>
            <p>Placeholder-safe module: connects to live API when present, otherwise displays clearly marked mock/read-only data. State-changing controls route through approval, event, and audit aware backend paths.</p>
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
