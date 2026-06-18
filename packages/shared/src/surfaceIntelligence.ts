export const surfaceIntelligenceSchemaVersion = 'trackmind.surface-intelligence.v1' as const;

export const surfaceOperationalGuardrailStatement =
  'Surface operational actions remain advisory and approval-gated; irrigation, harrowing, rolling, and closure recommendations require authorized human workflows.';

export type SurfaceObservationRole = 'steward' | 'jockey' | 'trainer' | 'maintenance' | 'veterinarian' | 'track-superintendent';
export type SurfaceInspectionWorkflowStatus = 'scheduled' | 'in-progress' | 'pending-approval' | 'complete' | 'deferred';
export type SurfaceInspectionWorkflowType = 'routine' | 'pre-race' | 'post-rain' | 'incident-follow-up';
export type SurfaceMaintenanceAction = 'harrow' | 'water' | 'aerate' | 'roll' | 'topdress' | 'repair' | 'drainage-cleanout';
export type SurfaceReadinessStatus = 'pending' | 'watch' | 'ready' | 'blocked';

export interface SurfaceObservationDto {
  observationId: string;
  sectionId: string;
  observedAt: string;
  observerId: string;
  role: SurfaceObservationRole;
  severity: number;
  note: string;
  evidence: string[];
  auditId: string;
}

export interface SurfaceConditionHistoryEntryDto {
  historyId: string;
  sectionId: string;
  recordedAt: string;
  conditionScore: number;
  safetyScore: number;
  consistencyScore: number;
  moisture: number;
  compaction: number;
  cushionDepth: number;
  drainageRate: number;
  riskLevel: string;
  auditId: string;
}

export interface SurfaceMaintenanceEventDto {
  eventId: string;
  sectionId: string;
  completedAt: string;
  action: SurfaceMaintenanceAction;
  effectiveness: number;
  notes: string;
  performedBy: string;
  approvalRequestId?: string;
  evidence: string[];
  auditId: string;
}

export interface SurfaceInspectionWorkflowDto {
  workflowId: string;
  sectionId: string;
  inspectionType: SurfaceInspectionWorkflowType;
  status: SurfaceInspectionWorkflowStatus;
  scheduledAt: string;
  inspectedAt?: string;
  inspectorId?: string;
  findings: string[];
  footingUniformity?: number;
  standingWater?: boolean;
  requiresFollowUp: boolean;
  approvalRequestId?: string;
  inspectionId?: string;
  auditId: string;
}

export interface SurfaceTrendPointDto {
  at: string;
  value: number;
}

export interface SurfaceTrendAnalyticsDto {
  sectionId: string;
  metric: 'condition-score' | 'moisture' | 'compaction' | 'drainage-rate';
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  points: SurfaceTrendPointDto[];
  summary: string;
}

export interface SurfaceReadinessIndicatorDto {
  indicator: 'overall-score' | 'inspection-coverage' | 'maintenance-recency' | 'anomaly-pressure' | 'approval-queue';
  status: SurfaceReadinessStatus;
  value: string;
  detail: string;
  blockers: string[];
}

export interface SurfaceIntelligenceKpiDto {
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

export interface SurfaceIntelligenceKpiDashboardDto {
  overallScore: number;
  openInspectionWorkflows: number;
  maintenanceEventsToday: number;
  activeAnomalies: number;
  pendingApprovals: number;
  readinessScore: number;
  panels: SurfaceIntelligenceKpiDto[];
}

export interface SurfaceIntelligenceAuditRecordDto {
  auditId: string;
  sectionId?: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface SurfaceIntelligenceOperationsDto {
  schemaVersion: typeof surfaceIntelligenceSchemaVersion;
  tenantId: string;
  racetrackId: string;
  trackId: string;
  generatedAt: string;
  overallScore: number;
  readinessScore: number;
  approvalState: 'required' | 'approved';
  operationalActionsRequireHumanApproval: true;
  guardrails: {
    advisoryOnly: true;
    operationalActionsRequireHumanApproval: true;
    guardrailStatement: string;
  };
  observations: SurfaceObservationDto[];
  conditionHistory: SurfaceConditionHistoryEntryDto[];
  maintenanceEvents: SurfaceMaintenanceEventDto[];
  inspectionWorkflows: SurfaceInspectionWorkflowDto[];
  trendAnalytics: SurfaceTrendAnalyticsDto[];
  readinessIndicators: SurfaceReadinessIndicatorDto[];
  statusCards: Array<{ label: string; value: string; tone: 'nominal' | 'advisory' | 'warning' | 'critical'; detail: string }>;
  conditionScorecards: Array<{ id: string; label: string; score: number; riskLevel: string; status: string; detail: string; drivers: string[] }>;
  metricPanels: Array<{ id: string; factor: string; label: string; value: string; target: string; status: string; sectorId?: string; detail: string; trend: string }>;
  sectors: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  inspectionTimeline: Array<Record<string, unknown>>;
  heatmap: Array<Record<string, unknown>>;
  heatmapSectors: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  riskBadges: Array<Record<string, unknown>>;
  weatherObservation: { observedAt: string; rainfallMm: number; forecastRainMm: number; temperature: number; windMph: number; lightningMiles?: number };
  digitalTwinSync: Array<Record<string, unknown>>;
  approvalActions: Array<Record<string, unknown>>;
  forecasts?: unknown[];
  drainageAnalysis?: unknown[];
  anomalies?: unknown[];
  irrigationRecommendations?: unknown[];
  surfaceRiskAnalysis?: unknown[];
  dashboard: SurfaceIntelligenceKpiDashboardDto;
  auditTrail: SurfaceIntelligenceAuditRecordDto[];
  mock: false;
}

export interface SurfaceIntelligenceMutationResultDto {
  accepted: true;
  sectionId?: string;
  auditId: string;
  eventType: string;
  message: string;
  approvalRequestId?: string;
  mock: false;
}

export interface SurfaceIntelligenceAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof surfaceIntelligenceSchemaVersion;
  records: SurfaceIntelligenceAuditRecordDto[];
  mock: false;
}
