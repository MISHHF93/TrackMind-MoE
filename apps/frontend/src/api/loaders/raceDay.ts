import type {
  RaceDayReadinessDashboardDto,
  RaceDto,
  RaceOfficeWorkspaceDto,
  SurfaceIntelligenceDto,
  TrackMapDto,
} from '@trackmind/shared';
import type { ConsolePayload, ConsoleQueue, OpsPosture } from '../../design/opsTypes';
import { routeById } from '../../routes/routes';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import { enrichConsoleWithSharedContext, loadSharedContext } from './commonContext';
import { readinessGauge, readinessRaceBarChart, surfaceSparkline } from './charts';
import { raceOfficeLifecycleLanes } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

function readinessPosture(status: string): OpsPosture {
  if (status === 'blocked') return 'blocked';
  if (status === 'watch') return 'watch';
  return 'ready';
}

function severityPosture(severity: string): OpsPosture {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'watch';
  return 'advisory';
}

function surfacePriorityPosture(priority: string): OpsPosture {
  if (priority === 'critical') return 'critical';
  if (priority === 'high') return 'watch';
  return 'advisory';
}

function postureLabel(posture: OpsPosture, readiness: RaceDayReadinessDashboardDto): string {
  if (posture === 'blocked' || readiness.blocked > 0) return `${readiness.blocked} race(s) blocked — approval review required`;
  if (posture === 'watch' || readiness.watch > 0) return `${readiness.watch} race(s) on watch — review warnings before post time`;
  if (posture === 'critical') return 'Critical readiness signals active';
  return 'Race-day posture nominal';
}

export async function loadRaceDayConsole(): Promise<ConsolePayload> {
  const [races, raceOffice, readiness, surface, trackConfiguration, shared] = await Promise.all([
    getJson<RaceDto[]>(apiPaths.raceDay.races),
    getJson<RaceOfficeWorkspaceDto>(apiPaths.raceDay.raceOffice),
    getJson<RaceDayReadinessDashboardDto>(apiPaths.raceDay.readiness),
    getJson<SurfaceIntelligenceDto>(apiPaths.raceDay.surface),
    getJson<TrackMapDto>(apiPaths.raceDay.trackConfiguration),
    loadSharedContext('raceDay'),
  ]);

  const raceRows = requireReady(races, 'Race summaries');
  const raceOfficeData = requireReady(raceOffice, 'Race office workspace');
  const readinessData = requireReady(readiness, 'Race-day readiness dashboard');
  const surfaceData = requireReady(surface, 'Surface intelligence workspace');
  const trackData = requireReady(trackConfiguration, 'Track configuration map');

  const blockedRaces = readinessData.races.filter((race) => race.status === 'blocked' || race.status === 'watch');
  const criticalWarnings = readinessData.warnings.filter((warning) => warning.severity === 'critical' || warning.severity === 'warning');
  const pendingApprovals = readinessData.approvals.filter((approval) => approval.status === 'pending');
  const lockedControls = raceOfficeData.approvalControls;
  const surfaceActions = surfaceData.recommendations.filter((item) => item.executionState === 'approval-required');
  const trackWorkOrders = trackData.trackConfiguration?.workOrders.filter((order) => order.status === 'approval-blocked' || order.status === 'verification-pending') ?? [];

  const readinessQueue: ConsoleQueue = {
    id: 'race-readiness',
    title: 'Race readiness actions',
    description: 'Races and domain warnings that require steward or operator review before post time.',
    items: [
      ...blockedRaces.map((race) => ({
        id: `race-${race.raceId}`,
        title: `Race ${race.raceId} — ${race.status}`,
        summary: `Readiness score ${race.score}% with ${race.warnings} warning(s) and ${race.approvals} approval requirement(s). Post time ${race.postTime}.`,
        posture: readinessPosture(race.status),
        evidence: [race.raceId, race.trackId, apiPaths.raceDay.readiness],
        actions: [
          navAction('Review approval queue', '/approvals', `Check approval records affecting race ${race.raceId}.`),
          navAction('Review audit ledger', '/audit', `Trace audit evidence for race ${race.raceId} readiness decisions.`),
        ],
      })),
      ...criticalWarnings.slice(0, 8).map((warning) => ({
        id: warning.id,
        title: `${warning.domain} warning — race ${warning.raceId}`,
        summary: `${warning.message} Recommended: ${warning.recommendedAction}`,
        posture: severityPosture(warning.severity),
        evidence: warning.evidence.length ? warning.evidence : [warning.domain, warning.raceId],
        actions: [
          navAction('Review race day readiness', '/race-day', 'Stay in race-day console to resolve readiness warnings.'),
          navAction('Review incidents', '/incidents', 'Escalate to incidents if this warning indicates safety or security risk.'),
        ],
      })),
    ],
  };

  const approvalQueue: ConsoleQueue = {
    id: 'race-approval-controls',
    title: 'Approval-gated race controls',
    description: 'Locked race-office controls and readiness approvals — execution remains backend-governed.',
    items: [
      ...pendingApprovals.map((approval) => ({
        id: approval.id,
        title: `${approval.action} — race ${approval.raceId}`,
        summary: approval.reason,
        posture: 'blocked' as OpsPosture,
        evidence: approval.evidence.length ? approval.evidence : [approval.raceId, apiPaths.raceDay.readiness],
        actions: [
          navAction('Review approval queue', '/approvals', `Open approval review for ${approval.action}.`),
          navAction('Review audit ledger', '/audit', `Trace audit evidence for race ${approval.raceId} approval workflow.`),
        ],
      })),
      ...lockedControls.map((control) => ({
        id: control.id,
        title: `Locked control: ${control.action}`,
        summary: `${control.reason} Target: ${control.target}.`,
        posture: 'blocked' as OpsPosture,
        evidence: control.evidence.length ? control.evidence : [control.action, control.target],
        actions: [
          navAction('Review approval queue', '/approvals', `Human approval required before ${control.action} can proceed.`),
          navAction('Review audit ledger', '/audit', 'Inspect immutable audit trail for this locked race-office control.'),
        ],
      })),
    ],
  };

  const surfaceQueue: ConsoleQueue = {
    id: 'surface-approval-actions',
    title: 'Surface actions pending approval',
    description: 'Surface intelligence recommendations that require human approval before execution.',
    items: surfaceActions.map((item) => ({
      id: item.id,
      title: `${item.type} — sector ${item.sectorId}`,
      summary: item.recommendation,
      posture: surfacePriorityPosture(item.priority),
      evidence: [item.eventId, item.auditId, item.sectorId, apiPaths.raceDay.surface],
      actions: [
        navAction('Review approval queue', '/approvals', 'Open approvals for surface irrigation, maintenance, or readiness actions.'),
        navAction('Review audit ledger', '/audit', `Trace surface advisory audit ${item.auditId}.`),
      ],
    })),
  };

  const trackQueue: ConsoleQueue = {
    id: 'track-configuration-review',
    title: 'Track configuration review',
    description: 'Starting gate and track configuration work packages blocked on approval or verification.',
    items: [
      ...trackWorkOrders.map((order) => ({
        id: order.id,
        title: `Work order ${order.id} — ${order.status}`,
        summary: `Crew ${order.crew}: ${order.tasks.join('; ')}`,
        posture: order.status === 'approval-blocked' ? ('blocked' as OpsPosture) : ('watch' as OpsPosture),
        evidence: order.evidenceRequired.length ? order.evidenceRequired : [order.id, apiPaths.raceDay.trackConfiguration],
        actions: [
          navAction('Review approval queue', '/approvals', 'Track configuration changes require steward approval before field verification.'),
          navAction('Review audit ledger', '/audit', 'Inspect track configuration audit and verification evidence.'),
        ],
      })),
      ...(trackData.trackConfiguration?.verificationWorkflow.status === 'approval-blocked'
        ? [{
          id: 'track-verification-blocked',
          title: 'Track verification blocked pending approval',
          summary: `Digital twin sync: ${trackData.trackConfiguration.verificationWorkflow.digitalTwinSync}.`,
          posture: 'blocked' as OpsPosture,
          evidence: [trackData.startingGate.sectorId, apiPaths.raceDay.trackConfiguration],
          actions: [
            navAction('Review approval queue', '/approvals', 'Approve track verification workflow before digital twin sync.'),
            navAction('Review race day readiness', '/race-day', 'Confirm gate and track readiness after approval.'),
          ],
        }]
        : []),
    ],
  };

  const overallPosture: OpsPosture = readinessData.blocked > 0
    ? 'blocked'
    : readinessData.watch > 0 || surfaceData.overallScore < 80
      ? 'watch'
      : 'ready';

  const readinessByRace = new Map(
    raceOfficeData.readiness.map((entry) => [entry.raceId, { ready: entry.ready, blockers: entry.blockers }]),
  );

  const surfaceScores = surfaceData.sectors.length
    ? surfaceData.sectors.map((sector) => sector.conditionScore)
    : surfaceData.conditionScorecards.map((card) => card.score);
  const surfaceChart = surfaceSparkline(surfaceScores, navAction('Review race day', '/race-day', 'Review surface intelligence.'));

  const base: ConsolePayload = {
    routeId: 'raceDay',
    title: routeById.raceDay.label,
    mission: 'Review race office readiness, surface conditions, track configuration, and approval gates before post time.',
    posture: overallPosture,
    postureLabel: postureLabel(overallPosture, readinessData),
    postureScore: readinessData.averageScore,
    generatedAt: readinessData.generatedAt || raceOfficeData.cards[0]?.updatedAt || '',
    source: races.source,
    primaryActions: [
      navAction('Review approval queue', '/approvals', 'Inspect pending approvals blocking race starts, scratches, and configuration changes.', 'primary'),
      navAction('Review incidents', '/incidents', 'Open incidents if readiness warnings indicate safety or emergency escalation.', 'primary'),
      navAction('Review audit ledger', '/audit', 'Trace immutable audit evidence for race-day decisions.', 'primary'),
    ],
    lifecycleLanes: raceOfficeLifecycleLanes(raceOfficeData, readinessByRace),
    charts: [
      readinessGauge(readinessData.averageScore, overallPosture, navAction('Review approvals', '/approvals', 'Open approval queue for blocked races.')),
      readinessRaceBarChart(readinessData, navAction('Review audit ledger', '/audit', 'Trace readiness audit evidence.')),
      ...(surfaceChart ? [surfaceChart] : []),
    ],
    queues: [readinessQueue, approvalQueue, surfaceQueue, trackQueue].filter((queue) => queue.items.length > 0),
    metrics: [
      textMetric('Readiness average', `${readinessData.averageScore}%`, 'Facade readiness score across race-day domains', overallPosture),
      countMetric('Races on card', raceRows.length, 'Race summaries from /races', 'ready'),
      textMetric('Surface score', `${surfaceData.overallScore}%`, 'Surface intelligence workspace overall score', surfaceData.overallScore >= 80 ? 'ready' : 'watch'),
      countMetric('Track sectors', trackData.sectors.length, 'Track map sectors from /track-configuration/map', 'ready'),
      countMetric('Locked controls', lockedControls.length + pendingApprovals.length, 'Race-day controls remain approval-only', lockedControls.length + pendingApprovals.length ? 'watch' : 'ready', navAction('Review approvals', '/approvals', 'Open the approval review console.')),
      textMetric('Direct execution', 'Locked', 'Race starts, stops, results, and configuration changes are not exposed from the frontend', 'critical'),
    ],
  };

  return enrichConsoleWithSharedContext(base, shared, { skipApprovalQueue: true });
}
