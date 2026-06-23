import type {
  IncidentDto,
  IncidentDeviceTimelineEventDto,
  IncidentLinkedSurveillanceAlertDto,
  IncidentLinkedTelemetryAnomalyDto,
  IncidentRelatedCameraDto,
  IncidentRelatedIoTDeviceDto,
  IncidentSurveillanceContextWorkspaceDto,
  IncidentSurveillanceEvidenceReferenceDto,
  SurveillanceAlertEventDto,
  SurveillanceIoTWorkspaceDto,
} from '@trackmind/shared';
import { incidentSurveillanceContextSchemaVersion } from '@trackmind/shared';
import type { SecurityActor, SecurityOperationsService } from './securityOps.js';
import type { SecuritySurveillanceIntegrationService } from './securitySurveillanceIntegrationService.js';
import type { SurveillanceIoTModule } from './surveillanceIoT/surveillanceIoTModule.js';

const ZONE_KEYWORDS: Array<{ keywords: string[]; zoneId: string }> = [
  { keywords: ['paddock', 'gate b'], zoneId: 'zone-paddock' },
  { keywords: ['medication', 'backstretch'], zoneId: 'zone-backstretch-medication' },
  { keywords: ['grandstand', 'clubhouse'], zoneId: 'zone-grandstand' },
  { keywords: ['barn', 'stable'], zoneId: 'zone-barn' },
];

function inferZoneIds(incident: IncidentDto): string[] {
  const haystack = [incident.title, incident.description, incident.location, incident.summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const zones = ZONE_KEYWORDS.filter((entry) => entry.keywords.some((keyword) => haystack.includes(keyword))).map(
    (entry) => entry.zoneId,
  );
  return [...new Set(zones)];
}

function titlesAlign(a: string, b: string): boolean {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const leftPrefix = left.slice(0, Math.min(12, left.length));
  return right.includes(leftPrefix) || left.includes(right.slice(0, Math.min(12, right.length)));
}

function severityFromQuality(quality: string): IncidentLinkedTelemetryAnomalyDto['severity'] {
  if (quality === 'missing') return 'high';
  if (quality === 'bad') return 'medium';
  return 'low';
}

function mapAlertEvent(
  event: SurveillanceAlertEventDto,
  linkageReason: string,
): IncidentLinkedSurveillanceAlertDto {
  return {
    eventId: event.eventId,
    ruleKind: event.ruleKind,
    title: event.title,
    severity: event.severity,
    resolutionStatus: event.resolutionStatus,
    sourceDeviceId: event.sourceDevice?.deviceId,
    sourceDeviceLabel: event.sourceDevice?.displayName,
    sourceZoneLabel: event.sourceZone?.zoneLabel,
    triggeredAt: event.triggeredAt,
    placeholderDerived: event.placeholderDerived,
    linkageReason,
  };
}

export class IncidentSurveillanceContextService {
  buildContext(
    actor: SecurityActor,
    incident: IncidentDto,
    surveillanceModule: SurveillanceIoTModule,
    securityOps: SecurityOperationsService,
    securityIntegration: SecuritySurveillanceIntegrationService,
    now: string,
  ): IncidentSurveillanceContextWorkspaceDto {
    const surveillanceWorkspace = surveillanceModule.buildWorkspace(actor);
    const alertingWorkspace = surveillanceModule.getAlertingWorkspace(actor);
    const securityWorkspace = securityOps.getWorkspace(actor);
    const integration = securityIntegration.buildIntegrationWorkspace(
      actor,
      securityOps,
      surveillanceModule,
      now,
    );

    const inferredZoneIds = inferZoneIds(incident);
    const securityIncident = securityWorkspace.incidents.find((item) => item.id === incident.id);
    const trustSecurityIncidentById =
      securityIncident !== undefined && titlesAlign(securityIncident.title, incident.title);

    const zoneIds = [
      ...new Set([
        ...inferredZoneIds,
        ...(trustSecurityIncidentById && securityIncident ? [securityIncident.zoneId] : []),
      ]),
    ];

    const incidentReferences = surveillanceWorkspace.incidentReferences.filter((ref) => {
      if (ref.incidentId !== incident.id) {
        return zoneIds.length > 0 && ref.zoneId !== undefined && zoneIds.includes(ref.zoneId);
      }
      if (zoneIds.length === 0) return true;
      return ref.zoneId === undefined || zoneIds.includes(ref.zoneId);
    });

    const relatedDeviceIds = new Set<string>([
      ...incidentReferences.flatMap((ref) => [ref.cameraId, ref.deviceId].filter(Boolean) as string[]),
    ]);

    zoneIds.forEach((zoneId) => {
      securityWorkspace.cameras
        .filter((camera) => camera.zoneId === zoneId)
        .forEach((camera) => relatedDeviceIds.add(camera.id));
      securityWorkspace.restrictedZones
        .filter((zone) => zone.id === zoneId)
        .flatMap((zone) => zone.cameraIds)
        .forEach((cameraId) => relatedDeviceIds.add(cameraId));
      surveillanceWorkspace.cameras
        .filter((camera) => camera.securityZoneId === zoneId)
        .forEach((camera) => relatedDeviceIds.add(camera.id));
      surveillanceWorkspace.iotDevices
        .filter((device) => device.securityZoneId === zoneId)
        .forEach((device) => relatedDeviceIds.add(device.id));
    });

    const relatedCameras: IncidentRelatedCameraDto[] = [];
    const seenCameras = new Set<string>();

    const addCamera = (cameraId: string, linkageReason: string, zoneLabel?: string) => {
      if (seenCameras.has(cameraId)) return;
      const securityCamera = securityWorkspace.cameras.find((camera) => camera.id === cameraId);
      const surveillanceCamera = surveillanceWorkspace.cameras.find((camera) => camera.id === cameraId);
      const label = securityCamera?.label ?? surveillanceCamera?.displayName ?? cameraId;
      const health = securityCamera?.health ?? surveillanceCamera?.health ?? surveillanceCamera?.status ?? 'unknown';
      relatedCameras.push({
        cameraId,
        label,
        health,
        zoneLabel: zoneLabel ?? surveillanceCamera?.tags?.find((tag) => tag.startsWith('zone:')),
        securityZoneId: securityCamera?.zoneId ?? surveillanceCamera?.securityZoneId,
        coverageTags: securityCamera?.coverage ?? surveillanceCamera?.tags ?? [],
        linkageReason,
        lastSeenAt: securityCamera?.lastHeartbeatAt ?? surveillanceCamera?.lastSeenAt,
        privacyMasking: securityCamera?.privacyMasking ?? surveillanceCamera?.privacyMaskingEnabled,
        playbackUnavailable: true,
      });
      seenCameras.add(cameraId);
    };

    incidentReferences.forEach((ref) => {
      if (ref.cameraId) addCamera(ref.cameraId, ref.linkageReason, ref.zoneId);
    });
    zoneIds.forEach((zoneId) => {
      const zone = securityWorkspace.restrictedZones.find((item) => item.id === zoneId);
      securityWorkspace.cameras
        .filter((camera) => camera.zoneId === zoneId)
        .forEach((camera) =>
          addCamera(camera.id, 'Zone-scoped camera correlation from incident location context.', zone?.name),
        );
    });

    const relatedIoTDevices: IncidentRelatedIoTDeviceDto[] = [];
    const seenDevices = new Set<string>();

    const addDevice = (deviceId: string, linkageReason: string, sensorType?: string) => {
      if (seenDevices.has(deviceId) || seenCameras.has(deviceId)) return;
      const surveillanceDevice = surveillanceWorkspace.iotDevices.find((device) => device.id === deviceId);
      const readinessSensor = integration.restrictedZoneCameraCoverage
        .flatMap((zone) => zone.cameras)
        .find((camera) => camera.cameraId === deviceId);
      if (!surveillanceDevice && !readinessSensor) {
        const securitySensor = securityOps.getSensorReadiness(actor).items.find((item) => item.id === deviceId);
        if (!securitySensor) return;
        relatedIoTDevices.push({
          deviceId,
          label: securitySensor.label,
          deviceKind: 'iot-device',
          sensorType,
          health: securitySensor.health,
          zoneLabel: securityWorkspace.restrictedZones.find((zone) => zone.id === securitySensor.zoneId)?.name,
          securityZoneId: securitySensor.zoneId,
          linkageReason,
          lastSeenAt: securitySensor.lastHeartbeatAt,
        });
        seenDevices.add(deviceId);
        return;
      }
      relatedIoTDevices.push({
        deviceId,
        label: surveillanceDevice?.displayName ?? deviceId,
        deviceKind: surveillanceDevice?.kind ?? 'iot-device',
        sensorType: surveillanceDevice?.sensorType ?? sensorType,
        health: surveillanceDevice?.health ?? surveillanceDevice?.status ?? 'unknown',
        zoneLabel: surveillanceDevice?.tags?.find((tag) => tag.startsWith('zone:')),
        securityZoneId: surveillanceDevice?.securityZoneId,
        linkageReason,
        lastSeenAt: surveillanceDevice?.lastSeenAt,
      });
      seenDevices.add(deviceId);
    };

    incidentReferences.forEach((ref) => {
      if (ref.deviceId) addDevice(ref.deviceId, ref.linkageReason);
    });
    relatedDeviceIds.forEach((deviceId) => {
      if (!seenCameras.has(deviceId)) {
        addDevice(deviceId, 'Operational device correlation from incident zone and registry cross-reference.');
      }
    });

    const linkedSurveillanceAlerts = alertingWorkspace.framework.alertEvents
      .filter((event) => {
        const linkedId = event.linkedIncident?.incidentId;
        if (linkedId === incident.id && (zoneIds.length === 0 || trustSecurityIncidentById)) return true;
        const deviceId = event.sourceDevice?.deviceId;
        if (deviceId && relatedDeviceIds.has(deviceId)) return true;
        return false;
      })
      .map((event) =>
        mapAlertEvent(
          event,
          event.linkedIncident?.incidentId === incident.id
            ? 'Alert pipeline linked this event to the incident reference.'
            : 'Alert source device matches incident-correlated camera or IoT registry entry.',
        ),
      );

    integration.surveillanceAlerts
      .filter((alert) => alert.linkedIncidentId === incident.id && trustSecurityIncidentById)
      .forEach((alert) => {
        if (linkedSurveillanceAlerts.some((item) => item.eventId === alert.eventId)) return;
        linkedSurveillanceAlerts.push({
          eventId: alert.eventId,
          ruleKind: alert.ruleKind,
          title: alert.title,
          severity: alert.severity,
          resolutionStatus: alert.resolutionStatus,
          sourceDeviceId: alert.sourceDeviceId,
          sourceDeviceLabel: alert.sourceDeviceLabel,
          sourceZoneLabel: alert.sourceZoneLabel,
          triggeredAt: alert.triggeredAt,
          placeholderDerived: alert.placeholderDerived,
          linkageReason: 'Security operations surveillance integration cross-reference.',
        });
      });

    const linkedTelemetryAnomalies = this.buildTelemetryAnomalies(
      surveillanceWorkspace,
      relatedDeviceIds,
      incident.createdAt,
    );

    const evidenceReferences = this.buildEvidenceReferences(
      incident,
      surveillanceWorkspace,
      integration,
      relatedDeviceIds,
      trustSecurityIncidentById,
    );

    const deviceTimelineEvents = this.buildDeviceTimelineEvents(
      incident,
      surveillanceWorkspace,
      linkedSurveillanceAlerts,
      linkedTelemetryAnomalies,
      integration,
      relatedDeviceIds,
      zoneIds,
      trustSecurityIncidentById,
    );

    const correlationSummary =
      zoneIds.length > 0
        ? `Correlated ${relatedCameras.length} camera(s) and ${relatedIoTDevices.length} IoT device(s) using incident location context (${zoneIds.join(', ')}). Playback is metadata-only in Incident Command.`
        : relatedCameras.length + relatedIoTDevices.length > 0
          ? 'Correlated devices from surveillance incident references and registry linkage. Playback is metadata-only in Incident Command.'
          : 'No zone-scoped device correlation inferred — expand incident location metadata or link surveillance references to enrich this view.';

    return {
      generatedAt: now,
      schemaVersion: incidentSurveillanceContextSchemaVersion,
      organizationId: surveillanceWorkspace.organizationId,
      tenantId: surveillanceWorkspace.tenantId,
      racetrackId: surveillanceWorkspace.racetrackId,
      incidentId: incident.id,
      correlationSummary,
      summary: {
        relatedCameras: relatedCameras.length,
        relatedIoTDevices: relatedIoTDevices.length,
        linkedSurveillanceAlerts: linkedSurveillanceAlerts.length,
        linkedTelemetryAnomalies: linkedTelemetryAnomalies.length,
        evidenceReferences: evidenceReferences.length,
        deviceTimelineEvents: deviceTimelineEvents.length,
      },
      relatedCameras,
      relatedIoTDevices,
      linkedSurveillanceAlerts,
      linkedTelemetryAnomalies,
      evidenceReferences,
      deviceTimelineEvents,
      mock: false,
    };
  }

  private buildTelemetryAnomalies(
    workspace: SurveillanceIoTWorkspaceDto,
    relatedDeviceIds: Set<string>,
    incidentCreatedAt: string,
  ): IncidentLinkedTelemetryAnomalyDto[] {
    const anomalies: IncidentLinkedTelemetryAnomalyDto[] = [];

    workspace.recentReadings
      .filter(
        (reading) =>
          relatedDeviceIds.has(reading.deviceId) &&
          (reading.quality === 'bad' || reading.quality === 'missing' || reading.quality === 'estimated'),
      )
      .forEach((reading) => {
        const device = workspace.iotDevices.find((item) => item.id === reading.deviceId);
        anomalies.push({
          anomalyId: reading.id,
          deviceId: reading.deviceId,
          deviceLabel: device?.displayName ?? reading.deviceId,
          metric: reading.metric,
          value: reading.value,
          unit: reading.unit,
          quality: reading.quality,
          detail: `${reading.metric} reading flagged as ${reading.quality} during incident window.`,
          observedAt: reading.observedAt,
          severity: severityFromQuality(reading.quality),
        });
      });

    workspace.telemetrySnapshots
      .filter((snapshot) => relatedDeviceIds.has(snapshot.deviceId))
      .slice(0, 4)
      .forEach((snapshot) => {
        const device = workspace.iotDevices.find((item) => item.id === snapshot.deviceId);
        const health = workspace.healthStatuses.find((item) => item.deviceId === snapshot.deviceId);
        const stale = snapshot.capturedAt < incidentCreatedAt;
        const primaryMetric = snapshot.metrics[0];
        if (!stale && health?.integrationStatus === 'ready' && device?.integrationStatus === 'ready') return;
        anomalies.push({
          anomalyId: snapshot.id,
          deviceId: snapshot.deviceId,
          deviceLabel: device?.displayName ?? snapshot.deviceId,
          metric: primaryMetric?.name ?? 'telemetry-snapshot',
          value: primaryMetric?.value ?? snapshot.metrics.length,
          unit: primaryMetric?.unit,
          quality: stale ? 'estimated' : 'bad',
          detail: stale
            ? 'Telemetry snapshot predates incident reporting — review historical ingest for traceability.'
            : `Telemetry integration status ${health?.integrationStatus ?? device?.integrationStatus ?? 'unknown'} during incident window.`,
          observedAt: snapshot.capturedAt,
          severity: stale ? 'low' : 'medium',
        });
      });

    return anomalies.slice(0, 12);
  }

  private buildEvidenceReferences(
    incident: IncidentDto,
    workspace: SurveillanceIoTWorkspaceDto,
    integration: ReturnType<SecuritySurveillanceIntegrationService['buildIntegrationWorkspace']>,
    relatedDeviceIds: Set<string>,
    trustSecurityIncidentById: boolean,
  ): IncidentSurveillanceEvidenceReferenceDto[] {
    const references: IncidentSurveillanceEvidenceReferenceDto[] = [];

    workspace.videoEvidence
      .filter(
        (evidence) =>
          evidence.incidentId === incident.id ||
          relatedDeviceIds.has(evidence.cameraId) ||
          (incident.evidenceRefs ?? []).includes(evidence.id),
      )
      .forEach((evidence) => {
        references.push({
          evidenceReferenceId: evidence.id,
          kind: 'video-evidence',
          title: evidence.displayName,
          cameraId: evidence.cameraId,
          capturedAt: evidence.clipStartAt,
          storageUri: evidence.storageUri,
          evidence: [`video:${evidence.cameraId}`, ...(evidence.checksum ? [evidence.checksum] : [])],
          privacyMasked: evidence.privacyMasked,
          playbackUnavailable: true,
          linkageReason:
            evidence.incidentId === incident.id
              ? 'Video evidence reference linked to incident ID in surveillance projection.'
              : 'Camera matches incident-correlated device registry entry.',
        });
      });

    integration.incidentEvidenceReferences
      .filter((evidence) => evidence.incidentId === incident.id && trustSecurityIncidentById)
      .forEach((evidence) => {
        if (references.some((item) => item.evidenceReferenceId === evidence.evidenceReferenceId)) return;
        references.push({
          evidenceReferenceId: evidence.evidenceReferenceId,
          kind: evidence.kind,
          title: evidence.title,
          deviceId: evidence.deviceId,
          cameraId: evidence.cameraId,
          capturedAt: evidence.capturedAt,
          storageUri: evidence.storageUri,
          evidence: evidence.evidence,
          privacyMasked: evidence.privacyMasked,
          playbackUnavailable: true,
          linkageReason: 'Security operations evidence reference cross-walk.',
        });
      });

    workspace.openAlerts
      .filter((alert) => relatedDeviceIds.has(alert.deviceId))
      .slice(0, 4)
      .forEach((alert) => {
        references.push({
          evidenceReferenceId: `evidence:device-alert:${alert.id}`,
          kind: 'device-alert',
          title: alert.title,
          deviceId: alert.deviceId,
          capturedAt: alert.triggeredAt,
          evidence: alert.evidence,
          playbackUnavailable: true,
          linkageReason: 'Open device alert on incident-correlated hardware.',
        });
      });

    (incident.evidenceRefs ?? []).forEach((refId) => {
      if (references.some((item) => item.evidenceReferenceId === refId)) return;
      references.push({
        evidenceReferenceId: refId,
        kind: 'sensor-telemetry',
        title: `Incident evidence ref — ${refId}`,
        evidence: [refId],
        playbackUnavailable: true,
        linkageReason: 'Declared on incident record during intake or triage.',
      });
    });

    return references;
  }

  private buildDeviceTimelineEvents(
    incident: IncidentDto,
    workspace: SurveillanceIoTWorkspaceDto,
    alerts: IncidentLinkedSurveillanceAlertDto[],
    anomalies: IncidentLinkedTelemetryAnomalyDto[],
    integration: ReturnType<SecuritySurveillanceIntegrationService['buildIntegrationWorkspace']>,
    relatedDeviceIds: Set<string>,
    zoneIds: string[],
    trustSecurityIncidentById: boolean,
  ): IncidentDeviceTimelineEventDto[] {
    const events: IncidentDeviceTimelineEventDto[] = [];

    alerts.forEach((alert) => {
      events.push({
        eventId: `timeline:alert:${alert.eventId}`,
        occurredAt: alert.triggeredAt,
        sourceDeviceId: alert.sourceDeviceId ?? alert.eventId,
        sourceDeviceLabel: alert.sourceDeviceLabel ?? alert.title,
        sourceKind: 'alert-pipeline',
        eventKind: alert.ruleKind,
        summary: alert.title,
        severity: alert.severity,
        traceRefs: [alert.eventId],
      });
    });

    anomalies.forEach((anomaly) => {
      events.push({
        eventId: `timeline:telemetry:${anomaly.anomalyId}`,
        occurredAt: anomaly.observedAt,
        sourceDeviceId: anomaly.deviceId,
        sourceDeviceLabel: anomaly.deviceLabel,
        sourceKind: 'sensor-reading',
        eventKind: 'telemetry-anomaly',
        summary: anomaly.detail,
        severity: anomaly.severity,
        traceRefs: [anomaly.anomalyId, `metric:${anomaly.metric}`],
      });
    });

    integration.accessRelatedSensorEvents
      .filter(
        (event) =>
          (event.linkedIncidentId === incident.id && trustSecurityIncidentById) ||
          (event.sensorId && relatedDeviceIds.has(event.sensorId)) ||
          zoneIds.includes(event.zoneId),
      )
      .forEach((event) => {
        events.push({
          eventId: `timeline:access-sensor:${event.eventId}`,
          occurredAt: event.occurredAt,
          sourceDeviceId: event.sensorId ?? event.zoneId,
          sourceDeviceLabel: event.sensorLabel ?? event.zoneName,
          sourceKind: 'iot-device',
          eventKind: event.eventKind,
          summary: event.detail,
          severity: event.severity,
          traceRefs: [event.eventId, ...(event.linkedAccessEventId ? [event.linkedAccessEventId] : [])],
        });
      });

    workspace.openAlerts
      .filter((alert) => relatedDeviceIds.has(alert.deviceId))
      .forEach((alert) => {
        if (events.some((item) => item.traceRefs.includes(alert.id))) return;
        events.push({
          eventId: `timeline:open-alert:${alert.id}`,
          occurredAt: alert.triggeredAt,
          sourceDeviceId: alert.deviceId,
          sourceDeviceLabel: workspace.iotDevices.find((device) => device.id === alert.deviceId)?.displayName ?? alert.deviceId,
          sourceKind: 'alert-pipeline',
          eventKind: alert.alertCode,
          summary: alert.detail,
          severity: alert.severity,
          traceRefs: [alert.id, ...alert.evidence],
        });
      });

    return events
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 24);
  }
}
