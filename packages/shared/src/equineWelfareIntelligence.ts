export const equineWelfareIntelligenceSchemaVersion = 'trackmind.equine-welfare-intelligence.v1' as const;

export const equineWelfareAdvisoryGuardrailStatement =
  'Equine welfare AI recommendations remain advisory only; operational welfare interventions and retirement decisions require veterinarian or welfare-officer human workflows.';

export type WelfareIndicatorKind =
  | 'body-condition'
  | 'gait'
  | 'behavior'
  | 'hydration'
  | 'transport-stress'
  | 'training-load'
  | 'retirement-candidate';
export type WelfareIndicatorStatus = 'nominal' | 'watch' | 'concern' | 'critical';
export type WelfareObservationRole = 'veterinarian' | 'welfare-officer' | 'trainer' | 'groom' | 'steward';
export type WelfareAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type WelfareAlertStatus = 'open' | 'acknowledged' | 'resolved';
export type RetirementReadinessBand = 'not-ready' | 'monitor' | 'candidate' | 'ready-for-review';
export type WelfareScoreBand = 'excellent' | 'good' | 'watch' | 'concern' | 'critical';
export type WelfareKpiStatus = 'nominal' | 'watch' | 'warning' | 'critical';

export interface EquineWelfareIndicatorDto {
  indicatorId: string;
  horseId: string;
  indicator: WelfareIndicatorKind;
  status: WelfareIndicatorStatus;
  score: number;
  detail: string;
  digitalTwinId?: string;
  lastUpdatedAt: string;
  auditId: string;
}

export interface WelfareObservationDto {
  observationId: string;
  horseId: string;
  observedAt: string;
  observerId: string;
  role: WelfareObservationRole;
  score: number;
  category: string;
  notes: string;
  interventions: string[];
  evidence: string[];
  auditId: string;
}

export interface WelfareTrendPointDto {
  at: string;
  value: number;
}

export interface WelfareTrendAnalyticsDto {
  horseId?: string;
  metric: 'welfare-score' | 'transport-stress' | 'retirement-readiness' | 'alert-pressure';
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  points: WelfareTrendPointDto[];
  summary: string;
}

export interface WelfareAlertDto {
  alertId: string;
  horseId: string;
  severity: WelfareAlertSeverity;
  status: WelfareAlertStatus;
  title: string;
  summary: string;
  raisedAt: string;
  resolvedAt?: string;
  digitalTwinId?: string;
  auditId: string;
}

export interface RetirementReadinessDto {
  horseId: string;
  readinessScore: number;
  band: RetirementReadinessBand;
  factors: string[];
  veterinarianReviewRequired: boolean;
  aftercarePlanReference?: string;
  auditId: string;
  lastAssessedAt: string;
}

export interface HorseDigitalTwinWelfareLinkDto {
  horseId: string;
  twinId: string;
  displayName?: string;
  welfareLevel?: string;
  lastSyncedAt: string;
  telemetryStreams: string[];
  readOnly: true;
}

export interface WelfareAdvisoryRecommendationDto {
  recommendationId: string;
  horseId: string;
  domain: 'welfare' | 'retirement' | 'transport' | 'health';
  summary: string;
  confidence: number;
  advisoryOnly: true;
  veterinarianReviewRequired: boolean;
  modelVersion: string;
  generatedAt: string;
  evidence: string[];
}

export interface EquineWelfareHorseScoreDto {
  horseId: string;
  welfareScore: number;
  band: WelfareScoreBand;
  lifecycleStage: string;
  transportStatus: string;
  retirementReadiness: number;
  factors: string[];
  veterinarianReviewRequired: boolean;
  generatedAt: string;
  mock: false;
}

export interface EquineWelfareKpiDto {
  kpiId: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  target: number;
  status: WelfareKpiStatus;
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  auditReference: { auditIds: string[]; eventIds: string[] };
}

export interface EquineWelfareKpiRegistryDto {
  herdWatchCount: number;
  openAlerts: number;
  avgWelfareScore: number;
  retirementCandidates: number;
  twinSyncCoverage: number;
  readinessScore: number;
  panels: EquineWelfareKpiDto[];
}

export interface EquineWelfareAuditRecordDto {
  auditId: string;
  horseId?: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface EquineWelfareGuardrailsDto {
  aiRecommendationsAdvisoryOnly: true;
  operationalInterventionsRequireHumanApproval: true;
  veterinarianReviewRequiredForHealthActions: true;
  guardrailStatement: string;
}

export interface EquineWelfareIntelligenceOperationsDto {
  generatedAt: string;
  schemaVersion: typeof equineWelfareIntelligenceSchemaVersion;
  tenantId: string;
  racetrackId: string;
  welfareIndicators: EquineWelfareIndicatorDto[];
  observations: WelfareObservationDto[];
  trendAnalytics: WelfareTrendAnalyticsDto[];
  alerts: WelfareAlertDto[];
  retirementReadiness: RetirementReadinessDto[];
  digitalTwinLinks: HorseDigitalTwinWelfareLinkDto[];
  advisoryRecommendations: WelfareAdvisoryRecommendationDto[];
  guardrails: EquineWelfareGuardrailsDto;
  dashboard: EquineWelfareKpiRegistryDto;
  auditTrail: EquineWelfareAuditRecordDto[];
  herdSummary: { total: number; watchCount: number; criticalCount: number; avgScore: number };
  horses: EquineWelfareHorseScoreDto[];
  mock: false;
}

export interface EquineWelfareHorseDetailDto extends EquineWelfareHorseScoreDto {
  welfareIndicators: EquineWelfareIndicatorDto[];
  observations: WelfareObservationDto[];
  trendAnalytics: WelfareTrendAnalyticsDto[];
  alerts: WelfareAlertDto[];
  retirementAssessment?: RetirementReadinessDto;
  digitalTwinLink?: HorseDigitalTwinWelfareLinkDto;
  advisoryRecommendations: WelfareAdvisoryRecommendationDto[];
}

export interface EquineWelfareMutationResultDto {
  accepted: true;
  horseId?: string;
  recordId?: string;
  auditId: string;
  eventType: string;
  message: string;
  mock: false;
}

export interface EquineWelfareAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof equineWelfareIntelligenceSchemaVersion;
  records: EquineWelfareAuditRecordDto[];
  mock: false;
}

export function welfareScoreBand(score: number): WelfareScoreBand {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'watch';
  if (score >= 45) return 'concern';
  return 'critical';
}
