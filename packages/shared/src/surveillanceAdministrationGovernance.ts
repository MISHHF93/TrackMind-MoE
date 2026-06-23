import type { EntityId, ISODateTime } from './foundation.js';
import type { Role } from './accessControl.js';
import { surveillanceIoTArchitectureSchemaVersion } from './surveillanceIoTArchitecture.js';

export const surveillanceAdministrationGovernanceSchemaVersion = 'trackmind.surveillance-admin-governance.v1' as const;

/** Canonical administration action kinds audited across CCTV and IoT admin surfaces. */
export const surveillanceAdministrationActionKinds = [
  'device-creation',
  'device-reassignment',
  'zone-remapping',
  'retention-policy-change',
  'alert-rule-change',
  'health-override',
  'maintenance-status-change',
  'surveillance-evidence-linking',
  'privileged-config-access',
] as const;

export type SurveillanceAdministrationActionKind = typeof surveillanceAdministrationActionKinds[number];

export const surveillanceAdministrationRiskTiers = ['low', 'medium', 'high', 'critical'] as const;
export type SurveillanceAdministrationRiskTier = typeof surveillanceAdministrationRiskTiers[number];

export const surveillanceAdministrationApprovalStatuses = [
  'not-required',
  'pending',
  'approved',
  'rejected',
  'expired',
] as const;
export type SurveillanceAdministrationApprovalStatus = typeof surveillanceAdministrationApprovalStatuses[number];

export interface SurveillanceAdministrationAuditRecordDto {
  auditId: EntityId;
  actionKind: SurveillanceAdministrationActionKind;
  action: string;
  layer: 'administration' | 'alerting' | 'evidence' | 'governance';
  actorId: EntityId;
  subjectId: EntityId;
  timestamp: ISODateTime;
  riskTier: SurveillanceAdministrationRiskTier;
  approvalStatus: SurveillanceAdministrationApprovalStatus;
  approvalRequestId?: EntityId;
  reason?: string;
  changes: string[];
  beforeSnapshot?: Record<string, string>;
  afterSnapshot?: Record<string, string>;
  evidence: string[];
}

export interface SurveillanceAdministrationApprovalPolicyDto {
  actionKind: SurveillanceAdministrationActionKind;
  riskTier: SurveillanceAdministrationRiskTier;
  requiresApproval: boolean;
  approverRoles: Role[];
  description: string;
}

export interface SurveillanceAdministrationApprovalRequestDto {
  approvalRequestId: EntityId;
  actionKind: SurveillanceAdministrationActionKind;
  targetId: EntityId;
  requestedBy: EntityId;
  requestedAt: ISODateTime;
  expiresAt: ISODateTime;
  status: Extract<SurveillanceAdministrationApprovalStatus, 'pending' | 'approved' | 'rejected' | 'expired'>;
  reason: string;
  requiredApproverRoles: Role[];
  changes: string[];
  evidence: string[];
  auditId: EntityId;
  decidedBy?: EntityId;
  decidedAt?: ISODateTime;
  decisionReason?: string;
}

export interface SurveillanceAdministrationGovernanceSummaryDto {
  auditedActionCount: number;
  pendingApprovalCount: number;
  highRiskActionCount24h: number;
  lastAdministrationActionAt?: ISODateTime;
}

export interface SurveillanceAdministrationGovernanceWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceAdministrationGovernanceSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  summary: SurveillanceAdministrationGovernanceSummaryDto;
  auditTrail: SurveillanceAdministrationAuditRecordDto[];
  pendingApprovals: SurveillanceAdministrationApprovalRequestDto[];
  approvalPolicies: SurveillanceAdministrationApprovalPolicyDto[];
  mock: boolean;
}

export interface SurveillanceDeviceCreationRequestDto {
  deviceKind: 'camera-device' | 'iot-device';
  displayName: string;
  assignedDomain?: string;
  facilityZoneId?: EntityId;
  adapterId?: string;
  externalDeviceId?: string;
  reason: string;
}

export interface SurveillanceRetentionPolicyChangeRequestDto {
  policyId: EntityId;
  retentionDays?: number;
  disposition?: string;
  legalHoldEligible?: boolean;
  privacyMaskingRequired?: boolean;
  reason: string;
}

export interface SurveillanceAlertRuleChangeRequestDto {
  ruleId: EntityId;
  enabled?: boolean;
  severity?: string;
  conditionExpression?: string;
  reason: string;
}

export interface SurveillanceHealthOverrideRequestDto {
  deviceId: EntityId;
  deviceKind: 'camera-device' | 'iot-device';
  overrideHealthBand: 'healthy' | 'degraded' | 'critical' | 'unknown';
  expiresAt?: ISODateTime;
  reason: string;
}

export interface SurveillanceMaintenanceStatusChangeRequestDto {
  deviceId: EntityId;
  deviceKind: 'camera-device' | 'iot-device';
  maintenanceStatus: 'none' | 'scheduled' | 'in-progress' | 'completed' | 'deferred' | 'cancelled';
  maintenanceType?: string;
  reason: string;
}

export interface SurveillanceEvidenceLinkRequestDto {
  evidenceId: EntityId;
  incidentId?: EntityId;
  cameraId?: EntityId;
  clipStartAt?: ISODateTime;
  clipEndAt?: ISODateTime;
  reason: string;
}

export interface SurveillancePrivilegedConfigAccessRequestDto {
  configScope: 'retention-policies' | 'alert-rules' | 'privacy-masking' | 'adapter-credentials' | 'stream-endpoints';
  targetId?: EntityId;
  reason: string;
}

export interface SurveillanceAdministrativeMutationResultDto {
  auditId: EntityId;
  applied: boolean;
  approvalRequired: boolean;
  approvalRequestId?: EntityId;
  pendingApproval?: boolean;
  actionKind: SurveillanceAdministrationActionKind;
  targetId: EntityId;
  changes: string[];
  message: string;
}

export const surveillanceAdministrationGovernanceContractSchemas = {
  SurveillanceAdministrationGovernanceWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceAdministrationGovernanceSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'auditTrail', required: true, type: 'array' },
    { path: 'pendingApprovals', required: true, type: 'array' },
    { path: 'approvalPolicies', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceAdministrativeMutationResultDto: [
    { path: 'auditId', required: true, type: 'string' },
    { path: 'applied', required: true, type: 'boolean' },
    { path: 'approvalRequired', required: true, type: 'boolean' },
    { path: 'actionKind', required: true, type: 'string' },
    { path: 'targetId', required: true, type: 'string' },
    { path: 'changes', required: true, type: 'array' },
    { path: 'message', required: true, type: 'string' },
  ],
} as const;
