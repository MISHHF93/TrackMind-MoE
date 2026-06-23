import type { EntityId, ISODateTime } from './foundation.js';
import type { IncidentDto } from './platformFoundation.js';
import type { SurveillanceAlertRuleKind, SurveillanceAlertSeverity } from './surveillanceIoTAlertingArchitecture.js';

export const incidentSurveillanceContextSchemaVersion =
  'trackmind.incident-surveillance-context.v1' as const;

export interface IncidentRelatedCameraDto {
  cameraId: EntityId;
  label: string;
  health: string;
  zoneLabel?: string;
  securityZoneId?: EntityId;
  coverageTags: string[];
  linkageReason: string;
  lastSeenAt?: ISODateTime;
  privacyMasking?: boolean;
  playbackUnavailable: true;
}

export interface IncidentRelatedIoTDeviceDto {
  deviceId: EntityId;
  label: string;
  deviceKind: string;
  sensorType?: string;
  health: string;
  zoneLabel?: string;
  securityZoneId?: EntityId;
  linkageReason: string;
  lastSeenAt?: ISODateTime;
}

export interface IncidentLinkedSurveillanceAlertDto {
  eventId: EntityId;
  ruleKind: SurveillanceAlertRuleKind | 'suspicious-activity' | 'perimeter-monitoring';
  title: string;
  severity: SurveillanceAlertSeverity;
  resolutionStatus: string;
  sourceDeviceId?: EntityId;
  sourceDeviceLabel?: string;
  sourceZoneLabel?: string;
  triggeredAt: ISODateTime;
  placeholderDerived?: boolean;
  linkageReason: string;
}

export interface IncidentLinkedTelemetryAnomalyDto {
  anomalyId: EntityId;
  deviceId: EntityId;
  deviceLabel: string;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  quality: string;
  detail: string;
  observedAt: ISODateTime;
  severity: SurveillanceAlertSeverity;
}

export type IncidentSurveillanceEvidenceKind =
  | 'video-evidence'
  | 'sensor-telemetry'
  | 'device-alert'
  | 'access-audit';

export interface IncidentSurveillanceEvidenceReferenceDto {
  evidenceReferenceId: EntityId;
  kind: IncidentSurveillanceEvidenceKind;
  title: string;
  deviceId?: EntityId;
  cameraId?: EntityId;
  capturedAt?: ISODateTime;
  storageUri?: string;
  evidence: string[];
  privacyMasked?: boolean;
  playbackUnavailable: true;
  linkageReason: string;
}

export interface IncidentDeviceTimelineEventDto {
  eventId: EntityId;
  occurredAt: ISODateTime;
  sourceDeviceId: EntityId;
  sourceDeviceLabel: string;
  sourceKind: 'camera-device' | 'iot-device' | 'device-gateway' | 'alert-pipeline' | 'sensor-reading';
  eventKind: string;
  summary: string;
  severity?: SurveillanceAlertSeverity;
  traceRefs: string[];
}

export interface IncidentSurveillanceContextWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof incidentSurveillanceContextSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  incidentId: EntityId;
  correlationSummary: string;
  summary: {
    relatedCameras: number;
    relatedIoTDevices: number;
    linkedSurveillanceAlerts: number;
    linkedTelemetryAnomalies: number;
    evidenceReferences: number;
    deviceTimelineEvents: number;
  };
  relatedCameras: IncidentRelatedCameraDto[];
  relatedIoTDevices: IncidentRelatedIoTDeviceDto[];
  linkedSurveillanceAlerts: IncidentLinkedSurveillanceAlertDto[];
  linkedTelemetryAnomalies: IncidentLinkedTelemetryAnomalyDto[];
  evidenceReferences: IncidentSurveillanceEvidenceReferenceDto[];
  deviceTimelineEvents: IncidentDeviceTimelineEventDto[];
  mock: boolean;
}

/** Incident detail response with optional embedded surveillance context (metadata only). */
export interface IncidentDetailDto extends IncidentDto {
  surveillanceContext?: IncidentSurveillanceContextWorkspaceDto;
}

export const incidentSurveillanceContextContractSchemas = {
  IncidentSurveillanceContextWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [incidentSurveillanceContextSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'incidentId', required: true, type: 'string' },
    { path: 'correlationSummary', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'relatedCameras', required: true, type: 'array' },
    { path: 'relatedIoTDevices', required: true, type: 'array' },
    { path: 'linkedSurveillanceAlerts', required: true, type: 'array' },
    { path: 'linkedTelemetryAnomalies', required: true, type: 'array' },
    { path: 'evidenceReferences', required: true, type: 'array' },
    { path: 'deviceTimelineEvents', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  IncidentDetailDto: [
    { path: 'id', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'title', required: true, type: 'string' },
    { path: 'description', required: true, type: 'string' },
    { path: 'severity', required: true, type: 'string' },
    { path: 'status', required: true, type: 'string' },
    { path: 'category', required: true, type: 'string' },
    { path: 'reportedBy', required: true, type: 'string' },
    { path: 'timeline', required: true, type: 'array' },
    { path: 'auditIds', required: true, type: 'array' },
    { path: 'eventIds', required: true, type: 'array' },
    { path: 'createdAt', required: true, type: 'string' },
    { path: 'updatedAt', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
