import type { SurveillanceIoTTelemetryIngestRequestDto, CctvCameraRegistryUpdateRequestDto, IoTDeviceRegistryUpdateRequestDto, SurveillanceDeviceZoneAssignmentUpdateRequestDto, SurveillanceDeviceCreationRequestDto, SurveillanceRetentionPolicyChangeRequestDto, SurveillanceAlertRuleChangeRequestDto, SurveillanceHealthOverrideRequestDto, SurveillanceMaintenanceStatusChangeRequestDto, SurveillanceEvidenceLinkRequestDto, SurveillancePrivilegedConfigAccessRequestDto } from '@trackmind/shared';
import type { SecurityActor } from '../securityOps.js';
import type { SurveillanceIoTModule } from './surveillanceIoTModule.js';

function notFound(message: string) {
  return { status: 404, body: { ok: false, error: { code: 'camera_not_found', message } } };
}

function forbidden(error: unknown) {
  return {
    status: 403,
    body: {
      ok: false,
      error: {
        code: 'surveillance_iot_forbidden',
        message: error instanceof Error ? error.message : String(error),
      },
    },
  };
}

function badRequest(code: string, message: string) {
  return { status: 400, body: { ok: false, error: { code, message } } };
}

export function handleSurveillanceIoTRoute(
  module: SurveillanceIoTModule,
  method: string,
  path: string,
  body: unknown,
  actor: SecurityActor,
  searchParams?: URLSearchParams,
): { status: number; body: unknown } | undefined {
  if (method === 'GET' && path === '/surveillance-iot/workspace') {
    try {
      return { status: 200, body: module.buildWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/readiness') {
    try {
      return { status: 200, body: module.getReadiness(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/administration/workspace') {
    try {
      return { status: 200, body: module.getAdministrationWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/monitoring/workspace') {
    try {
      return { status: 200, body: module.getMonitoringWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/evidence/workspace') {
    try {
      return { status: 200, body: module.getEvidenceWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/alerting/workspace') {
    try {
      return { status: 200, body: module.getAlertingWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/mapping/zones') {
    try {
      return { status: 200, body: module.getZoneMappingWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  const operationalZoneMatch = path.match(/^\/surveillance-iot\/mapping\/zones\/([^/]+)$/);
  if (operationalZoneMatch) {
    const zoneId = decodeURIComponent(operationalZoneMatch[1] ?? '');
    if (method === 'GET') {
      try {
        return { status: 200, body: module.getOperationalZone(actor, zoneId) };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
        return forbidden(error);
      }
    }
  }

  const deviceZoneAssignmentMatch = path.match(/^\/surveillance-iot\/mapping\/devices\/([^/]+)\/zones$/);
  if (deviceZoneAssignmentMatch && method === 'PATCH') {
    const deviceId = decodeURIComponent(deviceZoneAssignmentMatch[1] ?? '');
    const input = (body ?? {}) as Partial<SurveillanceDeviceZoneAssignmentUpdateRequestDto>;
    if (!input.deviceKind || !Array.isArray(input.operationalZoneIds) || input.operationalZoneIds.length === 0) {
      return badRequest('invalid_assignment_payload', 'deviceKind and operationalZoneIds are required.');
    }
    try {
      const result = module.updateDeviceZoneAssignment(actor, deviceId, {
        deviceId,
        deviceKind: input.deviceKind,
        operationalZoneIds: input.operationalZoneIds.map(String),
        primaryZoneId: input.primaryZoneId ? String(input.primaryZoneId) : undefined,
        reason: input.reason ? String(input.reason) : undefined,
      });
      return {
        status: result.pendingApproval ? 202 : 200,
        body: result,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
      if (error instanceof Error && (error.message.includes('No zone assignment') || error.message.includes('At least one'))) {
        return badRequest('no_changes', error.message);
      }
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/viewer/workspace') {
    try {
      return {
        status: 200,
        body: module.getCctvViewerWorkspace(
          actor,
          searchParams?.get('camera') ?? undefined,
          searchParams?.get('clip') ?? undefined,
        ),
      };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/viewer/playback') {
    try {
      const ref = searchParams?.get('ref');
      if (!ref) return badRequest('invalid_ref', 'Query parameter ref is required.');
      return { status: 200, body: module.getMediaViewerPlayback(actor, ref) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'POST' && path === '/surveillance-iot/viewer/snapshot') {
    try {
      return { status: 201, body: module.createMediaSnapshot(actor, body as import('@trackmind/shared').MediaSnapshotRequestDto) };
    } catch (error) {
      return badRequest('snapshot_failed', error instanceof Error ? error.message : 'Snapshot failed');
    }
  }

  if (method === 'POST' && path === '/surveillance-iot/viewer/export') {
    try {
      return { status: 201, body: module.createMediaExport(actor, body as import('@trackmind/shared').MediaExportRequestDto) };
    } catch (error) {
      return badRequest('export_failed', error instanceof Error ? error.message : 'Export failed');
    }
  }

  if (method === 'POST' && path === '/surveillance-iot/viewer/share-link') {
    try {
      return { status: 201, body: module.createMediaShareLink(actor, body as import('@trackmind/shared').MediaShareLinkRequestDto) };
    } catch (error) {
      return badRequest('share_failed', error instanceof Error ? error.message : 'Share link failed');
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/integration/contracts/workspace') {
    try {
      return { status: 200, body: module.getVendorIntegrationWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/kpi-pack') {
    try {
      return { status: 200, body: module.getKpiPack(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/governance/workspace') {
    try {
      return { status: 200, body: module.getGovernanceWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/administration/governance/workspace') {
    try {
      return { status: 200, body: module.getAdministrationGovernanceWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'POST' && path === '/surveillance-iot/administration/devices') {
    const input = (body ?? {}) as Partial<SurveillanceDeviceCreationRequestDto>;
    if (!input.deviceKind || !input.displayName?.trim() || !input.reason?.trim()) {
      return badRequest('invalid_device_payload', 'deviceKind, displayName, and reason are required.');
    }
    try {
      return {
        status: 201,
        body: module.createAdministrationDevice(actor, {
          deviceKind: input.deviceKind,
          displayName: String(input.displayName),
          assignedDomain: input.assignedDomain ? String(input.assignedDomain) : undefined,
          facilityZoneId: input.facilityZoneId ? String(input.facilityZoneId) : undefined,
          adapterId: input.adapterId ? String(input.adapterId) : undefined,
          externalDeviceId: input.externalDeviceId ? String(input.externalDeviceId) : undefined,
          reason: String(input.reason),
        }),
      };
    } catch (error) {
      return forbidden(error);
    }
  }

  const retentionPolicyMatch = path.match(/^\/surveillance-iot\/administration\/retention-policies\/([^/]+)\/changes$/);
  if (retentionPolicyMatch && method === 'POST') {
    const policyId = decodeURIComponent(retentionPolicyMatch[1] ?? '');
    const input = (body ?? {}) as Partial<SurveillanceRetentionPolicyChangeRequestDto>;
    if (!input.reason?.trim()) {
      return badRequest('invalid_retention_payload', 'reason is required.');
    }
    try {
      return {
        status: 202,
        body: module.requestRetentionPolicyChange(actor, policyId, {
          policyId,
          retentionDays: input.retentionDays,
          disposition: input.disposition ? String(input.disposition) : undefined,
          legalHoldEligible: input.legalHoldEligible,
          privacyMaskingRequired: input.privacyMaskingRequired,
          reason: String(input.reason),
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('No retention')) return badRequest('no_changes', error.message);
      return forbidden(error);
    }
  }

  const alertRuleMatch = path.match(/^\/surveillance-iot\/administration\/alert-rules\/([^/]+)\/changes$/);
  if (alertRuleMatch && method === 'POST') {
    const ruleId = decodeURIComponent(alertRuleMatch[1] ?? '');
    const input = (body ?? {}) as Partial<SurveillanceAlertRuleChangeRequestDto>;
    if (!input.reason?.trim()) {
      return badRequest('invalid_alert_rule_payload', 'reason is required.');
    }
    try {
      return {
        status: 202,
        body: module.requestAlertRuleChange(actor, ruleId, {
          ruleId,
          enabled: input.enabled,
          severity: input.severity ? String(input.severity) : undefined,
          conditionExpression: input.conditionExpression ? String(input.conditionExpression) : undefined,
          reason: String(input.reason),
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('No alert rule')) return badRequest('no_changes', error.message);
      return forbidden(error);
    }
  }

  const healthOverrideMatch = path.match(/^\/surveillance-iot\/administration\/devices\/([^/]+)\/health-overrides$/);
  if (healthOverrideMatch && method === 'POST') {
    const deviceId = decodeURIComponent(healthOverrideMatch[1] ?? '');
    const input = (body ?? {}) as Partial<SurveillanceHealthOverrideRequestDto>;
    if (!input.deviceKind || !input.overrideHealthBand || !input.reason?.trim()) {
      return badRequest('invalid_health_override_payload', 'deviceKind, overrideHealthBand, and reason are required.');
    }
    try {
      return {
        status: 200,
        body: module.applyHealthOverride(actor, deviceId, {
          deviceId,
          deviceKind: input.deviceKind,
          overrideHealthBand: input.overrideHealthBand,
          expiresAt: input.expiresAt ? String(input.expiresAt) : undefined,
          reason: String(input.reason),
        }),
      };
    } catch (error) {
      return forbidden(error);
    }
  }

  const maintenanceMatch = path.match(/^\/surveillance-iot\/administration\/devices\/([^/]+)\/maintenance$/);
  if (maintenanceMatch && method === 'POST') {
    const deviceId = decodeURIComponent(maintenanceMatch[1] ?? '');
    const input = (body ?? {}) as Partial<SurveillanceMaintenanceStatusChangeRequestDto>;
    if (!input.deviceKind || !input.maintenanceStatus || !input.reason?.trim()) {
      return badRequest('invalid_maintenance_payload', 'deviceKind, maintenanceStatus, and reason are required.');
    }
    try {
      return {
        status: 200,
        body: module.changeMaintenanceStatus(actor, deviceId, {
          deviceId,
          deviceKind: input.deviceKind,
          maintenanceStatus: input.maintenanceStatus,
          maintenanceType: input.maintenanceType ? String(input.maintenanceType) : undefined,
          reason: String(input.reason),
        }),
      };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'POST' && path === '/surveillance-iot/evidence/link') {
    const input = (body ?? {}) as Partial<SurveillanceEvidenceLinkRequestDto>;
    if (!input.evidenceId || !input.reason?.trim()) {
      return badRequest('invalid_evidence_link_payload', 'evidenceId and reason are required.');
    }
    try {
      return {
        status: 200,
        body: module.linkEvidence(actor, {
          evidenceId: String(input.evidenceId),
          incidentId: input.incidentId ? String(input.incidentId) : undefined,
          cameraId: input.cameraId ? String(input.cameraId) : undefined,
          clipStartAt: input.clipStartAt ? String(input.clipStartAt) : undefined,
          clipEndAt: input.clipEndAt ? String(input.clipEndAt) : undefined,
          reason: String(input.reason),
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Provide incidentId')) return badRequest('invalid_evidence_link_payload', error.message);
      return forbidden(error);
    }
  }

  if (method === 'POST' && path === '/surveillance-iot/administration/privileged-config/access') {
    const input = (body ?? {}) as Partial<SurveillancePrivilegedConfigAccessRequestDto>;
    if (!input.configScope || !input.reason?.trim()) {
      return badRequest('invalid_privileged_access_payload', 'configScope and reason are required.');
    }
    try {
      return {
        status: 200,
        body: module.recordPrivilegedConfigAccess(actor, {
          configScope: input.configScope,
          targetId: input.targetId ? String(input.targetId) : undefined,
          reason: String(input.reason),
        }),
      };
    } catch (error) {
      return forbidden(error);
    }
  }

  const approvalDecideMatch = path.match(/^\/surveillance-iot\/administration\/approvals\/([^/]+)\/decide$/);
  if (approvalDecideMatch && method === 'POST') {
    const approvalRequestId = decodeURIComponent(approvalDecideMatch[1] ?? '');
    const input = (body ?? {}) as { decision?: string; reason?: string };
    if (!input.decision || !input.reason?.trim()) {
      return badRequest('invalid_approval_decision', 'decision and reason are required.');
    }
    if (input.decision !== 'approved' && input.decision !== 'rejected') {
      return badRequest('invalid_approval_decision', 'decision must be approved or rejected.');
    }
    try {
      return {
        status: 200,
        body: module.decideAdministrationApproval(actor, approvalRequestId, input.decision, String(input.reason)),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
      return forbidden(error);
    }
  }

  if (method === 'POST' && path === '/surveillance-iot/ingestion/telemetry') {
    const input = (body ?? {}) as Partial<SurveillanceIoTTelemetryIngestRequestDto>;
    if (!input.adapterId || !input.externalDeviceId || !Array.isArray(input.readings) || input.readings.length === 0) {
      return badRequest('invalid_telemetry_payload', 'adapterId, externalDeviceId, and readings are required.');
    }
    try {
      return {
        status: 202,
        body: module.ingestTelemetry(actor, {
          adapterId: String(input.adapterId),
          externalDeviceId: String(input.externalDeviceId),
          readings: input.readings.map((reading) => ({
            metric: String(reading.metric ?? ''),
            value: reading.value as number | string | boolean,
            unit: reading.unit ? String(reading.unit) : undefined,
            observedAt: reading.observedAt ? String(reading.observedAt) : undefined,
            quality: reading.quality,
          })),
        }),
      };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/health/workspace') {
    try {
      return { status: 200, body: module.getSurveillanceHealthWorkspace(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/cameras/registry') {
    try {
      return { status: 200, body: module.getCameraRegistry(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  const cameraDetailWorkspaceMatch = path.match(/^\/surveillance-iot\/cameras\/([^/]+)\/detail$/);
  if (cameraDetailWorkspaceMatch && method === 'GET') {
    const cameraId = decodeURIComponent(cameraDetailWorkspaceMatch[1] ?? '');
    try {
      return { status: 200, body: module.getCameraDetailWorkspace(actor, cameraId) };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
      return forbidden(error);
    }
  }

  const cameraDetailMatch = path.match(/^\/surveillance-iot\/cameras\/([^/]+)$/);
  if (cameraDetailMatch && cameraDetailMatch[1] !== 'registry') {
    const cameraId = decodeURIComponent(cameraDetailMatch[1] ?? '');
    if (method === 'GET') {
      try {
        return { status: 200, body: module.getCameraRegistryEntry(actor, cameraId) };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
        return forbidden(error);
      }
    }
    if (method === 'PATCH') {
      const input = (body ?? {}) as Partial<CctvCameraRegistryUpdateRequestDto>;
      try {
        const result = module.updateCameraRegistryEntry(actor, cameraId, {
          displayName: input.displayName ? String(input.displayName) : undefined,
          assignedDomain: input.assignedDomain,
          recordingMode: input.recordingMode,
          retentionPolicyId: input.retentionPolicyId ? String(input.retentionPolicyId) : undefined,
          facilityZoneId: input.facilityZoneId ? String(input.facilityZoneId) : undefined,
          reason: input.reason ? String(input.reason) : undefined,
        });
        return {
          status: result.pendingApproval ? 202 : 200,
          body: result,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
        if (error instanceof Error && error.message.includes('No registry fields')) {
          return badRequest('no_changes', error.message);
        }
        return forbidden(error);
      }
    }
  }

  if (method === 'GET' && path === '/surveillance-iot/devices/registry') {
    try {
      return { status: 200, body: module.getIoTDeviceRegistry(actor) };
    } catch (error) {
      return forbidden(error);
    }
  }

  const deviceDetailWorkspaceMatch = path.match(/^\/surveillance-iot\/devices\/([^/]+)\/detail$/);
  if (deviceDetailWorkspaceMatch && method === 'GET') {
    const deviceId = decodeURIComponent(deviceDetailWorkspaceMatch[1] ?? '');
    try {
      return { status: 200, body: module.getIoTDeviceDetailWorkspace(actor, deviceId) };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
      return forbidden(error);
    }
  }

  const deviceDetailMatch = path.match(/^\/surveillance-iot\/devices\/([^/]+)$/);
  if (deviceDetailMatch && deviceDetailMatch[1] !== 'registry') {
    const deviceId = decodeURIComponent(deviceDetailMatch[1] ?? '');
    if (method === 'GET') {
      try {
        return { status: 200, body: module.getIoTDeviceRegistryEntry(actor, deviceId) };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
        return forbidden(error);
      }
    }
    if (method === 'PATCH') {
      const input = (body ?? {}) as Partial<IoTDeviceRegistryUpdateRequestDto>;
      try {
        const result = module.updateIoTDeviceRegistryEntry(actor, deviceId, {
          displayName: input.displayName ? String(input.displayName) : undefined,
          assignedWorkflowDomain: input.assignedWorkflowDomain,
          facilityZoneId: input.facilityZoneId ? String(input.facilityZoneId) : undefined,
          reason: input.reason ? String(input.reason) : undefined,
        });
        return {
          status: result.pendingApproval ? 202 : 200,
          body: result,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) return notFound(error.message);
        if (error instanceof Error && error.message.includes('No registry fields')) {
          return badRequest('no_changes', error.message);
        }
        return forbidden(error);
      }
    }
  }

  return undefined;
}
