import type {
  ApprovalDto,
  AuditEventDto,
  KPIWorkspaceDto,
  AIControlPlaneRecommendationDto,
} from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsoleAdvisory, ConsoleMetric, ConsolePayload, ConsoleQueue, OpsPosture } from '../../design/opsTypes';
import type { DomainRouteId } from '../../domain/support';
import { countMetric, navAction, textMetric } from './util';

export interface SharedConsoleContext {
  approvals: ApprovalDto[];
  auditEvents: AuditEventDto[];
  advisories: ConsoleAdvisory[];
  kpiMetrics: ConsoleMetric[];
  contextDegraded: string[];
}

const routeKpiDomains: Record<DomainRouteId, string[]> = {
  dashboard: ['race-day-operations', 'system-health', 'approval-workflows', 'ai-governance'],
  raceDay: ['race-day-operations', 'approval-workflows'],
  equine: ['equine-welfare', 'veterinary-privacy'],
  approvals: ['approval-workflows'],
  incidents: ['safety-incidents'],
  compliance: ['compliance', 'audit-integrity', 'deployment-readiness'],
  security: ['security', 'safety-incidents'],
  facilities: ['facilities'],
  ticketing: ['ticketing', 'fan-experience'],
  finance: ['finance'],
  federation: ['multi-track-federation'],
  dataHub: ['racing-data-hub', 'data-quality'],
  audit: ['audit-integrity', 'approval-workflows'],
  admin: ['tenant-operations', 'system-health', 'deployment-readiness'],
  settings: ['ai-governance', 'data-quality'],
};

function degradation(path: string, label: string, status: string, message?: string): string | undefined {
  if (status === 'ready' || status === 'empty') return undefined;
  return `${label} (${path}): ${message ?? status}`;
}

function advisoryFromRecommendation(item: AIControlPlaneRecommendationDto): ConsoleAdvisory {
  const id = item.recommendationId ?? item.id ?? 'ai-advisory';
  const risk = item.risk?.level ?? item.riskLevel;
  return {
    id,
    recommendation: item.recommendation ?? item.governorDecision?.reason ?? 'AI advisory pending review.',
    posture: risk === 'critical' ? 'critical' : risk === 'high' ? 'watch' : 'advisory',
    requiresApproval: item.approvalRequirement?.required !== false,
    actions: [
      navAction('View approval context', '/approvals', 'Review approval queue for this advisory.'),
      navAction('Review AI guardrails', '/settings', 'Inspect control-plane policy and blocked actions.'),
    ],
  };
}

function kpiPosture(status: unknown): OpsPosture {
  if (status === 'critical' || status === 'blocked') return 'critical';
  if (status === 'watch' || status === 'warning') return 'watch';
  return 'ready';
}

function formatKpiValue(value: unknown, unit: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  if (unit === 'score' || unit === 'percent') return `${Math.round(value)}%`;
  if (typeof unit === 'string' && unit.trim()) return `${value} ${unit}`;
  return String(value);
}

function kpiMetricsForRoute(routeId: DomainRouteId, workspace: KPIWorkspaceDto | undefined): ConsoleMetric[] {
  const domains = new Set(routeKpiDomains[routeId]);
  const kpis = Array.isArray(workspace?.kpis) ? workspace.kpis : [];
  return kpis
    .filter((kpi) => typeof kpi === 'object' && kpi !== null && typeof (kpi as { domain?: unknown }).domain === 'string' && domains.has((kpi as { domain: string }).domain))
    .slice(0, 4)
    .map((kpi) => {
      const record = kpi as { name?: string; value?: number; unit?: string; description?: string; status?: string };
      return textMetric(
        record.name ?? 'Governed KPI',
        formatKpiValue(record.value, record.unit),
        record.description ?? 'Governed KPI artifact from /kpis.',
        kpiPosture(record.status),
      );
    });
}

export async function loadSharedContext(routeId: DomainRouteId = 'dashboard'): Promise<SharedConsoleContext> {
  const [approvals, audit, recommendations, governance, workspace, kpis] = await Promise.all([
    getJson<ApprovalDto[]>(apiPaths.approvals.list),
    getJson<AuditEventDto[]>(apiPaths.audit.events),
    getJson<AIControlPlaneRecommendationDto[]>(apiPaths.dashboard.aiControlPlaneRecommendations),
    getJson(apiPaths.dashboard.aiGovernanceWorkspace),
    getJson(apiPaths.dashboard.aiControlPlaneWorkspace),
    getJson<KPIWorkspaceDto>(apiPaths.kpis.workspace),
  ]);

  const contextDegraded = [
    degradation(apiPaths.approvals.list, 'Approvals', approvals.status, approvals.message),
    degradation(apiPaths.audit.events, 'Audit ledger', audit.status, audit.message),
    degradation(apiPaths.dashboard.aiControlPlaneRecommendations, 'AI recommendations', recommendations.status, recommendations.message),
    degradation(apiPaths.dashboard.aiGovernanceWorkspace, 'AI governance', governance.status, governance.message),
    degradation(apiPaths.dashboard.aiControlPlaneWorkspace, 'AI control plane', workspace.status, workspace.message),
    degradation(apiPaths.kpis.workspace, 'KPI workspace', kpis.status, kpis.message),
  ].filter((entry): entry is string => Boolean(entry));

  const approvalData = approvals.status === 'ready' || approvals.status === 'empty' ? (approvals.data ?? []) : [];
  const auditData = audit.status === 'ready' || audit.status === 'empty' ? (audit.data ?? []) : [];
  const recommendationData = recommendations.status === 'ready' || recommendations.status === 'empty' ? (recommendations.data ?? []) : [];
  const kpiData = kpis.status === 'ready' ? kpis.data : undefined;

  return {
    approvals: approvalData,
    auditEvents: auditData,
    advisories: recommendationData.slice(0, 6).map(advisoryFromRecommendation),
    kpiMetrics: kpiMetricsForRoute(routeId, kpiData),
    contextDegraded,
  };
}

export function mergeAdvisories(primary: ConsoleAdvisory[] | undefined, shared: ConsoleAdvisory[]): ConsoleAdvisory[] {
  const seen = new Set<string>();
  return [...(primary ?? []), ...shared].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function postureFromCounts(blocked: number, watch: number, critical: number): OpsPosture {
  if (critical > 0 || blocked > 0) return 'critical';
  if (watch > 0) return 'watch';
  return 'ready';
}

function approvalBacklogQueue(approvals: ApprovalDto[]): ConsoleQueue | undefined {
  if (!approvals.length) return undefined;
  return {
    id: 'governance-approvals',
    title: 'Approval backlog',
    description: 'Human approval requests requiring steward or operator review.',
    items: approvals.slice(0, 6).map((approval) => ({
      id: approval.id,
      title: approval.action,
      summary: `${approval.target} — ${String(approval.status ?? approval.canonicalStatus ?? 'pending')}`,
      posture: 'watch' as const,
      evidence: approval.evidence ?? [],
      actions: [navAction('Review request', '/approvals', 'Open approval review console.')],
    })),
  };
}

function auditPreviewQueue(events: AuditEventDto[]): ConsoleQueue | undefined {
  if (!events.length) return undefined;
  return {
    id: 'governance-audit-preview',
    title: 'Recent audit signals',
    description: 'Latest audit ledger entries linked to governance and approval workflows.',
    items: events.slice(0, 4).map((event) => {
      const hash = event.integrityReference?.hash ?? event.hash ?? 'hash unavailable';
      return {
        id: event.id,
        title: event.action ?? 'Audit event',
        summary: `${event.severity ?? 'info'} event from ${event.actor?.actorId ?? event.actorId ?? 'unknown actor'}.`,
        posture: event.severity === 'critical' ? 'critical' as const : event.severity === 'warning' ? 'watch' as const : 'advisory' as const,
        evidence: [hash, ...(event.evidenceIds ?? [])].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
        actions: [
          navAction('View audit evidence', '/audit', 'Open audit evidence console.'),
          navAction('Review approval context', '/approvals', 'Review approval records linked to audit events.'),
        ],
      };
    }),
  };
}

export function enrichConsoleWithSharedContext(
  base: ConsolePayload,
  shared: SharedConsoleContext,
  options: { skipApprovalQueue?: boolean; skipAuditPreview?: boolean; skipSharedAdvisories?: boolean } = {},
): ConsolePayload {
  const governanceMetrics: ConsoleMetric[] = [
    countMetric(
      'Pending approvals',
      shared.approvals.length,
      'Human approval queue depth',
      shared.approvals.length ? 'watch' : 'ready',
      navAction('Review approvals', '/approvals', 'Open approval review console.'),
    ),
  ];
  const governanceQueues = [
    ...(options.skipApprovalQueue ? [] : [approvalBacklogQueue(shared.approvals)].filter((queue): queue is ConsoleQueue => Boolean(queue))),
    ...(options.skipAuditPreview ? [] : [auditPreviewQueue(shared.auditEvents)].filter((queue): queue is ConsoleQueue => Boolean(queue))),
  ];

  return {
    ...base,
    advisories: options.skipSharedAdvisories ? base.advisories : mergeAdvisories(base.advisories, shared.advisories),
    contextDegraded: [...(base.contextDegraded ?? []), ...shared.contextDegraded],
    metrics: [...base.metrics, ...governanceMetrics, ...shared.kpiMetrics],
    queues: [...base.queues, ...governanceQueues],
  };
}
