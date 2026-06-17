import type { BarnOperationsDto, EquineIntelligenceDto } from '@trackmind/shared';
import type { ConsolePayload, ConsoleQueue, OpsPosture } from '../../design/opsTypes';
import { routeById } from '../../routes/routes';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import { countBarChart, postureBreakdownDonut, readinessGauge } from './charts';
import { equineLifecycleLanes } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

function postureLabel(posture: OpsPosture, horseName: string): string {
  if (posture === 'blocked') return `${horseName} blocked — eligibility or barn restrictions require review`;
  if (posture === 'watch') return `${horseName} on watch — veterinarian or welfare review recommended`;
  if (posture === 'critical') return 'Critical equine welfare signals active';
  return `${horseName} eligible for review`;
}

export async function loadEquineConsole(): Promise<ConsolePayload> {
  const [horse, barnOperations] = await Promise.all([
    getJson<EquineIntelligenceDto>(apiPaths.equine.horse),
    getJson<BarnOperationsDto>(apiPaths.equine.barnOperations),
  ]);

  const data = requireReady(horse, 'Equine intelligence horse profile');
  const barnData = requireReady(barnOperations, 'Barn operations workspace');

  const activeRestrictions = barnData.restrictions.filter((restriction) => restriction.active);
  const barnBlockers = barnData.readiness.filter((readiness) => readiness.blockers.length > 0 || readiness.status === 'blocked' || readiness.status === 'watch');
  const pendingEquineApprovals = data.approvals.filter((approval) => approval.status === 'pending' || approval.status === 'awaiting');
  const aiAdvisories = data.aiRiskRecommendations;

  const welfareQueue: ConsoleQueue = {
    id: 'equine-welfare-review',
    title: 'Horse welfare and eligibility review',
    description: 'Eligibility, veterinary, and welfare signals requiring operator or veterinarian review.',
    items: [
      ...(!data.eligibilityStatus.eligible || data.eligibilityStatus.failedRules.length > 0
        ? [{
          id: 'equine-eligibility',
          title: `Eligibility review — ${data.horse.name}`,
          summary: `Compliance ${data.eligibilityStatus.complianceStatus}. Failed rules: ${data.eligibilityStatus.failedRules.join(', ') || 'none'}. Flags: ${data.eligibilityStatus.flags.join(', ') || 'none'}.`,
          posture: 'blocked' as OpsPosture,
          evidence: data.eligibilityStatus.failedRules.length ? data.eligibilityStatus.failedRules : [apiPaths.equine.horse],
          actions: [
            navAction('Review approval queue', '/approvals', 'Check eligibility-related approval records before clearing the horse.'),
            navAction('Review audit ledger', '/audit', `Trace eligibility audit evidence for ${data.horse.horseId}.`),
          ],
        }]
        : []),
      ...(data.veterinaryStatus.requiresVeterinarian
        ? [{
          id: 'equine-veterinary',
          title: `Veterinarian review required — ${data.horse.name}`,
          summary: data.veterinaryStatus.summary,
          posture: 'watch' as OpsPosture,
          evidence: ['veterinaryStatus', data.horse.horseId],
          actions: [
            navAction('Review approval queue', '/approvals', 'Veterinarian sign-off may require a governed approval record.'),
            navAction('Review race day readiness', '/race-day', 'Confirm race-day veterinary readiness before post time.'),
          ],
        }]
        : []),
      ...pendingEquineApprovals.map((approval) => ({
        id: approval.id,
        title: `${approval.action} — ${data.horse.name}`,
        summary: `Status ${approval.status}; required role ${approval.requiredRole}.`,
        posture: 'blocked' as OpsPosture,
        evidence: [approval.action, data.horse.horseId, apiPaths.equine.horse],
        actions: [
          navAction('Review approval queue', '/approvals', `Open approval review for ${approval.action}.`),
          navAction('Review audit ledger', '/audit', 'Inspect equine approval audit trail.'),
        ],
      })),
    ],
  };

  const barnQueue: ConsoleQueue = {
    id: 'barn-operations-review',
    title: 'Barn readiness and restrictions',
    description: 'Barn occupancy, blockers, and active restrictions affecting horse movement and welfare.',
    items: [
      ...barnBlockers.map((readiness) => ({
        id: `barn-${readiness.barnId}`,
        title: `Barn ${readiness.barnId} — ${readiness.status}`,
        summary: `Readiness ${readiness.score}% with ${readiness.occupiedStalls}/${readiness.capacity} stalls occupied. Blockers: ${readiness.blockers.join(', ') || 'none'}.`,
        posture: readiness.status === 'blocked' ? ('blocked' as OpsPosture) : ('watch' as OpsPosture),
        evidence: [readiness.barnId, apiPaths.equine.barnOperations, ...readiness.blockers],
        actions: [
          navAction('Review barn operations', '/equine', 'Review barn readiness and occupancy in the equine console.'),
          navAction('Review audit ledger', '/audit', `Trace barn audit evidence for barn ${readiness.barnId}.`),
          navAction('Review incidents', '/incidents', 'Escalate barn safety incidents if blockers indicate active incident response.'),
        ],
      })),
      ...activeRestrictions.slice(0, 8).map((restriction) => ({
        id: restriction.id,
        title: `${restriction.type} restriction — barn ${restriction.barnId}`,
        summary: restriction.reason,
        posture: 'blocked' as OpsPosture,
        evidence: [restriction.eventId, restriction.auditId, restriction.barnId],
        actions: [
          navAction('Review approval queue', '/approvals', 'Restrictions may require approval before lift or movement.'),
          navAction('Review audit ledger', '/audit', `Trace restriction audit ${restriction.auditId}.`),
        ],
      })),
    ],
  };

  const aiQueue: ConsoleQueue = {
    id: 'equine-ai-advisories',
    title: 'AI welfare advisories',
    description: 'Non-diagnostic AI recommendations requiring veterinarian review when flagged.',
    items: aiAdvisories.map((item) => ({
      id: item.id,
      title: item.proposedOperationalAction ?? 'Equine welfare advisory',
      summary: item.summary,
      posture: item.veterinarianReviewRequired ? ('watch' as OpsPosture) : ('advisory' as OpsPosture),
      evidence: [item.status, item.id, apiPaths.equine.horse],
      actions: [
        navAction('Review approval queue', '/approvals', 'Veterinarian review may require a governed approval before operational action.'),
        navAction('Review AI guardrails', '/settings', 'Inspect read-only AI guardrails for equine welfare advisories.'),
      ],
    })),
  };

  const overallPosture: OpsPosture = !data.eligibilityStatus.eligible || barnBlockers.some((b) => b.status === 'blocked')
    ? 'blocked'
    : data.veterinaryStatus.requiresVeterinarian || aiAdvisories.some((item) => item.veterinarianReviewRequired)
      ? 'watch'
      : 'ready';

  const welfareScore = data.welfareStatus.latestScore ?? 0;
  const welfarePosture: OpsPosture = welfareScore >= 80 ? 'ready' : welfareScore >= 60 ? 'watch' : 'critical';
  const barnStatusCounts = barnData.readiness.reduce<Record<string, number>>((counts, readiness) => {
    counts[readiness.status] = (counts[readiness.status] ?? 0) + 1;
    return counts;
  }, {});
  const flagCounts = data.eligibilityStatus.flags.reduce<Record<string, number>>((counts, flag) => {
    counts[flag] = (counts[flag] ?? 0) + 1;
    return counts;
  }, {});

  return {
    routeId: 'equine',
    title: routeById.equine.label,
    mission: 'Review horse lifecycle, eligibility, welfare, barn readiness, and veterinary status before race-day clearance.',
    posture: overallPosture,
    postureLabel: postureLabel(overallPosture, data.horse.name),
    postureScore: data.welfareStatus.latestScore,
    source: horse.source,
    primaryActions: [
      navAction('Review approval queue', '/approvals', 'Inspect equine and barn approvals before clearing horses or lifting restrictions.', 'primary'),
      navAction('Review race day readiness', '/race-day', 'Confirm race-day readiness context for horses on today\'s card.', 'primary'),
      navAction('Review audit ledger', '/audit', 'Trace immutable audit evidence for equine welfare decisions.', 'primary'),
    ],
    lifecycleLanes: equineLifecycleLanes(data),
    charts: [
      readinessGauge(welfareScore, welfarePosture, navAction('Review approval queue', '/approvals', 'Inspect equine approvals before clearing welfare signals.')),
      countBarChart(
        'barn-readiness-bar',
        'Barn readiness statuses',
        'Barn operations readiness distribution by status.',
        Object.entries(barnStatusCounts).map(([status, value]) => ({
          id: `barn-status-${status}`,
          label: status,
          value,
          posture: status === 'blocked' ? 'blocked' : status === 'watch' ? 'watch' : 'ready',
        })),
        'barns',
        navAction('Review barn operations', '/equine', 'Review barn readiness and occupancy in the equine console.'),
      ),
      postureBreakdownDonut(
        'eligibility-flags-donut',
        'Eligibility flags',
        flagCounts,
        Object.fromEntries(Object.keys(flagCounts).map((flag) => [flag, 'watch' as OpsPosture])),
        navAction('Review audit ledger', '/audit', `Trace eligibility audit evidence for ${data.horse.horseId}.`),
      ),
    ],
    queues: [welfareQueue, barnQueue, aiQueue].filter((queue) => queue.items.length > 0),
    metrics: [
      textMetric('Lifecycle', data.horse.lifecycleStatus, 'Horse lifecycle from EquineIntelligenceDto', 'ready'),
      textMetric('Eligibility', data.eligibilityStatus.complianceStatus, 'Eligibility compliance posture', data.eligibilityStatus.eligible ? 'ready' : 'watch'),
      textMetric('Veterinary status', data.veterinaryStatus.status, 'Detailed veterinary records are omitted from this facade', data.veterinaryStatus.requiresVeterinarian ? 'watch' : 'advisory'),
      countMetric('Barn readiness rows', barnData.readiness.length, 'Barn operations workspace readiness summaries', 'ready'),
      countMetric('Active restrictions', activeRestrictions.length, 'Barn and stall restrictions requiring review', activeRestrictions.length ? 'watch' : 'ready'),
      countMetric('AI welfare advisories', aiAdvisories.length, 'Equine expert advisories merged into review queues', aiAdvisories.length ? 'advisory' : 'ready'),
    ],
    advisories: aiAdvisories.map((item) => ({
      id: item.id,
      recommendation: item.summary,
      posture: item.veterinarianReviewRequired ? 'watch' : 'advisory',
      requiresApproval: item.veterinarianReviewRequired,
      actions: [
        navAction('Review approval queue', '/approvals', 'Veterinarian review may require human approval before operational action.'),
        navAction('Review AI guardrails', '/settings', 'Inspect read-only AI guardrails for equine welfare boundaries.'),
      ],
    })),
  };
}
