import type {
  CameraDeviceDto,
  CameraPresetDto,
  DeviceAlertDto,
  DeviceAssignmentDto,
  DeviceGatewayDto,
  DeviceHealthStatusDto,
  DeviceMaintenanceRecordDto,
  DeviceZoneDto,
  FacilityZoneDto,
  IoTDeviceDto,
  RecordingRetentionPolicyDto,
  SensorReadingDto,
  SurveillanceIncidentReferenceDto,
  SurveillanceIoTHealthBand,
  SurveillanceIoTIntegrationStatus,
  SurveillanceIoTReadinessDto,
  SurveillanceIoTWorkspaceDto,
  VideoStreamDto,
} from '@trackmind/shared';
import { surveillanceIoTSchemaVersion } from '@trackmind/shared';
import type { SecurityActor, SecurityOperationsService } from '../../securityOps.js';
import { auditIds, defaultSurveillanceIoTScope, resolveScope, type SurveillanceIoTScope } from '../types.js';

const healthBand = (health: 'online' | 'degraded' | 'offline'): SurveillanceIoTHealthBand =>
  health === 'online' ? 'healthy' : health === 'degraded' ? 'degraded' : 'critical';

const integrationStatus = (health: 'online' | 'degraded' | 'offline'): SurveillanceIoTIntegrationStatus =>
  health === 'online' ? 'ready' : health === 'degraded' ? 'watch' : 'blocked';

const deviceStatus = (health: 'online' | 'degraded' | 'offline'): CameraDeviceDto['status'] =>
  health === 'online' ? 'online' : health === 'offline' ? 'offline' : 'degraded';

function offsetIso(iso: string, minutesAgo: number): string {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - minutesAgo);
  return date.toISOString();
}

const inferSensorType = (id: string, label: string): string => {
  const haystack = `${id} ${label}`.toLowerCase();
  if (haystack.includes('door')) return 'door-contact';
  if (haystack.includes('motion')) return 'motion';
  if (haystack.includes('environment')) return 'environmental';
  if (haystack.includes('access')) return 'access-panel';
  return 'security';
};

function baseFields(
  scope: SurveillanceIoTScope,
  now: string,
  id: string,
  displayName: string,
  health: 'online' | 'degraded' | 'offline',
  lastSeenAt: string,
  suffix: string,
  domainScope: CameraDeviceDto['domainScope'],
  linkage: Partial<Pick<CameraDeviceDto, 'facilityId' | 'deviceZoneId' | 'securityZoneId' | 'assetId' | 'twinId'>> = {},
) {
  return {
    id,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    displayName,
    status: deviceStatus(health),
    health: healthBand(health),
    lastSeenAt,
    createdAt: now,
    updatedAt: now,
    domainScope,
    mock: false as const,
    ...auditIds(now, suffix),
    ...linkage,
  };
}

export class SurveillanceIoTProjectionService {
  constructor(
    private readonly securityOps: SecurityOperationsService,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly baseScope: SurveillanceIoTScope = defaultSurveillanceIoTScope(),
  ) {}

  buildWorkspace(actor: SecurityActor): SurveillanceIoTWorkspaceDto {
    const workspace = this.securityOps.getWorkspace(actor);
    const cameraReadiness = this.securityOps.getCameraReadiness(actor);
    const sensorReadiness = this.securityOps.getSensorReadiness(actor);
    const now = this.clock();
    const scope = resolveScope(this.baseScope, actor);

    const cameras: CameraDeviceDto[] = workspace.cameras.map((camera) => ({
      kind: 'camera-device',
      deviceCategory: 'camera',
      ...baseFields(scope, now, camera.id, camera.label, camera.health, camera.lastHeartbeatAt, camera.id, 'security-soc', {
        securityZoneId: camera.zoneId,
        assetId: camera.assetId,
        twinId: camera.twinId,
      }),
      streamIds: [`stream:${camera.id}:primary`],
      presetIds: [`preset:${camera.id}:home`],
      recordingMode: 'continuous',
      privacyMaskingEnabled: camera.privacyMasking,
      ptzCapable: false,
      integrationStatus: integrationStatus(camera.health),
      webhookConfigured: true,
      twinLinked: Boolean(camera.twinId),
    }));

    const mappedSensors: IoTDeviceDto[] = sensorReadiness.items.map((sensor) => ({
      kind: 'iot-device',
      deviceCategory: 'sensor',
      ...baseFields(scope, now, sensor.id, sensor.label, sensor.health, sensor.lastHeartbeatAt, sensor.id, 'security-soc', {
        securityZoneId: sensor.zoneId,
      }),
      sensorType: inferSensorType(sensor.id, sensor.label),
      valueType: 'numeric',
      integrationStatus: sensor.integrationStatus,
      telemetryBindingIds: [`binding:${sensor.id}:primary`],
    }));

    const gateways: DeviceGatewayDto[] = [
      {
        kind: 'device-gateway',
        deviceCategory: 'gateway',
        ...baseFields(scope, now, 'gateway-iot-primary', 'Primary IoT Gateway', 'online', now, 'gateway-iot-primary', 'shared'),
        vendor: 'integration-hub',
        protocol: 'mqtt',
        connectorId: 'sensor-iot',
        connectedDeviceIds: mappedSensors.map((device) => device.id),
        integrationStatus: 'ready',
      },
      {
        kind: 'device-gateway',
        deviceCategory: 'gateway',
        ...baseFields(scope, now, 'gateway-vms-primary', 'Primary VMS Gateway', 'online', now, 'gateway-vms-primary', 'security-soc'),
        vendor: 'integration-hub',
        protocol: 'rtsp-bridge',
        connectorId: 'camera-vms',
        connectedDeviceIds: cameras.map((camera) => camera.id),
        integrationStatus: 'ready',
      },
    ];

    const deviceZones: DeviceZoneDto[] = workspace.restrictedZones.map((zone) => ({
      kind: 'device-zone',
      ...baseFields(scope, now, zone.id, zone.name, 'online', now, zone.id, 'security-soc', {
        securityZoneId: zone.id,
        assetId: zone.assetId,
        twinId: zone.twinId,
      }),
      zoneCode: zone.id,
      zoneType: 'surveillance',
      deviceIds: [...zone.cameraIds],
      cameraIds: zone.cameraIds,
      sensorIds: mappedSensors.filter((sensor) => sensor.securityZoneId === zone.id).map((sensor) => sensor.id),
      gatewayIds: ['gateway-vms-primary'],
      coverageDescription: zone.classification,
    }));

    const facilityZones: FacilityZoneDto[] = workspace.restrictedZones.slice(0, 2).map((zone, index) => ({
      kind: 'facility-zone',
      ...baseFields(scope, now, `facility-zone:${zone.id}`, `${zone.name} Facility Zone`, 'online', now, `facility-zone:${zone.id}`, index === 0 ? 'facilities-iot' : 'security-soc', {
        facilityId: `facility:${zone.id}`,
        securityZoneId: zone.id,
      }),
      facilityId: `facility:${zone.id}`,
      zoneCode: zone.id,
      zoneLabel: zone.name,
      deviceZoneIds: [zone.id],
      assignedDeviceIds: zone.cameraIds,
    }));

    const videoStreams: VideoStreamDto[] = cameras.map((camera) => ({
      kind: 'video-stream',
      ...baseFields(scope, now, `stream:${camera.id}:primary`, `${camera.displayName} Primary Stream`, camera.status === 'online' ? 'online' : camera.status === 'offline' ? 'offline' : 'degraded', camera.lastSeenAt, `stream:${camera.id}`, 'security-soc', {
        securityZoneId: camera.securityZoneId,
      }),
      cameraId: camera.id,
      streamStatus: camera.status === 'online' ? 'live' : camera.status === 'offline' ? 'offline' : 'buffering',
      protocol: 'rtsp',
      recordingActive: true,
    }));

    const recentReadings: SensorReadingDto[] = mappedSensors.slice(0, 3).map((device, index) => ({
      kind: 'sensor-reading',
      ...baseFields(scope, now, `reading:${device.id}:${index}`, `${device.displayName} reading`, device.status === 'online' ? 'online' : device.status === 'offline' ? 'offline' : 'degraded', device.lastSeenAt, `reading:${device.id}:${index}`, device.domainScope, {
        securityZoneId: device.securityZoneId,
      }),
      deviceId: device.id,
      metric: device.sensorType,
      value: device.status === 'online' ? 1 : 0,
      unit: 'state',
      valueType: 'numeric',
      observedAt: device.lastSeenAt,
      quality: device.status === 'online' ? 'good' : 'bad',
      evidence: [`telemetry:${device.id}`],
    }));

    const healthStatuses: DeviceHealthStatusDto[] = [...cameraReadiness.items, ...sensorReadiness.items].map((item) => ({
      kind: 'device-health-status',
      ...baseFields(scope, now, `health:${item.id}`, item.label, item.health, item.lastHeartbeatAt, `health:${item.id}`, 'shared', {
        securityZoneId: item.zoneId,
      }),
      deviceId: item.id,
      deviceKind: cameraReadiness.items.some((camera) => camera.id === item.id) ? 'camera-device' : 'iot-device',
      healthScore: item.health === 'online' ? 95 : item.health === 'degraded' ? 72 : 35,
      integrationStatus: item.integrationStatus,
      lastHeartbeatAt: item.lastHeartbeatAt,
      webhookConfigured: item.webhookConfigured,
      twinLinked: item.twinLinked,
      diagnostics: item.integrationStatus === 'blocked'
        ? [{ code: 'DEVICE_OFFLINE', message: 'Device heartbeat stale or unavailable.', severity: 'critical' as const }]
        : [],
    }));

    const retentionPolicies: RecordingRetentionPolicyDto[] = [
      {
        kind: 'recording-retention-policy',
        ...baseFields(scope, now, 'retention-security-default', 'Security Video Retention Default', 'online', now, 'retention-security-default', 'security-soc'),
        policyName: 'Security Video Retention Default',
        retentionDays: 90,
        disposition: 'retain',
        appliesToDeviceIds: mappedSensors.map((device) => device.id),
        appliesToCameraIds: cameras.map((camera) => camera.id),
        legalHoldEligible: true,
        privacyMaskingRequired: true,
        regulatoryFrameworks: ['SOC-2', 'local-surveillance-privacy'],
      },
    ];

    const openAlerts: DeviceAlertDto[] = [
      ...cameras
        .filter((camera) => camera.health !== 'healthy')
        .map((camera) => ({
          kind: 'device-alert' as const,
          ...baseFields(scope, now, `alert:${camera.id}`, camera.displayName, camera.status === 'online' ? 'online' : camera.status === 'offline' ? 'offline' : 'degraded', camera.lastSeenAt, `alert:${camera.id}`, 'security-soc', {
            securityZoneId: camera.securityZoneId,
          }),
          deviceId: camera.id,
          alertCode: 'CAMERA_HEALTH_DEGRADED',
          severity: camera.health === 'critical' ? 'critical' as const : 'medium' as const,
          alertStatus: 'open' as const,
          title: `${camera.displayName} health degraded`,
          detail: 'Camera heartbeat or integration readiness below nominal threshold.',
          triggeredAt: camera.lastSeenAt,
          evidence: [`health:${camera.id}`],
        })),
      ...mappedSensors
        .filter((sensor) => sensor.health !== 'healthy')
        .map((sensor) => ({
          kind: 'device-alert' as const,
          ...baseFields(scope, now, `alert:${sensor.id}`, sensor.displayName, sensor.status === 'online' ? 'online' : sensor.status === 'offline' ? 'offline' : 'degraded', sensor.lastSeenAt, `alert:${sensor.id}`, sensor.domainScope, {
            securityZoneId: sensor.securityZoneId,
          }),
          deviceId: sensor.id,
          alertCode: 'SENSOR_HEALTH_DEGRADED',
          severity: sensor.health === 'critical' ? 'critical' as const : 'medium' as const,
          alertStatus: 'open' as const,
          title: `${sensor.displayName} telemetry degraded`,
          detail: 'Sensor heartbeat or integration readiness below nominal threshold.',
          triggeredAt: sensor.lastSeenAt,
          evidence: [`health:${sensor.id}`],
        })),
    ];

    const incidentReferences: SurveillanceIncidentReferenceDto[] = workspace.incidents.slice(0, 3).map((incident) => {
      const linkedCamera = cameras.find((camera) => camera.securityZoneId === incident.zoneId);
      const linkedDevice = mappedSensors.find((sensor) => sensor.securityZoneId === incident.zoneId);
      return {
        kind: 'surveillance-incident-reference',
        ...baseFields(scope, now, `incident-ref:${incident.id}`, incident.title, 'online', incident.createdAt, `incident-ref:${incident.id}`, 'security-soc', {
          securityZoneId: incident.zoneId,
        }),
        incidentId: incident.id,
        cameraId: linkedCamera?.id,
        deviceId: linkedDevice?.id,
        zoneId: incident.zoneId,
        linkedAt: incident.createdAt,
        linkageReason: 'Security operations incident cross-reference',
        evidencePackageIds: incident.eventIds,
      };
    });

    const videoEvidence = cameras.slice(0, 2).flatMap((camera, index) => [{
      kind: 'video-evidence-reference' as const,
      ...baseFields(scope, now, `evidence:${camera.id}:${index}`, `${camera.displayName} clip`, camera.status === 'online' ? 'online' : camera.status === 'offline' ? 'offline' : 'degraded', camera.lastSeenAt, `evidence:${camera.id}:${index}`, 'security-soc', {
        securityZoneId: camera.securityZoneId,
      }),
      cameraId: camera.id,
      streamId: `stream:${camera.id}:primary`,
      incidentId: incidentReferences[index]?.incidentId,
      clipStartAt: offsetIso(now, 120 + index * 30),
      clipEndAt: offsetIso(now, 90 + index * 30),
      storageUri: `s3://evidence-archive/${camera.id}/clip-${index + 1}`,
      privacyMasked: camera.privacyMaskingEnabled,
      retentionPolicyId: retentionPolicies[0]?.id,
      legalHold: index === 0,
    }]);

    const cameraPresets: CameraPresetDto[] = cameras.map((camera) => ({
      kind: 'camera-preset',
      ...baseFields(scope, now, `preset:${camera.id}:home`, `${camera.displayName} Home`, camera.status === 'online' ? 'online' : camera.status === 'offline' ? 'offline' : 'degraded', camera.lastSeenAt, `preset:${camera.id}:home`, 'security-soc'),
      cameraId: camera.id,
      presetNumber: 1,
      presetLabel: 'Home',
      isHome: true,
    }));

    const assignments: DeviceAssignmentDto[] = cameras.map((camera) => ({
      kind: 'device-assignment',
      ...baseFields(scope, now, `assignment:${camera.id}`, `${camera.displayName} zone assignment`, camera.status === 'online' ? 'online' : camera.status === 'offline' ? 'offline' : 'degraded', camera.lastSeenAt, `assignment:${camera.id}`, 'security-soc', {
        securityZoneId: camera.securityZoneId,
      }),
      deviceId: camera.id,
      assignmentType: 'zone',
      assignedToId: camera.securityZoneId ?? camera.id,
      assignedToKind: 'device-zone',
      effectiveFrom: now,
      assignedBy: actor.id,
    }));

    const readiness = this.buildReadiness(scope, now, cameraReadiness, sensorReadiness, gateways);
    const onlineCount =
      cameras.filter((camera) => camera.status === 'online').length +
      mappedSensors.filter((sensor) => sensor.status === 'online').length +
      gateways.length;
    const totalDevices = cameras.length + mappedSensors.length + gateways.length;

    return {
      generatedAt: now,
      schemaVersion: surveillanceIoTSchemaVersion,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      cameras,
      iotDevices: mappedSensors,
      gateways,
      deviceZones,
      facilityZones,
      videoStreams,
      recentReadings,
      healthStatuses,
      retentionPolicies,
      openAlerts,
      incidentReferences,
      videoEvidence,
      rules: mappedSensors.slice(0, 4).map((device, index) => ({
        kind: 'device-rule' as const,
        ...baseFields(scope, now, `rule:${device.id}:threshold`, `${device.displayName} threshold rule`, device.status === 'online' ? 'online' : device.status === 'offline' ? 'offline' : 'degraded', device.lastSeenAt, `rule:${device.id}`, device.domainScope, {
          securityZoneId: device.securityZoneId,
        }),
        ruleName: `${device.displayName} ${device.sensorType} threshold`,
        enabled: device.status !== 'offline',
        trigger: 'threshold' as const,
        action: 'alert' as const,
        targetDeviceIds: [device.id],
        targetZoneIds: device.securityZoneId ? [device.securityZoneId] : [],
        conditionExpression: `${device.sensorType} ${index % 2 === 0 ? '>' : '<'} nominal_${index % 2 === 0 ? 'max' : 'min'}`,
        approvalRequired: index === 0,
        lastEvaluatedAt: device.status === 'offline' ? undefined : device.lastSeenAt,
      })),
      telemetrySnapshots: mappedSensors.map((device) => ({
        kind: 'device-telemetry-snapshot' as const,
        ...baseFields(scope, now, `snapshot:${device.id}`, `${device.displayName} snapshot`, device.status === 'online' ? 'online' : device.status === 'offline' ? 'offline' : 'degraded', device.lastSeenAt, `snapshot:${device.id}`, device.domainScope, {
          securityZoneId: device.securityZoneId,
        }),
        deviceId: device.id,
        gatewayId: 'gateway-iot-primary',
        capturedAt: device.lastSeenAt,
        metrics: [
          { name: device.sensorType, value: device.status === 'online' ? 1 : 0, unit: device.unit ?? 'state' },
          { name: 'signal-strength', value: device.status === 'online' ? 82 : 41, unit: 'dBm' },
        ],
        signalStrength: device.status === 'online' ? 82 : 41,
        batteryPct: device.sensorType.includes('door') ? undefined : 91,
        firmwareVersion: '1.4.2',
      })),
      cameraPresets,
      assignments,
      maintenanceRecords: [
        ...cameras.slice(0, 2).map((camera, index) => ({
          kind: 'device-maintenance-record' as const,
          ...baseFields(scope, now, `maintenance:${camera.id}`, `${camera.displayName} maintenance`, camera.status === 'online' ? 'online' : camera.status === 'offline' ? 'offline' : 'degraded', camera.lastSeenAt, `maintenance:${camera.id}`, 'security-soc', {
            securityZoneId: camera.securityZoneId,
          }),
          deviceId: camera.id,
          maintenanceStatus: (index === 0 ? 'completed' : 'scheduled') as DeviceMaintenanceRecordDto['maintenanceStatus'],
          maintenanceType: index === 0 ? 'inspection' as const : 'firmware' as const,
          scheduledAt: offsetIso(camera.lastSeenAt, index === 0 ? 1440 : 60),
          completedAt: index === 0 ? camera.lastSeenAt : undefined,
          notes: index === 0 ? 'Annual camera inspection completed.' : 'Firmware upgrade scheduled for next maintenance window.',
          evidence: [`maintenance:${camera.id}`],
        })),
        ...mappedSensors.slice(0, 3).map((device, index) => ({
          kind: 'device-maintenance-record' as const,
          ...baseFields(scope, now, `maintenance:${device.id}`, `${device.displayName} maintenance`, device.status === 'online' ? 'online' : device.status === 'offline' ? 'offline' : 'degraded', device.lastSeenAt, `maintenance:${device.id}`, device.domainScope, {
            securityZoneId: device.securityZoneId,
          }),
          deviceId: device.id,
          maintenanceStatus: (index === 0 ? 'scheduled' : index === 1 ? 'in-progress' : 'completed') as DeviceMaintenanceRecordDto['maintenanceStatus'],
          maintenanceType: index === 2 ? 'calibration' as const : 'inspection' as const,
          scheduledAt: device.lastSeenAt,
          completedAt: index === 2 ? now : undefined,
          notes: index === 0 ? 'Quarterly sensor inspection window.' : 'Routine maintenance cycle.',
          evidence: [`maintenance:${device.id}`],
        })),
      ],
      readiness,
      coverage: {
        cameraCount: cameras.length,
        iotDeviceCount: mappedSensors.length,
        gatewayCount: gateways.length,
        onlinePct: totalDevices ? Math.round((onlineCount / totalDevices) * 100) : 100,
        integrationReadyPct: readiness.score,
      },
      mock: false,
    };
  }

  buildReadiness(
    scope: SurveillanceIoTScope,
    now: string,
    cameraReadiness: ReturnType<SecurityOperationsService['getCameraReadiness']>,
    sensorReadiness: ReturnType<SecurityOperationsService['getSensorReadiness']>,
    gateways: DeviceGatewayDto[],
  ): SurveillanceIoTReadinessDto {
    const mapItem = (
      item: (typeof cameraReadiness.items)[number],
      deviceKind: SurveillanceIoTReadinessDto['cameras'][number]['deviceKind'],
    ) => ({
      deviceId: item.id,
      deviceKind,
      label: item.label,
      zoneId: item.zoneId,
      health: healthBand(item.health),
      integrationStatus: item.integrationStatus,
      lastHeartbeatAt: item.lastHeartbeatAt,
      webhookConfigured: item.webhookConfigured,
      twinLinked: item.twinLinked,
    });

    const cameras = cameraReadiness.items.map((item) => mapItem(item, 'camera-device'));
    const sensors = sensorReadiness.items.map((item) => mapItem(item, 'iot-device'));
    const gatewayItems = gateways.map((gateway) => ({
      deviceId: gateway.id,
      deviceKind: 'device-gateway' as const,
      label: gateway.displayName,
      zoneId: gateway.deviceZoneId ?? 'platform',
      health: gateway.health,
      integrationStatus: gateway.integrationStatus,
      lastHeartbeatAt: gateway.lastSeenAt,
      webhookConfigured: true,
      twinLinked: Boolean(gateway.twinId),
    }));

    const all = [...cameras, ...sensors, ...gatewayItems];
    const ready = all.filter((item) => item.integrationStatus === 'ready').length;
    const watch = all.filter((item) => item.integrationStatus === 'watch').length;
    const blocked = all.filter((item) => item.integrationStatus === 'blocked').length;
    const score = all.length ? Math.round((ready / all.length) * 100) : 100;

    return {
      generatedAt: now,
      schemaVersion: surveillanceIoTSchemaVersion,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      score,
      ready,
      watch,
      blocked,
      cameras,
      sensors,
      gateways: gatewayItems,
      mock: false,
    };
  }

  getReadiness(actor: SecurityActor): SurveillanceIoTReadinessDto {
    return this.buildWorkspace(actor).readiness;
  }
}

export function createSurveillanceIoTProjectionService(
  securityOps: SecurityOperationsService,
  clock?: () => string,
  scope?: SurveillanceIoTScope,
): SurveillanceIoTProjectionService {
  return new SurveillanceIoTProjectionService(securityOps, clock, scope);
}
