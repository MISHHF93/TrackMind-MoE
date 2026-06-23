import type {
  RaceDayDisruptionAlertDto,
  RaceDayDisruptionCategory,
  RaceDayMonitoredZoneSummaryDto,
  RaceDaySurveillanceCameraDto,
  RaceDaySurveillanceCameraGroup,
  RaceDaySurveillancePlaceholderDto,
  RaceDaySurveillanceVisibilityWorkspaceDto,
  RaceDayZoneReadinessDeviceDto,
  SurveillanceAlertEventDto,
  SurveillanceAlertRuleKind,
  SurveillanceIoTWorkspaceDto,
  SurveillanceOperationalZoneDto,
  SurveillanceOperationalZoneKind,
} from '@trackmind/shared';
import { raceDaySurveillanceVisibilitySchemaVersion } from '@trackmind/shared';
import type { SecurityActor } from './securityOps.js';
import type { SurveillanceIoTModule } from './surveillanceIoT/surveillanceIoTModule.js';

const PLACEHOLDER_NOTICE =
  'Contract placeholder — no automated detection or analytics ingest is connected. For operational awareness only.';

const RACE_DAY_ZONE_KINDS = new Set<SurveillanceOperationalZoneKind>([
  'paddock',
  'starting-gate',
  'racetrack',
  'track-surface',
  'operations-room',
  'public',
]);

const RACE_DAY_RULE_KINDS = new Set<SurveillanceAlertRuleKind>([
  'camera-offline',
  'stream-degraded',
  'gateway-disconnected',
  'sensor-threshold-breach',
  'motion-activity',
  'crowding-queue',
  'environmental-anomaly',
  'track-surface-condition',
]);

function cameraGroupForZoneKind(zoneKind: SurveillanceOperationalZoneKind): RaceDaySurveillanceCameraGroup | null {
  if (zoneKind === 'paddock') return 'paddock';
  if (zoneKind === 'starting-gate') return 'starting-gate';
  if (zoneKind === 'racetrack' || zoneKind === 'track-surface') return 'trackside';
  return null;
}

function readinessPosture(health: string, status: string): RaceDayZoneReadinessDeviceDto['readinessPosture'] {
  if (status === 'offline' || health === 'critical' || health === 'offline') return 'blocked';
  if (status === 'degraded' || health === 'degraded') return 'watch';
  return 'ready';
}

function disruptionCategoryForRule(ruleKind: SurveillanceAlertRuleKind): RaceDayDisruptionCategory {
  if (ruleKind === 'environmental-anomaly' || ruleKind === 'track-surface-condition') return 'environmental';
  if (ruleKind === 'crowding-queue') return 'crowd-flow';
  if (ruleKind === 'camera-offline' || ruleKind === 'stream-degraded' || ruleKind === 'gateway-disconnected') {
    return 'device-health';
  }
  if (ruleKind === 'sensor-threshold-breach' || ruleKind === 'motion-activity') return 'zone-readiness';
  return 'operational';
}

function isOpenResolution(status: string): boolean {
  return status === 'open' || status === 'acknowledged' || status === 'escalated';
}

function mapCamera(
  cameraId: string,
  group: RaceDaySurveillanceCameraGroup,
  workspace: SurveillanceIoTWorkspaceDto,
  zone?: SurveillanceOperationalZoneDto,
  coverageTags: string[] = [],
): RaceDaySurveillanceCameraDto | null {
  const camera = workspace.cameras.find((item) => item.id === cameraId);
  if (!camera) return null;
  return {
    cameraId: camera.id,
    label: camera.displayName,
    group,
    health: camera.health,
    status: camera.status,
    operationalZoneId: zone?.zoneId,
    operationalZoneLabel: zone?.zoneLabel,
    coverageTags: coverageTags.length ? coverageTags : camera.tags ?? [],
    lastSeenAt: camera.lastSeenAt,
    privacyMasking: camera.privacyMaskingEnabled,
    playbackUnavailable: true,
  };
}

function findRaceDayZone(
  event: SurveillanceAlertEventDto,
  raceDayZones: SurveillanceOperationalZoneDto[],
): SurveillanceOperationalZoneDto | undefined {
  const securityZoneId = event.sourceZone?.zoneId;
  if (!securityZoneId) return undefined;
  return raceDayZones.find(
    (zone) => zone.linkedSecurityZoneId === securityZoneId || zone.zoneId === securityZoneId,
  );
}

function mapDisruptionAlert(
  event: SurveillanceAlertEventDto,
  raceDayZones: SurveillanceOperationalZoneDto[],
): RaceDayDisruptionAlertDto | null {
  if (!RACE_DAY_RULE_KINDS.has(event.ruleKind)) return null;
  const zone = findRaceDayZone(event, raceDayZones);
  if (zone && !RACE_DAY_ZONE_KINDS.has(zone.zoneKind)) return null;

  return {
    eventId: event.eventId,
    ruleKind: event.ruleKind,
    title: event.title,
    severity: event.severity,
    resolutionStatus: event.resolutionStatus,
    monitoredZoneId: zone?.zoneId,
    monitoredZoneLabel: zone?.zoneLabel ?? event.sourceZone?.zoneLabel,
    sourceDeviceLabel: event.sourceDevice?.displayName,
    triggeredAt: event.triggeredAt,
    placeholderDerived: event.placeholderDerived,
    disruptionCategory: disruptionCategoryForRule(event.ruleKind),
  };
}

export class RaceDaySurveillanceVisibilityService {
  buildVisibilityWorkspace(
    actor: SecurityActor,
    surveillanceModule: SurveillanceIoTModule,
    now: string,
  ): RaceDaySurveillanceVisibilityWorkspaceDto {
    const surveillanceWorkspace = surveillanceModule.buildWorkspace(actor);
    const alertingWorkspace = surveillanceModule.getAlertingWorkspace(actor);
    const zoneMapping = surveillanceModule.getZoneMappingWorkspace(actor);

    const raceDayZones = zoneMapping.operationalZones.filter((zone) => RACE_DAY_ZONE_KINDS.has(zone.zoneKind));

    const paddockCameras: RaceDaySurveillanceCameraDto[] = [];
    const startingGateCameras: RaceDaySurveillanceCameraDto[] = [];
    const tracksideCameras: RaceDaySurveillanceCameraDto[] = [];
    const seenCameras = new Set<string>();

    const addCamera = (camera: RaceDaySurveillanceCameraDto) => {
      if (seenCameras.has(camera.cameraId)) return;
      seenCameras.add(camera.cameraId);
      if (camera.group === 'paddock') paddockCameras.push(camera);
      if (camera.group === 'starting-gate') startingGateCameras.push(camera);
      if (camera.group === 'trackside') tracksideCameras.push(camera);
    };

    raceDayZones.forEach((zone) => {
      const group = cameraGroupForZoneKind(zone.zoneKind);
      if (!group) return;
      zone.linkedDevices
        .filter((device) => device.deviceKind === 'camera-device')
        .forEach((device) => {
          const mapped = mapCamera(device.deviceId, group, surveillanceWorkspace, zone);
          if (mapped) addCamera(mapped);
        });
    });

    surveillanceWorkspace.cameras.forEach((camera) => {
      const haystack = `${camera.id} ${camera.displayName}`.toLowerCase();
      if (haystack.includes('pad') || camera.securityZoneId === 'zone-paddock') {
        const mapped = mapCamera(
          camera.id,
          'paddock',
          surveillanceWorkspace,
          raceDayZones.find((zone) => zone.zoneId === 'opz-paddock'),
          ['paddock-gate'],
        );
        if (mapped) addCamera(mapped);
      }
      if (haystack.includes('start') || haystack.includes('gate-chute') || haystack.includes('starter')) {
        const mapped = mapCamera(
          camera.id,
          'starting-gate',
          surveillanceWorkspace,
          raceDayZones.find((zone) => zone.zoneId === 'opz-starting-gate'),
        );
        if (mapped) addCamera(mapped);
      }
      if (haystack.includes('track') || haystack.includes('turn') || haystack.includes('finish') || haystack.includes('rail')) {
        const mapped = mapCamera(
          camera.id,
          'trackside',
          surveillanceWorkspace,
          raceDayZones.find((zone) => zone.zoneId === 'opz-racetrack-main'),
        );
        if (mapped) addCamera(mapped);
      }
    });

    const zoneReadinessDevices: RaceDayZoneReadinessDeviceDto[] = [];
    raceDayZones.forEach((zone) => {
      zone.linkedDevices.forEach((device) => {
        const source =
          device.deviceKind === 'camera-device'
            ? surveillanceWorkspace.cameras.find((item) => item.id === device.deviceId)
            : surveillanceWorkspace.iotDevices.find((item) => item.id === device.deviceId);
        zoneReadinessDevices.push({
          deviceId: device.deviceId,
          label: device.displayName,
          deviceKind: device.deviceKind,
          operationalZoneId: zone.zoneId,
          operationalZoneLabel: zone.zoneLabel,
          zoneKind: zone.zoneKind,
          health: device.health,
          status: device.deviceStatus,
          readinessPosture: readinessPosture(device.health, device.deviceStatus),
          sensorType: source && 'sensorType' in source ? source.sensorType : undefined,
          lastSeenAt: source?.lastSeenAt,
        });
      });
      surveillanceWorkspace.gateways
        .filter((gateway) => zone.gatewayIds.includes(gateway.id))
        .forEach((gateway) => {
          zoneReadinessDevices.push({
            deviceId: gateway.id,
            label: gateway.displayName,
            deviceKind: 'device-gateway',
            operationalZoneId: zone.zoneId,
            operationalZoneLabel: zone.zoneLabel,
            zoneKind: zone.zoneKind,
            health: gateway.health,
            status: gateway.status,
            readinessPosture: readinessPosture(gateway.health, gateway.status),
            lastSeenAt: gateway.lastSeenAt,
          });
        });
    });

    const weatherEnvironmentalPlaceholders = this.buildWeatherPlaceholders(raceDayZones, surveillanceWorkspace);
    const crowdQueuePlaceholders = this.buildCrowdPlaceholders(raceDayZones, surveillanceWorkspace);

    const disruptionAlerts = alertingWorkspace.framework.alertEvents
      .map((event) => mapDisruptionAlert(event, raceDayZones))
      .filter((event): event is RaceDayDisruptionAlertDto => event !== null);

    weatherEnvironmentalPlaceholders.forEach((placeholder) => {
      disruptionAlerts.push({
        eventId: placeholder.placeholderId,
        ruleKind: 'environmental-anomaly',
        title: placeholder.title,
        severity: 'info',
        resolutionStatus: 'open',
        monitoredZoneLabel: raceDayZones.find((zone) => zone.zoneKind === 'track-surface')?.zoneLabel,
        triggeredAt: now,
        placeholderDerived: true,
        disruptionCategory: 'environmental',
      });
    });

    crowdQueuePlaceholders.forEach((placeholder) => {
      disruptionAlerts.push({
        eventId: placeholder.placeholderId,
        ruleKind: 'crowding-queue',
        title: placeholder.title,
        severity: 'info',
        resolutionStatus: 'open',
        monitoredZoneLabel: raceDayZones.find((zone) => zone.zoneKind === 'public')?.zoneLabel,
        triggeredAt: now,
        placeholderDerived: true,
        disruptionCategory: 'crowd-flow',
      });
    });

    const monitoredZones: RaceDayMonitoredZoneSummaryDto[] = raceDayZones.map((zone) => ({
      zoneId: zone.zoneId,
      zoneLabel: zone.zoneLabel,
      zoneKind: zone.zoneKind,
      healthBand: zone.healthSummary.healthBand,
      cameraCount: zone.healthSummary.cameraCount,
      iotDeviceCount: zone.healthSummary.iotDeviceCount,
      openAlertCount: zone.healthSummary.openAlertCount,
      coveragePct: zone.healthSummary.coveragePct,
    }));

    const offlineDevices = zoneReadinessDevices.filter(
      (device) => device.readinessPosture === 'blocked',
    ).length;
    const openDisruptionAlerts = disruptionAlerts.filter((alert) => isOpenResolution(alert.resolutionStatus)).length;
    const criticalDisruptionAlerts = disruptionAlerts.filter((alert) => alert.severity === 'critical').length;

    return {
      generatedAt: now,
      schemaVersion: raceDaySurveillanceVisibilitySchemaVersion,
      organizationId: surveillanceWorkspace.organizationId,
      tenantId: surveillanceWorkspace.tenantId,
      racetrackId: surveillanceWorkspace.racetrackId,
      visibilityNotice:
        'Race-day surveillance visibility is metadata-only — camera health, zone readiness, and alert linkage without unrestricted playback.',
      summary: {
        paddockCameras: paddockCameras.length,
        startingGateCameras: startingGateCameras.length,
        tracksideCameras: tracksideCameras.length,
        zoneReadinessDevices: zoneReadinessDevices.length,
        openDisruptionAlerts,
        criticalDisruptionAlerts,
        placeholderContracts: weatherEnvironmentalPlaceholders.length + crowdQueuePlaceholders.length,
        offlineDevices,
      },
      paddockCameras,
      startingGateCameras,
      tracksideCameras,
      zoneReadinessDevices,
      weatherEnvironmentalPlaceholders,
      crowdQueuePlaceholders,
      disruptionAlerts,
      monitoredZones,
      filterOptions: {
        cameraGroups: ['paddock', 'starting-gate', 'trackside'],
        disruptionCategories: ['device-health', 'environmental', 'crowd-flow', 'zone-readiness', 'operational'],
        placeholderKinds: ['weather-environmental', 'crowd-queue-congestion'],
        severities: ['info', 'low', 'medium', 'high', 'critical'],
      },
      mock: false,
    };
  }

  private buildWeatherPlaceholders(
    zones: SurveillanceOperationalZoneDto[],
    workspace: SurveillanceIoTWorkspaceDto,
  ): RaceDaySurveillancePlaceholderDto[] {
    const surfaceZone = zones.find((zone) => zone.zoneKind === 'track-surface');
    const environmentalDevices = workspace.iotDevices.filter((device) => {
      const haystack = `${device.displayName} ${device.sensorType}`.toLowerCase();
      return haystack.includes('weather') || haystack.includes('environment') || haystack.includes('temp') || haystack.includes('wind');
    });

    return [
      {
        placeholderId: 'placeholder:race-day-weather-environmental',
        placeholderKind: 'weather-environmental',
        title: 'Weather / environmental sensor correlation (placeholder)',
        detail:
          'Reserved contract for correlating race-day weather holds, lightning proximity, and track-surface environmental sensors once approved ingest is connected.',
        readiness: 'placeholder',
        placeholderNotice: PLACEHOLDER_NOTICE,
        relatedZoneIds: [
          surfaceZone?.zoneId ?? 'opz-track-surface',
          zones.find((zone) => zone.zoneKind === 'operations-room')?.zoneId ?? 'opz-operations-room',
        ].filter(Boolean),
        relatedDeviceIds: environmentalDevices.map((device) => device.id),
      },
    ];
  }

  private buildCrowdPlaceholders(
    zones: SurveillanceOperationalZoneDto[],
    workspace: SurveillanceIoTWorkspaceDto,
  ): RaceDaySurveillancePlaceholderDto[] {
    const publicZones = zones.filter((zone) => zone.zoneKind === 'public' || zone.zoneKind === 'hospitality');
    const crowdCameras = workspace.cameras.filter((camera) => {
      const haystack = `${camera.id} ${camera.displayName}`.toLowerCase();
      return haystack.includes('grand') || haystack.includes('public') || haystack.includes('concourse');
    });

    return [
      {
        placeholderId: 'placeholder:race-day-crowd-queue',
        placeholderKind: 'crowd-queue-congestion',
        title: 'Crowd / queue / congestion monitoring (placeholder)',
        detail:
          'Reserved contract for queue depth, ingress congestion, and guest-flow correlation across public concourse cameras once approved analytics ingest is connected.',
        readiness: 'placeholder',
        placeholderNotice: PLACEHOLDER_NOTICE,
        relatedZoneIds: publicZones.map((zone) => zone.zoneId),
        relatedDeviceIds: crowdCameras.map((camera) => camera.id),
      },
    ];
  }
}
