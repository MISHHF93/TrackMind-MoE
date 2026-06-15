import type { TimestampSource, TimestampSynchronizationMetadata } from '../timeSynchronization.js';

export type CqrsEventCategory = 'safety-critical' | 'monitoring' | 'administrative';
export type SafetyCriticalCommandType = 'race_start' | 'race_stop' | 'emergency_action' | 'scratch_decision' | 'medication_admin';
export type MonitoringCommandType = 'sensor_reading' | 'camera_detection' | 'location_update';
export type AdministrativeCommandType = 'ticket_sales' | 'facility_schedule' | 'finance_transfer';
export type CqrsCommandType = SafetyCriticalCommandType | MonitoringCommandType | AdministrativeCommandType;

export type DomainEventType =
  | 'RaceStartedEvent'
  | 'RaceStoppedEvent'
  | 'HorseScratchedEvent'
  | 'MedicationAdministeredEvent'
  | 'IncidentReportedEvent'
  | 'SensorReadingEvent'
  | 'CameraDetectionEvent'
  | 'LocationUpdatedEvent'
  | 'TicketSalesRecordedEvent'
  | 'FacilityScheduleUpdatedEvent'
  | 'FinanceTransferRequestedEvent';

export interface AiEventMetadata {
  model_id?: string;
  confidence?: number;
  evidence_links: string[];
  annex_iv_uri?: string;
}

export interface HumanGovernanceMetadata {
  approval_id?: string;
  approver_id?: string;
  approval_timestamp?: string;
}

export interface CqrsCommand<TPayload = Record<string, unknown>> {
  id: string;
  type: CqrsCommandType;
  aggregateId: string;
  tenantId: string;
  racetrackId: string;
  actorId: string;
  payload: TPayload;
  approvalRequired?: boolean;
  approvalId?: string;
  approverId?: string;
  approvalTimestamp?: string;
  ai?: AiEventMetadata;
  occurredAt?: string;
  sourceTimestamps?: TimestampSource[];
}

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: DomainEventType;
  category: CqrsEventCategory;
  aggregateId: string;
  tenantId: string;
  racetrackId: string;
  commandId: string;
  occurredAt: string;
  version: number;
  payload: TPayload;
  previousEventHash: string;
  eventHash: string;
  ai: AiEventMetadata;
  governance: HumanGovernanceMetadata;
  timestampSynchronization: TimestampSynchronizationMetadata;
  eventHub: {
    namespace: string;
    hubName: string;
    partitionKey: string;
  };
}

export interface RaceStartedPayload {
  raceId: string;
  startedAt: string;
  starterId: string;
  gateId?: string;
}

export interface HorseScratchedPayload {
  raceId: string;
  horseId: string;
  reason: string;
  scratchedAt: string;
}

export interface IncidentReportedPayload {
  incidentId: string;
  incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  zoneId?: string;
  description: string;
}

export interface LocationUpdatedPayload {
  horseId?: string;
  personId?: string;
  zoneId: string;
  latitude?: number;
  longitude?: number;
}

export const safetyCriticalCommands = new Set<CqrsCommandType>(['race_start', 'race_stop', 'emergency_action', 'scratch_decision', 'medication_admin']);
export const monitoringCommands = new Set<CqrsCommandType>(['sensor_reading', 'camera_detection', 'location_update']);
export const administrativeCommands = new Set<CqrsCommandType>(['ticket_sales', 'facility_schedule', 'finance_transfer']);

export function eventCategoryFor(commandType: CqrsCommandType): CqrsEventCategory {
  if (safetyCriticalCommands.has(commandType)) return 'safety-critical';
  if (monitoringCommands.has(commandType)) return 'monitoring';
  return 'administrative';
}

export function eventTypeFor(commandType: CqrsCommandType): DomainEventType {
  const map: Record<CqrsCommandType, DomainEventType> = {
    race_start: 'RaceStartedEvent',
    race_stop: 'RaceStoppedEvent',
    emergency_action: 'IncidentReportedEvent',
    scratch_decision: 'HorseScratchedEvent',
    medication_admin: 'MedicationAdministeredEvent',
    sensor_reading: 'SensorReadingEvent',
    camera_detection: 'CameraDetectionEvent',
    location_update: 'LocationUpdatedEvent',
    ticket_sales: 'TicketSalesRecordedEvent',
    facility_schedule: 'FacilityScheduleUpdatedEvent',
    finance_transfer: 'FinanceTransferRequestedEvent',
  };
  return map[commandType];
}
