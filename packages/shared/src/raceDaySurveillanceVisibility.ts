import type { EntityId, ISODateTime } from './foundation.js';
import type { SurveillanceAlertRuleKind, SurveillanceAlertSeverity } from './surveillanceIoTAlertingArchitecture.js';
import type { SurveillanceOperationalZoneKind } from './surveillanceIoTArchitecture.js';

export const raceDaySurveillanceVisibilitySchemaVersion =
  'trackmind.race-day-surveillance-visibility.v1' as const;

export type RaceDaySurveillanceCameraGroup = 'paddock' | 'starting-gate' | 'trackside';

export interface RaceDaySurveillanceCameraDto {
  cameraId: EntityId;
  label: string;
  group: RaceDaySurveillanceCameraGroup;
  health: string;
  status: string;
  operationalZoneId?: EntityId;
  operationalZoneLabel?: string;
  coverageTags: string[];
  lastSeenAt?: ISODateTime;
  privacyMasking?: boolean;
  playbackUnavailable: true;
}

export interface RaceDayZoneReadinessDeviceDto {
  deviceId: EntityId;
  label: string;
  deviceKind: 'camera-device' | 'iot-device' | 'device-gateway';
  operationalZoneId: EntityId;
  operationalZoneLabel: string;
  zoneKind: SurveillanceOperationalZoneKind;
  health: string;
  status: string;
  readinessPosture: 'ready' | 'watch' | 'blocked';
  sensorType?: string;
  lastSeenAt?: ISODateTime;
}

export type RaceDaySurveillancePlaceholderKind = 'weather-environmental' | 'crowd-queue-congestion';

export interface RaceDaySurveillancePlaceholderDto {
  placeholderId: EntityId;
  placeholderKind: RaceDaySurveillancePlaceholderKind;
  title: string;
  detail: string;
  readiness: 'placeholder';
  placeholderNotice: string;
  relatedZoneIds: EntityId[];
  relatedDeviceIds: EntityId[];
}

export type RaceDayDisruptionCategory =
  | 'device-health'
  | 'environmental'
  | 'crowd-flow'
  | 'zone-readiness'
  | 'operational';

export interface RaceDayDisruptionAlertDto {
  eventId: EntityId;
  ruleKind: SurveillanceAlertRuleKind | RaceDaySurveillancePlaceholderKind;
  title: string;
  severity: SurveillanceAlertSeverity;
  resolutionStatus: string;
  monitoredZoneId?: EntityId;
  monitoredZoneLabel?: string;
  sourceDeviceLabel?: string;
  triggeredAt: ISODateTime;
  placeholderDerived?: boolean;
  disruptionCategory: RaceDayDisruptionCategory;
}

export interface RaceDayMonitoredZoneSummaryDto {
  zoneId: EntityId;
  zoneLabel: string;
  zoneKind: SurveillanceOperationalZoneKind;
  healthBand: string;
  cameraCount: number;
  iotDeviceCount: number;
  openAlertCount: number;
  coveragePct: number;
}

export interface RaceDaySurveillanceVisibilityWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof raceDaySurveillanceVisibilitySchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  visibilityNotice: string;
  summary: {
    paddockCameras: number;
    startingGateCameras: number;
    tracksideCameras: number;
    zoneReadinessDevices: number;
    openDisruptionAlerts: number;
    criticalDisruptionAlerts: number;
    placeholderContracts: number;
    offlineDevices: number;
  };
  paddockCameras: RaceDaySurveillanceCameraDto[];
  startingGateCameras: RaceDaySurveillanceCameraDto[];
  tracksideCameras: RaceDaySurveillanceCameraDto[];
  zoneReadinessDevices: RaceDayZoneReadinessDeviceDto[];
  weatherEnvironmentalPlaceholders: RaceDaySurveillancePlaceholderDto[];
  crowdQueuePlaceholders: RaceDaySurveillancePlaceholderDto[];
  disruptionAlerts: RaceDayDisruptionAlertDto[];
  monitoredZones: RaceDayMonitoredZoneSummaryDto[];
  filterOptions: {
    cameraGroups: RaceDaySurveillanceCameraGroup[];
    disruptionCategories: RaceDayDisruptionCategory[];
    placeholderKinds: RaceDaySurveillancePlaceholderKind[];
    severities: SurveillanceAlertSeverity[];
  };
  mock: boolean;
}

export const raceDaySurveillanceVisibilityContractSchemas = {
  RaceDaySurveillanceVisibilityWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [raceDaySurveillanceVisibilitySchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'visibilityNotice', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'paddockCameras', required: true, type: 'array' },
    { path: 'startingGateCameras', required: true, type: 'array' },
    { path: 'tracksideCameras', required: true, type: 'array' },
    { path: 'zoneReadinessDevices', required: true, type: 'array' },
    { path: 'weatherEnvironmentalPlaceholders', required: true, type: 'array' },
    { path: 'crowdQueuePlaceholders', required: true, type: 'array' },
    { path: 'disruptionAlerts', required: true, type: 'array' },
    { path: 'monitoredZones', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
