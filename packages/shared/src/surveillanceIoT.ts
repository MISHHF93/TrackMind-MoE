import type { AuditMetadata } from './domainKernel.js';
import type { EntityId, ISODateTime } from './foundation.js';

export const surveillanceIoTSchemaVersion = 'trackmind.surveillance-iot.v1' as const;

/** Canonical entity kinds for the surveillance / IoT domain layer. */
export type SurveillanceIoTEntityKind =
  | 'camera-device'
  | 'iot-device'
  | 'device-gateway'
  | 'device-zone'
  | 'facility-zone'
  | 'video-stream'
  | 'sensor-reading'
  | 'device-health-status'
  | 'recording-retention-policy'
  | 'device-alert'
  | 'surveillance-incident-reference'
  | 'video-evidence-reference'
  | 'device-rule'
  | 'device-telemetry-snapshot'
  | 'camera-preset'
  | 'device-assignment'
  | 'device-maintenance-record';

/** Operational domain scope — maps devices to Security SOC vs Facilities IoT RBAC without duplicating models. */
export type SurveillanceIoTDomainScope = 'security-soc' | 'facilities-iot' | 'operations' | 'shared';

export type SurveillanceIoTDeviceStatus =
  | 'registered'
  | 'online'
  | 'offline'
  | 'standby'
  | 'degraded'
  | 'maintenance'
  | 'retired';

export type SurveillanceIoTHealthBand = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type SurveillanceIoTIntegrationStatus = 'ready' | 'watch' | 'blocked' | 'unconfigured';

export type SurveillanceIoTAlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SurveillanceIoTAlertStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed';

export type SurveillanceIoTStreamStatus = 'live' | 'buffering' | 'offline' | 'archived';

export type SurveillanceIoTRecordingMode = 'continuous' | 'motion' | 'scheduled' | 'manual' | 'disabled';

export type SurveillanceIoTRetentionDisposition = 'retain' | 'archive' | 'purge' | 'legal-hold';

export type SurveillanceIoTDeviceCategory = 'camera' | 'sensor' | 'actuator' | 'gateway' | 'controller' | 'reader';

export type SurveillanceIoTSensorValueType = 'numeric' | 'boolean' | 'string' | 'enum' | 'geo' | 'json';

export type SurveillanceIoTMaintenanceStatus = 'scheduled' | 'in-progress' | 'completed' | 'deferred' | 'cancelled';

export type SurveillanceIoTRuleTrigger = 'threshold' | 'schedule' | 'event' | 'anomaly' | 'manual';

export type SurveillanceIoTRuleAction = 'alert' | 'record' | 'notify' | 'webhook' | 'workflow' | 'preset';

/** Tenancy scope shared by all surveillance / IoT entities. */
export interface SurveillanceIoTTenantScope {
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
}

/** Facility and zone linkage shared across device fleet models. */
export interface SurveillanceIoTFacilityZoneLinkage {
  facilityZoneId?: EntityId;
  deviceZoneId?: EntityId;
  sectorId?: EntityId;
  /** Optional link to security restricted zone without duplicating zone models. */
  securityZoneId?: EntityId;
}

/** Audit metadata for surveillance / IoT entities — aligns with domain kernel AuditMetadata. */
export interface SurveillanceIoTAuditMetadata extends Pick<AuditMetadata, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'correlationId'> {
  auditId: EntityId;
  eventId: EntityId;
}

/** Common fields required on every canonical surveillance / IoT entity. */
export interface SurveillanceIoTEntityBase extends SurveillanceIoTTenantScope, SurveillanceIoTFacilityZoneLinkage {
  id: EntityId;
  displayName: string;
  status: SurveillanceIoTDeviceStatus;
  health: SurveillanceIoTHealthBand;
  lastSeenAt: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  audit: SurveillanceIoTAuditMetadata;
  /** RACR / domain-kernel asset reference — single source of truth for registered hardware. */
  assetId?: EntityId;
  registryAssetId?: EntityId;
  twinId?: string;
  domainScope: SurveillanceIoTDomainScope;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** API wire base — extends entity base with contract envelope fields. */
export interface SurveillanceIoTDtoBase extends SurveillanceIoTEntityBase {
  mock: boolean;
}

// ---------------------------------------------------------------------------
// Canonical entity interfaces
// ---------------------------------------------------------------------------

export interface CameraDevice extends SurveillanceIoTEntityBase {
  kind: 'camera-device';
  deviceCategory: 'camera';
  facilityId?: EntityId;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  gatewayId?: EntityId;
  streamIds: EntityId[];
  presetIds: EntityId[];
  recordingMode: SurveillanceIoTRecordingMode;
  retentionPolicyId?: EntityId;
  privacyMaskingEnabled: boolean;
  ptzCapable: boolean;
  resolution?: string;
  codec?: string;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  webhookConfigured: boolean;
  twinLinked: boolean;
}

export interface IoTDevice extends SurveillanceIoTEntityBase {
  kind: 'iot-device';
  deviceCategory: Exclude<SurveillanceIoTDeviceCategory, 'camera' | 'gateway'>;
  facilityId?: EntityId;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  gatewayId?: EntityId;
  sensorType: string;
  unit?: string;
  valueType: SurveillanceIoTSensorValueType;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  telemetryBindingIds: string[];
  utilitiesAdapterKind?: string;
}

export interface DeviceGateway extends SurveillanceIoTEntityBase {
  kind: 'device-gateway';
  deviceCategory: 'gateway';
  vendor: string;
  protocol: 'mqtt' | 'opc-ua' | 'modbus' | 'rest' | 'rtsp-bridge' | 'proprietary';
  connectorId?: string;
  connectedDeviceIds: EntityId[];
  firmwareVersion?: string;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  maxDeviceCapacity?: number;
}

export interface DeviceZone extends SurveillanceIoTEntityBase {
  kind: 'device-zone';
  zoneCode: string;
  zoneType: 'surveillance' | 'telemetry' | 'mixed' | 'restricted-overlay';
  deviceIds: EntityId[];
  cameraIds: EntityId[];
  sensorIds: EntityId[];
  gatewayIds: EntityId[];
  coverageDescription?: string;
}

export interface FacilityZone extends SurveillanceIoTEntityBase {
  kind: 'facility-zone';
  facilityId: EntityId;
  facilityZoneId?: EntityId;
  zoneCode: string;
  zoneLabel: string;
  floorLevel?: string;
  deviceZoneIds: EntityId[];
  assignedDeviceIds: EntityId[];
  occupancyCap?: number;
}

export interface VideoStream extends SurveillanceIoTEntityBase {
  kind: 'video-stream';
  cameraId: EntityId;
  streamUrl?: string;
  streamStatus: SurveillanceIoTStreamStatus;
  protocol: 'rtsp' | 'hls' | 'webrtc' | 'mjpeg' | 'onvif';
  bitrateKbps?: number;
  frameRate?: number;
  recordingActive: boolean;
  retentionPolicyId?: EntityId;
}

export interface SensorReading extends SurveillanceIoTEntityBase {
  kind: 'sensor-reading';
  deviceId: EntityId;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  valueType: SurveillanceIoTSensorValueType;
  observedAt: ISODateTime;
  quality: 'good' | 'estimated' | 'bad' | 'missing';
  evidence: string[];
}

export interface DeviceHealthStatus extends SurveillanceIoTEntityBase {
  kind: 'device-health-status';
  deviceId: EntityId;
  deviceKind: SurveillanceIoTEntityKind;
  healthScore: number;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  lastHeartbeatAt: ISODateTime;
  webhookConfigured: boolean;
  twinLinked: boolean;
  diagnostics: Array<{ code: string; message: string; severity: SurveillanceIoTAlertSeverity }>;
}

export interface RecordingRetentionPolicy extends SurveillanceIoTEntityBase {
  kind: 'recording-retention-policy';
  policyName: string;
  retentionDays: number;
  disposition: SurveillanceIoTRetentionDisposition;
  appliesToDeviceIds: EntityId[];
  appliesToCameraIds: EntityId[];
  legalHoldEligible: boolean;
  privacyMaskingRequired: boolean;
  regulatoryFrameworks: string[];
}

export interface DeviceAlert extends SurveillanceIoTEntityBase {
  kind: 'device-alert';
  deviceId: EntityId;
  alertCode: string;
  severity: SurveillanceIoTAlertSeverity;
  alertStatus: SurveillanceIoTAlertStatus;
  title: string;
  detail: string;
  triggeredAt: ISODateTime;
  acknowledgedAt?: ISODateTime;
  resolvedAt?: ISODateTime;
  evidence: string[];
  incidentReferenceId?: EntityId;
}

export interface SurveillanceIncidentReference extends SurveillanceIoTEntityBase {
  kind: 'surveillance-incident-reference';
  incidentId: EntityId;
  deviceId?: EntityId;
  cameraId?: EntityId;
  zoneId?: EntityId;
  linkedAt: ISODateTime;
  linkageReason: string;
  evidencePackageIds: string[];
}

export interface VideoEvidenceReference extends SurveillanceIoTEntityBase {
  kind: 'video-evidence-reference';
  cameraId: EntityId;
  streamId?: EntityId;
  incidentId?: EntityId;
  clipStartAt: ISODateTime;
  clipEndAt: ISODateTime;
  storageUri?: string;
  checksum?: string;
  privacyMasked: boolean;
  retentionPolicyId?: EntityId;
  legalHold: boolean;
}

export interface DeviceRule extends SurveillanceIoTEntityBase {
  kind: 'device-rule';
  ruleName: string;
  enabled: boolean;
  trigger: SurveillanceIoTRuleTrigger;
  action: SurveillanceIoTRuleAction;
  targetDeviceIds: EntityId[];
  targetZoneIds: EntityId[];
  conditionExpression: string;
  approvalRequired: boolean;
  lastEvaluatedAt?: ISODateTime;
}

export interface DeviceTelemetrySnapshot extends SurveillanceIoTEntityBase {
  kind: 'device-telemetry-snapshot';
  deviceId: EntityId;
  gatewayId?: EntityId;
  capturedAt: ISODateTime;
  metrics: Array<{ name: string; value: number | string | boolean; unit?: string }>;
  signalStrength?: number;
  batteryPct?: number;
  firmwareVersion?: string;
}

export interface CameraPreset extends SurveillanceIoTEntityBase {
  kind: 'camera-preset';
  cameraId: EntityId;
  presetNumber: number;
  presetLabel: string;
  pan?: number;
  tilt?: number;
  zoom?: number;
  isHome: boolean;
}

export interface DeviceAssignment extends SurveillanceIoTEntityBase {
  kind: 'device-assignment';
  deviceId: EntityId;
  assignmentType: 'zone' | 'facility' | 'sector' | 'operator' | 'incident';
  assignedToId: EntityId;
  assignedToKind: string;
  effectiveFrom: ISODateTime;
  effectiveTo?: ISODateTime;
  assignedBy: EntityId;
}

export interface DeviceMaintenanceRecord extends SurveillanceIoTEntityBase {
  kind: 'device-maintenance-record';
  deviceId: EntityId;
  maintenanceStatus: SurveillanceIoTMaintenanceStatus;
  maintenanceType: 'inspection' | 'repair' | 'calibration' | 'firmware' | 'replacement' | 'cleaning';
  scheduledAt?: ISODateTime;
  completedAt?: ISODateTime;
  performedBy?: EntityId;
  workOrderId?: EntityId;
  notes: string;
  evidence: string[];
}

export type SurveillanceIoTEntity =
  | CameraDevice
  | IoTDevice
  | DeviceGateway
  | DeviceZone
  | FacilityZone
  | VideoStream
  | SensorReading
  | DeviceHealthStatus
  | RecordingRetentionPolicy
  | DeviceAlert
  | SurveillanceIncidentReference
  | VideoEvidenceReference
  | DeviceRule
  | DeviceTelemetrySnapshot
  | CameraPreset
  | DeviceAssignment
  | DeviceMaintenanceRecord;

// ---------------------------------------------------------------------------
// API wire DTOs (backend contracts + frontend types)
// ---------------------------------------------------------------------------

export interface CameraDeviceDto extends CameraDevice, SurveillanceIoTDtoBase {}

export interface IoTDeviceDto extends IoTDevice, SurveillanceIoTDtoBase {}

export interface DeviceGatewayDto extends DeviceGateway, SurveillanceIoTDtoBase {}

export interface DeviceZoneDto extends DeviceZone, SurveillanceIoTDtoBase {}

export interface FacilityZoneDto extends FacilityZone, SurveillanceIoTDtoBase {}

export interface VideoStreamDto extends VideoStream, SurveillanceIoTDtoBase {}

export interface SensorReadingDto extends SensorReading, SurveillanceIoTDtoBase {}

export interface DeviceHealthStatusDto extends DeviceHealthStatus, SurveillanceIoTDtoBase {}

export interface RecordingRetentionPolicyDto extends RecordingRetentionPolicy, SurveillanceIoTDtoBase {}

export interface DeviceAlertDto extends DeviceAlert, SurveillanceIoTDtoBase {}

export interface SurveillanceIncidentReferenceDto extends SurveillanceIncidentReference, SurveillanceIoTDtoBase {}

export interface VideoEvidenceReferenceDto extends VideoEvidenceReference, SurveillanceIoTDtoBase {}

export interface DeviceRuleDto extends DeviceRule, SurveillanceIoTDtoBase {}

export interface DeviceTelemetrySnapshotDto extends DeviceTelemetrySnapshot, SurveillanceIoTDtoBase {}

export interface CameraPresetDto extends CameraPreset, SurveillanceIoTDtoBase {}

export interface DeviceAssignmentDto extends DeviceAssignment, SurveillanceIoTDtoBase {}

export interface DeviceMaintenanceRecordDto extends DeviceMaintenanceRecord, SurveillanceIoTDtoBase {}

/** Consolidated readiness projection — canonical replacement for inline SecurityIntegrationReadinessDto items. */
export interface SurveillanceIoTReadinessItemDto {
  deviceId: EntityId;
  deviceKind: SurveillanceIoTEntityKind;
  label: string;
  zoneId: EntityId;
  health: SurveillanceIoTHealthBand;
  integrationStatus: SurveillanceIoTIntegrationStatus;
  lastHeartbeatAt: ISODateTime;
  webhookConfigured: boolean;
  twinLinked: boolean;
}

export interface SurveillanceIoTReadinessDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  score: number;
  ready: number;
  watch: number;
  blocked: number;
  cameras: SurveillanceIoTReadinessItemDto[];
  sensors: SurveillanceIoTReadinessItemDto[];
  gateways: SurveillanceIoTReadinessItemDto[];
  mock: boolean;
}

export interface SurveillanceIoTWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  cameras: CameraDeviceDto[];
  iotDevices: IoTDeviceDto[];
  gateways: DeviceGatewayDto[];
  deviceZones: DeviceZoneDto[];
  facilityZones: FacilityZoneDto[];
  videoStreams: VideoStreamDto[];
  recentReadings: SensorReadingDto[];
  healthStatuses: DeviceHealthStatusDto[];
  retentionPolicies: RecordingRetentionPolicyDto[];
  openAlerts: DeviceAlertDto[];
  incidentReferences: SurveillanceIncidentReferenceDto[];
  videoEvidence: VideoEvidenceReferenceDto[];
  rules: DeviceRuleDto[];
  telemetrySnapshots: DeviceTelemetrySnapshotDto[];
  cameraPresets: CameraPresetDto[];
  assignments: DeviceAssignmentDto[];
  maintenanceRecords: DeviceMaintenanceRecordDto[];
  readiness: SurveillanceIoTReadinessDto;
  coverage: {
    cameraCount: number;
    iotDeviceCount: number;
    gatewayCount: number;
    onlinePct: number;
    integrationReadyPct: number;
  };
  mock: boolean;
}

export interface SurveillanceIoTMutationResultDto {
  accepted: true;
  entityId: EntityId;
  entityKind: SurveillanceIoTEntityKind;
  auditId: EntityId;
  eventId: EntityId;
  eventType: string;
  message: string;
  mock: boolean;
}

/** Lightweight entity reference for cross-module linkage without duplicating domain-kernel EntityReference. */
export interface SurveillanceIoTEntityRef {
  id: EntityId;
  kind: SurveillanceIoTEntityKind;
  tenantId: EntityId;
  displayName?: string;
  domainScope: SurveillanceIoTDomainScope;
}

// ---------------------------------------------------------------------------
// Contract validation
// ---------------------------------------------------------------------------

type ValidationRule = {
  path: string;
  required?: true;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  values?: readonly (string | number | boolean)[];
  min?: number;
  max?: number;
};

const surveillanceIoTBaseRules: ValidationRule[] = [
  { path: 'id', required: true, type: 'string' },
  { path: 'organizationId', required: true, type: 'string' },
  { path: 'tenantId', required: true, type: 'string' },
  { path: 'racetrackId', required: true, type: 'string' },
  { path: 'displayName', required: true, type: 'string' },
  { path: 'status', required: true, type: 'string' },
  { path: 'health', required: true, type: 'string' },
  { path: 'lastSeenAt', required: true, type: 'string' },
  { path: 'createdAt', required: true, type: 'string' },
  { path: 'updatedAt', required: true, type: 'string' },
  { path: 'audit.auditId', required: true, type: 'string' },
  { path: 'audit.eventId', required: true, type: 'string' },
  { path: 'audit.createdAt', required: true, type: 'string' },
  { path: 'audit.updatedAt', required: true, type: 'string' },
  { path: 'domainScope', required: true, type: 'string' },
  { path: 'mock', required: true, type: 'boolean' },
];

export const surveillanceIoTContractSchemas = {
  CameraDeviceDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['camera-device'] },
    { path: 'deviceCategory', required: true, type: 'string', values: ['camera'] },
    { path: 'streamIds', required: true, type: 'array' },
    { path: 'presetIds', required: true, type: 'array' },
    { path: 'recordingMode', required: true, type: 'string' },
    { path: 'privacyMaskingEnabled', required: true, type: 'boolean' },
    { path: 'ptzCapable', required: true, type: 'boolean' },
    { path: 'integrationStatus', required: true, type: 'string' },
    { path: 'webhookConfigured', required: true, type: 'boolean' },
    { path: 'twinLinked', required: true, type: 'boolean' },
  ],
  IoTDeviceDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['iot-device'] },
    { path: 'sensorType', required: true, type: 'string' },
    { path: 'valueType', required: true, type: 'string' },
    { path: 'integrationStatus', required: true, type: 'string' },
    { path: 'telemetryBindingIds', required: true, type: 'array' },
  ],
  DeviceGatewayDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-gateway'] },
    { path: 'vendor', required: true, type: 'string' },
    { path: 'protocol', required: true, type: 'string' },
    { path: 'connectedDeviceIds', required: true, type: 'array' },
    { path: 'integrationStatus', required: true, type: 'string' },
  ],
  DeviceZoneDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-zone'] },
    { path: 'zoneCode', required: true, type: 'string' },
    { path: 'zoneType', required: true, type: 'string' },
    { path: 'deviceIds', required: true, type: 'array' },
    { path: 'cameraIds', required: true, type: 'array' },
    { path: 'sensorIds', required: true, type: 'array' },
    { path: 'gatewayIds', required: true, type: 'array' },
  ],
  FacilityZoneDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['facility-zone'] },
    { path: 'facilityId', required: true, type: 'string' },
    { path: 'zoneCode', required: true, type: 'string' },
    { path: 'zoneLabel', required: true, type: 'string' },
    { path: 'deviceZoneIds', required: true, type: 'array' },
    { path: 'assignedDeviceIds', required: true, type: 'array' },
  ],
  VideoStreamDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['video-stream'] },
    { path: 'cameraId', required: true, type: 'string' },
    { path: 'streamStatus', required: true, type: 'string' },
    { path: 'protocol', required: true, type: 'string' },
    { path: 'recordingActive', required: true, type: 'boolean' },
  ],
  SensorReadingDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['sensor-reading'] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'metric', required: true, type: 'string' },
    { path: 'observedAt', required: true, type: 'string' },
    { path: 'quality', required: true, type: 'string' },
    { path: 'evidence', required: true, type: 'array' },
  ],
  DeviceHealthStatusDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-health-status'] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'deviceKind', required: true, type: 'string' },
    { path: 'healthScore', required: true, type: 'number', min: 0, max: 100 },
    { path: 'integrationStatus', required: true, type: 'string' },
    { path: 'lastHeartbeatAt', required: true, type: 'string' },
    { path: 'webhookConfigured', required: true, type: 'boolean' },
    { path: 'twinLinked', required: true, type: 'boolean' },
    { path: 'diagnostics', required: true, type: 'array' },
  ],
  RecordingRetentionPolicyDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['recording-retention-policy'] },
    { path: 'policyName', required: true, type: 'string' },
    { path: 'retentionDays', required: true, type: 'number', min: 0 },
    { path: 'disposition', required: true, type: 'string' },
    { path: 'appliesToDeviceIds', required: true, type: 'array' },
    { path: 'appliesToCameraIds', required: true, type: 'array' },
    { path: 'legalHoldEligible', required: true, type: 'boolean' },
    { path: 'privacyMaskingRequired', required: true, type: 'boolean' },
    { path: 'regulatoryFrameworks', required: true, type: 'array' },
  ],
  DeviceAlertDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-alert'] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'alertCode', required: true, type: 'string' },
    { path: 'severity', required: true, type: 'string' },
    { path: 'alertStatus', required: true, type: 'string' },
    { path: 'title', required: true, type: 'string' },
    { path: 'triggeredAt', required: true, type: 'string' },
    { path: 'evidence', required: true, type: 'array' },
  ],
  SurveillanceIncidentReferenceDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['surveillance-incident-reference'] },
    { path: 'incidentId', required: true, type: 'string' },
    { path: 'linkedAt', required: true, type: 'string' },
    { path: 'linkageReason', required: true, type: 'string' },
    { path: 'evidencePackageIds', required: true, type: 'array' },
  ],
  VideoEvidenceReferenceDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['video-evidence-reference'] },
    { path: 'cameraId', required: true, type: 'string' },
    { path: 'clipStartAt', required: true, type: 'string' },
    { path: 'clipEndAt', required: true, type: 'string' },
    { path: 'privacyMasked', required: true, type: 'boolean' },
    { path: 'legalHold', required: true, type: 'boolean' },
  ],
  DeviceRuleDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-rule'] },
    { path: 'ruleName', required: true, type: 'string' },
    { path: 'enabled', required: true, type: 'boolean' },
    { path: 'trigger', required: true, type: 'string' },
    { path: 'action', required: true, type: 'string' },
    { path: 'targetDeviceIds', required: true, type: 'array' },
    { path: 'targetZoneIds', required: true, type: 'array' },
    { path: 'conditionExpression', required: true, type: 'string' },
    { path: 'approvalRequired', required: true, type: 'boolean' },
  ],
  DeviceTelemetrySnapshotDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-telemetry-snapshot'] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'capturedAt', required: true, type: 'string' },
    { path: 'metrics', required: true, type: 'array' },
  ],
  CameraPresetDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['camera-preset'] },
    { path: 'cameraId', required: true, type: 'string' },
    { path: 'presetNumber', required: true, type: 'number', min: 0 },
    { path: 'presetLabel', required: true, type: 'string' },
    { path: 'isHome', required: true, type: 'boolean' },
  ],
  DeviceAssignmentDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-assignment'] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'assignmentType', required: true, type: 'string' },
    { path: 'assignedToId', required: true, type: 'string' },
    { path: 'assignedToKind', required: true, type: 'string' },
    { path: 'effectiveFrom', required: true, type: 'string' },
    { path: 'assignedBy', required: true, type: 'string' },
  ],
  DeviceMaintenanceRecordDto: [
    ...surveillanceIoTBaseRules,
    { path: 'kind', required: true, type: 'string', values: ['device-maintenance-record'] },
    { path: 'deviceId', required: true, type: 'string' },
    { path: 'maintenanceStatus', required: true, type: 'string' },
    { path: 'maintenanceType', required: true, type: 'string' },
    { path: 'notes', required: true, type: 'string' },
    { path: 'evidence', required: true, type: 'array' },
  ],
  SurveillanceIoTReadinessDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'score', required: true, type: 'number', min: 0, max: 100 },
    { path: 'ready', required: true, type: 'number' },
    { path: 'watch', required: true, type: 'number' },
    { path: 'blocked', required: true, type: 'number' },
    { path: 'cameras', required: true, type: 'array' },
    { path: 'sensors', required: true, type: 'array' },
    { path: 'gateways', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceIoTWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'cameras', required: true, type: 'array' },
    { path: 'iotDevices', required: true, type: 'array' },
    { path: 'gateways', required: true, type: 'array' },
    { path: 'deviceZones', required: true, type: 'array' },
    { path: 'facilityZones', required: true, type: 'array' },
    { path: 'videoStreams', required: true, type: 'array' },
    { path: 'recentReadings', required: true, type: 'array' },
    { path: 'healthStatuses', required: true, type: 'array' },
    { path: 'retentionPolicies', required: true, type: 'array' },
    { path: 'openAlerts', required: true, type: 'array' },
    { path: 'incidentReferences', required: true, type: 'array' },
    { path: 'videoEvidence', required: true, type: 'array' },
    { path: 'rules', required: true, type: 'array' },
    { path: 'telemetrySnapshots', required: true, type: 'array' },
    { path: 'cameraPresets', required: true, type: 'array' },
    { path: 'assignments', required: true, type: 'array' },
    { path: 'maintenanceRecords', required: true, type: 'array' },
    { path: 'readiness', required: true, type: 'object' },
    { path: 'coverage', required: true, type: 'object' },
    { path: 'coverage.cameraCount', required: true, type: 'number' },
    { path: 'coverage.iotDeviceCount', required: true, type: 'number' },
    { path: 'coverage.gatewayCount', required: true, type: 'number' },
    { path: 'coverage.onlinePct', required: true, type: 'number', min: 0, max: 100 },
    { path: 'coverage.integrationReadyPct', required: true, type: 'number', min: 0, max: 100 },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceIoTMutationResultDto: [
    { path: 'accepted', required: true, type: 'boolean', values: [true] },
    { path: 'entityId', required: true, type: 'string' },
    { path: 'entityKind', required: true, type: 'string' },
    { path: 'auditId', required: true, type: 'string' },
    { path: 'eventId', required: true, type: 'string' },
    { path: 'eventType', required: true, type: 'string' },
    { path: 'message', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const satisfies Record<string, readonly ValidationRule[]>;
