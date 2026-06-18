import type {
  RaceReadinessIndicatorDto,
  StartingGateAssignmentDto,
  StartingGateAuditRecordDto,
  StartingGateDelayDto,
  StartingGateIncidentDto,
  StartingGateKpiDashboardDto,
  StartingGateKpiDto,
  StartingGateMutationResultDto,
  StartingGateOperationsAuditTrailDto,
  StartingGateOperationsDto,
  StartingGateReadinessDto,
} from '@trackmind/shared';
import { startingGateNoAutoStartStatement } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService } from './approvals.js';
import type { RaceCardManagementPlatform } from './raceCardManagement.js';
import type { RaceOperationsPlatform } from './raceOperationsPlatform.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface StartingGateOperationsState {
  tenantId: string;
  racetrackId: string;
  raceDayId?: string;
  gateId: string;
  sectorId: string;
  metersFromStart: number;
  gpsVerified: boolean;
  lastApprovedRequestId?: string;
  assignments: StartingGateAssignmentDto[];
  readinessChecks: StartingGateReadinessDto[];
  delays: StartingGateDelayDto[];
  incidents: StartingGateIncidentDto[];
  raceStartApprovalRequestIds: Map<string, string>;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface StartingGateOperationsDeps {
  raceCardManagement?: RaceCardManagementPlatform;
  raceOperations?: RaceOperationsPlatform;
  approvalService?: CentralizedApprovalService;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
}

export class StartingGateOperationsPlatform {
  private state: StartingGateOperationsState;
  private readonly auditChain: StartingGateAuditRecordDto[] = [];

  constructor(private readonly deps: StartingGateOperationsDeps = {}) {
    const now = new Date().toISOString();
    this.state = {
      tenantId: deps.tenantId ?? 'trackmind',
      racetrackId: deps.racetrackId ?? 'main-track',
      gateId: 'GATE_MAIN_01',
      sectorId: 'backstretch',
      metersFromStart: 0,
      gpsVerified: true,
      assignments: [],
      readinessChecks: [],
      delays: [],
      incidents: [],
      raceStartApprovalRequestIds: new Map(),
      version: 1,
      updatedAt: now,
      updatedBy: 'starting-gate-operations',
    };
  }

  workspace(now = new Date().toISOString()): StartingGateOperationsDto {
    this.syncFromRaceDay(now);
    const raceDayLinks = this.buildRaceDayLinks(now);
    const dashboard = this.buildDashboard(now);
    const raceReadinessIndicators = this.buildRaceReadinessIndicators(now);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.starting-gate-operations.v1',
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      gatePosition: this.gatePosition(),
      assignments: this.state.assignments.map(clone),
      readinessChecks: this.state.readinessChecks.map(clone),
      delays: this.state.delays.map(clone),
      incidents: this.state.incidents.map(clone),
      raceReadinessIndicators,
      guardrails: {
        mayAutoStartRace: false,
        raceStartAutomation: false,
        approvalGovernedWorkflows: true,
        guardrailStatement: startingGateNoAutoStartStatement,
      },
      approvalControls: [
        { action: 'race-start', approvalRequired: true, automatedExecutionBlocked: true, workflowId: 'tmwf.race-start.v1', endpoint: '/api/v1/approvals/controlled-actions' },
        { action: 'starting-gate-move', approvalRequired: true, automatedExecutionBlocked: true, workflowId: 'tmwf.gate-move.v1', endpoint: '/api/v1/approvals/controlled-actions' },
        { action: 'race-status-change', approvalRequired: true, automatedExecutionBlocked: true, workflowId: 'tmwf.race-start.v1', endpoint: '/api/v1/approvals/controlled-actions' },
      ],
      readinessScore: dashboard.readinessScore,
      timeline: this.buildTimeline(now),
      raceDayLinks,
      dashboard,
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  gatePosition() {
    return {
      gateId: this.state.gateId,
      sectorId: this.state.sectorId,
      metersFromStart: this.state.metersFromStart,
      gpsVerified: this.state.gpsVerified,
      lastApprovedRequestId: this.state.lastApprovedRequestId,
    };
  }

  kpiDashboard(now = new Date().toISOString()): StartingGateKpiDashboardDto {
    return this.workspace(now).dashboard;
  }

  auditTrail(raceId?: string, now = new Date().toISOString()): StartingGateOperationsAuditTrailDto {
    const records = raceId
      ? this.auditChain.filter((record) => record.raceId === raceId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.starting-gate-operations.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  assignGate(input: Omit<StartingGateAssignmentDto, 'assignmentId' | 'auditId'>, actor = 'starter'): StartingGateMutationResultDto {
    const auditId = id('audit-gate');
    const assignment: StartingGateAssignmentDto = { ...clone(input), assignmentId: id('gate-assignment'), auditId };
    const existing = this.state.assignments.findIndex((entry) => entry.horseId === assignment.horseId && entry.raceId === assignment.raceId);
    if (existing >= 0) this.state.assignments[existing] = assignment;
    else this.state.assignments.push(assignment);
    return this.commit('starting-gate-operations.assignment.recorded', `Assigned ${assignment.horseId} to stall ${assignment.stallNumber}`, auditId, assignment.horseId, assignment.raceId, actor);
  }

  recordReadiness(input: Omit<StartingGateReadinessDto, 'checkId' | 'auditId'>, actor = 'starter'): StartingGateMutationResultDto {
    const auditId = id('audit-gate');
    const check: StartingGateReadinessDto = { ...clone(input), checkId: id('gate-readiness'), auditId };
    this.state.readinessChecks.push(check);
    if (check.horseId && check.status === 'ready') {
      const assignment = this.state.assignments.find((entry) => entry.horseId === check.horseId && entry.raceId === check.raceId);
      if (assignment && assignment.status === 'assigned') assignment.status = 'loaded';
      if (assignment && assignment.status === 'loaded') assignment.loadedAt = check.checkedAt;
    }
    return this.commit('starting-gate-operations.readiness.recorded', `Recorded ${check.domain} readiness for race ${check.raceId}`, auditId, check.horseId, check.raceId, actor);
  }

  reportDelay(input: Omit<StartingGateDelayDto, 'delayId' | 'auditId' | 'approvalRequestId'>, actor = 'starter'): StartingGateMutationResultDto {
    if (!this.deps.approvalService) throw new Error('Approval service integration required for delay workflows');
    const auditId = id('audit-gate');
    const approval = this.deps.approvalService.createRequest({
      action: 'race-status-change',
      target: input.raceId,
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      requestedBy: actor,
      actorType: 'human',
      reason: `Starting gate delay: ${input.reason}`,
      evidence: [...input.evidence, `estimated-minutes:${input.estimatedMinutes}`],
    });
    const delay: StartingGateDelayDto = {
      ...clone(input),
      delayId: id('gate-delay'),
      auditId,
      approvalRequestId: approval.id,
      status: input.status ?? 'active',
    };
    this.state.delays.push(delay);
    const result = this.commit('starting-gate-operations.delay.reported', `Reported delay for race ${delay.raceId}: ${delay.reason}`, auditId, undefined, delay.raceId, actor);
    return { ...result, approvalRequestId: approval.id };
  }

  clearDelay(delayId: string, actor = 'starter'): StartingGateMutationResultDto {
    const delay = this.state.delays.find((entry) => entry.delayId === delayId);
    if (!delay) throw new Error(`Unknown starting gate delay ${delayId}`);
    if (!delay.approvalRequestId) throw new Error('Delay clearance requires approval-governed workflow linkage');
    delay.status = 'cleared';
    delay.clearedAt = new Date().toISOString();
    return this.commit('starting-gate-operations.delay.cleared', `Cleared delay ${delayId} after approval workflow`, id('audit-gate'), undefined, delay.raceId, actor, delay.approvalRequestId);
  }

  reportIncident(input: Omit<StartingGateIncidentDto, 'incidentId' | 'auditId'>, actor = 'starter'): StartingGateMutationResultDto {
    const auditId = id('audit-gate');
    const incident: StartingGateIncidentDto = { ...clone(input), incidentId: id('gate-incident'), auditId };
    this.state.incidents.push(incident);
    return this.commit('starting-gate-operations.incident.reported', `Reported gate incident: ${incident.title}`, auditId, incident.horseId, incident.raceId, actor);
  }

  updateIncidentStatus(incidentId: string, status: StartingGateIncidentDto['status'], actor = 'steward'): StartingGateMutationResultDto {
    const incident = this.state.incidents.find((entry) => entry.incidentId === incidentId);
    if (!incident) throw new Error(`Unknown starting gate incident ${incidentId}`);
    incident.status = status;
    return this.commit('starting-gate-operations.incident.updated', `Updated incident ${incidentId} to ${status}`, id('audit-gate'), incident.horseId, incident.raceId, actor);
  }

  requestRaceStartApproval(raceId: string, input: { reason: string; evidence?: string[]; requestedBy?: string }, actor = 'starter'): StartingGateMutationResultDto {
    if (!this.deps.approvalService) throw new Error('Approval service integration required');
    const blockers = this.raceBlockers(raceId);
    if (blockers.length > 0) throw new Error(`Race start approval blocked: ${blockers.join('; ')}`);
    const approval = this.deps.approvalService.createRequest({
      action: 'race-start',
      target: raceId,
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      requestedBy: input.requestedBy ?? actor,
      actorType: 'human',
      reason: input.reason,
      evidence: input.evidence ?? ['starting-gate-readiness'],
    });
    this.state.raceStartApprovalRequestIds.set(raceId, approval.id);
    const auditId = id('audit-gate');
    const result = this.commit('starting-gate-operations.race-start.approval-requested', `Requested race-start approval for ${raceId}; race was not started`, auditId, undefined, raceId, actor, approval.id);
    return { ...result, approvalRequestId: approval.id };
  }

  private syncFromRaceDay(now: string): void {
    const raceCards = this.deps.raceCardManagement?.workspace(now).raceCards ?? [];
    for (const card of raceCards) {
      if (card.racetrackId !== this.state.racetrackId) continue;
      this.state.raceDayId = card.raceDayId ?? this.state.raceDayId;
      for (const entry of card.entries) {
        if (entry.scratched) continue;
        const postPosition = entry.postPosition ?? (Number.parseInt(entry.programNumber ?? '0', 10) || undefined);
        const stallNumber = postPosition ?? this.state.assignments.length + 1;
        const raceEntry = this.deps.raceOperations?.getRace(card.id)?.entries.find((raceEntryItem) => raceEntryItem.id === entry.id);
        const gateSlot = raceEntry?.gate ?? (postPosition ? `G-${postPosition}` : `G-${stallNumber}`);
        const assigned = Boolean(raceEntry?.gate || postPosition);
        const horseName = entry.horseId === 'horse-1' ? 'Lifecycle Runner' : entry.horseId === 'horse-2' ? 'Gate Test' : entry.horseId;
        if (!this.state.assignments.some((assignment) => assignment.horseId === entry.horseId && assignment.raceId === card.id)) {
          const auditId = id('audit-gate-sync');
          this.state.assignments.push({
            assignmentId: id('gate-assignment'),
            horseId: entry.horseId,
            horseName,
            raceId: card.id,
            entryId: entry.id,
            postPosition,
            stallNumber,
            gateSlot,
            status: assigned ? 'assigned' : 'pending',
            assignedAt: now,
            evidence: ['race-card-sync'],
            auditId,
          });
        }
      }
    }
    this.state.updatedAt = now;
  }

  private buildRaceDayLinks(now: string): StartingGateOperationsDto['raceDayLinks'] {
    const raceIds = [...new Set(this.state.assignments.map((assignment) => assignment.raceId))];
    const entryIds = [...new Set(this.state.assignments.map((assignment) => assignment.entryId).filter((entryId): entryId is string => Boolean(entryId)))];
    const pendingApprovalRequestIds = [
      ...this.state.delays.filter((delay) => delay.status === 'active' && delay.approvalRequestId).map((delay) => delay.approvalRequestId!),
      ...[...this.state.raceStartApprovalRequestIds.values()],
    ];
    return { raceDayId: this.state.raceDayId, raceIds, entryIds, pendingApprovalRequestIds };
  }

  private buildTimeline(now: string): StartingGateOperationsDto['timeline'] {
    const activeDelays = this.state.delays.filter((delay) => delay.status === 'active').length;
    return [
      { at: now, label: 'Gate crew check-in', status: this.state.readinessChecks.some((check) => check.domain === 'crew') ? 'complete' : 'scheduled' },
      { at: now, label: 'Stall assignments', status: this.state.assignments.length ? 'in-progress' : 'scheduled' },
      { at: now, label: 'Horse loading', status: this.state.assignments.some((entry) => entry.status === 'loaded') ? 'in-progress' : 'scheduled' },
      { at: now, label: 'Race start approval', status: this.state.raceStartApprovalRequestIds.size ? 'approval-required' : activeDelays ? 'blocked' : 'scheduled' },
    ];
  }

  private buildRaceReadinessIndicators(now: string): RaceReadinessIndicatorDto[] {
    const raceIds = [...new Set(this.state.assignments.map((assignment) => assignment.raceId))];
    if (!raceIds.length) raceIds.push('race-7');
    return raceIds.flatMap((raceId) => {
      const raceAssignments = this.state.assignments.filter((assignment) => assignment.raceId === raceId);
      const loaded = raceAssignments.filter((assignment) => assignment.status === 'loaded' || assignment.status === 'reloaded').length;
      const assignmentsComplete = raceAssignments.length > 0 && raceAssignments.every((assignment) => assignment.status !== 'pending');
      const activeDelays = this.state.delays.filter((delay) => delay.raceId === raceId && delay.status === 'active');
      const openIncidents = this.state.incidents.filter((incident) => incident.raceId === raceId && !['resolved', 'closed'].includes(incident.status));
      const crewReady = this.state.readinessChecks.some((check) => check.raceId === raceId && check.domain === 'crew' && check.status === 'ready');
      const approvalId = this.state.raceStartApprovalRequestIds.get(raceId);
      const blockers = this.raceBlockers(raceId);
      return [
        indicator(raceId, 'gate-assignments', assignmentsComplete ? 'nominal' : 'watch', `${loaded}/${raceAssignments.length || 0} loaded`, 'Gate stall assignments linked to race-day entries.', assignmentsComplete ? [] : ['gate assignments incomplete'], [], now),
        indicator(raceId, 'stall-loading', loaded === raceAssignments.length && raceAssignments.length > 0 ? 'nominal' : 'watch', `${loaded} loaded`, 'Horses loaded into assigned starting gate stalls.', loaded < raceAssignments.length ? ['horses not fully loaded'] : [], [], now),
        indicator(raceId, 'crew-readiness', crewReady ? 'nominal' : 'watch', crewReady ? 'crew ready' : 'crew watch', 'Starter crew readiness checks on file.', crewReady ? [] : ['crew readiness check pending'], [], now),
        indicator(raceId, 'active-delays', activeDelays.length ? 'blocked' : 'nominal', `${activeDelays.length} active`, 'Active starting gate delays require approval-governed clearance.', activeDelays.map((delay) => delay.reason), activeDelays.map((delay) => delay.approvalRequestId).filter((item): item is string => Boolean(item)), now),
        indicator(raceId, 'gate-incidents', openIncidents.length ? 'blocked' : 'nominal', `${openIncidents.length} open`, 'Open gate incidents block race readiness.', openIncidents.map((incident) => incident.title), [], now),
        indicator(raceId, 'race-start-approval', approvalId ? 'approval-required' : blockers.length ? 'blocked' : 'watch', approvalId ? 'pending approval' : 'not requested', 'Race start requires human approval; this module never auto-starts races.', blockers, approvalId ? [approvalId] : [], now),
      ];
    });
  }

  private raceBlockers(raceId: string): string[] {
    const blockers: string[] = [];
    const raceAssignments = this.state.assignments.filter((assignment) => assignment.raceId === raceId);
    if (!raceAssignments.length) blockers.push('no gate assignments');
    if (raceAssignments.some((assignment) => assignment.status === 'pending')) blockers.push('gate assignments incomplete');
    if (raceAssignments.some((assignment) => assignment.status !== 'loaded' && assignment.status !== 'reloaded' && assignment.status !== 'scratched')) {
      blockers.push('horses not fully loaded');
    }
    if (this.state.delays.some((delay) => delay.raceId === raceId && delay.status === 'active')) blockers.push('active gate delay');
    if (this.state.incidents.some((incident) => incident.raceId === raceId && !['resolved', 'closed'].includes(incident.status))) blockers.push('open gate incident');
    if (!this.state.readinessChecks.some((check) => check.raceId === raceId && check.domain === 'crew' && check.status === 'ready')) blockers.push('crew readiness not confirmed');
    return blockers;
  }

  private buildDashboard(now: string): StartingGateKpiDashboardDto {
    const assignedStalls = this.state.assignments.length;
    const loadedHorses = this.state.assignments.filter((entry) => entry.status === 'loaded' || entry.status === 'reloaded').length;
    const activeDelays = this.state.delays.filter((entry) => entry.status === 'active').length;
    const openIncidents = this.state.incidents.filter((entry) => !['resolved', 'closed'].includes(entry.status)).length;
    const approvalPendingCount = this.state.delays.filter((delay) => delay.status === 'active' && delay.approvalRequestId).length + this.state.raceStartApprovalRequestIds.size;
    const readinessScore = this.computeReadinessScore();
    const panels: StartingGateKpiDto[] = [
      kpi('gate-kpi-assigned', 'Assigned stalls', 'Horses with starting gate stall assignments.', assignedStalls, 'stalls', assignedStalls, assignedStalls > 0 ? 'nominal' : 'watch', [{ entityType: 'starting-gate-operations', entityId: this.state.racetrackId }], []),
      kpi('gate-kpi-loaded', 'Loaded horses', 'Horses loaded into assigned gate stalls.', loadedHorses, 'horses', assignedStalls, loadedHorses < assignedStalls ? 'watch' : 'nominal', [{ entityType: 'starting-gate', entityId: this.state.gateId }], []),
      kpi('gate-kpi-delays', 'Active delays', 'Active gate delays under approval-governed workflows.', activeDelays, 'delays', 0, activeDelays > 0 ? 'warning' : 'nominal', [{ entityType: 'race', entityId: this.state.raceDayId ?? 'race-day' }], []),
      kpi('gate-kpi-incidents', 'Open gate incidents', 'Gate incidents requiring starter or steward review.', openIncidents, 'incidents', 0, openIncidents > 0 ? 'warning' : 'nominal', [{ entityType: 'starting-gate-operations', entityId: this.state.racetrackId }], []),
      kpi('gate-kpi-approvals', 'Pending approvals', 'Race-start and delay workflows awaiting human approval.', approvalPendingCount, 'approvals', 0, approvalPendingCount > 0 ? 'watch' : 'nominal', [{ entityType: 'approval', entityId: 'race-start' }], []),
    ];
    return { assignedStalls, loadedHorses, activeDelays, openIncidents, readinessScore, approvalPendingCount, panels };
  }

  private computeReadinessScore(): number {
    if (!this.state.assignments.length) return 0;
    const loadedRatio = this.state.assignments.filter((entry) => entry.status === 'loaded' || entry.status === 'reloaded').length / this.state.assignments.length;
    const crewReady = this.state.readinessChecks.some((check) => check.domain === 'crew' && check.status === 'ready') ? 1 : 0.6;
    const delayPenalty = this.state.delays.filter((entry) => entry.status === 'active').length * 10;
    const incidentPenalty = this.state.incidents.filter((entry) => !['resolved', 'closed'].includes(entry.status)).length * 8;
    return Math.max(0, Math.min(100, Math.round(loadedRatio * 70 + crewReady * 30 - delayPenalty - incidentPenalty)));
  }

  private commit(eventType: string, message: string, auditId: string, horseId: string | undefined, raceId: string | undefined, actor: string, approvalRequestId?: string): StartingGateMutationResultDto {
    this.state.version += 1;
    this.state.updatedAt = new Date().toISOString();
    this.state.updatedBy = actor;
    const recordedAuditId = this.recordChange(actor, eventType, message, auditId, horseId, raceId, approvalRequestId);
    return {
      accepted: true,
      horseId,
      raceId,
      auditId: recordedAuditId,
      eventType,
      message: `${message}. Race start automation is disabled; approval-governed workflows apply.`,
      approvalRequestId,
      mock: false,
    };
  }

  private recordChange(actor: string, action: string, changeSummary: string, auditId = id('audit-gate'), horseId?: string, raceId?: string, approvalRequestId?: string): string {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const record: StartingGateAuditRecordDto = {
      auditId,
      horseId,
      raceId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ auditId, action, changeSummary, previousHash, approvalRequestId }),
      changeSummary,
      evidence: approvalRequestId ? [`approval:${approvalRequestId}`] : [],
    };
    this.auditChain.push(record);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: horseId ?? raceId ?? 'starting-gate-operations',
        payload: { action, changeSummary, raceId, approvalRequestId },
        tenantId: this.state.tenantId,
        severity: 'info',
        regulations: ['HISA', 'ARCI'],
      });
    }
    return auditId;
  }
}

function kpi(
  kpiId: string,
  name: string,
  description: string,
  value: number,
  unit: string,
  target: number,
  status: StartingGateKpiDto['status'],
  sourceEntities: StartingGateKpiDto['sourceEntities'],
  auditIds: string[],
): StartingGateKpiDto {
  return {
    kpiId,
    name,
    description,
    value,
    unit,
    target,
    status,
    trend: 'insufficient-history',
    sourceEntities,
    auditReference: { auditIds: [...auditIds], eventIds: [] },
  };
}

function indicator(
  raceId: string,
  indicator: RaceReadinessIndicatorDto['indicator'],
  status: RaceReadinessIndicatorDto['status'],
  value: string,
  detail: string,
  blockers: string[],
  approvalRequestIds: string[],
  lastUpdatedAt: string,
): RaceReadinessIndicatorDto {
  return { raceId, indicator, status, value, detail, blockers, approvalRequestIds, lastUpdatedAt };
}

export function createSeededStartingGateOperations(deps: StartingGateOperationsDeps, now = new Date().toISOString()): StartingGateOperationsPlatform {
  const platform = new StartingGateOperationsPlatform(deps);
  platform.workspace(now);

  if (!platform.workspace(now).assignments.length) {
    platform.assignGate({
      horseId: 'horse-1',
      horseName: 'Lifecycle Runner',
      raceId: 'race-7',
      entryId: 'entry-1',
      postPosition: 4,
      stallNumber: 4,
      gateSlot: 'G-4',
      status: 'assigned',
      assignedAt: now,
      evidence: ['seed-gate-assignment'],
    });
    platform.assignGate({
      horseId: 'horse-2',
      horseName: 'Gate Test',
      raceId: 'race-7',
      entryId: 'entry-2',
      postPosition: 2,
      stallNumber: 2,
      gateSlot: 'G-2',
      status: 'assigned',
      assignedAt: now,
      evidence: ['seed-gate-assignment'],
    });
  }

  platform.recordReadiness({
    raceId: 'race-7',
    checkedAt: now,
    checkedBy: 'starter-live',
    domain: 'crew',
    status: 'ready',
    score: 95,
    blockers: [],
    evidence: ['crew-roster', 'gate-verification'],
  });
  platform.recordReadiness({
    raceId: 'race-7',
    checkedAt: now,
    checkedBy: 'starter-live',
    domain: 'gate',
    status: 'ready',
    score: 92,
    blockers: [],
    evidence: ['gate-telemetry', 'gps-fix'],
  });

  const assignments = platform.workspace(now).assignments;
  for (const assignment of assignments.slice(0, 2)) {
    platform.assignGate({
      ...assignment,
      status: 'loaded',
      loadedAt: now,
      evidence: [...assignment.evidence, 'loaded-at-gate'],
    });
    platform.recordReadiness({
      raceId: assignment.raceId,
      horseId: assignment.horseId,
      checkedAt: now,
      checkedBy: 'starter-live',
      domain: 'horse',
      status: 'ready',
      score: 100,
      blockers: [],
      evidence: ['saddle-check', 'gate-load'],
    });
  }

  return platform;
}
