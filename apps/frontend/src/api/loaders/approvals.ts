import type { ApprovalDto } from '@trackmind/shared';
import type { ConsolePayload, ConsoleQueue, OpsPosture } from '../../design/opsTypes';
import { routeById } from '../../routes/routes';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import { countBarChart, postureBreakdownDonut } from './charts';
import { approvalWorkflowLane } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

function approvalPosture(approval: ApprovalDto): OpsPosture {
  const status = String(approval.canonicalStatus ?? approval.status ?? '').toLowerCase();
  if (status.includes('critical') || approval.priority === 'critical') return 'critical';
  if (status.includes('pending') || status.includes('awaiting') || status.includes('escalat')) return 'blocked';
  if (approval.priority === 'high') return 'watch';
  return 'advisory';
}

function postureLabel(posture: OpsPosture, pendingCount: number): string {
  if (posture === 'critical') return 'Critical approval SLA risk';
  if (pendingCount > 0) return `${pendingCount} approval request(s) awaiting human review`;
  if (posture === 'blocked') return 'Approval queue requires attention';
  return 'Approval queue clear for this scope';
}

function isPendingApproval(approval: ApprovalDto): boolean {
  const status = String(approval.canonicalStatus ?? approval.status ?? '').toLowerCase();
  return status.includes('pending') || status.includes('awaiting') || status.includes('escalat') || status.includes('open');
}

function routeHintForAction(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes('surface') || normalized.includes('irrigation') || normalized.includes('gate') || normalized.includes('race')) return '/race-day';
  if (normalized.includes('equine') || normalized.includes('horse') || normalized.includes('barn') || normalized.includes('veterinar')) return '/equine';
  if (normalized.includes('incident') || normalized.includes('security') || normalized.includes('emergency')) return '/incidents';
  if (normalized.includes('payout') || normalized.includes('finance') || normalized.includes('ticket')) return '/finance';
  if (normalized.includes('facilit') || normalized.includes('maintenance') || normalized.includes('asset')) return '/facilities';
  if (normalized.includes('ai') || normalized.includes('govern')) return '/settings';
  return '/dashboard';
}

export async function loadApprovalsConsole(): Promise<ConsolePayload> {
  const approvals = await getJson<ApprovalDto[]>(apiPaths.approvals.list);
  const approvalRows = requireReady(approvals, 'Approval queue');
  const rows = Array.isArray(approvalRows) ? approvalRows : [];

  const pending = rows.filter(isPendingApproval);
  const critical = pending.filter((approval) => approval.priority === 'critical' || approvalPosture(approval) === 'critical');
  const sortedPending = [...pending].sort((left, right) => {
    const priorityRank = (value: ApprovalDto['priority']) => (value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3);
    return priorityRank(left.priority) - priorityRank(right.priority);
  });

  const pendingQueue: ConsoleQueue = {
    id: 'approval-pending',
    title: 'Pending approval requests',
    description: 'Human approval records blocking protected backend workflows — review evidence before approving in governed systems.',
    items: sortedPending.map((approval) => {
      const contextPath = routeHintForAction(String(approval.action));
      const roles = (approval.requiredRoles ?? approval.approverRoles ?? []).join(', ') || 'declared by policy';
      return {
        id: approval.id,
        title: approval.action,
        summary: `${approval.target} requested by ${approval.requestedBy ?? 'unknown'}. Required roles: ${roles}. Expires ${approval.expiresAt ?? 'unavailable'}.`,
        posture: approvalPosture(approval),
        evidence: approval.evidence.length ? approval.evidence : [approval.id, apiPaths.approvals.list],
        actions: [
          navAction('Review audit ledger', '/audit', `Trace immutable audit evidence for approval ${approval.id}.`),
          navAction(`Open related console`, contextPath, `Review operational context for ${approval.action} affecting ${approval.target}.`),
          navAction('Return to command center', '/dashboard', 'Review overall operating posture after handling this approval.'),
        ],
      };
    }),
  };

  const resolvedQueue: ConsoleQueue = {
    id: 'approval-recent-resolved',
    title: 'Recently resolved approvals',
    description: 'Recently completed approval records for audit cross-reference.',
    items: rows.filter((approval) => !isPendingApproval(approval)).slice(0, 6).map((approval) => ({
      id: `resolved-${approval.id}`,
      title: `${approval.action} — ${String(approval.canonicalStatus ?? approval.status)}`,
      summary: `${approval.target} resolved for audit cross-reference.`,
      posture: 'ready' as OpsPosture,
      evidence: approval.evidence.length ? approval.evidence : [approval.id],
      actions: [
        navAction('Review audit ledger', '/audit', `Inspect audit trail for resolved approval ${approval.id}.`),
        navAction('Open related console', routeHintForAction(String(approval.action)), `Review operational context for ${approval.target}.`),
      ],
    })),
  };

  const overallPosture: OpsPosture = critical.length > 0
    ? 'critical'
    : pending.length > 0
      ? 'blocked'
      : 'ready';

  const workflowLane = approvalWorkflowLane(rows);

  const priorityCounts = rows.reduce<Record<string, number>>((counts, approval) => {
    const priority = approval.priority ?? 'medium';
    counts[priority] = (counts[priority] ?? 0) + 1;
    return counts;
  }, {});

  return {
    routeId: 'approvals',
    title: routeById.approvals.label,
    mission: 'Review pending human approval requests blocking protected race-day, welfare, finance, and platform actions.',
    posture: overallPosture,
    postureLabel: postureLabel(overallPosture, pending.length),
    source: approvals.source,
    primaryActions: [
      navAction('Return to command center', '/dashboard', 'Review overall operating posture and cross-workstream alerts.', 'primary'),
      navAction('Review audit ledger', '/audit', 'Trace immutable audit evidence linked to approval workflows.', 'primary'),
      navAction('Open race day readiness', '/race-day', 'Review race-day controls that commonly drive approval workload.', 'primary'),
    ],
    lifecycleLanes: workflowLane ? [workflowLane] : [],
    charts: [
      postureBreakdownDonut(
        'approval-status-donut',
        'Approval status mix',
        {
          pending: pending.length,
          critical: critical.length,
          resolved: rows.length - pending.length,
        },
        { pending: 'blocked', critical: 'critical', resolved: 'ready' },
        navAction('Review audit ledger', '/audit', 'Trace immutable audit evidence linked to approval workflows.'),
      ),
      countBarChart(
        'approval-priority-bar',
        'Approval priority breakdown',
        'Distribution of approval requests by priority.',
        Object.entries(priorityCounts).map(([priority, value]) => ({
          id: `priority-${priority}`,
          label: priority,
          value,
          posture: priority === 'critical' ? 'critical' : priority === 'high' ? 'watch' : 'advisory',
        })),
        'approvals',
        navAction('Open race day readiness', '/race-day', 'Review race-day controls that commonly drive approval workload.'),
      ),
    ],
    queues: pending.length
      ? [pendingQueue, ...(resolvedQueue.items.length ? [resolvedQueue] : [])]
      : [{
        id: 'approval-empty',
        title: 'No pending approvals',
        description: 'The live approval route is reachable and currently returns an empty queue for this tenant and role.',
        items: [{
          id: 'approval-empty-state',
          title: 'Queue clear',
          summary: 'No pending approval records are blocking protected actions in this scope.',
          posture: 'ready',
          evidence: ['ApprovalDto[]', apiPaths.approvals.list],
          actions: [
            navAction('Return to command center', '/dashboard', 'Continue operating from the command center console.'),
            navAction('Review audit ledger', '/audit', 'Inspect recent audit events for approval workflow activity.'),
          ],
        }],
      }],
    metrics: [
      countMetric('Pending approvals', pending.length, 'Approval requests awaiting human review', pending.length ? 'blocked' : 'ready'),
      countMetric('Critical priority', critical.length, 'Pending approvals flagged critical', critical.length ? 'critical' : 'ready'),
      countMetric('Total records', rows.length, 'All approval request records visible to this role', rows.length ? 'watch' : 'ready'),
      textMetric('Execution boundary', 'Review only', 'Approving or rejecting protected actions is not exposed from this frontend', 'advisory'),
    ],
  };
}
