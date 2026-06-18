export const horseRegistrySchemaVersion = 'trackmind.horse-registry.v1' as const;

export type HorseRegistryLifecycleStatus = 'active' | 'inactive' | 'retired' | 'deceased';
export type HorseRegistrationType = 'racing' | 'breeding' | 'microchip' | 'passport' | 'stud-book';
export type HorseRegistrationStatus = 'active' | 'suspended' | 'revoked' | 'pending';

export interface HorseIdentityDto {
  horseId: string;
  tenantId: string;
  racetrackId?: string;
  name: string;
  microchipId?: string;
  foaled?: string;
  sex?: 'colt' | 'filly' | 'gelding' | 'mare' | 'stallion';
  breed?: string;
  color?: string;
  lifecycleStatus: HorseRegistryLifecycleStatus;
}

export interface HorseOwnershipHistoryEntryDto {
  ownerId: string;
  ownerName: string;
  effectiveFrom: string;
  effectiveTo?: string;
  percentage: number;
  evidence: string[];
  auditId: string;
}

export interface HorseTrainerHistoryEntryDto {
  trainerId: string;
  trainerName: string;
  effectiveFrom: string;
  effectiveTo?: string;
  licenseStatus: 'active' | 'expired' | 'suspended';
  evidence: string[];
  auditId: string;
}

export interface HorseStableHistoryEntryDto {
  barnId: string;
  stallId?: string;
  assignedAt: string;
  releasedAt?: string;
  assignedBy: string;
  evidence: string[];
  auditId: string;
}

export interface HorseBreedingMetadataDto {
  sireId?: string;
  sireName?: string;
  damId?: string;
  damName?: string;
  breedingDate?: string;
  foalingDate?: string;
  studBook?: string;
  breedRegistry?: string;
  color?: string;
  markings?: string[];
  breederId?: string;
  breederName?: string;
}

export interface HorseRegistrationRecordDto {
  recordId: string;
  authority: string;
  registrationNumber: string;
  registrationType: HorseRegistrationType;
  effectiveFrom: string;
  effectiveTo?: string;
  status: HorseRegistrationStatus;
  evidence: string[];
  auditId: string;
  recordedAt: string;
}

export interface HorseEligibilityStatusDto {
  eligible: boolean;
  complianceStatus: 'compliant' | 'under-review' | 'suspended' | 'ineligible';
  flags: string[];
  failedRules: string[];
  updatedAt: string;
}

export interface HorseRetirementRecordDto {
  retiredAt: string;
  reason: string;
  destination: string;
  aftercareContact?: string;
  evidence: string[];
  auditId: string;
}

export interface HorseLifecycleHistoryEntryDto {
  entryId: string;
  horseId: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  lifecycleFrom?: HorseRegistryLifecycleStatus;
  lifecycleTo?: HorseRegistryLifecycleStatus;
  changeSummary: string;
  evidence: string[];
}

export interface HorseDigitalTwinSyncDto {
  twinId: string;
  lastSyncedAt: string;
  syncReason?: string;
  lifecycleStatus: HorseRegistryLifecycleStatus;
  eligible: boolean;
  currentOwnerId?: string;
  currentTrainerId?: string;
  currentBarnId?: string;
  readOnly: true;
}

export interface HorseRegistryRecordDto {
  identity: HorseIdentityDto;
  ownershipHistory: HorseOwnershipHistoryEntryDto[];
  trainerHistory: HorseTrainerHistoryEntryDto[];
  stableHistory: HorseStableHistoryEntryDto[];
  breedingMetadata: HorseBreedingMetadataDto;
  registrationRecords: HorseRegistrationRecordDto[];
  eligibilityStatus: HorseEligibilityStatusDto;
  retirementRecord?: HorseRetirementRecordDto;
  digitalTwin: HorseDigitalTwinSyncDto;
  lifecycleHistory: HorseLifecycleHistoryEntryDto[];
  version: number;
  auditIds: string[];
  eventIds: string[];
  lastAuditId: string;
  updatedAt: string;
  updatedBy: string;
}

export interface HorseRegistryWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof horseRegistrySchemaVersion;
  tenantId: string;
  racetrackId: string;
  horses: HorseRegistryRecordDto[];
  lifecycleSummary: Record<HorseRegistryLifecycleStatus, number>;
  lifecycleLegend: HorseRegistryLifecycleStatus[];
  auditTrail: HorseLifecycleHistoryEntryDto[];
  twinSyncCount: number;
  mock: false;
}

export interface HorseRegistryMutationResultDto {
  accepted: true;
  horseId: string;
  auditId: string;
  eventType: string;
  lifecycleStatus: HorseRegistryLifecycleStatus;
  twinSynced: boolean;
  message: string;
  mock: false;
}

export interface HorseRegistryAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof horseRegistrySchemaVersion;
  records: HorseLifecycleHistoryEntryDto[];
  mock: false;
}
