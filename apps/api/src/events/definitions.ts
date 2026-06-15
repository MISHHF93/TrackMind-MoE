import type { TimestampSource, TimestampSynchronizationMetadata } from '../timeSynchronization.js';
import type { CanonicalEventEnvelope } from '@trackmind/shared';

export type CqrsEventCategory = 'safety-critical' | 'monitoring' | 'administrative';
export type SafetyCriticalCommandType = 'race_start' | 'race_stop' | 'emergency_action' | 'scratch_decision' | 'medication_admin';
export type MonitoringCommandType = 'sensor_reading' | 'camera_detection' | 'location_update';
export type AdministrativeCommandType = 'ticket_sales' | 'facility_schedule' | 'finance_transfer';
export type CqrsCommandType = SafetyCriticalCommandType | MonitoringCommandType | AdministrativeCommandType;

export type DomainEventType =
  | 'race.lifecycle.started.v1'
  | 'race.lifecycle.stopped.v1'
  | 'horse.status.scratched.v1'
  | 'medication.decision.administered.v1'
  | 'incident.case.reported.v1'
  | 'sensor.reading.recorded.v1'
  | 'camera.detection.recorded.v1'
  | 'location.position.updated.v1'
  | 'ticket.sales.recorded.v1'
  | 'facility.schedule.updated.v1'
  | 'finance.transfer.requested.v1';

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

export interface EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> extends CanonicalEventEnvelope<TPayload> {
  eventType: DomainEventType;
  category: CqrsEventCategory;
  aggregateId: string;
  actorId: string;
  source: string;
  timestamp: string;
  commandId: string;
  occurredAt: string;
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
    race_start: 'race.lifecycle.started.v1',
    race_stop: 'race.lifecycle.stopped.v1',
    emergency_action: 'incident.case.reported.v1',
    scratch_decision: 'horse.status.scratched.v1',
    medication_admin: 'medication.decision.administered.v1',
    sensor_reading: 'sensor.reading.recorded.v1',
    camera_detection: 'camera.detection.recorded.v1',
    location_update: 'location.position.updated.v1',
    ticket_sales: 'ticket.sales.recorded.v1',
    facility_schedule: 'facility.schedule.updated.v1',
    finance_transfer: 'finance.transfer.requested.v1',
  };
  return map[commandType];
}
