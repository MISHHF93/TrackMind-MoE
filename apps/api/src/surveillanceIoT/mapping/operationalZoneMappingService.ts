import type {
  CameraDeviceDto,
  IoTDeviceDto,
  Role,
  SurveillanceDeviceZoneAssignmentDto,
  SurveillanceDeviceZoneAssignmentMutationResultDto,
  SurveillanceDeviceZoneAssignmentUpdateRequestDto,
  SurveillanceIoTHealthBand,
  SurveillanceIoTWorkspaceDto,
  SurveillanceIoTZoneMappingWorkspaceDto,
  SurveillanceOperationalZoneDto,
  SurveillanceOperationalZoneHealthSummaryDto,
  SurveillanceOperationalZoneKind,
  SurveillanceOperationalZoneLinkedDeviceDto,
  SurveillanceOperationalZoneSensitivity,
} from '@trackmind/shared';
import { normalizeRole, canRoleEditSurveillanceZoneMapping, surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SecurityActor } from '../../securityOps.js';
import type { AuditGovernanceService } from '../governance/auditGovernanceService.js';
import type { SurveillanceAdministrationGovernanceService } from '../governance/surveillanceAdministrationGovernanceService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';
import { auditIds } from '../types.js';

interface ZoneCatalogEntry {
  zoneId: string;
  zoneCode: string;
  zoneLabel: string;
  zoneKind: SurveillanceOperationalZoneKind;
  sensitivity: SurveillanceOperationalZoneSensitivity;
  description: string;
  linkedSecurityZoneId?: string;
  facilityLabel?: string;
}

interface AssignmentOverride {
  operationalZoneIds: string[];
  primaryZoneId?: string;
  updatedAt: string;
  updatedBy: string;
}

const OPERATIONAL_ZONE_CATALOG: ZoneCatalogEntry[] = [
  { zoneId: 'opz-racetrack-main', zoneCode: 'racetrack-main', zoneLabel: 'Main oval racetrack', zoneKind: 'racetrack', sensitivity: 'operational', description: 'Primary racing surface perimeter and turn coverage.' },
  { zoneId: 'opz-paddock', zoneCode: 'paddock-gate', zoneLabel: 'Paddock restricted gate', zoneKind: 'paddock', sensitivity: 'restricted', description: 'Horse and handler movement between paddock and track.', linkedSecurityZoneId: 'zone-paddock', facilityLabel: 'Paddock complex' },
  { zoneId: 'opz-starting-gate', zoneCode: 'starting-gate', zoneLabel: 'Starting gate complex', zoneKind: 'starting-gate', sensitivity: 'security-sensitive', description: 'Starting gate, chute sensors, and race launch telemetry.' },
  { zoneId: 'opz-barn-block', zoneCode: 'barn-backstretch', zoneLabel: 'Backstretch barn block', zoneKind: 'barn', sensitivity: 'restricted', description: 'Stable and barn environmental and access monitoring.' },
  { zoneId: 'opz-veterinary', zoneCode: 'vet-treatment', zoneLabel: 'Veterinary treatment areas', zoneKind: 'veterinary', sensitivity: 'security-sensitive', description: 'Treatment bays, medication storage, and welfare observation.', linkedSecurityZoneId: 'zone-backstretch-medication', facilityLabel: 'Veterinary wing' },
  { zoneId: 'opz-restricted-corridor', zoneCode: 'restricted-ops', zoneLabel: 'Restricted operations corridors', zoneKind: 'restricted', sensitivity: 'restricted', description: 'Staff-only and credential-gated operational corridors.' },
  { zoneId: 'opz-public-concourse', zoneCode: 'public-grandstand', zoneLabel: 'Public grandstand concourse', zoneKind: 'public', sensitivity: 'public', description: 'Guest-facing public areas and crowd flow monitoring.', linkedSecurityZoneId: 'zone-grandstand', facilityLabel: 'Grandstand' },
  { zoneId: 'opz-hospitality', zoneCode: 'hospitality-club', zoneLabel: 'Hospitality & club level', zoneKind: 'hospitality', sensitivity: 'operational', description: 'Premium seating, suites, and hospitality service zones.' },
  { zoneId: 'opz-operations-room', zoneCode: 'race-ops-room', zoneLabel: 'Race day operations room', zoneKind: 'operations-room', sensitivity: 'security-sensitive', description: 'Race office, stewarding support, and command coordination.' },
  { zoneId: 'opz-track-surface', zoneCode: 'surface-monitoring', zoneLabel: 'Track surface monitoring belt', zoneKind: 'track-surface', sensitivity: 'operational', description: 'Surface moisture, compaction, and irrigation telemetry coverage.' },
  { zoneId: 'opz-parking-logistics', zoneCode: 'parking-logistics', zoneLabel: 'Parking & logistics yard', zoneKind: 'parking-logistics', sensitivity: 'operational', description: 'Vehicle ingress, freight, and logistics movement areas.' },
  { zoneId: 'opz-utilities', zoneCode: 'utilities-plant', zoneLabel: 'Utilities & infrastructure plant', zoneKind: 'utilities-infrastructure', sensitivity: 'restricted', description: 'Power, water, HVAC, and backbone infrastructure telemetry.' },
];

function actorRoles(actor: SecurityActor): Role[] {
  return (actor.roles ?? [])
    .map((role) => normalizeRole(role))
    .filter((role): role is Role => role !== undefined);
}

function canActorEditMapping(actor: SecurityActor, sensitivity: SurveillanceOperationalZoneSensitivity): boolean {
  return actorRoles(actor).some((role) => canRoleEditSurveillanceZoneMapping(role, sensitivity));
}

function healthBandFromCounts(online: number, degraded: number, offline: number): SurveillanceIoTHealthBand {
  if (offline > 0) return 'critical';
  if (degraded > 0) return 'degraded';
  if (online > 0) return 'healthy';
  return 'unknown';
}

function defaultZoneIdsForDevice(
  device: CameraDeviceDto | IoTDeviceDto,
  securityZoneId?: string,
): string[] {
  const haystack = `${device.id} ${device.displayName}`.toLowerCase();
  const zones = new Set<string>();

  if (securityZoneId === 'zone-paddock') zones.add('opz-paddock');
  if (securityZoneId === 'zone-grandstand') zones.add('opz-public-concourse');
  if (securityZoneId === 'zone-backstretch-medication') zones.add('opz-veterinary');

  if (haystack.includes('gate') || haystack.includes('start')) zones.add('opz-starting-gate');
  if (haystack.includes('barn') || haystack.includes('stable')) zones.add('opz-barn-block');
  if (haystack.includes('vet') || haystack.includes('med')) zones.add('opz-veterinary');
  if (haystack.includes('surface') || haystack.includes('moisture')) zones.add('opz-track-surface');
  if (haystack.includes('util') || haystack.includes('power')) zones.add('opz-utilities');
  if (haystack.includes('park') || haystack.includes('logistics')) zones.add('opz-parking-logistics');
  if (haystack.includes('grand') || haystack.includes('public')) zones.add('opz-public-concourse');
  if (haystack.includes('pad')) zones.add('opz-paddock');

  if (device.kind === 'camera-device') {
    if (zones.size === 0) zones.add('opz-racetrack-main');
    if (device.domainScope === 'facilities-iot') zones.add('opz-utilities');
  } else {
    if (zones.size === 0) zones.add('opz-utilities');
    if (device.sensorType.includes('door') || device.sensorType.includes('access')) {
      zones.add('opz-restricted-corridor');
    }
  }

  return [...zones];
}

function buildHealthSummary(
  cameras: CameraDeviceDto[],
  iotDevices: IoTDeviceDto[],
  openAlerts: SurveillanceIoTWorkspaceDto['openAlerts'],
): SurveillanceOperationalZoneHealthSummaryDto {
  const devices = [...cameras, ...iotDevices];
  let online = 0;
  let degraded = 0;
  let offline = 0;
  const deviceIds = new Set(devices.map((device) => device.id));
  const openAlertCount = openAlerts.filter((alert) => deviceIds.has(alert.deviceId)).length;

  for (const device of devices) {
    if (device.status === 'online') online += 1;
    else if (device.status === 'degraded') degraded += 1;
    else offline += 1;
  }

  const total = devices.length;
  const coveragePct = total === 0 ? 100 : Math.round(((online + degraded * 0.5) / total) * 100);

  return {
    healthBand: healthBandFromCounts(online, degraded, offline),
    cameraCount: cameras.length,
    iotDeviceCount: iotDevices.length,
    totalDeviceCount: total,
    onlineCount: online,
    degradedCount: degraded,
    offlineCount: offline,
    openAlertCount,
    coveragePct,
  };
}

export class OperationalZoneMappingService {
  private readonly assignmentOverrides = new Map<string, AssignmentOverride>();

  private overrideKey(scope: SurveillanceIoTModuleContext['scope'], deviceId: string): string {
    return `${scope.tenantId}:${scope.racetrackId}:${deviceId}`;
  }

  private resolveAssignments(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
  ): Map<string, { deviceKind: 'camera-device' | 'iot-device'; displayName: string; zoneIds: string[]; primaryZoneId?: string; health: SurveillanceIoTHealthBand; status: CameraDeviceDto['status'] }> {
    const assignments = new Map<string, { deviceKind: 'camera-device' | 'iot-device'; displayName: string; zoneIds: string[]; primaryZoneId?: string; health: SurveillanceIoTHealthBand; status: CameraDeviceDto['status'] }>();

    for (const camera of workspace.cameras) {
      const override = this.assignmentOverrides.get(this.overrideKey(ctx.scope, camera.id));
      const zoneIds = override?.operationalZoneIds ?? defaultZoneIdsForDevice(camera, camera.securityZoneId);
      assignments.set(camera.id, {
        deviceKind: 'camera-device',
        displayName: camera.displayName,
        zoneIds,
        primaryZoneId: override?.primaryZoneId ?? zoneIds[0],
        health: camera.health,
        status: camera.status,
      });
    }

    for (const device of workspace.iotDevices) {
      const override = this.assignmentOverrides.get(this.overrideKey(ctx.scope, device.id));
      const zoneIds = override?.operationalZoneIds ?? defaultZoneIdsForDevice(device, device.securityZoneId);
      assignments.set(device.id, {
        deviceKind: 'iot-device',
        displayName: device.displayName,
        zoneIds,
        primaryZoneId: override?.primaryZoneId ?? zoneIds[0],
        health: device.health,
        status: device.status,
      });
    }

    return assignments;
  }

  buildWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    actor: SecurityActor,
  ): SurveillanceIoTZoneMappingWorkspaceDto {
    const assignmentMap = this.resolveAssignments(ctx, workspace);
    const zoneDeviceMap = new Map<string, { cameras: CameraDeviceDto[]; iotDevices: IoTDeviceDto[] }>();

    for (const entry of OPERATIONAL_ZONE_CATALOG) {
      zoneDeviceMap.set(entry.zoneId, { cameras: [], iotDevices: [] });
    }

    for (const camera of workspace.cameras) {
      const assignment = assignmentMap.get(camera.id);
      for (const zoneId of assignment?.zoneIds ?? []) {
        zoneDeviceMap.get(zoneId)?.cameras.push(camera);
      }
    }

    for (const device of workspace.iotDevices) {
      const assignment = assignmentMap.get(device.id);
      for (const zoneId of assignment?.zoneIds ?? []) {
        zoneDeviceMap.get(zoneId)?.iotDevices.push(device);
      }
    }

    const operationalZones: SurveillanceOperationalZoneDto[] = OPERATIONAL_ZONE_CATALOG.map((catalog) => {
      const bucket = zoneDeviceMap.get(catalog.zoneId) ?? { cameras: [], iotDevices: [] };
      const linkedDeviceZoneIds = workspace.deviceZones
        .filter((zone) => zone.id === catalog.linkedSecurityZoneId || zone.securityZoneId === catalog.linkedSecurityZoneId)
        .map((zone) => zone.id);
      const healthSummary = buildHealthSummary(bucket.cameras, bucket.iotDevices, workspace.openAlerts);

      const linkedDevices: SurveillanceOperationalZoneLinkedDeviceDto[] = [
        ...bucket.cameras.map((camera) => {
          const assignment = assignmentMap.get(camera.id);
          return {
            deviceId: camera.id,
            deviceKind: 'camera-device' as const,
            displayName: camera.displayName,
            health: camera.health,
            deviceStatus: camera.status,
            isPrimary: assignment?.primaryZoneId === catalog.zoneId,
          };
        }),
        ...bucket.iotDevices.map((device) => {
          const assignment = assignmentMap.get(device.id);
          return {
            deviceId: device.id,
            deviceKind: 'iot-device' as const,
            displayName: device.displayName,
            health: device.health,
            deviceStatus: device.status,
            isPrimary: assignment?.primaryZoneId === catalog.zoneId,
          };
        }),
      ].sort((a, b) => a.displayName.localeCompare(b.displayName));

      return {
        zoneId: catalog.zoneId,
        zoneCode: catalog.zoneCode,
        zoneLabel: catalog.zoneLabel,
        zoneKind: catalog.zoneKind,
        racetrackId: ctx.scope.racetrackId,
        facilityLabel: catalog.facilityLabel,
        description: catalog.description,
        sensitivity: catalog.sensitivity,
        linkedSecurityZoneId: catalog.linkedSecurityZoneId,
        cameraIds: bucket.cameras.map((camera) => camera.id),
        iotDeviceIds: bucket.iotDevices.map((device) => device.id),
        gatewayIds: workspace.gateways.filter((gateway) => catalog.zoneKind === 'utilities-infrastructure').map((gateway) => gateway.id),
        linkedDeviceZoneIds,
        healthSummary,
        linkedDevices,
        canEdit: canActorEditMapping(actor, catalog.sensitivity),
        mock: workspace.mock,
      };
    });

    const deviceAssignments: SurveillanceDeviceZoneAssignmentDto[] = [...assignmentMap.entries()].map(([deviceId, assignment]) => ({
      deviceId,
      deviceKind: assignment.deviceKind,
      displayName: assignment.displayName,
      operationalZoneIds: assignment.zoneIds,
      primaryZoneId: assignment.primaryZoneId,
      health: assignment.health,
      deviceStatus: assignment.status,
    })).sort((a, b) => a.displayName.localeCompare(b.displayName));

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      deviceZones: workspace.deviceZones,
      facilityZones: workspace.facilityZones,
      operationalZones,
      deviceAssignments,
      filterOptions: {
        zoneKinds: OPERATIONAL_ZONE_CATALOG.map((entry) => entry.zoneKind),
        sensitivities: ['public', 'operational', 'restricted', 'security-sensitive'],
        healthBands: ['healthy', 'degraded', 'critical', 'unknown'],
      },
      mock: workspace.mock,
    };
  }

  getOperationalZone(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    zoneId: string,
    actor: SecurityActor,
  ): SurveillanceOperationalZoneDto | undefined {
    return this.buildWorkspace(ctx, workspace, actor).operationalZones.find((zone) => zone.zoneId === zoneId);
  }

  updateDeviceAssignment(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    deviceId: string,
    update: SurveillanceDeviceZoneAssignmentUpdateRequestDto,
    actor: SecurityActor,
    governance: AuditGovernanceService,
    adminGovernance: SurveillanceAdministrationGovernanceService,
  ): SurveillanceDeviceZoneAssignmentMutationResultDto {
    const device = update.deviceKind === 'camera-device'
      ? workspace.cameras.find((item) => item.id === deviceId)
      : workspace.iotDevices.find((item) => item.id === deviceId);

    if (!device) {
      throw new Error(`Device ${deviceId} was not found.`);
    }

    if (update.operationalZoneIds.length === 0) {
      throw new Error('At least one operational zone assignment is required.');
    }

    const invalidZone = update.operationalZoneIds.find((zoneId) => !OPERATIONAL_ZONE_CATALOG.some((entry) => entry.zoneId === zoneId));
    if (invalidZone) {
      throw new Error(`Unknown operational zone: ${invalidZone}`);
    }

    const primaryZoneId = update.primaryZoneId && update.operationalZoneIds.includes(update.primaryZoneId)
      ? update.primaryZoneId
      : update.operationalZoneIds[0];

    const key = this.overrideKey(ctx.scope, deviceId);
    const existing = this.assignmentOverrides.get(key);
    const changes: string[] = [];

    if (!existing || existing.operationalZoneIds.join(',') !== update.operationalZoneIds.join(',')) {
      changes.push(`operationalZoneIds:${update.operationalZoneIds.join('|')}`);
    }
    if (!existing || existing.primaryZoneId !== primaryZoneId) {
      changes.push(`primaryZoneId:${primaryZoneId}`);
    }

    if (changes.length === 0) {
      throw new Error('No zone assignment fields changed.');
    }

    const zoneSensitivities = update.operationalZoneIds.map((zoneId) =>
      OPERATIONAL_ZONE_CATALOG.find((entry) => entry.zoneId === zoneId)?.sensitivity ?? 'operational',
    );

    const applyAssignment = () => {
      this.assignmentOverrides.set(key, {
        operationalZoneIds: update.operationalZoneIds,
        primaryZoneId,
        updatedAt: ctx.now,
        updatedBy: actor.id,
      });
    };

    const currentWorkspace = this.buildWorkspace(ctx, workspace, actor);
    const currentAssignment = currentWorkspace.deviceAssignments.find((item) => item.deviceId === deviceId);
    if (!currentAssignment) {
      throw new Error(`Assignment projection failed for ${deviceId}.`);
    }

    if (adminGovernance.requiresApprovalForZoneRemapping(zoneSensitivities)) {
      const queued = adminGovernance.queueApproval(ctx, governance, {
        actionKind: 'zone-remapping',
        action: 'surveillance.mapping.change-requested',
        layer: 'administration',
        subjectId: deviceId,
        reason: update.reason ?? 'Sensitive operational zone remapping',
        changes,
        evidence: zoneSensitivities.map((sensitivity) => `zoneSensitivity:${sensitivity}`),
      }, applyAssignment);

      return {
        accepted: true,
        deviceId,
        updatedAt: ctx.now,
        auditId: queued.auditId,
        changes,
        assignment: currentAssignment,
        affectedZones: update.operationalZoneIds,
        approvalRequired: true,
        approvalRequestId: queued.approvalRequestId,
        pendingApproval: true,
      };
    }

    applyAssignment();
    adminGovernance.recordImmediate(ctx, governance, {
      actionKind: 'zone-remapping',
      action: 'surveillance.mapping.updated',
      layer: 'administration',
      subjectId: deviceId,
      reason: update.reason ?? 'inline-zone-assignment',
      changes,
    });

    const refreshed = this.buildWorkspace(ctx, workspace, actor);
    const assignment = refreshed.deviceAssignments.find((item) => item.deviceId === deviceId);
    if (!assignment) {
      throw new Error(`Assignment projection failed for ${deviceId}.`);
    }

    const auditEnvelope = auditIds(ctx.now, `zone-mapping:${deviceId}`);
    return {
      accepted: true,
      deviceId,
      updatedAt: ctx.now,
      auditId: auditEnvelope.auditId,
      changes,
      assignment,
      affectedZones: update.operationalZoneIds,
    };
  }
}
