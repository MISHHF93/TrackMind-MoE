import { EquineAuditLogger } from './auditLogger.js';
import { EquineEligibilityEngine } from './eligibilityEngine.js';
import { assertHorseAccess, canEditEligibility, canEditVeterinary, filterHorseProfile } from './privacyMiddleware.js';
import type { EligibilityStatus, EquineRequestActor, FilteredHorseProfile, HisaComplianceVerification, HorseModel, MedicationClass, VeterinaryRecord } from './types.js';

export interface VeterinaryWriteInput {
  recordType: VeterinaryRecord['type'];
  summary: string;
  diagnosis?: string;
  medication?: string;
  medicationClass?: MedicationClass;
  withdrawalUntil?: string;
  approvalId?: string;
  approverId?: string;
  approvalTimestamp?: string;
}

export interface EligibilityWriteInput {
  hisaCompliance?: EligibilityStatus['hisaCompliance'];
  scratchStatus?: EligibilityStatus['scratchStatus'];
  eligibilityFlags?: string[];
  raceRestrictions?: string[];
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export class EquineIntelligencePrivacyService {
  readonly audit = new EquineAuditLogger();
  readonly eligibilityEngine = new EquineEligibilityEngine();
  private readonly horses = new Map<string, HorseModel>();

  constructor(seed = true) {
    if (seed) this.seed();
  }

  profile(horseId: string, actor: EquineRequestActor): FilteredHorseProfile {
    const horse = this.requireHorse(horseId);
    const profile = filterHorseProfile(horse, actor);
    this.audit.append({ horseId, type: 'equine.profile.viewed', actorId: actor.actorId, role: actor.role, occurredAt: now(), payload: { role: actor.role, redactedFields: profile.privacy.redactedFields } });
    return profile;
  }

  addVeterinaryRecord(horseId: string, input: VeterinaryWriteInput, actor: EquineRequestActor): { horseId: string; record: VeterinaryRecord; eligibility: ReturnType<EquineEligibilityEngine['evaluate']>; auditEventId: string } {
    const horse = this.requireHorse(horseId);
    assertHorseAccess(horse, actor);
    if (!canEditVeterinary(actor)) throw new Error('Veterinary records require veterinarian role');
    const approvalId = input.approvalId ?? actor.approvalId;
    const approverId = input.approverId ?? actor.approverId;
    const approvalTimestamp = input.approvalTimestamp ?? actor.approvalTimestamp;
    if (input.medicationClass === 'controlled' && (!approvalId || !approverId || !approvalTimestamp)) throw new Error('Controlled medication requires approvalId, approverId, and approvalTimestamp');
    const record: VeterinaryRecord = {
      recordId: id('vet-record'),
      type: input.recordType,
      recordedAt: now(),
      veterinarianId: actor.actorId,
      summary: input.summary,
      diagnosis: input.diagnosis,
      medication: input.medication,
      medicationClass: input.medicationClass,
      withdrawalUntil: input.withdrawalUntil,
      approvalId,
    };
    const target = input.recordType === 'examination' ? horse.veterinary.examination_records : input.recordType === 'medication' ? horse.veterinary.medication_history : horse.veterinary.injury_reports;
    target.push(record);
    if (record.withdrawalUntil && record.medication) {
      horse.eligibility.medicationWithdrawalPeriods.push({ medication: record.medication, withdrawalUntil: record.withdrawalUntil, cleared: false });
    }
    const eligibility = this.eligibilityEngine.evaluate(horse);
    horse.eligibility = eligibility.status;
    const audit = this.audit.append({ horseId, type: 'equine.veterinary.recorded', actorId: actor.actorId, role: actor.role, occurredAt: record.recordedAt, payload: { record, approvalId: record.approvalId, approverId, approvalTimestamp, failedRules: eligibility.failedRules } });
    return { horseId, record: clone(record), eligibility, auditEventId: audit.eventId };
  }

  updateEligibility(horseId: string, input: EligibilityWriteInput, actor: EquineRequestActor): { horseId: string; eligibility: EligibilityStatus; auditEventId: string } {
    const horse = this.requireHorse(horseId);
    assertHorseAccess(horse, actor);
    if (!canEditEligibility(actor)) throw new Error('Eligibility updates require steward role');
    this.eligibilityEngine.requireStewardApproval(actor);
    horse.eligibility = {
      ...horse.eligibility,
      hisaCompliance: input.hisaCompliance ?? horse.eligibility.hisaCompliance,
      scratchStatus: input.scratchStatus ?? horse.eligibility.scratchStatus,
      eligibilityFlags: input.eligibilityFlags ?? horse.eligibility.eligibilityFlags,
      raceRestrictions: input.raceRestrictions ?? horse.eligibility.raceRestrictions,
      updatedAt: actor.approvalTimestamp ?? now(),
      approvedBy: actor.approverId,
      approvalId: actor.approvalId,
    };
    const evaluated = this.eligibilityEngine.evaluate(horse, horse.eligibility.updatedAt);
    horse.eligibility = { ...evaluated.status, approvedBy: actor.approverId, approvalId: actor.approvalId };
    const audit = this.audit.append({ horseId, type: 'equine.eligibility.updated', actorId: actor.actorId, role: actor.role, occurredAt: horse.eligibility.updatedAt, payload: { input, approvalId: actor.approvalId, approverId: actor.approverId, failedRules: evaluated.failedRules } });
    return { horseId, eligibility: clone(horse.eligibility), auditEventId: audit.eventId };
  }

  auditChain(horseId: string) {
    this.requireHorse(horseId);
    return { horseId, events: this.audit.eventsForHorse(horseId), verification: this.audit.verify() };
  }

  hisaCompliance(horseId: string, actor: EquineRequestActor): HisaComplianceVerification {
    const horse = this.requireHorse(horseId);
    assertHorseAccess(horse, actor);
    const verification = this.eligibilityEngine.verifyHisaCompliance(horse);
    this.audit.append({ horseId, type: 'equine.hisa.verification', actorId: actor.actorId, role: actor.role, occurredAt: verification.verifiedAt, payload: verification });
    return clone(verification);
  }

  eligibility(horseId: string, actor: EquineRequestActor): { horseId: string; eligible: boolean; failedRules: string[]; warnings: string[]; status: EligibilityStatus } {
    const horse = this.requireHorse(horseId);
    assertHorseAccess(horse, actor);
    const evaluation = this.eligibilityEngine.evaluate(horse);
    this.audit.append({ horseId, type: 'equine.eligibility.viewed', actorId: actor.actorId, role: actor.role, occurredAt: now(), payload: { eligible: evaluation.eligible, failedRules: evaluation.failedRules } });
    return { horseId, eligible: evaluation.eligible, failedRules: evaluation.failedRules, warnings: evaluation.warnings, status: clone(evaluation.status) };
  }

  private requireHorse(horseId: string): HorseModel {
    const horse = this.horses.get(horseId);
    if (!horse) throw new Error(`Unknown horse ${horseId}`);
    return horse;
  }

  private seed(): void {
    const horse: HorseModel = {
      identity: { horseId: 'horse-1', microchip: '985141001', name: 'Safety First', breed: 'Thoroughbred', registrationNumber: 'TB-2026-0001', pedigree: 'Command Line x Safety Check' },
      ownershipHistory: [
        { owner_id: 'owner-1', ownerName: 'Stable A', ownership_period: { from: '2025-01-01' }, transfer_approval: 'approval-transfer-1' },
      ],
      racingCareer: {
        starts: 12,
        finishes: [{ raceId: 'race-7', date: '2026-06-14', position: 2, classLevel: 'Allowance', earnings: 18000 }],
        earnings: 142000,
        classLevels: ['Maiden', 'Allowance'],
      },
      veterinary: {
        examination_records: [{ recordId: 'exam-1', type: 'examination', recordedAt: '2026-06-14T14:00:00.000Z', veterinarianId: 'vet-1', summary: 'Pre-race exam completed.', diagnosis: 'Mild left fore soreness watch.' }],
        medication_history: [{ recordId: 'med-1', type: 'medication', recordedAt: '2026-06-10T10:00:00.000Z', veterinarianId: 'vet-1', summary: 'Routine anti-inflammatory recorded.', medication: 'phenylbutazone', medicationClass: 'controlled', withdrawalUntil: '2026-06-15T10:00:00.000Z', approvalId: 'approval-med-1' }],
        injury_reports: [{ recordId: 'injury-1', type: 'injury', recordedAt: '2026-05-20T10:00:00.000Z', veterinarianId: 'vet-1', summary: 'Minor abrasion resolved.', diagnosis: 'Superficial abrasion.' }],
      },
      welfare: {
        wellnessScores: [{ observedAt: '2026-06-14T15:00:00.000Z', score: 88, notes: 'Bright and alert.' }],
        retirementStatus: 'active',
        transportLogs: [{ tripId: 'trip-1', from: 'farm', to: 'barn-2', departedAt: '2026-06-13T10:00:00.000Z', arrivedAt: '2026-06-13T12:00:00.000Z', welfareChecks: ['water offered', 'temperature checked'] }],
      },
      eligibility: { hisaCompliance: 'under-review', medicationWithdrawalPeriods: [{ medication: 'phenylbutazone', withdrawalUntil: '2026-06-15T10:00:00.000Z', cleared: false }], scratchStatus: 'none', eligibilityFlags: ['required-exam-notice'], raceRestrictions: ['steward-review-before-start'], updatedAt: '2026-06-14T15:30:00.000Z' },
      trainerIds: ['trainer-1'],
    };
    this.horses.set(horse.identity.horseId, horse);
    this.audit.append({ horseId: horse.identity.horseId, type: 'equine.profile.seeded', actorId: 'system', role: 'system', occurredAt: '2026-06-14T15:30:00.000Z', payload: { horseId: horse.identity.horseId } });
  }
}

export function createEquineIntelligencePrivacyService() {
  return new EquineIntelligencePrivacyService();
}
