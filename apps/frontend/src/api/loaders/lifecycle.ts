import type {
  ApprovalDto,
  EquineIntelligenceDto,
  OperationsCommandCenterDto,
  PlatformHealthWorkspaceDto,
  RaceOfficeWorkspaceDto,
  RacingDataWorkspaceDto,
} from '@trackmind/shared';
import type { ConsoleAction, LifecycleLane, LifecycleStage, LiveSignal, OpsPosture } from '../../design/opsTypes';
import { navAction } from './util';

export function statusPosture(status: string, approvalRequired = false): OpsPosture {
  const normalized = status.toLowerCase();
  if (approvalRequired || normalized.includes('blocked') || normalized.includes('critical') || normalized.includes('fail')) {
    return approvalRequired ? 'blocked' : normalized.includes('critical') ? 'critical' : 'blocked';
  }
  if (normalized.includes('watch') || normalized.includes('warning') || normalized.includes('pending') || normalized.includes('await')) {
    return 'watch';
  }
  if (normalized.includes('advisory')) return 'advisory';
  return 'ready';
}

export function severityPosture(severity: string): OpsPosture {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'watch';
  if (severity === 'advisory') return 'advisory';
  return 'ready';
}

function stage(
  id: string,
  label: string,
  status: string,
  summary: string,
  posture: OpsPosture,
  evidence: string[],
  actions: ConsoleAction[],
  options: { approvalRequired?: boolean; updatedAt?: string } = {},
): LifecycleStage {
  return {
    id,
    label,
    status,
    summary,
    approvalRequired: options.approvalRequired,
    posture,
    evidence,
    actions,
    updatedAt: options.updatedAt,
  };
}

export function raceOfficeLifecycleLanes(
  raceOffice: RaceOfficeWorkspaceDto,
  readinessByRace: Map<string, { ready: boolean; blockers: string[] }>,
): LifecycleLane[] {
  const lanes: LifecycleLane[] = [];

  if (raceOffice.lifecycle.length) {
    lanes.push({
      id: 'race-lifecycle',
      title: 'Race lifecycle',
      description: 'Backend race-office lifecycle — current status, next action, and approval gates per race.',
      stages: raceOffice.lifecycle.map((entry) => {
        const readiness = readinessByRace.get(entry.raceId);
        const blockers = readiness?.blockers.length ? ` Blockers: ${readiness.blockers.join('; ')}.` : '';
        return stage(
          `lifecycle-${entry.raceId}`,
          `Race ${entry.raceId}`,
          entry.status,
          `${entry.nextAction}${blockers}`,
          statusPosture(entry.status, entry.approvalRequired),
          [entry.raceId, entry.eventType, entry.auditId].filter((value): value is string => Boolean(value)),
          [
            navAction('Review approvals', '/approvals', `Approval ${entry.approvalRequired ? 'required' : 'context'} for race ${entry.raceId}.`),
            navAction('Review audit ledger', '/audit', `Trace lifecycle audit evidence for race ${entry.raceId}.`),
          ],
          { approvalRequired: entry.approvalRequired, updatedAt: entry.updatedAt },
        );
      }),
    });
  }

  const scheduleStages: LifecycleStage[] = [
    ...raceOffice.meets.map((meet) => stage(
      `meet-${meet.id}`,
      meet.name,
      meet.status,
      `Track ${meet.trackId}${meet.startsOn ? ` · ${meet.startsOn}` : ''}`,
      statusPosture(meet.status),
      [meet.id, meet.trackId],
      [navAction('Race day console', '/race-day', 'Review meet-linked race-day readiness.')],
      { updatedAt: meet.updatedAt },
    )),
    ...raceOffice.raceDays.map((raceDay) => stage(
      `race-day-${raceDay.id}`,
      raceDay.raceDate,
      raceDay.status,
      `${raceDay.raceIds.length} race(s) scheduled`,
      statusPosture(raceDay.status),
      [raceDay.id, ...(raceDay.raceIds ?? [])],
      [navAction('Race day console', '/race-day', 'Review race-day readiness and surface posture.')],
      { updatedAt: raceDay.updatedAt },
    )),
  ];

  if (scheduleStages.length) {
    lanes.push({
      id: 'meet-progression',
      title: 'Meet & race-day progression',
      description: 'Scheduled meet and race-day states from the race-office workspace.',
      stages: scheduleStages,
    });
  }

  return lanes;
}

export function commandCenterLifecycleLanes(
  operations: OperationsCommandCenterDto,
  resolvePath: (path?: string) => string | undefined,
  routeLabel: (path: string) => string,
): { lanes: LifecycleLane[]; signals: LiveSignal[] } {
  const widgets = Array.isArray(operations.widgets) ? operations.widgets : [];
  const byDomain = new Map<string, typeof widgets>();

  for (const widget of widgets) {
    const group = byDomain.get(widget.domain) ?? [];
    group.push(widget);
    byDomain.set(widget.domain, group);
  }

  const lanes: LifecycleLane[] = [...byDomain.entries()].map(([domain, domainWidgets]) => ({
    id: `command-domain-${domain}`,
    title: domain,
    description: 'Operating domain posture from command-center widgets — not card nodes.',
    stages: domainWidgets.map((widget) => {
      const path = resolvePath(widget.drillDownPath) ?? '/dashboard';
      return stage(
        widget.id,
        widget.title,
        widget.status,
        `${widget.value} — ${widget.detail}`,
        severityPosture(widget.status === 'nominal' ? 'info' : widget.status),
        [widget.source, widget.domain, widget.id],
        [
          navAction(`Open ${routeLabel(path)}`, path, `Review ${widget.title} in the ${routeLabel(path)} console.`),
          navAction('Review approvals', '/approvals', 'Check approval gates for this operating domain.'),
        ],
      );
    }),
  }));

  if (operations.dataLineage?.length) {
    lanes.push({
      id: 'command-data-lineage',
      title: 'Data lineage references',
      description: 'Command-center lineage pointers to backend facade sources.',
      stages: operations.dataLineage.slice(0, 8).map((entry, index) => stage(
        `lineage-${index + 1}`,
        entry.domain,
        entry.source,
        entry.reference,
        'advisory',
        [entry.domain, entry.reference],
        [navAction('Open data hub', '/data-hub', 'Review provider lineage and export controls.')],
      )),
    });
  }

  const liveEvents = Array.isArray(operations.liveEvents) ? operations.liveEvents : [];
  const signals: LiveSignal[] = liveEvents.slice(0, 12).map((event) => ({
    id: event.id,
    timestamp: event.timestamp,
    title: event.summary,
    summary: `${event.type} from ${event.source}`,
    domain: event.domain,
    severity: event.severity,
    posture: severityPosture(event.severity),
    evidence: [event.type, event.domain, event.source],
    actions: [
      navAction('Race day console', '/race-day', 'Review race-day posture when this signal affects post time.'),
      navAction('Incidents console', '/incidents', 'Escalate if this signal indicates safety or security risk.'),
    ],
  }));

  return { lanes, signals };
}

export function equineLifecycleLanes(data: EquineIntelligenceDto): LifecycleLane[] {
  const horseName = data.horse.name;
  const stages: LifecycleStage[] = [
    stage(
      'horse-lifecycle',
      horseName,
      data.horse.lifecycleStatus,
      `Microchip ${data.horse.microchipId ?? 'unavailable'}`,
      statusPosture(data.horse.lifecycleStatus),
      [data.horse.horseId, 'lifecycleStatus'],
      [navAction('Review audit ledger', '/audit', 'Trace equine lifecycle audit evidence.')],
    ),
    stage(
      'eligibility',
      'Eligibility',
      data.eligibilityStatus.complianceStatus,
      data.eligibilityStatus.eligible
        ? 'Horse eligible for governed review.'
        : `Failed rules: ${data.eligibilityStatus.failedRules.join(', ') || 'review required'}`,
      data.eligibilityStatus.eligible ? 'ready' : 'blocked',
      data.eligibilityStatus.failedRules.length ? data.eligibilityStatus.failedRules : [data.horse.horseId],
      [navAction('Review approvals', '/approvals', 'Check eligibility-related approval records.')],
    ),
    stage(
      'veterinary',
      'Veterinary',
      data.veterinaryStatus.status,
      data.veterinaryStatus.summary,
      data.veterinaryStatus.requiresVeterinarian ? 'watch' : 'ready',
      ['veterinaryStatus', data.horse.horseId],
      [navAction('Race day console', '/race-day', 'Confirm veterinary readiness before post time.')],
    ),
    stage(
      'welfare',
      'Welfare',
      data.welfareStatus.level,
      data.welfareStatus.interventions.length
        ? `Interventions: ${data.welfareStatus.interventions.join(', ')}`
        : 'No active welfare interventions.',
      statusPosture(data.welfareStatus.level),
      data.welfareStatus.interventions.length ? data.welfareStatus.interventions : [data.horse.horseId],
      [navAction('Review incidents', '/incidents', 'Escalate if welfare signals require incident response.')],
    ),
  ];

  return [{
    id: 'equine-care-lifecycle',
    title: 'Horse care lifecycle',
    description: 'Equine intelligence lifecycle stages — eligibility, veterinary, and welfare posture.',
    stages,
  }];
}

export function approvalWorkflowLane(approvals: ApprovalDto[]): LifecycleLane | undefined {
  const pending = approvals.filter((approval) => {
    const status = String(approval.canonicalStatus ?? approval.status ?? '').toLowerCase();
    return status.includes('pending') || status.includes('awaiting') || status.includes('escalat') || status.includes('open');
  });
  if (!pending.length) return undefined;

  return {
    id: 'approval-workflow',
    title: 'Approval workflow',
    description: 'Human approval requests in governed workflow order.',
    stages: pending.slice(0, 10).map((approval) => stage(
      approval.id,
      approval.action,
      String(approval.canonicalStatus ?? approval.status ?? 'pending'),
      `${approval.target} · expires ${approval.expiresAt ?? 'n/a'}`,
      statusPosture(String(approval.canonicalStatus ?? approval.status ?? 'pending'), true),
      approval.evidence ?? [approval.id],
      [
        navAction('Review audit ledger', '/audit', `Trace approval evidence for ${approval.id}.`),
        navAction('Command center', '/dashboard', 'Return to operating posture after review.'),
      ],
    )),
  };
}

export function dataHubLifecycleLanes(workspace: RacingDataWorkspaceDto): LifecycleLane[] {
  const lanes: LifecycleLane[] = [];
  const statuses = Array.isArray(workspace.statuses) ? workspace.statuses : [];
  const jobs = Array.isArray(workspace.ingestionJobs) ? workspace.ingestionJobs : [];

  if (statuses.length) {
    lanes.push({
      id: 'provider-sync-lifecycle',
      title: 'Provider sync lifecycle',
      description: 'Licensed provider sync states from the racing data hub.',
      stages: statuses.slice(0, 8).map((entry, index) => {
        const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const id = String(record.providerId ?? record.id ?? `status-${index + 1}`);
        const status = String(record.status ?? record.syncState ?? 'declared');
        return stage(
          id,
          String(record.displayName ?? record.name ?? id),
          status,
          String(record.detail ?? record.message ?? 'Provider sync posture'),
          statusPosture(status),
          [id, 'RacingDataWorkspaceDto.statuses'],
          [navAction('Compliance console', '/compliance', 'Review license impact for provider sync issues.')],
        );
      }),
    });
  }

  if (jobs.length) {
    lanes.push({
      id: 'ingestion-pipeline',
      title: 'Ingestion pipeline',
      description: 'Ingestion job progression — metadata only, no live external scrape from the frontend.',
      stages: jobs.slice(0, 8).map((entry, index) => {
        const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const id = String(record.id ?? record.jobId ?? `job-${index + 1}`);
        const status = String(record.status ?? record.phase ?? 'queued');
        return stage(
          id,
          String(record.kind ?? record.name ?? 'Ingestion job'),
          status,
          String(record.summary ?? record.target ?? 'Local ingestion metadata'),
          statusPosture(status),
          [id, 'ingestionJobs'],
          [navAction('Audit console', '/audit', 'Review ingestion governance evidence.')],
        );
      }),
    });
  }

  const lineage = workspace.lineage && typeof workspace.lineage === 'object' ? workspace.lineage as Record<string, unknown> : {};
  const nodes = Array.isArray(lineage.nodes) ? lineage.nodes : [];
  if (nodes.length) {
    lanes.push({
      id: 'data-lineage-graph',
      title: 'Data lineage graph',
      description: 'Lineage nodes from the backend workspace — graph-shaped data, not card widgets.',
      stages: nodes.slice(0, 10).map((entry, index) => {
        const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const id = String(record.id ?? `node-${index + 1}`);
        return stage(
          id,
          String(record.label ?? record.name ?? id),
          String(record.kind ?? record.type ?? 'node'),
          String(record.reference ?? record.source ?? 'Lineage node'),
          'advisory',
          [id, 'lineage.nodes'],
          [navAction('Federation console', '/federation', 'Review cross-track sharing rules tied to lineage.')],
        );
      }),
    });
  }

  return lanes;
}

export function compactLifecycleLanes(lanes: Array<LifecycleLane | undefined>): LifecycleLane[] {
  return lanes.filter((lane): lane is LifecycleLane => Boolean(lane));
}

export function recordsLifecycleLane(
  id: string,
  title: string,
  description: string,
  records: Array<{ id: string; label: string; status: string; summary: string; evidence?: string[]; actions?: ConsoleAction[] }>,
): LifecycleLane | undefined {
  if (!records.length) return undefined;
  return {
    id,
    title,
    description,
    stages: records.map((record) => stage(
      record.id,
      record.label,
      record.status,
      record.summary,
      statusPosture(record.status),
      record.evidence ?? [record.id],
      record.actions ?? [],
    )),
  };
}

export function platformHealthLifecycleLanes(services: PlatformHealthWorkspaceDto['services']): LifecycleLane[] {
  if (!services?.length) return [];
  return [{
    id: 'platform-services-lifecycle',
    title: 'Platform service lifecycle',
    description: 'Service health progression from platform health workspace — dependency posture per service.',
    stages: services.map((service) => {
      const dependencies = Array.isArray(service.dependencies) ? service.dependencies : [];
      return stage(
        service.serviceId,
        service.serviceId,
        service.status,
        `${service.latencyMs}ms latency · ${dependencies.length} dependencies`,
        postureFromPlatformStatus(service.status),
        dependencies.map((dependency) => `${dependency.id}:${dependency.status}`),
        [
          navAction('Audit console', '/audit', 'Review platform audit evidence.'),
          navAction('Approvals console', '/approvals', 'Review approval backlog when services degrade.'),
        ],
        { updatedAt: service.lastCheckedAt },
      );
    }),
  }];
}

function postureFromPlatformStatus(status: string): OpsPosture {
  if (status === 'critical') return 'critical';
  if (status === 'degraded') return 'watch';
  return 'ready';
}

export function settingsGovernanceLanes(
  recommendations: Array<{ id?: string; recommendationId?: string; action?: string; target?: string; status?: string; recommendation?: string }>,
  blockedActions: Array<{ recommendationId?: string; id?: string; action?: string; target?: string; governorDecision?: { reason?: string } }>,
  nav: (label: string, focus: string, detail: string) => ConsoleAction,
): LifecycleLane[] {
  const lanes: LifecycleLane[] = [];

  if (recommendations.length) {
    lanes.push({
      id: 'governance-recommendations',
      title: 'Governance recommendation workflow',
      description: 'Human-in-the-loop recommendation queue from the AI control plane.',
      stages: recommendations.slice(0, 8).map((item) => stage(
        item.recommendationId ?? item.id ?? 'recommendation',
        item.action ?? 'Governance recommendation',
        item.status ?? 'review',
        `${item.target ?? 'unknown target'} — ${item.recommendation ?? 'Review required'}`,
        statusPosture(item.status ?? 'review', true),
        [item.recommendationId ?? item.id ?? 'recommendation'],
        [
          nav('Review recommendation', 'governance-events', 'Inspect control-plane recommendation workflow.'),
          nav('Review policy', 'policy', 'Review protected-action policy mapping.'),
        ],
      )),
    });
  }

  if (blockedActions.length) {
    lanes.push({
      id: 'blocked-autonomous-actions',
      title: 'Blocked autonomous execution',
      description: 'Governor-blocked protected actions — no frontend execution path.',
      stages: blockedActions.slice(0, 6).map((item) => stage(
        item.recommendationId ?? item.id ?? 'blocked',
        item.action ?? 'Blocked action',
        'blocked',
        `${item.target ?? 'unknown target'} — ${item.governorDecision?.reason ?? 'Human approval required'}`,
        'blocked',
        [item.recommendationId ?? item.id ?? 'blocked'],
        [nav('Review blocked action', 'blocked-actions', 'Inspect governor-blocked protected action attempts.')],
      )),
    });
  }

  return lanes;
}
