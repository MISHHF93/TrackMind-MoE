export const trainerManagementSchemaVersion = 'trackmind.trainer-management.v1' as const;

export type TrainerStatus = 'active' | 'suspended' | 'inactive';
export type TrainerLicenseStatus = 'active' | 'expired' | 'suspended' | 'pending-renewal';
export type TrainerComplianceStatus = 'compliant' | 'under-review' | 'suspended' | 'finding-open';

export interface TrainerLicensingMetadataDto {
  licenseNumber: string;
  issuingAuthority: string;
  jurisdiction: string;
  status: TrainerLicenseStatus;
  issuedOn: string;
  expiresOn: string;
  renewalDueOn?: string;
  restrictions: string[];
  evidence: string[];
}

export interface TrainerStableAssignmentDto {
  barnId: string;
  barnName?: string;
  assignedAt: string;
  releasedAt?: string;
  assignedBy: string;
  active: boolean;
  evidence: string[];
  auditId: string;
}

export interface TrainerHorseAssignmentDto {
  horseId: string;
  horseName?: string;
  assignedAt: string;
  releasedAt?: string;
  active: boolean;
  evidence: string[];
  auditId: string;
}

export interface TrainerPerformanceRecordDto {
  recordId: string;
  raceId: string;
  raceDate: string;
  trackId: string;
  horseId: string;
  finishPosition?: number;
  earningsCents?: number;
  status: 'entered' | 'started' | 'completed' | 'scratched' | 'disqualified';
  evidence: string[];
  auditId: string;
}

export interface TrainerCompliancePostureDto {
  status: TrainerComplianceStatus;
  openFindings: string[];
  lastReviewedAt: string;
  reviewedBy: string;
  medicationViolations: number;
  welfareFlags: number;
  stewardInquiries: number;
  evidence: string[];
}

export interface TrainerEntityLinksDto {
  raceIds: string[];
  horseIds: string[];
  incidentIds: string[];
  auditIds: string[];
  barnIds: string[];
}

export interface TrainerKpiDto {
  kpiId: string;
  trainerId?: string;
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

export interface TrainerAuditRecordDto {
  auditId: string;
  trainerId: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface ManagedTrainerProfileDto {
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
  kpis: TrainerKpiDto[];
  version: number;
  auditIds: string[];
  eventIds: string[];
  lastAuditId: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TrainerManagementWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof trainerManagementSchemaVersion;
  tenantId: string;
  racetrackId: string;
  trainers: ManagedTrainerProfileDto[];
  statusSummary: Record<TrainerStatus, number>;
  kpis: TrainerKpiDto[];
  auditTrail: TrainerAuditRecordDto[];
  mock: false;
}

export interface TrainerMutationResultDto {
  accepted: true;
  trainerId: string;
  auditId: string;
  eventType: string;
  status: TrainerStatus;
  message: string;
  mock: false;
}

export interface TrainerManagementAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof trainerManagementSchemaVersion;
  records: TrainerAuditRecordDto[];
  mock: false;
}
