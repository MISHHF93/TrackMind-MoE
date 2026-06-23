import type {
  CameraDeviceDto,
  DeviceAlertDto,
  DeviceGatewayDto,
  DeviceRuleDto,
  IoTDeviceDto,
  SurveillanceAlertEscalationTargetDto,
  SurveillanceAlertEventDto,
  SurveillanceAlertLinkedAuditEventDto,
  SurveillanceAlertLinkedIncidentDto,
  SurveillanceAlertResolutionStatus,
  SurveillanceAlertRuleDto,
  SurveillanceAlertRuleKind,
  SurveillanceAlertRuleReadiness,
  SurveillanceAlertSeverity,
  SurveillanceAlertSourceDeviceDto,
  SurveillanceAlertSourceZoneDto,
  SurveillanceIoTAlertingFrameworkWorkspaceDto,
  SurveillanceIoTWorkspaceDto,
  VideoStreamDto,
} from '@trackmind/shared';
import {
  surveillanceAlertRuleKindLabels,
  surveillanceIoTAlertingSchemaVersion,
  surveillanceIoTArchitectureSchemaVersion,
} from '@trackmind/shared';
import type { AuditGovernanceService } from '../governance/auditGovernanceService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';

const PLACEHOLDER_NOTICE =
  'Contract placeholder — rule evaluation and event ingest are not yet connected. No automated detection is implied.';

const DEFAULT_ESCALATION: SurveillanceAlertEscalationTargetDto[] = [
  { targetId: 'esc:security-ops', targetType: 'role', label: 'Security Operations', role: 'security-manager' },
  { targetId: 'esc:facilities-ops', targetType: 'team', label: 'Facilities Operations', role: 'facilities-manager' },
  { targetId: 'esc:alert-workflow', targetType: 'workflow', label: 'Alert triage workflow' },
];

type RuleTemplate = {
  ruleKind: SurveillanceAlertRuleKind;
  readiness: SurveillanceAlertRuleReadiness;
  defaultSeverity: SurveillanceAlertSeverity;
  description: string;
  conditionExpression: string;
  placeholderNotice?: string;
  approvalRequired?: boolean;
};

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    ruleKind: 'camera-offline',
    readiness: 'live',
    defaultSeverity: 'high',
    description: 'Raise when a registered camera device stops reporting heartbeat or integration status is offline.',
    conditionExpression: 'camera.status == offline OR lastHeartbeatAge > threshold',
  },
  {
    ruleKind: 'stream-degraded',
    readiness: 'live',
    defaultSeverity: 'medium',
    description: 'Raise when a video stream endpoint is buffering, stale, or unavailable while the camera device may still be online.',
    conditionExpression: 'stream.streamStatus IN (buffering, offline) OR stream.latencyMs > threshold',
  },
  {
    ruleKind: 'gateway-disconnected',
    readiness: 'live',
    defaultSeverity: 'high',
    description: 'Raise when an IoT or video gateway loses connectivity or stops forwarding telemetry.',
    conditionExpression: 'gateway.status == offline OR gateway.lastSeenAge > threshold',
  },
  {
    ruleKind: 'sensor-threshold-breach',
    readiness: 'live',
    defaultSeverity: 'medium',
    description: 'Raise when a sensor reading crosses a configured threshold rule bound to the source device.',
    conditionExpression: 'reading.value violates rule.conditionExpression',
    approvalRequired: true,
  },
  {
    ruleKind: 'motion-activity',
    readiness: 'placeholder',
    defaultSeverity: 'low',
    description: 'Reserved contract for motion or activity signal correlation once analytics ingest is approved.',
    conditionExpression: 'placeholder:motion-activity-signal',
    placeholderNotice: PLACEHOLDER_NOTICE,
  },
  {
    ruleKind: 'restricted-zone-event',
    readiness: 'placeholder',
    defaultSeverity: 'high',
    description: 'Reserved contract for restricted-zone access or presence correlation once zone policy ingest is approved.',
    conditionExpression: 'placeholder:restricted-zone-presence',
    placeholderNotice: PLACEHOLDER_NOTICE,
  },
  {
    ruleKind: 'crowding-queue',
    readiness: 'placeholder',
    defaultSeverity: 'medium',
    description: 'Reserved contract for crowding or queue density correlation once occupancy ingest is approved.',
    conditionExpression: 'placeholder:crowding-queue-density',
    placeholderNotice: PLACEHOLDER_NOTICE,
  },
  {
    ruleKind: 'environmental-anomaly',
    readiness: 'degraded-readiness',
    defaultSeverity: 'medium',
    description: 'Raise when environmental sensor telemetry deviates from nominal bands or integration quality degrades.',
    conditionExpression: 'sensor.health != healthy OR reading.quality == bad',
  },
  {
    ruleKind: 'track-surface-condition',
    readiness: 'placeholder',
    defaultSeverity: 'medium',
    description: 'Reserved contract for track surface condition correlation once surface telemetry ingest is approved.',
    conditionExpression: 'placeholder:track-surface-condition',
    placeholderNotice: PLACEHOLDER_NOTICE,
  },
  {
    ruleKind: 'stable-facility-condition',
    readiness: 'degraded-readiness',
    defaultSeverity: 'medium',
    description: 'Raise when barn, stable, or facility condition sensors report degraded health or out-of-band readings.',
    conditionExpression: 'facilitySensor.health != healthy OR reading violates facilityBand',
  },
];

function mapAlertStatus(status: DeviceAlertDto['alertStatus']): SurveillanceAlertResolutionStatus {
  if (status === 'acknowledged') return 'acknowledged';
  if (status === 'resolved') return 'resolved';
  if (status === 'suppressed') return 'suppressed';
  return 'open';
}

function resolveZone(
  workspace: SurveillanceIoTWorkspaceDto,
  zoneId?: string,
): SurveillanceAlertSourceZoneDto | undefined {
  if (!zoneId) return undefined;
  const deviceZone = workspace.deviceZones.find((zone) => zone.id === zoneId);
  const facilityZone = workspace.facilityZones.find((zone) => zone.id === zoneId);
  const label = deviceZone?.displayName ?? facilityZone?.zoneLabel ?? zoneId;
  return {
    zoneId,
    zoneLabel: label,
    zoneKind: deviceZone?.zoneType ?? facilityZone?.zoneCode,
    sensitivity: deviceZone?.zoneType === 'restricted-overlay' ? 'restricted' : undefined,
  };
}

function cameraSource(camera: CameraDeviceDto): SurveillanceAlertSourceDeviceDto {
  return {
    deviceId: camera.id,
    deviceKind: 'camera-device',
    displayName: camera.displayName,
  };
}

function iotSource(device: IoTDeviceDto): SurveillanceAlertSourceDeviceDto {
  return {
    deviceId: device.id,
    deviceKind: 'iot-device',
    displayName: device.displayName,
  };
}

function gatewaySource(gateway: DeviceGatewayDto): SurveillanceAlertSourceDeviceDto {
  return {
    deviceId: gateway.id,
    deviceKind: 'device-gateway',
    displayName: gateway.displayName,
  };
}

function streamSource(stream: VideoStreamDto): SurveillanceAlertSourceDeviceDto {
  return {
    deviceId: stream.id,
    deviceKind: 'video-stream',
    displayName: stream.displayName,
  };
}

function linkedIncidentForAlert(
  workspace: SurveillanceIoTWorkspaceDto,
  alert: DeviceAlertDto,
): SurveillanceAlertLinkedIncidentDto | undefined {
  const ref = workspace.incidentReferences.find(
    (incident) => incident.deviceId === alert.deviceId || incident.cameraId === alert.deviceId,
  );
  if (!ref) return alert.incidentReferenceId
    ? { incidentId: alert.incidentReferenceId, title: 'Linked incident reference' }
    : undefined;
  return {
    incidentReferenceId: ref.id,
    incidentId: ref.incidentId,
    title: ref.displayName,
    linkedAt: ref.linkedAt,
  };
}

function auditEventsForSubject(
  governance: AuditGovernanceService,
  subjectId: string,
): SurveillanceAlertLinkedAuditEventDto[] {
  return governance.auditForSubject(subjectId).slice(0, 3).map((record) => ({
    auditId: record.auditId,
    action: record.action,
    occurredAt: record.timestamp,
    actorId: record.actorId,
    layer: record.layer,
  }));
}

function inferRuleKindFromAlert(
  alert: DeviceAlertDto,
  workspace: SurveillanceIoTWorkspaceDto,
): SurveillanceAlertRuleKind {
  const camera = workspace.cameras.find((item) => item.id === alert.deviceId);
  if (camera) {
    return camera.status === 'offline' ? 'camera-offline' : 'stream-degraded';
  }
  const sensor = workspace.iotDevices.find((item) => item.id === alert.deviceId);
  if (sensor) {
    if (sensor.domainScope === 'facilities-iot' || sensor.sensorType.includes('stable')) {
      return 'stable-facility-condition';
    }
    if (sensor.sensorType.includes('surface')) {
      return 'environmental-anomaly';
    }
    return workspace.rules.some((rule) => rule.targetDeviceIds.includes(sensor.id))
      ? 'sensor-threshold-breach'
      : 'environmental-anomaly';
  }
  return 'environmental-anomaly';
}

function ruleIdForKind(ruleKind: SurveillanceAlertRuleKind): string {
  return `rule:surveillance:${ruleKind}`;
}

function buildRuleCatalog(workspace: SurveillanceIoTWorkspaceDto): SurveillanceAlertRuleDto[] {
  return RULE_TEMPLATES.map((template) => {
    const sourceDeviceIds: string[] = [];
    const sourceZoneIds: string[] = [];

    if (template.ruleKind === 'camera-offline') {
      workspace.cameras.forEach((camera) => {
        sourceDeviceIds.push(camera.id);
        if (camera.securityZoneId) sourceZoneIds.push(camera.securityZoneId);
      });
    } else if (template.ruleKind === 'stream-degraded') {
      workspace.videoStreams.forEach((stream) => sourceDeviceIds.push(stream.id));
    } else if (template.ruleKind === 'gateway-disconnected') {
      workspace.gateways.forEach((gateway) => sourceDeviceIds.push(gateway.id));
    } else if (template.ruleKind === 'sensor-threshold-breach') {
      workspace.rules
        .filter((rule) => rule.trigger === 'threshold')
        .forEach((rule) => {
          sourceDeviceIds.push(...rule.targetDeviceIds);
          sourceZoneIds.push(...rule.targetZoneIds);
        });
    } else if (template.ruleKind === 'environmental-anomaly' || template.ruleKind === 'stable-facility-condition') {
      workspace.iotDevices.forEach((device) => {
        sourceDeviceIds.push(device.id);
        if (device.securityZoneId) sourceZoneIds.push(device.securityZoneId);
      });
    } else if (template.ruleKind === 'restricted-zone-event') {
      workspace.deviceZones
        .filter((zone) => zone.zoneType === 'restricted-overlay')
        .forEach((zone) => sourceZoneIds.push(zone.id));
    } else if (template.ruleKind === 'motion-activity') {
      workspace.cameras.slice(0, 3).forEach((camera) => sourceDeviceIds.push(camera.id));
    } else if (template.ruleKind === 'crowding-queue') {
      workspace.facilityZones.forEach((zone) => sourceZoneIds.push(zone.id));
    } else if (template.ruleKind === 'track-surface-condition') {
      workspace.facilityZones
        .filter((zone) => zone.zoneLabel.toLowerCase().includes('track') || zone.zoneCode.includes('track'))
        .forEach((zone) => sourceZoneIds.push(zone.id));
    }

    const enabled = template.readiness === 'live' || template.readiness === 'degraded-readiness';
    const linkedRule = workspace.rules.find((rule) =>
      rule.targetDeviceIds.some((deviceId) => sourceDeviceIds.includes(deviceId)),
    );
    return {
      ruleId: ruleIdForKind(template.ruleKind),
      ruleKind: template.ruleKind,
      ruleName: surveillanceAlertRuleKindLabels[template.ruleKind],
      description: template.description,
      enabled,
      readiness: template.readiness,
      defaultSeverity: template.defaultSeverity,
      placeholderNotice: template.placeholderNotice,
      sourceDeviceIds: [...new Set(sourceDeviceIds)],
      sourceZoneIds: [...new Set(sourceZoneIds)],
      conditionExpression: template.ruleKind === 'sensor-threshold-breach' && linkedRule
        ? linkedRule.conditionExpression
        : template.conditionExpression,
      escalationTargets: DEFAULT_ESCALATION,
      approvalRequired: template.approvalRequired ?? false,
      lastEvaluatedAt: enabled ? workspace.generatedAt : undefined,
      metadataPlaceholder: template.readiness === 'placeholder',
    };
  });
}

function alertEventFromDeviceAlert(
  alert: DeviceAlertDto,
  workspace: SurveillanceIoTWorkspaceDto,
  governance: AuditGovernanceService,
): SurveillanceAlertEventDto {
  const ruleKind = inferRuleKindFromAlert(alert, workspace);
  const camera = workspace.cameras.find((item) => item.id === alert.deviceId);
  const sensor = workspace.iotDevices.find((item) => item.id === alert.deviceId);
  const sourceDevice = camera ? cameraSource(camera) : sensor ? iotSource(sensor) : undefined;
  const zoneId = camera?.securityZoneId ?? sensor?.securityZoneId;

  return {
    eventId: alert.id,
    ruleId: ruleIdForKind(ruleKind),
    ruleKind,
    title: alert.title,
    detail: alert.detail,
    severity: alert.severity,
    resolutionStatus: mapAlertStatus(alert.alertStatus),
    triggeredAt: alert.triggeredAt,
    acknowledgedAt: alert.acknowledgedAt,
    resolvedAt: alert.resolvedAt,
    sourceDevice,
    sourceZone: resolveZone(workspace, zoneId),
    escalationTargets: DEFAULT_ESCALATION,
    linkedIncident: linkedIncidentForAlert(workspace, alert),
    linkedAuditEvents: auditEventsForSubject(governance, alert.deviceId),
    evidence: alert.evidence,
  };
}

function buildLiveDerivedEvents(
  workspace: SurveillanceIoTWorkspaceDto,
  governance: AuditGovernanceService,
): SurveillanceAlertEventDto[] {
  const events: SurveillanceAlertEventDto[] = workspace.openAlerts.map((alert) =>
    alertEventFromDeviceAlert(alert, workspace, governance),
  );

  workspace.gateways
    .filter((gateway) => gateway.status === 'offline' || gateway.status === 'degraded')
    .forEach((gateway) => {
      events.push({
        eventId: `event:gateway:${gateway.id}`,
        ruleId: ruleIdForKind('gateway-disconnected'),
        ruleKind: 'gateway-disconnected',
        title: `${gateway.displayName} gateway connectivity issue`,
        detail: 'Gateway heartbeat stale or integration forwarding unavailable.',
        severity: gateway.status === 'offline' ? 'high' : 'medium',
        resolutionStatus: 'open',
        triggeredAt: gateway.lastSeenAt,
        sourceDevice: gatewaySource(gateway),
        escalationTargets: DEFAULT_ESCALATION,
        linkedAuditEvents: auditEventsForSubject(governance, gateway.id),
        evidence: [`gateway:${gateway.id}`],
      });
    });

  workspace.videoStreams
    .filter((stream) => stream.streamStatus === 'buffering' || stream.streamStatus === 'offline')
    .forEach((stream) => {
      const camera = workspace.cameras.find((item) => stream.cameraId === item.id);
      events.push({
        eventId: `event:stream:${stream.id}`,
        ruleId: ruleIdForKind('stream-degraded'),
        ruleKind: 'stream-degraded',
        title: `${stream.displayName} stream degraded`,
        detail: 'Video stream endpoint reporting buffering or offline state.',
        severity: stream.streamStatus === 'offline' ? 'high' : 'medium',
        resolutionStatus: 'open',
        triggeredAt: workspace.generatedAt,
        sourceDevice: streamSource(stream),
        sourceZone: resolveZone(workspace, camera?.securityZoneId),
        escalationTargets: DEFAULT_ESCALATION,
        linkedAuditEvents: auditEventsForSubject(governance, stream.cameraId ?? stream.id),
        evidence: [`stream:${stream.id}`],
      });
    });

  workspace.rules
    .filter((rule: DeviceRuleDto) => rule.enabled && rule.trigger === 'threshold')
    .slice(0, 2)
    .forEach((rule, index) => {
      const device = workspace.iotDevices.find((item) => rule.targetDeviceIds.includes(item.id));
      if (!device || device.status === 'online') return;
      events.push({
        eventId: `event:threshold:${rule.id}:${index}`,
        ruleId: ruleIdForKind('sensor-threshold-breach'),
        ruleKind: 'sensor-threshold-breach',
        title: `${rule.ruleName} threshold evaluation pending`,
        detail: 'Threshold rule bound to device with degraded telemetry quality — review before escalation.',
        severity: 'medium',
        resolutionStatus: 'open',
        triggeredAt: rule.lastEvaluatedAt ?? workspace.generatedAt,
        sourceDevice: iotSource(device),
        sourceZone: resolveZone(workspace, device.securityZoneId),
        escalationTargets: DEFAULT_ESCALATION,
        linkedAuditEvents: auditEventsForSubject(governance, device.id),
        evidence: [`rule:${rule.id}`, `device:${device.id}`],
      });
    });

  return events;
}

function buildPlaceholderContractEvents(now: string): SurveillanceAlertEventDto[] {
  const placeholderKinds: SurveillanceAlertRuleKind[] = [
    'motion-activity',
    'restricted-zone-event',
    'crowding-queue',
    'track-surface-condition',
  ];

  return placeholderKinds.map((ruleKind, index) => ({
    eventId: `event:placeholder:${ruleKind}`,
    ruleId: ruleIdForKind(ruleKind),
    ruleKind,
    title: `${surveillanceAlertRuleKindLabels[ruleKind]} — contract sample`,
    detail: 'Illustrative placeholder event for framework readiness. Not produced by live detection.',
    severity: 'info' as const,
    resolutionStatus: 'open' as const,
    triggeredAt: now,
    escalationTargets: DEFAULT_ESCALATION,
    linkedAuditEvents: [],
    placeholderDerived: true,
    evidence: [`placeholder:${ruleKind}`, `sample-index:${index + 1}`],
  }));
}

export class SurveillanceAlertingFrameworkService {
  buildFramework(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    governance: AuditGovernanceService,
  ): SurveillanceIoTAlertingFrameworkWorkspaceDto {
    const ruleCatalog = buildRuleCatalog(workspace);
    const liveEvents = buildLiveDerivedEvents(workspace, governance);
    const placeholderEvents = buildPlaceholderContractEvents(ctx.now);
    const alertEvents = [...liveEvents, ...placeholderEvents];

    const openEvents = alertEvents.filter((event) =>
      event.resolutionStatus === 'open' || event.resolutionStatus === 'acknowledged' || event.resolutionStatus === 'escalated',
    ).length;
    const criticalEvents = alertEvents.filter((event) => event.severity === 'critical').length;
    const escalatedEvents = alertEvents.filter((event) => event.resolutionStatus === 'escalated').length;
    const resolvedEvents = alertEvents.filter((event) => event.resolutionStatus === 'resolved').length;

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTAlertingSchemaVersion,
      architectureSchemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      summary: {
        totalRules: ruleCatalog.length,
        enabledRules: ruleCatalog.filter((rule) => rule.enabled).length,
        liveRules: ruleCatalog.filter((rule) => rule.readiness === 'live').length,
        placeholderRules: ruleCatalog.filter((rule) => rule.readiness === 'placeholder').length,
        openEvents,
        criticalEvents,
        escalatedEvents,
        resolvedEvents,
      },
      ruleCatalog,
      alertEvents,
      filterOptions: {
        ruleKinds: RULE_TEMPLATES.map((template) => template.ruleKind),
        severities: ['info', 'low', 'medium', 'high', 'critical'],
        resolutionStatuses: ['open', 'acknowledged', 'escalated', 'resolved', 'suppressed', 'expired'],
        readinessBands: ['live', 'placeholder', 'degraded-readiness'],
      },
      mock: workspace.mock,
    };
  }
}
