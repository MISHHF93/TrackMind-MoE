export const raceCardManagementSchemaVersion = 'trackmind.race-card-management.v1' as const;

export const raceCardLifecycleStatuses = [
  'draft',
  'review',
  'approved',
  'published',
  'completed',
  'archived',
] as const;

export type RaceCardLifecycleStatus = typeof raceCardLifecycleStatuses[number];

export type RaceCardSurfaceType = 'dirt' | 'turf' | 'synthetic';
export type RaceCardEntryStatus = 'entered' | 'declared' | 'scratched' | 'starter' | 'also-eligible';

export interface RaceCardConditionsDto {
  surface: RaceCardSurfaceType;
  distanceFurlongs: number;
  trackCondition?: string;
  eligibility: string[];
  medicationRules: string[];
  weatherRestrictions: string[];
  surfaceRequirements: string[];
  ageRestriction?: string;
  sexRestriction?: string;
}

export interface RaceCardClassificationDto {
  classLevel: string;
  division?: string;
  claimingPrice?: number;
  allowanceConditions?: string[];
  stakesGrade?: 'graded-1' | 'graded-2' | 'graded-3' | 'listed' | 'stakes' | 'allowance' | 'claiming' | 'maiden' | 'other';
  restrictionType?: string;
}

export interface RaceCardPurseDto {
  basePurse: number;
  currency: string;
  availableMoney?: number;
  starterBonus?: number;
  breederAwards?: number;
  stateBredSupplement?: number;
  payoutStructure?: Array<{ position: number; percentage: number }>;
}

export interface RaceCardEntryDto {
  id: string;
  horseId: string;
  trainerId: string;
  jockeyId?: string;
  ownerIds: string[];
  programNumber?: string;
  postPosition?: number;
  weightLbs?: number;
  status: RaceCardEntryStatus;
  scratched: boolean;
  scratchReason?: string;
  equipmentFlags: string[];
  medicationFlags: string[];
  auditId: string;
  updatedAt: string;
}

export interface RaceCardAuditRecordDto {
  auditId: string;
  raceCardId: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  lifecycleFrom?: RaceCardLifecycleStatus;
  lifecycleTo?: RaceCardLifecycleStatus;
  changeSummary: string;
  evidence: string[];
}

export interface ManagedRaceCardDto {
  id: string;
  raceDayId: string;
  racetrackId: string;
  raceDate: string;
  raceNumber: number;
  scheduledPostTime: string;
  lifecycleStatus: RaceCardLifecycleStatus;
  conditions: RaceCardConditionsDto;
  classification: RaceCardClassificationDto;
  purse: RaceCardPurseDto;
  entries: RaceCardEntryDto[];
  entryCount: number;
  activeEntryCount: number;
  approvalRequired: boolean;
  version: number;
  auditIds: string[];
  eventIds: string[];
  lastAuditId: string;
  updatedAt: string;
  updatedBy: string;
}

export interface RaceCardWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof raceCardManagementSchemaVersion;
  tenantId: string;
  racetrackId: string;
  raceCards: ManagedRaceCardDto[];
  lifecycleSummary: Record<RaceCardLifecycleStatus, number>;
  lifecycleLegend: RaceCardLifecycleStatus[];
  approvalControls: Array<{
    id: string;
    label: string;
    action: string;
    target: string;
    reason: string;
    requiredRoles: string[];
    evidence: string[];
    locked: true;
  }>;
  auditTrail: RaceCardAuditRecordDto[];
  mock: false;
}

export interface RaceCardMutationResultDto {
  accepted: true;
  raceCardId: string;
  auditId: string;
  eventType: string;
  lifecycleStatus: RaceCardLifecycleStatus;
  approvalRequired?: boolean;
  approvalId?: string;
  message: string;
  mock: false;
}

export interface RaceCardLifecycleTransitionDto {
  from: RaceCardLifecycleStatus;
  to: RaceCardLifecycleStatus;
  trigger: string;
  approvalRequired: boolean;
  protectedAction?: string;
}

export interface RaceCardAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof raceCardManagementSchemaVersion;
  records: RaceCardAuditRecordDto[];
  mock: false;
}

export const raceCardLifecycleTransitions: readonly RaceCardLifecycleTransitionDto[] = [
  { from: 'draft', to: 'review', trigger: 'submit for steward review', approvalRequired: false },
  { from: 'review', to: 'draft', trigger: 'return for corrections', approvalRequired: false },
  { from: 'review', to: 'approved', trigger: 'steward approval recorded', approvalRequired: true, protectedAction: 'race-office-configuration' },
  { from: 'approved', to: 'published', trigger: 'publish condition book', approvalRequired: true, protectedAction: 'race-office-configuration' },
  { from: 'published', to: 'completed', trigger: 'race declared official', approvalRequired: false },
  { from: 'completed', to: 'archived', trigger: 'archive card after retention review', approvalRequired: false },
];
