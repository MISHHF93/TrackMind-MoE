import type { ReactElement, ReactNode } from 'react';
import { ChartRail, OpsButton } from './charts';
import type { TenantRacetrackContext } from '@trackmind/shared';
import type {
  ConsoleAction,
  ConsoleAdvisory,
  ConsoleMetric,
  ConsolePayload,
  ConsoleQueue,
  LifecycleLane,
  LiveSignal,
  OpsPosture,
} from './opsTypes';
import { RenderErrorBoundary as UiRenderErrorBoundary } from '../components/ui';

export { RenderErrorBoundary } from '../components/ui';

export function postureClass(posture: OpsPosture): string {
  return `posture-badge posture-badge--${posture}`;
}

export function EvidenceTag({ label, posture = 'advisory' }: { label: string; posture?: OpsPosture }): ReactElement {
  return <span className={`evidence-tag ${postureClass(posture)}`}>{label}</span>;
}

export function PostureBadge({ label, posture }: { label: string; posture: OpsPosture }): ReactElement {
  return <span className={postureClass(posture)}>{label}</span>;
}

export function OperatorSessionChips({ session, roleLabel }: { session: TenantRacetrackContext; roleLabel: string }): ReactElement {
  return (
    <div className="operator-session-chips" aria-label="Operator session scope">
      <div className="scope-chip" aria-label="Tenant scope">
        <span>Tenant</span>
        <strong>{session.tenantId}</strong>
      </div>
      <div className="scope-chip" aria-label="Racetrack scope">
        <span>Racetrack</span>
        <strong>{session.racetrackId}</strong>
      </div>
      <div className="scope-chip" aria-label="Organization scope">
        <span>Organization</span>
        <strong>{session.organizationId}</strong>
      </div>
      <div className="scope-chip" aria-label="Operator role">
        <span>Role</span>
        <strong>{roleLabel}</strong>
      </div>
      <span className="scope-disclaimer">Operator session; backend authorization is authoritative.</span>
    </div>
  );
}

export function SidebarNavGroups({
  groups,
  activeRouteId,
  onNavigate,
  emptyMessage,
}: {
  groups: Array<{ group: string; routes: Array<{ id: string; path: string; label: string; iconKey: string; supportLabel: string }> }>;
  activeRouteId?: string;
  onNavigate: (path: string) => void;
  emptyMessage?: string;
}): ReactElement {
  const routeIconLabels: Record<string, string> = {
    'command-center': 'CC',
    'race-day': 'RD',
    horse: 'EQ',
    approval: 'AP',
    incident: 'IN',
    compliance: 'CO',
    security: 'SE',
    facility: 'FA',
    ticket: 'TI',
    finance: 'FI',
    federation: 'FE',
    'data-hub': 'DH',
    audit: 'AU',
    admin: 'AD',
    settings: 'ST',
  };

  return (
    <aside className="sidebar" aria-label="TrackMind navigation">
      <div className="brand">
        <span className="brand-mark">TM</span>
        <div>
          <strong>TrackMind Nexus</strong>
          <small>Racetrack Operations OS</small>
        </div>
      </div>
      <nav aria-label="TrackMind console routes">
        {emptyMessage && groups.length === 0 ? <p className="nav-empty">{emptyMessage}</p> : null}
        {groups.map(({ group, routes: groupRoutes }) => (
          <section className="nav-group" key={group} aria-label={`${group} routes`}>
            <h2>{group}</h2>
            {groupRoutes.map((route) => {
              const isActive = route.id === activeRouteId;
              return (
                <button
                  className={`route-button${isActive ? ' route-button--active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  key={route.path}
                  type="button"
                  onClick={() => onNavigate(route.path)}
                >
                  <span className="route-icon" aria-hidden="true">
                    {routeIconLabels[route.iconKey] ?? route.label.slice(0, 2).toUpperCase()}
                  </span>
                  <span>{route.label}</span>
                  <small>{route.supportLabel}</small>
                </button>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}

export function CommandBar({
  posture,
  postureLabel,
  session,
  roleLabel,
  searchQuery,
  onSearchChange,
  shortcuts,
  onNavigate,
  themeToggle,
}: {
  posture: OpsPosture;
  postureLabel: string;
  session: TenantRacetrackContext;
  roleLabel: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  shortcuts: Array<{ id: string; label: string; path: string }>;
  onNavigate: (path: string) => void;
  themeToggle: ReactNode;
}): ReactElement {
  return (
    <header className="topbar command-bar" aria-label="TrackMind command bar">
      <div className="command-bar__posture">
        <PostureBadge label={postureLabel} posture={posture} />
        <OperatorSessionChips session={session} roleLabel={roleLabel} />
      </div>
      <label className="global-search">
        Search consoles
        <input
          type="search"
          placeholder="Search consoles and operating areas"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      </label>
      <div className="topbar-actions command-strip" aria-label="Global console shortcuts">
        {shortcuts.map((route) => (
          <OpsButton
            key={route.id}
            action={{ label: route.label, path: route.path, detail: `Open ${route.label} console.` }}
            onNavigate={onNavigate}
          />
        ))}
        {themeToggle}
      </div>
    </header>
  );
}

export function ActionDock({
  title,
  description,
  actions,
  protectedActions,
  onNavigate,
}: {
  title: string;
  description: string;
  actions: ConsoleAction[];
  protectedActions: readonly string[];
  onNavigate: (path: string) => void;
}): ReactElement {
  return (
    <aside className="action-dock intelligence-panel" aria-label="Operator action dock">
      <section className="action-dock__panel">
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="action-dock__badges">
          <EvidenceTag label="Human approval required" posture="critical" />
          <EvidenceTag label="Evidence-bound recommendations" posture="advisory" />
          <EvidenceTag label="No autonomous control path" posture="ready" />
        </div>
        <div className="action-dock__actions">
          {actions.map((action) => (
            <OpsButton key={action.path + action.label} action={action} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="action-dock__protected">
          <h3>Protected action boundary</h3>
          <p>Protected race, payout, emergency, medication, and enforcement actions are not exposed as frontend controls.</p>
          <div className="evidence-tag-list">
            {protectedActions.map((action) => (
              <EvidenceTag key={action} label={action} posture="blocked" />
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}

export function CommandStrip({ actions, onNavigate }: { actions: ConsoleAction[]; onNavigate: (path: string) => void }): ReactElement {
  return (
    <div className="command-strip console-command-strip" aria-label="Console primary actions">
      {actions.map((action) => (
        <OpsButton key={action.path + action.label} action={action} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export function OpsHero({ payload, error, onNavigate }: { payload: ConsolePayload; error?: string; onNavigate?: (path: string) => void }): ReactElement {
  return (
    <header className="ops-hero">
      <div className="ops-hero__copy">
        <p className="eyebrow">Racetrack console</p>
        <h1>{payload.title}</h1>
        <p>{payload.mission}</p>
        {error ? <p className="ops-hero__degraded">Live data degraded: {error}</p> : null}
      </div>
      <div className="ops-hero__accessory">
        <PostureBadge label={payload.postureLabel} posture={payload.posture} />
        <EvidenceTag label={payload.source} posture="advisory" />
        {onNavigate && payload.primaryActions.slice(0, 1).map((action) => (
          <OpsButton key={action.path + action.label} action={{ ...action, tone: action.tone ?? 'primary' }} onNavigate={onNavigate} />
        ))}
      </div>
    </header>
  );
}

export function MetricRail({ metrics, onNavigate }: { metrics: ConsoleMetric[]; onNavigate: (path: string) => void }): ReactElement {
  return (
    <section className="metric-rail" aria-label="Console metrics">
      {metrics.map((metric) => (
        <article className={`metric-rail__card ${metric.posture ? postureClass(metric.posture) : ''}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
          {metric.action ? (
            <OpsButton action={metric.action} onNavigate={onNavigate} />
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function LifecycleBoard({
  lanes,
  onNavigate,
}: {
  lanes: LifecycleLane[];
  onNavigate: (path: string) => void;
}): ReactElement {
  if (!lanes.length) return <></>;

  return (
    <section className="lifecycle-board" aria-label="Operating lifecycle">
      {lanes.map((lane) => (
        <article className="lifecycle-board__lane" key={lane.id}>
          <header className="lifecycle-board__header">
            <h2>{lane.title}</h2>
            {lane.description ? <p>{lane.description}</p> : null}
          </header>
          <ol className="lifecycle-board__track">
            {lane.stages.map((stage, index) => (
              <li className={`lifecycle-board__stage ${postureClass(stage.posture)}`} key={stage.id}>
                <div className="lifecycle-board__connector" aria-hidden="true">
                  {index > 0 ? <span className="lifecycle-board__line" /> : null}
                  <span className="lifecycle-board__node" />
                </div>
                <div className="lifecycle-board__content">
                  <div className="lifecycle-board__title-row">
                    <h3>{stage.label}</h3>
                    <PostureBadge label={stage.status} posture={stage.posture} />
                  </div>
                  <p>{stage.summary}</p>
                  {stage.approvalRequired ? <EvidenceTag label="Approval required" posture="blocked" /> : null}
                  {stage.updatedAt ? <small className="lifecycle-board__timestamp">Updated {stage.updatedAt}</small> : null}
                  <div className="evidence-tag-list">
                    {stage.evidence.map((tag) => (
                      <EvidenceTag key={tag} label={tag} posture={stage.posture} />
                    ))}
                  </div>
                  <div className="lifecycle-board__actions">
                    {stage.actions.map((action) => (
                      <OpsButton key={action.path + action.label} action={action} onNavigate={onNavigate} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}

export function LiveSignalRail({
  signals,
  onNavigate,
}: {
  signals: LiveSignal[];
  onNavigate: (path: string) => void;
}): ReactElement {
  if (!signals.length) return <></>;

  return (
    <section className="live-signal-rail" aria-label="Live operating signals">
      <header>
        <h2>Live signal feed</h2>
        <p>Recent command-center and domain events requiring operator routing.</p>
      </header>
      <ol className="live-signal-rail__list">
        {signals.map((signal) => (
          <li className={`live-signal-rail__item ${postureClass(signal.posture)}`} key={signal.id}>
            <time dateTime={signal.timestamp}>{signal.timestamp}</time>
            <div>
              <strong>{signal.title}</strong>
              <p>{signal.summary}</p>
              <div className="evidence-tag-list">
                <EvidenceTag label={signal.domain} posture={signal.posture} />
                <EvidenceTag label={signal.severity} posture={signal.posture} />
              </div>
              <div className="live-signal-rail__actions">
                {signal.actions.map((action) => (
                  <OpsButton key={action.path + action.label} action={action} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PriorityQueue({ queues, onNavigate, title = 'Escalations requiring action' }: { queues: ConsoleQueue[]; onNavigate: (path: string) => void; title?: string }): ReactElement {
  if (!queues.length) return <></>;

  return (
    <section className="priority-queue" aria-label="Priority queues">
      <header className="priority-queue__intro">
        <h2>{title}</h2>
        <p>Items that need operator review beyond the lifecycle lanes above.</p>
      </header>
      {queues.map((queue) => (
        <article className="priority-queue__group" key={queue.id}>
          <header>
            <h2>{queue.title}</h2>
            {queue.description ? <p>{queue.description}</p> : null}
          </header>
          <div className="priority-queue__items">
            {queue.items.map((item) => (
              <article className={`priority-queue__item ${postureClass(item.posture)}`} key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <div className="evidence-tag-list">
                  {item.evidence.map((tag) => (
                    <EvidenceTag key={tag} label={tag} posture={item.posture} />
                  ))}
                </div>
                <div className="priority-queue__actions">
                  {item.actions.map((action) => (
                    <OpsButton key={action.path + action.label} action={action} onNavigate={onNavigate} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

export function AdvisoryDock({
  advisories = [],
  degraded,
  onNavigate,
}: {
  advisories?: ConsoleAdvisory[];
  degraded?: string[];
  onNavigate: (path: string) => void;
}): ReactElement {
  if (!advisories.length && !degraded?.length) return <></>;

  return (
    <aside className="advisory-dock" aria-label="Console advisories">
      <h2>Advisories & guardrails</h2>
      {degraded?.map((item) => (
        <article className="advisory-dock__item posture-badge--watch" key={item}>
          <p>{item}</p>
        </article>
      ))}
      {advisories.map((advisory) => (
        <article className={`advisory-dock__item ${postureClass(advisory.posture)}`} key={advisory.id}>
          <p>{advisory.recommendation}</p>
          {advisory.requiresApproval ? <EvidenceTag label="Human approval required" posture="critical" /> : null}
          <div className="advisory-dock__actions">
            {advisory.actions.map((action) => (
              <OpsButton key={action.path + action.label} action={action} onNavigate={onNavigate} />
            ))}
          </div>
        </article>
      ))}
    </aside>
  );
}

export function LoadingConsole({ label, source }: { label: string; source?: string }): ReactElement {
  return (
    <section className="console-state console-state--loading" aria-live="polite">
      <p className="eyebrow">Loading console</p>
      <h2>{label}</h2>
      {source ? <p>{source}</p> : null}
    </section>
  );
}

export function ErrorConsole({ title, message, detail }: { title: string; message: string; detail?: string }): ReactElement {
  return (
    <section className="console-state console-state--error" role="alert">
      <p className="eyebrow">Console unavailable</p>
      <h2>{title}</h2>
      <p>{message}</p>
      {detail ? <small>{detail}</small> : null}
    </section>
  );
}

export function ShellErrorBoundary(props: { children: ReactNode; title: string; resetKey?: string }): ReactElement {
  return <UiRenderErrorBoundary {...props} />;
}

export function ConsoleSurface(props: { data: ConsolePayload; onNavigate: (path: string) => void; footer?: ReactNode }): ReactElement {
  return (
    <div className="console-surface">
      <OpsHero payload={props.data} onNavigate={props.onNavigate} />
      <CommandStrip actions={props.data.primaryActions} onNavigate={props.onNavigate} />
      <ChartRail charts={props.data.charts ?? []} onNavigate={props.onNavigate} />
      <LifecycleBoard lanes={props.data.lifecycleLanes ?? []} onNavigate={props.onNavigate} />
      <LiveSignalRail signals={props.data.liveSignals ?? []} onNavigate={props.onNavigate} />
      <MetricRail metrics={props.data.metrics} onNavigate={props.onNavigate} />
      <PriorityQueue queues={props.data.queues} onNavigate={props.onNavigate} />
      <AdvisoryDock advisories={props.data.advisories} degraded={props.data.contextDegraded} onNavigate={props.onNavigate} />
      {props.footer}
    </div>
  );
}
