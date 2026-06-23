import type { EntityId, ISODateTime } from './foundation.js';
import type { SurveillanceAdministrationGovernanceWorkspaceDto } from './surveillanceAdministrationGovernance.js';
import type {
  CameraDeviceDto,
  DeviceAlertDto,
  DeviceGatewayDto,
  DeviceHealthStatusDto,
  DeviceZoneDto,
  FacilityZoneDto,
  IoTDeviceDto,
  RecordingRetentionPolicyDto,
  SensorReadingDto,
  SurveillanceIncidentReferenceDto,
  SurveillanceIoTAuditMetadata,
  SurveillanceIoTDeviceStatus,
  SurveillanceIoTDomainScope,
  SurveillanceIoTHealthBand,
  SurveillanceIoTIntegrationStatus,
  SurveillanceIoTMaintenanceStatus,
  SurveillanceIoTReadinessDto,
  SurveillanceIoTRecordingMode,
  SurveillanceIoTSensorValueType,
  SurveillanceIoTStreamStatus,
  VideoEvidenceReferenceDto,
  VideoStreamDto,
  surveillanceIoTSchemaVersion,
} from './surveillanceIoT.js';
import type { SurveillanceAdapterDescriptor, SurveillanceAdapterSnapshot } from './surveillanceIoTAdapters.js';
import type { SurveillanceIoTAlertingFrameworkWorkspaceDto } from './surveillanceIoTAlertingArchitecture.js';

export const surveillanceIoTArchitectureSchemaVersion = 'trackmind.surveillance-iot-architecture.v1' as const;

export type SurveillanceIoTModuleLayer =
  | 'administration'
  | 'monitoring'
  | 'evidence'
  | 'alerting'
  | 'governance';

export interface SurveillanceIoTRequestScope {
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  actorId: EntityId;
}

/** Layer 1 — device administration: registries and configuration. */
export interface SurveillanceIoTAdminConfigurationDto {
  connectorIds: string[];
  retentionPolicyIds: EntityId[];
  defaultRecordingMode: 'continuous' | 'motion' | 'scheduled' | 'manual' | 'disabled';
  privacyMaskingDefault: boolean;
  webhookIngestEnabled: boolean;
  twinSyncEnabled: boolean;
  approvalRequiredForSensitiveRead: boolean;
}

export interface SurveillanceIoTAdministrationWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  devices: Array<Pick<CameraDeviceDto | IoTDeviceDto, 'id' | 'displayName' | 'kind' | 'status' | 'health' | 'domainScope' | 'assetId'>>;
  cameras: CameraDeviceDto[];
  sensors: IoTDeviceDto[];
  gateways: DeviceGatewayDto[];
  configuration: SurveillanceIoTAdminConfigurationDto;
  adapters: SurveillanceAdapterDescriptor[];
  mock: boolean;
}

/** Layer 2 — operational monitoring: streams, health, readiness. */
export interface SurveillanceIoTMonitoringWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  videoStreams: VideoStreamDto[];
  healthStatuses: DeviceHealthStatusDto[];
  readiness: SurveillanceIoTReadinessDto;
  adapterSnapshot: SurveillanceAdapterSnapshot;
  coverage: {
    cameraCount: number;
    iotDeviceCount: number;
    gatewayCount: number;
    onlinePct: number;
    integrationReadyPct: number;
  };
  mock: boolean;
}

/** Layer 3 — incident / evidence usage. */
export interface SurveillanceIoTEvidenceWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  incidentReferences: SurveillanceIncidentReferenceDto[];
  videoEvidence: VideoEvidenceReferenceDto[];
  retentionPolicies: RecordingRetentionPolicyDto[];
  mock: boolean;
}

/** Layer 4 — analytics / alerting. */
export interface SurveillanceIoTAlertingWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  openAlerts: DeviceAlertDto[];
  recentReadings: SensorReadingDto[];
  alertSummary: {
    open: number;
    critical: number;
    acknowledged: number;
  };
  /** Canonical alerting framework — rules catalog and alert events. */
  framework: SurveillanceIoTAlertingFrameworkWorkspaceDto;
  mock: boolean;
}

/** Facility / zone mapping slice. */
export type SurveillanceOperationalZoneKind =
  | 'racetrack'
  | 'paddock'
  | 'starting-gate'
  | 'barn'
  | 'veterinary'
  | 'restricted'
  | 'public'
  | 'hospitality'
  | 'operations-room'
  | 'track-surface'
  | 'parking-logistics'
  | 'utilities-infrastructure';

export type SurveillanceOperationalZoneSensitivity = 'public' | 'operational' | 'restricted' | 'security-sensitive';

export interface SurveillanceOperationalZoneHealthSummaryDto {
  healthBand: SurveillanceIoTHealthBand;
  cameraCount: number;
  iotDeviceCount: number;
  totalDeviceCount: number;
  onlineCount: number;
  degradedCount: number;
  offlineCount: number;
  openAlertCount: number;
  coveragePct: number;
}

export interface SurveillanceOperationalZoneLinkedDeviceDto {
  deviceId: EntityId;
  deviceKind: 'camera-device' | 'iot-device';
  displayName: string;
  health: SurveillanceIoTHealthBand;
  deviceStatus: SurveillanceIoTDeviceStatus;
  isPrimary: boolean;
}

export interface SurveillanceOperationalZoneDto {
  zoneId: EntityId;
  zoneCode: string;
  zoneLabel: string;
  zoneKind: SurveillanceOperationalZoneKind;
  racetrackId: EntityId;
  facilityId?: EntityId;
  facilityLabel?: string;
  description?: string;
  sensitivity: SurveillanceOperationalZoneSensitivity;
  linkedSecurityZoneId?: EntityId;
  cameraIds: EntityId[];
  iotDeviceIds: EntityId[];
  gatewayIds: EntityId[];
  linkedDeviceZoneIds: EntityId[];
  healthSummary: SurveillanceOperationalZoneHealthSummaryDto;
  linkedDevices: SurveillanceOperationalZoneLinkedDeviceDto[];
  canEdit: boolean;
  mock: boolean;
}

export interface SurveillanceDeviceZoneAssignmentDto {
  deviceId: EntityId;
  deviceKind: 'camera-device' | 'iot-device';
  displayName: string;
  operationalZoneIds: EntityId[];
  primaryZoneId?: EntityId;
  health: SurveillanceIoTHealthBand;
  deviceStatus: SurveillanceIoTDeviceStatus;
}

export interface SurveillanceIoTZoneMappingWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  deviceZones: DeviceZoneDto[];
  facilityZones: FacilityZoneDto[];
  operationalZones: SurveillanceOperationalZoneDto[];
  deviceAssignments: SurveillanceDeviceZoneAssignmentDto[];
  filterOptions: {
    zoneKinds: SurveillanceOperationalZoneKind[];
    sensitivities: SurveillanceOperationalZoneSensitivity[];
    healthBands: SurveillanceIoTHealthBand[];
  };
  mock: boolean;
}

export interface SurveillanceDeviceZoneAssignmentUpdateRequestDto {
  deviceId: EntityId;
  deviceKind: 'camera-device' | 'iot-device';
  operationalZoneIds: EntityId[];
  primaryZoneId?: EntityId;
  reason?: string;
}

export interface SurveillanceDeviceZoneAssignmentMutationResultDto {
  accepted: true;
  deviceId: EntityId;
  updatedAt: ISODateTime;
  auditId: EntityId;
  changes: string[];
  assignment: SurveillanceDeviceZoneAssignmentDto;
  affectedZones: EntityId[];
  approvalRequired?: boolean;
  approvalRequestId?: EntityId;
  pendingApproval?: boolean;
}

/** Layer 5 — audit / governance. */
export interface SurveillanceIoTGovernanceAuditRecordDto {
  auditId: EntityId;
  action: string;
  layer: SurveillanceIoTModuleLayer;
  actorId: EntityId;
  subjectId: EntityId;
  timestamp: ISODateTime;
  evidence: string[];
}

export interface SurveillanceIoTGovernanceWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  auditTrail: SurveillanceIoTGovernanceAuditRecordDto[];
  /** Enriched CCTV/IoT administration audit trail with risk tiers and approval linkage. */
  administrationGovernance?: SurveillanceAdministrationGovernanceWorkspaceDto;
  retentionPolicies: RecordingRetentionPolicyDto[];
  adapterCompliance: Array<{
    adapterId: string;
    connectorId: string;
    contractKind: string;
    contractId: string;
    status: string;
    integrationReadiness: string;
    operationalStatus: string;
    activeIntegrationClaimed: boolean;
    lastSyncAt?: ISODateTime;
  }>;
  mock: boolean;
}

export interface SurveillanceIoTTelemetryIngestResultDto {
  accepted: true;
  readingCount: number;
  deviceId: EntityId;
  adapterId: string;
  auditId: EntityId;
  eventId: EntityId;
  mock: boolean;
}

export interface SurveillanceIoTTelemetryIngestRequestDto {
  adapterId: string;
  externalDeviceId: string;
  readings: Array<{
    metric: string;
    value: number | string | boolean;
    unit?: string;
    observedAt?: ISODateTime;
    quality?: 'good' | 'estimated' | 'bad' | 'missing';
  }>;
}

/** CCTV device registry — enriched camera listing for platform and facility operators. */
export type CctvCameraType = 'fixed' | 'ptz' | 'dome' | 'thermal' | 'lpr' | 'unknown';

export interface CctvCameraIntegrationMetadataDto {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  adapterId?: string;
  connectorId?: string;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  /** Placeholder slot for vendor firmware / integration metadata expansion. */
  metadataPlaceholder: true;
}

export interface CctvCameraRegistryEntryDto {
  cameraId: EntityId;
  displayName: string;
  cameraType: CctvCameraType;
  zoneId?: EntityId;
  zoneLabel?: string;
  facilityId?: EntityId;
  facilityLabel?: string;
  streamStatus: SurveillanceIoTStreamStatus;
  health: SurveillanceIoTHealthBand;
  deviceStatus: SurveillanceIoTDeviceStatus;
  assignedDomain: SurveillanceIoTDomainScope;
  recordingStatus: 'active' | 'paused' | 'disabled' | 'unknown';
  recordingMode: SurveillanceIoTRecordingMode;
  retentionPolicyId?: EntityId;
  retentionPolicyLabel?: string;
  lastSeenAt: ISODateTime;
  integration: CctvCameraIntegrationMetadataDto;
  canEdit: boolean;
  mock: boolean;
  audit: SurveillanceIoTAuditMetadata;
}

export interface CctvCameraRegistryZoneGroupDto {
  zoneId: EntityId;
  zoneLabel: string;
  facilityLabel?: string;
  cameraCount: number;
  onlineCount: number;
  degradedCount: number;
  offlineCount: number;
}

export interface CctvCameraRegistryWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  entries: CctvCameraRegistryEntryDto[];
  zoneGroups: CctvCameraRegistryZoneGroupDto[];
  filterOptions: {
    zones: Array<{ id: EntityId; label: string }>;
    domains: SurveillanceIoTDomainScope[];
    healthBands: SurveillanceIoTHealthBand[];
    streamStatuses: SurveillanceIoTStreamStatus[];
    recordingStatuses: Array<CctvCameraRegistryEntryDto['recordingStatus']>;
  };
  mock: boolean;
}

export interface CctvCameraRegistryUpdateRequestDto {
  displayName?: string;
  assignedDomain?: SurveillanceIoTDomainScope;
  recordingMode?: SurveillanceIoTRecordingMode;
  retentionPolicyId?: EntityId;
  facilityZoneId?: EntityId;
  reason?: string;
}

export interface CctvCameraRegistryMutationResultDto {
  accepted: true;
  cameraId: EntityId;
  updatedAt: ISODateTime;
  auditId: EntityId;
  changes: string[];
  entry: CctvCameraRegistryEntryDto;
  approvalRequired?: boolean;
  approvalRequestId?: EntityId;
  pendingApproval?: boolean;
}

/** CCTV camera detail page — enriched operational view without raw stream playback. */
export interface CctvCameraIdentityDetailDto extends CctvCameraRegistryEntryDto {
  assetId?: EntityId;
  twinId?: EntityId;
  ptzCapable: boolean;
  privacyMaskingEnabled: boolean;
  resolution?: string;
  codec?: string;
  gatewayId?: EntityId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CctvCameraOperationalZoneLinkDto {
  zoneId: EntityId;
  zoneLabel: string;
  zoneKind: SurveillanceOperationalZoneKind;
  isPrimary: boolean;
}

export interface CctvCameraZoneMappingDetailDto {
  deviceZoneId?: EntityId;
  deviceZoneLabel?: string;
  securityZoneId?: EntityId;
  facilityId?: EntityId;
  facilityLabel?: string;
  operationalZones: CctvCameraOperationalZoneLinkDto[];
}

export interface CctvCameraStreamEndpointPlaceholderDto {
  streamId: EntityId;
  label: string;
  protocol: 'rtsp' | 'hls' | 'webrtc' | 'mjpeg' | 'onvif';
  endpointKind: 'primary' | 'substream' | 'archive' | 'snapshot';
  /** Metadata contract placeholder — not a playable URI. */
  endpointUriPlaceholder: string;
  playbackCapable: false;
  streamStatus: SurveillanceIoTStreamStatus;
  recordingActive: boolean;
  metadataPlaceholder: true;
}

export interface CctvCameraRecordingDetailDto {
  recordingStatus: CctvCameraRegistryEntryDto['recordingStatus'];
  recordingMode: SurveillanceIoTRecordingMode;
  recordingActive: boolean;
  storagePathPlaceholder: string;
  lastRecordingHeartbeatAt?: ISODateTime;
}

export interface CctvCameraRetentionDetailDto {
  policyId: EntityId;
  policyName: string;
  retentionDays: number;
  disposition: string;
  legalHoldEligible: boolean;
  privacyMaskingRequired: boolean;
  regulatoryFrameworks: string[];
}

export interface CctvCameraHealthTimelineEntryDto {
  observedAt: ISODateTime;
  healthBand: SurveillanceIoTHealthBand;
  healthScore?: number;
  eventKind: 'heartbeat' | 'integration' | 'stream' | 'recording' | 'alert';
  summary: string;
}

export interface CctvCameraDetailAlertDto {
  alertId: EntityId;
  alertCode: string;
  severity: string;
  alertStatus: string;
  title: string;
  detail: string;
  triggeredAt: ISODateTime;
}

export interface CctvCameraDetailIncidentLinkDto {
  incidentReferenceId: EntityId;
  incidentId: EntityId;
  title: string;
  linkedAt: ISODateTime;
  linkageReason: string;
  operationalImpact: boolean;
}

export interface CctvCameraDetailEvidenceLinkDto {
  evidenceReferenceId: EntityId;
  clipStartAt: ISODateTime;
  clipEndAt: ISODateTime;
  incidentId?: EntityId;
  storageUriPlaceholder: string;
  privacyMasked: boolean;
  legalHold: boolean;
  playbackCapable: false;
  metadataPlaceholder: true;
}

export interface CctvCameraDetailMaintenanceEntryDto {
  maintenanceId: EntityId;
  maintenanceStatus: SurveillanceIoTMaintenanceStatus;
  maintenanceType: string;
  scheduledAt?: ISODateTime;
  completedAt?: ISODateTime;
  performedBy?: EntityId;
  workOrderId?: EntityId;
  notes: string;
}

export interface CctvCameraOperationalDomainAssignmentDto {
  domain: SurveillanceIoTDomainScope;
  isPrimary: boolean;
  label: string;
}

export interface CctvCameraAuditHistoryEntryDto {
  auditId: EntityId;
  action: string;
  layer?: SurveillanceIoTModuleLayer;
  actorId?: EntityId;
  occurredAt: ISODateTime;
  details: string[];
}

export interface CctvCameraDetailWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  cameraId: EntityId;
  identity: CctvCameraIdentityDetailDto;
  zoneMapping: CctvCameraZoneMappingDetailDto;
  streamEndpoints: CctvCameraStreamEndpointPlaceholderDto[];
  recording: CctvCameraRecordingDetailDto;
  retentionPolicy?: CctvCameraRetentionDetailDto;
  healthTimeline: CctvCameraHealthTimelineEntryDto[];
  recentAlerts: CctvCameraDetailAlertDto[];
  linkedIncidents: CctvCameraDetailIncidentLinkDto[];
  linkedEvidence: CctvCameraDetailEvidenceLinkDto[];
  maintenanceHistory: CctvCameraDetailMaintenanceEntryDto[];
  operationalDomains: CctvCameraOperationalDomainAssignmentDto[];
  auditHistory: CctvCameraAuditHistoryEntryDto[];
  canEdit: boolean;
  mock: boolean;
}

/** IoT device registry — non-camera monitored devices (sensors, telemetry, beacons). */
export type IoTRegistryDeviceType =
  | 'environmental'
  | 'gate'
  | 'access'
  | 'stable-barn'
  | 'utilities'
  | 'track-surface'
  | 'equipment-telemetry'
  | 'wearable-beacon'
  | 'unknown';

export type IoTRegistryConnectivityStatus = 'connected' | 'degraded' | 'disconnected' | 'unknown';

export type IoTRegistryAlertState = 'clear' | 'open' | 'acknowledged' | 'critical';

export type IoTRegistryMaintenanceStatus = 'none' | SurveillanceIoTMaintenanceStatus;

export interface IoTDeviceRegistryEntryDto {
  deviceId: EntityId;
  displayName: string;
  deviceType: IoTRegistryDeviceType;
  zoneId?: EntityId;
  zoneLabel?: string;
  facilityId?: EntityId;
  facilityLabel?: string;
  health: SurveillanceIoTHealthBand;
  deviceStatus: SurveillanceIoTDeviceStatus;
  connectivity: IoTRegistryConnectivityStatus;
  latestTelemetryAt: ISODateTime;
  telemetryType: string;
  telemetryValueType: SurveillanceIoTSensorValueType;
  alertState: IoTRegistryAlertState;
  openAlertCount: number;
  assignedWorkflowDomain: SurveillanceIoTDomainScope;
  maintenanceStatus: IoTRegistryMaintenanceStatus;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  gatewayId?: EntityId;
  canEdit: boolean;
  mock: boolean;
  audit: SurveillanceIoTAuditMetadata;
}

export interface IoTDeviceRegistryZoneGroupDto {
  zoneId: EntityId;
  zoneLabel: string;
  facilityLabel?: string;
  deviceCount: number;
  connectedCount: number;
  degradedCount: number;
  disconnectedCount: number;
  alertCount: number;
}

export interface IoTDeviceRegistryWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  entries: IoTDeviceRegistryEntryDto[];
  zoneGroups: IoTDeviceRegistryZoneGroupDto[];
  filterOptions: {
    zones: Array<{ id: EntityId; label: string }>;
    deviceTypes: IoTRegistryDeviceType[];
    domains: SurveillanceIoTDomainScope[];
    healthBands: SurveillanceIoTHealthBand[];
    connectivityStatuses: IoTRegistryConnectivityStatus[];
    alertStates: IoTRegistryAlertState[];
    maintenanceStatuses: IoTRegistryMaintenanceStatus[];
  };
  mock: boolean;
}

export interface IoTDeviceRegistryUpdateRequestDto {
  displayName?: string;
  assignedWorkflowDomain?: SurveillanceIoTDomainScope;
  facilityZoneId?: EntityId;
  reason?: string;
}

export interface IoTDeviceRegistryMutationResultDto {
  accepted: true;
  deviceId: EntityId;
  updatedAt: ISODateTime;
  auditId: EntityId;
  changes: string[];
  entry: IoTDeviceRegistryEntryDto;
  approvalRequired?: boolean;
  approvalRequestId?: EntityId;
  pendingApproval?: boolean;
}

/** Reusable operational category for environmental, facilities, security, and operational IoT devices. */
export type IoTDeviceDetailOperationalCategory = 'environmental' | 'facilities' | 'security' | 'operational';

export interface IoTDeviceIdentityDetailDto extends IoTDeviceRegistryEntryDto {
  sensorType: string;
  assetId?: EntityId;
  twinId?: EntityId;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  gatewayId?: EntityId;
  utilitiesAdapterKind?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface IoTDeviceOperationalZoneLinkDto {
  zoneId: EntityId;
  zoneLabel: string;
  zoneKind: SurveillanceOperationalZoneKind;
  isPrimary: boolean;
}

export interface IoTDeviceZoneMappingDetailDto {
  deviceZoneId?: EntityId;
  deviceZoneLabel?: string;
  securityZoneId?: EntityId;
  facilityId?: EntityId;
  facilityLabel?: string;
  operationalZones: IoTDeviceOperationalZoneLinkDto[];
}

export interface IoTDeviceHealthDetailDto {
  healthBand: SurveillanceIoTHealthBand;
  deviceStatus: SurveillanceIoTDeviceStatus;
  connectivity: IoTRegistryConnectivityStatus;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  healthScore?: number;
  lastHeartbeatAt: ISODateTime;
  diagnostics: Array<{ code: string; message: string; severity: string }>;
}

export interface IoTDeviceLatestTelemetrySnapshotDto {
  snapshotId: EntityId;
  capturedAt: ISODateTime;
  metrics: Array<{ name: string; value: number | string | boolean; unit?: string }>;
  signalStrength?: number;
  batteryPct?: number;
  firmwareVersion?: string;
  quality?: string;
  source: 'telemetry-snapshot' | 'recent-reading';
}

export interface IoTDeviceTelemetryHistoryPlaceholderDto {
  historyEndpointPlaceholder: string;
  windowLabel: string;
  supportedMetrics: string[];
  queryCapable: false;
  metadataPlaceholder: true;
}

export interface IoTDeviceThresholdRuleDto {
  ruleId: EntityId;
  ruleName: string;
  enabled: boolean;
  trigger: string;
  action: string;
  conditionExpression: string;
  lastEvaluatedAt?: ISODateTime;
  approvalRequired: boolean;
}

export interface IoTDeviceDetailAlertDto {
  alertId: EntityId;
  alertCode: string;
  severity: string;
  alertStatus: string;
  title: string;
  detail: string;
  triggeredAt: ISODateTime;
}

export interface IoTDeviceDetailIncidentLinkDto {
  incidentReferenceId: EntityId;
  incidentId: EntityId;
  title: string;
  linkedAt: ISODateTime;
  linkageReason: string;
  operationalImpact: boolean;
}

export interface IoTDeviceDetailMaintenanceEntryDto {
  maintenanceId: EntityId;
  maintenanceStatus: SurveillanceIoTMaintenanceStatus;
  maintenanceType: string;
  scheduledAt?: ISODateTime;
  completedAt?: ISODateTime;
  performedBy?: EntityId;
  workOrderId?: EntityId;
  notes: string;
}

export interface IoTDeviceAuditHistoryEntryDto {
  auditId: EntityId;
  action: string;
  layer?: SurveillanceIoTModuleLayer;
  actorId?: EntityId;
  occurredAt: ISODateTime;
  details: string[];
}

export interface IoTDeviceDetailWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  deviceId: EntityId;
  operationalCategory: IoTDeviceDetailOperationalCategory;
  identity: IoTDeviceIdentityDetailDto;
  zoneMapping: IoTDeviceZoneMappingDetailDto;
  health: IoTDeviceHealthDetailDto;
  lastSeenAt: ISODateTime;
  latestTelemetrySnapshot?: IoTDeviceLatestTelemetrySnapshotDto;
  telemetryHistoryPlaceholder: IoTDeviceTelemetryHistoryPlaceholderDto;
  thresholdsRules: IoTDeviceThresholdRuleDto[];
  activeAlerts: IoTDeviceDetailAlertDto[];
  linkedIncidents: IoTDeviceDetailIncidentLinkDto[];
  maintenanceHistory: IoTDeviceDetailMaintenanceEntryDto[];
  auditHistory: IoTDeviceAuditHistoryEntryDto[];
  canEdit: boolean;
  mock: boolean;
}

/** Surveillance control-plane health monitoring. */
export type SurveillanceHealthOperationalStatus = 'online' | 'degraded' | 'offline';

export type SurveillanceHealthComponentKind =
  | 'video-streams'
  | 'device-connectivity'
  | 'telemetry-ingestion'
  | 'gateway-status'
  | 'alert-pipeline'
  | 'storage-recording'
  | 'rule-engine'
  | 'ai-video-analytics';

export interface SurveillanceHealthLinkedMaintenanceDto {
  maintenanceId: EntityId;
  deviceId?: EntityId;
  maintenanceStatus: SurveillanceIoTMaintenanceStatus;
  maintenanceType?: string;
  scheduledAt?: ISODateTime;
  notes: string;
}

export interface SurveillanceHealthLinkedIncidentDto {
  incidentReferenceId: EntityId;
  incidentId: EntityId;
  title: string;
  linkedAt: ISODateTime;
  operationalImpact: boolean;
}

export interface SurveillanceHealthSubjectDto {
  subjectId: EntityId;
  componentKind: SurveillanceHealthComponentKind;
  displayName: string;
  operationalStatus: SurveillanceHealthOperationalStatus;
  healthBand: SurveillanceIoTHealthBand;
  lastHeartbeatAt: ISODateTime;
  issueReason?: string;
  assignedOwner: string;
  assignedOwnerRole: string;
  linkedMaintenance: SurveillanceHealthLinkedMaintenanceDto[];
  linkedIncidents: SurveillanceHealthLinkedIncidentDto[];
  metadataPlaceholder?: boolean;
}

export interface SurveillanceHealthComponentGroupDto {
  componentKind: SurveillanceHealthComponentKind;
  displayName: string;
  operationalStatus: SurveillanceHealthOperationalStatus;
  healthBand: SurveillanceIoTHealthBand;
  subjectCount: number;
  onlineCount: number;
  degradedCount: number;
  offlineCount: number;
  lastHeartbeatAt: ISODateTime;
  assignedOwner: string;
  subjects: SurveillanceHealthSubjectDto[];
}

export interface SurveillanceHealthWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTArchitectureSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  summary: {
    totalSubjects: number;
    onlineCount: number;
    degradedCount: number;
    offlineCount: number;
    overallHealthBand: SurveillanceIoTHealthBand;
    openAlertCount: number;
    operationalIncidents: number;
  };
  componentGroups: SurveillanceHealthComponentGroupDto[];
  filterOptions: {
    operationalStatuses: SurveillanceHealthOperationalStatus[];
    componentKinds: SurveillanceHealthComponentKind[];
    healthBands: SurveillanceIoTHealthBand[];
  };
  mock: boolean;
}

export const surveillanceIoTArchitectureContractSchemas = {
  SurveillanceIoTAdministrationWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'devices', required: true, type: 'array' },
    { path: 'cameras', required: true, type: 'array' },
    { path: 'sensors', required: true, type: 'array' },
    { path: 'gateways', required: true, type: 'array' },
    { path: 'configuration', required: true, type: 'object' },
    { path: 'adapters', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceIoTMonitoringWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'videoStreams', required: true, type: 'array' },
    { path: 'healthStatuses', required: true, type: 'array' },
    { path: 'readiness', required: true, type: 'object' },
    { path: 'adapterSnapshot', required: true, type: 'object' },
    { path: 'coverage', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceIoTEvidenceWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'incidentReferences', required: true, type: 'array' },
    { path: 'videoEvidence', required: true, type: 'array' },
    { path: 'retentionPolicies', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceIoTAlertingWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'openAlerts', required: true, type: 'array' },
    { path: 'recentReadings', required: true, type: 'array' },
    { path: 'alertSummary', required: true, type: 'object' },
    { path: 'framework', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceIoTZoneMappingWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'deviceZones', required: true, type: 'array' },
    { path: 'facilityZones', required: true, type: 'array' },
    { path: 'operationalZones', required: true, type: 'array' },
    { path: 'deviceAssignments', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceDeviceZoneAssignmentMutationResultDto: [
    { path: 'accepted', required: true, type: 'boolean', values: [true] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'updatedAt', required: true, type: 'string' },
    { path: 'auditId', required: true, type: 'string' },
    { path: 'changes', required: true, type: 'array' },
    { path: 'assignment', required: true, type: 'object' },
    { path: 'affectedZones', required: true, type: 'array' },
  ],
  SurveillanceIoTGovernanceWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'auditTrail', required: true, type: 'array' },
    { path: 'retentionPolicies', required: true, type: 'array' },
    { path: 'adapterCompliance', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  CctvCameraRegistryWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'entries', required: true, type: 'array' },
    { path: 'zoneGroups', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  CctvCameraRegistryMutationResultDto: [
    { path: 'accepted', required: true, type: 'boolean', values: [true] },
    { path: 'cameraId', required: true, type: 'string' },
    { path: 'updatedAt', required: true, type: 'string' },
    { path: 'auditId', required: true, type: 'string' },
    { path: 'changes', required: true, type: 'array' },
    { path: 'entry', required: true, type: 'object' },
  ],
  CctvCameraDetailWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'cameraId', required: true, type: 'string' },
    { path: 'identity', required: true, type: 'object' },
    { path: 'zoneMapping', required: true, type: 'object' },
    { path: 'streamEndpoints', required: true, type: 'array' },
    { path: 'recording', required: true, type: 'object' },
    { path: 'healthTimeline', required: true, type: 'array' },
    { path: 'recentAlerts', required: true, type: 'array' },
    { path: 'linkedIncidents', required: true, type: 'array' },
    { path: 'linkedEvidence', required: true, type: 'array' },
    { path: 'maintenanceHistory', required: true, type: 'array' },
    { path: 'operationalDomains', required: true, type: 'array' },
    { path: 'auditHistory', required: true, type: 'array' },
    { path: 'canEdit', required: true, type: 'boolean' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  IoTDeviceRegistryWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'entries', required: true, type: 'array' },
    { path: 'zoneGroups', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  IoTDeviceRegistryMutationResultDto: [
    { path: 'accepted', required: true, type: 'boolean', values: [true] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'updatedAt', required: true, type: 'string' },
    { path: 'auditId', required: true, type: 'string' },
    { path: 'changes', required: true, type: 'array' },
    { path: 'entry', required: true, type: 'object' },
  ],
  IoTDeviceDetailWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'operationalCategory', required: true, type: 'string' },
    { path: 'identity', required: true, type: 'object' },
    { path: 'zoneMapping', required: true, type: 'object' },
    { path: 'health', required: true, type: 'object' },
    { path: 'lastSeenAt', required: true, type: 'string' },
    { path: 'telemetryHistoryPlaceholder', required: true, type: 'object' },
    { path: 'thresholdsRules', required: true, type: 'array' },
    { path: 'activeAlerts', required: true, type: 'array' },
    { path: 'linkedIncidents', required: true, type: 'array' },
    { path: 'maintenanceHistory', required: true, type: 'array' },
    { path: 'auditHistory', required: true, type: 'array' },
    { path: 'canEdit', required: true, type: 'boolean' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceHealthWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTArchitectureSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'componentGroups', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceIoTTelemetryIngestResultDto: [
    { path: 'accepted', required: true, type: 'boolean', values: [true] },
    { path: 'readingCount', required: true, type: 'number', min: 0 },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'adapterId', required: true, type: 'string' },
    { path: 'auditId', required: true, type: 'string' },
    { path: 'eventId', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
