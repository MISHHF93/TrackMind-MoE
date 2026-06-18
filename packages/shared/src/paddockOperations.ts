export const paddockOperationsSchemaVersion = 'trackmind.paddock-operations.v1' as const;

export type PaddockAssignmentStatus = 'waiting' | 'arrived' | 'saddled' | 'parade-ready' | 'on-track' | 'scratched';
export type HorseArrivalStatus = 'expected' | 'in-transit' | 'arrived' | 'late' | 'no-show';
export type PaddockInspectionStatus = 'scheduled' | 'in-progress' | 'passed' | 'failed' | 'waived';
export type PaddockReadinessStatus = 'pending' | 'watch' | 'ready' | 'blocked';
export type PaddockPersonnelRole = 'paddock-judge' | 'identifier' | 'outrider' | 'veterinarian' | 'groom' | 'hotwalker' | 'security' | 'other';
export type PaddockIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PaddockIncidentStatus = 'open' | 'contained' | 'resolved' | 'closed';

export interface PaddockAssignmentDto {
  assignmentId: string;
  horseId: string;
  horseName?: string;
  raceId: string;
  raceCardId?: string;
  entryId?: string;
  saddleCloth: number;
  paddockSlot: string;
  postPosition?: number;
  jockeyId?: string;
  trainerId?: string;
  status: PaddockAssignmentStatus;
  assignedAt: string;
  evidence: string[];
  auditId: string;
}

export interface HorseArrivalDto {
  arrivalId: string;
  horseId: string;
  horseName?: string;
  raceId: string;
  expectedAt: string;
  arrivedAt?: string;
  fromLocation: string;
  escortId?: string;
  status: HorseArrivalStatus;
  evidence: string[];
  auditId: string;
}

export interface PaddockInspectionDto {
  inspectionId: string;
  horseId: string;
  raceId: string;
  inspectedAt: string;
  inspectorId: string;
  inspectionType: 'saddle' | 'equipment' | 'identity' | 'medication' | 'general';
  status: PaddockInspectionStatus;
  findings: string[];
  evidence: string[];
  auditId: string;
}

export interface PaddockReadinessCheckDto {
  checkId: string;
  horseId?: string;
  raceId: string;
  checkedAt: string;
  checkedBy: string;
  domain: 'horse' | 'personnel' | 'gate' | 'parade' | 'paddock';
  status: PaddockReadinessStatus;
  score: number;
  blockers: string[];
  evidence: string[];
  auditId: string;
}

export interface PaddockPersonnelAssignmentDto {
  assignmentId: string;
  personnelId: string;
  displayName: string;
  role: PaddockPersonnelRole;
  raceId?: string;
  paddockZone?: string;
  assignedAt: string;
  releasedAt?: string;
  active: boolean;
  evidence: string[];
  auditId: string;
}

export interface PaddockIncidentDto {
  incidentId: string;
  raceId?: string;
  horseId?: string;
  reportedAt: string;
  reportedBy: string;
  severity: PaddockIncidentSeverity;
  status: PaddockIncidentStatus;
  title: string;
  summary: string;
  zoneId?: string;
  stewardInquiryId?: string;
  evidence: string[];
  auditId: string;
}

export interface PaddockKpiDto {
  kpiId: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  target: number;
  status: 'nominal' | 'watch' | 'warning' | 'critical' | 'blocked';
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  auditReference: { auditIds: string[]; eventIds: string[] };
}

export interface PaddockKpiDashboardDto {
  assignedHorses: number;
  arrivedHorses: number;
  paradeReadyHorses: number;
  openIncidents: number;
  readinessScore: number;
  inspectionPassRate: number;
  panels: PaddockKpiDto[];
}

export interface PaddockRaceDayLinksDto {
  raceDayId?: string;
  raceIds: string[];
  entryIds: string[];
  paradeSchedule: Array<{ at: string; raceId: string; label: string }>;
}

export interface PaddockAuditRecordDto {
  auditId: string;
  horseId?: string;
  raceId?: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface PaddockOperationsDto {
  generatedAt: string;
  schemaVersion: typeof paddockOperationsSchemaVersion;
  tenantId: string;
  racetrackId: string;
  assignments: PaddockAssignmentDto[];
  arrivals: HorseArrivalDto[];
  inspections: PaddockInspectionDto[];
  readinessChecks: PaddockReadinessCheckDto[];
  personnelAssignments: PaddockPersonnelAssignmentDto[];
  incidents: PaddockIncidentDto[];
  paradeSchedule: Array<{ at: string; raceId: string; label: string }>;
  readinessScore: number;
  gateReadiness: { status: string; lastCheckAt: string };
  timeline: Array<{ at: string; label: string; status: string }>;
  raceDayLinks: PaddockRaceDayLinksDto;
  dashboard: PaddockKpiDashboardDto;
  auditTrail: PaddockAuditRecordDto[];
  mock: false;
}

export interface PaddockMutationResultDto {
  accepted: true;
  horseId?: string;
  raceId?: string;
  auditId: string;
  eventType: string;
  message: string;
  mock: false;
}

export interface PaddockOperationsAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof paddockOperationsSchemaVersion;
  records: PaddockAuditRecordDto[];
  mock: false;
}
