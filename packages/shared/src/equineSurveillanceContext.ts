import type { EntityId, ISODateTime } from './foundation.js';
import type { Role } from './accessControl.js';
import type { SurveillanceAlertSeverity } from './surveillanceIoTAlertingArchitecture.js';

export const equineSurveillanceContextSchemaVersion =
  'trackmind.equine-surveillance-context.v1' as const;

export type EquineSurveillancePrivacyTier =
  | 'public-operational'
  | 'care-team'
  | 'veterinary-confidential';

export interface EquineSurveillanceAccessPolicyDto {
  viewerRole: Role;
  allowedPrivacyTiers: EquineSurveillancePrivacyTier[];
  redactedSections: string[];
  accessNotice: string;
}

export interface EquineTransportBayMonitoringPlaceholderDto {
  placeholderId: EntityId;
  title: string;
  detail: string;
  readiness: 'placeholder';
  placeholderNotice: string;
  relatedZoneIds: EntityId[];
  relatedDeviceIds: EntityId[];
  requiredPrivacyTier: 'public-operational';
}

export interface EquineStableBarnEnvironmentalSensorDto {
  deviceId: EntityId;
  label: string;
  zoneLabel: string;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  quality: string;
  observedAt: ISODateTime;
  health: string;
  requiredPrivacyTier: 'public-operational' | 'care-team';
}

export type EquineWelfareEvidenceKind =
  | 'welfare-alert'
  | 'welfare-observation'
  | 'environmental-sensor'
  | 'device-alert';

export interface EquineWelfareIncidentEvidenceReferenceDto {
  evidenceReferenceId: EntityId;
  kind: EquineWelfareEvidenceKind;
  title: string;
  horseId?: EntityId;
  horseIdRedacted?: boolean;
  linkedAlertId?: EntityId;
  capturedAt?: ISODateTime;
  evidence: string[];
  playbackUnavailable: true;
  linkageReason: string;
  requiredPrivacyTier: 'care-team';
}

export interface EquineVeterinaryAreaZoneReferenceDto {
  zoneId: EntityId;
  zoneLabel: string;
  zoneKind: string;
  deviceCount: number;
  cameraCount: number;
  healthBand: string;
  linkedDeviceIds: EntityId[];
  coverageNotice?: string;
  requiredPrivacyTier: 'care-team' | 'veterinary-confidential';
}

export interface EquineTransportMovementObservationDto {
  observationId: EntityId;
  occurredAt: ISODateTime;
  fromZoneLabel?: string;
  toZoneLabel?: string;
  movementKind: 'barn-transfer' | 'paddock-move' | 'transport-arrival' | 'vet-area-transit' | 'observation';
  summary: string;
  horseId?: EntityId;
  horseIdRedacted?: boolean;
  traceRefs: string[];
  requiredPrivacyTier: 'public-operational' | 'care-team';
}

export interface EquineSurveillanceContextWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof equineSurveillanceContextSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  privacyNotice: string;
  accessPolicy: EquineSurveillanceAccessPolicyDto;
  summary: {
    transportBayPlaceholders: number;
    barnEnvironmentalSensors: number;
    welfareEvidenceReferences: number;
    veterinaryAreaZones: number;
    transportMovementObservations: number;
    redactedSectionCount: number;
  };
  transportBayMonitoringPlaceholders: EquineTransportBayMonitoringPlaceholderDto[];
  stableBarnEnvironmentalSensors: EquineStableBarnEnvironmentalSensorDto[];
  welfareIncidentEvidenceReferences: EquineWelfareIncidentEvidenceReferenceDto[];
  veterinaryAreaZoneReferences: EquineVeterinaryAreaZoneReferenceDto[];
  transportMovementObservations: EquineTransportMovementObservationDto[];
  mock: boolean;
}

export const equineSurveillanceContextContractSchemas = {
  EquineSurveillanceContextWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [equineSurveillanceContextSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'privacyNotice', required: true, type: 'string' },
    { path: 'accessPolicy', required: true, type: 'object' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'transportBayMonitoringPlaceholders', required: true, type: 'array' },
    { path: 'stableBarnEnvironmentalSensors', required: true, type: 'array' },
    { path: 'welfareIncidentEvidenceReferences', required: true, type: 'array' },
    { path: 'veterinaryAreaZoneReferences', required: true, type: 'array' },
    { path: 'transportMovementObservations', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
