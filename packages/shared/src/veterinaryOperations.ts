import type { Role } from './accessControl.js';

export const veterinaryOperationsSchemaVersion = 'trackmind.veterinary-operations.v1' as const;

export type VeterinaryPrivacyScope =
  | 'public'
  | 'racing-officials'
  | 'care-team'
  | 'regulator'
  | 'veterinary-confidential';

export type VeterinaryRecordCategory =
  | 'examination'
  | 'observation'
  | 'treatment'
  | 'medication'
  | 'injury'
  | 'lab'
  | 'clearance'
  | 'other';

export type ClearanceWorkflowStatus = 'pending' | 'in-review' | 'cleared' | 'denied' | 'expired';
export type ClearanceWorkflowType = 'pre-race' | 'post-injury' | 'medication-withdrawal' | 'return-to-training' | 'general';
export type TreatmentStatus = 'planned' | 'active' | 'completed' | 'discontinued';
export type WelfareIndicatorBand = 'excellent' | 'acceptable' | 'watch' | 'intervention-required';

export interface VeterinaryPrivacyContextDto {
  role: Role | 'anonymous';
  allowedScopes: VeterinaryPrivacyScope[];
  redactedFields: string[];
  reason: string;
}

export interface VeterinaryRecordDto {
  recordId: string;
  horseId: string;
  recordedAt: string;
  veterinarianId: string;
  category: VeterinaryRecordCategory;
  summary: string;
  privacyScope: VeterinaryPrivacyScope;
  diagnosis?: string;
  medication?: string;
  dosage?: string;
  withdrawalUntil?: string;
  restrictedDetail?: string;
  evidence: string[];
  auditId: string;
  redacted?: boolean;
}

export interface VeterinaryExaminationDto {
  examinationId: string;
  horseId: string;
  examinedAt: string;
  veterinarianId: string;
  examType: 'pre-race' | 'post-race' | 'routine' | 'injury-follow-up' | 'return-to-training';
  findingsSummary: string;
  gaitAssessment?: string;
  bodyConditionScore?: number;
  privacyScope: VeterinaryPrivacyScope;
  clearanceRequired: boolean;
  evidence: string[];
  auditId: string;
  redacted?: boolean;
}

export interface VeterinaryObservationDto {
  observationId: string;
  horseId: string;
  observedAt: string;
  observerId: string;
  observerRole: string;
  observationType?: string;
  category: 'gait' | 'appetite' | 'behavior' | 'hydration' | 'injury-sign' | 'other';
  summary: string;
  notes?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  followUpNeeded?: boolean;
  clearanceState?: 'none' | 'pending-review' | 'cleared' | 'restricted' | 'vet-hold' | 'denied';
  restrictions?: string[];
  raceDayImpact?: 'none' | 'monitor-only' | 'paddock-hold' | 'gate-delay' | 'scratch-recommended' | 'eligibility-hold';
  privacyScope: VeterinaryPrivacyScope;
  evidence: string[];
  auditId: string;
  immutable?: true;
  redacted?: boolean;
}

export interface TreatmentTrackingDto {
  treatmentId: string;
  horseId: string;
  startedAt: string;
  endedAt?: string;
  veterinarianId: string;
  treatmentType: string;
  status: TreatmentStatus;
  summary: string;
  medication?: string;
  privacyScope: VeterinaryPrivacyScope;
  linkedRecordIds: string[];
  evidence: string[];
  auditId: string;
  redacted?: boolean;
}

export interface ClearanceWorkflowDto {
  workflowId: string;
  horseId: string;
  clearanceType: ClearanceWorkflowType;
  status: ClearanceWorkflowStatus;
  requestedAt: string;
  requestedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  expiresAt?: string;
  requiredApprovals: string[];
  failedRules: string[];
  evidence: string[];
  auditId: string;
}

export interface WelfareIndicatorDto {
  indicatorId: string;
  horseId: string;
  observedAt: string;
  category: 'body-condition' | 'gait' | 'appetite' | 'hydration' | 'behavior' | 'transport';
  score: number;
  band: WelfareIndicatorBand;
  summary: string;
  privacyScope: VeterinaryPrivacyScope;
  evidence: string[];
  auditId: string;
  redacted?: boolean;
}

export interface ManagedHorseVeterinaryCaseDto {
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
  privacy: VeterinaryPrivacyContextDto;
  clearanceStatus: 'cleared' | 'pending' | 'restricted' | 'denied';
  welfareBand: WelfareIndicatorBand;
  version: number;
  auditIds: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface VeterinaryOperationsKpiDto {
  kpiId: string;
  horseId?: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  target: number;
  status: 'nominal' | 'watch' | 'warning' | 'critical' | 'blocked';
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  auditReference: { auditIds: string[]; eventIds: string[] };
}

export interface VeterinaryOperationsDashboardDto {
  activeCases: number;
  pendingClearances: number;
  openTreatments: number;
  welfareWatchCount: number;
  privacyGuardrailCoveragePct: number;
  panels: VeterinaryOperationsKpiDto[];
}

export interface VeterinaryAuditRecordDto {
  auditId: string;
  horseId?: string;
  action: string;
  actor: string;
  role: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  privacyScope?: VeterinaryPrivacyScope;
  redactedAccess?: boolean;
  evidence: string[];
}

export interface VeterinaryOperationsWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof veterinaryOperationsSchemaVersion;
  tenantId: string;
  racetrackId: string;
  cases: ManagedHorseVeterinaryCaseDto[];
  statusSummary: {
    cleared: number;
    pending: number;
    restricted: number;
    denied: number;
  };
  dashboard: VeterinaryOperationsDashboardDto;
  privacy: VeterinaryPrivacyContextDto;
  auditTrail: VeterinaryAuditRecordDto[];
  mock: false;
}

export interface VeterinaryMutationResultDto {
  accepted: true;
  horseId: string;
  auditId: string;
  eventType: string;
  message: string;
  mock: false;
}

export interface VeterinaryOperationsAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof veterinaryOperationsSchemaVersion;
  records: VeterinaryAuditRecordDto[];
  mock: false;
}

export const veterinaryPrivacyScopesByRole: Record<Role, VeterinaryPrivacyScope[]> = {
  'platform-super-admin': ['public', 'racing-officials', 'care-team', 'regulator', 'veterinary-confidential'],
  'organization-admin': ['public', 'racing-officials', 'care-team', 'regulator'],
  'racetrack-admin': ['public', 'racing-officials', 'care-team'],
  'race-day-operations-manager': ['public', 'racing-officials'],
  steward: ['public', 'racing-officials', 'regulator'],
  'starter-official': ['public', 'racing-officials'],
  'paddock-official': ['public', 'racing-officials'],
  'equine-welfare-officer': ['public', 'racing-officials', 'care-team'],
  veterinarian: ['public', 'racing-officials', 'care-team', 'veterinary-confidential'],
  'horse-operations-coordinator': ['public', 'racing-officials'],
  'security-manager': ['public'],
  'facilities-manager': ['public', 'racing-officials', 'care-team'],
  'compliance-officer': ['public', 'racing-officials', 'care-team', 'regulator', 'veterinary-confidential'],
  'finance-manager': ['public'],
  'ticketing-fan-manager': ['public'],
  executive: ['public', 'racing-officials', 'regulator'],
  'read-only-auditor': ['public', 'racing-officials', 'regulator'],
  'data-analytics-user': ['public'],
  'support-operator': ['public', 'racing-officials'],
  'staff-limited': ['public'],
  'ai-safety-agent': ['public'],
};
