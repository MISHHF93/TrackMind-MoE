import { protectedActions, type ProtectedAction } from '@trackmind/shared';
import type { ApprovalStore } from './approvals.js';

export type GovernanceFramework = 'ISO42001' | 'ISO27001' | 'ISO27701' | 'ISO25010' | 'ISO31000' | 'NIST-AI-RMF' | 'Enterprise-Governance';
export type ModelCriticality = 'low' | 'medium' | 'high' | 'safety-critical';
export type ModelLifecycleStatus = 'registered' | 'evaluating' | 'pending-approval' | 'approved' | 'deployed' | 'suspended' | 'retired' | 'rolled-back';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';


export type AIGovernanceEventType = 'ai.agent.registered' | 'ai.prompt.published' | 'ai.recommendation.recorded' | 'ai.recommendation.blocked' | 'ai.override.recorded' | 'ai.rollback.recorded' | 'ai.metric.observed';
export type GovernanceRecommendationStatus = 'queued' | 'approved' | 'safety-blocked' | 'executed' | 'overridden' | 'rolled-back';
export type GovernanceApprovalPolicy = 'none' | 'single-human' | 'two-person' | 'governance-board' | 'veterinarian' | 'steward';

export interface AIAgent { id: string; name: string; owner: string; modelVersionId: string; promptTemplateId: string; status: 'active' | 'paused' | 'retired'; allowedActions: string[]; restrictedActions: string[]; }
export interface PromptTemplate { id: string; name: string; version: string; owner: string; template: string; evidence: string[]; status: 'draft' | 'approved' | 'retired'; }
export interface EvidencePackage { id: string; recommendationId?: string; evidence: string[]; lineage: string[]; createdAt: string; hash: string; }
export interface RecommendationRecord { id: string; agentId: string; modelVersionId: string; promptTemplateId: string; action: string; target: string; recommendation: string; confidence: number; affectedAssets: string[]; evidence: string[]; lineage: string[]; approvalPolicy: GovernanceApprovalPolicy; riskLevel: RiskLevel; status?: GovernanceRecommendationStatus; createdAt: string; }
export interface OverrideRecord { id: string; recommendationId: string; actor: string; reason: string; evidence: string[]; createdAt: string; }
export interface RollbackRecord { id: string; recommendationId: string; actor: string; reason: string; restoredVersionId: string; evidence: string[]; createdAt: string; }
export interface AIGovernanceEvent { id: string; type: AIGovernanceEventType; subjectId: string; actor: string; timestamp: string; evidence: string[]; lineage: string[]; }

export interface GovernanceDecision {
  allowed: boolean;
  action: string;
  reason?: string;
  approvalId?: string;
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
  constructor(private readonly approvals: ApprovalStore) {}

  assertMayAutomate(action: ProtectedAction | string, recommendationId: string): GovernanceDecision {
    if (!protectedActions.includes(action as ProtectedAction)) {
      return { allowed: true, action };
    }

    const approval = this.approvals.findApproved(action, recommendationId);
    if (!approval) {
      return {
        allowed: false,
        action,
        reason: `Human approval required before automating ${action}`,
      };
    }

    return { allowed: true, action, approvalId: approval.id };
  }
}

export class ResponsibleAIGovernancePlatform {
  private readonly models = new Map<string, ModelRegistration & { status: ModelLifecycleStatus }>();
  private readonly evaluations: ModelEvaluation[] = [];
  private readonly risks: RiskAssessment[] = [];
  private readonly monitoring: MonitoringSignal[] = [];
  private readonly agents = new Map<string, AIAgent>();
  private readonly prompts = new Map<string, PromptTemplate>();
  private readonly recommendations = new Map<string, RecommendationRecord & { status: GovernanceRecommendationStatus }>();
  private readonly evidencePackages: EvidencePackage[] = [];
  private readonly overrides: OverrideRecord[] = [];
  private readonly rollbacks: RollbackRecord[] = [];
  private readonly events: AIGovernanceEvent[] = [];
  private readonly auditTrail: Array<{ id: string; timestamp: string; actor: string; action: string; subject: string; evidence: string[] }> = [];


  registerAgent(agent: AIAgent) { this.requireModel(agent.modelVersionId); this.agents.set(agent.id, { ...agent, allowedActions: [...agent.allowedActions], restrictedActions: [...agent.restrictedActions] }); this.emit('ai.agent.registered', agent.id, agent.owner, [], [agent.modelVersionId, agent.promptTemplateId]); return this.agents.get(agent.id)!; }

  publishPromptTemplate(prompt: PromptTemplate) { if (prompt.status === 'approved' && prompt.evidence.length === 0) throw new Error('Approved prompt templates require evidence'); this.prompts.set(prompt.id, { ...prompt, evidence: [...prompt.evidence] }); this.emit('ai.prompt.published', prompt.id, prompt.owner, prompt.evidence, [prompt.version]); return this.prompts.get(prompt.id)!; }

  recordRecommendation(input: RecommendationRecord) {
    const agent = this.agents.get(input.agentId); if (!agent) throw new Error(`Unknown AI agent ${input.agentId}`);
    if (!this.prompts.has(input.promptTemplateId)) throw new Error(`Unknown prompt template ${input.promptTemplateId}`);
    this.requireModel(input.modelVersionId);
    const missing = this.recommendationGaps(input);
    if (missing.length) throw new Error(`AI recommendation governance gaps: ${missing.join(', ')}`);
    const restricted = protectedActions.includes(input.action as ProtectedAction) || agent.restrictedActions.includes(input.action);
    const status: GovernanceRecommendationStatus = restricted && input.approvalPolicy === 'none' ? 'safety-blocked' : 'queued';
    const record = { ...input, affectedAssets: [...input.affectedAssets], evidence: [...input.evidence], lineage: [...input.lineage], status };
    this.recommendations.set(record.id, record);
    this.evidencePackages.push({ id: `evidence-${record.id}`, recommendationId: record.id, evidence: [...record.evidence], lineage: [...record.lineage], createdAt: record.createdAt, hash: `sha256:${record.id}:${record.evidence.join('|')}` });
    this.emit(status === 'safety-blocked' ? 'ai.recommendation.blocked' : 'ai.recommendation.recorded', record.id, agent.id, record.evidence, record.lineage, record.createdAt);
    return { ...record };
  }

  executeRecommendation(recommendationId: string, actor: string) {
    const recommendation = this.requireRecommendation(recommendationId);
    const protectedOrApproval = protectedActions.includes(recommendation.action as ProtectedAction) || recommendation.approvalPolicy !== 'none';
    if (protectedOrApproval || recommendation.status === 'safety-blocked') { recommendation.status = 'safety-blocked'; this.emit('ai.recommendation.blocked', recommendationId, actor, recommendation.evidence, recommendation.lineage); return { executed: false, reason: 'AI execution blocked; required human approval policy must be fulfilled by controlled workflow' }; }
    recommendation.status = 'executed'; this.audit('ai-recommendation-executed', actor, recommendationId, recommendation.evidence); return { executed: true };
  }

  recordOverride(record: OverrideRecord) { const rec = this.requireRecommendation(record.recommendationId); rec.status = 'overridden'; this.overrides.push({ ...record, evidence: [...record.evidence] }); this.emit('ai.override.recorded', record.id, record.actor, record.evidence, rec.lineage, record.createdAt); return record; }
  recordRollback(record: RollbackRecord) { const rec = this.requireRecommendation(record.recommendationId); rec.status = 'rolled-back'; this.rollbacks.push({ ...record, evidence: [...record.evidence] }); this.emit('ai.rollback.recorded', record.id, record.actor, record.evidence, [record.restoredVersionId, ...rec.lineage], record.createdAt); return record; }

  governanceWorkspace() { const recs = [...this.recommendations.values()]; return { activeAgents: [...this.agents.values()].filter((a) => a.status === 'active'), recommendationQueue: recs.filter((r) => r.status === 'queued'), safetyBlockedActions: recs.filter((r) => r.status === 'safety-blocked'), evaluationStatus: [...this.models.values()].map((m) => ({ modelVersionId: m.id, status: m.status, readiness: this.readiness(m.id) })), auditTrails: this.auditLog(), evidencePackages: this.evidencePackages.map((p) => ({ ...p, evidence: [...p.evidence], lineage: [...p.lineage] })), overrides: this.overrides, rollbackRecords: this.rollbacks, monitoringMetrics: [...this.monitoring], events: this.events }; }

  registerModel(model: ModelRegistration) {
    const registered = { ...model, status: model.status ?? 'registered' };
    this.models.set(model.id, { ...registered, intendedUse: [...model.intendedUse], prohibitedUse: [...model.prohibitedUse], lineage: [...model.lineage], evidence: [...model.evidence] });
    this.audit('model-registered', model.owner, model.id, model.evidence, model.registeredAt);
    return this.getModel(model.id)!;
  }

  recordEvaluation(evaluation: ModelEvaluation) {
    this.requireModel(evaluation.modelId);
    this.evaluations.push(this.cloneEvaluation(evaluation));
    this.transition(evaluation.modelId, 'evaluating', evaluation.evaluator, ['evaluation-recorded']);
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

  private recommendationGaps(input: RecommendationRecord) { const gaps: string[] = []; if (input.evidence.length === 0) gaps.push('evidence required'); if (input.confidence <= 0 || input.confidence > 1) gaps.push('confidence must be between 0 and 1'); if (input.affectedAssets.length === 0) gaps.push('affected assets required'); if (!input.approvalPolicy) gaps.push('approval policy required'); if (input.lineage.length < 3) gaps.push('traceable lineage requires agent, model, and prompt'); return gaps; }
  private requireRecommendation(id: string) { const rec = this.recommendations.get(id); if (!rec) throw new Error(`Unknown AI recommendation ${id}`); return rec; }
  private emit(type: AIGovernanceEventType, subjectId: string, actor: string, evidence: string[], lineage: string[], timestamp = new Date().toISOString()) { this.events.push({ id: `ai-event-${this.events.length + 1}`, type, subjectId, actor, timestamp, evidence: [...evidence], lineage: [...lineage] }); this.audit(type, actor, subjectId, evidence, timestamp); }
  private requireModel(modelId: string) { const model = this.models.get(modelId); if (!model) throw new Error(`Unknown model ${modelId}`); return model; }
  private latestEvaluation(modelId: string) { return this.evaluations.filter((item) => item.modelId === modelId).sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt))[0]; }
  private latestRisk(modelId: string) { return this.risks.filter((item) => item.modelId === modelId).sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))[0]; }
  private riskLevel(risk: RiskAssessment): RiskLevel { const score = risk.impact * risk.likelihood; return score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low'; }
  private transition(modelId: string, status: ModelLifecycleStatus, actor: string, evidence: string[]) { const model = this.requireModel(modelId); model.status = status; this.audit(`model-${status}`, actor, modelId, evidence); }
  private audit(action: string, actor: string, subject: string, evidence: string[], timestamp = new Date().toISOString()) { this.auditTrail.push({ id: `audit-${this.auditTrail.length + 1}`, timestamp, actor, action, subject, evidence: [...evidence] }); }
  private cloneEvaluation(evaluation: ModelEvaluation): ModelEvaluation { return { ...evaluation, metrics: { ...evaluation.metrics }, explainability: { ...evaluation.explainability, artifacts: [...evaluation.explainability.artifacts] }, safety: { ...evaluation.safety, controls: [...evaluation.safety.controls] }, fairness: { ...evaluation.fairness, segments: [...evaluation.fairness.segments] }, privacy: { ...evaluation.privacy, controls: [...evaluation.privacy.controls] }, security: { ...evaluation.security }, quality: { ...evaluation.quality } }; }
  private controlCoverage(modelId: string) { return ['AI management system', 'information security', 'privacy engineering', 'software quality', 'risk treatment', 'NIST govern-map-measure-manage', 'human oversight', 'rollback and incident response'].map((control) => ({ control, modelId })); }
  private controlsFor(framework: GovernanceFramework) { return ({ ISO42001: ['AI policy', 'impact assessment', 'model lifecycle control'], ISO27001: ['access control', 'secure operations', 'incident management'], ISO27701: ['PII inventory', 'privacy impact assessment', 'processor controls'], ISO25010: ['reliability', 'maintainability', 'performance efficiency'], ISO31000: ['risk identification', 'risk evaluation', 'risk treatment'], 'NIST-AI-RMF': ['govern', 'map', 'measure', 'manage'], 'Enterprise-Governance': ['accountability', 'segregation of duties', 'audit committee reporting'] } satisfies Record<GovernanceFramework, string[]>)[framework]; }
}
