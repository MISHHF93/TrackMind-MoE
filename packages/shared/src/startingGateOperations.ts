export const startingGateOperationsSchemaVersion = 'trackmind.starting-gate-operations.v1' as const;

export const startingGateNoAutoStartStatement =
  'Starting gate operations may track readiness and request approvals only; race starts require authorized human approval workflows and cannot be automated from this module.';

export type StartingGateAssignmentStatus = 'pending' | 'assigned' | 'loaded' | 'reloaded' | 'scratched';
export type StartingGateReadinessStatus = 'pending' | 'watch' | 'ready' | 'blocked';
export type StartingGateReadinessDomain = 'gate' | 'crew' | 'equipment' | 'field' | 'telemetry' | 'horse';
export type StartingGateDelayStatus = 'scheduled' | 'active' | 'cleared' | 'cancelled';
export type StartingGateIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type StartingGateIncidentStatus = 'open' | 'contained' | 'resolved' | 'closed';
export type RaceReadinessIndicatorStatus = 'nominal' | 'watch' | 'blocked' | 'approval-required';

export interface StartingGateAssignmentDto {
  assignmentId: string;
  horseId: string;
  horseName?: string;
  raceId: string;
  entryId?: string;
  postPosition?: number;
  stallNumber: number;
  gateSlot: string;
  status: StartingGateAssignmentStatus;
  assignedAt: string;
  loadedAt?: string;
  evidence: string[];
  auditId: string;
}

export interface StartingGateReadinessDto {
  checkId: string;
  raceId: string;
  horseId?: string;
  checkedAt: string;
  checkedBy: string;
  domain: StartingGateReadinessDomain;
  status: StartingGateReadinessStatus;
  score: number;
  blockers: string[];
  evidence: string[];
  auditId: string;
}

export interface StartingGateDelayDto {
  delayId: string;
  raceId: string;
  reportedAt: string;
  reportedBy: string;
  reason: string;
  estimatedMinutes: number;
  status: StartingGateDelayStatus;
  approvalRequestId?: string;
  clearedAt?: string;
  evidence: string[];
  auditId: string;
}

export interface StartingGateIncidentDto {
  incidentId: string;
  raceId: string;
  horseId?: string;
  stallNumber?: number;
  reportedAt: string;
  reportedBy: string;
  severity: StartingGateIncidentSeverity;
  status: StartingGateIncidentStatus;
  title: string;
  summary: string;
  stewardInquiryId?: string;
  evidence: string[];
  auditId: string;
}

export interface RaceReadinessIndicatorDto {
  raceId: string;
  indicator: 'gate-assignments' | 'stall-loading' | 'crew-readiness' | 'active-delays' | 'gate-incidents' | 'race-start-approval';
  status: RaceReadinessIndicatorStatus;
  value: string;
  detail: string;
  blockers: string[];
  approvalRequestIds: string[];
  lastUpdatedAt: string;
}

export interface StartingGatePositionSnapshotDto {
  gateId: string;
  sectorId: string;
  metersFromStart: number;
  gpsVerified: boolean;
  lastApprovedRequestId?: string;
}

export interface StartingGateApprovalControlDto {
  action: string;
  approvalRequired: true;
  automatedExecutionBlocked: true;
  workflowId?: string;
  endpoint: string;
}

export interface StartingGateOperationsGuardrailsDto {
  mayAutoStartRace: false;
  raceStartAutomation: false;
  approvalGovernedWorkflows: true;
  guardrailStatement: string;
}

export interface StartingGateKpiDto {
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

export interface StartingGateKpiDashboardDto {
  assignedStalls: number;
  loadedHorses: number;
  activeDelays: number;
  openIncidents: number;
  readinessScore: number;
  approvalPendingCount: number;
  panels: StartingGateKpiDto[];
}

export interface StartingGateRaceDayLinksDto {
  raceDayId?: string;
  raceIds: string[];
  entryIds: string[];
  pendingApprovalRequestIds: string[];
}

export interface StartingGateAuditRecordDto {
  auditId: string;
  raceId?: string;
  horseId?: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface StartingGateOperationsDto {
  generatedAt: string;
  schemaVersion: typeof startingGateOperationsSchemaVersion;
  tenantId: string;
  racetrackId: string;
  gatePosition: StartingGatePositionSnapshotDto;
  assignments: StartingGateAssignmentDto[];
  readinessChecks: StartingGateReadinessDto[];
  delays: StartingGateDelayDto[];
  incidents: StartingGateIncidentDto[];
  raceReadinessIndicators: RaceReadinessIndicatorDto[];
  guardrails: StartingGateOperationsGuardrailsDto;
  approvalControls: StartingGateApprovalControlDto[];
  readinessScore: number;
  timeline: Array<{ at: string; label: string; status: string }>;
  raceDayLinks: StartingGateRaceDayLinksDto;
  dashboard: StartingGateKpiDashboardDto;
  auditTrail: StartingGateAuditRecordDto[];
  mock: false;
}

export interface StartingGateMutationResultDto {
  accepted: true;
  raceId?: string;
  horseId?: string;
  auditId: string;
  eventType: string;
  message: string;
  approvalRequestId?: string;
  mock: false;
}

export interface StartingGateOperationsAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof startingGateOperationsSchemaVersion;
  records: StartingGateAuditRecordDto[];
  mock: false;
}
