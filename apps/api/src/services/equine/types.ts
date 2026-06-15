export type EquineRole = 'veterinarian' | 'steward' | 'trainer' | 'owner' | 'regulator' | 'public';
export type MedicationClass = 'none' | 'routine' | 'controlled';
export type ScratchStatus = 'none' | 'requested' | 'scratched';

export interface EquineRequestActor {
  actorId: string;
  role: EquineRole;
  ownerId?: string;
  trainerId?: string;
  approvalId?: string;
  approverId?: string;
  approvalTimestamp?: string;
}

export interface HorseIdentity {
  horseId: string;
  microchip: string;
  name: string;
  breed: string;
  registrationNumber: string;
  pedigree: string;
}

export interface OwnershipHistoryRecord {
  owner_id: string;
  ownerName: string;
  ownership_period: { from: string; to?: string };
  transfer_approval: string;
}

export interface RacingCareerRecord {
  starts: number;
  finishes: Array<{ raceId: string; date: string; position: number; classLevel: string; earnings: number }>;
  earnings: number;
  classLevels: string[];
}

export interface VeterinaryRecord {
  recordId: string;
  type: 'examination' | 'medication' | 'injury';
  recordedAt: string;
  veterinarianId: string;
  summary: string;
  diagnosis?: string;
  medication?: string;
  medicationClass?: MedicationClass;
  withdrawalUntil?: string;
  approvalId?: string;
}

export interface WelfareRecord {
  wellnessScores: Array<{ observedAt: string; score: number; notes: string }>;
  retirementStatus: 'active' | 'retired' | 'aftercare';
  transportLogs: Array<{ tripId: string; from: string; to: string; departedAt: string; arrivedAt?: string; welfareChecks: string[] }>;
}

export interface EligibilityStatus {
  hisaCompliance: 'compliant' | 'under-review' | 'non-compliant';
  medicationWithdrawalPeriods: Array<{ medication: string; withdrawalUntil: string; cleared: boolean }>;
  scratchStatus: ScratchStatus;
  eligibilityFlags: string[];
  raceRestrictions: string[];
  updatedAt: string;
  approvedBy?: string;
  approvalId?: string;
}

export interface HisaComplianceCheck {
  ruleId: string;
  description: string;
  passed: boolean;
  evidenceLinks: string[];
}

export interface HisaComplianceVerification {
  horseId: string;
  verifiedAt: string;
  compliant: boolean;
  checks: HisaComplianceCheck[];
  failedRules: string[];
  approvalRequiredForEligibilityChange: true;
}

export interface HorseModel {
  identity: HorseIdentity;
  ownershipHistory: OwnershipHistoryRecord[];
  racingCareer: RacingCareerRecord;
  veterinary: {
    examination_records: VeterinaryRecord[];
    medication_history: VeterinaryRecord[];
    injury_reports: VeterinaryRecord[];
  };
  welfare: WelfareRecord;
  eligibility: EligibilityStatus;
  trainerIds: string[];
}

export interface FilteredHorseProfile {
  horseId: string;
  role: EquineRole;
  identity: Partial<HorseIdentity>;
  ownershipHistory?: OwnershipHistoryRecord[];
  racingCareer?: RacingCareerRecord;
  veterinary?: Partial<HorseModel['veterinary']> | 'redacted';
  welfare?: Partial<WelfareRecord>;
  eligibility?: Partial<EligibilityStatus>;
  audit?: { available: boolean; anonymized: boolean };
  privacy: { scope: EquineRole; redactedFields: string[]; reason: string };
}
