import type {
  CameraDeviceDto,
  CctvCameraRegistryEntryDto,
  CctvCameraRegistryMutationResultDto,
  CctvCameraRegistryUpdateRequestDto,
  CctvCameraRegistryWorkspaceDto,
  CctvCameraRegistryZoneGroupDto,
  CctvCameraType,
  Role,
  SurveillanceIoTDomainScope,
  SurveillanceIoTWorkspaceDto,
} from '@trackmind/shared';
import { normalizeRole, canRoleManageSurveillanceDevice, canRoleViewSurveillanceDomain, surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SecurityActor } from '../../securityOps.js';
import type { AuditGovernanceService } from '../governance/auditGovernanceService.js';
import type { SurveillanceAdministrationGovernanceService } from '../governance/surveillanceAdministrationGovernanceService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';
import { auditIds } from '../types.js';

interface CameraRegistryOverride {
  displayName?: string;
  assignedDomain?: SurveillanceIoTDomainScope;
  recordingMode?: CameraDeviceDto['recordingMode'];
  retentionPolicyId?: string;
  facilityZoneId?: string;
  updatedAt: string;
  updatedBy: string;
}

function actorRoles(actor: SecurityActor): Role[] {
  return (actor.roles ?? [])
    .map((role) => normalizeRole(role))
    .filter((role): role is Role => role !== undefined);
}

function canActorViewCamera(actor: SecurityActor, domain: SurveillanceIoTDomainScope): boolean {
  return actorRoles(actor).some((role) => canRoleViewSurveillanceDomain(role, domain));
}

function canActorEditCamera(actor: SecurityActor, domain: SurveillanceIoTDomainScope): boolean {
  return actorRoles(actor).some((role) => canRoleManageSurveillanceDevice(role, domain));
}

function inferCameraType(camera: CameraDeviceDto): CctvCameraType {
  if (camera.ptzCapable) return 'ptz';
  const haystack = camera.displayName.toLowerCase();
  if (haystack.includes('thermal')) return 'thermal';
  if (haystack.includes('lpr') || haystack.includes('plate')) return 'lpr';
  if (haystack.includes('dome')) return 'dome';
  return 'fixed';
}

function recordingStatus(
  stream: SurveillanceIoTWorkspaceDto['videoStreams'][number] | undefined,
  mode: CameraDeviceDto['recordingMode'],
): CctvCameraRegistryEntryDto['recordingStatus'] {
  if (mode === 'disabled') return 'disabled';
  if (!stream) return 'unknown';
  if (stream.recordingActive) return 'active';
  if (stream.streamStatus === 'offline') return 'paused';
  return 'paused';
}

export class CctvCameraRegistryService {
  private readonly overrides = new Map<string, CameraRegistryOverride>();

  private overrideKey(scope: SurveillanceIoTModuleContext['scope'], cameraId: string): string {
    return `${scope.tenantId}:${scope.racetrackId}:${cameraId}`;
  }

  buildEntry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    camera: CameraDeviceDto,
    actor: SecurityActor,
  ): CctvCameraRegistryEntryDto {
    const override = this.overrides.get(this.overrideKey(ctx.scope, camera.id));
    const stream = workspace.videoStreams.find((item) => item.cameraId === camera.id);
    const zone = workspace.deviceZones.find(
      (item) => item.id === camera.deviceZoneId || item.id === camera.securityZoneId || item.cameraIds.includes(camera.id),
    );
    const facilityZone = workspace.facilityZones.find(
      (item) => item.deviceZoneIds.includes(zone?.id ?? '') || item.assignedDeviceIds.includes(camera.id),
    );
    const retentionPolicy = workspace.retentionPolicies.find(
      (item) => item.id === (override?.retentionPolicyId ?? camera.retentionPolicyId ?? stream?.retentionPolicyId),
    );
    const assignedDomain = override?.assignedDomain ?? camera.domainScope;
    const displayName = override?.displayName ?? camera.displayName;
    const recordingMode = override?.recordingMode ?? camera.recordingMode;

    return {
      cameraId: camera.id,
      displayName,
      cameraType: inferCameraType(camera),
      zoneId: zone?.id ?? camera.securityZoneId,
      zoneLabel: zone?.displayName,
      facilityId: facilityZone?.facilityId ?? camera.facilityId,
      facilityLabel: facilityZone?.zoneLabel,
      streamStatus: stream?.streamStatus ?? 'offline',
      health: camera.health,
      deviceStatus: camera.status,
      assignedDomain,
      recordingStatus: recordingStatus(stream, recordingMode),
      recordingMode,
      retentionPolicyId: retentionPolicy?.id ?? camera.retentionPolicyId,
      retentionPolicyLabel: retentionPolicy?.policyName,
      lastSeenAt: camera.lastSeenAt,
      integration: {
        manufacturer: camera.manufacturer,
        model: camera.model,
        firmwareVersion: undefined,
        serialNumber: camera.serialNumber,
        adapterId: `adapter:camera:${camera.id}`,
        connectorId: 'camera-vms',
        integrationStatus: camera.integrationStatus,
        metadataPlaceholder: true,
      },
      canEdit: canActorEditCamera(actor, assignedDomain),
      mock: camera.mock,
      audit: camera.audit,
    };
  }

  buildRegistry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    actor: SecurityActor,
  ): CctvCameraRegistryWorkspaceDto {
    const entries = workspace.cameras
      .map((camera) => this.buildEntry(ctx, workspace, camera, actor))
      .filter((entry) => canActorViewCamera(actor, entry.assignedDomain));

    const zoneMap = new Map<string, CctvCameraRegistryZoneGroupDto>();
    for (const entry of entries) {
      const zoneId = entry.zoneId ?? 'unassigned';
      const zoneLabel = entry.zoneLabel ?? 'Unassigned';
      const existing = zoneMap.get(zoneId) ?? {
        zoneId,
        zoneLabel,
        facilityLabel: entry.facilityLabel,
        cameraCount: 0,
        onlineCount: 0,
        degradedCount: 0,
        offlineCount: 0,
      };
      existing.cameraCount += 1;
      if (entry.deviceStatus === 'online') existing.onlineCount += 1;
      else if (entry.deviceStatus === 'degraded') existing.degradedCount += 1;
      else existing.offlineCount += 1;
      zoneMap.set(zoneId, existing);
    }

    const zones = [...new Map(
      entries
        .filter((entry) => entry.zoneId)
        .map((entry) => [entry.zoneId!, { id: entry.zoneId!, label: entry.zoneLabel ?? entry.zoneId! }]),
    ).values()];

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      entries,
      zoneGroups: [...zoneMap.values()].sort((a, b) => a.zoneLabel.localeCompare(b.zoneLabel)),
      filterOptions: {
        zones,
        domains: ['security-soc', 'facilities-iot', 'operations', 'shared'],
        healthBands: ['healthy', 'degraded', 'critical', 'unknown'],
        streamStatuses: ['live', 'buffering', 'offline', 'archived'],
        recordingStatuses: ['active', 'paused', 'disabled', 'unknown'],
      },
      mock: workspace.mock,
    };
  }

  getEntry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    cameraId: string,
    actor: SecurityActor,
  ): CctvCameraRegistryEntryDto | undefined {
    const camera = workspace.cameras.find((item) => item.id === cameraId);
    if (!camera) return undefined;
    return this.buildEntry(ctx, workspace, camera, actor);
  }

  updateEntry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    cameraId: string,
    update: CctvCameraRegistryUpdateRequestDto,
    actor: SecurityActor,
    governance: AuditGovernanceService,
    adminGovernance: SurveillanceAdministrationGovernanceService,
  ): CctvCameraRegistryMutationResultDto {
    const camera = workspace.cameras.find((item) => item.id === cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} was not found in the registry projection.`);
    }

    const current = this.buildEntry(ctx, workspace, camera, actor);
    if (!current.canEdit) {
      throw new Error('Actor lacks permission to edit this camera registry entry.');
    }

    const changes: string[] = [];
    const key = this.overrideKey(ctx.scope, cameraId);
    const existing = this.overrides.get(key) ?? { updatedAt: ctx.now, updatedBy: actor.id };
    const pendingOverride = { ...existing };

    if (update.displayName !== undefined && update.displayName.trim() !== current.displayName) {
      pendingOverride.displayName = update.displayName.trim();
      changes.push(`displayName:${pendingOverride.displayName}`);
    }
    if (update.assignedDomain !== undefined && update.assignedDomain !== current.assignedDomain) {
      pendingOverride.assignedDomain = update.assignedDomain;
      changes.push(`assignedDomain:${update.assignedDomain}`);
    }
    if (update.recordingMode !== undefined && update.recordingMode !== current.recordingMode) {
      pendingOverride.recordingMode = update.recordingMode;
      changes.push(`recordingMode:${update.recordingMode}`);
    }
    if (update.retentionPolicyId !== undefined && update.retentionPolicyId !== current.retentionPolicyId) {
      pendingOverride.retentionPolicyId = update.retentionPolicyId;
      changes.push(`retentionPolicyId:${update.retentionPolicyId}`);
    }
    if (update.facilityZoneId !== undefined) {
      pendingOverride.facilityZoneId = update.facilityZoneId;
      changes.push(`facilityZoneId:${update.facilityZoneId}`);
    }

    if (changes.length === 0) {
      throw new Error('No registry fields changed — provide at least one updated value.');
    }

    const retentionChange = update.retentionPolicyId !== undefined && update.retentionPolicyId !== current.retentionPolicyId;
    const reassignmentChange = (update.assignedDomain !== undefined && update.assignedDomain !== current.assignedDomain)
      || (update.facilityZoneId !== undefined);

    const applyOverride = () => {
      pendingOverride.updatedAt = ctx.now;
      pendingOverride.updatedBy = actor.id;
      this.overrides.set(key, pendingOverride);
    };

    if (retentionChange) {
      const queued = adminGovernance.queueApproval(ctx, governance, {
        actionKind: 'retention-policy-change',
        action: 'surveillance.camera-registry.retention-change-requested',
        layer: 'governance',
        subjectId: cameraId,
        reason: update.reason ?? 'Camera retention policy reassignment',
        changes: changes.filter((change) => change.startsWith('retentionPolicyId:')),
        beforeSnapshot: current.retentionPolicyId ? { retentionPolicyId: current.retentionPolicyId } : undefined,
        afterSnapshot: { retentionPolicyId: update.retentionPolicyId! },
      }, applyOverride);

      return {
        accepted: true,
        cameraId,
        updatedAt: ctx.now,
        auditId: queued.auditId,
        changes,
        entry: current,
        approvalRequired: true,
        approvalRequestId: queued.approvalRequestId,
        pendingApproval: true,
      };
    }

    applyOverride();

    if (reassignmentChange) {
      adminGovernance.recordImmediate(ctx, governance, {
        actionKind: 'device-reassignment',
        action: 'surveillance.camera-registry.reassigned',
        layer: 'administration',
        subjectId: cameraId,
        reason: update.reason ?? 'inline-registry-edit',
        changes,
      });
    } else {
      adminGovernance.recordImmediate(ctx, governance, {
        actionKind: 'device-reassignment',
        action: 'surveillance.camera-registry.updated',
        layer: 'administration',
        subjectId: cameraId,
        reason: update.reason ?? 'inline-registry-edit',
        changes,
      });
    }

    const auditEnvelope = auditIds(ctx.now, `camera-registry:${cameraId}`);
    const refreshed = this.buildEntry(ctx, workspace, camera, actor);
    return {
      accepted: true,
      cameraId,
      updatedAt: ctx.now,
      auditId: auditEnvelope.auditId,
      changes,
      entry: refreshed,
    };
  }
}
