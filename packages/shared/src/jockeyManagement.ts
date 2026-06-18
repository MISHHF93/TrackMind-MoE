export const jockeyManagementSchemaVersion = 'trackmind.jockey-management.v1' as const;

export type JockeyStatus = 'active' | 'suspended' | 'inactive';
export type JockeyLicenseStatus = 'active' | 'expired' | 'suspended' | 'pending-renewal';
export type JockeyComplianceStatus = 'compliant' | 'under-review' | 'suspended' | 'finding-open';
export type JockeyEligibilityStatus = 'eligible' | 'under-review' | 'suspended' | 'ineligible';

export interface JockeyLicensingMetadataDto {
  licenseNumber: string;
  issuingAuthority: string;
  jurisdiction: string;
  status: JockeyLicenseStatus;
  issuedOn: string;
  expiresOn: string;
  renewalDueOn?: string;
  weightAllowanceLbs?: number;
  restrictions: string[];
  evidence: string[];
}

export interface JockeyAssignmentDto {
  assignmentId: string;
  horseId: string;
  horseName?: string;
  raceCardId?: string;
  entryId?: string;
  assignedAt: string;
  releasedAt?: string;
  weightLbs?: number;
  postPosition?: number;
  active: boolean;
  evidence: string[];
  auditId: string;
}

export interface JockeyRaceParticipationDto {
  participationId: string;
  raceId: string;
  raceCardId?: string;
  raceDate: string;
  trackId: string;
  horseId: string;
  finishPosition?: number;
  status: 'declared' | 'started' | 'completed' | 'scratched' | 'disqualified';
  earningsCents?: number;
  evidence: string[];
  auditId: string;
}

export interface JockeyPerformanceAnalyticsDto {
  starts: number;
  wins: number;
  places: number;
  shows: number;
  winRate: number;
  inTheMoneyRate: number;
  averageFinish?: number;
  earningsCents: number;
  updatedAt: string;
}

export interface JockeyComplianceRecordDto {
  recordId: string;
  recordedAt: string;
  category: 'medication' | 'conduct' | 'weigh-in' | 'license' | 'steward-inquiry' | 'other';
  summary: string;
  status: 'open' | 'resolved' | 'appealed';
  stewardInquiryId?: string;
  evidence: string[];
  auditId: string;
}

export interface JockeyEligibilityTrackingDto {
  status: JockeyEligibilityStatus;
  eligible: boolean;
  flags: string[];
  failedRules: string[];
  suspensionReason?: string;
  reviewedAt: string;
  reviewedBy: string;
}

export interface JockeyEntityLinksDto {
  raceIds: string[];
  horseIds: string[];
  incidentIds: string[];
  auditIds: string[];
  stewardInquiryIds: string[];
}

export interface JockeyKpiDto {
  kpiId: string;
  jockeyId?: string;
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

export interface JockeyKpiDashboardDto {
  activeJockeys: number;
  eligibleJockeys: number;
  suspendedJockeys: number;
  totalStarts: number;
  averageWinRate: number;
  complianceCoveragePct: number;
  panels: JockeyKpiDto[];
}

export interface JockeyAuditRecordDto {
  auditId: string;
  jockeyId: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface ManagedJockeyProfileDto {
  jockeyId: string;
  tenantId: string;
  racetrackId: string;
  displayName: string;
  status: JockeyStatus;
  licensing: JockeyLicensingMetadataDto;
  assignments: JockeyAssignmentDto[];
  raceParticipation: JockeyRaceParticipationDto[];
  performanceAnalytics: JockeyPerformanceAnalyticsDto;
  complianceRecords: JockeyComplianceRecordDto[];
  eligibility: JockeyEligibilityTrackingDto;
  links: JockeyEntityLinksDto;
  kpis: JockeyKpiDto[];
  version: number;
  auditIds: string[];
  eventIds: string[];
  lastAuditId: string;
  updatedAt: string;
  updatedBy: string;
}

export interface JockeyManagementWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof jockeyManagementSchemaVersion;
  tenantId: string;
  racetrackId: string;
  jockeys: ManagedJockeyProfileDto[];
  statusSummary: Record<JockeyStatus, number>;
  dashboard: JockeyKpiDashboardDto;
  auditTrail: JockeyAuditRecordDto[];
  mock: false;
}

export interface JockeyMutationResultDto {
  accepted: true;
  jockeyId: string;
  auditId: string;
  eventType: string;
  status: JockeyStatus;
  message: string;
  mock: false;
}

export interface JockeyManagementAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof jockeyManagementSchemaVersion;
  records: JockeyAuditRecordDto[];
  mock: false;
}
