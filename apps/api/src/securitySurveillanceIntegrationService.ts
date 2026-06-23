import type {
  SecuritySurveillanceAlertPlaceholderDto,
  SecuritySurveillanceAlertSummaryDto,
  SecuritySurveillanceIntegrationWorkspaceDto,
  SurveillanceAlertEventDto,
  SurveillanceAlertRuleKind,
  SurveillanceIoTWorkspaceDto,
} from '@trackmind/shared';
import { securitySurveillanceIntegrationSchemaVersion } from '@trackmind/shared';
import type {
  AccessControlEvent,
  CameraAsset,
  RestrictedZone,
  SecurityIncident,
  SecurityOperationsService,
  SecuritySensorAsset,
} from './securityOps.js';
import type { SecurityActor } from './securityOps.js';
import type { SurveillanceIoTModule } from './surveillanceIoT/surveillanceIoTModule.js';

const PLACEHOLDER_NOTICE =
  'Contract placeholder — no automated detection or analytics ingest is connected. For operational triage only.';

const SECURITY_RULE_KINDS = new Set<SurveillanceAlertRuleKind>([
  'camera-offline',
  'stream-degraded',
  'gateway-disconnected',
  'sensor-threshold-breach',
  'restricted-zone-event',
  'motion-activity',
]);

function zoneName(zones: RestrictedZone[], zoneId: string): string {
  return zones.find((zone) => zone.id === zoneId)?.name ?? zoneId;
}

function camerasForZone(cameras: CameraAsset[], zoneId: string): CameraAsset[] {
  return cameras.filter((camera) => camera.zoneId === zoneId);
}

function sensorsForZone(sensors: SecuritySensorAsset[], zoneId: string): SecuritySensorAsset[] {
  return sensors.filter((sensor) => sensor.zoneId === zoneId);
}

function isOpenResolution(status: string): boolean {
  return status === 'open' || status === 'acknowledged' || status === 'escalated';
}

function mapFrameworkAlert(event: SurveillanceAlertEventDto): SecuritySurveillanceAlertSummaryDto | null {
  if (!SECURITY_RULE_KINDS.has(event.ruleKind)) return null;
  return {
    eventId: event.eventId,
    ruleKind: event.ruleKind,
    title: event.title,
    severity: event.severity,
    resolutionStatus: event.resolutionStatus,
    sourceDeviceId: event.sourceDevice?.deviceId,
    sourceDeviceLabel: event.sourceDevice?.displayName,
    sourceDeviceKind: event.sourceDevice?.deviceKind,
    sourceZoneLabel: event.sourceZone?.zoneLabel,
    triggeredAt: event.triggeredAt,
    placeholderDerived: event.placeholderDerived,
    linkedIncidentId: event.linkedIncident?.incidentId,
  };
}

export class SecuritySurveillanceIntegrationService {
  buildIntegrationWorkspace(
    actor: SecurityActor,
    securityOps: SecurityOperationsService,
    surveillanceModule: SurveillanceIoTModule,
    now: string,
  ): SecuritySurveillanceIntegrationWorkspaceDto {
    const securityWorkspace = securityOps.getWorkspace(actor);
    const surveillanceWorkspace = surveillanceModule.buildWorkspace(actor);
    const alertingWorkspace = surveillanceModule.getAlertingWorkspace(actor);

    const zones = securityWorkspace.restrictedZones.filter(
      (zone) => zone.classification === 'restricted' || zone.classification === 'critical',
    );
    const cameras = securityWorkspace.cameras;
    const sensors = this.listSecuritySensors(securityOps, actor);

    const restrictedZoneCameraCoverage = zones.map((zone) => {
      const zoneCameras = cameras.filter((camera) => zone.cameraIds.includes(camera.id));
      const offlineCount = zoneCameras.filter((camera) => camera.health === 'offline').length;
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        classification: zone.classification,
        cameraIds: zone.cameraIds,
        cameras: zoneCameras.map((camera) => ({
          cameraId: camera.id,
          label: camera.label,
          health: camera.health,
          coverageTags: camera.coverage ?? [],
          lastHeartbeatAt: camera.lastHeartbeatAt,
          privacyMasking: camera.privacyMasking,
        })),
        coverageGapNotice:
          offlineCount > 0
            ? `${offlineCount} assigned camera(s) offline — review coverage before relying on zone video correlation.`
            : zoneCameras.length === 0
              ? 'No cameras assigned to this restricted zone in the security registry.'
              : undefined,
      };
    });

    const accessRelatedSensorEvents = this.buildAccessSensorEvents(
      securityWorkspace.accessEvents,
      securityWorkspace.incidents,
      sensors,
      zones,
      surveillanceWorkspace,
      now,
    );

    const surveillanceAlertPlaceholders = this.buildPlaceholders(zones, cameras, sensors);

    const incidentDeviceLinkages = securityWorkspace.incidents.map((incident) =>
      this.linkIncidentDevices(incident, zones, cameras, sensors, surveillanceWorkspace),
    );

    const incidentEvidenceReferences = this.buildEvidenceReferences(
      securityWorkspace.incidents,
      securityWorkspace.accessEvents,
      surveillanceWorkspace,
      securityWorkspace.investigations,
    );

    const frameworkAlerts = alertingWorkspace.framework.alertEvents
      .map(mapFrameworkAlert)
      .filter((event): event is SecuritySurveillanceAlertSummaryDto => event !== null);

    const placeholderSummaries: SecuritySurveillanceAlertSummaryDto[] = surveillanceAlertPlaceholders.map(
      (placeholder) => ({
        eventId: placeholder.placeholderId,
        ruleKind: placeholder.placeholderKind,
        title: placeholder.title,
        severity: 'info',
        resolutionStatus: 'open',
        triggeredAt: now,
        placeholderDerived: true,
        sourceZoneLabel: placeholder.relatedZoneIds[0]
          ? zoneName(zones, placeholder.relatedZoneIds[0])
          : undefined,
      }),
    );

    const surveillanceAlerts = [...frameworkAlerts, ...placeholderSummaries];
    const openSurveillanceAlerts = surveillanceAlerts.filter((alert) => isOpenResolution(alert.resolutionStatus)).length;
    const criticalSurveillanceAlerts = surveillanceAlerts.filter((alert) => alert.severity === 'critical').length;

    return {
      generatedAt: now,
      schemaVersion: securitySurveillanceIntegrationSchemaVersion,
      organizationId: surveillanceWorkspace.organizationId,
      tenantId: surveillanceWorkspace.tenantId,
      racetrackId: surveillanceWorkspace.racetrackId,
      summary: {
        openSurveillanceAlerts,
        criticalSurveillanceAlerts,
        restrictedZonesWithCoverage: restrictedZoneCameraCoverage.filter((zone) => zone.cameras.length > 0).length,
        accessSensorEvents: accessRelatedSensorEvents.length,
        incidentsWithDeviceLinkage: incidentDeviceLinkages.filter(
          (link) => link.linkedCameraIds.length > 0 || link.linkedSensorIds.length > 0,
        ).length,
        evidenceReferences: incidentEvidenceReferences.length,
        placeholderAlertContracts: surveillanceAlertPlaceholders.length,
      },
      restrictedZoneCameraCoverage,
      accessRelatedSensorEvents,
      surveillanceAlertPlaceholders,
      incidentDeviceLinkages,
      incidentEvidenceReferences,
      surveillanceAlerts,
      filterOptions: {
        ruleKinds: [
          'camera-offline',
          'stream-degraded',
          'gateway-disconnected',
          'sensor-threshold-breach',
          'restricted-zone-event',
          'motion-activity',
          'suspicious-activity',
          'perimeter-monitoring',
        ],
        severities: ['info', 'low', 'medium', 'high', 'critical'],
        placeholderKinds: ['suspicious-activity', 'perimeter-monitoring'],
      },
      mock: false,
    };
  }

  private listSecuritySensors(securityOps: SecurityOperationsService, actor: SecurityActor): SecuritySensorAsset[] {
    const readiness = securityOps.getSensorReadiness(actor);
    return readiness.items.map((item) => ({
      id: item.id,
      zoneId: item.zoneId,
      label: item.label,
      sensorType: this.inferSensorType(item.label),
      health: item.health,
      lastHeartbeatAt: item.lastHeartbeatAt,
    }));
  }

  private inferSensorType(label: string): SecuritySensorAsset['sensorType'] {
    const normalized = label.toLowerCase();
    if (normalized.includes('door')) return 'door-contact';
    if (normalized.includes('motion')) return 'motion';
    if (normalized.includes('access')) return 'access-panel';
    return 'environmental';
  }

  private buildAccessSensorEvents(
    accessEvents: AccessControlEvent[],
    incidents: SecurityIncident[],
    sensors: SecuritySensorAsset[],
    zones: RestrictedZone[],
    surveillanceWorkspace: SurveillanceIoTWorkspaceDto,
    now: string,
  ) {
    const events: SecuritySurveillanceIntegrationWorkspaceDto['accessRelatedSensorEvents'] = [];

    accessEvents.forEach((access) => {
      if (access.decision !== 'denied') return;
      const zone = zones.find((item) => item.id === access.zoneId);
      const doorSensor = sensors.find(
        (sensor) => sensor.zoneId === access.zoneId && sensor.sensorType === 'door-contact',
      );
      const linkedIncident = incidents.find((incident) => incident.eventIds.includes(access.eventId));
      events.push({
        eventId: `access-sensor:${access.id}`,
        sensorId: doorSensor?.id,
        sensorLabel: doorSensor?.label,
        sensorType: doorSensor?.sensorType,
        zoneId: access.zoneId,
        zoneName: zone?.name ?? access.zoneId,
        eventKind: 'credential-denied',
        severity: zone?.classification === 'critical' ? 'critical' : 'high',
        detail: `Access denied — ${access.reason}`,
        occurredAt: access.occurredAt,
        linkedAccessEventId: access.id,
        linkedIncidentId: linkedIncident?.id,
      });
    });

    sensors
      .filter((sensor) => sensor.sensorType === 'door-contact' || sensor.sensorType === 'access-panel')
      .forEach((sensor) => {
        if (sensor.health === 'online') return;
        events.push({
          eventId: `sensor-health:${sensor.id}`,
          sensorId: sensor.id,
          sensorLabel: sensor.label,
          sensorType: sensor.sensorType,
          zoneId: sensor.zoneId,
          zoneName: zoneName(zones, sensor.zoneId),
          eventKind: 'sensor-health',
          severity: sensor.health === 'offline' ? 'high' : 'medium',
          detail: `${sensor.label} reporting ${sensor.health} health — review access-control correlation.`,
          occurredAt: sensor.lastHeartbeatAt,
        });
      });

    surveillanceWorkspace.openAlerts
      .filter((alert) => alert.alertCode.includes('SENSOR') || alert.alertCode.includes('THRESHOLD'))
      .slice(0, 5)
      .forEach((alert) => {
        const device = surveillanceWorkspace.iotDevices.find((item) => item.id === alert.deviceId);
        events.push({
          eventId: alert.id,
          sensorId: alert.deviceId,
          sensorLabel: device?.displayName ?? alert.displayName,
          sensorType: device?.sensorType,
          zoneId: device?.securityZoneId ?? 'unknown',
          zoneName: zoneName(zones, device?.securityZoneId ?? ''),
          eventKind: 'threshold-breach',
          severity: alert.severity,
          detail: alert.detail,
          occurredAt: alert.triggeredAt,
        });
      });

    if (events.length === 0) {
      events.push({
        eventId: 'access-sensor:seed-granted',
        zoneId: zones[0]?.id ?? 'zone-paddock',
        zoneName: zones[0]?.name ?? 'Paddock restricted gate',
        eventKind: 'door-contact',
        severity: 'low',
        detail: 'No active access denials — door contact sensors reporting nominal state.',
        occurredAt: now,
      });
    }

    return events;
  }

  private buildPlaceholders(
    zones: RestrictedZone[],
    cameras: CameraAsset[],
    sensors: SecuritySensorAsset[],
  ): SecuritySurveillanceAlertPlaceholderDto[] {
    const restrictedZones = zones.filter((zone) => zone.classification !== 'public');
    const perimeterZones = zones.filter((zone) => zone.classification === 'restricted' || zone.classification === 'critical');
    const perimeterCameras = cameras.filter((camera) =>
      perimeterZones.some((zone) => zone.cameraIds.includes(camera.id)),
    );
    const motionSensors = sensors.filter((sensor) => sensor.sensorType === 'motion');

    return [
      {
        placeholderId: 'placeholder:suspicious-activity',
        placeholderKind: 'suspicious-activity',
        title: 'Suspicious activity alert (placeholder)',
        detail: 'Reserved contract for correlating manual security reports with camera and sensor context once approved ingest is connected.',
        readiness: 'placeholder',
        placeholderNotice: PLACEHOLDER_NOTICE,
        relatedZoneIds: restrictedZones.map((zone) => zone.id),
        relatedCameraIds: cameras.slice(0, 3).map((camera) => camera.id),
        relatedSensorIds: motionSensors.map((sensor) => sensor.id),
      },
      {
        placeholderId: 'placeholder:perimeter-monitoring',
        placeholderKind: 'perimeter-monitoring',
        title: 'Perimeter monitoring alert (placeholder)',
        detail: 'Reserved contract for perimeter breach or fence-line sensor correlation once perimeter ingest is approved.',
        readiness: 'placeholder',
        placeholderNotice: PLACEHOLDER_NOTICE,
        relatedZoneIds: perimeterZones.map((zone) => zone.id),
        relatedCameraIds: perimeterCameras.map((camera) => camera.id),
        relatedSensorIds: sensors
          .filter((sensor) => sensor.sensorType === 'door-contact' || sensor.sensorType === 'access-panel')
          .map((sensor) => sensor.id),
      },
    ];
  }

  private linkIncidentDevices(
    incident: SecurityIncident,
    zones: RestrictedZone[],
    cameras: CameraAsset[],
    sensors: SecuritySensorAsset[],
    surveillanceWorkspace: SurveillanceIoTWorkspaceDto,
  ) {
    const zone = zones.find((item) => item.id === incident.zoneId);
    const zoneCameras = camerasForZone(cameras, incident.zoneId);
    const zoneSensors = sensorsForZone(sensors, incident.zoneId);
    const surveillanceCameras = surveillanceWorkspace.cameras.filter(
      (camera) => camera.securityZoneId === incident.zoneId,
    );
    const surveillanceDevices = surveillanceWorkspace.iotDevices.filter(
      (device) => device.securityZoneId === incident.zoneId,
    );

    const linkedCameraIds = [...new Set([...zoneCameras.map((camera) => camera.id), ...surveillanceCameras.map((camera) => camera.id)])];
    const linkedSensorIds = [...new Set([...zoneSensors.map((sensor) => sensor.id), ...surveillanceDevices.map((device) => device.id)])];
    const linkedDeviceIds = [...new Set([...linkedCameraIds, ...linkedSensorIds])];

    return {
      incidentId: incident.id,
      incidentTitle: incident.title,
      severity: incident.severity,
      status: incident.status,
      zoneId: incident.zoneId,
      zoneName: zone?.name ?? incident.zoneId,
      linkedCameraIds,
      linkedSensorIds,
      linkedDeviceIds,
      linkageReason: 'Zone-scoped correlation from security registry and surveillance IoT projection.',
    };
  }

  private buildEvidenceReferences(
    incidents: SecurityIncident[],
    accessEvents: AccessControlEvent[],
    surveillanceWorkspace: SurveillanceIoTWorkspaceDto,
    investigations: Array<{ incidentId: string; evidence: string[] }>,
  ) {
    const references: SecuritySurveillanceIntegrationWorkspaceDto['incidentEvidenceReferences'] = [];

    incidents.forEach((incident) => {
      const investigation = investigations.find((item) => item.incidentId === incident.id);
      const videoEvidence = surveillanceWorkspace.videoEvidence.filter(
        (evidence) => evidence.incidentId === incident.id || incident.eventIds.some((eventId) => evidence.id.includes(eventId)),
      );
      videoEvidence.forEach((evidence) => {
        references.push({
          evidenceReferenceId: evidence.id,
          incidentId: incident.id,
          kind: 'video-evidence',
          title: evidence.displayName,
          cameraId: evidence.cameraId,
          storageUri: evidence.storageUri,
          capturedAt: evidence.clipStartAt,
          evidence: [`video:${evidence.cameraId}`, ...(investigation?.evidence ?? [])],
          privacyMasked: evidence.privacyMasked,
          playbackUnavailable: true,
        });
      });

      incident.eventIds.forEach((eventId) => {
        const access = accessEvents.find((item) => item.eventId === eventId || item.id === eventId);
        if (!access) return;
        references.push({
          evidenceReferenceId: `evidence:access:${access.id}`,
          incidentId: incident.id,
          kind: 'access-audit',
          title: `Access event — ${access.decision}`,
          capturedAt: access.occurredAt,
          evidence: [access.eventId, access.auditId],
          playbackUnavailable: true,
        });
      });

      surveillanceWorkspace.openAlerts
        .filter((alert) => {
          const ref = surveillanceWorkspace.incidentReferences.find(
            (item) => item.incidentId === incident.id && (item.deviceId === alert.deviceId || item.cameraId === alert.deviceId),
          );
          return ref !== undefined;
        })
        .forEach((alert) => {
          references.push({
            evidenceReferenceId: `evidence:alert:${alert.id}`,
            incidentId: incident.id,
            kind: 'device-alert',
            title: alert.title,
            deviceId: alert.deviceId,
            capturedAt: alert.triggeredAt,
            evidence: alert.evidence,
            playbackUnavailable: true,
          });
        });
    });

    return references;
  }
}
