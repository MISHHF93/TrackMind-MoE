import type {
  CameraDeviceDto,
  CctvCameraDetailWorkspaceDto,
  CctvCameraHealthTimelineEntryDto,
  CctvCameraOperationalDomainAssignmentDto,
  CctvCameraStreamEndpointPlaceholderDto,
  SurveillanceIoTDomainScope,
  SurveillanceIoTWorkspaceDto,
} from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SecurityActor } from '../../securityOps.js';
import type { AuditGovernanceService } from '../governance/auditGovernanceService.js';
import type { FacilityZoneMappingService } from '../mapping/facilityZoneMappingService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';
import type { CctvCameraRegistryService } from './cctvCameraRegistryService.js';

const DOMAIN_LABELS: Record<SurveillanceIoTDomainScope, string> = {
  'security-soc': 'Security SOC',
  'facilities-iot': 'Facilities IoT',
  operations: 'Race operations',
  shared: 'Shared platform',
};

function offsetIso(iso: string, minutesAgo: number): string {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - minutesAgo);
  return date.toISOString();
}

function buildHealthTimeline(
  camera: CameraDeviceDto,
  workspace: SurveillanceIoTWorkspaceDto,
  ctx: SurveillanceIoTModuleContext,
): CctvCameraHealthTimelineEntryDto[] {
  const healthStatus = workspace.healthStatuses.find((item) => item.deviceId === camera.id);
  const stream = workspace.videoStreams.find((item) => item.cameraId === camera.id);
  const alerts = workspace.openAlerts.filter((alert) => alert.deviceId === camera.id);

  const timeline: CctvCameraHealthTimelineEntryDto[] = [
    {
      observedAt: camera.lastSeenAt,
      healthBand: camera.health,
      healthScore: healthStatus?.healthScore,
      eventKind: 'heartbeat',
      summary: `Device heartbeat — ${camera.status} with ${camera.integrationStatus} integration.`,
    },
    {
      observedAt: offsetIso(ctx.now, 45),
      healthBand: camera.health,
      healthScore: healthStatus?.healthScore,
      eventKind: 'integration',
      summary: `Integration posture ${camera.integrationStatus}${camera.webhookConfigured ? ' with webhook configured' : ''}.`,
    },
  ];

  if (stream) {
    timeline.push({
      observedAt: stream.lastSeenAt,
      healthBand: stream.streamStatus === 'live' ? 'healthy' : stream.streamStatus === 'offline' ? 'critical' : 'degraded',
      eventKind: 'stream',
      summary: `Stream ${stream.streamStatus} on ${stream.protocol} path.`,
    });
    timeline.push({
      observedAt: offsetIso(stream.lastSeenAt, 30),
      healthBand: stream.recordingActive ? 'healthy' : 'degraded',
      eventKind: 'recording',
      summary: stream.recordingActive ? 'Recording path active.' : 'Recording inactive on storage path.',
    });
  }

  for (const alert of alerts.slice(0, 3)) {
    timeline.push({
      observedAt: alert.triggeredAt,
      healthBand: alert.severity === 'critical' ? 'critical' : 'degraded',
      eventKind: 'alert',
      summary: `${alert.title} — ${alert.detail}`,
    });
  }

  return timeline.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

function buildStreamEndpoints(
  camera: CameraDeviceDto,
  workspace: SurveillanceIoTWorkspaceDto,
): CctvCameraStreamEndpointPlaceholderDto[] {
  const streams = workspace.videoStreams.filter((stream) => stream.cameraId === camera.id);
  if (streams.length === 0) {
    return [{
      streamId: `stream:${camera.id}:primary`,
      label: `${camera.displayName} primary stream`,
      protocol: 'rtsp',
      endpointKind: 'primary',
      endpointUriPlaceholder: `rtsp://vms-placeholder/${camera.id}/primary`,
      playbackCapable: false,
      streamStatus: 'offline',
      recordingActive: false,
      metadataPlaceholder: true,
    }];
  }

  return streams.flatMap((stream, index) => {
    const placeholders: CctvCameraStreamEndpointPlaceholderDto[] = [{
      streamId: stream.id,
      label: stream.displayName,
      protocol: stream.protocol,
      endpointKind: index === 0 ? 'primary' : 'substream',
      endpointUriPlaceholder: stream.streamUrl ?? `${stream.protocol}://vms-placeholder/${camera.id}/${stream.id}`,
      playbackCapable: false,
      streamStatus: stream.streamStatus,
      recordingActive: stream.recordingActive,
      metadataPlaceholder: true,
    }];
    if (index === 0) {
      placeholders.push({
        streamId: `${stream.id}:snapshot`,
        label: `${camera.displayName} snapshot endpoint`,
        protocol: 'mjpeg',
        endpointKind: 'snapshot',
        endpointUriPlaceholder: `https://vms-placeholder/${camera.id}/snapshot/latest`,
        playbackCapable: false,
        streamStatus: stream.streamStatus,
        recordingActive: false,
        metadataPlaceholder: true,
      });
    }
    return placeholders;
  });
}

function buildOperationalDomains(
  assignedDomain: SurveillanceIoTDomainScope,
): CctvCameraOperationalDomainAssignmentDto[] {
  const domains: SurveillanceIoTDomainScope[] = assignedDomain === 'shared'
    ? ['shared']
    : [assignedDomain, 'shared'];
  return [...new Set(domains)].map((domain) => ({
    domain,
    isPrimary: domain === assignedDomain,
    label: DOMAIN_LABELS[domain],
  }));
}

export class CctvCameraDetailService {
  buildDetailWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    cameraId: string,
    actor: SecurityActor,
    registry: CctvCameraRegistryService,
    zoneMapping: FacilityZoneMappingService,
    governance: AuditGovernanceService,
  ): CctvCameraDetailWorkspaceDto | undefined {
    const camera = workspace.cameras.find((item) => item.id === cameraId);
    if (!camera) return undefined;

    const entry = registry.getEntry(ctx, workspace, cameraId, actor);
    if (!entry) return undefined;

    const mappingWorkspace = zoneMapping.buildZoneMappingWorkspace(ctx, workspace, actor);
    const deviceAssignment = mappingWorkspace.deviceAssignments.find((item) => item.deviceId === cameraId);
    const operationalZones = mappingWorkspace.operationalZones
      .filter((zone) => zone.cameraIds.includes(cameraId))
      .map((zone) => ({
        zoneId: zone.zoneId,
        zoneLabel: zone.zoneLabel,
        zoneKind: zone.zoneKind,
        isPrimary: deviceAssignment?.primaryZoneId === zone.zoneId,
      }));

    const stream = workspace.videoStreams.find((item) => item.cameraId === camera.id);
    const retentionPolicy = workspace.retentionPolicies.find(
      (item) => item.id === entry.retentionPolicyId || item.appliesToCameraIds.includes(camera.id),
    );

    const recentAlerts = workspace.openAlerts
      .filter((alert) => alert.deviceId === camera.id)
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
      .filter((ref) => ref.cameraId === camera.id || ref.zoneId === camera.securityZoneId)
      .map((ref) => ({
        incidentReferenceId: ref.id,
        incidentId: ref.incidentId,
        title: ref.displayName,
        linkedAt: ref.linkedAt,
        linkageReason: ref.linkageReason,
        operationalImpact: recentAlerts.some((alert) => alert.severity === 'critical' || alert.severity === 'high'),
      }));

    const linkedEvidence = workspace.videoEvidence
      .filter((evidence) => evidence.cameraId === camera.id)
      .map((evidence) => ({
        evidenceReferenceId: evidence.id,
        clipStartAt: evidence.clipStartAt,
        clipEndAt: evidence.clipEndAt,
        incidentId: evidence.incidentId,
        storageUriPlaceholder: evidence.storageUri ?? `s3://evidence-placeholder/${camera.id}/${evidence.id}`,
        privacyMasked: evidence.privacyMasked,
        legalHold: evidence.legalHold,
        playbackCapable: false as const,
        metadataPlaceholder: true as const,
      }));

    const maintenanceHistory = workspace.maintenanceRecords
      .filter((record) => record.deviceId === camera.id)
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

    const governanceAudits = governance.auditForSubject(cameraId).map((record) => ({
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
        action: 'surveillance.camera.registered',
        layer: 'administration' as const,
        actorId: entry.audit.createdBy,
        occurredAt: entry.audit.createdAt,
        details: [`eventId:${entry.audit.eventId}`, `cameraId:${camera.id}`],
      },
      ...governanceAudits,
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      cameraId: camera.id,
      identity: {
        ...entry,
        assetId: camera.assetId,
        twinId: camera.twinId,
        ptzCapable: camera.ptzCapable,
        privacyMaskingEnabled: camera.privacyMaskingEnabled,
        resolution: camera.resolution,
        codec: camera.codec,
        gatewayId: camera.gatewayId,
        createdAt: camera.createdAt,
        updatedAt: camera.updatedAt,
      },
      zoneMapping: {
        deviceZoneId: entry.zoneId,
        deviceZoneLabel: entry.zoneLabel,
        securityZoneId: camera.securityZoneId,
        facilityId: entry.facilityId,
        facilityLabel: entry.facilityLabel,
        operationalZones,
      },
      streamEndpoints: buildStreamEndpoints(camera, workspace),
      recording: {
        recordingStatus: entry.recordingStatus,
        recordingMode: entry.recordingMode,
        recordingActive: stream?.recordingActive ?? false,
        storagePathPlaceholder: `storage://recording/${ctx.scope.racetrackId}/${camera.id}/primary`,
        lastRecordingHeartbeatAt: stream?.lastSeenAt,
      },
      retentionPolicy: retentionPolicy ? {
        policyId: retentionPolicy.id,
        policyName: retentionPolicy.policyName,
        retentionDays: retentionPolicy.retentionDays,
        disposition: retentionPolicy.disposition,
        legalHoldEligible: retentionPolicy.legalHoldEligible,
        privacyMaskingRequired: retentionPolicy.privacyMaskingRequired,
        regulatoryFrameworks: retentionPolicy.regulatoryFrameworks,
      } : undefined,
      healthTimeline: buildHealthTimeline(camera, workspace, ctx),
      recentAlerts,
      linkedIncidents,
      linkedEvidence,
      maintenanceHistory,
      operationalDomains: buildOperationalDomains(entry.assignedDomain),
      auditHistory,
      canEdit: entry.canEdit,
      mock: entry.mock,
    };
  }
}
