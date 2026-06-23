import type {
  Role,
  SurveillanceAdministrationActionKind,
  SurveillanceAdministrationApprovalPolicyDto,
  SurveillanceAdministrationApprovalRequestDto,
  SurveillanceAdministrationApprovalStatus,
  SurveillanceAdministrationAuditRecordDto,
  SurveillanceAdministrationGovernanceSummaryDto,
  SurveillanceAdministrationGovernanceWorkspaceDto,
  SurveillanceAdministrationRiskTier,
  SurveillanceAdministrativeMutationResultDto,
  SurveillanceAlertRuleChangeRequestDto,
  SurveillanceDeviceCreationRequestDto,
  SurveillanceEvidenceLinkRequestDto,
  SurveillanceHealthOverrideRequestDto,
  SurveillanceMaintenanceStatusChangeRequestDto,
  SurveillancePrivilegedConfigAccessRequestDto,
  SurveillanceRetentionPolicyChangeRequestDto,
} from '@trackmind/shared';
import {
  surveillanceAdministrationGovernanceSchemaVersion,
} from '@trackmind/shared';
import type { AuditGovernanceService } from './auditGovernanceService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';
import { auditIds } from '../types.js';

const APPROVAL_EXPIRY_MINUTES = 240;

const APPROVAL_POLICIES: SurveillanceAdministrationApprovalPolicyDto[] = [
  {
    actionKind: 'device-creation',
    riskTier: 'medium',
    requiresApproval: false,
    approverRoles: ['platform-super-admin', 'organization-admin'],
    description: 'New camera or IoT device registration is audit-logged immediately.',
  },
  {
    actionKind: 'device-reassignment',
    riskTier: 'medium',
    requiresApproval: false,
    approverRoles: ['platform-super-admin', 'security-manager'],
    description: 'Domain or workflow reassignment is audit-logged; sensitive zone moves require approval.',
  },
  {
    actionKind: 'zone-remapping',
    riskTier: 'high',
    requiresApproval: false,
    approverRoles: ['platform-super-admin', 'security-manager', 'compliance-officer'],
    description: 'Operational zone remapping requires approval when targeting restricted or security-sensitive zones.',
  },
  {
    actionKind: 'retention-policy-change',
    riskTier: 'critical',
    requiresApproval: true,
    approverRoles: ['platform-super-admin', 'compliance-officer', 'security-manager'],
    description: 'Retention policy modifications affect evidence disposition and regulatory compliance.',
  },
  {
    actionKind: 'alert-rule-change',
    riskTier: 'high',
    requiresApproval: true,
    approverRoles: ['platform-super-admin', 'security-manager'],
    description: 'Surveillance alert rule changes require security manager approval.',
  },
  {
    actionKind: 'health-override',
    riskTier: 'medium',
    requiresApproval: false,
    approverRoles: ['platform-super-admin', 'security-manager', 'facilities-manager'],
    description: 'Health band overrides are audit-logged for operational transparency.',
  },
  {
    actionKind: 'maintenance-status-change',
    riskTier: 'low',
    requiresApproval: false,
    approverRoles: ['platform-super-admin', 'facilities-manager'],
    description: 'Maintenance status transitions are audit-logged.',
  },
  {
    actionKind: 'surveillance-evidence-linking',
    riskTier: 'high',
    requiresApproval: false,
    approverRoles: ['platform-super-admin', 'security-manager', 'compliance-officer'],
    description: 'Evidence linkage to incidents is audit-logged with actor and reason.',
  },
  {
    actionKind: 'privileged-config-access',
    riskTier: 'critical',
    requiresApproval: false,
    approverRoles: ['platform-super-admin', 'compliance-officer'],
    description: 'Privileged configuration access is always audit-logged; access itself is not blocked.',
  },
];

export interface AdministrationActionInput {
  actionKind: SurveillanceAdministrationActionKind;
  action: string;
  layer: SurveillanceAdministrationAuditRecordDto['layer'];
  subjectId: string;
  reason?: string;
  changes: string[];
  beforeSnapshot?: Record<string, string>;
  afterSnapshot?: Record<string, string>;
  evidence?: string[];
  forceApproval?: boolean;
}

interface PendingApprovalPayload {
  actionKind: SurveillanceAdministrationActionKind;
  targetId: string;
  changes: string[];
  reason: string;
  evidence: string[];
  apply: () => void;
}

function policyFor(actionKind: SurveillanceAdministrationActionKind): SurveillanceAdministrationApprovalPolicyDto {
  return APPROVAL_POLICIES.find((entry) => entry.actionKind === actionKind) ?? APPROVAL_POLICIES[0]!;
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export class SurveillanceAdministrationGovernanceService {
  private readonly auditTrail: SurveillanceAdministrationAuditRecordDto[] = [];
  private readonly pendingApprovals = new Map<string, SurveillanceAdministrationApprovalRequestDto>();
  private readonly pendingPayloads = new Map<string, PendingApprovalPayload>();
  private readonly createdDevices = new Map<string, { displayName: string; deviceKind: string; createdAt: string }>();
  private readonly healthOverrides = new Map<string, { healthBand: string; expiresAt?: string; reason: string }>();
  private readonly maintenanceRecords = new Map<string, { status: string; maintenanceType?: string; reason: string }>();
  private readonly evidenceLinks = new Map<string, { incidentId?: string; cameraId?: string; linkedAt: string }>();
  private readonly retentionOverrides = new Map<string, Record<string, string>>();
  private readonly alertRuleOverrides = new Map<string, Record<string, string>>();

  seedDemonstrationRecords(ctx: SurveillanceIoTModuleContext, audit: AuditGovernanceService): void {
    if (this.auditTrail.length > 0) return;
    this.recordAction(ctx, audit, {
      actionKind: 'privileged-config-access',
      action: 'surveillance.privileged-config.accessed',
      layer: 'governance',
      subjectId: 'retention-policies',
      reason: 'Compliance review of default retention posture',
      changes: ['configScope:retention-policies'],
      evidence: ['seed:demonstration'],
    });
    this.recordAction(ctx, audit, {
      actionKind: 'surveillance-evidence-linking',
      action: 'surveillance.evidence.linked',
      layer: 'evidence',
      subjectId: 'evidence:clip-001',
      reason: 'Incident correlation for security review',
      changes: ['incidentId:inc-1'],
      evidence: ['seed:demonstration'],
    });
  }

  requiresApprovalForZoneRemapping(zoneSensitivities: string[]): boolean {
    return zoneSensitivities.some((sensitivity) => sensitivity === 'restricted' || sensitivity === 'security-sensitive');
  }

  recordAction(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    input: AdministrationActionInput,
  ): { record: SurveillanceAdministrationAuditRecordDto; applied: boolean; approvalRequestId?: string } {
    const policy = policyFor(input.actionKind);
    const needsApproval = input.forceApproval ?? policy.requiresApproval;
    const envelope = auditIds(ctx.now, `admin-governance:${input.actionKind}:${input.subjectId}`);
    const approvalStatus: SurveillanceAdministrationApprovalStatus = needsApproval ? 'pending' : 'not-required';
    const riskTier = input.forceApproval ? 'high' : policy.riskTier;

    audit.record(ctx, input.layer === 'governance' ? 'administration' : input.layer, input.action, input.subjectId, [
      ...input.changes,
      `actionKind:${input.actionKind}`,
      `riskTier:${riskTier}`,
      ...(input.reason ? [`reason:${input.reason}`] : []),
    ]);

    const record: SurveillanceAdministrationAuditRecordDto = {
      auditId: envelope.auditId,
      actionKind: input.actionKind,
      action: input.action,
      layer: input.layer,
      actorId: ctx.actor.id,
      subjectId: input.subjectId,
      timestamp: ctx.now,
      riskTier,
      approvalStatus,
      reason: input.reason,
      changes: input.changes,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      evidence: input.evidence ?? [],
    };

    this.auditTrail.unshift(record);
    if (this.auditTrail.length > 300) this.auditTrail.pop();

    return { record, applied: !needsApproval };
  }

  queueApproval(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    input: AdministrationActionInput,
    apply: () => void,
  ): SurveillanceAdministrativeMutationResultDto {
    const policy = policyFor(input.actionKind);
    const { record } = this.recordAction(ctx, audit, { ...input, forceApproval: true });
    const approvalRequestId = id('surv-approval');
    const expiresAt = addMinutes(ctx.now, APPROVAL_EXPIRY_MINUTES);

    const request: SurveillanceAdministrationApprovalRequestDto = {
      approvalRequestId,
      actionKind: input.actionKind,
      targetId: input.subjectId,
      requestedBy: ctx.actor.id,
      requestedAt: ctx.now,
      expiresAt,
      status: 'pending',
      reason: input.reason ?? 'Administrative change pending approval',
      requiredApproverRoles: policy.approverRoles,
      changes: input.changes,
      evidence: input.evidence ?? [],
      auditId: record.auditId,
    };

    this.pendingApprovals.set(approvalRequestId, request);
    this.pendingPayloads.set(approvalRequestId, {
      actionKind: input.actionKind,
      targetId: input.subjectId,
      changes: input.changes,
      reason: input.reason ?? '',
      evidence: input.evidence ?? [],
      apply,
    });

    record.approvalRequestId = approvalRequestId;
    record.approvalStatus = 'pending';

    return {
      auditId: record.auditId,
      applied: false,
      approvalRequired: true,
      approvalRequestId,
      pendingApproval: true,
      actionKind: input.actionKind,
      targetId: input.subjectId,
      changes: input.changes,
      message: `Change queued for approval by ${policy.approverRoles.join(' or ')}.`,
    };
  }

  recordImmediate(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    input: AdministrationActionInput,
  ): SurveillanceAdministrativeMutationResultDto {
    const { record } = this.recordAction(ctx, audit, input);
    return {
      auditId: record.auditId,
      applied: true,
      approvalRequired: false,
      actionKind: input.actionKind,
      targetId: input.subjectId,
      changes: input.changes,
      message: 'Change applied and audit-logged.',
    };
  }

  createDevice(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    request: SurveillanceDeviceCreationRequestDto,
  ): SurveillanceAdministrativeMutationResultDto {
    const deviceId = id(request.deviceKind === 'camera-device' ? 'cam' : 'iot');
    const changes = [
      `deviceKind:${request.deviceKind}`,
      `displayName:${request.displayName.trim()}`,
      ...(request.assignedDomain ? [`assignedDomain:${request.assignedDomain}`] : []),
      ...(request.facilityZoneId ? [`facilityZoneId:${request.facilityZoneId}`] : []),
    ];
    this.createdDevices.set(deviceId, {
      displayName: request.displayName.trim(),
      deviceKind: request.deviceKind,
      createdAt: ctx.now,
    });
    return this.recordImmediate(ctx, audit, {
      actionKind: 'device-creation',
      action: 'surveillance.device.created',
      layer: 'administration',
      subjectId: deviceId,
      reason: request.reason,
      changes,
      afterSnapshot: { deviceId, displayName: request.displayName.trim() },
      evidence: request.adapterId ? [`adapter:${request.adapterId}`] : [],
    });
  }

  requestRetentionPolicyChange(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    policyId: string,
    request: SurveillanceRetentionPolicyChangeRequestDto,
  ): SurveillanceAdministrativeMutationResultDto {
    const changes: string[] = [];
    const snapshot: Record<string, string> = { policyId };
    if (request.retentionDays !== undefined) {
      changes.push(`retentionDays:${request.retentionDays}`);
      snapshot.retentionDays = String(request.retentionDays);
    }
    if (request.disposition !== undefined) {
      changes.push(`disposition:${request.disposition}`);
      snapshot.disposition = request.disposition;
    }
    if (request.legalHoldEligible !== undefined) {
      changes.push(`legalHoldEligible:${request.legalHoldEligible}`);
      snapshot.legalHoldEligible = String(request.legalHoldEligible);
    }
    if (request.privacyMaskingRequired !== undefined) {
      changes.push(`privacyMaskingRequired:${request.privacyMaskingRequired}`);
      snapshot.privacyMaskingRequired = String(request.privacyMaskingRequired);
    }
    if (changes.length === 0) {
      throw new Error('No retention policy fields provided for change.');
    }
    return this.queueApproval(ctx, audit, {
      actionKind: 'retention-policy-change',
      action: 'surveillance.retention-policy.change-requested',
      layer: 'governance',
      subjectId: policyId,
      reason: request.reason,
      changes,
      afterSnapshot: snapshot,
    }, () => {
      this.retentionOverrides.set(policyId, snapshot);
    });
  }

  requestAlertRuleChange(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    ruleId: string,
    request: SurveillanceAlertRuleChangeRequestDto,
  ): SurveillanceAdministrativeMutationResultDto {
    const changes: string[] = [];
    const snapshot: Record<string, string> = { ruleId };
    if (request.enabled !== undefined) {
      changes.push(`enabled:${request.enabled}`);
      snapshot.enabled = String(request.enabled);
    }
    if (request.severity !== undefined) {
      changes.push(`severity:${request.severity}`);
      snapshot.severity = request.severity;
    }
    if (request.conditionExpression !== undefined) {
      changes.push(`conditionExpression:${request.conditionExpression}`);
      snapshot.conditionExpression = request.conditionExpression;
    }
    if (changes.length === 0) {
      throw new Error('No alert rule fields provided for change.');
    }
    return this.queueApproval(ctx, audit, {
      actionKind: 'alert-rule-change',
      action: 'surveillance.alert-rule.change-requested',
      layer: 'alerting',
      subjectId: ruleId,
      reason: request.reason,
      changes,
      afterSnapshot: snapshot,
    }, () => {
      this.alertRuleOverrides.set(ruleId, snapshot);
    });
  }

  applyHealthOverride(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    deviceId: string,
    request: SurveillanceHealthOverrideRequestDto,
  ): SurveillanceAdministrativeMutationResultDto {
    const key = `${request.deviceKind}:${deviceId}`;
    this.healthOverrides.set(key, {
      healthBand: request.overrideHealthBand,
      expiresAt: request.expiresAt,
      reason: request.reason,
    });
    return this.recordImmediate(ctx, audit, {
      actionKind: 'health-override',
      action: 'surveillance.health.override',
      layer: 'administration',
      subjectId: deviceId,
      reason: request.reason,
      changes: [`overrideHealthBand:${request.overrideHealthBand}`, `deviceKind:${request.deviceKind}`],
      afterSnapshot: { healthBand: request.overrideHealthBand },
      evidence: request.expiresAt ? [`expiresAt:${request.expiresAt}`] : [],
    });
  }

  changeMaintenanceStatus(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    deviceId: string,
    request: SurveillanceMaintenanceStatusChangeRequestDto,
  ): SurveillanceAdministrativeMutationResultDto {
    const key = `${request.deviceKind}:${deviceId}`;
    this.maintenanceRecords.set(key, {
      status: request.maintenanceStatus,
      maintenanceType: request.maintenanceType,
      reason: request.reason,
    });
    return this.recordImmediate(ctx, audit, {
      actionKind: 'maintenance-status-change',
      action: 'surveillance.maintenance.changed',
      layer: 'administration',
      subjectId: deviceId,
      reason: request.reason,
      changes: [
        `maintenanceStatus:${request.maintenanceStatus}`,
        `deviceKind:${request.deviceKind}`,
        ...(request.maintenanceType ? [`maintenanceType:${request.maintenanceType}`] : []),
      ],
    });
  }

  linkEvidence(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    request: SurveillanceEvidenceLinkRequestDto,
  ): SurveillanceAdministrativeMutationResultDto {
    this.evidenceLinks.set(request.evidenceId, {
      incidentId: request.incidentId,
      cameraId: request.cameraId,
      linkedAt: ctx.now,
    });
    const changes = [
      ...(request.incidentId ? [`incidentId:${request.incidentId}`] : []),
      ...(request.cameraId ? [`cameraId:${request.cameraId}`] : []),
      ...(request.clipStartAt ? [`clipStartAt:${request.clipStartAt}`] : []),
      ...(request.clipEndAt ? [`clipEndAt:${request.clipEndAt}`] : []),
    ];
    if (changes.length === 0) {
      throw new Error('Provide incidentId, cameraId, or clip window for evidence linkage.');
    }
    return this.recordImmediate(ctx, audit, {
      actionKind: 'surveillance-evidence-linking',
      action: 'surveillance.evidence.linked',
      layer: 'evidence',
      subjectId: request.evidenceId,
      reason: request.reason,
      changes,
    });
  }

  recordPrivilegedConfigAccess(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    request: SurveillancePrivilegedConfigAccessRequestDto,
  ): SurveillanceAdministrativeMutationResultDto {
    const subjectId = request.targetId ?? request.configScope;
    return this.recordImmediate(ctx, audit, {
      actionKind: 'privileged-config-access',
      action: 'surveillance.privileged-config.accessed',
      layer: 'governance',
      subjectId,
      reason: request.reason,
      changes: [`configScope:${request.configScope}`],
      evidence: ['privileged-access-audit'],
    });
  }

  decideApproval(
    ctx: SurveillanceIoTModuleContext,
    audit: AuditGovernanceService,
    approvalRequestId: string,
    decision: 'approved' | 'rejected',
    reason: string,
    actorRoles: Role[],
  ): SurveillanceAdministrativeMutationResultDto {
    const request = this.pendingApprovals.get(approvalRequestId);
    if (!request) {
      throw new Error(`Approval request ${approvalRequestId} not found.`);
    }
    if (request.status !== 'pending') {
      throw new Error(`Approval request ${approvalRequestId} is already ${request.status}.`);
    }
    if (Date.parse(request.expiresAt) <= Date.parse(ctx.now)) {
      request.status = 'expired';
      throw new Error(`Approval request ${approvalRequestId} has expired.`);
    }
    const canApprove = request.requiredApproverRoles.some((role) => actorRoles.includes(role));
    if (!canApprove) {
      throw new Error('Actor lacks approver role for this administration change.');
    }

    request.decidedBy = ctx.actor.id;
    request.decidedAt = ctx.now;
    request.decisionReason = reason;

    const auditRecord = this.auditTrail.find((entry) => entry.auditId === request.auditId);
    if (decision === 'approved') {
      request.status = 'approved';
      const payload = this.pendingPayloads.get(approvalRequestId);
      payload?.apply();
      this.pendingPayloads.delete(approvalRequestId);
      if (auditRecord) auditRecord.approvalStatus = 'approved';
      audit.record(ctx, 'administration', 'surveillance.approval.approved', request.targetId, [
        `approvalRequestId:${approvalRequestId}`,
        `actionKind:${request.actionKind}`,
        `reason:${reason}`,
      ]);
      return {
        auditId: request.auditId,
        applied: true,
        approvalRequired: false,
        actionKind: request.actionKind,
        targetId: request.targetId,
        changes: request.changes,
        message: 'Approval granted — change applied.',
      };
    }

    request.status = 'rejected';
    this.pendingPayloads.delete(approvalRequestId);
    if (auditRecord) auditRecord.approvalStatus = 'rejected';
    audit.record(ctx, 'administration', 'surveillance.approval.rejected', request.targetId, [
      `approvalRequestId:${approvalRequestId}`,
      `actionKind:${request.actionKind}`,
      `reason:${reason}`,
    ]);
    return {
      auditId: request.auditId,
      applied: false,
      approvalRequired: true,
      approvalRequestId,
      actionKind: request.actionKind,
      targetId: request.targetId,
      changes: request.changes,
      message: 'Approval rejected — change not applied.',
    };
  }

  buildSummary(): SurveillanceAdministrationGovernanceSummaryDto {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60_000;
    const highRiskActionCount24h = this.auditTrail.filter(
      (entry) => (entry.riskTier === 'high' || entry.riskTier === 'critical') && Date.parse(entry.timestamp) >= dayAgo,
    ).length;
    return {
      auditedActionCount: this.auditTrail.length,
      pendingApprovalCount: [...this.pendingApprovals.values()].filter((entry) => entry.status === 'pending').length,
      highRiskActionCount24h,
      lastAdministrationActionAt: this.auditTrail[0]?.timestamp,
    };
  }

  buildWorkspace(ctx: SurveillanceIoTModuleContext): SurveillanceAdministrationGovernanceWorkspaceDto {
    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceAdministrationGovernanceSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      summary: this.buildSummary(),
      auditTrail: [...this.auditTrail],
      pendingApprovals: [...this.pendingApprovals.values()].filter((entry) => entry.status === 'pending'),
      approvalPolicies: [...APPROVAL_POLICIES],
      mock: false,
    };
  }

  auditForSubject(subjectId: string): SurveillanceAdministrationAuditRecordDto[] {
    return this.auditTrail.filter((entry) => entry.subjectId === subjectId);
  }
}
