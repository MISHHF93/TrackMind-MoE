import type { SurveillanceIoTTelemetryIngestRequestDto, CctvCameraRegistryUpdateRequestDto, IoTDeviceRegistryUpdateRequestDto, SurveillanceDeviceZoneAssignmentUpdateRequestDto, SurveillanceDeviceCreationRequestDto, SurveillanceRetentionPolicyChangeRequestDto, SurveillanceAlertRuleChangeRequestDto, SurveillanceHealthOverrideRequestDto, SurveillanceMaintenanceStatusChangeRequestDto, SurveillanceEvidenceLinkRequestDto, SurveillancePrivilegedConfigAccessRequestDto, MediaExportRequestDto, MediaShareLinkRequestDto, MediaSnapshotRequestDto } from '@trackmind/shared';
import { normalizeRole, type Role } from '@trackmind/shared';
import type { SecurityActor, SecurityOperationsService } from '../securityOps.js';
import {
  AdminConfigurationService,
  CameraRegistryService,
  DeviceRegistryService,
  SensorRegistryService,
} from './administration/administrationServices.js';
import { CctvCameraRegistryService } from './administration/cctvCameraRegistryService.js';
import { CctvCameraDetailService } from './administration/cctvCameraDetailService.js';
import { IoTDeviceRegistryService } from './administration/iotDeviceRegistryService.js';
import { IoTDeviceDetailService } from './administration/iotDeviceDetailService.js';
import { AlertingService } from './alerting/alertingService.js';
import { createSurveillanceAdapterRegistry } from './adapters/surveillanceAdapterRegistry.js';
import { AuditGovernanceService } from './governance/auditGovernanceService.js';
import { SurveillanceAdministrationGovernanceService } from './governance/surveillanceAdministrationGovernanceService.js';
import { EvidenceLinkageService } from './evidence/evidenceLinkageService.js';
import { TelemetryIngestionService } from './ingestion/telemetryIngestionService.js';
import { SurveillanceVendorIntegrationService } from './integration/surveillanceVendorIntegrationService.js';
import { FacilityZoneMappingService } from './mapping/facilityZoneMappingService.js';
import { CctvViewerService } from './viewer/cctvViewerService.js';
import { MediaViewerService, type ExternalMediaClipSource } from './viewer/mediaViewerService.js';
import { MediaOutputService, assertLiveCameraRef, assertRecordedRef } from './viewer/mediaOutputService.js';
import { SurveillanceIoTKpiService } from './kpi/surveillanceIoTKpiService.js';
import { OperationalMonitoringService, StreamHealthService, SurveillanceHealthService } from './monitoring/monitoringServices.js';
import { createSurveillanceIoTProjectionService, SurveillanceIoTProjectionService } from './projection/surveillanceIoTProjectionService.js';
import { defaultSurveillanceIoTScope, resolveScope, type SurveillanceIoTModuleContext, type SurveillanceIoTScope } from './types.js';
import type { SurveillanceAdapterRegistry } from '@trackmind/shared';

export interface SurveillanceIoTModuleOptions {
  securityOps: SecurityOperationsService;
  clock?: () => string;
  scope?: SurveillanceIoTScope;
  adapterRegistry?: SurveillanceAdapterRegistry;
  externalClipProvider?: () => ExternalMediaClipSource[];
}

export class SurveillanceIoTModule {
  readonly projection: SurveillanceIoTProjectionService;
  readonly adapterRegistry: SurveillanceAdapterRegistry;

  private readonly clock: () => string;
  private readonly baseScope: SurveillanceIoTScope;

  private readonly deviceRegistry = new DeviceRegistryService();
  private readonly cameraRegistry = new CameraRegistryService();
  private readonly sensorRegistry = new SensorRegistryService();
  private readonly adminConfiguration = new AdminConfigurationService();
  private readonly streamHealth = new StreamHealthService();
  private readonly surveillanceHealth = new SurveillanceHealthService();
  private readonly operationalMonitoring = new OperationalMonitoringService();
  private readonly telemetryIngestion = new TelemetryIngestionService();
  private readonly alerting = new AlertingService();
  private readonly evidenceLinkage = new EvidenceLinkageService();
  private readonly zoneMapping = new FacilityZoneMappingService();
  private readonly governance = new AuditGovernanceService();
  private readonly adminGovernance = new SurveillanceAdministrationGovernanceService();
  private readonly cctvCameraRegistry = new CctvCameraRegistryService();
  private readonly cctvCameraDetail = new CctvCameraDetailService();
  private readonly iotDeviceRegistry = new IoTDeviceRegistryService();
  private readonly iotDeviceDetail = new IoTDeviceDetailService();
  private readonly kpi = new SurveillanceIoTKpiService();
  private readonly cctvViewer = new CctvViewerService();
  private readonly mediaViewer = new MediaViewerService();
  private readonly mediaOutput = new MediaOutputService();
  private readonly vendorIntegration = new SurveillanceVendorIntegrationService();
  private externalClipProvider?: () => ExternalMediaClipSource[];

  constructor(options: SurveillanceIoTModuleOptions) {
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.baseScope = options.scope ?? defaultSurveillanceIoTScope();
    this.adapterRegistry = options.adapterRegistry ?? createSurveillanceAdapterRegistry({ seedAt: this.clock() });
    this.externalClipProvider = options.externalClipProvider;
    this.projection = createSurveillanceIoTProjectionService(options.securityOps, this.clock, this.baseScope);
  }

  configureExternalClipProvider(provider: () => ExternalMediaClipSource[]): void {
    this.externalClipProvider = provider;
  }

  private externalClips(): ExternalMediaClipSource[] {
    return this.externalClipProvider?.() ?? [];
  }

  private context(actor: SecurityActor): SurveillanceIoTModuleContext {
    return {
      scope: resolveScope(this.baseScope, actor),
      actor,
      now: this.clock(),
    };
  }

  buildWorkspace(actor: SecurityActor) {
    const workspace = this.projection.buildWorkspace(actor);
    this.governance.record(this.context(actor), 'monitoring', 'surveillance.workspace.read', 'workspace', ['layer:aggregate']);
    return workspace;
  }

  getReadiness(actor: SecurityActor) {
    return this.projection.getReadiness(actor);
  }

  getAdministrationWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.adminConfiguration.buildAdministrationWorkspace(
      ctx,
      workspace,
      this.adapterRegistry,
      this.deviceRegistry,
      this.cameraRegistry,
      this.sensorRegistry,
    );
    this.governance.record(ctx, 'administration', 'surveillance.administration.read', 'administration', ['layer:administration']);
    return result;
  }

  getMonitoringWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.operationalMonitoring.buildMonitoringWorkspace(ctx, workspace, this.adapterRegistry, this.streamHealth);
    this.governance.record(ctx, 'monitoring', 'surveillance.monitoring.read', 'monitoring', ['layer:monitoring']);
    return result;
  }

  getEvidenceWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.evidenceLinkage.buildEvidenceWorkspace(ctx, workspace, this.adapterRegistry);
    this.governance.record(ctx, 'evidence', 'surveillance.evidence.read', 'evidence', ['layer:evidence']);
    return result;
  }

  getAlertingWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.alerting.buildAlertingWorkspace(ctx, workspace, this.telemetryIngestion, this.governance);
    this.governance.record(ctx, 'alerting', 'surveillance.alerting.read', 'alerting', ['layer:alerting']);
    return result;
  }

  getZoneMappingWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.zoneMapping.buildZoneMappingWorkspace(ctx, workspace, actor);
    this.governance.record(ctx, 'administration', 'surveillance.mapping.read', 'zone-mapping', [`zones:${result.operationalZones.length}`]);
    return result;
  }

  getOperationalZone(actor: SecurityActor, zoneId: string) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const zone = this.zoneMapping.getOperationalZone(ctx, workspace, zoneId, actor);
    if (!zone) throw new Error(`Operational zone ${zoneId} not found.`);
    this.governance.record(ctx, 'administration', 'surveillance.mapping.read', zoneId, ['detail']);
    return zone;
  }

  updateDeviceZoneAssignment(actor: SecurityActor, deviceId: string, update: SurveillanceDeviceZoneAssignmentUpdateRequestDto) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    return this.zoneMapping.updateDeviceZoneAssignment(ctx, workspace, deviceId, update, actor, this.governance, this.adminGovernance);
  }

  getGovernanceWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    this.adminGovernance.seedDemonstrationRecords(ctx, this.governance);
    const base = this.governance.buildGovernanceWorkspace(ctx, workspace, this.adapterRegistry);
    return {
      ...base,
      administrationGovernance: this.adminGovernance.buildWorkspace(ctx),
    };
  }

  getAdministrationGovernanceWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    this.adminGovernance.seedDemonstrationRecords(ctx, this.governance);
    this.governance.record(ctx, 'administration', 'surveillance.administration-governance.read', 'administration-governance', ['layer:governance']);
    return this.adminGovernance.buildWorkspace(ctx);
  }

  createAdministrationDevice(actor: SecurityActor, request: SurveillanceDeviceCreationRequestDto) {
    const ctx = this.context(actor);
    return this.adminGovernance.createDevice(ctx, this.governance, request);
  }

  requestRetentionPolicyChange(actor: SecurityActor, policyId: string, request: SurveillanceRetentionPolicyChangeRequestDto) {
    const ctx = this.context(actor);
    return this.adminGovernance.requestRetentionPolicyChange(ctx, this.governance, policyId, request);
  }

  requestAlertRuleChange(actor: SecurityActor, ruleId: string, request: SurveillanceAlertRuleChangeRequestDto) {
    const ctx = this.context(actor);
    return this.adminGovernance.requestAlertRuleChange(ctx, this.governance, ruleId, request);
  }

  applyHealthOverride(actor: SecurityActor, deviceId: string, request: SurveillanceHealthOverrideRequestDto) {
    const ctx = this.context(actor);
    return this.adminGovernance.applyHealthOverride(ctx, this.governance, deviceId, request);
  }

  changeMaintenanceStatus(actor: SecurityActor, deviceId: string, request: SurveillanceMaintenanceStatusChangeRequestDto) {
    const ctx = this.context(actor);
    return this.adminGovernance.changeMaintenanceStatus(ctx, this.governance, deviceId, request);
  }

  linkEvidence(actor: SecurityActor, request: SurveillanceEvidenceLinkRequestDto) {
    const ctx = this.context(actor);
    return this.adminGovernance.linkEvidence(ctx, this.governance, request);
  }

  recordPrivilegedConfigAccess(actor: SecurityActor, request: SurveillancePrivilegedConfigAccessRequestDto) {
    const ctx = this.context(actor);
    return this.adminGovernance.recordPrivilegedConfigAccess(ctx, this.governance, request);
  }

  decideAdministrationApproval(actor: SecurityActor, approvalRequestId: string, decision: 'approved' | 'rejected', reason: string) {
    const ctx = this.context(actor);
    const roles = (actor.roles ?? [])
      .map((role) => normalizeRole(role))
      .filter((role): role is Role => role !== undefined);
    return this.adminGovernance.decideApproval(ctx, this.governance, approvalRequestId, decision, reason, roles);
  }

  ingestTelemetry(actor: SecurityActor, payload: SurveillanceIoTTelemetryIngestRequestDto) {
    const ctx = this.context(actor);
    const result = this.telemetryIngestion.ingest(ctx, this.adapterRegistry, payload);
    this.governance.record(ctx, 'monitoring', 'surveillance.telemetry.ingested', payload.externalDeviceId, [`adapter:${payload.adapterId}`, `readings:${result.readingCount}`]);
    return result;
  }

  getCameraRegistry(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.cctvCameraRegistry.buildRegistry(ctx, workspace, actor);
    this.governance.record(ctx, 'administration', 'surveillance.camera-registry.read', 'registry', [`cameras:${result.entries.length}`]);
    return result;
  }

  getCameraRegistryEntry(actor: SecurityActor, cameraId: string) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const entry = this.cctvCameraRegistry.getEntry(ctx, workspace, cameraId, actor);
    if (!entry) throw new Error(`Camera ${cameraId} not found.`);
    this.governance.record(ctx, 'administration', 'surveillance.camera-registry.read', cameraId, ['detail']);
    return entry;
  }

  getCameraDetailWorkspace(actor: SecurityActor, cameraId: string) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.cctvCameraDetail.buildDetailWorkspace(
      ctx,
      workspace,
      cameraId,
      actor,
      this.cctvCameraRegistry,
      this.zoneMapping,
      this.governance,
    );
    if (!result) throw new Error(`Camera ${cameraId} not found.`);
    this.governance.record(ctx, 'administration', 'surveillance.camera-detail.read', cameraId, ['detail-workspace']);
    return result;
  }

  updateCameraRegistryEntry(actor: SecurityActor, cameraId: string, update: CctvCameraRegistryUpdateRequestDto) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    return this.cctvCameraRegistry.updateEntry(ctx, workspace, cameraId, update, actor, this.governance, this.adminGovernance);
  }

  getIoTDeviceRegistry(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.iotDeviceRegistry.buildRegistry(ctx, workspace, actor);
    this.governance.record(ctx, 'administration', 'surveillance.device-registry.read', 'registry', [`devices:${result.entries.length}`]);
    return result;
  }

  getIoTDeviceRegistryEntry(actor: SecurityActor, deviceId: string) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const entry = this.iotDeviceRegistry.getEntry(ctx, workspace, deviceId, actor);
    if (!entry) throw new Error(`Device ${deviceId} not found.`);
    this.governance.record(ctx, 'administration', 'surveillance.device-registry.read', deviceId, ['detail']);
    return entry;
  }

  getIoTDeviceDetailWorkspace(actor: SecurityActor, deviceId: string) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.iotDeviceDetail.buildDetailWorkspace(
      ctx,
      workspace,
      deviceId,
      actor,
      this.iotDeviceRegistry,
      this.zoneMapping,
      this.governance,
    );
    if (!result) throw new Error(`Device ${deviceId} not found.`);
    this.governance.record(ctx, 'administration', 'surveillance.device-detail.read', deviceId, ['detail-workspace']);
    return result;
  }

  updateIoTDeviceRegistryEntry(actor: SecurityActor, deviceId: string, update: IoTDeviceRegistryUpdateRequestDto) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    return this.iotDeviceRegistry.updateEntry(ctx, workspace, deviceId, update, actor, this.governance, this.adminGovernance);
  }

  getSurveillanceHealthWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.surveillanceHealth.buildHealthWorkspace(ctx, workspace, this.adapterRegistry);
    this.governance.record(ctx, 'monitoring', 'surveillance.health.read', 'health-workspace', [`subjects:${result.summary.totalSubjects}`]);
    return result;
  }

  getKpiPack(actor: SecurityActor) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const zoneMapping = this.zoneMapping.buildZoneMappingWorkspace(ctx, workspace, actor);
    const result = this.kpi.computeFromWorkspace(ctx, workspace, zoneMapping);
    this.governance.record(ctx, 'monitoring', 'surveillance-iot.kpi.read', 'kpi-pack', [`kpis:${result.kpis.length}`]);
    return result;
  }

  getVendorIntegrationWorkspace(actor: SecurityActor) {
    const ctx = this.context(actor);
    const result = this.vendorIntegration.buildWorkspace(ctx);
    this.governance.record(ctx, 'governance', 'surveillance-vendor.integration.read', 'vendor-integration-contracts', [`contracts:${result.contracts.length}`]);
    return result;
  }

  getCctvViewerWorkspace(actor: SecurityActor, focusedCameraId?: string, activeRef?: string) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const result = this.mediaViewer.buildWorkspace(ctx, workspace, this.adapterRegistry, {
      focusedCameraId,
      activeRef,
      externalClips: this.externalClips(),
    });
    this.governance.record(ctx, 'monitoring', 'surveillance.viewer.read', 'media-viewer', [
      `tiles:${result.tiles.length}`,
      `clips:${result.clips.length}`,
    ]);
    return result;
  }

  getMediaViewerPlayback(actor: SecurityActor, ref: string) {
    const ctx = this.context(actor);
    const workspace = this.projection.buildWorkspace(actor);
    const descriptor = this.mediaViewer.resolvePlayback(ctx, workspace, this.adapterRegistry, ref, this.externalClips());
    if (!descriptor) throw new Error(`Unknown media reference: ${ref}`);
    this.governance.record(ctx, 'evidence', 'surveillance.playback.read', ref, [`kind:${descriptor.ref.kind}`]);
    return descriptor;
  }

  createMediaSnapshot(actor: SecurityActor, input: MediaSnapshotRequestDto) {
    const ctx = this.context(actor);
    assertLiveCameraRef(input.ref);
    const result = this.mediaOutput.createSnapshot(ctx.now, input);
    this.governance.record(ctx, 'monitoring', 'surveillance.media.snapshot', input.ref.id, [`job:${result.jobId}`]);
    return result;
  }

  createMediaExport(actor: SecurityActor, input: MediaExportRequestDto) {
    const ctx = this.context(actor);
    assertRecordedRef(input.ref);
    const result = this.mediaOutput.createExport(ctx.now, input);
    this.governance.record(ctx, 'evidence', 'surveillance.media.export', input.ref.id, [`job:${result.jobId}`]);
    return result;
  }

  createMediaShareLink(actor: SecurityActor, input: MediaShareLinkRequestDto) {
    const ctx = this.context(actor);
    assertRecordedRef(input.ref);
    const result = this.mediaOutput.createShareLink(ctx.now, input);
    this.governance.record(ctx, 'evidence', 'surveillance.media.share', input.ref.id, [`expires:${result.expiresAt}`]);
    return result;
  }
}

export function createSurveillanceIoTModule(options: SurveillanceIoTModuleOptions): SurveillanceIoTModule {
  return new SurveillanceIoTModule(options);
}

/** @deprecated Use SurveillanceIoTModule.projection — retained for backward compatibility. */
export { SurveillanceIoTProjectionService, createSurveillanceIoTProjectionService } from './projection/surveillanceIoTProjectionService.js';
