import type {
  IoTDeviceDetailOperationalCategory,
  IoTDeviceDetailWorkspaceDto,
  IoTDeviceDto,
  IoTDeviceLatestTelemetrySnapshotDto,
  IoTDeviceThresholdRuleDto,
  IoTRegistryDeviceType,
  SurveillanceIoTWorkspaceDto,
} from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SecurityActor } from '../../securityOps.js';
import type { AuditGovernanceService } from '../governance/auditGovernanceService.js';
import type { FacilityZoneMappingService } from '../mapping/facilityZoneMappingService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';
import type { IoTDeviceRegistryService } from './iotDeviceRegistryService.js';

function operationalCategory(deviceType: IoTRegistryDeviceType): IoTDeviceDetailOperationalCategory {
  if (deviceType === 'environmental') return 'environmental';
  if (deviceType === 'access' || deviceType === 'gate') return 'security';
  if (deviceType === 'stable-barn' || deviceType === 'utilities' || deviceType === 'track-surface') return 'facilities';
  return 'operational';
}

function categoryLabel(category: IoTDeviceDetailOperationalCategory): string {
  if (category === 'environmental') return 'Environmental';
  if (category === 'facilities') return 'Facilities';
  if (category === 'security') return 'Security';
  return 'Operational';
}

function buildLatestSnapshot(
  device: IoTDeviceDto,
  workspace: SurveillanceIoTWorkspaceDto,
): IoTDeviceLatestTelemetrySnapshotDto | undefined {
  const snapshot = workspace.telemetrySnapshots
    .filter((item) => item.deviceId === device.id)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];

  if (snapshot) {
    return {
      snapshotId: snapshot.id,
      capturedAt: snapshot.capturedAt,
      metrics: snapshot.metrics,
      signalStrength: snapshot.signalStrength,
      batteryPct: snapshot.batteryPct,
      firmwareVersion: snapshot.firmwareVersion,
      source: 'telemetry-snapshot',
    };
  }

  const reading = workspace.recentReadings
    .filter((item) => item.deviceId === device.id)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];

  if (!reading) return undefined;

  return {
    snapshotId: reading.id,
    capturedAt: reading.observedAt,
    metrics: [{ name: reading.metric, value: reading.value, unit: reading.unit }],
    source: 'recent-reading',
    quality: reading.quality,
  };
}

function buildRulesForDevice(
  device: IoTDeviceDto,
  workspace: SurveillanceIoTWorkspaceDto,
  ctx: SurveillanceIoTModuleContext,
): IoTDeviceThresholdRuleDto[] {
  const matched = workspace.rules.filter(
    (rule) => rule.targetDeviceIds.includes(device.id) || rule.targetZoneIds.includes(device.securityZoneId ?? ''),
  );

  if (matched.length > 0) {
    return matched.map((rule) => ({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      enabled: rule.enabled,
      trigger: rule.trigger,
      action: rule.action,
      conditionExpression: rule.conditionExpression,
      lastEvaluatedAt: rule.lastEvaluatedAt,
      approvalRequired: rule.approvalRequired,
    }));
  }

  return [
    {
      ruleId: `rule:${device.id}:threshold-high`,
      ruleName: `${device.displayName} high threshold`,
      enabled: true,
      trigger: 'threshold',
      action: 'alert',
      conditionExpression: `${device.sensorType} > nominal_max`,
      lastEvaluatedAt: ctx.now,
      approvalRequired: false,
    },
    {
      ruleId: `rule:${device.id}:threshold-low`,
      ruleName: `${device.displayName} low threshold`,
      enabled: device.status !== 'offline',
      trigger: 'threshold',
      action: 'alert',
      conditionExpression: `${device.sensorType} < nominal_min`,
      lastEvaluatedAt: device.status === 'offline' ? undefined : ctx.now,
      approvalRequired: false,
    },
  ];
}

export class IoTDeviceDetailService {
  buildDetailWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    deviceId: string,
    actor: SecurityActor,
    registry: IoTDeviceRegistryService,
    zoneMapping: FacilityZoneMappingService,
    governance: AuditGovernanceService,
  ): IoTDeviceDetailWorkspaceDto | undefined {
    const device = workspace.iotDevices.find((item) => item.id === deviceId);
    if (!device) return undefined;

    const entry = registry.getEntry(ctx, workspace, deviceId, actor);
    if (!entry) return undefined;

    const category = operationalCategory(entry.deviceType);
    const mappingWorkspace = zoneMapping.buildZoneMappingWorkspace(ctx, workspace, actor);
    const deviceAssignment = mappingWorkspace.deviceAssignments.find((item) => item.deviceId === deviceId);
    const operationalZones = mappingWorkspace.operationalZones
      .filter((zone) => zone.iotDeviceIds.includes(deviceId))
      .map((zone) => ({
        zoneId: zone.zoneId,
        zoneLabel: zone.zoneLabel,
        zoneKind: zone.zoneKind,
        isPrimary: deviceAssignment?.primaryZoneId === zone.zoneId,
      }));

    const healthStatus = workspace.healthStatuses.find((item) => item.deviceId === device.id);
    const activeAlerts = workspace.openAlerts
      .filter((alert) => alert.deviceId === device.id && alert.alertStatus !== 'resolved' && alert.alertStatus !== 'suppressed')
      .map((alert) => ({
        alertId: alert.id,
        alertCode: alert.alertCode,
        severity: alert.severity,
        alertStatus: alert.alertStatus,
        title: alert.title,
        detail: alert.detail,
        triggeredAt: alert.triggeredAt,
      }))
      .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

    const linkedIncidents = workspace.incidentReferences
      .filter((ref) => ref.deviceId === device.id || ref.zoneId === device.securityZoneId)
      .map((ref) => ({
        incidentReferenceId: ref.id,
        incidentId: ref.incidentId,
        title: ref.displayName,
        linkedAt: ref.linkedAt,
        linkageReason: ref.linkageReason,
        operationalImpact: activeAlerts.some((alert) => alert.severity === 'critical' || alert.severity === 'high'),
      }));

    const maintenanceHistory = workspace.maintenanceRecords
      .filter((record) => record.deviceId === device.id)
      .map((record) => ({
        maintenanceId: record.id,
        maintenanceStatus: record.maintenanceStatus,
        maintenanceType: record.maintenanceType,
        scheduledAt: record.scheduledAt,
        completedAt: record.completedAt,
        performedBy: record.performedBy,
        workOrderId: record.workOrderId,
        notes: record.notes,
      }))
      .sort((a, b) => (b.scheduledAt ?? b.completedAt ?? '').localeCompare(a.scheduledAt ?? a.completedAt ?? ''));

    const governanceAudits = governance.auditForSubject(deviceId).map((record) => ({
      auditId: record.auditId,
      action: record.action,
      layer: record.layer,
      actorId: record.actorId,
      occurredAt: record.timestamp,
      details: record.evidence,
    }));

    const auditHistory = [
      {
        auditId: entry.audit.auditId,
        action: 'surveillance.device.registered',
        layer: 'administration' as const,
        actorId: entry.audit.createdBy,
        occurredAt: entry.audit.createdAt,
        details: [`eventId:${entry.audit.eventId}`, `deviceId:${device.id}`, `category:${categoryLabel(category)}`],
      },
      ...governanceAudits,
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const latestTelemetrySnapshot = buildLatestSnapshot(device, workspace);

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      deviceId: device.id,
      operationalCategory: category,
      identity: {
        ...entry,
        sensorType: device.sensorType,
        assetId: device.assetId,
        twinId: device.twinId,
        manufacturer: device.manufacturer,
        model: device.model,
        serialNumber: device.serialNumber,
        gatewayId: device.gatewayId,
        utilitiesAdapterKind: device.utilitiesAdapterKind,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      },
      zoneMapping: {
        deviceZoneId: entry.zoneId,
        deviceZoneLabel: entry.zoneLabel,
        securityZoneId: device.securityZoneId,
        facilityId: entry.facilityId,
        facilityLabel: entry.facilityLabel,
        operationalZones,
      },
      health: {
        healthBand: entry.health,
        deviceStatus: entry.deviceStatus,
        connectivity: entry.connectivity,
        integrationStatus: entry.integrationStatus,
        healthScore: healthStatus?.healthScore,
        lastHeartbeatAt: healthStatus?.lastHeartbeatAt ?? device.lastSeenAt,
        diagnostics: healthStatus?.diagnostics ?? [],
      },
      lastSeenAt: device.lastSeenAt,
      latestTelemetrySnapshot,
      telemetryHistoryPlaceholder: {
        historyEndpointPlaceholder: `/surveillance-iot/devices/${device.id}/telemetry/history`,
        windowLabel: 'Last 24 hours (placeholder)',
        supportedMetrics: [device.sensorType, 'battery', 'signal-strength', 'firmware-version'],
        queryCapable: false,
        metadataPlaceholder: true,
      },
      thresholdsRules: buildRulesForDevice(device, workspace, ctx),
      activeAlerts,
      linkedIncidents,
      maintenanceHistory,
      auditHistory,
      canEdit: entry.canEdit,
      mock: entry.mock,
    };
  }
}
