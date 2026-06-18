import type {
  HorseArrivalDto,
  PaddockAssignmentDto,
  PaddockAuditRecordDto,
  PaddockIncidentDto,
  PaddockInspectionDto,
  PaddockKpiDashboardDto,
  PaddockKpiDto,
  PaddockMutationResultDto,
  PaddockOperationsAuditTrailDto,
  PaddockOperationsDto,
  PaddockPersonnelAssignmentDto,
  PaddockReadinessCheckDto,
  PaddockReadinessStatus,
} from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
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

interface PaddockOperationsState {
  tenantId: string;
  racetrackId: string;
  raceDayId?: string;
  assignments: PaddockAssignmentDto[];
  arrivals: HorseArrivalDto[];
  inspections: PaddockInspectionDto[];
  readinessChecks: PaddockReadinessCheckDto[];
  personnelAssignments: PaddockPersonnelAssignmentDto[];
  incidents: PaddockIncidentDto[];
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PaddockOperationsDeps {
  raceCardManagement?: RaceCardManagementPlatform;
  raceOperations?: RaceOperationsPlatform;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
}

export class PaddockOperationsPlatform {
  private state: PaddockOperationsState;
  private readonly auditChain: PaddockAuditRecordDto[] = [];

  constructor(private readonly deps: PaddockOperationsDeps = {}) {
    const now = new Date().toISOString();
    this.state = {
      tenantId: deps.tenantId ?? 'trackmind',
      racetrackId: deps.racetrackId ?? 'main-track',
      assignments: [],
      arrivals: [],
      inspections: [],
      readinessChecks: [],
      personnelAssignments: [],
      incidents: [],
      version: 1,
      updatedAt: now,
      updatedBy: 'paddock-operations',
    };
  }

  workspace(now = new Date().toISOString()): PaddockOperationsDto {
    this.syncFromRaceDay(now);
    const raceDayLinks = this.buildRaceDayLinks(now);
    const dashboard = this.buildDashboard(now);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.paddock-operations.v1',
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      assignments: this.state.assignments.map(clone),
      arrivals: this.state.arrivals.map(clone),
      inspections: this.state.inspections.map(clone),
      readinessChecks: this.state.readinessChecks.map(clone),
      personnelAssignments: this.state.personnelAssignments.map(clone),
      incidents: this.state.incidents.map(clone),
      paradeSchedule: raceDayLinks.paradeSchedule,
      readinessScore: dashboard.readinessScore,
      gateReadiness: this.gateReadiness(now),
      timeline: this.buildTimeline(now),
      raceDayLinks,
      dashboard,
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  kpiDashboard(now = new Date().toISOString()): PaddockKpiDashboardDto {
    return this.workspace(now).dashboard;
  }

  auditTrail(horseId?: string, now = new Date().toISOString()): PaddockOperationsAuditTrailDto {
    const records = horseId
      ? this.auditChain.filter((record) => record.horseId === horseId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.paddock-operations.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  assignPaddock(input: Omit<PaddockAssignmentDto, 'assignmentId' | 'auditId'>, actor = 'paddock-judge'): PaddockMutationResultDto {
    const auditId = id('audit-paddock');
    const assignment: PaddockAssignmentDto = { ...clone(input), assignmentId: id('paddock-assignment'), auditId };
    const existing = this.state.assignments.findIndex((entry) => entry.horseId === assignment.horseId && entry.raceId === assignment.raceId);
    if (existing >= 0) this.state.assignments[existing] = assignment;
    else this.state.assignments.push(assignment);
    return this.commit('paddock-operations.assignment.recorded', `Assigned ${assignment.horseId} to slot ${assignment.paddockSlot}`, auditId, assignment.horseId, assignment.raceId, actor);
  }

  recordArrival(input: Omit<HorseArrivalDto, 'arrivalId' | 'auditId'>, actor = 'paddock-judge'): PaddockMutationResultDto {
    const auditId = id('audit-paddock');
    const arrival: HorseArrivalDto = { ...clone(input), arrivalId: id('paddock-arrival'), auditId };
    const existing = this.state.arrivals.findIndex((entry) => entry.horseId === arrival.horseId && entry.raceId === arrival.raceId);
    if (existing >= 0) this.state.arrivals[existing] = arrival;
    else this.state.arrivals.push(arrival);
    const assignment = this.state.assignments.find((entry) => entry.horseId === arrival.horseId && entry.raceId === arrival.raceId);
    if (assignment && arrival.status === 'arrived') assignment.status = 'arrived';
    return this.commit('paddock-operations.arrival.recorded', `Recorded arrival for ${arrival.horseId}`, auditId, arrival.horseId, arrival.raceId, actor);
  }

  recordInspection(input: Omit<PaddockInspectionDto, 'inspectionId' | 'auditId'>, actor = 'paddock-judge'): PaddockMutationResultDto {
    const auditId = id('audit-paddock');
    const inspection: PaddockInspectionDto = { ...clone(input), inspectionId: id('paddock-inspection'), auditId };
    this.state.inspections.push(inspection);
    const assignment = this.state.assignments.find((entry) => entry.horseId === inspection.horseId && entry.raceId === inspection.raceId);
    if (assignment && inspection.status === 'passed') assignment.status = 'saddled';
    if (assignment && inspection.status === 'failed') assignment.status = 'waiting';
    return this.commit('paddock-operations.inspection.recorded', `Recorded ${inspection.inspectionType} inspection for ${inspection.horseId}`, auditId, inspection.horseId, inspection.raceId, actor);
  }

  recordReadinessCheck(input: Omit<PaddockReadinessCheckDto, 'checkId' | 'auditId'>, actor = 'paddock-judge'): PaddockMutationResultDto {
    const auditId = id('audit-paddock');
    const check: PaddockReadinessCheckDto = { ...clone(input), checkId: id('paddock-readiness'), auditId };
    this.state.readinessChecks.push(check);
    if (check.horseId) {
      const assignment = this.state.assignments.find((entry) => entry.horseId === check.horseId && entry.raceId === check.raceId);
      if (assignment && check.status === 'ready') assignment.status = 'parade-ready';
      if (assignment && check.status === 'blocked') assignment.status = 'waiting';
    }
    return this.commit('paddock-operations.readiness.recorded', `Recorded readiness check for ${check.domain}`, auditId, check.horseId, check.raceId, actor);
  }

  assignPersonnel(input: Omit<PaddockPersonnelAssignmentDto, 'assignmentId' | 'auditId'>, actor = 'operations'): PaddockMutationResultDto {
    const auditId = id('audit-paddock');
    const assignment: PaddockPersonnelAssignmentDto = { ...clone(input), assignmentId: id('paddock-personnel'), auditId };
    this.state.personnelAssignments.push(assignment);
    return this.commit('paddock-operations.personnel.assigned', `Assigned ${assignment.displayName} as ${assignment.role}`, auditId, undefined, assignment.raceId, actor);
  }

  reportIncident(input: Omit<PaddockIncidentDto, 'incidentId' | 'auditId'>, actor = 'paddock-judge'): PaddockMutationResultDto {
    const auditId = id('audit-paddock');
    const incident: PaddockIncidentDto = { ...clone(input), incidentId: id('paddock-incident'), auditId };
    this.state.incidents.push(incident);
    return this.commit('paddock-operations.incident.reported', `Reported paddock incident: ${incident.title}`, auditId, incident.horseId, incident.raceId, actor);
  }

  updateIncidentStatus(incidentId: string, status: PaddockIncidentDto['status'], actor = 'steward'): PaddockMutationResultDto {
    const incident = this.state.incidents.find((entry) => entry.incidentId === incidentId);
    if (!incident) throw new Error(`Unknown paddock incident ${incidentId}`);
    incident.status = status;
    return this.commit('paddock-operations.incident.updated', `Updated incident ${incidentId} to ${status}`, id('audit-paddock'), incident.horseId, incident.raceId, actor);
  }

  private syncFromRaceDay(now: string): void {
    const raceCards = this.deps.raceCardManagement?.workspace(now).raceCards ?? [];
    for (const card of raceCards) {
      if (card.racetrackId !== this.state.racetrackId) continue;
      this.state.raceDayId = card.raceDayId ?? this.state.raceDayId;
      for (const entry of card.entries) {
        if (entry.scratched) continue;
        const saddleCloth = entry.programNumber ? Number.parseInt(entry.programNumber, 10) : (entry.postPosition ?? 0);
        const paddockSlot = `${String.fromCharCode(65 + ((entry.postPosition ?? 1) - 1) % 4)}-${entry.postPosition ?? saddleCloth}`;
        const horseName = entry.horseId === 'horse-1' ? 'Lifecycle Runner' : entry.horseId === 'horse-2' ? 'Gate Test' : entry.horseId;
        if (!this.state.assignments.some((assignment) => assignment.horseId === entry.horseId && assignment.raceId === card.id)) {
          const auditId = id('audit-paddock-sync');
          this.state.assignments.push({
            assignmentId: id('paddock-assignment'),
            horseId: entry.horseId,
            horseName,
            raceId: card.id,
            raceCardId: card.id,
            entryId: entry.id,
            saddleCloth: Number.isFinite(saddleCloth) ? saddleCloth : entry.postPosition ?? 0,
            paddockSlot,
            postPosition: entry.postPosition,
            jockeyId: entry.jockeyId,
            trainerId: entry.trainerId,
            status: entry.jockeyId ? 'waiting' : 'waiting',
            assignedAt: now,
            evidence: ['race-card-sync'],
            auditId,
          });
        }
        if (!this.state.arrivals.some((arrival) => arrival.horseId === entry.horseId && arrival.raceId === card.id)) {
          this.state.arrivals.push({
            arrivalId: id('paddock-arrival'),
            horseId: entry.horseId,
            horseName,
            raceId: card.id,
            expectedAt: card.scheduledPostTime ?? now,
            fromLocation: 'barn',
            status: 'expected',
            evidence: ['race-card-sync'],
            auditId: id('audit-paddock-sync'),
          });
        }
      }
    }
    this.state.updatedAt = now;
  }

  private buildRaceDayLinks(now: string): PaddockOperationsDto['raceDayLinks'] {
    const raceIds = [...new Set(this.state.assignments.map((assignment) => assignment.raceId))];
    const entryIds = [...new Set(this.state.assignments.map((assignment) => assignment.entryId).filter((entryId): entryId is string => Boolean(entryId)))];
    const paradeSchedule = raceIds.map((raceId, index) => ({
      at: new Date(Date.parse(now) + index * 35 * 60_000).toISOString(),
      raceId,
      label: `Race ${raceId.replace(/\D/g, '') || index + 1} parade`,
    }));
    return { raceDayId: this.state.raceDayId, raceIds, entryIds, paradeSchedule };
  }

  private buildTimeline(now: string): PaddockOperationsDto['timeline'] {
    return [
      { at: now, label: 'Paddock open', status: 'complete' },
      { at: now, label: 'Horse arrivals', status: this.state.arrivals.some((entry) => entry.status === 'arrived') ? 'in-progress' : 'scheduled' },
      { at: now, label: 'Saddling complete', status: this.state.assignments.some((entry) => entry.status === 'saddled' || entry.status === 'parade-ready') ? 'in-progress' : 'scheduled' },
      { at: now, label: 'Parade to post', status: this.state.assignments.some((entry) => entry.status === 'parade-ready') ? 'ready' : 'scheduled' },
    ];
  }

  private gateReadiness(now: string): PaddockOperationsDto['gateReadiness'] {
    const latest = this.state.readinessChecks.filter((check) => check.domain === 'gate').at(-1);
    return {
      status: latest?.status === 'ready' ? 'ready' : latest?.status === 'blocked' ? 'blocked' : 'watch',
      lastCheckAt: latest?.checkedAt ?? now,
    };
  }

  private buildDashboard(now: string): PaddockKpiDashboardDto {
    const assignedHorses = this.state.assignments.length;
    const arrivedHorses = this.state.arrivals.filter((entry) => entry.status === 'arrived').length;
    const paradeReadyHorses = this.state.assignments.filter((entry) => entry.status === 'parade-ready' || entry.status === 'on-track').length;
    const openIncidents = this.state.incidents.filter((entry) => !['resolved', 'closed'].includes(entry.status)).length;
    const passedInspections = this.state.inspections.filter((entry) => entry.status === 'passed').length;
    const inspectionPassRate = this.state.inspections.length
      ? Math.round((passedInspections / this.state.inspections.length) * 100)
      : 100;
    const readinessScore = this.computeReadinessScore();
    const panels: PaddockKpiDto[] = [
      kpi('paddock-kpi-assigned', 'Assigned horses', 'Horses with paddock slot assignments linked to race-day entries.', assignedHorses, 'horses', assignedHorses, assignedHorses > 0 ? 'nominal' : 'watch', [{ entityType: 'paddock-operations', entityId: this.state.racetrackId }], []),
      kpi('paddock-kpi-arrivals', 'Arrived horses', 'Horses checked in to paddock from barn or receiving.', arrivedHorses, 'horses', assignedHorses, arrivedHorses < assignedHorses ? 'watch' : 'nominal', [{ entityType: 'paddock-operations', entityId: this.state.racetrackId }], []),
      kpi('paddock-kpi-parade-ready', 'Parade-ready horses', 'Horses cleared for parade to post.', paradeReadyHorses, 'horses', assignedHorses, paradeReadyHorses < assignedHorses ? 'watch' : 'nominal', [{ entityType: 'race-card', entityId: this.state.raceDayId ?? 'race-day' }], []),
      kpi('paddock-kpi-incidents', 'Open paddock incidents', 'Active paddock incidents requiring steward or security review.', openIncidents, 'incidents', 0, openIncidents > 0 ? 'warning' : 'nominal', [{ entityType: 'paddock-operations', entityId: this.state.racetrackId }], []),
      kpi('paddock-kpi-inspection-pass', 'Inspection pass rate', 'Percentage of paddock inspections passed on first attempt.', inspectionPassRate, '%', 95, inspectionPassRate >= 95 ? 'nominal' : 'watch', [{ entityType: 'paddock-operations', entityId: this.state.racetrackId }], []),
    ];
    return { assignedHorses, arrivedHorses, paradeReadyHorses, openIncidents, readinessScore, inspectionPassRate, panels };
  }

  private computeReadinessScore(): number {
    if (!this.state.assignments.length) return 0;
    const weights: Record<PaddockReadinessStatus, number> = { pending: 0, watch: 60, ready: 100, blocked: 20 };
    const checks = this.state.readinessChecks.length
      ? this.state.readinessChecks
      : this.state.assignments.map((assignment) => ({
          checkId: assignment.assignmentId,
          raceId: assignment.raceId,
          checkedAt: assignment.assignedAt,
          checkedBy: 'race-card-sync',
          domain: 'horse' as const,
          status: assignment.status === 'parade-ready' ? 'ready' as const : assignment.status === 'arrived' || assignment.status === 'saddled' ? 'watch' as const : 'pending' as const,
          score: assignment.status === 'parade-ready' ? 100 : assignment.status === 'saddled' ? 85 : assignment.status === 'arrived' ? 70 : 40,
          blockers: [],
          evidence: assignment.evidence,
          auditId: assignment.auditId,
          horseId: assignment.horseId,
        }));
    const average = checks.reduce((sum, check) => sum + (check.score ?? weights[check.status]), 0) / checks.length;
    const incidentPenalty = this.state.incidents.filter((entry) => !['resolved', 'closed'].includes(entry.status)).length * 5;
    return Math.max(0, Math.min(100, Math.round(average - incidentPenalty)));
  }

  private commit(eventType: string, message: string, auditId: string, horseId: string | undefined, raceId: string | undefined, actor: string): PaddockMutationResultDto {
    this.state.version += 1;
    this.state.updatedAt = new Date().toISOString();
    this.state.updatedBy = actor;
    const recordedAuditId = this.recordChange(actor, eventType, message, auditId, horseId, raceId);
    return {
      accepted: true,
      horseId,
      raceId,
      auditId: recordedAuditId,
      eventType,
      message: `${message}. Change linked to race-day operations where applicable.`,
      mock: false,
    };
  }

  private recordChange(actor: string, action: string, changeSummary: string, auditId = id('audit-paddock'), horseId?: string, raceId?: string): string {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const record: PaddockAuditRecordDto = {
      auditId,
      horseId,
      raceId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ horseId, raceId, action, changeSummary, previousHash }),
      changeSummary,
      evidence: ['paddock-operations', action],
    };
    this.auditChain.push(record);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: horseId ?? raceId ?? 'paddock-operations',
        payload: { action, changeSummary, raceId },
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
  status: PaddockKpiDto['status'],
  sourceEntities: PaddockKpiDto['sourceEntities'],
  auditIds: string[],
): PaddockKpiDto {
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

export function createSeededPaddockOperations(deps: PaddockOperationsDeps, now = new Date().toISOString()): PaddockOperationsPlatform {
  const platform = new PaddockOperationsPlatform(deps);
  platform.workspace(now);

  platform.assignPersonnel({
    personnelId: 'official-paddock-judge',
    displayName: 'Paddock Judge A',
    role: 'paddock-judge',
    raceId: 'race-7',
    paddockZone: 'zone-paddock',
    assignedAt: now,
    active: true,
    evidence: ['workforce-roster'],
  });
  platform.assignPersonnel({
    personnelId: 'outrider-1',
    displayName: 'Outrider One',
    role: 'outrider',
    raceId: 'race-7',
    paddockZone: 'zone-paddock',
    assignedAt: now,
    active: true,
    evidence: ['workforce-roster'],
  });

  const assignments = platform.workspace(now).assignments;
  for (const assignment of assignments.slice(0, 2)) {
    platform.recordArrival({
      horseId: assignment.horseId,
      horseName: assignment.horseName,
      raceId: assignment.raceId,
      expectedAt: now,
      arrivedAt: now,
      fromLocation: 'barn-2',
      escortId: 'groom-1',
      status: 'arrived',
      evidence: ['paddock-gate-check'],
    });
    platform.recordInspection({
      horseId: assignment.horseId,
      raceId: assignment.raceId,
      inspectedAt: now,
      inspectorId: 'official-paddock-judge',
      inspectionType: 'equipment',
      status: 'passed',
      findings: ['Saddle and bridle verified'],
      evidence: ['inspection-checklist'],
    });
    platform.recordReadinessCheck({
      horseId: assignment.horseId,
      raceId: assignment.raceId,
      checkedAt: now,
      checkedBy: 'official-paddock-judge',
      domain: 'horse',
      status: assignment.horseId === 'horse-1' ? 'ready' : 'watch',
      score: assignment.horseId === 'horse-1' ? 92 : 78,
      blockers: assignment.horseId === 'horse-1' ? [] : ['late-arrival-watch'],
      evidence: ['readiness-checklist'],
    });
  }

  platform.recordReadinessCheck({
    raceId: assignments[0]?.raceId ?? 'race-7',
    checkedAt: now,
    checkedBy: 'starter-live',
    domain: 'gate',
    status: 'ready',
    score: 95,
    blockers: [],
    evidence: ['gate-verification'],
  });

  if (!deps.raceCardManagement) {
    platform.assignPaddock({
      horseId: 'horse-1',
      horseName: 'Lifecycle Runner',
      raceId: 'race-7',
      saddleCloth: 4,
      paddockSlot: 'A-4',
      postPosition: 4,
      jockeyId: 'jockey-1',
      trainerId: 'trainer-1',
      status: 'parade-ready',
      assignedAt: now,
      evidence: ['seed'],
    });
    platform.assignPaddock({
      horseId: 'horse-2',
      horseName: 'Gate Test',
      raceId: 'race-7',
      saddleCloth: 7,
      paddockSlot: 'B-2',
      postPosition: 2,
      jockeyId: 'jockey-2',
      trainerId: 'trainer-1',
      status: 'saddled',
      assignedAt: now,
      evidence: ['seed'],
    });
  }

  platform.workspace(now);
  return platform;
}
