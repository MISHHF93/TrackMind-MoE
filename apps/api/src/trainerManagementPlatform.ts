import type {
  ManagedTrainerProfileDto,
  TrainerAuditRecordDto,
  TrainerCompliancePostureDto,
  TrainerEntityLinksDto,
  TrainerHorseAssignmentDto,
  TrainerKpiDto,
  TrainerLicensingMetadataDto,
  TrainerManagementAuditTrailDto,
  TrainerManagementWorkspaceDto,
  TrainerMutationResultDto,
  TrainerPerformanceRecordDto,
  TrainerStableAssignmentDto,
  TrainerStatus,
} from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { CoordinatedBarnOperationsService } from './barnOperations.js';
import type { HorseRegistryPlatform } from './horseRegistryPlatform.js';
import type { RaceCardManagementPlatform } from './raceCardManagement.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface ManagedTrainerRecord {
  trainerId: string;
  tenantId: string;
  racetrackId: string;
  displayName: string;
  status: TrainerStatus;
  licensing: TrainerLicensingMetadataDto;
  stableAssignments: TrainerStableAssignmentDto[];
  horseAssignments: TrainerHorseAssignmentDto[];
  performanceHistory: TrainerPerformanceRecordDto[];
  compliancePosture: TrainerCompliancePostureDto;
  links: TrainerEntityLinksDto;
  version: number;
  auditIds: string[];
  eventIds: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface TrainerManagementDeps {
  horseRegistry?: HorseRegistryPlatform;
  raceCardManagement?: RaceCardManagementPlatform;
  barnOperations?: CoordinatedBarnOperationsService;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
}

export class TrainerManagementRepository {
  private readonly trainers = new Map<string, ManagedTrainerRecord>();

  save(trainer: ManagedTrainerRecord): ManagedTrainerRecord {
    this.trainers.set(trainer.trainerId, clone(trainer));
    return clone(trainer);
  }

  get(trainerId: string): ManagedTrainerRecord | undefined {
    const trainer = this.trainers.get(trainerId);
    return trainer ? clone(trainer) : undefined;
  }

  list(filter: { tenantId?: string; racetrackId?: string } = {}): ManagedTrainerRecord[] {
    return [...this.trainers.values()]
      .filter((trainer) => (!filter.tenantId || trainer.tenantId === filter.tenantId)
        && (!filter.racetrackId || trainer.racetrackId === filter.racetrackId))
      .map(clone);
  }
}

export class TrainerManagementPlatform {
  private readonly repository = new TrainerManagementRepository();
  private readonly auditChain: TrainerAuditRecordDto[] = [];

  constructor(private readonly deps: TrainerManagementDeps = {}) {}

  workspace(now = new Date().toISOString()): TrainerManagementWorkspaceDto {
    this.syncFromSources(now);
    const trainers = this.repository.list({ tenantId: this.deps.tenantId, racetrackId: this.deps.racetrackId }).map((trainer) => this.toDto(trainer, now));
    const statusSummary = Object.fromEntries(
      (['active', 'suspended', 'inactive'] as TrainerStatus[]).map((status) => [
        status,
        trainers.filter((trainer) => trainer.status === status).length,
      ]),
    ) as Record<TrainerStatus, number>;

    return {
      generatedAt: now,
      schemaVersion: 'trackmind.trainer-management.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      trainers,
      statusSummary,
      kpis: this.workspaceKpis(trainers, now),
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  getTrainer(trainerId: string, now = new Date().toISOString()): ManagedTrainerProfileDto | undefined {
    this.syncFromSources(now);
    const trainer = this.repository.get(trainerId);
    return trainer ? this.toDto(trainer, now) : undefined;
  }

  createTrainer(input: {
    trainerId: string;
    displayName: string;
    licensing: TrainerLicensingMetadataDto;
    status?: TrainerStatus;
    compliancePosture?: Partial<TrainerCompliancePostureDto>;
  }, actor = 'racing-secretary'): TrainerMutationResultDto {
    if (this.repository.get(input.trainerId)) throw new Error(`Trainer ${input.trainerId} already exists`);
    const now = new Date().toISOString();
    const trainer: ManagedTrainerRecord = {
      trainerId: input.trainerId,
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      displayName: input.displayName,
      status: input.status ?? 'active',
      licensing: clone(input.licensing),
      stableAssignments: [],
      horseAssignments: [],
      performanceHistory: [],
      compliancePosture: {
        status: input.compliancePosture?.status ?? 'compliant',
        openFindings: input.compliancePosture?.openFindings ?? [],
        lastReviewedAt: input.compliancePosture?.lastReviewedAt ?? now,
        reviewedBy: input.compliancePosture?.reviewedBy ?? actor,
        medicationViolations: input.compliancePosture?.medicationViolations ?? 0,
        welfareFlags: input.compliancePosture?.welfareFlags ?? 0,
        stewardInquiries: input.compliancePosture?.stewardInquiries ?? 0,
        evidence: input.compliancePosture?.evidence ?? ['trainer-registration'],
      },
      links: { raceIds: [], horseIds: [], incidentIds: [], auditIds: [], barnIds: [] },
      version: 1,
      auditIds: [],
      eventIds: [],
      updatedAt: now,
      updatedBy: actor,
    };
    const auditId = this.recordChange(trainer, actor, 'trainer-management.created', 'Trainer profile created');
    trainer.auditIds.push(auditId);
    trainer.links.auditIds.push(auditId);
    this.repository.save(trainer);
    return this.mutationResult(trainer, auditId, 'trainer-management.created.v1', 'Trainer profile created and linked to audit trail.');
  }

  updateLicensing(trainerId: string, licensing: Partial<TrainerLicensingMetadataDto>, actor = 'racing-secretary'): TrainerMutationResultDto {
    const trainer = this.requireTrainer(trainerId);
    trainer.licensing = { ...trainer.licensing, ...licensing, evidence: licensing.evidence ?? trainer.licensing.evidence };
    if (trainer.licensing.status === 'suspended' || trainer.licensing.status === 'expired') trainer.status = 'suspended';
    return this.mutate(trainer, actor, 'trainer-management.licensing.updated', 'Trainer licensing metadata updated', 'trainer-management.licensing.updated.v1');
  }

  assignStable(trainerId: string, assignment: Omit<TrainerStableAssignmentDto, 'auditId' | 'active'>, actor = 'racing-secretary'): TrainerMutationResultDto {
    const trainer = this.requireTrainer(trainerId);
    const auditId = id('audit-trainer-stable');
    trainer.stableAssignments = [
      ...trainer.stableAssignments.map((entry) => ({ ...entry, active: false, releasedAt: entry.releasedAt ?? assignment.assignedAt })),
      { ...assignment, active: true, auditId },
    ];
    if (!trainer.links.barnIds.includes(assignment.barnId)) trainer.links.barnIds.push(assignment.barnId);
    return this.mutate(trainer, actor, 'trainer-management.stable.assigned', `Stable ${assignment.barnId} assigned`, 'trainer-management.stable.assigned.v1', auditId);
  }

  assignHorse(trainerId: string, assignment: Omit<TrainerHorseAssignmentDto, 'auditId' | 'active'>, actor = 'racing-secretary'): TrainerMutationResultDto {
    const trainer = this.requireTrainer(trainerId);
    const auditId = id('audit-trainer-horse');
    trainer.horseAssignments = [
      ...trainer.horseAssignments.filter((entry) => entry.horseId !== assignment.horseId),
      { ...assignment, active: true, auditId },
    ];
    if (!trainer.links.horseIds.includes(assignment.horseId)) trainer.links.horseIds.push(assignment.horseId);
    return this.mutate(trainer, actor, 'trainer-management.horse.assigned', `Horse ${assignment.horseId} assigned`, 'trainer-management.horse.assigned.v1', auditId);
  }

  recordPerformance(trainerId: string, record: Omit<TrainerPerformanceRecordDto, 'recordId' | 'auditId'>, actor = 'racing-secretary'): TrainerMutationResultDto {
    const trainer = this.requireTrainer(trainerId);
    const auditId = id('audit-trainer-performance');
    const performance: TrainerPerformanceRecordDto = { ...record, recordId: id('performance'), auditId };
    trainer.performanceHistory = [...trainer.performanceHistory, performance];
    if (!trainer.links.raceIds.includes(record.raceId)) trainer.links.raceIds.push(record.raceId);
    if (!trainer.links.horseIds.includes(record.horseId)) trainer.links.horseIds.push(record.horseId);
    return this.mutate(trainer, actor, 'trainer-management.performance.recorded', `Performance recorded for race ${record.raceId}`, 'trainer-management.performance.recorded.v1', auditId);
  }

  updateCompliancePosture(trainerId: string, posture: Partial<TrainerCompliancePostureDto>, actor = 'compliance-officer'): TrainerMutationResultDto {
    const trainer = this.requireTrainer(trainerId);
    trainer.compliancePosture = { ...trainer.compliancePosture, ...posture, evidence: posture.evidence ?? trainer.compliancePosture.evidence };
    if (trainer.compliancePosture.status === 'suspended') trainer.status = 'suspended';
    return this.mutate(trainer, actor, 'trainer-management.compliance.updated', 'Trainer compliance posture updated', 'trainer-management.compliance.updated.v1');
  }

  linkIncident(trainerId: string, incidentId: string, actor = 'steward'): TrainerMutationResultDto {
    const trainer = this.requireTrainer(trainerId);
    if (!trainer.links.incidentIds.includes(incidentId)) trainer.links.incidentIds.push(incidentId);
    return this.mutate(trainer, actor, 'trainer-management.incident.linked', `Incident ${incidentId} linked`, 'trainer-management.incident.linked.v1');
  }

  auditTrail(trainerId?: string, now = new Date().toISOString()): TrainerManagementAuditTrailDto {
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.trainer-management.v1',
      records: trainerId ? this.auditChain.filter((record) => record.trainerId === trainerId).map(clone) : this.auditChain.map(clone),
      mock: false,
    };
  }

  private syncFromSources(now: string): void {
    this.syncFromHorseRegistry(now);
    this.syncFromRaceCards(now);
    this.syncFromBarnOperations(now);
  }

  private syncFromHorseRegistry(now: string): void {
    if (!this.deps.horseRegistry) return;
    const workspace = this.deps.horseRegistry.workspace(now);
    for (const horse of workspace.horses) {
      const currentTrainer = horse.trainerHistory.find((entry) => !entry.effectiveTo) ?? horse.trainerHistory.at(-1);
      if (!currentTrainer) continue;
      this.ensureTrainerFromHorse(currentTrainer.trainerId, currentTrainer.trainerName, currentTrainer.licenseStatus, now);
      const trainer = this.repository.get(currentTrainer.trainerId);
      if (!trainer) continue;
      if (!trainer.horseAssignments.some((entry) => entry.horseId === horse.identity.horseId && entry.active)) {
        trainer.horseAssignments.push({
          horseId: horse.identity.horseId,
          horseName: horse.identity.name,
          assignedAt: currentTrainer.effectiveFrom,
          active: true,
          evidence: [...currentTrainer.evidence],
          auditId: currentTrainer.auditId,
        });
      }
      if (!trainer.links.horseIds.includes(horse.identity.horseId)) trainer.links.horseIds.push(horse.identity.horseId);
      for (const auditId of horse.auditIds) {
        if (!trainer.links.auditIds.includes(auditId)) trainer.links.auditIds.push(auditId);
      }
      this.repository.save(trainer);
    }
  }

  private syncFromRaceCards(now: string): void {
    if (!this.deps.raceCardManagement) return;
    const workspace = this.deps.raceCardManagement.workspace(now);
    for (const card of workspace.raceCards) {
      for (const entry of card.entries) {
        if (!entry.trainerId || entry.scratched) continue;
        this.ensureTrainerFromRaceEntry(entry.trainerId, now);
        const trainer = this.repository.get(entry.trainerId);
        if (!trainer) continue;
        if (!trainer.links.raceIds.includes(card.id)) trainer.links.raceIds.push(card.id);
        if (!trainer.links.horseIds.includes(entry.horseId)) trainer.links.horseIds.push(entry.horseId);
        this.addPerformanceIfMissing(trainer, {
          raceId: card.id,
          raceDate: card.raceDate,
          trackId: card.racetrackId,
          horseId: entry.horseId,
          finishPosition: undefined,
          status: entry.status === 'starter' || entry.status === 'declared' ? 'started' : 'entered',
          evidence: ['race-card-sync'],
        }, now);
        this.repository.save(trainer);
      }
    }
  }

  private syncFromBarnOperations(now: string): void {
    if (!this.deps.barnOperations) return;
    const snapshot = this.deps.barnOperations.snapshot();
    for (const assignment of snapshot.trainers ?? []) {
      if (!assignment.active) continue;
      this.ensureTrainerFromBarn(assignment.trainerId, assignment.barnId, now);
      const trainer = this.repository.get(assignment.trainerId);
      if (!trainer) continue;
      const barn = snapshot.barns.find((entry) => entry.id === assignment.barnId);
      if (!trainer.stableAssignments.some((entry) => entry.barnId === assignment.barnId && entry.active)) {
        trainer.stableAssignments.push({
          barnId: assignment.barnId,
          barnName: barn?.name,
          assignedAt: assignment.assignedAt,
          assignedBy: assignment.assignedBy,
          active: true,
          evidence: [assignment.auditId, assignment.eventId],
          auditId: assignment.auditId,
        });
      }
      if (!trainer.links.barnIds.includes(assignment.barnId)) trainer.links.barnIds.push(assignment.barnId);
      for (const incidentId of barn?.incidentIds ?? []) {
        if (!trainer.links.incidentIds.includes(incidentId)) trainer.links.incidentIds.push(incidentId);
      }
      for (const link of snapshot.incidentLinks ?? []) {
        if (link.barnId === assignment.barnId && !trainer.links.incidentIds.includes(link.incidentId)) {
          trainer.links.incidentIds.push(link.incidentId);
        }
      }
      this.repository.save(trainer);
    }
  }

  private ensureTrainerFromHorse(trainerId: string, displayName: string, licenseStatus: string, now: string): void {
    if (this.repository.get(trainerId)) return;
    this.createTrainer({
      trainerId,
      displayName,
      licensing: {
        licenseNumber: `LIC-${trainerId}`,
        issuingAuthority: 'State Racing Commission',
        jurisdiction: 'US-NY',
        status: licenseStatus === 'active' ? 'active' : licenseStatus === 'suspended' ? 'suspended' : 'expired',
        issuedOn: '2024-01-01',
        expiresOn: '2027-01-01',
        restrictions: [],
        evidence: ['horse-registry-sync'],
      },
    }, 'horse-registry-sync');
    const trainer = this.repository.get(trainerId);
    if (trainer) {
      trainer.updatedAt = now;
      this.repository.save(trainer);
    }
  }

  private ensureTrainerFromRaceEntry(trainerId: string, now: string): void {
    if (this.repository.get(trainerId)) return;
    this.createTrainer({
      trainerId,
      displayName: trainerId,
      licensing: {
        licenseNumber: `LIC-${trainerId}`,
        issuingAuthority: 'State Racing Commission',
        jurisdiction: 'US-NY',
        status: 'active',
        issuedOn: '2024-01-01',
        expiresOn: '2027-01-01',
        restrictions: [],
        evidence: ['race-card-sync'],
      },
    }, 'race-card-sync');
    const trainer = this.repository.get(trainerId);
    if (trainer) {
      trainer.updatedAt = now;
      this.repository.save(trainer);
    }
  }

  private ensureTrainerFromBarn(trainerId: string, barnId: string, now: string): void {
    if (this.repository.get(trainerId)) return;
    this.createTrainer({
      trainerId,
      displayName: 'Trainer A',
      licensing: {
        licenseNumber: `LIC-${trainerId}`,
        issuingAuthority: 'State Racing Commission',
        jurisdiction: 'US-NY',
        status: 'active',
        issuedOn: '2024-01-01',
        expiresOn: '2027-01-01',
        restrictions: [],
        evidence: ['barn-operations-sync'],
      },
    }, 'barn-operations-sync');
    const trainer = this.repository.get(trainerId);
    if (trainer) {
      trainer.updatedAt = now;
      this.repository.save(trainer);
    }
  }

  private addPerformanceIfMissing(
    trainer: ManagedTrainerRecord,
    record: Omit<TrainerPerformanceRecordDto, 'recordId' | 'auditId'>,
    now: string,
  ): void {
    if (trainer.performanceHistory.some((entry) => entry.raceId === record.raceId && entry.horseId === record.horseId)) return;
    trainer.performanceHistory.push({
      ...record,
      recordId: id('performance'),
      auditId: `audit:sync:${record.raceId}:${now}`,
    });
    if (!trainer.links.raceIds.includes(record.raceId)) trainer.links.raceIds.push(record.raceId);
  }

  private workspaceKpis(trainers: ManagedTrainerProfileDto[], now: string): TrainerKpiDto[] {
    const activeTrainers = trainers.filter((trainer) => trainer.status === 'active').length;
    const assignedHorses = trainers.reduce((sum, trainer) => sum + trainer.horseAssignments.filter((entry) => entry.active).length, 0);
    const complianceScore = trainers.length
      ? Math.round((trainers.filter((trainer) => trainer.compliancePosture.status === 'compliant').length / trainers.length) * 100)
      : 100;
    const incidentLinks = trainers.reduce((sum, trainer) => sum + trainer.links.incidentIds.length, 0);
    const licensedActive = trainers.filter((trainer) => trainer.licensing.status === 'active').length;
    const auditIds = this.auditChain.map((record) => record.auditId);
    return [
      kpi('kpi-trainer-active-roster', 'Active trainer roster', 'Count of trainers in active status.', activeTrainers, 'trainers', trainers.length || 1, activeTrainers === trainers.length ? 'nominal' : 'watch', [{ entityType: 'trainer-management', entityId: this.deps.racetrackId ?? 'main-track' }], auditIds),
      kpi('kpi-trainer-horse-assignments', 'Trainer horse assignments', 'Active horse assignments across the trainer roster.', assignedHorses, 'horses', Math.max(assignedHorses, 1), assignedHorses > 0 ? 'nominal' : 'watch', trainers.flatMap((trainer) => trainer.links.horseIds.map((horseId) => ({ entityType: 'horse', entityId: horseId }))), auditIds),
      kpi('kpi-trainer-compliance-coverage', 'Trainer compliance coverage', 'Percentage of trainers with compliant posture.', complianceScore, '%', 95, complianceScore >= 95 ? 'nominal' : complianceScore >= 80 ? 'watch' : 'warning', trainers.map((trainer) => ({ entityType: 'trainer', entityId: trainer.trainerId })), auditIds),
      kpi('kpi-trainer-incident-linkage', 'Trainer incident linkages', 'Linked steward/security incidents across trainer barn assignments.', incidentLinks, 'incidents', 0, incidentLinks === 0 ? 'nominal' : 'warning', trainers.flatMap((trainer) => trainer.links.incidentIds.map((incidentId) => ({ entityType: 'incident', entityId: incidentId }))), auditIds),
      kpi('kpi-trainer-license-active', 'Active license coverage', 'Trainers with active licensing metadata.', licensedActive, 'licenses', trainers.length || 1, licensedActive === trainers.length ? 'nominal' : 'critical', trainers.map((trainer) => ({ entityType: 'trainer', entityId: trainer.trainerId })), auditIds),
    ];
  }

  private trainerKpis(trainer: ManagedTrainerRecord, now: string): TrainerKpiDto[] {
    const activeHorses = trainer.horseAssignments.filter((entry) => entry.active).length;
    const starts = trainer.performanceHistory.length;
    const wins = trainer.performanceHistory.filter((entry) => entry.finishPosition === 1).length;
    const winRate = starts ? Math.round((wins / starts) * 100) : 0;
    const complianceScore = trainer.compliancePosture.status === 'compliant' ? 100 : trainer.compliancePosture.status === 'under-review' ? 75 : 40;
    return [
      kpi(`kpi-trainer-${trainer.trainerId}-horses`, 'Active horses', 'Active horses assigned to trainer.', activeHorses, 'horses', Math.max(activeHorses, 1), activeHorses > 0 ? 'nominal' : 'watch', [{ entityType: 'trainer', entityId: trainer.trainerId }], trainer.links.auditIds, trainer.trainerId),
      kpi(`kpi-trainer-${trainer.trainerId}-starts`, 'Race starts', 'Recorded race starts linked to trainer.', starts, 'starts', starts, starts > 0 ? 'nominal' : 'watch', trainer.links.raceIds.map((raceId) => ({ entityType: 'race', entityId: raceId })), trainer.links.auditIds, trainer.trainerId),
      kpi(`kpi-trainer-${trainer.trainerId}-win-rate`, 'Win rate', 'Win rate from linked performance history.', winRate, '%', 15, winRate >= 15 ? 'nominal' : 'watch', trainer.links.raceIds.map((raceId) => ({ entityType: 'race', entityId: raceId })), trainer.links.auditIds, trainer.trainerId),
      kpi(`kpi-trainer-${trainer.trainerId}-compliance`, 'Compliance score', 'Trainer compliance posture score.', complianceScore, 'score', 90, complianceScore >= 90 ? 'nominal' : 'watch', [{ entityType: 'trainer', entityId: trainer.trainerId }], trainer.links.auditIds, trainer.trainerId),
    ];
  }

  private toDto(trainer: ManagedTrainerRecord, now: string): ManagedTrainerProfileDto {
    return {
      trainerId: trainer.trainerId,
      tenantId: trainer.tenantId,
      racetrackId: trainer.racetrackId,
      displayName: trainer.displayName,
      status: trainer.status,
      licensing: clone(trainer.licensing),
      stableAssignments: trainer.stableAssignments.map(clone),
      horseAssignments: trainer.horseAssignments.map(clone),
      performanceHistory: trainer.performanceHistory.map(clone),
      compliancePosture: clone(trainer.compliancePosture),
      links: clone(trainer.links),
      kpis: this.trainerKpis(trainer, now),
      version: trainer.version,
      auditIds: [...trainer.auditIds],
      eventIds: [...trainer.eventIds],
      lastAuditId: trainer.auditIds.at(-1) ?? '',
      updatedAt: trainer.updatedAt,
      updatedBy: trainer.updatedBy,
    };
  }

  private mutate(trainer: ManagedTrainerRecord, actor: string, action: string, summary: string, eventType: string, auditId = id('audit-trainer')): TrainerMutationResultDto {
    trainer.updatedBy = actor;
    trainer.updatedAt = new Date().toISOString();
    trainer.version += 1;
    const recordedAuditId = this.recordChange(trainer, actor, action, summary, auditId);
    trainer.auditIds.push(recordedAuditId);
    trainer.links.auditIds.push(recordedAuditId);
    trainer.eventIds.push(id('evt-trainer'));
    this.repository.save(trainer);
    return this.mutationResult(trainer, recordedAuditId, eventType, summary);
  }

  private mutationResult(trainer: ManagedTrainerRecord, auditId: string, eventType: string, message: string): TrainerMutationResultDto {
    return {
      accepted: true,
      trainerId: trainer.trainerId,
      auditId,
      eventType,
      status: trainer.status,
      message: `${message} Change audited and linked to races, horses, incidents, and audits where applicable.`,
      mock: false,
    };
  }

  private recordChange(trainer: ManagedTrainerRecord, actor: string, action: string, changeSummary: string, auditId = id('audit-trainer')): string {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const record: TrainerAuditRecordDto = {
      auditId,
      trainerId: trainer.trainerId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ trainerId: trainer.trainerId, action, changeSummary, previousHash, version: trainer.version }),
      changeSummary,
      evidence: ['trainer-management', action],
    };
    this.auditChain.push(record);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: trainer.trainerId,
        payload: { action, changeSummary, version: trainer.version },
        tenantId: trainer.tenantId,
        severity: 'info',
        regulations: ['HISA', 'ARCI'],
      });
    }
    return auditId;
  }

  private requireTrainer(trainerId: string): ManagedTrainerRecord {
    const trainer = this.repository.get(trainerId);
    if (!trainer) throw new Error(`Unknown trainer ${trainerId}`);
    return trainer;
  }
}

function kpi(
  kpiId: string,
  name: string,
  description: string,
  value: number,
  unit: string,
  target: number,
  status: TrainerKpiDto['status'],
  sourceEntities: TrainerKpiDto['sourceEntities'],
  auditIds: string[],
  trainerId?: string,
): TrainerKpiDto {
  return {
    kpiId,
    trainerId,
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

export function createSeededTrainerManagement(deps: TrainerManagementDeps, now = new Date().toISOString()): TrainerManagementPlatform {
  const platform = new TrainerManagementPlatform(deps);
  if (!deps.horseRegistry && !deps.raceCardManagement) {
    platform.createTrainer({
      trainerId: 'trainer-1',
      displayName: 'Trainer A',
      licensing: {
        licenseNumber: 'NY-TR-1001',
        issuingAuthority: 'NYSGC',
        jurisdiction: 'US-NY',
        status: 'active',
        issuedOn: '2024-01-01',
        expiresOn: '2027-01-01',
        renewalDueOn: '2026-11-01',
        restrictions: [],
        evidence: ['license-registry'],
      },
      compliancePosture: {
        status: 'compliant',
        openFindings: [],
        lastReviewedAt: now,
        reviewedBy: 'compliance-officer',
        medicationViolations: 0,
        welfareFlags: 0,
        stewardInquiries: 0,
        evidence: ['annual-review'],
      },
    });
    platform.assignStable('trainer-1', { barnId: 'barn-2', barnName: 'Barn 2', assignedAt: now, assignedBy: 'racing-secretary', evidence: ['barn-assignment'] });
    platform.assignHorse('trainer-1', { horseId: 'horse-1', horseName: 'Lifecycle Runner', assignedAt: '2026-02-01', evidence: ['horse-assignment'] });
    platform.recordPerformance('trainer-1', { raceId: 'race-7', raceDate: '2026-06-13', trackId: 'main-track', horseId: 'horse-1', status: 'entered', evidence: ['race-office'] });
    platform.linkIncident('trainer-1', 'incident-credential-1');
  }
  platform.workspace(now);
  return platform;
}
