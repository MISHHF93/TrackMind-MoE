import type {
  IoTDeviceDto,
  IoTDeviceRegistryEntryDto,
  IoTDeviceRegistryMutationResultDto,
  IoTDeviceRegistryUpdateRequestDto,
  IoTDeviceRegistryWorkspaceDto,
  IoTDeviceRegistryZoneGroupDto,
  IoTRegistryAlertState,
  IoTRegistryConnectivityStatus,
  IoTRegistryDeviceType,
  IoTRegistryMaintenanceStatus,
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

interface DeviceRegistryOverride {
  displayName?: string;
  assignedWorkflowDomain?: SurveillanceIoTDomainScope;
  facilityZoneId?: string;
  updatedAt: string;
  updatedBy: string;
}

function actorRoles(actor: SecurityActor): Role[] {
  return (actor.roles ?? [])
    .map((role) => normalizeRole(role))
    .filter((role): role is Role => role !== undefined);
}

function canActorViewDevice(actor: SecurityActor, domain: SurveillanceIoTDomainScope): boolean {
  return actorRoles(actor).some((role) => canRoleViewSurveillanceDomain(role, domain));
}

function canActorEditDevice(actor: SecurityActor, domain: SurveillanceIoTDomainScope): boolean {
  return actorRoles(actor).some((role) => canRoleManageSurveillanceDevice(role, domain));
}

function inferDeviceType(device: IoTDeviceDto): IoTRegistryDeviceType {
  const haystack = `${device.id} ${device.displayName} ${device.sensorType} ${device.utilitiesAdapterKind ?? ''}`.toLowerCase();
  if (haystack.includes('wearable') || haystack.includes('beacon') || haystack.includes('tag')) return 'wearable-beacon';
  if (haystack.includes('surface') || haystack.includes('track') || haystack.includes('moisture')) return 'track-surface';
  if (haystack.includes('utilit') || haystack.includes('power') || haystack.includes('water')) return 'utilities';
  if (haystack.includes('stable') || haystack.includes('barn') || haystack.includes('paddock')) return 'stable-barn';
  if (haystack.includes('gate') || device.sensorType.includes('gate')) return 'gate';
  if (haystack.includes('access') || haystack.includes('door') || device.sensorType === 'door-contact') return 'access';
  if (haystack.includes('environment') || device.sensorType === 'environmental') return 'environmental';
  if (haystack.includes('motion') || device.sensorType === 'motion') return 'access';
  if (haystack.includes('equipment') || haystack.includes('telemetry')) return 'equipment-telemetry';
  return 'equipment-telemetry';
}

function connectivityStatus(device: IoTDeviceDto): IoTRegistryConnectivityStatus {
  if (device.status === 'offline' || device.integrationStatus === 'blocked') return 'disconnected';
  if (device.status === 'degraded' || device.integrationStatus === 'watch') return 'degraded';
  if (device.status === 'online' && device.integrationStatus === 'ready') {
    return 'connected';
  }
  if (device.status === 'maintenance') return 'degraded';
  return 'unknown';
}

function resolveAlertState(
  alerts: SurveillanceIoTWorkspaceDto['openAlerts'],
  deviceId: string,
): { alertState: IoTRegistryAlertState; openAlertCount: number } {
  const deviceAlerts = alerts.filter((alert) => alert.deviceId === deviceId && alert.alertStatus !== 'resolved' && alert.alertStatus !== 'suppressed');
  if (deviceAlerts.length === 0) return { alertState: 'clear', openAlertCount: 0 };
  const hasCritical = deviceAlerts.some((alert) => alert.severity === 'critical' || alert.severity === 'high');
  const allAcknowledged = deviceAlerts.every((alert) => alert.alertStatus === 'acknowledged');
  if (hasCritical) return { alertState: 'critical', openAlertCount: deviceAlerts.length };
  if (allAcknowledged) return { alertState: 'acknowledged', openAlertCount: deviceAlerts.length };
  return { alertState: 'open', openAlertCount: deviceAlerts.length };
}

function resolveMaintenanceStatus(
  records: SurveillanceIoTWorkspaceDto['maintenanceRecords'],
  deviceId: string,
): IoTRegistryMaintenanceStatus {
  const active = records
    .filter((record) => record.deviceId === deviceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!active) return 'none';
  return active.maintenanceStatus;
}

function latestTelemetryAt(
  workspace: SurveillanceIoTWorkspaceDto,
  device: IoTDeviceDto,
): string {
  const reading = workspace.recentReadings
    .filter((item) => item.deviceId === device.id)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  return reading?.observedAt ?? device.lastSeenAt;
}

export class IoTDeviceRegistryService {
  private readonly overrides = new Map<string, DeviceRegistryOverride>();

  private overrideKey(scope: SurveillanceIoTModuleContext['scope'], deviceId: string): string {
    return `${scope.tenantId}:${scope.racetrackId}:${deviceId}`;
  }

  buildEntry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    device: IoTDeviceDto,
    actor: SecurityActor,
  ): IoTDeviceRegistryEntryDto {
    const override = this.overrides.get(this.overrideKey(ctx.scope, device.id));
    const zone = workspace.deviceZones.find(
      (item) => item.id === device.deviceZoneId || item.id === device.securityZoneId || item.sensorIds.includes(device.id),
    );
    const facilityZone = workspace.facilityZones.find(
      (item) => item.deviceZoneIds.includes(zone?.id ?? '') || item.assignedDeviceIds.includes(device.id),
    );
    const assignedWorkflowDomain = override?.assignedWorkflowDomain ?? device.domainScope;
    const displayName = override?.displayName ?? device.displayName;
    const { alertState, openAlertCount } = resolveAlertState(workspace.openAlerts, device.id);

    return {
      deviceId: device.id,
      displayName,
      deviceType: inferDeviceType(device),
      zoneId: zone?.id ?? device.securityZoneId,
      zoneLabel: zone?.displayName,
      facilityId: facilityZone?.facilityId ?? device.facilityId,
      facilityLabel: facilityZone?.zoneLabel,
      health: device.health,
      deviceStatus: device.status,
      connectivity: connectivityStatus(device),
      latestTelemetryAt: latestTelemetryAt(workspace, device),
      telemetryType: device.sensorType,
      telemetryValueType: device.valueType,
      alertState,
      openAlertCount,
      assignedWorkflowDomain,
      maintenanceStatus: resolveMaintenanceStatus(workspace.maintenanceRecords, device.id),
      integrationStatus: device.integrationStatus,
      gatewayId: device.gatewayId,
      canEdit: canActorEditDevice(actor, assignedWorkflowDomain),
      mock: device.mock,
      audit: device.audit,
    };
  }

  buildRegistry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    actor: SecurityActor,
  ): IoTDeviceRegistryWorkspaceDto {
    const entries = workspace.iotDevices
      .map((device) => this.buildEntry(ctx, workspace, device, actor))
      .filter((entry) => canActorViewDevice(actor, entry.assignedWorkflowDomain));

    const zoneMap = new Map<string, IoTDeviceRegistryZoneGroupDto>();
    for (const entry of entries) {
      const zoneId = entry.zoneId ?? 'unassigned';
      const zoneLabel = entry.zoneLabel ?? 'Unassigned';
      const existing = zoneMap.get(zoneId) ?? {
        zoneId,
        zoneLabel,
        facilityLabel: entry.facilityLabel,
        deviceCount: 0,
        connectedCount: 0,
        degradedCount: 0,
        disconnectedCount: 0,
        alertCount: 0,
      };
      existing.deviceCount += 1;
      if (entry.connectivity === 'connected') existing.connectedCount += 1;
      else if (entry.connectivity === 'degraded') existing.degradedCount += 1;
      else if (entry.connectivity === 'disconnected') existing.disconnectedCount += 1;
      existing.alertCount += entry.openAlertCount;
      zoneMap.set(zoneId, existing);
    }

    const zones = [...new Map(
      entries
        .filter((entry) => entry.zoneId)
        .map((entry) => [entry.zoneId!, { id: entry.zoneId!, label: entry.zoneLabel ?? entry.zoneId! }]),
    ).values()];

    const deviceTypes = [...new Set(entries.map((entry) => entry.deviceType))].sort();

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
        deviceTypes,
        domains: ['security-soc', 'facilities-iot', 'operations', 'shared'],
        healthBands: ['healthy', 'degraded', 'critical', 'unknown'],
        connectivityStatuses: ['connected', 'degraded', 'disconnected', 'unknown'],
        alertStates: ['clear', 'open', 'acknowledged', 'critical'],
        maintenanceStatuses: ['none', 'scheduled', 'in-progress', 'completed', 'deferred', 'cancelled'],
      },
      mock: workspace.mock,
    };
  }

  getEntry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    deviceId: string,
    actor: SecurityActor,
  ): IoTDeviceRegistryEntryDto | undefined {
    const device = workspace.iotDevices.find((item) => item.id === deviceId);
    if (!device) return undefined;
    return this.buildEntry(ctx, workspace, device, actor);
  }

  updateEntry(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    deviceId: string,
    update: IoTDeviceRegistryUpdateRequestDto,
    actor: SecurityActor,
    governance: AuditGovernanceService,
    adminGovernance: SurveillanceAdministrationGovernanceService,
  ): IoTDeviceRegistryMutationResultDto {
    const device = workspace.iotDevices.find((item) => item.id === deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} was not found in the registry projection.`);
    }

    const current = this.buildEntry(ctx, workspace, device, actor);
    if (!current.canEdit) {
      throw new Error('Actor lacks permission to edit this IoT device registry entry.');
    }

    const changes: string[] = [];
    const key = this.overrideKey(ctx.scope, deviceId);
    const existing = this.overrides.get(key) ?? { updatedAt: ctx.now, updatedBy: actor.id };

    if (update.displayName !== undefined && update.displayName.trim() !== current.displayName) {
      existing.displayName = update.displayName.trim();
      changes.push(`displayName:${existing.displayName}`);
    }
    if (update.assignedWorkflowDomain !== undefined && update.assignedWorkflowDomain !== current.assignedWorkflowDomain) {
      existing.assignedWorkflowDomain = update.assignedWorkflowDomain;
      changes.push(`assignedWorkflowDomain:${update.assignedWorkflowDomain}`);
    }
    if (update.facilityZoneId !== undefined) {
      existing.facilityZoneId = update.facilityZoneId;
      changes.push(`facilityZoneId:${update.facilityZoneId}`);
    }

    if (changes.length === 0) {
      throw new Error('No registry fields changed — provide at least one updated value.');
    }

    existing.updatedAt = ctx.now;
    existing.updatedBy = actor.id;
    this.overrides.set(key, existing);

    const reassignmentChange = (update.assignedWorkflowDomain !== undefined && update.assignedWorkflowDomain !== current.assignedWorkflowDomain)
      || (update.facilityZoneId !== undefined);

    adminGovernance.recordImmediate(ctx, governance, {
      actionKind: 'device-reassignment',
      action: reassignmentChange ? 'surveillance.device-registry.reassigned' : 'surveillance.device-registry.updated',
      layer: 'administration',
      subjectId: deviceId,
      reason: update.reason ?? 'inline-registry-edit',
      changes,
    });

    const auditEnvelope = auditIds(ctx.now, `iot-registry:${deviceId}`);

    const refreshed = this.buildEntry(ctx, workspace, device, actor);
    return {
      accepted: true,
      deviceId,
      updatedAt: ctx.now,
      auditId: auditEnvelope.auditId,
      changes,
      entry: refreshed,
    };
  }
}
