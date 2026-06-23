import type { EntityId, ISODateTime } from './foundation.js';
import type { SurveillanceAlertRuleKind, SurveillanceAlertSeverity } from './surveillanceIoTAlertingArchitecture.js';

export const facilitiesSurveillanceMonitoringSchemaVersion =
  'trackmind.facilities-surveillance-monitoring.v1' as const;

export type FacilitiesMonitoringUseCase =
  | 'utilities-monitoring'
  | 'barn-stable-monitoring'
  | 'gate-access-hardware'
  | 'track-infrastructure'
  | 'environmental-conditions';

export interface FacilitiesScopedDeviceDto {
  deviceId: EntityId;
  deviceKind: 'camera-device' | 'iot-device' | 'device-gateway';
  displayName: string;
  domainScope: string;
  health: string;
  status: string;
  sensorType?: string;
  zoneLabel?: string;
  useCases: FacilitiesMonitoringUseCase[];
  lastSeenAt: ISODateTime;
}

export interface FacilitiesUtilitiesMonitoringDto {
  adapterId: EntityId;
  kind: string;
  vendor: string;
  status: string;
  linkedDeviceIds: EntityId[];
  lastSyncAt?: ISODateTime;
  coverageNotice?: string;
}

export interface FacilitiesEnvironmentalReadingDto {
  deviceId: EntityId;
  deviceLabel: string;
  metric: string;
  value: number;
  unit: string;
  observedAt: ISODateTime;
  quality: string;
}

export interface FacilitiesMaintenanceOutageLinkDto {
  outageId: EntityId;
  workOrderId?: EntityId;
  deviceId: EntityId;
  deviceLabel: string;
  title: string;
  severity: SurveillanceAlertSeverity;
  detail: string;
  linkedAt: ISODateTime;
}

export interface FacilitiesInspectionDeviceEvidenceDto {
  evidenceId: EntityId;
  inspectionId: EntityId;
  assetId: EntityId;
  deviceId?: EntityId;
  title: string;
  capturedAt?: ISODateTime;
  evidence: string[];
  playbackUnavailable: true;
}

export interface FacilitiesSurveillanceAlertSummaryDto {
  eventId: EntityId;
  ruleKind: SurveillanceAlertRuleKind | 'track-infrastructure-placeholder';
  useCase: FacilitiesMonitoringUseCase;
  title: string;
  severity: SurveillanceAlertSeverity;
  resolutionStatus: string;
  sourceDeviceLabel?: string;
  sourceZoneLabel?: string;
  triggeredAt: ISODateTime;
  placeholderDerived?: boolean;
}

export interface FacilitiesSurveillanceMonitoringWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof facilitiesSurveillanceMonitoringSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  summary: {
    scopedDevices: number;
    offlineDevices: number;
    openFacilityAlerts: number;
    utilitiesAdapters: number;
    maintenanceOutages: number;
    inspectionEvidenceRefs: number;
    environmentalReadings: number;
  };
  scopedDevices: FacilitiesScopedDeviceDto[];
  utilitiesMonitoring: FacilitiesUtilitiesMonitoringDto[];
  environmentalConditions: FacilitiesEnvironmentalReadingDto[];
  maintenanceOutageLinks: FacilitiesMaintenanceOutageLinkDto[];
  inspectionDeviceEvidence: FacilitiesInspectionDeviceEvidenceDto[];
  facilityAlerts: FacilitiesSurveillanceAlertSummaryDto[];
  filterOptions: {
    useCases: FacilitiesMonitoringUseCase[];
    severities: SurveillanceAlertSeverity[];
    ruleKinds: Array<FacilitiesSurveillanceAlertSummaryDto['ruleKind']>;
  };
  mock: boolean;
}

export const facilitiesSurveillanceMonitoringContractSchemas = {
  FacilitiesSurveillanceMonitoringWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [facilitiesSurveillanceMonitoringSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'scopedDevices', required: true, type: 'array' },
    { path: 'utilitiesMonitoring', required: true, type: 'array' },
    { path: 'environmentalConditions', required: true, type: 'array' },
    { path: 'maintenanceOutageLinks', required: true, type: 'array' },
    { path: 'inspectionDeviceEvidence', required: true, type: 'array' },
    { path: 'facilityAlerts', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
