import type { EntityId, ISODateTime } from './foundation.js';
import type { SurveillanceAlertRuleKind, SurveillanceAlertSeverity } from './surveillanceIoTAlertingArchitecture.js';

export const securitySurveillanceIntegrationSchemaVersion =
  'trackmind.security-surveillance-integration.v1' as const;

export interface RestrictedZoneCameraCoverageReferenceDto {
  zoneId: EntityId;
  zoneName: string;
  classification: string;
  cameraIds: EntityId[];
  cameras: Array<{
    cameraId: EntityId;
    label: string;
    health: 'online' | 'degraded' | 'offline';
    coverageTags: string[];
    lastHeartbeatAt: ISODateTime;
    privacyMasking: boolean;
  }>;
  coverageGapNotice?: string;
}

export type AccessRelatedSensorEventKind =
  | 'door-contact'
  | 'access-panel'
  | 'credential-denied'
  | 'threshold-breach'
  | 'sensor-health';

export interface AccessRelatedSensorEventDto {
  eventId: EntityId;
  sensorId?: EntityId;
  sensorLabel?: string;
  sensorType?: string;
  zoneId: EntityId;
  zoneName: string;
  eventKind: AccessRelatedSensorEventKind;
  severity: SurveillanceAlertSeverity;
  detail: string;
  occurredAt: ISODateTime;
  linkedAccessEventId?: EntityId;
  linkedIncidentId?: EntityId;
}

export type SecuritySurveillancePlaceholderKind = 'suspicious-activity' | 'perimeter-monitoring';

export interface SecuritySurveillanceAlertPlaceholderDto {
  placeholderId: EntityId;
  placeholderKind: SecuritySurveillancePlaceholderKind;
  title: string;
  detail: string;
  readiness: 'placeholder';
  placeholderNotice: string;
  relatedZoneIds: EntityId[];
  relatedCameraIds: EntityId[];
  relatedSensorIds: EntityId[];
}

export interface SecurityIncidentDeviceLinkageDto {
  incidentId: EntityId;
  incidentTitle: string;
  severity: string;
  status: string;
  zoneId: EntityId;
  zoneName: string;
  linkedCameraIds: EntityId[];
  linkedSensorIds: EntityId[];
  linkedDeviceIds: EntityId[];
  linkageReason: string;
}

export type SecurityIncidentEvidenceKind =
  | 'video-evidence'
  | 'sensor-telemetry'
  | 'access-audit'
  | 'device-alert';

export interface SecurityIncidentEvidenceReferenceDto {
  evidenceReferenceId: EntityId;
  incidentId: EntityId;
  kind: SecurityIncidentEvidenceKind;
  title: string;
  deviceId?: EntityId;
  cameraId?: EntityId;
  storageUri?: string;
  capturedAt?: ISODateTime;
  evidence: string[];
  privacyMasked?: boolean;
  /** True when clip metadata exists but playback is not exposed in this workspace. */
  playbackUnavailable: boolean;
}

export interface SecuritySurveillanceAlertSummaryDto {
  eventId: EntityId;
  ruleKind: SurveillanceAlertRuleKind | 'suspicious-activity' | 'perimeter-monitoring';
  title: string;
  severity: SurveillanceAlertSeverity;
  resolutionStatus: string;
  sourceDeviceId?: EntityId;
  sourceDeviceLabel?: string;
  sourceDeviceKind?: string;
  sourceZoneLabel?: string;
  triggeredAt: ISODateTime;
  placeholderDerived?: boolean;
  linkedIncidentId?: EntityId;
}

export interface SecuritySurveillanceIntegrationWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof securitySurveillanceIntegrationSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  summary: {
    openSurveillanceAlerts: number;
    criticalSurveillanceAlerts: number;
    restrictedZonesWithCoverage: number;
    accessSensorEvents: number;
    incidentsWithDeviceLinkage: number;
    evidenceReferences: number;
    placeholderAlertContracts: number;
  };
  restrictedZoneCameraCoverage: RestrictedZoneCameraCoverageReferenceDto[];
  accessRelatedSensorEvents: AccessRelatedSensorEventDto[];
  surveillanceAlertPlaceholders: SecuritySurveillanceAlertPlaceholderDto[];
  incidentDeviceLinkages: SecurityIncidentDeviceLinkageDto[];
  incidentEvidenceReferences: SecurityIncidentEvidenceReferenceDto[];
  surveillanceAlerts: SecuritySurveillanceAlertSummaryDto[];
  filterOptions: {
    ruleKinds: Array<SecuritySurveillanceAlertSummaryDto['ruleKind']>;
    severities: SurveillanceAlertSeverity[];
    placeholderKinds: SecuritySurveillancePlaceholderKind[];
  };
  mock: boolean;
}

export const securitySurveillanceIntegrationContractSchemas = {
  SecuritySurveillanceIntegrationWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [securitySurveillanceIntegrationSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'restrictedZoneCameraCoverage', required: true, type: 'array' },
    { path: 'accessRelatedSensorEvents', required: true, type: 'array' },
    { path: 'surveillanceAlertPlaceholders', required: true, type: 'array' },
    { path: 'incidentDeviceLinkages', required: true, type: 'array' },
    { path: 'incidentEvidenceReferences', required: true, type: 'array' },
    { path: 'surveillanceAlerts', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
