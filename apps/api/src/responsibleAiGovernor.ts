import { aiAllowedActivities, normalizeProtectedActionIntent, protectedActions, type AIAllowedActivity, type CanonicalEventRef, type ProtectedAction } from '@trackmind/shared';
import type { ApprovalStore, CentralizedApprovalService, ControlledAction, ControlledActionRequest } from './approvals.js';
import type { ImmutableAuditLog } from './auditLog.js';
import type { EventContract, UniversalEventBus } from './eventBus.js';

export type GovernanceFramework = 'ISO42001' | 'ISO27001' | 'ISO27701' | 'ISO25010' | 'ISO31000' | 'NIST-AI-RMF' | 'Enterprise-Governance';
export type ModelCriticality = 'low' | 'medium' | 'high' | 'safety-critical';
export type ModelLifecycleStatus = 'registered' | 'evaluating' | 'pending-approval' | 'approved' | 'deployed' | 'suspended' | 'retired' | 'rolled-back';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';


export type AIControlPlaneEventType =
  | 'ai.input.ingested'
  | 'ai.features.built'
  | 'ai.model.selected'
  | 'ai.recommendation.created'
  | 'ai.governor.reviewed'
  | 'ai.action.blocked'
  | 'ai.approval.required'
  | 'ai.dashboard.updated';
export type AIGovernanceEventType = AIControlPlaneEventType | 'ai.agent.registered' | 'ai.model.registered' | 'ai.model.evaluated' | 'ai.prompt.published' | 'ai.recommendation.recorded' | 'ai.recommendation.blocked' | 'ai.approval.workflow.created' | 'ai.autonomous-execution.blocked' | 'ai.safety.policy.enforced' | 'ai.digital-twin.impact.queued' | 'ai.override.recorded' | 'ai.rollback.recorded' | 'ai.metric.observed';
export type GovernanceRecommendationStatus = 'queued' | 'pending-approval' | 'approved' | 'safety-blocked' | 'advisory-reviewed' | 'overridden' | 'rolled-back';
export type GovernanceApprovalPolicy = 'none' | 'single-human' | 'two-person' | 'governance-board' | 'veterinarian' | 'steward' | 'role-policy-map';

export interface AIAgent { id: string; name: string; owner: string; modelVersionId: string; promptTemplateId: string; status: 'active' | 'paused' | 'retired'; allowedActions: string[]; restrictedActions: string[]; allowedActivities?: AIAllowedActivity[]; tenantId?: string; digitalTwinRefs?: string[]; }
export interface PromptTemplate { id: string; name: string; version: string; owner: string; template: string; evidence: string[]; status: 'draft' | 'approved' | 'retired'; allowedActivities?: AIAllowedActivity[]; safetyPolicyId?: string; }
export interface AIEvidencePackage { id: string; recommendationId?: string; evidence: string[]; lineage: string[]; createdAt: string; hash: string; }
export interface ConfidenceScore { raw: number; calibrated: number; band: 'low' | 'medium' | 'high'; drivers: string[]; }
export interface ExplainabilityRecord { recommendationId: string; method: string; rationale: string; citedEvidence: string[]; limitations: string[]; humanReviewRequired: boolean; score: number; }
export interface ApprovalRequirementRecord { id: string; recommendationId: string; action: string; policy: GovernanceApprovalPolicy; requiredRoles: string[]; status: 'not-required' | 'pending' | 'approved' | 'rejected'; evidence: string[]; approvalRequestId?: string; controlledAction?: ControlledAction; workflowRecordId?: string; auditId?: string; eventId?: string; }
export interface AIControlPlaneContext { tenantId: string; racetrackId: string; correlationId: string; causationId?: string; aggregateId?: string; subjectId?: string; subjectType?: string; auditRef?: string; digitalTwinRef?: string; digitalTwinRefs?: string[]; approvalRef?: string; workflowRef?: string; sourceService?: string; }
export interface AIInputIngestionRecord { id: string; source: string; actor: string; tenantId: string; racetrackId: string; correlationId: string; causationId?: string; inputRef: string; inputHash: string; schemaId?: string; dataClassification: 'public' | 'internal' | 'confidential' | 'restricted' | 'personal-data'; evidence: string[]; ingestedAt: string; digitalTwinRefs?: string[]; }
export interface AIFeatureBuildRecord { id: string; inputId: string; featureSetId: string; actor: string; tenantId: string; racetrackId: string; correlationId: string; causationId?: string; features: string[]; evidence: string[]; builtAt: string; digitalTwinRefs?: string[]; }
export interface AIModelSelectionRecord { id: string; featureBuildId: string; modelVersionId: string; actor: string; tenantId: string; racetrackId: string; correlationId: string; causationId?: string; candidateModelIds: string[]; selectionReason: string; evidence: string[]; selectedAt: string; digitalTwinRefs?: string[]; }
export type AIGovernorReviewDecision = 'approved' | 'requires-human-approval' | 'blocked';
export interface AIGovernorPolicyConfig { id: string; blockedActions: string[]; approvalRoles: Record<string, string[]>; automaticAdvisoryActions: string[]; requiredEvidence: string[]; policyEvidence: string[]; defaultApprovalRoles: string[]; }
export interface AutonomousPermissionReviewInput { action: string; recommendationId: string; riskLevel: RiskLevel; requiresApproval: boolean; evidence: string[]; target?: string; actor?: string; tenantId?: string; racetrackId?: string; correlationId?: string; causationId?: string; reviewedAt?: string; digitalTwinRefs?: string[]; }
export interface AIGovernorReviewRecord { id: string; recommendationId?: string; action: string; canonicalAction?: string; target?: string; actor: string; tenantId: string; racetrackId: string; correlationId: string; causationId?: string; allowed: boolean; decision?: AIGovernorReviewDecision; reason?: string; riskLevel: RiskLevel; approvalRequired: boolean; policyAllowsAutomation?: boolean; responsibleAIGovernorApproved?: boolean; canExecute?: boolean; policyEvidence?: string[]; requiredApproverRoles?: string[]; blockedAutonomousExecution?: boolean; evidence: string[]; reviewedAt: string; auditRef?: string; eventRef?: string; digitalTwinRefs?: string[]; }
export interface AIDashboardUpdateRecord { id: string; dashboardId: string; actor: string; tenantId: string; racetrackId: string; correlationId: string; causationId?: string; summary: string; metrics: Record<string, number>; evidence: string[]; updatedAt: string; digitalTwinRefs?: string[]; }
export interface AIDigitalTwinImpact { twinId: string; assetId: string; kind: 'ai-agent' | 'asset' | 'workflow' | 'approval' | 'incident'; patch: Record<string, unknown>; approvalRequired: boolean; recommendationId: string; eventType: string; auditId?: string; advisoryOnly?: true; }
export interface ObservabilityRecord { id: string; subjectId: string; metric: 'confidence' | 'evidence-count' | 'approval-required' | 'blocked-action' | 'drift' | 'latency' | 'error-rate' | 'safety-incident' | 'privacy-event' | 'security-event' | 'quality-regression'; value: number; threshold?: number; status: 'nominal' | 'warning' | 'critical'; traceId: string; observedAt: string; evidence: string[]; }
export interface SafetyPolicy { id: string; allowedActivities: AIAllowedActivity[]; protectedActions: string[]; prohibitedAutonomousActions: string[]; blockedActions: string[]; approvalRoles: Record<string, string[]>; automaticAdvisoryActions: string[]; requiredEvidence: string[]; humanApprovalRequiredFor: string[]; }
export interface RecommendationRecord { id: string; agentId: string; modelVersionId: string; promptTemplateId: string; tenantId?: string; racetrackId?: string; correlationId?: string; causationId?: string; activity?: AIAllowedActivity; action: string; target: string; recommendation: string; confidence: number; affectedAssets: string[]; evidence: string[]; lineage: string[]; approvalPolicy: GovernanceApprovalPolicy; riskLevel: RiskLevel; status?: GovernanceRecommendationStatus; createdAt: string; digitalTwinRefs?: string[]; explainability?: Partial<ExplainabilityRecord>; digitalTwinImpacts?: Array<Omit<AIDigitalTwinImpact, 'recommendationId' | 'eventType'>>; }
export interface OverrideRecord { id: string; recommendationId: string; actor: string; reason: string; evidence: string[]; createdAt: string; }
export interface RollbackRecord { id: string; recommendationId: string; actor: string; reason: string; restoredVersionId: string; evidence: string[]; createdAt: string; }
export interface AIGovernanceEvent extends Pick<CanonicalEventRef, 'eventId' | 'eventType' | 'tenantId' | 'racetrackId' | 'actorId' | 'source' | 'timestamp' | 'version'> { id: string; type: AIGovernanceEventType; subjectId: string; actor: string; evidence: string[]; lineage: string[]; auditId?: string; correlationId?: string; causationId?: string; digitalTwinRefs?: string[]; payload?: Record<string, unknown>; }
export interface DraftWorkOrderRecord { id: string; recommendationId: string; action: string; controlledAction?: ControlledAction; target: string; summary: string; affectedAssets: string[]; evidence: string[]; riskLevel: RiskLevel; createdAt: string; executionState: 'draft-only'; executionAllowed: false; }
export interface HumanInLoopWorkflowRecord { id: string; recommendationId: string; action: string; controlledAction?: ControlledAction; target: string; affectedAssets: string[]; evidence: string[]; riskLevel: RiskLevel; requiredRoles: string[]; approvalRequestId?: string; auditId: string; eventId: string; status: 'draft' | 'pending-approval' | 'safety-blocked'; draftWorkOrderId?: string; advisoryOnly: true; executionAllowed: false; }
export interface BlockedAutonomousExecutionRecord { id: string; recommendationId: string; action: string; target: string; actor: string; reason: string; confidence: number; riskLevel: RiskLevel; evidence: string[]; blockedAt: string; auditId: string; eventId: string; }

const controlledApprovalActions: ControlledAction[] = [
  'race-start',
  'race-cancellation',
  'race-stop',
  'steward-decision',
  'veterinary-clearance',
  'steward-ruling',
  'clear-vet-flag',
  'medication-decision',
  'payout',
  'emergency-action',
  'official-results',
  'modify-official-results',
  'starting-gate-move',
  'race-office-scratch',
  'scratch-horse',
  'race-status-change',
  'race-office-configuration',
  'facility-maintenance-execution',
  'emergency-personnel-override',
  'disciplinary-decision',
  'safety-critical-control',
  'race-distance-configuration',
  'surface-irrigation',
  'surface-harrowing',
  'surface-rolling',
  'surface-track-closure-recommendation',
  'compliance-filing-approval',
];

const approvalActionAliases: Record<string, ControlledAction> = {
  gateMove: 'starting-gate-move',
  gatemove: 'starting-gate-move',
  'gate-move': 'starting-gate-move',
  startingGateMove: 'starting-gate-move',
  startinggatemove: 'starting-gate-move',
  surfaceAction: 'surface-harrowing',
  surfaceaction: 'surface-harrowing',
  surfaceHarrow: 'surface-harrowing',
  surfaceharrow: 'surface-harrowing',
  surfaceIrrigation: 'surface-irrigation',
  surfaceirrigation: 'surface-irrigation',
  surfaceRolling: 'surface-rolling',
  surfacerolling: 'surface-rolling',
  vetAction: 'veterinary-clearance',
  vetaction: 'veterinary-clearance',
  veterinaryAction: 'veterinary-clearance',
  veterinaryaction: 'veterinary-clearance',
  stewardRuling: 'steward-ruling',
  stewardruling: 'steward-ruling',
};

const governorActionAliases: Record<string, string> = {
  START_RACE: 'race-start',
  STOP_RACE: 'race-stop',
  DECLARE_WINNER: 'declare-winner',
  MODIFY_OFFICIAL_RESULT: 'modify-official-results',
  MODIFY_OFFICIAL_RESULTS: 'modify-official-results',
  SCRATCH_HORSE: 'scratch-horse',
  CLEAR_VET_FLAG: 'clear-vet-flag',
  ISSUE_STEWARD_RULING: 'steward-ruling',
  TRIGGER_PAYOUT: 'payout',
  EXECUTE_GATE_MOVE: 'starting-gate-move',
  CLOSE_TRACK: 'close-track',
  REOPEN_TRACK: 'reopen-track',
  OVERRIDE_EMERGENCY_PERSONNEL: 'emergency-personnel-override',
  SUMMARIZE: 'summarize',
  CLASSIFY: 'classify',
  FORECAST: 'forecast',
  DETECT_ANOMALY: 'detect-anomaly',
  DRAFT_WORK_ORDER: 'draft-work-order',
  CREATE_RECOMMENDATION: 'create-recommendation',
  NOTIFY_HUMANS: 'notify-humans',
  GENERATE_REPORT: 'generate-report',
  UPDATE_DASHBOARD: 'update-dashboard',
};

export function normalizeGovernorAction(action: string): string {
  const compact = action.trim().replace(/[\s-]+/g, '_').toUpperCase();
  const mapped = governorActionAliases[compact] ?? action;
  return String(normalizeProtectedActionIntent(mapped.toLowerCase().replace(/_/g, '-')));
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

export const defaultAIGovernorPolicyConfig: AIGovernorPolicyConfig = {
  id: 'trackmind-ai-governor-autonomy-v1',
  blockedActions: unique([
    ...protectedActions,
    ...controlledApprovalActions,
    'START_RACE',
    'STOP_RACE',
    'DECLARE_WINNER',
    'MODIFY_OFFICIAL_RESULT',
    'SCRATCH_HORSE',
    'CLEAR_VET_FLAG',
    'ISSUE_STEWARD_RULING',
    'TRIGGER_PAYOUT',
    'EXECUTE_GATE_MOVE',
    'CLOSE_TRACK',
    'REOPEN_TRACK',
    'OVERRIDE_EMERGENCY_PERSONNEL',
  ].map(normalizeGovernorAction)),
  approvalRoles: {
    'race-start': ['racing-secretary', 'steward', 'veterinarian'],
    'race-stop': ['steward', 'security'],
    'declare-winner': ['steward'],
    'official-results': ['steward', 'finance'],
    'modify-official-results': ['steward', 'finance', 'compliance-officer'],
    'scratch-horse': ['veterinarian', 'steward'],
    'clear-vet-flag': ['veterinarian'],
    'steward-ruling': ['steward'],
    payout: ['steward', 'finance'],
    'starting-gate-move': ['racing-secretary', 'track-superintendent'],
    'close-track': ['track-superintendent', 'steward'],
    'reopen-track': ['track-superintendent', 'steward'],
    'emergency-personnel-override': ['security', 'admin'],
    'emergency-action': ['security'],
    'disciplinary-decision': ['steward', 'compliance-officer'],
    'safety-critical-control': ['track-superintendent', 'steward'],
    'race-cancellation': ['steward'],
    'race-status-change': ['steward'],
    'race-office-configuration': ['racing-secretary', 'track-superintendent', 'steward'],
    'race-distance-configuration': ['racing-secretary', 'track-superintendent', 'steward'],
    'surface-irrigation': ['track-superintendent'],
    'surface-harrowing': ['track-superintendent'],
    'surface-rolling': ['track-superintendent'],
    'surface-track-closure-recommendation': ['track-superintendent', 'steward'],
    'facility-maintenance-execution': ['track-superintendent', 'admin'],
    'compliance-filing-approval': ['compliance-officer'],
  },
  automaticAdvisoryActions: ['SUMMARIZE', 'CLASSIFY', 'FORECAST', 'DETECT_ANOMALY', 'DRAFT_WORK_ORDER', 'CREATE_RECOMMENDATION', 'NOTIFY_HUMANS', 'GENERATE_REPORT', 'UPDATE_DASHBOARD'].map(normalizeGovernorAction),
  requiredEvidence: ['evidence', 'affected-assets', 'lineage', 'confidence', 'explainability'],
  policyEvidence: ['ISO-42001:human-oversight', 'NIST-AI-RMF:govern-map-measure-manage', 'TrackMind:advisory-only-ai-control-plane'],
  defaultApprovalRoles: ['compliance-officer'],
};

export interface GovernanceDecision {
  allowed: boolean;
  action: string;
  reason?: string;
  approvalId?: string;
  governorReviewId?: string;
  recommendationId?: string;
  tenantId?: string;
  racetrackId?: string;
  correlationId?: string;
  causationId?: string;
  riskLevel?: RiskLevel;
  evidenceIds?: string[];
  digitalTwinRefs?: string[];
  approvalRequired?: boolean;
}

export interface ModelRegistration {
  id: string;
  name: string;
  version: string;
  owner: string;
  purpose: string;
  criticality: ModelCriticality;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted' | 'personal-data';
  intendedUse: string[];
  prohibitedUse: string[];
  lineage: string[];
  evidence: string[];
  registeredAt: string;
  status?: ModelLifecycleStatus;
}

export interface ModelEvaluation {
  modelId: string;
  evaluatedAt: string;
  evaluator: string;
  metrics: Record<string, number>;
  explainability: { method: string; score: number; artifacts: string[] };
  safety: { passed: boolean; controls: string[]; redTeamFindings: number };
  fairness: { score: number; segments: string[] };
  privacy: { personalDataUsed: boolean; controls: string[] };
  security: { threatModelReviewed: boolean; vulnerabilitiesOpen: number };
  quality: { reliability: number; maintainability: number; performanceEfficiency: number };
}

export interface RiskAssessment {
  modelId: string;
  assessedAt: string;
  assessor: string;
  impact: 1 | 2 | 3 | 4 | 5;
  likelihood: 1 | 2 | 3 | 4 | 5;
  mitigations: string[];
  residualRiskAcceptedBy?: string;
}

export interface MonitoringSignal {
  modelId: string;
  observedAt: string;
  metric: 'drift' | 'latency' | 'error-rate' | 'safety-incident' | 'privacy-event' | 'security-event' | 'quality-regression';
  value: number;
  threshold: number;
  evidence: string[];
}

export interface RegulatoryReport {
  reportId: string;
  generatedAt: string;
  frameworks: GovernanceFramework[];
  models: Array<{ id: string; status: ModelLifecycleStatus; riskLevel: RiskLevel; openFindings: number }>;
  controlCoverage: Array<{ framework: GovernanceFramework; controls: string[]; evidence: string[] }>;
  incidents: MonitoringSignal[];
  humanOversightGaps: string[];
}

export class ResponsibleAIGovernor {
  private readonly blockedActions: Set<string>;
  private readonly automaticAdvisoryActions: Set<string>;

  constructor(private readonly approvals?: ApprovalStore, private readonly config: AIGovernorPolicyConfig = defaultAIGovernorPolicyConfig) {
    this.blockedActions = new Set(unique([...config.blockedActions, ...defaultAIGovernorPolicyConfig.blockedActions, ...protectedActions, ...controlledApprovalActions].map(normalizeGovernorAction)));
    this.automaticAdvisoryActions = new Set(config.automaticAdvisoryActions.map(normalizeGovernorAction));
  }

  policyConfig(): AIGovernorPolicyConfig {
    return {
      ...this.config,
      blockedActions: [...this.blockedActions],
      automaticAdvisoryActions: [...this.automaticAdvisoryActions],
      approvalRoles: Object.fromEntries(Object.entries(this.config.approvalRoles).map(([action, roles]) => [normalizeGovernorAction(action), [...roles]])),
      requiredEvidence: [...this.config.requiredEvidence],
      policyEvidence: [...this.config.policyEvidence],
      defaultApprovalRoles: [...this.config.defaultApprovalRoles],
    };
  }

  isBlockedAction(action: string): boolean {
    return this.blockedActions.has(normalizeGovernorAction(action));
  }

  requiredRolesFor(action: string): string[] {
    const canonicalAction = normalizeGovernorAction(action);
    return [...(this.config.approvalRoles[canonicalAction] ?? this.config.defaultApprovalRoles)];
  }

  reviewAutonomousPermission(input: AutonomousPermissionReviewInput): AIGovernorReviewRecord {
    const canonicalAction = normalizeGovernorAction(input.action);
    const hardBlocked = this.blockedActions.has(canonicalAction);
    const policyAllowsAutomation = false;
    const requiredApproverRoles = hardBlocked || input.requiresApproval ? this.requiredRolesFor(canonicalAction) : [];
    const evidencePresent = input.evidence.length > 0;
    const responsibleAIGovernorApproved = evidencePresent && !hardBlocked && !input.requiresApproval;
    const canExecute = false;
    const decision: AIGovernorReviewDecision = canExecute ? 'approved' : hardBlocked || input.requiresApproval ? 'requires-human-approval' : 'blocked';
    const reason = hardBlocked
      ? `TrackMind control ${canonicalAction} is hard-blocked from autonomous AI execution and requires authorized human roles: ${requiredApproverRoles.join(', ') || 'configured approver'}.`
      : input.requiresApproval
        ? `Human approval is required before ${canonicalAction}; autonomous permission rule requires requiresApproval == false.`
        : input.riskLevel !== 'low'
          ? `Risk level ${input.riskLevel} is not eligible for autonomous execution.`
          : `Policy ${this.config.id} is advisory-only; AI outputs may inform humans but cannot autonomously execute ${canonicalAction}.`;
    const policyEvidence = unique([
      `policy:${this.config.id}`,
      ...this.config.policyEvidence,
      ...(hardBlocked ? [`policy:blocked-action:${canonicalAction}`] : []),
      ...(policyAllowsAutomation ? [`policy:automatic-advisory-action:${canonicalAction}`] : []),
      ...(requiredApproverRoles.length ? [`policy:approval-roles:${requiredApproverRoles.join('|')}`] : []),
      ...this.config.requiredEvidence.map((item) => `policy:required-evidence:${item}`),
    ]);

    return {
      id: `governor-review-${input.recommendationId}`,
      recommendationId: input.recommendationId,
      action: input.action,
      canonicalAction,
      target: input.target,
      actor: input.actor ?? 'responsible-ai-governor',
      tenantId: input.tenantId ?? 'trackmind',
      racetrackId: input.racetrackId ?? 'main-track',
      correlationId: input.correlationId ?? input.recommendationId,
      causationId: input.causationId,
      allowed: canExecute,
      decision,
      reason,
      riskLevel: input.riskLevel,
      approvalRequired: input.requiresApproval,
      policyAllowsAutomation,
      responsibleAIGovernorApproved,
      canExecute,
      policyEvidence,
      requiredApproverRoles,
      blockedAutonomousExecution: !canExecute,
      evidence: unique([...input.evidence, ...policyEvidence]),
      reviewedAt: input.reviewedAt ?? new Date().toISOString(),
      digitalTwinRefs: [...(input.digitalTwinRefs ?? [])],
    };
  }

  assertMayAutomate(action: ProtectedAction | string, recommendationId: string): GovernanceDecision {
    const approval = this.approvals?.findApproved(action, recommendationId);
    const requiresApproval = this.isBlockedAction(action);
    const review = this.reviewAutonomousPermission({ action, recommendationId, riskLevel: requiresApproval ? 'critical' : 'low', requiresApproval, evidence: approval?.evidence ?? [], reviewedAt: approval?.timestamp });
    return {
      allowed: review.canExecute === true,
      action: review.canonicalAction ?? action,
      reason: review.canExecute ? undefined : review.reason,
      approvalId: approval?.id,
      governorReviewId: review.id,
      recommendationId,
      riskLevel: review.riskLevel,
      evidenceIds: review.evidence,
      approvalRequired: review.approvalRequired,
    };
  }
}

export class ResponsibleAIGovernancePlatform {
  private readonly governor: ResponsibleAIGovernor;
  private readonly models = new Map<string, ModelRegistration & { status: ModelLifecycleStatus }>();
  private readonly evaluations: ModelEvaluation[] = [];
  private readonly risks: RiskAssessment[] = [];
  private readonly monitoring: MonitoringSignal[] = [];
  private readonly agents = new Map<string, AIAgent>();
  private readonly prompts = new Map<string, PromptTemplate>();
  private readonly recommendations = new Map<string, RecommendationRecord & { status: GovernanceRecommendationStatus; confidenceScore: ConfidenceScore; explainability: ExplainabilityRecord }>();
  private readonly evidencePackages: AIEvidencePackage[] = [];
  private readonly approvalRequirements: ApprovalRequirementRecord[] = [];
  private readonly digitalTwinImpacts: AIDigitalTwinImpact[] = [];
  private readonly observabilitySignals: ObservabilityRecord[] = [];
  private readonly safetyPolicies = new Map<string, SafetyPolicy>();
  private readonly humanInLoopWorkflows: HumanInLoopWorkflowRecord[] = [];
  private readonly draftWorkOrders: DraftWorkOrderRecord[] = [];
  private readonly blockedAutonomousExecutions: BlockedAutonomousExecutionRecord[] = [];
  private readonly inputIngestions: AIInputIngestionRecord[] = [];
  private readonly featureBuilds: AIFeatureBuildRecord[] = [];
  private readonly modelSelections: AIModelSelectionRecord[] = [];
  private readonly governorReviews: AIGovernorReviewRecord[] = [];
  private readonly dashboardUpdates: AIDashboardUpdateRecord[] = [];
  private readonly overrides: OverrideRecord[] = [];
  private readonly rollbacks: RollbackRecord[] = [];
  private readonly events: AIGovernanceEvent[] = [];
  private readonly auditTrail: Array<{ id: string; timestamp: string; actor: string; action: string; subject: string; evidence: string[]; tenantId?: string; racetrackId?: string; correlationId?: string; causationId?: string; digitalTwinRefs?: string[]; immutableAuditId?: string; payload?: Record<string, unknown> }> = [];

  constructor(private readonly deps: { approvals?: ApprovalStore; approvalService?: CentralizedApprovalService; centralizedApprovals?: CentralizedApprovalService; auditLog?: ImmutableAuditLog; eventBus?: UniversalEventBus; governorPolicy?: AIGovernorPolicyConfig } = {}) {
    this.governor = new ResponsibleAIGovernor(deps.approvals, deps.governorPolicy);
    const governorPolicy = this.governor.policyConfig();
    const protectedPolicyActions = [...new Set([...protectedActions, ...controlledApprovalActions, ...governorPolicy.blockedActions])];
    const policy: SafetyPolicy = {
      id: 'trackmind-ai-advisory-only-v1',
      allowedActivities: [...aiAllowedActivities],
      protectedActions: protectedPolicyActions,
      prohibitedAutonomousActions: protectedPolicyActions,
      blockedActions: [...governorPolicy.blockedActions],
      approvalRoles: governorPolicy.approvalRoles,
      automaticAdvisoryActions: [...governorPolicy.automaticAdvisoryActions],
      requiredEvidence: [...governorPolicy.requiredEvidence],
      humanApprovalRequiredFor: protectedPolicyActions,
    };
    this.safetyPolicies.set(policy.id, policy);
    this.registerControlPlaneEventContracts();
  }

  registerAgent(agent: AIAgent) { this.requireModel(agent.modelVersionId); if (!this.prompts.has(agent.promptTemplateId)) throw new Error(`Unknown prompt template ${agent.promptTemplateId}`); const allowedActivities = agent.allowedActivities ?? [...aiAllowedActivities]; this.agents.set(agent.id, { ...agent, allowedActions: [...agent.allowedActions], restrictedActions: [...agent.restrictedActions], allowedActivities: [...allowedActivities], digitalTwinRefs: [...(agent.digitalTwinRefs ?? [])] }); this.emit('ai.agent.registered', agent.id, agent.owner, [], [agent.modelVersionId, agent.promptTemplateId]); return this.agents.get(agent.id)!; }

  publishPromptTemplate(prompt: PromptTemplate) { if (prompt.status === 'approved' && prompt.evidence.length === 0) throw new Error('Approved prompt templates require evidence'); const allowedActivities = prompt.allowedActivities ?? [...aiAllowedActivities]; this.prompts.set(prompt.id, { ...prompt, evidence: [...prompt.evidence], allowedActivities: [...allowedActivities], safetyPolicyId: prompt.safetyPolicyId ?? 'trackmind-ai-advisory-only-v1' }); this.emit('ai.prompt.published', prompt.id, prompt.owner, prompt.evidence, [prompt.version]); return this.prompts.get(prompt.id)!; }

  recordInputIngestion(input: AIInputIngestionRecord) {
    const record = { ...input, evidence: [...input.evidence], digitalTwinRefs: [...(input.digitalTwinRefs ?? [])] };
    this.inputIngestions.push(record);
    this.emit('ai.input.ingested', record.id, record.actor, record.evidence, [record.inputRef, record.schemaId ?? 'schema:unspecified'], record.ingestedAt, this.contextFrom(record, record.id), { inputId: record.id, source: record.source, inputRef: record.inputRef, inputHash: record.inputHash, schemaId: record.schemaId, dataClassification: record.dataClassification });
    return { ...record, evidence: [...record.evidence], digitalTwinRefs: [...record.digitalTwinRefs] };
  }

  recordFeatureBuild(input: AIFeatureBuildRecord) {
    const record = { ...input, features: [...input.features], evidence: [...input.evidence], digitalTwinRefs: [...(input.digitalTwinRefs ?? [])] };
    this.featureBuilds.push(record);
    this.emit('ai.features.built', record.id, record.actor, record.evidence, [record.inputId, record.featureSetId], record.builtAt, this.contextFrom(record, record.id), { featureBuildId: record.id, inputId: record.inputId, featureSetId: record.featureSetId, features: record.features });
    return { ...record, features: [...record.features], evidence: [...record.evidence], digitalTwinRefs: [...record.digitalTwinRefs] };
  }

  recordModelSelection(input: AIModelSelectionRecord) {
    this.requireModel(input.modelVersionId);
    const record = { ...input, candidateModelIds: [...input.candidateModelIds], evidence: [...input.evidence], digitalTwinRefs: [...(input.digitalTwinRefs ?? [])] };
    this.modelSelections.push(record);
    this.emit('ai.model.selected', record.id, record.actor, record.evidence, [record.featureBuildId, record.modelVersionId, ...record.candidateModelIds], record.selectedAt, this.contextFrom(record, record.modelVersionId), { selectionId: record.id, featureBuildId: record.featureBuildId, modelVersionId: record.modelVersionId, candidateModelIds: record.candidateModelIds, selectionReason: record.selectionReason });
    return { ...record, candidateModelIds: [...record.candidateModelIds], evidence: [...record.evidence], digitalTwinRefs: [...record.digitalTwinRefs] };
  }

  recordGovernorReview(input: AIGovernorReviewRecord) {
    const base = { ...input, evidence: [...input.evidence], policyEvidence: [...(input.policyEvidence ?? [])], requiredApproverRoles: [...(input.requiredApproverRoles ?? [])], digitalTwinRefs: [...(input.digitalTwinRefs ?? [])] };
    const emitted = this.emit('ai.governor.reviewed', base.id, base.actor, base.evidence, [base.recommendationId ?? base.id, base.canonicalAction ?? base.action], base.reviewedAt, this.contextFrom(base, base.recommendationId ?? base.id), { reviewId: base.id, recommendationId: base.recommendationId, action: base.action, canonicalAction: base.canonicalAction, target: base.target, decision: base.decision, allowed: base.allowed, canExecute: base.canExecute, reason: base.reason, riskLevel: base.riskLevel, approvalRequired: base.approvalRequired, policyAllowsAutomation: base.policyAllowsAutomation, responsibleAIGovernorApproved: base.responsibleAIGovernorApproved, blockedAutonomousExecution: base.blockedAutonomousExecution, requiredApproverRoles: base.requiredApproverRoles, policyEvidence: base.policyEvidence, digitalTwinRefs: base.digitalTwinRefs });
    const record = { ...base, auditRef: emitted.auditId, eventRef: emitted.event.id };
    this.governorReviews.push(record);
    if (record.digitalTwinRefs.length) this.queueGovernorTwinAdvisory(record);
    return { ...record, evidence: [...record.evidence], policyEvidence: [...(record.policyEvidence ?? [])], requiredApproverRoles: [...(record.requiredApproverRoles ?? [])], digitalTwinRefs: [...record.digitalTwinRefs] };
  }

  recordDashboardUpdate(input: AIDashboardUpdateRecord) {
    const record = { ...input, metrics: { ...input.metrics }, evidence: [...input.evidence], digitalTwinRefs: [...(input.digitalTwinRefs ?? [])] };
    this.dashboardUpdates.push(record);
    this.emit('ai.dashboard.updated', record.id, record.actor, record.evidence, [record.dashboardId], record.updatedAt, this.contextFrom(record, record.dashboardId), { dashboardId: record.dashboardId, summary: record.summary, metrics: record.metrics });
    return { ...record, metrics: { ...record.metrics }, evidence: [...record.evidence], digitalTwinRefs: [...record.digitalTwinRefs] };
  }

  recordRecommendation(input: RecommendationRecord) {
    const agent = this.agents.get(input.agentId); if (!agent) throw new Error(`Unknown AI agent ${input.agentId}`);
    const prompt = this.prompts.get(input.promptTemplateId); if (!prompt) throw new Error(`Unknown prompt template ${input.promptTemplateId}`);
    this.requireModel(input.modelVersionId);
    const activity = input.activity ?? 'recommend';
    const canonicalAction = this.canonicalAction(input.action);
    this.enforceSafetyPolicy(input, agent, prompt, activity, canonicalAction);
    const missing = this.recommendationGaps(input);
    if (missing.length) throw new Error(`AI recommendation governance gaps: ${missing.join(', ')}`);
    const controlledAction = this.controlledActionFor(input.action) ?? this.controlledActionFor(canonicalAction);
    const restricted = Boolean(controlledAction) || this.isProtectedAction(input.action) || this.isProtectedAction(canonicalAction) || agent.restrictedActions.includes(input.action) || agent.restrictedActions.includes(canonicalAction);
    const requiresApproval = restricted || input.approvalPolicy !== 'none';
    const governorReview = this.governor.reviewAutonomousPermission({ action: input.action, recommendationId: input.id, riskLevel: input.riskLevel, requiresApproval, evidence: input.evidence, target: input.target, actor: agent.id, tenantId: input.tenantId ?? agent.tenantId, racetrackId: input.racetrackId, correlationId: input.correlationId, causationId: input.causationId, reviewedAt: input.createdAt, digitalTwinRefs: input.digitalTwinRefs ?? agent.digitalTwinRefs });
    const status: GovernanceRecommendationStatus = restricted && input.approvalPolicy === 'none' ? 'safety-blocked' : requiresApproval ? 'pending-approval' : 'queued';
    const confidenceScore = this.scoreConfidence(input);
    const explainability = this.explain(input, confidenceScore, restricted || governorReview.blockedAutonomousExecution === true);
    const record = { ...input, activity, action: canonicalAction, affectedAssets: [...input.affectedAssets], evidence: [...input.evidence], lineage: [...input.lineage], digitalTwinRefs: [...(input.digitalTwinRefs ?? agent.digitalTwinRefs ?? [])], status, confidenceScore, explainability };
    this.recommendations.set(record.id, record);
    this.evidencePackages.push({ id: `evidence-${record.id}`, recommendationId: record.id, evidence: [...record.evidence], lineage: [...record.lineage], createdAt: record.createdAt, hash: `sha256:${record.id}:${record.evidence.join('|')}` });
    const storedGovernorReview = this.recordGovernorReview(governorReview);
    const approvalRequirements = this.buildApprovalRequirements(record, restricted);
    const workflowRecords = this.createHumanApprovalWorkflows(record, agent, approvalRequirements);
    this.approvalRequirements.push(...approvalRequirements);
    this.deps.approvals?.saveRecommendation({ id: record.id, tenantId: record.tenantId ?? agent.tenantId, status: approvalRequirements.length ? 'pending-approval' : 'draft', requestedBy: agent.id, createdAt: record.createdAt, evidence: [...record.evidence], downstreamAction: record.action, requiredApprovals: approvalRequirements.map((item) => item.action), affectedAssets: [...record.affectedAssets], riskLevel: record.riskLevel, approvalRequestIds: workflowRecords.map((item) => item.approvalRequestId).filter((item): item is string => Boolean(item)), workflowRecordIds: workflowRecords.map((item) => item.id), auditIds: workflowRecords.map((item) => item.auditId), eventIds: workflowRecords.map((item) => item.eventId), recommendation: { id: record.id, activity, action: record.action, target: record.target, confidence: record.confidence, affectedAssets: record.affectedAssets, approvalRequestIds: workflowRecords.map((item) => item.approvalRequestId).filter((item): item is string => Boolean(item)), auditIds: workflowRecords.map((item) => item.auditId), eventIds: workflowRecords.map((item) => item.eventId) } });
    const twinImpacts = this.buildDigitalTwinImpacts(record);
    record.digitalTwinRefs = [...new Set([...record.digitalTwinRefs, ...twinImpacts.map((impact) => impact.twinId)])];
    this.digitalTwinImpacts.push(...twinImpacts);
    this.observabilitySignals.push(...this.buildObservabilitySignals(record, restricted));
    const context = this.contextFrom(record, record.id);
    this.emit('ai.recommendation.created', record.id, agent.id, record.evidence, record.lineage, record.createdAt, context, { recommendationId: record.id, action: record.action, target: record.target, recommendation: record.recommendation, confidence: record.confidence, riskLevel: record.riskLevel, affectedAssets: record.affectedAssets, approvalRequired: approvalRequirements.length > 0, advisoryOnly: true, digitalTwinRefs: record.digitalTwinRefs });
    this.emit('ai.safety.policy.enforced', record.id, agent.id, record.evidence, ['policy:trackmind-ai-advisory-only-v1', ...record.lineage], record.createdAt, context, { recommendationId: record.id, action: record.action, status: record.status, advisoryOnly: true });
    if (approvalRequirements.length) this.emit('ai.approval.required', record.id, agent.id, record.evidence, approvalRequirements.map((item) => item.id), record.createdAt, { ...context, approvalRef: approvalRequirements[0]?.id }, { approvalId: approvalRequirements[0]?.id, recommendationId: record.id, action: record.action, policy: record.approvalPolicy, requiredRoles: approvalRequirements.flatMap((item) => item.requiredRoles), approvalRequired: true });
    if (twinImpacts.length) this.emit('ai.digital-twin.impact.queued', record.id, agent.id, record.evidence, twinImpacts.map((item) => item.twinId), record.createdAt, context, { recommendationId: record.id, digitalTwinRefs: record.digitalTwinRefs, advisoryOnly: true });
    this.emit(status === 'safety-blocked' ? 'ai.recommendation.blocked' : 'ai.recommendation.recorded', record.id, agent.id, record.evidence, record.lineage, record.createdAt, context, { recommendationId: record.id, status: record.status, advisoryOnly: true, governorReviewId: storedGovernorReview.id });
    this.queueRecommendationTwinAdvisory(record, twinImpacts, context);
    return { ...record, governorReview: storedGovernorReview };
  }

  executeRecommendation(recommendationId: string, actor: string) {
    const recommendation = this.requireRecommendation(recommendationId);
    const governorReview = this.governorReviews.find((review) => review.recommendationId === recommendationId);
    recommendation.status = 'safety-blocked';
    const log = this.logBlockedAutonomousExecution(recommendation, actor, governorReview);
    return { executed: false, executionAllowed: false, reason: log.reason, blockedExecutionId: log.id, auditId: log.auditId, eventId: log.eventId, governorReviewId: governorReview?.id };
  }

  recordOverride(record: OverrideRecord) { const rec = this.requireRecommendation(record.recommendationId); rec.status = 'overridden'; this.overrides.push({ ...record, evidence: [...record.evidence] }); this.emit('ai.override.recorded', record.id, record.actor, record.evidence, rec.lineage, record.createdAt); return record; }
  recordRollback(record: RollbackRecord) { const rec = this.requireRecommendation(record.recommendationId); rec.status = 'rolled-back'; this.rollbacks.push({ ...record, evidence: [...record.evidence] }); this.emit('ai.rollback.recorded', record.id, record.actor, record.evidence, [record.restoredVersionId, ...rec.lineage], record.createdAt); return record; }

  governanceWorkspace() {
    const recs = [...this.recommendations.values()];
    return {
      activeAgents: [...this.agents.values()].filter((a) => a.status === 'active').map((a) => ({ ...a, allowedActions: [...a.allowedActions], restrictedActions: [...a.restrictedActions], allowedActivities: [...(a.allowedActivities ?? [])], digitalTwinRefs: [...(a.digitalTwinRefs ?? [])] })),
      modelVersions: [...this.models.values()].map((m) => ({ ...m, riskLevel: this.latestRisk(m.id) ? this.riskLevel(this.latestRisk(m.id)!) : 'medium' as RiskLevel, intendedUse: [...m.intendedUse], prohibitedUse: [...m.prohibitedUse], lineage: [...m.lineage], evidence: [...m.evidence] })),
      promptTemplates: [...this.prompts.values()].map((p) => ({ ...p, evidence: [...p.evidence], allowedActivities: [...(p.allowedActivities ?? [])] })),
      recommendationQueue: recs.filter((r) => r.status === 'queued' || r.status === 'pending-approval').map((r) => this.cloneRecommendation(r)),
      safetyBlockedActions: recs.filter((r) => r.status === 'safety-blocked').map((r) => this.cloneRecommendation(r)),
      evaluationStatus: [...this.models.values()].map((m) => ({ modelVersionId: m.id, status: m.status, readiness: this.readiness(m.id), latestEvaluation: this.latestEvaluationSummary(m.id) })),
      riskClassifications: recs.map((r) => ({ subjectId: r.id, level: r.riskLevel, drivers: [r.action, r.approvalPolicy, ...r.affectedAssets] })),
      approvalRequirements: this.approvalRequirements.map((r) => ({ ...r, requiredRoles: [...r.requiredRoles], evidence: [...r.evidence] })),
      humanInLoopWorkflows: this.humanInLoopWorkflows.map((workflow) => ({ ...workflow, affectedAssets: [...workflow.affectedAssets], evidence: [...workflow.evidence], requiredRoles: [...workflow.requiredRoles] })),
      draftWorkOrders: this.draftWorkOrders.map((workOrder) => ({ ...workOrder, affectedAssets: [...workOrder.affectedAssets], evidence: [...workOrder.evidence] })),
      blockedAutonomousExecutionLogs: this.blockedAutonomousExecutions.map((log) => ({ ...log, evidence: [...log.evidence] })),
      governorReviews: this.governorReviews.map((record) => this.cloneGovernorReview(record)),
      controlPlane: {
        inputIngestions: this.inputIngestions.map((record) => ({ ...record, evidence: [...record.evidence], digitalTwinRefs: [...(record.digitalTwinRefs ?? [])] })),
        featureBuilds: this.featureBuilds.map((record) => ({ ...record, features: [...record.features], evidence: [...record.evidence], digitalTwinRefs: [...(record.digitalTwinRefs ?? [])] })),
        modelSelections: this.modelSelections.map((record) => ({ ...record, candidateModelIds: [...record.candidateModelIds], evidence: [...record.evidence], digitalTwinRefs: [...(record.digitalTwinRefs ?? [])] })),
        governorReviews: this.governorReviews.map((record) => this.cloneGovernorReview(record)),
        dashboardUpdates: this.dashboardUpdates.map((record) => ({ ...record, metrics: { ...record.metrics }, evidence: [...record.evidence], digitalTwinRefs: [...(record.digitalTwinRefs ?? [])] })),
      },
      safetyPolicies: [...this.safetyPolicies.values()].map((p) => ({ ...p, allowedActivities: [...p.allowedActivities], protectedActions: [...p.protectedActions], prohibitedAutonomousActions: [...p.prohibitedAutonomousActions], blockedActions: [...p.blockedActions], approvalRoles: Object.fromEntries(Object.entries(p.approvalRoles).map(([action, roles]) => [action, [...roles]])), automaticAdvisoryActions: [...p.automaticAdvisoryActions], requiredEvidence: [...p.requiredEvidence], humanApprovalRequiredFor: [...p.humanApprovalRequiredFor] })),
      digitalTwinImpacts: this.digitalTwinImpacts.map((impact) => ({ ...impact, patch: { ...impact.patch } })),
      observabilitySignals: this.observabilitySignals.map((signal) => ({ ...signal, evidence: [...signal.evidence] })),
      auditTrails: this.auditLog(),
      evidencePackages: this.evidencePackages.map((p) => ({ ...p, evidence: [...p.evidence], lineage: [...p.lineage] })),
      overrides: this.overrides.map((o) => ({ ...o, evidence: [...o.evidence] })),
      rollbackRecords: this.rollbacks.map((r) => ({ ...r, evidence: [...r.evidence] })),
      monitoringMetrics: [...this.monitoring].map((m) => ({ ...m, evidence: [...m.evidence] })),
      events: this.events.map((e) => ({ ...e, evidence: [...e.evidence], lineage: [...e.lineage] })),
    };
  }

  registerModel(model: ModelRegistration) {
    const registered = { ...model, status: model.status ?? 'registered' };
    this.models.set(model.id, { ...registered, intendedUse: [...model.intendedUse], prohibitedUse: [...model.prohibitedUse], lineage: [...model.lineage], evidence: [...model.evidence] });
    this.audit('model-registered', model.owner, model.id, model.evidence, model.registeredAt);
    this.emit('ai.model.registered', model.id, model.owner, model.evidence, model.lineage, model.registeredAt);
    return this.getModel(model.id)!;
  }

  recordEvaluation(evaluation: ModelEvaluation) {
    this.requireModel(evaluation.modelId);
    this.evaluations.push(this.cloneEvaluation(evaluation));
    this.transition(evaluation.modelId, 'evaluating', evaluation.evaluator, ['evaluation-recorded']);
    this.emit('ai.model.evaluated', evaluation.modelId, evaluation.evaluator, [...evaluation.explainability.artifacts, ...evaluation.safety.controls], ['evaluation-recorded'], evaluation.evaluatedAt);
    return this.readiness(evaluation.modelId);
  }

  assessRisk(assessment: RiskAssessment) {
    this.requireModel(assessment.modelId);
    this.risks.push({ ...assessment, mitigations: [...assessment.mitigations] });
    this.audit('risk-assessed', assessment.assessor, assessment.modelId, assessment.mitigations, assessment.assessedAt);
    return { ...assessment, riskLevel: this.riskLevel(assessment) };
  }

  requestApproval(modelId: string, actor: string) {
    const readiness = this.readiness(modelId);
    const missing = readiness.gaps;
    if (missing.length > 0) return { modelId, approved: false, status: this.getModel(modelId)?.status, missing };
    this.transition(modelId, 'pending-approval', actor, ['governance-readiness-complete']);
    return { modelId, approved: true, status: 'pending-approval' as const, missing };
  }

  approveForDeployment(modelId: string, approver: string, evidence: string[]) {
    const readiness = this.readiness(modelId);
    if (!readiness.deployable) return { modelId, deployed: false, reason: `Readiness gaps: ${readiness.gaps.join(', ')}` };
    this.transition(modelId, 'approved', approver, evidence);
    this.transition(modelId, 'deployed', approver, ['deployment-change-record', ...evidence]);
    return { modelId, deployed: true, rollbackProcedure: this.rollbackProcedure(modelId), humanOversight: this.humanOversightRequirements(modelId) };
  }

  ingestMonitoring(signal: MonitoringSignal) {
    this.requireModel(signal.modelId);
    this.monitoring.push({ ...signal, evidence: [...signal.evidence] });
    const breached = signal.value > signal.threshold;
    if (breached && ['safety-incident', 'privacy-event', 'security-event', 'quality-regression'].includes(signal.metric)) this.transition(signal.modelId, 'suspended', 'monitoring-control', signal.evidence);
    this.observabilitySignals.push({ id: `obs-${this.observabilitySignals.length + 1}`, subjectId: signal.modelId, metric: signal.metric, value: signal.value, threshold: signal.threshold, status: breached ? 'critical' : 'nominal', traceId: `trace:${signal.modelId}:${signal.metric}`, observedAt: signal.observedAt, evidence: [...signal.evidence] });
    this.emit('ai.metric.observed', signal.modelId, 'monitoring-control', signal.evidence, [signal.metric], signal.observedAt);
    this.audit(breached ? 'monitoring-threshold-breached' : 'monitoring-observed', 'monitoring-control', signal.modelId, signal.evidence, signal.observedAt);
    return { breached, action: breached ? 'open-corrective-action-and-human-review' : 'continue-monitoring' };
  }

  readiness(modelId: string) {
    const model = this.requireModel(modelId);
    const evaluation = this.latestEvaluation(modelId);
    const risk = this.latestRisk(modelId);
    const gaps: string[] = [];
    if (!evaluation) gaps.push('model evaluation required');
    if (evaluation && evaluation.explainability.score < 0.8) gaps.push('explainability score below threshold');
    if (evaluation && (!evaluation.safety.passed || evaluation.safety.redTeamFindings > 0)) gaps.push('safety findings must be remediated');
    if (evaluation && (evaluation.security.vulnerabilitiesOpen > 0 || !evaluation.security.threatModelReviewed)) gaps.push('security review incomplete');
    if (evaluation && evaluation.fairness.score < 0.8) gaps.push('fairness score below threshold');
    if (!risk) gaps.push('ISO 31000 risk assessment required');
    if (risk && this.riskLevel(risk) === 'critical' && !risk.residualRiskAcceptedBy) gaps.push('critical residual risk requires executive acceptance');
    if (model.criticality !== 'low' && model.evidence.length < 2) gaps.push('audit evidence package incomplete');
    return { modelId, deployable: gaps.length === 0, gaps, controls: this.controlCoverage(modelId) };
  }

  rollbackProcedure(modelId: string) { this.requireModel(modelId); return { modelId, triggers: ['safety incident', 'privacy event', 'security incident', 'material drift', 'approval withdrawal'], steps: ['suspend model endpoint', 'restore last approved version', 'notify accountable owner', 'capture audit evidence', 'run post-incident review'] }; }
  humanOversightRequirements(modelId: string) { const model = this.requireModel(modelId); return model.criticality === 'safety-critical' ? ['pre-deployment approval', 'human-in-the-loop decisions', 'two-person incident rollback', 'monthly governance board review'] : ['named accountable owner', 'exception review', 'periodic performance review']; }
  explainabilityRequirements(modelId: string) { const model = this.requireModel(modelId); return { required: model.criticality !== 'low', artifacts: ['model card', 'feature attribution or rationale trace', 'known limitations', 'decision evidence links'], minimumScore: model.criticality === 'safety-critical' ? 0.9 : 0.8 }; }

  regulatoryReport(reportId: string, generatedAt: string): RegulatoryReport {
    const frameworks: GovernanceFramework[] = ['ISO42001', 'ISO27001', 'ISO27701', 'ISO25010', 'ISO31000', 'NIST-AI-RMF', 'Enterprise-Governance'];
    return { reportId, generatedAt, frameworks, models: [...this.models.values()].map((model) => ({ id: model.id, status: model.status, riskLevel: this.latestRisk(model.id) ? this.riskLevel(this.latestRisk(model.id)!) : 'medium', openFindings: this.readiness(model.id).gaps.length })), controlCoverage: frameworks.map((framework) => ({ framework, controls: this.controlsFor(framework), evidence: this.auditTrail.filter((item) => item.evidence.length > 0).flatMap((item) => item.evidence) })), incidents: this.monitoring.filter((signal) => signal.value > signal.threshold), humanOversightGaps: [...this.models.values()].filter((model) => model.criticality === 'safety-critical' && model.status !== 'deployed').map((model) => model.id) };
  }

  auditLog() { return this.auditTrail.map((entry) => ({ ...entry, evidence: [...entry.evidence] })); }
  getModel(modelId: string) { const model = this.models.get(modelId); return model ? { ...model, intendedUse: [...model.intendedUse], prohibitedUse: [...model.prohibitedUse], lineage: [...model.lineage], evidence: [...model.evidence] } : undefined; }

  private recommendationGaps(input: RecommendationRecord) { const gaps: string[] = []; if (input.evidence.length === 0) gaps.push('evidence required'); if (input.confidence <= 0 || input.confidence > 1) gaps.push('confidence must be between 0 and 1'); if (input.affectedAssets.length === 0) gaps.push('affected assets required'); if (!input.approvalPolicy) gaps.push('approval policy required'); if (input.lineage.length < 3) gaps.push('traceable lineage requires agent, model, and prompt'); if (!input.recommendation.trim()) gaps.push('recommendation text required'); return gaps; }
  private requireRecommendation(id: string) { const rec = this.recommendations.get(id); if (!rec) throw new Error(`Unknown AI recommendation ${id}`); return rec; }
  private emit(type: AIGovernanceEventType, subjectId: string, actor: string, evidence: string[], lineage: string[], timestamp = new Date().toISOString(), context: Partial<AIControlPlaneContext> = {}, payload: Record<string, unknown> = {}) {
    const eventContext = this.completeContext(subjectId, context, lineage);
    const audit = this.audit(type, actor, subjectId, evidence, timestamp, eventContext, { eventType: type, lineage, ...payload });
    const eventId = `ai-event-${this.events.length + 1}`;
    const eventType = `${type}.v1` as CanonicalEventRef['eventType'];
    const event: AIGovernanceEvent = { eventId, eventType, tenantId: eventContext.tenantId, racetrackId: eventContext.racetrackId, actorId: actor, source: eventContext.sourceService ?? 'responsible-ai-governor', timestamp, version: 1, id: eventId, type, subjectId, actor, evidence: [...evidence], lineage: [...lineage], auditId: audit.immutableAuditId ?? audit.id, correlationId: eventContext.correlationId, causationId: eventContext.causationId, digitalTwinRefs: [...(eventContext.digitalTwinRefs ?? [])], payload: { ...payload } };
    this.events.push(event);
    this.publishGovernedEvent(type, event, eventContext, audit.immutableAuditId ?? audit.id);
    return { event, auditId: audit.immutableAuditId ?? audit.id };
  }
  private requireModel(modelId: string) { const model = this.models.get(modelId); if (!model) throw new Error(`Unknown model ${modelId}`); return model; }
  private latestEvaluation(modelId: string) { return this.evaluations.filter((item) => item.modelId === modelId).sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt))[0]; }
  private latestEvaluationSummary(modelId: string) { const evaluation = this.latestEvaluation(modelId); return evaluation ? { safetyPassed: evaluation.safety.passed, explainabilityScore: evaluation.explainability.score, fairnessScore: evaluation.fairness.score } : undefined; }
  private latestRisk(modelId: string) { return this.risks.filter((item) => item.modelId === modelId).sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))[0]; }
  private riskLevel(risk: RiskAssessment): RiskLevel { const score = risk.impact * risk.likelihood; return score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low'; }
  private transition(modelId: string, status: ModelLifecycleStatus, actor: string, evidence: string[]) { const model = this.requireModel(modelId); model.status = status; this.audit(`model-${status}`, actor, modelId, evidence); }
  private audit(action: string, actor: string, subject: string, evidence: string[], timestamp = new Date().toISOString(), context: Partial<AIControlPlaneContext> = {}, payload: Record<string, unknown> = {}) {
    const eventContext = this.completeContext(subject, context);
    const immutableAuditId = `immutable-audit-${this.auditTrail.length + 1}`;
    const entry = { id: `audit-${this.auditTrail.length + 1}`, immutableAuditId, timestamp, actor, action, subject, evidence: [...evidence], tenantId: eventContext.tenantId, racetrackId: eventContext.racetrackId, correlationId: eventContext.correlationId, causationId: eventContext.causationId, digitalTwinRefs: [...(eventContext.digitalTwinRefs ?? [])], payload: { ...payload } };
    this.auditTrail.push(entry);
    this.deps.auditLog?.append({
      id: immutableAuditId,
      type: action === 'ai.approval.required' ? 'approval' : action.includes('digital-twin') ? 'digital-twin-update' : action.startsWith('ai.') || action.startsWith('model-') ? 'ai-recommendation' : 'system-event',
      actor,
      actorType: actor.includes('agent') || actor.includes('ai') ? 'ai-agent' : 'service',
      timestamp,
      action,
      actionClass: action === 'ai.approval.required' ? 'approval' : 'ai',
      target: subject,
      decision: action.includes('blocked') || action.includes('safety-blocked') ? 'blocked' : payload.allowed === false ? 'denied' : payload.allowed === true ? 'allowed' : 'observed',
      sourceService: eventContext.sourceService ?? 'responsible-ai-governor',
      payload: { action, subject, evidence, tenantId: eventContext.tenantId, racetrackId: eventContext.racetrackId, causationId: eventContext.causationId, digitalTwinRefs: eventContext.digitalTwinRefs, ...payload },
      subjectId: subject,
      tenantId: eventContext.tenantId,
      workflowId: eventContext.workflowRef,
      correlationId: eventContext.correlationId,
      severity: action.includes('blocked') || payload.riskLevel === 'critical' ? 'critical' : action.includes('approval') || payload.riskLevel === 'high' ? 'warning' : 'info',
      regulations: ['ISO-42001', 'NIST-AI-RMF'],
      evidenceIds: [...new Set([...evidence, ...(eventContext.digitalTwinRefs ?? [])])],
    });
    return entry;
  }
  private contextFrom(input: { tenantId?: string; racetrackId?: string; correlationId?: string; causationId?: string; digitalTwinRefs?: string[] }, subjectId: string): AIControlPlaneContext {
    return this.completeContext(subjectId, { tenantId: input.tenantId, racetrackId: input.racetrackId, correlationId: input.correlationId, causationId: input.causationId, digitalTwinRefs: input.digitalTwinRefs });
  }
  private completeContext(subjectId: string, context: Partial<AIControlPlaneContext> = {}, lineage: string[] = []): AIControlPlaneContext {
    const digitalTwinRefs = [...new Set([context.digitalTwinRef, ...(context.digitalTwinRefs ?? []), ...lineage.filter((item) => item.startsWith('twin:'))].filter((item): item is string => Boolean(item)))];
    return {
      tenantId: context.tenantId ?? 'unknown-tenant',
      racetrackId: context.racetrackId ?? 'unknown-racetrack',
      correlationId: context.correlationId ?? subjectId,
      causationId: context.causationId,
      aggregateId: context.aggregateId ?? subjectId,
      subjectId: context.subjectId ?? subjectId,
      subjectType: context.subjectType ?? 'ai-governance',
      auditRef: context.auditRef ?? context.correlationId,
      digitalTwinRef: context.digitalTwinRef ?? digitalTwinRefs[0],
      digitalTwinRefs,
      approvalRef: context.approvalRef,
      workflowRef: context.workflowRef,
      sourceService: context.sourceService ?? 'responsible-ai-governor',
    };
  }
  private publishGovernedEvent(type: AIGovernanceEventType, event: AIGovernanceEvent, context: AIControlPlaneContext, auditRef: string): void {
    const publish = this.deps.eventBus?.publish({
      id: event.eventId,
      type: event.eventType,
      payload: { ...event.payload, eventId: event.eventId, eventType: event.eventType, subjectId: event.subjectId, actor: event.actor, timestamp: event.timestamp, evidence: event.evidence, lineage: event.lineage, tenantId: context.tenantId, racetrackId: context.racetrackId, correlationId: context.correlationId, causationId: context.causationId, auditRef, digitalTwinRefs: context.digitalTwinRefs },
      producer: event.source,
      tenantId: context.tenantId,
      racetrackId: context.racetrackId,
      aggregateId: context.aggregateId ?? event.subjectId,
      correlationId: context.correlationId,
      causationId: context.causationId,
      auditRef,
      digitalTwinRef: context.digitalTwinRef,
      digitalTwinRefs: context.digitalTwinRefs,
      approvalRef: context.approvalRef,
      workflowRef: context.workflowRef,
      actor: { id: event.actor, type: event.actor.includes('agent') || event.actor.includes('ai') ? 'ai-agent' : 'service' },
      subject: { id: context.subjectId ?? event.subjectId, type: context.subjectType ?? 'ai-governance', tenantId: context.tenantId },
      evidence: [...new Set([...event.evidence, auditRef])],
      metadata: { compliance: 'regulated', team: 'data-and-ai-governance', accountableRole: 'compliance-officer', tenantId: context.tenantId, racetrackId: context.racetrackId, auditRef, digitalTwinRef: context.digitalTwinRef, digitalTwinRefs: context.digitalTwinRefs, causationId: context.causationId, regulations: ['ISO-42001', 'NIST-AI-RMF'] },
    });
    if (publish) void publish.catch(() => undefined);
  }
  private queueRecommendationTwinAdvisory(record: RecommendationRecord & { status: GovernanceRecommendationStatus; confidenceScore: ConfidenceScore; explainability: ExplainabilityRecord; digitalTwinRefs?: string[] }, twinImpacts: AIDigitalTwinImpact[], context: AIControlPlaneContext): void {
    for (const impact of twinImpacts) this.publishAdvisoryTwinPatch(impact.twinId, record.createdAt, record.agentId, context, {
      aiRecommendationSummary: record.recommendation,
      riskLevel: record.riskLevel,
      evidenceIds: [...record.evidence],
      approvalRequired: impact.approvalRequired,
      recommendationId: record.id,
      advisoryOnly: true,
    });
  }
  private queueGovernorTwinAdvisory(record: AIGovernorReviewRecord): void {
    const context = this.contextFrom(record, record.recommendationId ?? record.id);
    for (const twinId of record.digitalTwinRefs ?? []) this.publishAdvisoryTwinPatch(twinId, record.reviewedAt, record.actor, context, {
      aiRecommendationSummary: record.recommendationId ? `Governor reviewed ${record.recommendationId}` : 'Governor reviewed AI action',
      riskLevel: record.riskLevel,
      evidenceIds: [...record.evidence],
      approvalRequired: record.approvalRequired,
      governorReviewId: record.id,
      advisoryOnly: true,
    });
  }
  private publishAdvisoryTwinPatch(twinId: string, observedAt: string, actor: string, context: AIControlPlaneContext, patch: Record<string, unknown>): void {
    const publish = this.deps.eventBus?.publish({
      type: 'digital-twin.state.patch',
      payload: { twinId, tenantId: context.tenantId, actor, observedAt, patch, evidence: Array.isArray(patch.evidenceIds) ? patch.evidenceIds : [], advisoryOnly: true, command: false },
      producer: 'responsible-ai-governor',
      tenantId: context.tenantId,
      racetrackId: context.racetrackId,
      aggregateId: twinId,
      correlationId: context.correlationId,
      causationId: context.causationId,
      auditRef: context.auditRef ?? context.correlationId,
      digitalTwinRef: twinId,
      digitalTwinRefs: [twinId],
      actor: { id: actor, type: actor.includes('agent') || actor.includes('ai') ? 'ai-agent' : 'service' },
      subject: { id: twinId, type: 'digital-twin', tenantId: context.tenantId },
      evidence: Array.isArray(patch.evidenceIds) ? patch.evidenceIds.filter((item): item is string => typeof item === 'string') : [],
      metadata: { compliance: 'regulated', team: 'data-and-ai-governance', accountableRole: 'compliance-officer', tenantId: context.tenantId, racetrackId: context.racetrackId, advisoryOnly: true, safeForStateMutation: false, noOperationalCommands: true },
    });
    if (publish) void publish.catch(() => undefined);
  }
  private registerControlPlaneEventContracts(): void {
    if (!this.deps.eventBus) return;
    const owner = { service: 'responsible-ai-governor', team: 'data-and-ai-governance', accountableRole: 'compliance-officer' };
    const standards = (digitalTwinReferenceRequired = false): EventContract['standards'] => ({ tenantScoped: true, racetrackScoped: true, correlationRequired: true, auditRequired: true, digitalTwinReferenceRequired, replayable: true, requiredMetadata: ['tenantId', 'racetrackId', 'correlationId', 'aggregateId', 'actor', 'subject', 'payload', 'auditRef', 'evidence', ...(digitalTwinReferenceRequired ? ['digitalTwinRef' as const] : [])], cqrsProjection: 'ai-governance.read-model', observabilitySignals: ['event.published', 'handler.delivered', 'event.dead-lettered'], frontendConsumers: ['ai-governance', 'operations-command'] });
    const contracts: EventContract[] = [
      { type: 'ai.input.ingested', version: 1, description: 'AI control-plane input ingestion event', owner, payloadFields: ['inputId', 'source', 'inputHash', 'dataClassification'], compliance: 'regulated', standards: standards() },
      { type: 'ai.features.built', version: 1, description: 'AI control-plane feature build event', owner, payloadFields: ['featureBuildId', 'inputId', 'featureSetId', 'features'], compliance: 'regulated', standards: standards() },
      { type: 'ai.model.selected', version: 1, description: 'AI control-plane model selection event', owner, payloadFields: ['selectionId', 'modelVersionId', 'featureBuildId', 'selectionReason'], compliance: 'regulated', standards: standards() },
      { type: 'ai.recommendation.created', version: 1, description: 'AI control-plane recommendation creation event', owner, payloadFields: ['recommendationId', 'confidence', 'riskLevel', 'approvalRequired', 'advisoryOnly', 'digitalTwinRefs'], compliance: 'regulated', standards: standards(true) },
      { type: 'ai.governor.reviewed', version: 1, description: 'Responsible AI governor decision review event', owner, payloadFields: ['reviewId', 'action', 'allowed', 'riskLevel', 'approvalRequired', 'digitalTwinRefs'], compliance: 'regulated', standards: standards(true) },
      { type: 'ai.action.blocked', version: 1, description: 'Protected AI action blocked before execution', owner, payloadFields: ['recommendationId', 'action', 'target', 'reason', 'riskLevel', 'digitalTwinRefs'], compliance: 'restricted', standards: standards(true) },
      { type: 'ai.approval.required', version: 1, description: 'AI output requires human approval before any controlled action', owner, payloadFields: ['approvalId', 'recommendationId', 'action', 'policy', 'requiredRoles'], compliance: 'regulated', standards: standards() },
      { type: 'ai.dashboard.updated', version: 1, description: 'AI governance dashboard projection updated', owner, payloadFields: ['dashboardId', 'summary', 'metrics'], compliance: 'regulated', standards: standards() },
    ];
    for (const contract of contracts) this.deps.eventBus.registerEvent(contract);
  }
  private cloneEvaluation(evaluation: ModelEvaluation): ModelEvaluation { return { ...evaluation, metrics: { ...evaluation.metrics }, explainability: { ...evaluation.explainability, artifacts: [...evaluation.explainability.artifacts] }, safety: { ...evaluation.safety, controls: [...evaluation.safety.controls] }, fairness: { ...evaluation.fairness, segments: [...evaluation.fairness.segments] }, privacy: { ...evaluation.privacy, controls: [...evaluation.privacy.controls] }, security: { ...evaluation.security }, quality: { ...evaluation.quality } }; }
  private controlCoverage(modelId: string) { return ['AI management system', 'information security', 'privacy engineering', 'software quality', 'risk treatment', 'NIST govern-map-measure-manage', 'human oversight', 'rollback and incident response'].map((control) => ({ control, modelId })); }
  private controlsFor(framework: GovernanceFramework) { return ({ ISO42001: ['AI policy', 'impact assessment', 'model lifecycle control'], ISO27001: ['access control', 'secure operations', 'incident management'], ISO27701: ['PII inventory', 'privacy impact assessment', 'processor controls'], ISO25010: ['reliability', 'maintainability', 'performance efficiency'], ISO31000: ['risk identification', 'risk evaluation', 'risk treatment'], 'NIST-AI-RMF': ['govern', 'map', 'measure', 'manage'], 'Enterprise-Governance': ['accountability', 'segregation of duties', 'audit committee reporting'] } satisfies Record<GovernanceFramework, string[]>)[framework]; }
  private canonicalAction(action: string) { return this.controlledActionFor(action) ?? normalizeGovernorAction(action); }
  private controlledActionFor(action: string): ControlledAction | undefined {
    const normalized = normalizeGovernorAction(action);
    const direct = approvalActionAliases[action] ?? approvalActionAliases[normalized];
    if (direct) return direct;
    return controlledApprovalActions.includes(normalized as ControlledAction) ? normalized as ControlledAction : undefined;
  }
  private isProtectedAction(action: string) { const canonicalAction = this.canonicalAction(action); return this.governor.isBlockedAction(action) || this.governor.isBlockedAction(canonicalAction) || protectedActions.includes(canonicalAction as ProtectedAction) || Boolean(this.controlledActionFor(action)); }
  private enforceSafetyPolicy(input: RecommendationRecord, agent: AIAgent, prompt: PromptTemplate, activity: AIAllowedActivity, action: string): void {
    if (!aiAllowedActivities.includes(activity)) throw new Error('AI activity is outside the advisory boundary');
    if (!(agent.allowedActivities ?? aiAllowedActivities).includes(activity)) throw new Error(`AI agent ${agent.id} is not registered for ${activity}`);
    if (!(prompt.allowedActivities ?? aiAllowedActivities).includes(activity)) throw new Error(`Prompt template ${prompt.id} is not approved for ${activity}`);
    if (agent.allowedActions.length > 0 && !agent.allowedActions.includes(input.action) && !agent.allowedActions.includes(action) && !this.isProtectedAction(action)) throw new Error(`AI agent ${agent.id} is not registered for action ${input.action}`);
  }
  private scoreConfidence(input: RecommendationRecord): ConfidenceScore {
    const drivers = [`raw:${input.confidence.toFixed(2)}`, `evidence:${input.evidence.length}`, `assets:${input.affectedAssets.length}`];
    const evidenceLift = Math.min(0.08, input.evidence.length * 0.02);
    const lineageLift = Math.min(0.04, Math.max(0, input.lineage.length - 3) * 0.01);
    const riskPenalty = input.riskLevel === 'critical' ? 0.08 : input.riskLevel === 'high' ? 0.04 : 0;
    const calibrated = Number(Math.max(0.01, Math.min(0.99, input.confidence + evidenceLift + lineageLift - riskPenalty)).toFixed(2));
    return { raw: input.confidence, calibrated, band: calibrated >= 0.8 ? 'high' : calibrated >= 0.55 ? 'medium' : 'low', drivers };
  }
  private explain(input: RecommendationRecord, confidence: ConfidenceScore, protectedOrRestricted: boolean): ExplainabilityRecord {
    return {
      recommendationId: input.id,
      method: input.explainability?.method ?? 'evidence-lineage-rationale',
      rationale: input.explainability?.rationale ?? `Recommendation is based on ${input.evidence.length} evidence references, ${input.affectedAssets.length} affected assets, and ${confidence.band} calibrated confidence.`,
      citedEvidence: [...(input.explainability?.citedEvidence ?? input.evidence)],
      limitations: [...(input.explainability?.limitations ?? ['Advisory only; no protected operational action may execute without authorized human approval.'])],
      humanReviewRequired: protectedOrRestricted || input.approvalPolicy !== 'none' || input.riskLevel === 'high' || input.riskLevel === 'critical',
      score: input.explainability?.score ?? confidence.calibrated,
    };
  }
  private buildApprovalRequirements(record: RecommendationRecord & { status: GovernanceRecommendationStatus }, restricted: boolean): ApprovalRequirementRecord[] {
    if (!restricted && record.approvalPolicy === 'none') return [];
    const controlledAction = this.controlledActionFor(record.action);
    const policy = controlledAction && record.approvalPolicy === 'none' ? 'role-policy-map' : record.approvalPolicy;
    return [{ id: `approval-${record.id}`, recommendationId: record.id, action: record.action, policy, controlledAction, requiredRoles: controlledAction ? this.rolesForControlledAction(controlledAction) : this.rolesFor(record.approvalPolicy, record.action), status: 'pending', evidence: ['human-approval-record', 'reason', ...record.evidence] }];
  }
  private rolesFor(policy: GovernanceApprovalPolicy, action: string): string[] {
    const configured = this.governor.requiredRolesFor(action);
    if (configured.length) return configured;
    if (policy === 'governance-board') return ['compliance-officer', 'admin'];
    if (policy === 'veterinarian') return ['veterinarian'];
    if (policy === 'steward') return ['steward'];
    if (policy === 'two-person') return ['steward', 'compliance-officer'];
    if (action === 'race-start') return ['racing-secretary', 'steward', 'veterinarian'];
    if (action === 'payout' || action === 'official-results') return ['steward', 'finance'];
    return ['compliance-officer'];
  }
  private rolesForControlledAction(action: ControlledAction): string[] {
    if (action === 'starting-gate-move') return ['racing-secretary', 'track-superintendent'];
    if (action.startsWith('surface-')) return ['track-superintendent'];
    if (action === 'veterinary-clearance' || action === 'clear-vet-flag' || action === 'medication-decision') return ['veterinarian'];
    if (action === 'steward-ruling' || action === 'steward-decision' || action === 'disciplinary-decision') return ['steward'];
    const configured = this.governor.requiredRolesFor(action);
    if (configured.length) return configured;
    if (action === 'race-start') return ['racing-secretary', 'steward', 'veterinarian'];
    if (action === 'scratch-horse' || action === 'race-office-scratch') return ['veterinarian', 'steward'];
    if (action === 'official-results' || action === 'modify-official-results' || action === 'payout') return ['steward', action === 'payout' ? 'finance' : 'finance'];
    if (action === 'race-distance-configuration' || action === 'race-office-configuration') return ['racing-secretary', 'track-superintendent', 'steward'];
    if (action === 'compliance-filing-approval') return ['compliance-officer'];
    return this.rolesFor('single-human', action);
  }
  private createHumanApprovalWorkflows(record: RecommendationRecord & { status: GovernanceRecommendationStatus; activity?: AIAllowedActivity }, agent: AIAgent, approvalRequirements: ApprovalRequirementRecord[]): HumanInLoopWorkflowRecord[] {
    const workflows: HumanInLoopWorkflowRecord[] = [];
    for (const requirement of approvalRequirements) {
      const controlledAction = requirement.controlledAction ?? this.controlledActionFor(requirement.action);
      const workflowEvidence = [...new Set(['human-in-the-loop-workflow', `recommendation:${record.id}`, ...requirement.evidence])];
      const approvalRequest = controlledAction ? this.requestControlledApproval(record, agent, controlledAction, workflowEvidence) : undefined;
      const draftWorkOrder = record.activity === 'create-draft-action' ? this.createDraftWorkOrder(record, controlledAction, workflowEvidence) : undefined;
      const emitted = this.emit('ai.approval.workflow.created', record.id, agent.id, workflowEvidence, [requirement.id, ...(approvalRequest ? [approvalRequest.id] : []), ...record.lineage], record.createdAt);
      const workflow: HumanInLoopWorkflowRecord = {
        id: `hitl-${record.id}-${workflows.length + 1}`,
        recommendationId: record.id,
        action: record.action,
        controlledAction,
        target: record.target,
        affectedAssets: [...record.affectedAssets],
        evidence: workflowEvidence,
        riskLevel: record.riskLevel,
        requiredRoles: [...requirement.requiredRoles],
        approvalRequestId: approvalRequest?.id,
        auditId: emitted.auditId,
        eventId: emitted.event.id,
        status: approvalRequest ? 'pending-approval' : record.status === 'safety-blocked' ? 'safety-blocked' : 'draft',
        draftWorkOrderId: draftWorkOrder?.id,
        advisoryOnly: true,
        executionAllowed: false,
      };
      requirement.approvalRequestId = approvalRequest?.id;
      requirement.workflowRecordId = workflow.id;
      requirement.auditId = workflow.auditId;
      requirement.eventId = workflow.eventId;
      workflows.push(workflow);
      this.humanInLoopWorkflows.push(workflow);
    }
    return workflows;
  }
  private requestControlledApproval(record: RecommendationRecord, agent: AIAgent, action: ControlledAction, evidence: string[]): ControlledActionRequest | undefined {
    const approvalService = this.deps.approvalService ?? this.deps.centralizedApprovals;
    if (!approvalService) return undefined;
    return approvalService.createRequest({
      id: `approval-${record.id}-${action}`,
      tenantId: record.tenantId ?? agent.tenantId ?? 'trackmind',
      racetrackId: record.racetrackId ?? record.tenantId ?? agent.tenantId ?? 'trackmind',
      action,
      target: record.target,
      requestedBy: agent.id,
      actorType: 'ai-agent',
      reason: `AI recommendation ${record.id} requests human approval for ${action}. ${record.recommendation}`,
      evidence,
      now: record.createdAt,
    });
  }
  private createDraftWorkOrder(record: RecommendationRecord, controlledAction: ControlledAction | undefined, evidence: string[]): DraftWorkOrderRecord {
    const workOrder: DraftWorkOrderRecord = { id: `draft-work-order-${record.id}`, recommendationId: record.id, action: record.action, controlledAction, target: record.target, summary: record.recommendation, affectedAssets: [...record.affectedAssets], evidence: [...new Set(['draft-only:no-live-actuator-control', ...evidence])], riskLevel: record.riskLevel, createdAt: record.createdAt, executionState: 'draft-only', executionAllowed: false };
    this.draftWorkOrders.push(workOrder);
    return workOrder;
  }
  private logBlockedAutonomousExecution(recommendation: RecommendationRecord & { status: GovernanceRecommendationStatus; confidenceScore: ConfidenceScore; explainability: ExplainabilityRecord }, actor: string, governorReview?: AIGovernorReviewRecord): BlockedAutonomousExecutionRecord {
    const evidence = [...new Set(['blocked-autonomous-execution', `recommendation:${recommendation.id}`, ...(governorReview?.policyEvidence ?? []), ...recommendation.evidence])];
    const context = this.contextFrom(recommendation, recommendation.id);
    const reason = governorReview?.reason ? `Blocked: ${governorReview.reason}` : 'Blocked: protected AI recommendation cannot execute autonomously; approval workflow is request and evidence only.';
    const payload = { recommendationId: recommendation.id, action: recommendation.action, target: recommendation.target, reason, riskLevel: recommendation.riskLevel, governorReviewId: governorReview?.id, digitalTwinRefs: recommendation.digitalTwinRefs ?? [] };
    const emitted = this.emit('ai.action.blocked', recommendation.id, actor, evidence, recommendation.lineage, new Date().toISOString(), context, payload);
    this.emit('ai.autonomous-execution.blocked', recommendation.id, actor, evidence, recommendation.lineage, emitted.event.timestamp, context, payload);
    this.emit('ai.recommendation.blocked', recommendation.id, actor, evidence, recommendation.lineage, emitted.event.timestamp, context, { recommendationId: recommendation.id, status: recommendation.status, advisoryOnly: true, governorReviewId: governorReview?.id });
    const log: BlockedAutonomousExecutionRecord = { id: `blocked-execution-${this.blockedAutonomousExecutions.length + 1}`, recommendationId: recommendation.id, action: recommendation.action, target: recommendation.target, actor, reason, confidence: recommendation.confidenceScore.calibrated, riskLevel: recommendation.riskLevel, evidence, blockedAt: emitted.event.timestamp, auditId: emitted.auditId, eventId: emitted.event.id };
    this.blockedAutonomousExecutions.push(log);
    return log;
  }
  private buildDigitalTwinImpacts(record: RecommendationRecord & { status: GovernanceRecommendationStatus }): AIDigitalTwinImpact[] {
    const advisoryPatch = (approvalRequired: boolean): Record<string, unknown> => ({ aiRecommendationSummary: record.recommendation, riskLevel: record.riskLevel, evidenceIds: [...record.evidence], approvalRequired, recommendationId: record.id, advisoryOnly: true });
    const explicit = record.digitalTwinImpacts?.map((impact) => ({ ...impact, patch: advisoryPatch(impact.approvalRequired), advisoryOnly: true as const, recommendationId: record.id, eventType: 'ai.digital-twin.impact.queued' })) ?? [];
    if (explicit.length) return explicit;
    const review = this.governorReviews.find((item) => item.recommendationId === record.id);
    return record.affectedAssets.map((assetId) => { const approvalRequired = record.approvalPolicy !== 'none' || this.isProtectedAction(record.action) || review?.blockedAutonomousExecution === true; return { twinId: assetId.startsWith('twin:') ? assetId : `twin:${assetId.replace(/[:/]/g, '-')}`, assetId, kind: assetId.includes('approval') ? 'approval' : assetId.includes('incident') ? 'incident' : 'asset', patch: advisoryPatch(approvalRequired), approvalRequired, recommendationId: record.id, eventType: 'ai.digital-twin.impact.queued', auditId: `audit-${record.id}`, advisoryOnly: true }; });
  }
  private buildObservabilitySignals(record: RecommendationRecord & { status: GovernanceRecommendationStatus; confidenceScore: ConfidenceScore }, restricted: boolean): ObservabilityRecord[] {
    const observedAt = record.createdAt;
    const traceId = `trace:${record.id}`;
    return [
      { id: `obs-${this.observabilitySignals.length + 1}`, subjectId: record.id, metric: 'confidence', value: record.confidenceScore.calibrated, threshold: 0.7, status: record.confidenceScore.calibrated < 0.7 ? 'warning' : 'nominal', traceId, observedAt, evidence: [...record.evidence] },
      { id: `obs-${this.observabilitySignals.length + 2}`, subjectId: record.id, metric: 'evidence-count', value: record.evidence.length, threshold: 1, status: record.evidence.length < 1 ? 'critical' : 'nominal', traceId, observedAt, evidence: [...record.evidence] },
      { id: `obs-${this.observabilitySignals.length + 3}`, subjectId: record.id, metric: 'approval-required', value: restricted || record.approvalPolicy !== 'none' ? 1 : 0, threshold: 0, status: restricted || record.approvalPolicy !== 'none' ? 'warning' : 'nominal', traceId, observedAt, evidence: [...record.evidence] },
    ];
  }
  private cloneGovernorReview(record: AIGovernorReviewRecord) { return { ...record, evidence: [...record.evidence], policyEvidence: [...(record.policyEvidence ?? [])], requiredApproverRoles: [...(record.requiredApproverRoles ?? [])], digitalTwinRefs: [...(record.digitalTwinRefs ?? [])] }; }
  private cloneRecommendation(record: RecommendationRecord & { status: GovernanceRecommendationStatus; confidenceScore: ConfidenceScore; explainability: ExplainabilityRecord }) {
    const governorReview = this.governorReviews.find((review) => review.recommendationId === record.id);
    const approval = this.approvalRequirements.find((requirement) => requirement.recommendationId === record.id);
    const auditIds = this.auditTrail.filter((audit) => audit.subject === record.id).map((audit) => audit.immutableAuditId ?? audit.id);
    const eventIds = this.events.filter((event) => event.subjectId === record.id).map((event) => event.id);
    const digitalTwinRefs = [...new Set([...(record.digitalTwinRefs ?? []), ...this.digitalTwinImpacts.filter((impact) => impact.recommendationId === record.id).map((impact) => impact.twinId)])];
    return {
      ...record,
      recommendationId: record.id,
      modelVersion: record.modelVersionId,
      generatedAt: record.createdAt,
      approvalRequirement: { required: Boolean(approval) || record.approvalPolicy !== 'none', policy: approval?.policy ?? record.approvalPolicy, requirementId: approval?.id, workflowId: approval?.workflowRecordId ?? approval?.approvalRequestId },
      auditReference: { auditIds, eventIds, digitalTwinRefs, approvalReference: approval?.approvalRequestId ?? approval?.id },
      affectedAssets: [...record.affectedAssets],
      evidence: [...record.evidence],
      lineage: [...record.lineage],
      digitalTwinRefs,
      confidenceScore: { ...record.confidenceScore, drivers: [...record.confidenceScore.drivers] },
      explainability: { ...record.explainability, citedEvidence: [...record.explainability.citedEvidence], limitations: [...record.explainability.limitations] },
      governorReview: governorReview ? this.cloneGovernorReview(governorReview) : undefined,
      digitalTwinImpacts: record.digitalTwinImpacts?.map((impact) => ({ ...impact, patch: { ...impact.patch } })),
    };
  }
}
