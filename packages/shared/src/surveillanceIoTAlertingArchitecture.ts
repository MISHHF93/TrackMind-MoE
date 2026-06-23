import type { EntityId, ISODateTime } from './foundation.js';

export const surveillanceIoTAlertingSchemaVersion = 'trackmind.surveillance-iot-alerting.v1' as const;

/** Canonical alert severity for surveillance / IoT alerting framework. */
export type SurveillanceAlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** Resolution lifecycle for alert events. */
export type SurveillanceAlertResolutionStatus =
  | 'open'
  | 'acknowledged'
  | 'escalated'
  | 'resolved'
  | 'suppressed'
  | 'expired';

/** Supported alert rule kinds — placeholders use readiness-safe language only. */
export type SurveillanceAlertRuleKind =
  | 'camera-offline'
  | 'stream-degraded'
  | 'gateway-disconnected'
  | 'sensor-threshold-breach'
  | 'motion-activity'
  | 'restricted-zone-event'
  | 'crowding-queue'
  | 'environmental-anomaly'
  | 'track-surface-condition'
  | 'stable-facility-condition';

/** Rule evaluation readiness — distinguishes live rules from contract placeholders. */
export type SurveillanceAlertRuleReadiness = 'live' | 'placeholder' | 'degraded-readiness';

export type SurveillanceAlertSourceDeviceKind =
  | 'camera-device'
  | 'iot-device'
  | 'device-gateway'
  | 'video-stream';

export interface SurveillanceAlertSourceDeviceDto {
  deviceId: EntityId;
  deviceKind: SurveillanceAlertSourceDeviceKind;
  displayName: string;
}

export interface SurveillanceAlertSourceZoneDto {
  zoneId: EntityId;
  zoneLabel: string;
  zoneKind?: string;
  sensitivity?: string;
}

export type SurveillanceAlertEscalationTargetType = 'role' | 'team' | 'workflow' | 'notification-channel';

export interface SurveillanceAlertEscalationTargetDto {
  targetId: EntityId;
  targetType: SurveillanceAlertEscalationTargetType;
  label: string;
  role?: string;
}

export interface SurveillanceAlertLinkedIncidentDto {
  incidentReferenceId?: EntityId;
  incidentId: EntityId;
  title: string;
  linkedAt?: ISODateTime;
}

export interface SurveillanceAlertLinkedAuditEventDto {
  auditId: EntityId;
  action: string;
  occurredAt: ISODateTime;
  actorId?: EntityId;
  layer?: string;
}

/** Canonical alert rule definition. */
export interface SurveillanceAlertRuleDto {
  ruleId: EntityId;
  ruleKind: SurveillanceAlertRuleKind;
  ruleName: string;
  description: string;
  enabled: boolean;
  readiness: SurveillanceAlertRuleReadiness;
  defaultSeverity: SurveillanceAlertSeverity;
  /** Present when readiness is placeholder — no AI or analytics claims. */
  placeholderNotice?: string;
  sourceDeviceIds: EntityId[];
  sourceZoneIds: EntityId[];
  conditionExpression: string;
  escalationTargets: SurveillanceAlertEscalationTargetDto[];
  approvalRequired: boolean;
  lastEvaluatedAt?: ISODateTime;
  metadataPlaceholder?: boolean;
}

/** Canonical alert event raised by rule evaluation or ingest pipeline. */
export interface SurveillanceAlertEventDto {
  eventId: EntityId;
  ruleId: EntityId;
  ruleKind: SurveillanceAlertRuleKind;
  title: string;
  detail: string;
  severity: SurveillanceAlertSeverity;
  resolutionStatus: SurveillanceAlertResolutionStatus;
  triggeredAt: ISODateTime;
  acknowledgedAt?: ISODateTime;
  resolvedAt?: ISODateTime;
  sourceDevice?: SurveillanceAlertSourceDeviceDto;
  sourceZone?: SurveillanceAlertSourceZoneDto;
  escalationTargets: SurveillanceAlertEscalationTargetDto[];
  linkedIncident?: SurveillanceAlertLinkedIncidentDto;
  linkedAuditEvents: SurveillanceAlertLinkedAuditEventDto[];
  /** True when event is synthesized from a placeholder rule contract. */
  placeholderDerived?: boolean;
  evidence: string[];
}

export interface SurveillanceIoTAlertingFrameworkWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTAlertingSchemaVersion;
  architectureSchemaVersion: string;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  summary: {
    totalRules: number;
    enabledRules: number;
    liveRules: number;
    placeholderRules: number;
    openEvents: number;
    criticalEvents: number;
    escalatedEvents: number;
    resolvedEvents: number;
  };
  ruleCatalog: SurveillanceAlertRuleDto[];
  alertEvents: SurveillanceAlertEventDto[];
  filterOptions: {
    ruleKinds: SurveillanceAlertRuleKind[];
    severities: SurveillanceAlertSeverity[];
    resolutionStatuses: SurveillanceAlertResolutionStatus[];
    readinessBands: SurveillanceAlertRuleReadiness[];
  };
  mock: boolean;
}

export const surveillanceAlertRuleKindLabels: Record<SurveillanceAlertRuleKind, string> = {
  'camera-offline': 'Camera offline',
  'stream-degraded': 'Stream degraded',
  'gateway-disconnected': 'Gateway disconnected',
  'sensor-threshold-breach': 'Sensor threshold breach',
  'motion-activity': 'Motion / activity (placeholder)',
  'restricted-zone-event': 'Restricted-zone event (placeholder)',
  'crowding-queue': 'Crowding / queue (placeholder)',
  'environmental-anomaly': 'Environmental anomaly',
  'track-surface-condition': 'Track surface condition (placeholder)',
  'stable-facility-condition': 'Stable / facility condition',
};

export const surveillanceIoTAlertingContractSchemas = {
  SurveillanceIoTAlertingFrameworkWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceIoTAlertingSchemaVersion] },
    { path: 'architectureSchemaVersion', required: true, type: 'string' },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'ruleCatalog', required: true, type: 'array' },
    { path: 'alertEvents', required: true, type: 'array' },
    { path: 'filterOptions', required: true, type: 'object' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
