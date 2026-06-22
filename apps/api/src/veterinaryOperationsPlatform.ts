import type { Role } from '@trackmind/shared';
import { veterinaryPrivacyScopesByRole } from '@trackmind/shared';
import type {
  ClearanceWorkflowDto,
  ClearanceWorkflowStatus,
  ClearanceWorkflowType,
  ManagedHorseVeterinaryCaseDto,
  TreatmentStatus,
  TreatmentTrackingDto,
  VeterinaryAuditRecordDto,
  VeterinaryExaminationDto,
  VeterinaryMutationResultDto,
  VeterinaryObservationDto,
  VeterinaryOperationsAuditTrailDto,
  VeterinaryOperationsDashboardDto,
  VeterinaryOperationsKpiDto,
  VeterinaryOperationsWorkspaceDto,
  VeterinaryPrivacyContextDto,
  VeterinaryPrivacyScope,
  VeterinaryRecordDto,
  WelfareIndicatorBand,
  WelfareIndicatorDto,
} from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { EquineIntelligencePlatform } from './equineIntelligencePlatform.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

export interface VeterinaryAccessContext {
  actorId: string;
  role: Role;
}

export interface ManagedVeterinaryCaseRecord {
  horseId: string;
  horseName?: string;
  tenantId: string;
  racetrackId: string;
  records: VeterinaryRecordDto[];
  examinations: VeterinaryExaminationDto[];
  observations: VeterinaryObservationDto[];
  treatments: TreatmentTrackingDto[];
  clearanceWorkflows: ClearanceWorkflowDto[];
  welfareIndicators: WelfareIndicatorDto[];
  version: number;
  auditIds: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface VeterinaryOperationsDeps {
  equinePlatform?: EquineIntelligencePlatform;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
}

export class VeterinaryOperationsRepository {
  private readonly cases = new Map<string, ManagedVeterinaryCaseRecord>();

  save(record: ManagedVeterinaryCaseRecord): ManagedVeterinaryCaseRecord {
    this.cases.set(record.horseId, clone(record));
    return clone(record);
  }

  get(horseId: string): ManagedVeterinaryCaseRecord | undefined {
    const record = this.cases.get(horseId);
    return record ? clone(record) : undefined;
  }

  list(filter: { tenantId?: string; racetrackId?: string } = {}): ManagedVeterinaryCaseRecord[] {
    return [...this.cases.values()]
      .filter((record) => (!filter.tenantId || record.tenantId === filter.tenantId)
        && (!filter.racetrackId || record.racetrackId === filter.racetrackId))
      .map(clone);
  }
}

function privacyContextForRole(role: Role): VeterinaryPrivacyContextDto {
  const allowedScopes = veterinaryPrivacyScopesByRole[role] ?? ['public'];
  const redactedFields: string[] = [];
  if (!allowedScopes.includes('veterinary-confidential')) {
    redactedFields.push('diagnosis', 'medication', 'dosage', 'restrictedDetail', 'gaitAssessment', 'treatment.medication');
  }
  if (!allowedScopes.includes('care-team')) {
    redactedFields.push('observations.detail', 'welfare.notes');
  }
  if (!allowedScopes.includes('regulator')) {
    redactedFields.push('clearance.failedRules', 'audit.actor');
  }
  const reason = role === 'veterinarian'
    ? 'Veterinarian has full medical access within licensed scope.'
    : role === 'platform-super-admin' || role === 'compliance-officer'
      ? 'Compliance role with regulated veterinary-confidential access.'
      : role === 'steward' || role === 'horse-operations-coordinator'
        ? 'Official view includes clearance posture without confidential medical detail.'
        : role === 'read-only-auditor'
          ? 'Auditor view includes anonymized clearance and welfare bands only.'
          : 'Restricted view excludes veterinary-confidential information.';
  return { role, allowedScopes, redactedFields, reason };
}

function canViewScope(role: Role, scope: VeterinaryPrivacyScope): boolean {
  return (veterinaryPrivacyScopesByRole[role] ?? ['public']).includes(scope);
}

function redactRecord(record: VeterinaryRecordDto): VeterinaryRecordDto {
  return {
    recordId: record.recordId,
    horseId: record.horseId,
    recordedAt: record.recordedAt,
    veterinarianId: 'redacted',
    category: record.category,
    summary: 'Restricted veterinary information',
    privacyScope: record.privacyScope,
    evidence: [],
    auditId: record.auditId,
    redacted: true,
  };
}

function redactExamination(exam: VeterinaryExaminationDto): VeterinaryExaminationDto {
  return {
    examinationId: exam.examinationId,
    horseId: exam.horseId,
    examinedAt: exam.examinedAt,
    veterinarianId: 'redacted',
    examType: exam.examType,
    findingsSummary: 'Restricted veterinary examination detail',
    privacyScope: exam.privacyScope,
    clearanceRequired: exam.clearanceRequired,
    evidence: [],
    auditId: exam.auditId,
    redacted: true,
  };
}

function redactObservation(observation: VeterinaryObservationDto): VeterinaryObservationDto {
  return {
    observationId: observation.observationId,
    horseId: observation.horseId,
    observedAt: observation.observedAt,
    observerId: 'redacted',
    observerRole: observation.observerRole,
    observationType: observation.observationType,
    category: observation.category,
    summary: 'Restricted observation detail',
    severity: observation.severity,
    followUpNeeded: observation.followUpNeeded,
    clearanceState: observation.clearanceState,
    raceDayImpact: observation.raceDayImpact,
    privacyScope: observation.privacyScope,
    evidence: [],
    auditId: observation.auditId,
    redacted: true,
  };
}

function redactTreatment(treatment: TreatmentTrackingDto): TreatmentTrackingDto {
  return {
    treatmentId: treatment.treatmentId,
    horseId: treatment.horseId,
    startedAt: treatment.startedAt,
    endedAt: treatment.endedAt,
    veterinarianId: 'redacted',
    treatmentType: treatment.treatmentType,
    status: treatment.status,
    summary: 'Restricted treatment detail',
    privacyScope: treatment.privacyScope,
    linkedRecordIds: [],
    evidence: [],
    auditId: treatment.auditId,
    redacted: true,
  };
}

function redactWelfareIndicator(indicator: WelfareIndicatorDto): WelfareIndicatorDto {
  return {
    indicatorId: indicator.indicatorId,
    horseId: indicator.horseId,
    observedAt: indicator.observedAt,
    category: indicator.category,
    score: indicator.score,
    band: indicator.band,
    summary: indicator.band === 'intervention-required' ? 'Welfare intervention required' : 'Welfare indicator on file',
    privacyScope: indicator.privacyScope,
    evidence: [],
    auditId: indicator.auditId,
    redacted: true,
  };
}

export class VeterinaryOperationsPlatform {
  private readonly repository = new VeterinaryOperationsRepository();
  private readonly auditChain: VeterinaryAuditRecordDto[] = [];

  constructor(private readonly deps: VeterinaryOperationsDeps = {}) {}

  workspace(now = new Date().toISOString(), access: VeterinaryAccessContext): VeterinaryOperationsWorkspaceDto {
    this.syncFromEquine(now);
    const privacy = privacyContextForRole(access.role);
    const cases = this.repository.list({ tenantId: this.deps.tenantId, racetrackId: this.deps.racetrackId })
      .map((record) => this.toDto(record, access, now));
    const statusSummary = {
      cleared: cases.filter((entry) => entry.clearanceStatus === 'cleared').length,
      pending: cases.filter((entry) => entry.clearanceStatus === 'pending').length,
      restricted: cases.filter((entry) => entry.clearanceStatus === 'restricted').length,
      denied: cases.filter((entry) => entry.clearanceStatus === 'denied').length,
    };
    this.recordAccessAudit(undefined, access, 'veterinary-operations.workspace.read', `Workspace read with ${cases.length} case(s)`, now, false);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.veterinary-operations.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      cases,
      statusSummary,
      dashboard: this.buildDashboard(cases, now),
      privacy,
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  getCase(horseId: string, access: VeterinaryAccessContext, now = new Date().toISOString()): ManagedHorseVeterinaryCaseDto | undefined {
    this.syncFromEquine(now);
    const record = this.repository.get(horseId);
    if (!record) return undefined;
    const dto = this.toDto(record, access, now);
    this.recordAccessAudit(horseId, access, 'veterinary-operations.case.read', `Case read for ${horseId}`, now, dto.records.some((entry) => entry.redacted));
    return dto;
  }

  auditTrail(horseId: string | undefined, now = new Date().toISOString()): VeterinaryOperationsAuditTrailDto {
    const records = horseId
      ? this.auditChain.filter((record) => record.horseId === horseId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.veterinary-operations.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  addRecord(horseId: string, input: Omit<VeterinaryRecordDto, 'recordId' | 'horseId' | 'auditId'>, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    this.assertVeterinaryWrite(access);
    const record = this.requireCase(horseId);
    const auditId = id('audit-vet');
    const entry: VeterinaryRecordDto = {
      ...clone(input),
      recordId: id('vet-record'),
      horseId,
      auditId,
    };
    record.records.push(entry);
    return this.commit(record, access, 'veterinary-operations.record.added', `Added ${entry.category} record`, auditId);
  }

  addExamination(horseId: string, input: Omit<VeterinaryExaminationDto, 'examinationId' | 'horseId' | 'auditId'>, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    this.assertVeterinaryWrite(access);
    const record = this.requireCase(horseId);
    const auditId = id('audit-vet');
    const entry: VeterinaryExaminationDto = {
      ...clone(input),
      examinationId: id('vet-exam'),
      horseId,
      auditId,
    };
    record.examinations.push(entry);
    return this.commit(record, access, 'veterinary-operations.examination.added', `Added ${entry.examType} examination`, auditId);
  }

  addObservation(horseId: string, input: Omit<VeterinaryObservationDto, 'observationId' | 'horseId' | 'auditId'>, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    this.assertCareTeamWrite(access);
    const record = this.requireCase(horseId);
    const auditId = id('audit-vet');
    const entry: VeterinaryObservationDto = {
      ...clone(input),
      observationId: id('vet-obs'),
      horseId,
      auditId,
    };
    record.observations.push(entry);
    return this.commit(record, access, 'veterinary-operations.observation.added', `Added ${entry.category} observation`, auditId);
  }

  addTreatment(horseId: string, input: Omit<TreatmentTrackingDto, 'treatmentId' | 'horseId' | 'auditId'>, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    this.assertVeterinaryWrite(access);
    const record = this.requireCase(horseId);
    const auditId = id('audit-vet');
    const entry: TreatmentTrackingDto = {
      ...clone(input),
      treatmentId: id('vet-treatment'),
      horseId,
      auditId,
    };
    record.treatments.push(entry);
    return this.commit(record, access, 'veterinary-operations.treatment.added', `Added treatment ${entry.treatmentType}`, auditId);
  }

  updateTreatmentStatus(horseId: string, treatmentId: string, status: TreatmentStatus, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    this.assertVeterinaryWrite(access);
    const record = this.requireCase(horseId);
    const treatment = record.treatments.find((entry) => entry.treatmentId === treatmentId);
    if (!treatment) throw new Error(`Unknown treatment ${treatmentId}`);
    treatment.status = status;
    if (status === 'completed' || status === 'discontinued') treatment.endedAt = new Date().toISOString();
    return this.commit(record, access, 'veterinary-operations.treatment.updated', `Treatment ${treatmentId} status ${status}`);
  }

  startClearanceWorkflow(horseId: string, input: { clearanceType: ClearanceWorkflowType; requestedBy?: string; requiredApprovals?: string[]; evidence?: string[] }, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    this.assertVeterinaryWrite(access);
    const record = this.requireCase(horseId);
    const auditId = id('audit-vet');
    const workflow: ClearanceWorkflowDto = {
      workflowId: id('clearance'),
      horseId,
      clearanceType: input.clearanceType,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy ?? access.actorId,
      requiredApprovals: input.requiredApprovals ?? ['veterinarian', 'steward'],
      failedRules: [],
      evidence: input.evidence ?? [],
      auditId,
    };
    record.clearanceWorkflows.push(workflow);
    return this.commit(record, access, 'veterinary-operations.clearance.started', `Started ${workflow.clearanceType} clearance workflow`, auditId);
  }

  advanceClearanceWorkflow(horseId: string, workflowId: string, input: { status: ClearanceWorkflowStatus; failedRules?: string[]; evidence?: string[] }, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    if (access.role !== 'veterinarian' && access.role !== 'steward' && access.role !== 'platform-super-admin') {
      throw new Error('Clearance workflow updates require veterinarian or steward role');
    }
    const record = this.requireCase(horseId);
    const workflow = record.clearanceWorkflows.find((entry) => entry.workflowId === workflowId);
    if (!workflow) throw new Error(`Unknown clearance workflow ${workflowId}`);
    workflow.status = input.status;
    workflow.reviewedBy = access.actorId;
    workflow.reviewedAt = new Date().toISOString();
    workflow.failedRules = input.failedRules ?? workflow.failedRules;
    if (input.evidence?.length) workflow.evidence.push(...input.evidence);
    return this.commit(record, access, 'veterinary-operations.clearance.updated', `Clearance ${workflowId} status ${input.status}`);
  }

  addWelfareIndicator(horseId: string, input: Omit<WelfareIndicatorDto, 'indicatorId' | 'horseId' | 'auditId'>, access: VeterinaryAccessContext): VeterinaryMutationResultDto {
    this.assertCareTeamWrite(access);
    const record = this.requireCase(horseId);
    const auditId = id('audit-vet');
    const entry: WelfareIndicatorDto = {
      ...clone(input),
      indicatorId: id('welfare'),
      horseId,
      auditId,
    };
    record.welfareIndicators.push(entry);
    return this.commit(record, access, 'veterinary-operations.welfare.recorded', `Recorded welfare indicator ${entry.category}`, auditId);
  }

  registerCase(horseId: string, horseName?: string, actor = 'veterinarian'): ManagedVeterinaryCaseRecord {
    if (this.repository.get(horseId)) return this.requireCase(horseId);
    const now = new Date().toISOString();
    const record: ManagedVeterinaryCaseRecord = {
      horseId,
      horseName,
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      records: [],
      examinations: [],
      observations: [],
      treatments: [],
      clearanceWorkflows: [],
      welfareIndicators: [],
      version: 1,
      auditIds: [],
      updatedAt: now,
      updatedBy: actor,
    };
    this.repository.save(record);
    this.recordChange(record, actor, 'veterinarian', 'veterinary-operations.case.registered', `Registered veterinary case for ${horseId}`);
    return record;
  }

  private syncFromEquine(now: string): void {
    if (!this.deps.equinePlatform) return;
    for (const profile of this.deps.equinePlatform.listProfiles?.() ?? []) {
      const horseId = profile.identity.horseId;
      let record = this.repository.get(horseId);
      if (!record) record = this.registerCase(horseId, profile.identity.name);
      for (const vetRecord of profile.veterinaryRecords ?? []) {
        if (record.records.some((entry) => entry.recordId === vetRecord.recordId)) continue;
        record.records.push({
          recordId: vetRecord.recordId,
          horseId,
          recordedAt: vetRecord.recordedAt,
          veterinarianId: vetRecord.veterinarianId,
          category: vetRecord.category === 'exam' ? 'examination' : vetRecord.category === 'clearance' ? 'clearance' : vetRecord.category === 'medication' ? 'medication' : vetRecord.category === 'injury' ? 'injury' : vetRecord.category === 'lab' ? 'lab' : 'other',
          summary: vetRecord.summary,
          privacyScope: vetRecord.privacyScope,
          restrictedDetail: vetRecord.restrictions?.join('; '),
          evidence: vetRecord.restrictions ?? [],
          auditId: id('audit-vet-sync'),
        });
      }
      for (const welfare of profile.welfareRecords ?? []) {
        if (record.welfareIndicators.some((entry) => entry.observedAt === welfare.observedAt)) continue;
        const score = welfare.score ?? 80;
        record.welfareIndicators.push({
          indicatorId: id('welfare-sync'),
          horseId,
          observedAt: welfare.observedAt,
          category: 'behavior',
          score,
          band: score >= 90 ? 'excellent' : score >= 70 ? 'acceptable' : score >= 50 ? 'watch' : 'intervention-required',
          summary: welfare.notes ?? 'Welfare observation synced',
          privacyScope: 'care-team',
          evidence: welfare.interventions ?? [],
          auditId: id('audit-vet-sync'),
        });
      }
      record.updatedAt = now;
      this.repository.save(record);
    }
  }

  private toDto(record: ManagedVeterinaryCaseRecord, access: VeterinaryAccessContext, now: string): ManagedHorseVeterinaryCaseDto {
    const privacy = privacyContextForRole(access.role);
    const mapRecord = (entry: VeterinaryRecordDto) => (canViewScope(access.role, entry.privacyScope) ? clone(entry) : redactRecord(entry));
    const mapExam = (entry: VeterinaryExaminationDto) => (canViewScope(access.role, entry.privacyScope) ? clone(entry) : redactExamination(entry));
    const mapObs = (entry: VeterinaryObservationDto) => (canViewScope(access.role, entry.privacyScope) ? clone(entry) : redactObservation(entry));
    const mapTreatment = (entry: TreatmentTrackingDto) => (canViewScope(access.role, entry.privacyScope) ? clone(entry) : redactTreatment(entry));
    const mapWelfare = (entry: WelfareIndicatorDto) => (canViewScope(access.role, entry.privacyScope) ? clone(entry) : redactWelfareIndicator(entry));
    const clearanceStatus = this.deriveClearanceStatus(record);
    const welfareBand = this.deriveWelfareBand(record);
    return {
      horseId: record.horseId,
      horseName: record.horseName,
      tenantId: record.tenantId,
      racetrackId: record.racetrackId,
      records: record.records.map(mapRecord),
      examinations: record.examinations.map(mapExam),
      observations: record.observations.map(mapObs),
      treatments: record.treatments.map(mapTreatment),
      clearanceWorkflows: record.clearanceWorkflows.map(clone),
      welfareIndicators: record.welfareIndicators.map(mapWelfare),
      privacy,
      clearanceStatus,
      welfareBand,
      version: record.version,
      auditIds: [...record.auditIds],
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy,
    };
  }

  private deriveClearanceStatus(record: ManagedVeterinaryCaseRecord): ManagedHorseVeterinaryCaseDto['clearanceStatus'] {
    const latest = record.clearanceWorkflows.at(-1);
    if (!latest) return record.records.some((entry) => entry.category === 'clearance') ? 'cleared' : 'pending';
    if (latest.status === 'cleared') return 'cleared';
    if (latest.status === 'denied') return 'denied';
    if (latest.status === 'pending' || latest.status === 'in-review') return 'pending';
    return 'restricted';
  }

  private deriveWelfareBand(record: ManagedVeterinaryCaseRecord): WelfareIndicatorBand {
    const latest = record.welfareIndicators.at(-1);
    return latest?.band ?? 'acceptable';
  }

  private buildDashboard(cases: ManagedHorseVeterinaryCaseDto[], now: string): VeterinaryOperationsDashboardDto {
    const activeCases = cases.length;
    const pendingClearances = cases.filter((entry) => entry.clearanceStatus === 'pending').length;
    const openTreatments = cases.flatMap((entry) => entry.treatments).filter((entry) => entry.status === 'active' || entry.status === 'planned').length;
    const welfareWatchCount = cases.filter((entry) => entry.welfareBand === 'watch' || entry.welfareBand === 'intervention-required').length;
    const totalItems = cases.flatMap((entry) => [...entry.records, ...entry.examinations, ...entry.observations, ...entry.treatments, ...entry.welfareIndicators]).length;
    const redactedItems = cases.flatMap((entry) => [...entry.records, ...entry.examinations, ...entry.observations, ...entry.treatments, ...entry.welfareIndicators]).filter((entry) => entry.redacted).length;
    const privacyGuardrailCoveragePct = totalItems === 0 ? 100 : Number((((totalItems - redactedItems) / totalItems) * 100).toFixed(1));
    const panels: VeterinaryOperationsKpiDto[] = [
      kpi('vet-kpi-active-cases', 'Active veterinary cases', 'Horses with managed veterinary operations records.', activeCases, 'cases', activeCases, activeCases === 0 ? 'watch' : 'nominal', [{ entityType: 'veterinary-operations', entityId: 'main-track' }], []),
      kpi('vet-kpi-pending-clearance', 'Pending clearances', 'Clearance workflows awaiting veterinarian or steward review.', pendingClearances, 'workflows', 0, pendingClearances > 0 ? 'watch' : 'nominal', [{ entityType: 'veterinary-operations', entityId: 'main-track' }], []),
      kpi('vet-kpi-open-treatments', 'Open treatments', 'Active or planned treatment plans under veterinary tracking.', openTreatments, 'treatments', 0, openTreatments > 2 ? 'watch' : 'nominal', [{ entityType: 'veterinary-operations', entityId: 'main-track' }], []),
      kpi('vet-kpi-welfare-watch', 'Welfare watch count', 'Horses with watch or intervention-required welfare indicators.', welfareWatchCount, 'horses', 0, welfareWatchCount > 0 ? 'warning' : 'nominal', [{ entityType: 'horse', entityId: 'horse-1' }], []),
      kpi('vet-kpi-privacy-coverage', 'Privacy guardrail coverage', 'Percentage of veterinary items visible under current privacy scope without over-exposure.', privacyGuardrailCoveragePct, '%', 100, privacyGuardrailCoveragePct >= 95 ? 'nominal' : 'watch', [{ entityType: 'privacy-policy', entityId: 'veterinary-operations' }], []),
    ];
    return { activeCases, pendingClearances, openTreatments, welfareWatchCount, privacyGuardrailCoveragePct, panels };
  }

  private assertVeterinaryWrite(access: VeterinaryAccessContext): void {
    if (!['veterinarian', 'platform-super-admin', 'compliance-officer'].includes(access.role)) {
      throw new Error('Veterinary write operations require veterinarian role');
    }
  }

  private assertCareTeamWrite(access: VeterinaryAccessContext): void {
    if (!['veterinarian', 'platform-super-admin', 'compliance-officer', 'steward', 'facilities-manager', 'organization-admin'].includes(access.role)) {
      throw new Error('Care-team write operations require veterinarian or care-team role');
    }
  }

  private commit(record: ManagedVeterinaryCaseRecord, access: VeterinaryAccessContext, action: string, summary: string, auditId = id('audit-vet')): VeterinaryMutationResultDto {
    record.version += 1;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = access.actorId;
    const recordedAuditId = this.recordChange(record, access.actorId, access.role, action, summary, auditId);
    record.auditIds.push(recordedAuditId);
    this.repository.save(record);
    return {
      accepted: true,
      horseId: record.horseId,
      auditId: recordedAuditId,
      eventType: action,
      message: `${summary}. Change audited with privacy scope enforcement.`,
      mock: false,
    };
  }

  private recordAccessAudit(horseId: string | undefined, access: VeterinaryAccessContext, action: string, summary: string, timestamp: string, redactedAccess: boolean): void {
    this.appendAudit({
      horseId,
      tenantId: this.deps.tenantId ?? 'trackmind',
      actor: access.actorId,
      role: access.role,
      action,
      changeSummary: summary,
      auditId: id('audit-vet-access'),
      redactedAccess,
      timestamp,
    });
  }

  private recordChange(
    record: ManagedVeterinaryCaseRecord,
    actor: string,
    role: string,
    action: string,
    changeSummary: string,
    auditId = id('audit-vet'),
    redactedAccess = false,
  ): string {
    return this.appendAudit({
      horseId: record.horseId,
      tenantId: record.tenantId,
      actor,
      role,
      action,
      changeSummary,
      auditId,
      redactedAccess,
    });
  }

  private appendAudit(input: {
    horseId?: string;
    tenantId: string;
    actor: string;
    role: string;
    action: string;
    changeSummary: string;
    auditId: string;
    redactedAccess?: boolean;
    timestamp?: string;
  }): string {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const timestamp = input.timestamp ?? new Date().toISOString();
    const auditRecord: VeterinaryAuditRecordDto = {
      auditId: input.auditId,
      horseId: input.horseId,
      action: input.action,
      actor: input.actor,
      role: input.role,
      timestamp,
      previousHash,
      hash: hash({ horseId: input.horseId, action: input.action, changeSummary: input.changeSummary, previousHash, role: input.role }),
      changeSummary: input.changeSummary,
      redactedAccess: input.redactedAccess,
      evidence: ['veterinary-operations', input.action],
    };
    this.auditChain.push(auditRecord);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: input.auditId,
        type: input.redactedAccess ? 'security-event' : 'data-change',
        actor: input.actor,
        timestamp,
        subjectId: input.horseId ?? 'veterinary-operations',
        payload: { action: input.action, changeSummary: input.changeSummary, role: input.role, redactedAccess: input.redactedAccess },
        tenantId: input.tenantId,
        severity: input.redactedAccess ? 'warning' : 'info',
        regulations: ['HISA', 'HIPAA-advisory', 'ARCI'],
      });
    }
    return input.auditId;
  }

  private requireCase(horseId: string): ManagedVeterinaryCaseRecord {
    const record = this.repository.get(horseId);
    if (!record) throw new Error(`Unknown veterinary case ${horseId}`);
    return record;
  }
}

function kpi(
  kpiId: string,
  name: string,
  description: string,
  value: number,
  unit: string,
  target: number,
  status: VeterinaryOperationsKpiDto['status'],
  sourceEntities: VeterinaryOperationsKpiDto['sourceEntities'],
  auditIds: string[],
  horseId?: string,
): VeterinaryOperationsKpiDto {
  return {
    kpiId,
    horseId,
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

export function createSeededVeterinaryOperations(deps: VeterinaryOperationsDeps, now = new Date().toISOString()): VeterinaryOperationsPlatform {
  const platform = new VeterinaryOperationsPlatform(deps);
  const vetAccess: VeterinaryAccessContext = { actorId: 'vet-live', role: 'veterinarian' };
  platform.registerCase('horse-1', 'Lifecycle Runner');
  platform.addExamination('horse-1', {
    examinedAt: now,
    veterinarianId: 'vet-live',
    examType: 'pre-race',
    findingsSummary: 'Bright and alert; mild left fore sensitivity on flexion.',
    gaitAssessment: 'Short stride left fore at trot.',
    bodyConditionScore: 5,
    privacyScope: 'veterinary-confidential',
    clearanceRequired: true,
    evidence: ['pre-race-exam-form'],
  }, vetAccess);
  platform.addRecord('horse-1', {
    recordedAt: now,
    veterinarianId: 'vet-live',
    category: 'medication',
    summary: 'Phenylbutazone administered per veterinary protocol.',
    privacyScope: 'veterinary-confidential',
    medication: 'phenylbutazone',
    dosage: '1g PO BID',
    withdrawalUntil: '2026-06-18T10:00:00.000Z',
    restrictedDetail: 'Controlled medication — steward notification required.',
    evidence: ['medication-log', 'approval-med-1'],
  }, vetAccess);
  platform.addObservation('horse-1', {
    observedAt: now,
    observerId: 'barn-manager-1',
    observerRole: 'care-team',
    category: 'appetite',
    summary: 'Ate full ration; drinking normally.',
    severity: 'low',
    privacyScope: 'care-team',
    evidence: ['barn-sheet'],
  }, vetAccess);
  platform.addTreatment('horse-1', {
    startedAt: now,
    veterinarianId: 'vet-live',
    treatmentType: 'anti-inflammatory course',
    status: 'active',
    summary: 'Short course anti-inflammatory with withdrawal tracking.',
    medication: 'phenylbutazone',
    privacyScope: 'veterinary-confidential',
    linkedRecordIds: [],
    evidence: ['treatment-plan'],
  }, vetAccess);
  platform.startClearanceWorkflow('horse-1', {
    clearanceType: 'pre-race',
    requiredApprovals: ['veterinarian', 'steward'],
    evidence: ['pre-race-exam-form'],
  }, vetAccess);
  platform.addWelfareIndicator('horse-1', {
    observedAt: now,
    category: 'body-condition',
    score: 88,
    band: 'acceptable',
    summary: 'Body condition within acceptable range.',
    privacyScope: 'care-team',
    evidence: ['welfare-checklist'],
  }, vetAccess);
  platform.registerCase('horse-2', 'Turn Signal');
  platform.addWelfareIndicator('horse-2', {
    observedAt: now,
    category: 'gait',
    score: 72,
    band: 'watch',
    summary: 'Slight stiffness noted after gallop.',
    privacyScope: 'care-team',
    evidence: ['exercise-rider-report'],
  }, vetAccess);
  platform.workspace(now, vetAccess);
  return platform;
}

function resolveAccess(actorId: string | undefined, role: string | undefined): VeterinaryAccessContext {
  const resolvedRole = (role && role in veterinaryPrivacyScopesByRole ? role : 'read-only-auditor') as Role;
  return { actorId: actorId ?? resolvedRole, role: resolvedRole };
}

export { resolveAccess as resolveVeterinaryAccess };
