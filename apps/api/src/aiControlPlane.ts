import {
  adaptAIRecommendationOutputToForecastArtifact,
  adaptAIRecommendationOutputToInsightArtifact,
  adaptAIRecommendationOutputToRecommendationArtifact,
  protectedActions,
  type AIAllowedActivity,
  type AIArtifactAdapterMetadata,
  type AIControlPlaneDomain as SharedAIControlPlaneDomain,
  type AIForecastArtifact,
  type AIInsightArtifact,
  type AIRecommendationArtifact,
  type AIRecommendationOutput as SharedAIRecommendationOutput,
  type AIRecommendationType as SharedAIRecommendationType,
  type ExpertDomain,
  type ProtectedAction,
} from '@trackmind/shared';
import { predictMaintenance, type MaintenanceSignal } from './assetIntelligence.js';
import { nonDiagnosticRiskScore, type HorseSafetyProfile } from './horseSafety.js';
import {
  analyzeSurfaceSection,
  forecastSurfaceRisk,
  type SurfaceIntelligenceInput,
  type SurfaceRiskLevel,
  type WeatherIntegration,
} from './trackSurface.js';
import {
  buildTrackConfigurationExecutionPlan,
  generateGateMoveChange,
  type GateMoveRequest,
  type TrackBoundary,
  type TrackConfigurationChange,
  type TrackSector,
} from './trackConfiguration.js';
import { organizeEvidenceForStewards, type StewardInquiry } from './stewarding.js';
import type { SocSignal } from './securityOps.js';
import {
  ResponsibleAIGovernancePlatform,
  type AIAgent,
  type GovernanceApprovalPolicy,
  type ModelEvaluation,
  type ModelRegistration,
  type PromptTemplate,
  type RecommendationRecord,
  type RiskAssessment,
  type RiskLevel,
} from './responsibleAiGovernor.js';

export type AIControlPlaneDomain =
  | 'surface-risk'
  | 'race-readiness'
  | 'gate-position'
  | 'equine-advisory'
  | 'security-anomaly'
  | 'weather-impact'
  | 'maintenance-forecasting'
  | 'steward-evidence'
  | 'executive-intelligence';

export type AIRecommendationType =
  | 'risk-assessment'
  | 'readiness'
  | 'position-recommendation'
  | 'advisory'
  | 'anomaly'
  | 'impact-forecast'
  | 'maintenance-forecast'
  | 'evidence-assistance'
  | 'executive-briefing';

export type ExpertModelId =
  | 'model-surface-risk-v1'
  | 'model-race-readiness-v1'
  | 'model-gate-position-v1'
  | 'model-equine-advisory-v1'
  | 'model-security-anomaly-v1'
  | 'model-weather-impact-v1'
  | 'model-maintenance-forecast-v1'
  | 'model-steward-evidence-v1'
  | 'model-executive-intelligence-v1';

export interface GovernanceControlLink {
  framework: 'ISO42001' | 'NIST-AI-RMF';
  controls: string[];
  evidence: string[];
}

export interface ExpertModelRegistryRecord extends ModelRegistration {
  id: ExpertModelId;
  controlPlaneDomain: AIControlPlaneDomain;
  expertDomain: ExpertDomain;
  recommendationTypes: AIRecommendationType[];
  featureRecordTypes: string[];
  deterministicPlaceholder: true;
  advisoryOnly: true;
  blockedAutonomousExecution: true;
  protectedControlExecutionAllowed: false;
  governanceControls: GovernanceControlLink[];
}

export interface AIAgentRegistryRecord {
  agent: AIAgent;
  promptTemplate: PromptTemplate;
  evaluation: ModelEvaluation;
  riskAssessment: RiskAssessment;
  governanceControls: GovernanceControlLink[];
}

export interface AIExpertRequest<TFeatures = unknown> {
  id?: string;
  tenantId?: string;
  racetrackId?: string;
  domain: AIControlPlaneDomain;
  recommendationType: AIRecommendationType;
  features: TFeatures;
  requestedAt?: string;
  requestedBy?: string;
}

export interface ExpertDraftAction {
  action: string;
  target: string;
  description: string;
  executionAllowed: false;
  physicalMovementAllowed?: false;
  officialRuling?: false;
  mayModifyOfficialResults?: false;
}

export interface ExpertRecommendationDraft {
  id: string;
  tenantId: string;
  racetrackId: string;
  modelId: ExpertModelId;
  agentId: string;
  promptTemplateId: string;
  domain: AIControlPlaneDomain;
  expertDomain: ExpertDomain;
  recommendationType: AIRecommendationType;
  recommendation: string;
  evidence: string[];
  confidence: number;
  riskLevel: RiskLevel;
  requiredApprovals: string[];
  affectedAssets: string[];
  protectedActions: ProtectedAction[];
  governanceControls: GovernanceControlLink[];
  draftAction?: ExpertDraftAction;
  advisoryOnly: true;
  blockedAutonomousExecution: true;
  protectedControlExecutionAllowed: false;
  createdAt: string;
  lineage: string[];
  limitations: string[];
}

export interface SurfaceRiskFeatureRecord { surface: SurfaceIntelligenceInput; sectionId?: string }
export interface RaceReadinessFeatureRecord { raceId: string; trackId: string; postTime: string; evaluatedAt: string; checks: Array<{ domain: string; label: string; score: number; status: 'ready' | 'watch' | 'blocked'; evidence: string[]; blockers: string[]; approvalRequired?: boolean; ownerRole: string }> }
export interface GatePositionFeatureRecord { currentChange: TrackConfigurationChange; proposedMove?: GateMoveRequest; boundaries?: TrackBoundary[]; sectors?: TrackSector[] }
export interface EquineAdvisoryFeatureRecord { profile: HorseSafetyProfile; horseName?: string }
export interface SecurityAnomalyFeatureRecord { signals: SocSignal[]; scope?: string }
export interface WeatherImpactFeatureRecord { weather: WeatherIntegration; trackId?: string; affectedRaceIds?: string[] }
export interface MaintenanceForecastFeatureRecord { signals: MaintenanceSignal[] }
export interface StewardEvidenceFeatureRecord { inquiry: StewardInquiry; actorId?: string; generatedAt?: string; missingEvidence?: string[] }
export interface ExecutiveBriefingItem { domain: AIControlPlaneDomain; status: 'nominal' | 'watch' | 'blocked' | 'critical'; score?: number; riskLevel?: RiskLevel; summary: string; evidence: string[]; protectedActions?: ProtectedAction[] }
export interface ExecutiveIntelligenceFeatureRecord { generatedAt: string; briefingItems: ExecutiveBriefingItem[] }

const isoNistControls: GovernanceControlLink[] = [
  {
    framework: 'ISO42001',
    controls: ['AI management system lifecycle', 'impact assessment', 'human oversight', 'model registry evidence'],
    evidence: ['docs/compliance/ISO42001.md', 'docs/compliance/responsible-ai-governance-platform.md'],
  },
  {
    framework: 'NIST-AI-RMF',
    controls: ['govern', 'map', 'measure', 'manage'],
    evidence: ['docs/compliance/NIST-AI-RMF.md', 'docs/compliance/responsible-ai-governance-platform.md'],
  },
];

const registeredAt = '2026-06-14T00:00:00.000Z';

export const modelRegistryRecords: ExpertModelRegistryRecord[] = [
  registryRecord('model-surface-risk-v1', 'Surface Risk Expert', 'surface-risk', 'TrackSurface', ['risk-assessment'], ['SurfaceIntelligenceInput'], 'Scores surface sections using moisture, compaction, drainage, cushion depth, inspection, weather, and maintenance factors.', 'safety-critical', 'restricted'),
  registryRecord('model-race-readiness-v1', 'Race Readiness Expert', 'race-readiness', 'RaceOps', ['readiness'], ['RaceReadinessFeatureRecord'], 'Assesses race readiness checks and recommends human readiness review or hold packages.', 'safety-critical', 'restricted'),
  registryRecord('model-gate-position-v1', 'Gate Position Recommendation Expert', 'gate-position', 'RaceOps', ['position-recommendation'], ['TrackConfigurationChange', 'GateMoveRequest'], 'Drafts gate move and work-order recommendations with geospatial validation and no live actuator control.', 'safety-critical', 'restricted'),
  registryRecord('model-equine-advisory-v1', 'Equine Advisory Expert', 'equine-advisory', 'EquineSafety', ['advisory'], ['HorseSafetyProfile'], 'Uses non-diagnostic horse safety scoring to recommend veterinarian review only.', 'high', 'personal-data'),
  registryRecord('model-security-anomaly-v1', 'Security Anomaly Expert', 'security-anomaly', 'SecuritySOC', ['anomaly'], ['SocSignal[]'], 'Prioritizes security anomalies from access, surveillance, restricted-area, and cyber signals.', 'high', 'confidential'),
  registryRecord('model-weather-impact-v1', 'Weather Impact Expert', 'weather-impact', 'WeatherEnvironment', ['impact-forecast'], ['WeatherIntegration'], 'Forecasts operational weather impact from rainfall, lightning, wind, and temperature.', 'high', 'internal'),
  registryRecord('model-maintenance-forecast-v1', 'Maintenance Forecasting Expert', 'maintenance-forecasting', 'MaintenanceOps', ['maintenance-forecast'], ['MaintenanceSignal[]'], 'Uses deterministic maintenance probability scoring for monitored assets.', 'high', 'internal'),
  registryRecord('model-steward-evidence-v1', 'Steward Evidence Assistance Expert', 'steward-evidence', 'Stewarding', ['evidence-assistance'], ['StewardInquiry'], 'Organizes and summarizes steward evidence only; does not issue rulings or alter official results.', 'safety-critical', 'restricted'),
  registryRecord('model-executive-intelligence-v1', 'Executive Intelligence Expert', 'executive-intelligence', 'ExecutiveDecisionSupport', ['executive-briefing'], ['ExecutiveBriefingItem[]'], 'Summarizes cross-domain operational risk for executives with governance constraints preserved.', 'medium', 'internal'),
];

const modelByDomain = new Map(modelRegistryRecords.map((record) => [record.controlPlaneDomain, record]));
const modelById = new Map(modelRegistryRecords.map((record) => [record.id, record]));

export function routeAIExpertModel(request: Pick<AIExpertRequest, 'domain' | 'recommendationType'>): ExpertModelRegistryRecord {
  const record = modelByDomain.get(request.domain);
  if (!record) throw new Error(`No expert model registered for domain ${request.domain}`);
  if (!record.recommendationTypes.includes(request.recommendationType)) {
    throw new Error(`Model ${record.id} does not support recommendation type ${request.recommendationType}`);
  }
  return cloneRegistryRecord(record);
}

export function runAIExpertRecommendation<TFeatures>(request: AIExpertRequest<TFeatures>): ExpertRecommendationDraft {
  const model = routeAIExpertModel(request);
  const implementation = expertImplementations[model.id];
  return implementation(request as AIExpertRequest);
}

export function listExpertModelRegistry(): ExpertModelRegistryRecord[] {
  return modelRegistryRecords.map(cloneRegistryRecord);
}

export function listAIAgentRegistryRecords(timestamp = registeredAt): AIAgentRegistryRecord[] {
  return modelRegistryRecords.map((model) => agentRegistryRecord(model, timestamp));
}

export function seedAIControlPlaneGovernance(platform: ResponsibleAIGovernancePlatform, timestamp = registeredAt): AIAgentRegistryRecord[] {
  const records = listAIAgentRegistryRecords(timestamp);
  for (const model of modelRegistryRecords) platform.registerModel(asGovernanceModel(model, timestamp));
  for (const record of records) {
    platform.publishPromptTemplate(record.promptTemplate);
    platform.registerAgent(record.agent);
    platform.recordEvaluation(record.evaluation);
    platform.assessRisk(record.riskAssessment);
  }
  return records;
}

export function recommendationDraftToGovernanceRecord(draft: ExpertRecommendationDraft, approvalPolicy?: GovernanceApprovalPolicy): RecommendationRecord {
  return {
    id: draft.id,
    agentId: draft.agentId,
    modelVersionId: draft.modelId,
    promptTemplateId: draft.promptTemplateId,
    activity: draft.recommendationType === 'position-recommendation' ? 'create-draft-action' : 'recommend',
    action: draft.draftAction?.action ?? `recommend-${draft.domain}`,
    target: draft.affectedAssets[0] ?? draft.domain,
    recommendation: draft.recommendation,
    confidence: draft.confidence,
    affectedAssets: [...draft.affectedAssets],
    evidence: [...draft.evidence],
    lineage: [...draft.lineage],
    approvalPolicy: approvalPolicy ?? approvalPolicyForDraft(draft),
    riskLevel: draft.riskLevel,
    createdAt: draft.createdAt,
    explainability: {
      method: 'deterministic-placeholder-expert',
      rationale: `Routed to ${draft.modelId}; advisory-only output with ${draft.evidence.length} evidence references and protected execution blocked.`,
      citedEvidence: [...draft.evidence],
      limitations: [...draft.limitations],
      humanReviewRequired: true,
      score: draft.confidence,
    },
  };
}

export interface AIRecommendationArtifactAdapterOptions extends AIArtifactAdapterMetadata {
  domain?: SharedAIControlPlaneDomain;
  type?: SharedAIRecommendationType;
  horizon?: string;
  auditEventIds?: string[];
  eventIds?: string[];
  evidencePackageId?: string;
  confidenceDrivers?: string[];
}

export function recommendationDraftToSharedAIOutput(draft: ExpertRecommendationDraft, options: AIRecommendationArtifactAdapterOptions = {}): SharedAIRecommendationOutput {
  const type = options.type ?? sharedRecommendationTypeByExpertType[draft.recommendationType];
  const requiredApproverRoles = [...draft.requiredApprovals];
  const requiresApproval = requiredApproverRoles.length > 0 || draft.riskLevel === 'high' || draft.riskLevel === 'critical' || draft.protectedActions.length > 0;
  const traceRefs = requiredTraceRefs(options, draft.id);
  return {
    recommendationId: draft.id,
    tenantId: options.tenantId ?? draft.tenantId,
    racetrackId: options.racetrackId ?? draft.racetrackId,
    type,
    recommendationType: type,
    domain: options.domain ?? sharedDomainByExpertDomain[draft.domain],
    affectedAssets: [...draft.affectedAssets],
    summary: draft.recommendation,
    evidence: [...draft.evidence],
    confidence: draft.confidence,
    confidenceScore: confidenceScoreFor(draft.confidence, draft.riskLevel, options.confidenceDrivers ?? ['expert-draft-confidence', `risk:${draft.riskLevel}`]),
    evidencePackage: evidencePackageFor(draft.id, draft.evidence, draft.lineage, options),
    modelVersion: draft.modelId,
    policyReferences: policyReferencesForDraft(draft),
    riskLevel: draft.riskLevel,
    generatedAt: draft.createdAt,
    requiresApproval,
    requiredApproverRoles,
    approvalRequirement: {
      required: requiresApproval,
      policy: approvalPolicyForDraft(draft),
      requiredApproverRoles,
    },
    auditReference: {
      auditEventIds: traceRefs.auditEventIds,
      eventIds: traceRefs.eventIds,
      digitalTwinRefs: [...(options.digitalTwinRefs ?? draft.lineage.filter((item) => item.startsWith('twin:')))],
      correlationId: `ai-draft:${draft.id}`,
      integrityRef: options.evidencePackageId,
    },
    advisoryOnly: true,
    executionAllowed: false,
    blockedAutonomousExecution: true,
  };
}

export function recommendationDraftToRecommendationArtifact(draft: ExpertRecommendationDraft, options: AIRecommendationArtifactAdapterOptions = {}): AIRecommendationArtifact {
  return adaptAIRecommendationOutputToRecommendationArtifact(recommendationDraftToSharedAIOutput(draft, options), artifactMetadataForDraft(draft, options));
}

export function recommendationDraftToInsightArtifact(draft: ExpertRecommendationDraft, options: AIRecommendationArtifactAdapterOptions = {}): AIInsightArtifact {
  return adaptAIRecommendationOutputToInsightArtifact(recommendationDraftToSharedAIOutput(draft, options), artifactMetadataForDraft(draft, options));
}

export function recommendationDraftToForecastArtifact(draft: ExpertRecommendationDraft, options: AIRecommendationArtifactAdapterOptions = {}): AIForecastArtifact {
  return adaptAIRecommendationOutputToForecastArtifact(recommendationDraftToSharedAIOutput(draft, options), { ...artifactMetadataForDraft(draft, options), horizon: options.horizon });
}

export function governanceRecommendationToSharedAIOutput(record: RecommendationRecord, options: AIRecommendationArtifactAdapterOptions = {}): SharedAIRecommendationOutput {
  const requiresApproval = record.approvalPolicy !== 'none' || record.riskLevel === 'high' || record.riskLevel === 'critical';
  const type = options.type ?? sharedTypeForGovernanceRecord(record);
  const requiredApproverRoles = requiresApproval ? approverRolesForGovernanceRecord(record) : [];
  const traceRefs = requiredTraceRefs(options, record.id);
  return {
    recommendationId: record.id,
    tenantId: options.tenantId ?? record.tenantId ?? 'unknown-tenant',
    racetrackId: options.racetrackId ?? record.racetrackId ?? 'unknown-racetrack',
    type,
    recommendationType: type,
    domain: options.domain ?? sharedDomainForGovernanceRecord(record),
    affectedAssets: [...record.affectedAssets],
    summary: record.recommendation,
    evidence: [...record.evidence],
    confidence: record.confidence,
    confidenceScore: confidenceScoreFor(record.confidence, record.riskLevel, options.confidenceDrivers ?? ['governance-record-confidence', `risk:${record.riskLevel}`]),
    evidencePackage: evidencePackageFor(record.id, record.evidence, record.lineage, options),
    modelVersion: record.modelVersionId,
    policyReferences: policyReferencesForGovernanceRecord(record),
    riskLevel: record.riskLevel,
    generatedAt: record.createdAt,
    requiresApproval,
    requiredApproverRoles,
    approvalRequirement: {
      required: requiresApproval,
      policy: record.approvalPolicy,
      requiredApproverRoles,
    },
    auditReference: {
      auditEventIds: traceRefs.auditEventIds,
      eventIds: traceRefs.eventIds,
      digitalTwinRefs: [...(options.digitalTwinRefs ?? record.digitalTwinRefs ?? [])],
      correlationId: record.correlationId ?? record.id,
      integrityRef: options.evidencePackageId,
    },
    advisoryOnly: true,
    executionAllowed: false,
    blockedAutonomousExecution: true,
  };
}

export function governanceRecommendationToRecommendationArtifact(record: RecommendationRecord, options: AIRecommendationArtifactAdapterOptions = {}): AIRecommendationArtifact {
  return adaptAIRecommendationOutputToRecommendationArtifact(governanceRecommendationToSharedAIOutput(record, options), artifactMetadataForGovernanceRecord(record, options));
}

export function governanceRecommendationToInsightArtifact(record: RecommendationRecord, options: AIRecommendationArtifactAdapterOptions = {}): AIInsightArtifact {
  return adaptAIRecommendationOutputToInsightArtifact(governanceRecommendationToSharedAIOutput(record, options), artifactMetadataForGovernanceRecord(record, options));
}

export function governanceRecommendationToForecastArtifact(record: RecommendationRecord, options: AIRecommendationArtifactAdapterOptions = {}): AIForecastArtifact {
  return adaptAIRecommendationOutputToForecastArtifact(governanceRecommendationToSharedAIOutput(record, options), { ...artifactMetadataForGovernanceRecord(record, options), horizon: options.horizon });
}

function requiredTraceRefs(options: AIRecommendationArtifactAdapterOptions, recommendationId: string): { auditEventIds: string[]; eventIds: string[] } {
  const auditEventIds = [...(options.auditEventIds ?? [])].filter(Boolean);
  const eventIds = [...(options.eventIds ?? [])].filter(Boolean);
  if (auditEventIds.length === 0 || eventIds.length === 0) {
    throw new Error(`AI recommendation ${recommendationId} requires explicit auditEventIds and eventIds before it can be projected to the canonical AI output contract`);
  }
  return { auditEventIds, eventIds };
}

function evidencePackageFor(recommendationId: string, evidence: string[], lineage: string[], options: AIRecommendationArtifactAdapterOptions) {
  return {
    evidencePackageId: options.evidencePackageId ?? `evidence-package:${recommendationId}`,
    evidence: evidence.map((evidenceId) => ({
      evidenceId,
      kind: evidenceKindFor(evidenceId),
      source: evidenceId.split(':')[0] || 'ai-control-plane',
    })),
    lineage: [...new Set(lineage)],
    hash: options.evidencePackageId ? `sha256:${options.evidencePackageId}` : `sha256:${recommendationId}:${evidence.join('|')}`,
  };
}

function confidenceScoreFor(raw: number, riskLevel: RiskLevel, drivers: string[]) {
  const riskPenalty = riskLevel === 'critical' ? 0.08 : riskLevel === 'high' ? 0.04 : riskLevel === 'medium' ? 0.02 : 0;
  const calibrated = Math.max(0, Math.min(1, Number((raw - riskPenalty).toFixed(4))));
  const band: 'low' | 'medium' | 'high' = calibrated >= 0.85 ? 'high' : calibrated >= 0.65 ? 'medium' : 'low';
  return { raw, calibrated, band, drivers: [...new Set(drivers)] };
}

function evidenceKindFor(evidenceId: string): 'event' | 'audit' | 'digital-twin' | 'telemetry' | 'approval' | 'document' | 'model' | 'policy' {
  if (evidenceId.startsWith('event:') || evidenceId.startsWith('evt-')) return 'event';
  if (evidenceId.startsWith('audit:') || evidenceId.startsWith('immutable-audit-')) return 'audit';
  if (evidenceId.startsWith('twin:')) return 'digital-twin';
  if (evidenceId.startsWith('telemetry:')) return 'telemetry';
  if (evidenceId.startsWith('approval:') || evidenceId.startsWith('approval-')) return 'approval';
  if (evidenceId.startsWith('model:')) return 'model';
  if (evidenceId.startsWith('policy:')) return 'policy';
  return 'document';
}

type ExpertImplementation = (request: AIExpertRequest) => ExpertRecommendationDraft;

const expertImplementations: Record<ExpertModelId, ExpertImplementation> = {
  'model-surface-risk-v1': (request) => {
    const features = request.features as SurfaceRiskFeatureRecord;
    const sectionIds = features.sectionId ? [features.sectionId] : [...new Set(features.surface.telemetry.map((reading) => reading.sectionId))];
    const sections = sectionIds.map((sectionId) => analyzeSurfaceSection(sectionId, features.surface));
    const worst = [...sections].sort((a, b) => riskRank(b.riskLevel) - riskRank(a.riskLevel) || a.conditionScore - b.conditionScore)[0];
    const forecasts = forecastSurfaceRisk(features.surface).filter((forecast) => forecast.sectionId === worst.sectionId);
    const evidence = [
      ...worst.explanation.map((item) => `surface:${worst.sectionId}:${item.factor}:${item.evidence}`),
      ...forecasts.map((forecast) => `forecast:${forecast.sectionId}:${forecast.horizonHours}h:${forecast.predictedRisk}`),
    ];
    return draft(request, modelById.get('model-surface-risk-v1')!, {
      recommendation: worst.riskLevel === 'critical' || worst.riskLevel === 'high'
        ? `Recommend human surface review for ${worst.sectionId}; do not execute maintenance or race-readiness controls autonomously.`
        : `Recommend continued surface monitoring for ${worst.sectionId} with standard human inspection cadence.`,
      evidence,
      confidence: clamp01(0.62 + evidence.length * 0.025 + (forecasts.length ? 0.06 : 0)),
      riskLevel: normalizeSurfaceRisk(worst.riskLevel),
      requiredApprovals: worst.riskLevel === 'critical' || worst.riskLevel === 'high' ? ['track-superintendent', 'steward'] : ['track-superintendent-review'],
      affectedAssets: sections.map((section) => `surface-section:${section.sectionId}`),
      protectedActions: worst.riskLevel === 'critical' ? ['safety-critical-control'] : [],
      draftAction: worst.riskLevel === 'critical' ? lockedDraftAction('surface-track-closure-recommendation', `surface-section:${worst.sectionId}`, 'Recommend closure review package only; no autonomous closure is permitted.') : undefined,
    });
  },
  'model-race-readiness-v1': (request) => {
    const features = request.features as RaceReadinessFeatureRecord;
    const score = Math.round(average(features.checks.map((check) => check.score)));
    const status = features.checks.some((check) => check.status === 'blocked') || score < 70 ? 'blocked' : features.checks.some((check) => check.status === 'watch') || score < 90 ? 'watch' : 'ready';
    const exceptionChecks = features.checks.filter((check) => check.status !== 'ready' || check.approvalRequired);
    const evidence = features.checks.flatMap((check) => [`readiness:${check.domain}:${check.status}:score=${check.score}`, ...check.evidence]);
    return draft(request, modelById.get('model-race-readiness-v1')!, {
      recommendation: status === 'ready'
        ? `Recommend preparing a race-start approval package for ${features.raceId}; AI must not start the race.`
        : `Recommend holding ${features.raceId} in human readiness review until ${exceptionChecks.map((check) => check.domain).join(', ') || 'open'} checks clear.`,
      evidence,
      confidence: clamp01(0.55 + features.checks.length * 0.03 - exceptionChecks.length * 0.02),
      riskLevel: score < 70 ? 'critical' : score < 85 ? 'high' : score < 95 ? 'medium' : 'low',
      requiredApprovals: [...new Set(['steward', 'racing-secretary', ...exceptionChecks.map((check) => check.ownerRole)])],
      affectedAssets: [`race:${features.raceId}`, `track:${features.trackId}`, ...features.checks.map((check) => `readiness:${check.domain}`)],
      protectedActions: ['race-start'],
      draftAction: lockedDraftAction('race-start-readiness-package', `race:${features.raceId}`, 'Draft readiness package only; race start remains human controlled.'),
    });
  },
  'model-gate-position-v1': (request) => {
    const features = request.features as GatePositionFeatureRecord;
    const sectors = features.sectors ?? [];
    const change = features.proposedMove ? generateGateMoveChange(features.currentChange, features.proposedMove, sectors) : features.currentChange;
    const plan = buildTrackConfigurationExecutionPlan(change, features.boundaries ?? [], sectors);
    const gateId = change.raceSetup.gatePlacement.gateId;
    const issues = [...plan.geospatialValidation.errors, ...plan.geospatialValidation.warnings, ...plan.simulation.issues];
    return draft(request, modelById.get('model-gate-position-v1')!, {
      recommendation: `Recommend draft gate work order ${plan.workOrders[0]?.id ?? 'pending'} for ${gateId}; physical gate movement and work-order issuance remain locked for human approval and field verification.`,
      evidence: [
        `gate:${gateId}`,
        `race:${change.raceSetup.raceId}`,
        `simulation:score=${plan.simulation.score}`,
        `executionMode:${plan.executionMode}`,
        `noLiveActuatorControl:${plan.noLiveActuatorControl}`,
        ...issues.map((issue) => `gate-validation:${issue}`),
      ],
      confidence: clamp01(0.52 + plan.simulation.score / 250 - issues.length * 0.03),
      riskLevel: plan.geospatialValidation.valid && plan.simulation.safe ? 'medium' : issues.length > 2 ? 'critical' : 'high',
      requiredApprovals: plan.approvalRequirements,
      affectedAssets: [`starting-gate:${gateId}`, `race:${change.raceSetup.raceId}`, `track-configuration:${change.id}`],
      protectedActions: ['safety-critical-control'],
      draftAction: { ...lockedDraftAction('starting-gate-move', `starting-gate:${gateId}`, 'Recommend move/work-order package only; no physical movement or actuator control is permitted.'), physicalMovementAllowed: false },
    });
  },
  'model-equine-advisory-v1': (request) => {
    const features = request.features as EquineAdvisoryFeatureRecord;
    const score = nonDiagnosticRiskScore(features.profile);
    const riskLevel: RiskLevel = score.score >= 75 ? 'critical' : score.score >= 50 ? 'high' : score.score >= 25 ? 'medium' : 'low';
    return draft(request, modelById.get('model-equine-advisory-v1')!, {
      recommendation: `Recommend veterinarian review for ${features.horseName ?? features.profile.horseId}. ${score.disclaimer}`,
      evidence: [`horse:${features.profile.horseId}`, `risk-score:${score.score}`, ...score.factors.map((factor) => `equine-factor:${factor}`)],
      confidence: clamp01(Math.max(0.5, Math.min(0.95, score.score / 100 + 0.25))),
      riskLevel,
      requiredApprovals: ['veterinarian'],
      affectedAssets: [`horse:${features.profile.horseId}`],
      protectedActions: riskLevel === 'high' || riskLevel === 'critical' ? ['medication-decision', 'clear-vet-flag', 'scratch-horse'] : ['medication-decision'],
      draftAction: lockedDraftAction('veterinary-review-only', `horse:${features.profile.horseId}`, 'Advisory veterinary review package only; AI cannot make medical or scratch decisions.'),
    });
  },
  'model-security-anomaly-v1': (request) => {
    const features = request.features as SecurityAnomalyFeatureRecord;
    const signals = features.signals;
    const scoped = signals.filter((signal) => !features.scope || signal.subject === features.scope || signal.location === features.scope || features.scope === 'enterprise');
    const score = Math.round(average(scoped.map((signal) => securityRiskWeight[signal.severity] * signal.confidence + (signal.restrictedArea ? 10 : 0))));
    const hasCritical = scoped.some((signal) => signal.severity === 'critical' || (signal.restrictedArea && signal.severity === 'high'));
    const riskLevel: RiskLevel = hasCritical || score >= 85 ? 'critical' : score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
    const drivers = [...new Set(scoped.flatMap((signal) => [signal.type, ...(signal.cyberTactics ?? []), ...(signal.controls ?? [])]))];
    return draft(request, modelById.get('model-security-anomaly-v1')!, {
      recommendation: `Recommend security triage for ${features.scope ?? 'enterprise'} with evidence preservation and human incident routing; no emergency action is executed by AI.`,
      evidence: scoped.flatMap((signal) => [`security-signal:${signal.id}:${signal.severity}`, ...(signal.evidenceUris ?? [])]),
      confidence: clamp01(0.5 + scoped.length * 0.04 + (hasCritical ? 0.1 : 0)),
      riskLevel,
      requiredApprovals: riskLevel === 'critical' ? ['security', 'incident-commander', 'compliance-officer'] : ['security'],
      affectedAssets: [...new Set(scoped.flatMap((signal) => [signal.subject, signal.location]))],
      protectedActions: riskLevel === 'critical' || drivers.includes('emergency-response') ? ['emergency-action'] : [],
      draftAction: lockedDraftAction('security-incident-triage', features.scope ?? 'enterprise', 'Recommend investigation/escalation package only; emergency controls stay human controlled.'),
    });
  },
  'model-weather-impact-v1': (request) => {
    const features = request.features as WeatherImpactFeatureRecord;
    const weather = features.weather;
    const impactScore =
      weather.rainfallMm * 2 +
      weather.forecastRainMm * 3 +
      weather.windMph * 1.2 +
      (weather.lightningMiles !== undefined ? Math.max(0, 12 - weather.lightningMiles) * 8 : 0) +
      Math.max(0, weather.temperature - 88) * 2;
    const riskLevel: RiskLevel = impactScore >= 80 ? 'critical' : impactScore >= 55 ? 'high' : impactScore >= 30 ? 'medium' : 'low';
    return draft(request, modelById.get('model-weather-impact-v1')!, {
      recommendation: riskLevel === 'critical'
        ? 'Recommend immediate human weather hold review; AI does not stop or start races.'
        : 'Recommend monitoring weather impact and attaching forecast evidence to race-day readiness review.',
      evidence: [`rainfall:${weather.rainfallMm}`, `forecastRain:${weather.forecastRainMm}`, `wind:${weather.windMph}`, `temperature:${weather.temperature}`, `lightningMiles:${weather.lightningMiles ?? 'not-reported'}`],
      confidence: clamp01(0.58 + Math.min(0.32, impactScore / 250)),
      riskLevel,
      requiredApprovals: riskLevel === 'critical' || riskLevel === 'high' ? ['steward', 'race-day-commander', 'track-superintendent'] : ['weather-desk'],
      affectedAssets: [`track:${features.trackId ?? 'track'}`, ...(features.affectedRaceIds ?? []).map((raceId) => `race:${raceId}`)],
      protectedActions: riskLevel === 'critical' ? ['race-stop', 'race-start'] : [],
      draftAction: lockedDraftAction('weather-impact-review', features.trackId ?? 'track', 'Weather impact recommendation only; race controls remain human controlled.'),
    });
  },
  'model-maintenance-forecast-v1': (request) => {
    const features = request.features as MaintenanceForecastFeatureRecord;
    const predictions = features.signals.map((signal) => predictMaintenance(signal));
    const worst = [...predictions].sort((a, b) => b.failureProbability - a.failureProbability)[0];
    const riskLevel: RiskLevel = !worst ? 'low' : worst.failureProbability >= 0.75 ? 'critical' : worst.failureProbability >= 0.55 ? 'high' : worst.failureProbability >= 0.35 ? 'medium' : 'low';
    return draft(request, modelById.get('model-maintenance-forecast-v1')!, {
      recommendation: worst ? `Recommend ${worst.priority} maintenance planning for ${worst.assetId}; work order execution requires human approval when operational impact exists.` : 'Recommend maintaining standard preventive maintenance cadence.',
      evidence: predictions.flatMap((prediction) => [`maintenance:${prediction.assetId}:failureProbability=${prediction.failureProbability}`, `maintenance:${prediction.assetId}:priority=${prediction.priority}`]),
      confidence: clamp01(0.55 + predictions.length * 0.04 + (worst?.failureProbability ?? 0) * 0.2),
      riskLevel,
      requiredApprovals: riskLevel === 'critical' || riskLevel === 'high' ? ['facilities-supervisor', 'operations-command'] : ['maintenance-dispatcher'],
      affectedAssets: predictions.map((prediction) => `asset:${prediction.assetId}`),
      protectedActions: riskLevel === 'critical' ? ['safety-critical-control'] : [],
      draftAction: worst ? lockedDraftAction('facility-maintenance-work-order-draft', `asset:${worst.assetId}`, 'Draft maintenance work order recommendation only; execution remains approval gated.') : undefined,
    });
  },
  'model-steward-evidence-v1': (request) => {
    const features = request.features as StewardEvidenceFeatureRecord;
    const inquiry = structuredClone(features.inquiry);
    const organization = organizeEvidenceForStewards(inquiry, { actorId: features.actorId ?? 'steward-evidence-ai', generatedAt: features.generatedAt, missingEvidence: features.missingEvidence });
    const missingEvidence = organization.missingEvidence.length;
    return draft(request, modelById.get('model-steward-evidence-v1')!, {
      recommendation: `Recommend steward evidence review using ${organization.clusters.length} organized evidence cluster(s). AI did not issue a ruling or modify official results.`,
      evidence: [...organization.clusters.flatMap((cluster) => [...cluster.evidenceIds, ...cluster.ruleIds]), ...organization.limitations],
      confidence: clamp01(0.6 + organization.clusters.length * 0.05 - missingEvidence * 0.04),
      riskLevel: missingEvidence > 2 ? 'high' : missingEvidence > 0 ? 'medium' : 'low',
      requiredApprovals: ['steward-review'],
      affectedAssets: [`inquiry:${inquiry.id}`, `race:${inquiry.raceId}`, ...inquiry.involvedHorses.map((horse) => `horse:${horse.horseId}`)],
      protectedActions: ['steward-ruling', 'modify-official-results', 'official-results'],
      draftAction: { ...lockedDraftAction('organize-steward-evidence', `inquiry:${inquiry.id}`, 'Evidence organization and summary only; official ruling and result changes are prohibited for AI.'), officialRuling: false, mayModifyOfficialResults: false },
    });
  },
  'model-executive-intelligence-v1': (request) => {
    const features = request.features as ExecutiveIntelligenceFeatureRecord;
    const highRiskItems = features.briefingItems.filter((item) => item.status === 'critical' || item.status === 'blocked' || item.riskLevel === 'critical' || item.riskLevel === 'high');
    const protectedActionsForItems = [...new Set(features.briefingItems.flatMap((item) => item.protectedActions ?? []))];
    return draft(request, modelById.get('model-executive-intelligence-v1')!, {
      recommendation: `Recommend executive review of ${highRiskItems.length} elevated domain(s): ${highRiskItems.map((item) => item.domain).join(', ') || 'none'}. AI output is briefing-only.`,
      evidence: features.briefingItems.flatMap((item) => [`executive:${item.domain}:${item.status}`, ...item.evidence]),
      confidence: clamp01(0.62 + features.briefingItems.length * 0.025 - highRiskItems.length * 0.015),
      riskLevel: highRiskItems.some((item) => item.status === 'critical' || item.riskLevel === 'critical') ? 'critical' : highRiskItems.length > 0 ? 'high' : 'medium',
      requiredApprovals: highRiskItems.length > 0 ? ['executive-sponsor', 'compliance-officer'] : ['executive-review'],
      affectedAssets: features.briefingItems.map((item) => `domain:${item.domain}`),
      protectedActions: protectedActionsForItems,
      draftAction: lockedDraftAction('executive-briefing', 'enterprise', 'Briefing recommendation only; protected controls remain governed in source domains.'),
    });
  },
};

const sharedDomainByExpertDomain: Record<AIControlPlaneDomain, SharedAIControlPlaneDomain> = {
  'surface-risk': 'surface',
  'race-readiness': 'race',
  'gate-position': 'gate',
  'equine-advisory': 'equine',
  'security-anomaly': 'security',
  'weather-impact': 'weather',
  'maintenance-forecasting': 'operations',
  'steward-evidence': 'audit',
  'executive-intelligence': 'operations',
};

const sharedRecommendationTypeByExpertType: Record<AIRecommendationType, SharedAIRecommendationType> = {
  'risk-assessment': 'risk-assessment',
  readiness: 'readiness-check',
  'position-recommendation': 'draft-action',
  advisory: 'advisory',
  anomaly: 'advisory',
  'impact-forecast': 'forecast',
  'maintenance-forecast': 'forecast',
  'evidence-assistance': 'evidence-summary',
  'executive-briefing': 'evidence-summary',
};

function artifactMetadataForDraft(draft: ExpertRecommendationDraft, options: AIRecommendationArtifactAdapterOptions): AIArtifactAdapterMetadata {
  return {
    ...options,
    artifactId: options.artifactId,
    createdAt: options.createdAt ?? draft.createdAt,
    sourceSystem: options.sourceSystem ?? draft.modelId,
    evidence: uniqueStrings([...(options.evidence ?? []), ...draft.evidence]),
    lineage: uniqueStrings([...(options.lineage ?? []), ...draft.lineage]),
    dataClassification: options.dataClassification ?? 'restricted',
    digitalTwinRefs: uniqueStrings([...(options.digitalTwinRefs ?? []), ...draft.affectedAssets.filter((asset) => asset.startsWith('twin:'))]),
  };
}

function artifactMetadataForGovernanceRecord(record: RecommendationRecord, options: AIRecommendationArtifactAdapterOptions): AIArtifactAdapterMetadata {
  return {
    ...options,
    artifactId: options.artifactId,
    tenantId: options.tenantId ?? record.tenantId,
    racetrackId: options.racetrackId ?? record.racetrackId,
    createdAt: options.createdAt ?? record.createdAt,
    sourceSystem: options.sourceSystem ?? record.modelVersionId,
    evidence: uniqueStrings([...(options.evidence ?? []), ...record.evidence]),
    lineage: uniqueStrings([...(options.lineage ?? []), ...record.lineage]),
    dataClassification: options.dataClassification ?? 'restricted',
    digitalTwinRefs: uniqueStrings([...(options.digitalTwinRefs ?? []), ...(record.digitalTwinRefs ?? []), ...record.affectedAssets.filter((asset) => asset.startsWith('twin:'))]),
  };
}

function sharedTypeForGovernanceRecord(record: RecommendationRecord): SharedAIRecommendationType {
  if (record.activity === 'forecast' || /forecast/i.test(record.action)) return 'forecast';
  if (record.activity === 'summarize') return 'evidence-summary';
  if (record.activity === 'create-draft-action' || /draft|move|start|stop|execute/i.test(record.action)) return 'draft-action';
  if (/readiness/i.test(record.action)) return 'readiness-check';
  if (record.riskLevel === 'high' || record.riskLevel === 'critical') return 'risk-assessment';
  return 'advisory';
}

function sharedDomainForGovernanceRecord(record: RecommendationRecord): SharedAIControlPlaneDomain {
  const text = `${record.action} ${record.target} ${record.affectedAssets.join(' ')}`.toLowerCase();
  if (/surface|track-closure|harrow|irrigation|rolling/.test(text)) return 'surface';
  if (/race|steward|official-results|scratch/.test(text)) return 'race';
  if (/gate/.test(text)) return 'gate';
  if (/horse|vet|veterinary|medication/.test(text)) return 'equine';
  if (/security|emergency|restricted/.test(text)) return 'security';
  if (/weather|rain|wind|lightning/.test(text)) return 'weather';
  if (/audit|compliance|evidence/.test(text)) return 'audit';
  return 'operations';
}

function approverRolesForGovernanceRecord(record: RecommendationRecord): string[] {
  if (record.approvalPolicy === 'veterinarian') return ['veterinarian'];
  if (record.approvalPolicy === 'steward') return ['steward'];
  if (record.approvalPolicy === 'two-person') return ['steward', 'compliance-officer'];
  if (record.approvalPolicy === 'governance-board') return ['compliance-officer', 'admin'];
  if (/gate/i.test(record.action)) return ['racing-secretary', 'track-superintendent'];
  if (/surface|harrow|irrigation|rolling/i.test(record.action)) return ['track-superintendent'];
  return ['compliance-officer'];
}

function policyReferencesForDraft(draft: ExpertRecommendationDraft): string[] {
  return uniqueStrings([
    'trackmind-ai-advisory-only-v1',
    `approval-policy:${approvalPolicyForDraft(draft)}`,
    ...draft.protectedActions.map((action) => `protected-action:${action}`),
    ...draft.governanceControls.flatMap((control) => control.controls.map((item) => `${control.framework}:${item}`)),
  ]);
}

function policyReferencesForGovernanceRecord(record: RecommendationRecord): string[] {
  return uniqueStrings([
    'trackmind-ai-advisory-only-v1',
    `approval-policy:${record.approvalPolicy}`,
    `action:${record.action}`,
    ...record.lineage.filter((item) => item.startsWith('policy:') || item.startsWith('control:')),
  ]);
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function registryRecord(
  id: ExpertModelId,
  name: string,
  controlPlaneDomain: AIControlPlaneDomain,
  expertDomain: ExpertDomain,
  recommendationTypes: AIRecommendationType[],
  featureRecordTypes: string[],
  purpose: string,
  criticality: ModelRegistration['criticality'],
  dataClassification: ModelRegistration['dataClassification'],
): ExpertModelRegistryRecord {
  return {
    id,
    name,
    version: '1.0.0',
    owner: 'responsible-ai-governance',
    purpose,
    criticality,
    dataClassification,
    intendedUse: ['deterministic-recommendation-draft', 'evidence-based-human-review', ...recommendationTypes],
    prohibitedUse: ['autonomous-protected-control-execution', 'physical-actuator-control', 'official-ruling', 'medical-decision'],
    lineage: [`expert-domain:${expertDomain}`, `control-plane-domain:${controlPlaneDomain}`, 'deterministic-placeholder-formulas'],
    evidence: ['model-card:deterministic-placeholder', 'advisory-boundary-test-plan', 'protected-action-constraints'],
    registeredAt,
    status: 'registered',
    controlPlaneDomain,
    expertDomain,
    recommendationTypes,
    featureRecordTypes,
    deterministicPlaceholder: true,
    advisoryOnly: true,
    blockedAutonomousExecution: true,
    protectedControlExecutionAllowed: false,
    governanceControls: isoNistControls.map((control) => ({ ...control, controls: [...control.controls], evidence: [...control.evidence] })),
  };
}

function agentRegistryRecord(model: ExpertModelRegistryRecord, timestamp: string): AIAgentRegistryRecord {
  const promptId = `prompt-${model.controlPlaneDomain}-v1`;
  const agentId = `agent-${model.controlPlaneDomain}`;
  return {
    agent: {
      id: agentId,
      name: `${model.name} Agent`,
      owner: model.owner,
      modelVersionId: model.id,
      promptTemplateId: promptId,
      status: 'active',
      allowedActions: [
        `recommend-${model.controlPlaneDomain}`,
        `${model.controlPlaneDomain}-draft-action`,
        'surface-track-closure-recommendation',
        'race-start-readiness-package',
        'starting-gate-move',
        'veterinary-review-only',
        'security-incident-triage',
        'weather-impact-review',
        'facility-maintenance-work-order-draft',
        'organize-steward-evidence',
        'executive-briefing',
      ],
      restrictedActions: [...protectedActions, 'starting-gate-move', 'steward-ruling', 'modify-official-results', 'physical-gate-movement'],
      allowedActivities: allowedActivitiesFor(model),
      digitalTwinRefs: [`domain:${model.controlPlaneDomain}`],
    },
    promptTemplate: {
      id: promptId,
      name: `${model.name} advisory prompt`,
      version: '1.0.0',
      owner: 'prompt-review-board',
      template: 'Produce recommendations only with evidence, confidence, risk level, required approvals, affected assets, blocked autonomous execution, and protected-action constraints.',
      evidence: ['prompt-review:advisory-only', 'guardrail:protected-control-block'],
      status: 'approved',
      allowedActivities: allowedActivitiesFor(model),
      safetyPolicyId: 'trackmind-ai-advisory-only-v1',
    },
    evaluation: {
      modelId: model.id,
      evaluatedAt: timestamp,
      evaluator: 'responsible-ai-governance',
      metrics: { determinism: 1, schemaCompleteness: 1, protectedActionBlockRate: 1, calibrationPlaceholder: 0.86 },
      explainability: { method: 'formula-and-evidence-lineage', score: 0.92, artifacts: [`model-card:${model.id}`, 'deterministic-formula-notes'] },
      safety: { passed: true, controls: ['advisory-only', 'blocked-autonomous-execution', 'human-approval-required-for-protected-controls'], redTeamFindings: 0 },
      fairness: { score: 0.9, segments: ['race-day-domain', 'asset-domain', 'animal-welfare-domain', 'security-domain'] },
      privacy: { personalDataUsed: model.dataClassification === 'personal-data', controls: ['data-minimization', 'role-based-review'] },
      security: { threatModelReviewed: true, vulnerabilitiesOpen: 0 },
      quality: { reliability: 0.91, maintainability: 0.9, performanceEfficiency: 0.88 },
    },
    riskAssessment: {
      modelId: model.id,
      assessedAt: timestamp,
      assessor: 'enterprise-risk-management',
      impact: model.criticality === 'safety-critical' ? 5 : model.criticality === 'high' ? 4 : 3,
      likelihood: 2,
      mitigations: ['recommendation-only boundary', 'human approval gates', 'audit evidence lineage', 'protected action blocking'],
      residualRiskAcceptedBy: model.criticality === 'safety-critical' ? 'responsible-ai-governance-board' : undefined,
    },
    governanceControls: model.governanceControls.map((control) => ({ ...control, controls: [...control.controls], evidence: [...control.evidence] })),
  };
}

function draft(request: AIExpertRequest, model: ExpertModelRegistryRecord, body: Omit<ExpertRecommendationDraft, 'id' | 'tenantId' | 'racetrackId' | 'modelId' | 'agentId' | 'promptTemplateId' | 'domain' | 'expertDomain' | 'recommendationType' | 'governanceControls' | 'advisoryOnly' | 'blockedAutonomousExecution' | 'protectedControlExecutionAllowed' | 'createdAt' | 'lineage' | 'limitations'>): ExpertRecommendationDraft {
  const createdAt = request.requestedAt ?? new Date().toISOString();
  const id = request.id ?? `ai-draft-${model.controlPlaneDomain}-${stableHash(JSON.stringify({ domain: request.domain, recommendationType: request.recommendationType, createdAt }))}`;
  return {
    ...body,
    id,
    tenantId: request.tenantId ?? 'control-plane-tenant',
    racetrackId: request.racetrackId ?? 'control-plane-racetrack',
    modelId: model.id,
    agentId: `agent-${model.controlPlaneDomain}`,
    promptTemplateId: `prompt-${model.controlPlaneDomain}-v1`,
    domain: model.controlPlaneDomain,
    expertDomain: model.expertDomain,
    recommendationType: request.recommendationType,
    confidence: clamp01(body.confidence),
    evidence: [...new Set(body.evidence.length ? body.evidence : [`model:${model.id}`])],
    requiredApprovals: [...new Set(body.requiredApprovals)],
    affectedAssets: [...new Set(body.affectedAssets.length ? body.affectedAssets : [`domain:${model.controlPlaneDomain}`])],
    protectedActions: [...new Set(body.protectedActions)],
    governanceControls: model.governanceControls.map((control) => ({ ...control, controls: [...control.controls], evidence: [...control.evidence] })),
    advisoryOnly: true,
    blockedAutonomousExecution: true,
    protectedControlExecutionAllowed: false,
    createdAt,
    lineage: [`agent:agent-${model.controlPlaneDomain}`, `model:${model.id}`, `prompt:prompt-${model.controlPlaneDomain}-v1`, `router:${request.domain}:${request.recommendationType}`],
    limitations: [
      'Recommendation only; no protected control, physical movement, official ruling, medical decision, payout, or safety-critical action may be executed by this model.',
      'Human owners must review source evidence and approve any operational workflow before execution.',
    ],
  };
}

function lockedDraftAction(action: string, target: string, description: string): ExpertDraftAction {
  return { action, target, description, executionAllowed: false };
}

function asGovernanceModel(model: ExpertModelRegistryRecord, timestamp: string): ModelRegistration {
  return {
    id: model.id,
    name: model.name,
    version: model.version,
    owner: model.owner,
    purpose: model.purpose,
    criticality: model.criticality,
    dataClassification: model.dataClassification,
    intendedUse: [...model.intendedUse],
    prohibitedUse: [...model.prohibitedUse],
    lineage: [...model.lineage],
    evidence: [...model.evidence, ...model.governanceControls.flatMap((control) => control.evidence)],
    registeredAt: timestamp,
    status: model.status,
  };
}

function allowedActivitiesFor(model: ExpertModelRegistryRecord): AIAllowedActivity[] {
  const activities = new Set<AIAllowedActivity>(['recommend', 'summarize', 'classify', 'prioritize']);
  if (model.recommendationTypes.includes('impact-forecast') || model.recommendationTypes.includes('maintenance-forecast')) activities.add('forecast');
  if (model.recommendationTypes.includes('position-recommendation')) {
    activities.add('simulate');
    activities.add('create-draft-action');
  }
  if (model.recommendationTypes.includes('evidence-assistance') || model.recommendationTypes.includes('executive-briefing')) activities.add('summarize');
  return [...activities];
}

function approvalPolicyForDraft(draft: ExpertRecommendationDraft): GovernanceApprovalPolicy {
  if (draft.requiredApprovals.includes('veterinarian')) return 'veterinarian';
  if (draft.requiredApprovals.includes('steward') || draft.requiredApprovals.includes('steward-review')) return 'steward';
  if (draft.riskLevel === 'critical') return 'two-person';
  if (draft.riskLevel === 'high') return 'single-human';
  return 'none';
}

function normalizeSurfaceRisk(level: SurfaceRiskLevel): RiskLevel {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'moderate') return 'medium';
  return 'low';
}

function riskRank(level: SurfaceRiskLevel | RiskLevel): number {
  return ({ low: 1, moderate: 2, medium: 2, high: 3, critical: 4 } satisfies Record<SurfaceRiskLevel | RiskLevel, number>)[level];
}

const securityRiskWeight: Record<RiskLevel, number> = { low: 15, medium: 40, high: 70, critical: 95 };

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value: number): number {
  return Number(Math.max(0.01, Math.min(0.99, value)).toFixed(2));
}

function stableHash(value: string): string {
  let acc = 0;
  for (const char of value) acc = (Math.imul(31, acc) + char.charCodeAt(0)) | 0;
  return (acc >>> 0).toString(16).padStart(8, '0');
}

function cloneRegistryRecord(record: ExpertModelRegistryRecord): ExpertModelRegistryRecord {
  return {
    ...record,
    intendedUse: [...record.intendedUse],
    prohibitedUse: [...record.prohibitedUse],
    lineage: [...record.lineage],
    evidence: [...record.evidence],
    recommendationTypes: [...record.recommendationTypes],
    featureRecordTypes: [...record.featureRecordTypes],
    governanceControls: record.governanceControls.map((control) => ({ ...control, controls: [...control.controls], evidence: [...control.evidence] })),
  };
}
