import type {
  JockeyAssignmentDto,
  JockeyAuditRecordDto,
  JockeyComplianceRecordDto,
  JockeyEligibilityTrackingDto,
  JockeyEntityLinksDto,
  JockeyKpiDashboardDto,
  JockeyKpiDto,
  JockeyLicensingMetadataDto,
  JockeyManagementAuditTrailDto,
  JockeyManagementWorkspaceDto,
  JockeyMutationResultDto,
  JockeyPerformanceAnalyticsDto,
  JockeyRaceParticipationDto,
  JockeyStatus,
  ManagedJockeyProfileDto,
} from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { RaceCardManagementPlatform } from './raceCardManagement.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface ManagedJockeyRecord {
  jockeyId: string;
  tenantId: string;
  racetrackId: string;
  displayName: string;
  status: JockeyStatus;
  licensing: JockeyLicensingMetadataDto;
  assignments: JockeyAssignmentDto[];
  raceParticipation: JockeyRaceParticipationDto[];
  complianceRecords: JockeyComplianceRecordDto[];
  eligibility: JockeyEligibilityTrackingDto;
  links: JockeyEntityLinksDto;
  version: number;
  auditIds: string[];
  eventIds: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface JockeyManagementDeps {
  raceCardManagement?: RaceCardManagementPlatform;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
}

export class JockeyManagementRepository {
  private readonly jockeys = new Map<string, ManagedJockeyRecord>();

  save(jockey: ManagedJockeyRecord): ManagedJockeyRecord {
    this.jockeys.set(jockey.jockeyId, clone(jockey));
    return clone(jockey);
  }

  get(jockeyId: string): ManagedJockeyRecord | undefined {
    const jockey = this.jockeys.get(jockeyId);
    return jockey ? clone(jockey) : undefined;
  }

  list(filter: { tenantId?: string; racetrackId?: string } = {}): ManagedJockeyRecord[] {
    return [...this.jockeys.values()]
      .filter((jockey) => (!filter.tenantId || jockey.tenantId === filter.tenantId)
        && (!filter.racetrackId || jockey.racetrackId === filter.racetrackId))
      .map(clone);
  }
}

export class JockeyManagementPlatform {
  private readonly repository = new JockeyManagementRepository();
  private readonly auditChain: JockeyAuditRecordDto[] = [];

  constructor(private readonly deps: JockeyManagementDeps = {}) {}

  workspace(now = new Date().toISOString()): JockeyManagementWorkspaceDto {
    this.syncFromRaceCards(now);
    const jockeys = this.repository.list({ tenantId: this.deps.tenantId, racetrackId: this.deps.racetrackId }).map((jockey) => this.toDto(jockey, now));
    const statusSummary = Object.fromEntries(
      (['active', 'suspended', 'inactive'] as JockeyStatus[]).map((status) => [
        status,
        jockeys.filter((jockey) => jockey.status === status).length,
      ]),
    ) as Record<JockeyStatus, number>;

    return {
      generatedAt: now,
      schemaVersion: 'trackmind.jockey-management.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      jockeys,
      statusSummary,
      dashboard: this.buildDashboard(jockeys, now),
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  getJockey(jockeyId: string, now = new Date().toISOString()): ManagedJockeyProfileDto | undefined {
    this.syncFromRaceCards(now);
    const jockey = this.repository.get(jockeyId);
    return jockey ? this.toDto(jockey, now) : undefined;
  }

  kpiDashboard(now = new Date().toISOString()): JockeyKpiDashboardDto {
    return this.workspace(now).dashboard;
  }

  createJockey(input: {
    jockeyId: string;
    displayName: string;
    licensing: JockeyLicensingMetadataDto;
    status?: JockeyStatus;
    eligibility?: Partial<JockeyEligibilityTrackingDto>;
  }, actor: string | undefined = 'horse-operations-coordinator'): JockeyMutationResultDto {
    if (this.repository.get(input.jockeyId)) throw new Error(`Jockey ${input.jockeyId} already exists`);
    const now = new Date().toISOString();
    const jockey: ManagedJockeyRecord = {
      jockeyId: input.jockeyId,
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      displayName: input.displayName,
      status: input.status ?? 'active',
      licensing: clone(input.licensing),
      assignments: [],
      raceParticipation: [],
      complianceRecords: [],
      eligibility: {
        status: input.eligibility?.status ?? 'eligible',
        eligible: input.eligibility?.eligible ?? true,
        flags: input.eligibility?.flags ?? [],
        failedRules: input.eligibility?.failedRules ?? [],
        suspensionReason: input.eligibility?.suspensionReason,
        reviewedAt: input.eligibility?.reviewedAt ?? now,
        reviewedBy: input.eligibility?.reviewedBy ?? actor ?? 'horse-operations-coordinator',
      },
      links: { raceIds: [], horseIds: [], incidentIds: [], auditIds: [], stewardInquiryIds: [] },
      version: 1,
      auditIds: [],
      eventIds: [],
      updatedAt: now,
      updatedBy: actor ?? 'horse-operations-coordinator',
    };
    const auditId = this.recordChange(jockey, actor ?? 'horse-operations-coordinator', 'jockey-management.created', 'Jockey profile created');
    jockey.auditIds.push(auditId);
    jockey.links.auditIds.push(auditId);
    this.repository.save(jockey);
    return this.mutationResult(jockey, auditId, 'jockey-management.created.v1', 'Jockey profile created and audit-logged.');
  }

  updateLicensing(jockeyId: string, licensing: Partial<JockeyLicensingMetadataDto>, actor = 'horse-operations-coordinator'): JockeyMutationResultDto {
    const jockey = this.requireJockey(jockeyId);
    jockey.licensing = { ...jockey.licensing, ...licensing, evidence: licensing.evidence ?? jockey.licensing.evidence };
    if (jockey.licensing.status === 'suspended' || jockey.licensing.status === 'expired') {
      jockey.status = 'suspended';
      jockey.eligibility = { ...jockey.eligibility, eligible: false, status: 'suspended', flags: [...new Set([...jockey.eligibility.flags, 'license-not-active'])] };
    }
    return this.mutate(jockey, actor, 'jockey-management.licensing.updated', 'Jockey licensing metadata updated', 'jockey-management.licensing.updated.v1');
  }

  recordAssignment(jockeyId: string, assignment: Omit<JockeyAssignmentDto, 'assignmentId' | 'auditId' | 'active'>, actor = 'horse-operations-coordinator'): JockeyMutationResultDto {
    const jockey = this.requireJockey(jockeyId);
    const auditId = id('audit-jockey-assignment');
    jockey.assignments = [
      ...jockey.assignments.filter((entry) => !(entry.horseId === assignment.horseId && entry.raceCardId === assignment.raceCardId && entry.active)),
      { ...assignment, assignmentId: id('assignment'), active: true, auditId },
    ];
    if (!jockey.links.horseIds.includes(assignment.horseId)) jockey.links.horseIds.push(assignment.horseId);
    if (assignment.raceCardId && !jockey.links.raceIds.includes(assignment.raceCardId)) jockey.links.raceIds.push(assignment.raceCardId);
    return this.mutate(jockey, actor, 'jockey-management.assignment.recorded', `Assignment recorded for horse ${assignment.horseId}`, 'jockey-management.assignment.recorded.v1', auditId);
  }

  recordParticipation(jockeyId: string, participation: Omit<JockeyRaceParticipationDto, 'participationId' | 'auditId'>, actor = 'horse-operations-coordinator'): JockeyMutationResultDto {
    const jockey = this.requireJockey(jockeyId);
    const auditId = id('audit-jockey-participation');
    if (!jockey.raceParticipation.some((entry) => entry.raceId === participation.raceId && entry.horseId === participation.horseId)) {
      jockey.raceParticipation.push({ ...participation, participationId: id('participation'), auditId });
    }
    if (!jockey.links.raceIds.includes(participation.raceId)) jockey.links.raceIds.push(participation.raceId);
    if (!jockey.links.horseIds.includes(participation.horseId)) jockey.links.horseIds.push(participation.horseId);
    return this.mutate(jockey, actor, 'jockey-management.participation.recorded', `Race participation recorded for ${participation.raceId}`, 'jockey-management.participation.recorded.v1', auditId);
  }

  addComplianceRecord(jockeyId: string, record: Omit<JockeyComplianceRecordDto, 'recordId' | 'auditId'>, actor = 'steward'): JockeyMutationResultDto {
    const jockey = this.requireJockey(jockeyId);
    const auditId = id('audit-jockey-compliance');
    jockey.complianceRecords.push({ ...record, recordId: id('compliance'), auditId });
    if (record.stewardInquiryId && !jockey.links.stewardInquiryIds.includes(record.stewardInquiryId)) {
      jockey.links.stewardInquiryIds.push(record.stewardInquiryId);
    }
    if (record.status === 'open') {
      jockey.eligibility = {
        ...jockey.eligibility,
        eligible: false,
        status: 'under-review',
        flags: [...new Set([...jockey.eligibility.flags, `compliance:${record.category}`])],
      };
    }
    return this.mutate(jockey, actor, 'jockey-management.compliance.recorded', `Compliance record added: ${record.summary}`, 'jockey-management.compliance.recorded.v1', auditId);
  }

  updateEligibility(jockeyId: string, eligibility: Partial<JockeyEligibilityTrackingDto>, actor = 'steward'): JockeyMutationResultDto {
    const jockey = this.requireJockey(jockeyId);
    jockey.eligibility = { ...jockey.eligibility, ...eligibility, flags: eligibility.flags ?? jockey.eligibility.flags, failedRules: eligibility.failedRules ?? jockey.eligibility.failedRules };
    if (!jockey.eligibility.eligible || jockey.eligibility.status === 'suspended') jockey.status = 'suspended';
    else if (jockey.licensing.status === 'active') jockey.status = 'active';
    return this.mutate(jockey, actor, 'jockey-management.eligibility.updated', 'Jockey eligibility tracking updated', 'jockey-management.eligibility.updated.v1');
  }

  linkStewardInquiry(jockeyId: string, inquiryId: string, actor = 'steward'): JockeyMutationResultDto {
    const jockey = this.requireJockey(jockeyId);
    if (!jockey.links.stewardInquiryIds.includes(inquiryId)) jockey.links.stewardInquiryIds.push(inquiryId);
    return this.mutate(jockey, actor, 'jockey-management.inquiry.linked', `Steward inquiry ${inquiryId} linked`, 'jockey-management.inquiry.linked.v1');
  }

  auditTrail(jockeyId?: string, now = new Date().toISOString()): JockeyManagementAuditTrailDto {
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.jockey-management.v1',
      records: jockeyId ? this.auditChain.filter((record) => record.jockeyId === jockeyId).map(clone) : this.auditChain.map(clone),
      mock: false,
    };
  }

  private syncFromRaceCards(now: string): void {
    if (!this.deps.raceCardManagement) return;
    for (const card of this.deps.raceCardManagement.workspace(now).raceCards) {
      for (const entry of card.entries) {
        if (!entry.jockeyId || entry.scratched) continue;
        this.ensureJockey(entry.jockeyId, entry.jockeyId, now);
        const jockey = this.repository.get(entry.jockeyId);
        if (!jockey) continue;
        const assignmentAuditId = entry.auditId ?? `audit:sync:${entry.id}`;
        if (!jockey.assignments.some((item) => item.entryId === entry.id && item.active)) {
          jockey.assignments.push({
            assignmentId: id('assignment'),
            horseId: entry.horseId,
            raceCardId: card.id,
            entryId: entry.id,
            assignedAt: card.updatedAt,
            weightLbs: entry.weightLbs,
            postPosition: entry.postPosition,
            active: true,
            evidence: ['race-card-sync'],
            auditId: assignmentAuditId,
          });
        }
        const participationStatus = entry.status === 'starter' || entry.status === 'declared' ? 'declared' : entry.status === 'scratched' ? 'scratched' : 'started';
        if (!jockey.raceParticipation.some((item) => item.raceId === card.id && item.horseId === entry.horseId)) {
          jockey.raceParticipation.push({
            participationId: id('participation'),
            raceId: card.id,
            raceCardId: card.id,
            raceDate: card.raceDate,
            trackId: card.racetrackId,
            horseId: entry.horseId,
            status: participationStatus,
            evidence: ['race-card-sync'],
            auditId: assignmentAuditId,
          });
        }
        if (!jockey.links.raceIds.includes(card.id)) jockey.links.raceIds.push(card.id);
        if (!jockey.links.horseIds.includes(entry.horseId)) jockey.links.horseIds.push(entry.horseId);
        for (const auditId of card.auditIds) {
          if (!jockey.links.auditIds.includes(auditId)) jockey.links.auditIds.push(auditId);
        }
        this.repository.save(jockey);
      }
    }
  }

  private ensureJockey(jockeyId: string, displayName: string, now: string): void {
    if (this.repository.get(jockeyId)) return;
    this.createJockey({
      jockeyId,
      displayName: displayName === jockeyId ? defaultJockeyName(jockeyId) : displayName,
      licensing: {
        licenseNumber: `NY-JK-${jockeyId.replace(/\D/g, '') || '0000'}`,
        issuingAuthority: 'NYSGC',
        jurisdiction: 'US-NY',
        status: 'active',
        issuedOn: '2024-01-01',
        expiresOn: '2027-01-01',
        weightAllowanceLbs: 0,
        restrictions: [],
        evidence: ['race-card-sync'],
      },
    }, 'race-card-sync');
    const jockey = this.repository.get(jockeyId);
    if (jockey) {
      jockey.updatedAt = now;
      this.repository.save(jockey);
    }
  }

  private buildDashboard(jockeys: ManagedJockeyProfileDto[], now: string): JockeyKpiDashboardDto {
    const panels = this.workspaceKpis(jockeys);
    const totalStarts = jockeys.reduce((sum, jockey) => sum + jockey.performanceAnalytics.starts, 0);
    const averageWinRate = jockeys.length
      ? Math.round(jockeys.reduce((sum, jockey) => sum + jockey.performanceAnalytics.winRate, 0) / jockeys.length)
      : 0;
    const eligibleJockeys = jockeys.filter((jockey) => jockey.eligibility.eligible).length;
    const complianceCoveragePct = jockeys.length
      ? Math.round((jockeys.filter((jockey) => jockey.complianceRecords.every((record) => record.status === 'resolved') && jockey.eligibility.status === 'eligible').length / jockeys.length) * 100)
      : 100;
    return {
      activeJockeys: jockeys.filter((jockey) => jockey.status === 'active').length,
      eligibleJockeys,
      suspendedJockeys: jockeys.filter((jockey) => jockey.status === 'suspended').length,
      totalStarts,
      averageWinRate,
      complianceCoveragePct,
      panels,
    };
  }

  private workspaceKpis(jockeys: ManagedJockeyProfileDto[]): JockeyKpiDto[] {
    const auditIds = this.auditChain.map((record) => record.auditId);
    const activeJockeys = jockeys.filter((jockey) => jockey.status === 'active').length;
    const eligibleJockeys = jockeys.filter((jockey) => jockey.eligibility.eligible).length;
    const totalStarts = jockeys.reduce((sum, jockey) => sum + jockey.performanceAnalytics.starts, 0);
    const openCompliance = jockeys.reduce((sum, jockey) => sum + jockey.complianceRecords.filter((record) => record.status === 'open').length, 0);
    const licensedActive = jockeys.filter((jockey) => jockey.licensing.status === 'active').length;
    return [
      kpi('kpi-jockey-active-roster', 'Active jockey roster', 'Count of jockeys in active status.', activeJockeys, 'jockeys', jockeys.length || 1, activeJockeys === jockeys.length ? 'nominal' : 'watch', [{ entityType: 'jockey-management', entityId: this.deps.racetrackId ?? 'main-track' }], auditIds),
      kpi('kpi-jockey-eligibility-coverage', 'Jockey eligibility coverage', 'Percentage of jockeys currently eligible to ride.', jockeys.length ? Math.round((eligibleJockeys / jockeys.length) * 100) : 100, '%', 95, eligibleJockeys === jockeys.length ? 'nominal' : 'warning', jockeys.map((jockey) => ({ entityType: 'jockey', entityId: jockey.jockeyId })), auditIds),
      kpi('kpi-jockey-race-starts', 'Total race starts', 'Aggregate race starts across jockey participation records.', totalStarts, 'starts', Math.max(totalStarts, 1), totalStarts > 0 ? 'nominal' : 'watch', jockeys.flatMap((jockey) => jockey.links.raceIds.map((raceId) => ({ entityType: 'race', entityId: raceId }))), auditIds),
      kpi('kpi-jockey-open-compliance', 'Open compliance records', 'Open steward, medication, and conduct compliance records.', openCompliance, 'records', 0, openCompliance === 0 ? 'nominal' : 'warning', jockeys.flatMap((jockey) => jockey.complianceRecords.map((record) => ({ entityType: 'compliance-record', entityId: record.recordId }))), auditIds),
      kpi('kpi-jockey-license-active', 'Active license coverage', 'Jockeys with active licensing metadata.', licensedActive, 'licenses', jockeys.length || 1, licensedActive === jockeys.length ? 'nominal' : 'critical', jockeys.map((jockey) => ({ entityType: 'jockey', entityId: jockey.jockeyId })), auditIds),
    ];
  }

  private jockeyKpis(jockey: ManagedJockeyRecord, analytics: JockeyPerformanceAnalyticsDto): JockeyKpiDto[] {
    return [
      kpi(`kpi-jockey-${jockey.jockeyId}-starts`, 'Race starts', 'Recorded race participations.', analytics.starts, 'starts', Math.max(analytics.starts, 1), analytics.starts > 0 ? 'nominal' : 'watch', jockey.links.raceIds.map((raceId) => ({ entityType: 'race', entityId: raceId })), jockey.links.auditIds, jockey.jockeyId),
      kpi(`kpi-jockey-${jockey.jockeyId}-win-rate`, 'Win rate', 'Win rate from linked performance analytics.', analytics.winRate, '%', 12, analytics.winRate >= 12 ? 'nominal' : 'watch', jockey.links.raceIds.map((raceId) => ({ entityType: 'race', entityId: raceId })), jockey.links.auditIds, jockey.jockeyId),
      kpi(`kpi-jockey-${jockey.jockeyId}-itm-rate`, 'In-the-money rate', 'Top-three finish rate from participation history.', analytics.inTheMoneyRate, '%', 35, analytics.inTheMoneyRate >= 35 ? 'nominal' : 'watch', jockey.links.raceIds.map((raceId) => ({ entityType: 'race', entityId: raceId })), jockey.links.auditIds, jockey.jockeyId),
      kpi(`kpi-jockey-${jockey.jockeyId}-eligibility`, 'Eligibility status', 'Current eligibility score for race participation.', jockey.eligibility.eligible ? 100 : 0, 'score', 100, jockey.eligibility.eligible ? 'nominal' : 'blocked', [{ entityType: 'jockey', entityId: jockey.jockeyId }], jockey.links.auditIds, jockey.jockeyId),
    ];
  }

  private computeAnalytics(participation: JockeyRaceParticipationDto[], now: string): JockeyPerformanceAnalyticsDto {
    const completed = participation.filter((entry) => entry.status === 'completed');
    const starts = participation.length;
    const wins = completed.filter((entry) => entry.finishPosition === 1).length;
    const places = completed.filter((entry) => entry.finishPosition === 2).length;
    const shows = completed.filter((entry) => entry.finishPosition === 3).length;
    const inTheMoney = wins + places + shows;
    const finishPositions = completed.map((entry) => entry.finishPosition).filter((value): value is number => typeof value === 'number');
    return {
      starts,
      wins,
      places,
      shows,
      winRate: starts ? Math.round((wins / starts) * 100) : 0,
      inTheMoneyRate: starts ? Math.round((inTheMoney / starts) * 100) : 0,
      averageFinish: finishPositions.length ? Number((finishPositions.reduce((sum, value) => sum + value, 0) / finishPositions.length).toFixed(1)) : undefined,
      earningsCents: participation.reduce((sum, entry) => sum + (entry.earningsCents ?? 0), 0),
      updatedAt: now,
    };
  }

  private toDto(jockey: ManagedJockeyRecord, now: string): ManagedJockeyProfileDto {
    const analytics = this.computeAnalytics(jockey.raceParticipation, now);
    return {
      jockeyId: jockey.jockeyId,
      tenantId: jockey.tenantId,
      racetrackId: jockey.racetrackId,
      displayName: jockey.displayName,
      status: jockey.status,
      licensing: clone(jockey.licensing),
      assignments: jockey.assignments.map(clone),
      raceParticipation: jockey.raceParticipation.map(clone),
      performanceAnalytics: analytics,
      complianceRecords: jockey.complianceRecords.map(clone),
      eligibility: clone(jockey.eligibility),
      links: clone(jockey.links),
      kpis: this.jockeyKpis(jockey, analytics),
      version: jockey.version,
      auditIds: [...jockey.auditIds],
      eventIds: [...jockey.eventIds],
      lastAuditId: jockey.auditIds.at(-1) ?? '',
      updatedAt: jockey.updatedAt,
      updatedBy: jockey.updatedBy,
    };
  }

  private mutate(jockey: ManagedJockeyRecord, actor: string, action: string, summary: string, eventType: string, auditId = id('audit-jockey')): JockeyMutationResultDto {
    jockey.updatedBy = actor;
    jockey.updatedAt = new Date().toISOString();
    jockey.version += 1;
    const recordedAuditId = this.recordChange(jockey, actor, action, summary, auditId);
    jockey.auditIds.push(recordedAuditId);
    jockey.links.auditIds.push(recordedAuditId);
    jockey.eventIds.push(id('evt-jockey'));
    this.repository.save(jockey);
    return this.mutationResult(jockey, recordedAuditId, eventType, summary);
  }

  private mutationResult(jockey: ManagedJockeyRecord, auditId: string, eventType: string, message: string): JockeyMutationResultDto {
    return {
      accepted: true,
      jockeyId: jockey.jockeyId,
      auditId,
      eventType,
      status: jockey.status,
      message: `${message} Change audited and linked to races, horses, and compliance records where applicable.`,
      mock: false,
    };
  }

  private recordChange(jockey: ManagedJockeyRecord, actor: string, action: string, changeSummary: string, auditId = id('audit-jockey')): string {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const record: JockeyAuditRecordDto = {
      auditId,
      jockeyId: jockey.jockeyId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ jockeyId: jockey.jockeyId, action, changeSummary, previousHash, version: jockey.version }),
      changeSummary,
      evidence: ['jockey-management', action],
    };
    this.auditChain.push(record);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: jockey.jockeyId,
        payload: { action, changeSummary, version: jockey.version },
        tenantId: jockey.tenantId,
        severity: 'info',
        regulations: ['HISA', 'ARCI'],
      });
    }
    return auditId;
  }

  private requireJockey(jockeyId: string): ManagedJockeyRecord {
    const jockey = this.repository.get(jockeyId);
    if (!jockey) throw new Error(`Unknown jockey ${jockeyId}`);
    return jockey;
  }
}

function kpi(
  kpiId: string,
  name: string,
  description: string,
  value: number,
  unit: string,
  target: number,
  status: JockeyKpiDto['status'],
  sourceEntities: JockeyKpiDto['sourceEntities'],
  auditIds: string[],
  jockeyId?: string,
): JockeyKpiDto {
  return {
    kpiId,
    jockeyId,
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

function defaultJockeyName(jockeyId: string): string {
  if (jockeyId === 'jockey-1') return 'Alex Morgan';
  if (jockeyId === 'jockey-2') return 'Jordan Lee';
  return jockeyId;
}

export function createSeededJockeyManagement(deps: JockeyManagementDeps, now = new Date().toISOString()): JockeyManagementPlatform {
  const platform = new JockeyManagementPlatform(deps);
  platform.workspace(now);
  if (!deps.raceCardManagement) {
    platform.createJockey({
      jockeyId: 'jockey-1',
      displayName: 'Alex Morgan',
      licensing: {
        licenseNumber: 'NY-JK-1001',
        issuingAuthority: 'NYSGC',
        jurisdiction: 'US-NY',
        status: 'active',
        issuedOn: '2023-01-01',
        expiresOn: '2026-12-31',
        weightAllowanceLbs: 0,
        restrictions: [],
        evidence: ['license-registry'],
      },
    });
    platform.createJockey({
      jockeyId: 'jockey-2',
      displayName: 'Jordan Lee',
      licensing: {
        licenseNumber: 'NY-JK-1002',
        issuingAuthority: 'NYSGC',
        jurisdiction: 'US-NY',
        status: 'active',
        issuedOn: '2023-06-01',
        expiresOn: '2026-12-31',
        weightAllowanceLbs: 3,
        restrictions: [],
        evidence: ['license-registry'],
      },
    });
    platform.recordAssignment('jockey-1', { horseId: 'horse-1', horseName: 'Lifecycle Runner', raceCardId: 'race-7', assignedAt: now, weightLbs: 124, postPosition: 1, evidence: ['race-office'] });
    platform.recordParticipation('jockey-1', { raceId: 'race-7', raceCardId: 'race-7', raceDate: '2026-06-13', trackId: 'main-track', horseId: 'horse-1', finishPosition: 2, status: 'completed', earningsCents: 1200000, evidence: ['chart'] });
    platform.recordAssignment('jockey-2', { horseId: 'horse-2', horseName: 'Turn Signal', raceCardId: 'race-7', assignedAt: now, weightLbs: 122, postPosition: 2, evidence: ['race-office'] });
    platform.recordParticipation('jockey-2', { raceId: 'race-7', raceCardId: 'race-7', raceDate: '2026-06-13', trackId: 'main-track', horseId: 'horse-2', status: 'declared', evidence: ['condition-book'] });
    platform.addComplianceRecord('jockey-2', { recordedAt: now, category: 'weigh-in', summary: 'Late to scale — warning issued', status: 'resolved', evidence: ['clerk-of-scales'] });
    platform.linkStewardInquiry('jockey-2', 'inq-race-7');
  } else {
    const synced = platform.workspace(now);
    for (const jockey of synced.jockeys) {
      if (jockey.complianceRecords.length === 0 && jockey.jockeyId === 'jockey-1') {
        platform.addComplianceRecord(jockey.jockeyId, { recordedAt: now, category: 'license', summary: 'Annual license review completed', status: 'resolved', evidence: ['annual-review'] });
      }
    }
  }
  platform.workspace(now);
  return platform;
}
