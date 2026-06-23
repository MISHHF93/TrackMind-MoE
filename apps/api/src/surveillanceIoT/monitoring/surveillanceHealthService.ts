import type {
  CameraDeviceDto,
  DeviceGatewayDto,
  DeviceRuleDto,
  IoTDeviceDto,
  SurveillanceHealthComponentGroupDto,
  SurveillanceHealthComponentKind,
  SurveillanceHealthLinkedIncidentDto,
  SurveillanceHealthLinkedMaintenanceDto,
  SurveillanceHealthOperationalStatus,
  SurveillanceHealthSubjectDto,
  SurveillanceHealthWorkspaceDto,
  SurveillanceIoTHealthBand,
  SurveillanceIoTWorkspaceDto,
  VideoStreamDto,
} from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SurveillanceAdapterRegistry } from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';

const COMPONENT_LABELS: Record<SurveillanceHealthComponentKind, string> = {
  'video-streams': 'Video streams',
  'device-connectivity': 'Device connectivity',
  'telemetry-ingestion': 'Telemetry ingestion',
  'gateway-status': 'Gateway status',
  'alert-pipeline': 'Alert pipeline health',
  'storage-recording': 'Storage / recording health',
  'rule-engine': 'Rule engine health',
  'ai-video-analytics': 'AI video analytics',
};

const OWNER_BY_KIND: Record<SurveillanceHealthComponentKind, { owner: string; role: string }> = {
  'video-streams': { owner: 'CCTV Operations', role: 'security-manager' },
  'device-connectivity': { owner: 'Facilities IoT', role: 'facilities-manager' },
  'telemetry-ingestion': { owner: 'Telemetry Platform', role: 'facilities-manager' },
  'gateway-status': { owner: 'Platform Integration', role: 'platform-super-admin' },
  'alert-pipeline': { owner: 'Security Operations', role: 'security-manager' },
  'storage-recording': { owner: 'Evidence Retention', role: 'security-manager' },
  'rule-engine': { owner: 'Surveillance Automation', role: 'security-manager' },
  'ai-video-analytics': { owner: 'AI Video Services', role: 'platform-super-admin' },
};

function operationalStatusFromDevice(status: string, health: SurveillanceIoTHealthBand): SurveillanceHealthOperationalStatus {
  if (status === 'offline' || health === 'critical') return 'offline';
  if (status === 'degraded' || status === 'maintenance' || health === 'degraded') return 'degraded';
  return 'online';
}

function operationalStatusFromStream(streamStatus: string): SurveillanceHealthOperationalStatus {
  if (streamStatus === 'offline' || streamStatus === 'archived') return 'offline';
  if (streamStatus === 'buffering') return 'degraded';
  return 'online';
}

function aggregateStatus(statuses: SurveillanceHealthOperationalStatus[]): SurveillanceHealthOperationalStatus {
  if (statuses.some((status) => status === 'offline')) return 'offline';
  if (statuses.some((status) => status === 'degraded')) return 'degraded';
  return statuses.length ? 'online' : 'online';
}

function healthBandFromOperational(status: SurveillanceHealthOperationalStatus): SurveillanceIoTHealthBand {
  if (status === 'offline') return 'critical';
  if (status === 'degraded') return 'degraded';
  return 'healthy';
}

function maintenanceForDevice(
  workspace: SurveillanceIoTWorkspaceDto,
  deviceId: string,
): SurveillanceHealthLinkedMaintenanceDto[] {
  return workspace.maintenanceRecords
    .filter((record) => record.deviceId === deviceId)
    .map((record) => ({
      maintenanceId: record.id,
      deviceId: record.deviceId,
      maintenanceStatus: record.maintenanceStatus,
      maintenanceType: record.maintenanceType,
      scheduledAt: record.scheduledAt,
      notes: record.notes,
    }));
}

function incidentsForDevice(
  workspace: SurveillanceIoTWorkspaceDto,
  deviceId: string,
  operationalOnly: boolean,
): SurveillanceHealthLinkedIncidentDto[] {
  return workspace.incidentReferences
    .filter((ref) => {
      const matches = ref.deviceId === deviceId || ref.cameraId === deviceId;
      if (!matches) return false;
      if (operationalOnly) {
        return workspace.openAlerts.some((alert) => alert.deviceId === deviceId && (alert.severity === 'critical' || alert.severity === 'high'));
      }
      return true;
    })
    .map((ref) => ({
      incidentReferenceId: ref.id,
      incidentId: ref.incidentId,
      title: ref.displayName,
      linkedAt: ref.linkedAt,
      operationalImpact: workspace.openAlerts.some((alert) => alert.deviceId === deviceId),
    }));
}

function buildSubject(
  subjectId: string,
  componentKind: SurveillanceHealthComponentKind,
  displayName: string,
  operationalStatus: SurveillanceHealthOperationalStatus,
  lastHeartbeatAt: string,
  issueReason: string | undefined,
  workspace: SurveillanceIoTWorkspaceDto,
  deviceIdForLinks?: string,
  metadataPlaceholder = false,
): SurveillanceHealthSubjectDto {
  const owner = OWNER_BY_KIND[componentKind];
  const linkedDeviceId = deviceIdForLinks ?? subjectId;
  return {
    subjectId,
    componentKind,
    displayName,
    operationalStatus,
    healthBand: healthBandFromOperational(operationalStatus),
    lastHeartbeatAt,
    issueReason,
    assignedOwner: owner.owner,
    assignedOwnerRole: owner.role,
    linkedMaintenance: maintenanceForDevice(workspace, linkedDeviceId),
    linkedIncidents: incidentsForDevice(workspace, linkedDeviceId, operationalStatus !== 'online'),
    metadataPlaceholder,
  };
}

function streamSubjects(
  streams: VideoStreamDto[],
  cameras: CameraDeviceDto[],
  workspace: SurveillanceIoTWorkspaceDto,
): SurveillanceHealthSubjectDto[] {
  return streams.map((stream) => {
    const camera = cameras.find((item) => item.id === stream.cameraId);
    const status = operationalStatusFromStream(stream.streamStatus);
    const issueReason = status === 'online'
      ? undefined
      : status === 'degraded'
        ? `Stream buffering on ${stream.protocol} path for ${camera?.displayName ?? stream.cameraId}.`
        : `Stream offline — no live frames from ${camera?.displayName ?? stream.cameraId}.`;
    return buildSubject(
      stream.id,
      'video-streams',
      `${camera?.displayName ?? stream.cameraId} stream`,
      status,
      stream.lastSeenAt,
      issueReason,
      workspace,
      stream.cameraId,
    );
  });
}

function deviceConnectivitySubjects(
  cameras: CameraDeviceDto[],
  iotDevices: IoTDeviceDto[],
  workspace: SurveillanceIoTWorkspaceDto,
): SurveillanceHealthSubjectDto[] {
  const all = [
    ...cameras.map((device) => ({ device, kind: 'camera-device' as const })),
    ...iotDevices.map((device) => ({ device, kind: 'iot-device' as const })),
  ];
  return all.map(({ device }) => {
    const status = operationalStatusFromDevice(device.status, device.health);
    const diagnostics = workspace.healthStatuses.find((item) => item.deviceId === device.id)?.diagnostics ?? [];
    const issueReason = status === 'online'
      ? undefined
      : diagnostics[0]?.message ?? `Device ${device.status} with ${device.integrationStatus} integration posture.`;
    return buildSubject(
      device.id,
      'device-connectivity',
      device.displayName,
      status,
      device.lastSeenAt,
      issueReason,
      workspace,
      device.id,
    );
  });
}

function telemetrySubjects(
  iotDevices: IoTDeviceDto[],
  workspace: SurveillanceIoTWorkspaceDto,
  ctx: SurveillanceIoTModuleContext,
): SurveillanceHealthSubjectDto[] {
  return iotDevices.map((device) => {
    const recent = workspace.recentReadings.filter((reading) => reading.deviceId === device.id);
    const latest = recent.sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    const status: SurveillanceHealthOperationalStatus =
      device.status === 'offline' ? 'offline'
        : !latest || device.integrationStatus === 'blocked' ? 'offline'
          : latest.quality === 'bad' ? 'degraded'
            : 'online';
    const issueReason = status === 'online'
      ? undefined
      : !latest
        ? 'No telemetry readings ingested in the current window.'
        : `Telemetry quality ${latest.quality} for metric ${latest.metric}.`;
    return buildSubject(
      `telemetry:${device.id}`,
      'telemetry-ingestion',
      `${device.displayName} telemetry`,
      status,
      latest?.observedAt ?? device.lastSeenAt,
      issueReason,
      workspace,
      device.id,
    );
  });
}

function gatewaySubjects(
  gateways: DeviceGatewayDto[],
  workspace: SurveillanceIoTWorkspaceDto,
): SurveillanceHealthSubjectDto[] {
  return gateways.map((gateway) => {
    const status = operationalStatusFromDevice(gateway.status, gateway.health);
    const issueReason = status === 'online'
      ? undefined
      : `Gateway ${gateway.integrationStatus} — ${gateway.connectedDeviceIds.length} devices attached via ${gateway.protocol}.`;
    return buildSubject(
      gateway.id,
      'gateway-status',
      gateway.displayName,
      status,
      gateway.lastSeenAt,
      issueReason,
      workspace,
      gateway.id,
    );
  });
}

function alertPipelineSubjects(
  workspace: SurveillanceIoTWorkspaceDto,
  ctx: SurveillanceIoTModuleContext,
): SurveillanceHealthSubjectDto[] {
  const pipelines = [
    { id: 'alert-ingest', name: 'Alert ingest pipeline' },
    { id: 'alert-dispatch', name: 'Alert dispatch & escalation' },
    { id: 'alert-ack', name: 'Acknowledgement workflow' },
  ];
  const openCount = workspace.openAlerts.length;
  const criticalCount = workspace.openAlerts.filter((alert) => alert.severity === 'critical').length;

  return pipelines.map((pipeline, index) => {
    let status: SurveillanceHealthOperationalStatus = 'online';
    if (criticalCount > 0 && index === 0) status = 'degraded';
    if (openCount > 5 && index === 1) status = 'degraded';
    if (criticalCount > 2 && index === 2) status = 'offline';
    const issueReason = status === 'online'
      ? undefined
      : index === 0
        ? `${openCount} open device alerts awaiting ingest normalisation.`
        : index === 1
          ? 'Dispatch queue depth above nominal SLA threshold.'
          : 'Critical alerts pending acknowledgement beyond SLA.';
    return buildSubject(
      pipeline.id,
      'alert-pipeline',
      pipeline.name,
      status,
      ctx.now,
      issueReason,
      workspace,
    );
  });
}

function storageSubjects(
  cameras: CameraDeviceDto[],
  streams: VideoStreamDto[],
  workspace: SurveillanceIoTWorkspaceDto,
): SurveillanceHealthSubjectDto[] {
  const policy = workspace.retentionPolicies[0];
  return [
    buildSubject(
      'storage-primary',
      'storage-recording',
      policy?.policyName ?? 'Primary recording storage',
      policy ? 'online' : 'degraded',
      policy?.lastSeenAt ?? workspace.generatedAt,
      policy ? undefined : 'Retention policy projection unavailable.',
      workspace,
    ),
    ...cameras.slice(0, 4).map((camera) => {
      const stream = streams.find((item) => item.cameraId === camera.id);
      const status = stream?.recordingActive && camera.status === 'online'
        ? 'online'
        : stream?.recordingActive === false
          ? 'degraded'
          : 'offline';
      return buildSubject(
        `recording:${camera.id}`,
        'storage-recording',
        `${camera.displayName} recording path`,
        status,
        stream?.lastSeenAt ?? camera.lastSeenAt,
        status === 'online' ? undefined : 'Recording inactive or storage path unreachable.',
        workspace,
        camera.id,
      );
    }),
  ];
}

function ruleEngineSubjects(
  rules: DeviceRuleDto[],
  workspace: SurveillanceIoTWorkspaceDto,
  ctx: SurveillanceIoTModuleContext,
): SurveillanceHealthSubjectDto[] {
  if (rules.length === 0) {
    return [
      buildSubject('rule-engine-core', 'rule-engine', 'Device rule evaluation engine', 'online', ctx.now, undefined, workspace),
      buildSubject('rule-motion-paddock', 'rule-engine', 'Paddock motion alert rule', 'degraded', ctx.now, 'Rule enabled but last evaluation stale.', workspace),
    ];
  }
  return rules.map((rule) => {
    const status: SurveillanceHealthOperationalStatus = !rule.enabled
      ? 'offline'
      : rule.lastEvaluatedAt
        ? 'online'
        : 'degraded';
    return buildSubject(
      rule.id,
      'rule-engine',
      rule.ruleName,
      status,
      rule.lastEvaluatedAt ?? rule.lastSeenAt,
      status === 'online' ? undefined : !rule.enabled ? 'Rule disabled in configuration.' : 'Rule evaluation heartbeat missing.',
      workspace,
    );
  });
}

function aiAnalyticsSubjects(ctx: SurveillanceIoTModuleContext, workspace: SurveillanceIoTWorkspaceDto): SurveillanceHealthSubjectDto[] {
  return [
    buildSubject(
      'ai-analytics-inference',
      'ai-video-analytics',
      'Video analytics inference service',
      'degraded',
      ctx.now,
      'Placeholder — adapter sync pending for edge analytics cluster.',
      workspace,
      undefined,
      true,
    ),
    buildSubject(
      'ai-analytics-model-registry',
      'ai-video-analytics',
      'Analytics model registry',
      'online',
      ctx.now,
      undefined,
      workspace,
      undefined,
      true,
    ),
  ];
}

function buildGroup(
  componentKind: SurveillanceHealthComponentKind,
  subjects: SurveillanceHealthSubjectDto[],
): SurveillanceHealthComponentGroupDto {
  const operationalStatus = aggregateStatus(subjects.map((subject) => subject.operationalStatus));
  const owner = OWNER_BY_KIND[componentKind];
  return {
    componentKind,
    displayName: COMPONENT_LABELS[componentKind],
    operationalStatus,
    healthBand: healthBandFromOperational(operationalStatus),
    subjectCount: subjects.length,
    onlineCount: subjects.filter((subject) => subject.operationalStatus === 'online').length,
    degradedCount: subjects.filter((subject) => subject.operationalStatus === 'degraded').length,
    offlineCount: subjects.filter((subject) => subject.operationalStatus === 'offline').length,
    lastHeartbeatAt: subjects.reduce((latest, subject) => (
      subject.lastHeartbeatAt > latest ? subject.lastHeartbeatAt : latest
    ), subjects[0]?.lastHeartbeatAt ?? new Date(0).toISOString()),
    assignedOwner: owner.owner,
    subjects,
  };
}

export class SurveillanceHealthService {
  buildHealthWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
  ): SurveillanceHealthWorkspaceDto {
    const streams = workspace.videoStreams.map((stream) => {
      const adapterHealth = adapterRegistry.snapshot(ctx.now).streamHealth;
      const adapterEntry = adapterHealth.find((entry) => entry.externalCameraId === stream.cameraId || stream.id.includes(stream.cameraId));
      if (!adapterEntry) return stream;
      return { ...stream, streamStatus: adapterEntry.streamStatus, recordingActive: adapterEntry.recordingActive ?? stream.recordingActive };
    });

    const componentGroups: SurveillanceHealthComponentGroupDto[] = [
      buildGroup('video-streams', streamSubjects(streams, workspace.cameras, workspace)),
      buildGroup('device-connectivity', deviceConnectivitySubjects(workspace.cameras, workspace.iotDevices, workspace)),
      buildGroup('telemetry-ingestion', telemetrySubjects(workspace.iotDevices, workspace, ctx)),
      buildGroup('gateway-status', gatewaySubjects(workspace.gateways, workspace)),
      buildGroup('alert-pipeline', alertPipelineSubjects(workspace, ctx)),
      buildGroup('storage-recording', storageSubjects(workspace.cameras, streams, workspace)),
      buildGroup('rule-engine', ruleEngineSubjects(workspace.rules, workspace, ctx)),
      buildGroup('ai-video-analytics', aiAnalyticsSubjects(ctx, workspace)),
    ];

    const allSubjects = componentGroups.flatMap((group) => group.subjects);
    const operationalIncidents = allSubjects.reduce(
      (count, subject) => count + subject.linkedIncidents.filter((incident) => incident.operationalImpact).length,
      0,
    );

    let overall: SurveillanceIoTHealthBand = 'healthy';
    if (allSubjects.some((subject) => subject.operationalStatus === 'offline')) overall = 'critical';
    else if (allSubjects.some((subject) => subject.operationalStatus === 'degraded')) overall = 'degraded';

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      summary: {
        totalSubjects: allSubjects.length,
        onlineCount: allSubjects.filter((subject) => subject.operationalStatus === 'online').length,
        degradedCount: allSubjects.filter((subject) => subject.operationalStatus === 'degraded').length,
        offlineCount: allSubjects.filter((subject) => subject.operationalStatus === 'offline').length,
        overallHealthBand: overall,
        openAlertCount: workspace.openAlerts.length,
        operationalIncidents,
      },
      componentGroups,
      filterOptions: {
        operationalStatuses: ['online', 'degraded', 'offline'],
        componentKinds: Object.keys(COMPONENT_LABELS) as SurveillanceHealthComponentKind[],
        healthBands: ['healthy', 'degraded', 'critical', 'unknown'],
      },
      mock: workspace.mock,
    };
  }
}
