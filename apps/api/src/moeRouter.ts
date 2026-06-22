import type { ApprovalStatus, ExpertDomain, ProtectedAction } from '@trackmind/shared';
import { protectedActions } from '@trackmind/shared';
import type { ApprovalStore } from './approvals.js';
import { ImmutableAuditLog, type AuditLogEntry } from './auditLog.js';

export interface ExpertResult {
  domain: ExpertDomain;
  confidence: number;
  recommendation: string;
  evidence: string[];
  requiredApprovals: ProtectedAction[];
}

export type RecommendationStatus = Extract<ApprovalStatus, 'draft' | 'pending-approval' | 'approved' | 'rejected'>;
export type ConflictSeverity = 'low' | 'medium' | 'high';
export type WorkflowTarget = 'race-control' | 'stewards' | 'veterinary' | 'security' | 'maintenance' | 'weather-desk' | 'finance' | 'executive-briefing' | 'compliance';

export interface EvidenceItem {
  id: string;
  source: string;
  summary: string;
  domains: ExpertDomain[];
  reliability: number;
}

export interface ExpertConflict {
  id: string;
  domains: ExpertDomain[];
  severity: ConflictSeverity;
  summary: string;
  resolution: string;
}

export interface ConsensusDecision {
  outcome: 'consensus' | 'conditional-consensus' | 'human-arbitration-required';
  agreementScore: number;
  rationale: string;
  dissentingDomains: ExpertDomain[];
}

export interface WorkflowIntegration {
  target: WorkflowTarget;
  action: string;
  humanApprovalRequired: boolean;
}

export interface DigitalTwinUpdatePlan {
  entityId: string;
  patch: Record<string, unknown>;
  sourceRecommendationId: string;
  requiresApproval: boolean;
}

export interface ObservabilitySnapshot {
  routedDomains: number;
  expertCalls: number;
  averageConfidence: number;
  evidenceItems: number;
  conflicts: number;
  protectedActions: number;
  traceId: string;
}

export interface GovernanceEnforcement {
  automationAllowed: boolean;
  protectedActions: ProtectedAction[];
  missingApprovals: ProtectedAction[];
  policy: 'human-in-the-loop';
  explanation: string;
}

export interface StructuredRecommendation {
  id: string;
  request: string;
  domains: ExpertDomain[];
  confidence: number;
  expertResults: ExpertResult[];
  evidence: string[];
  evidenceItems: EvidenceItem[];
  requiredApprovals: ProtectedAction[];
  status: RecommendationStatus;
  conflicts: ExpertConflict[];
  consensus: ConsensusDecision;
  workflows: WorkflowIntegration[];
  digitalTwinUpdates: DigitalTwinUpdatePlan[];
  governance: GovernanceEnforcement;
  observability: ObservabilitySnapshot;
  explanation: string;
  auditTrail: AuditLogEntry[];
}

type ExpertStub = (request: string) => Promise<ExpertResult>;

const domainKeywords: Record<ExpertDomain, string[]> = {
  RaceOps: ['race', 'start', 'stop', 'schedule', 'post parade', 'operations'],
  Stewarding: ['inquiry', 'objection', 'steward', 'results', 'disciplinary'],
  EquineSafety: ['horse', 'lameness', 'risk', 'workout', 'safety', 'equine'],
  VetCompliance: ['vet', 'medication', 'scratch', 'clear flag'],
  TrackSurface: ['track', 'moisture', 'cushion', 'compaction', 'surface'],
  WeatherEnvironment: ['weather', 'rain', 'wind', 'lightning', 'temperature'],
  WageringIntegrity: ['wager', 'odds', 'integrity', 'pool', 'payout'],
  TicketingFanExperience: ['ticket', 'parking', 'crowd', 'fan', 'accessibility'],
  SecuritySOC: ['security-manager', 'restricted', 'camera', 'emergency', 'suspicious'],
  FacilitiesIoT: ['sensor', 'gate', 'lighting', 'facility', 'iot'],
  MaintenanceOps: ['maintenance', 'repair', 'work order', 'asset', 'inspection'],
  FinanceRevenue: ['finance-manager', 'revenue', 'refund', 'payout', 'budget'],
  LegalRegulatory: ['rule', 'hisa', 'arci', 'commission', 'appeal', 'compliance'],
  ExecutiveDecisionSupport: ['executive', 'kpi', 'forecast', 'decision support', 'briefing'],
  ResponsibleAIGovernor: ['approval', 'governance', 'override', 'automation', 'ai recommendation'],
};

const workflowByDomain: Record<ExpertDomain, WorkflowTarget> = {
  RaceOps: 'race-control', Stewarding: 'stewards', EquineSafety: 'veterinary', VetCompliance: 'veterinary', TrackSurface: 'maintenance', WeatherEnvironment: 'weather-desk', WageringIntegrity: 'finance', TicketingFanExperience: 'race-control', SecuritySOC: 'security', FacilitiesIoT: 'maintenance', MaintenanceOps: 'maintenance', FinanceRevenue: 'finance', LegalRegulatory: 'compliance', ExecutiveDecisionSupport: 'executive-briefing', ResponsibleAIGovernor: 'compliance',
};

export const expertModuleRegistry = Object.freeze((Object.keys(domainKeywords) as ExpertDomain[]).map((domain) => ({
  domain,
  workflowTarget: workflowByDomain[domain],
  keywords: [...domainKeywords[domain]],
})));
export const requiredExpertModules = expertModuleRegistry.map((module) => module.domain);

const protectedActionKeywords: Array<[ProtectedAction, RegExp]> = [
  ['race-start', /\b(start|open)\b.*\brace\b|\brace\b.*\bstart\b/i],
  ['race-stop', /\bstop\b.*\brace\b|\brace\b.*\bstop\b|cancel.*race|delay.*race/i],
  ['official-results', /official result|finali[sz]e result|publish result|declare winner/i],
  ['modify-official-results', /modify.*result|change.*result|alter.*placing/i],
  ['scratch-horse', /scratch/i],
  ['medication-decision', /medication|drug|treatment/i],
  ['clear-vet-flag', /clear.*vet.*flag|vet.*flag.*clear/i],
  ['emergency-action', /emergency|evacuation|alert/i],
  ['payout', /payout|settle wager|pay|refund/i],
  ['disciplinary-decision', /disciplinary|suspend|fine/i],
  ['steward-ruling', /steward.*ruling|issue.*ruling|official.*ruling/i],
  ['starting-gate-move', /gate move|move.*gate|starting gate.*move|execute.*gate/i],
  ['track-closure', /close.*track|track.*closure/i],
  ['track-reopen', /reopen.*track|open.*track/i],
  ['emergency-personnel-override', /override.*emergency.*personnel|emergency.*personnel.*override/i],
];

const makeExpert = (domain: ExpertDomain): ExpertStub => async (request) => {
  const approvals = requiredApprovalsFor(request);
  const confidence = confidenceFor(domain, request);
  return {
    domain,
    confidence,
    recommendation: `${domain} recommends ${confidence >= 0.75 ? 'proceeding through the governed workflow' : 'additional human review and corroborating evidence'} before any operational action.`,
    evidence: [`expert:${domain}`, `policy:${workflowByDomain[domain]}`, `input:${request}`],
    requiredApprovals: approvals,
  };
};

const experts = Object.fromEntries((Object.keys(domainKeywords) as ExpertDomain[]).map((domain) => [domain, makeExpert(domain)])) as Record<ExpertDomain, ExpertStub>;

export function classifyRequest(request: string): ExpertDomain[] {
  const lower = request.toLowerCase();
  const matches = (Object.entries(domainKeywords) as Array<[ExpertDomain, string[]]>)
    .map(([domain, keywords]) => ({ domain, score: keywords.filter((keyword) => lower.includes(keyword)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ domain }) => domain);
  const routed: ExpertDomain[] = matches.length > 0 ? matches.slice(0, 8) : ['ResponsibleAIGovernor'];
  return routed.includes('ResponsibleAIGovernor') ? routed : [...routed, 'ResponsibleAIGovernor'];
}

export function requiredApprovalsFor(request: string): ProtectedAction[] {
  return protectedActionKeywords.filter(([, regex]) => regex.test(request)).map(([action]) => action);
}

function confidenceFor(domain: ExpertDomain, request: string): number {
  const keywordHits = domainKeywords[domain].filter((keyword) => request.toLowerCase().includes(keyword)).length;
  const approvalPenalty = requiredApprovalsFor(request).length > 0 ? 0.05 : 0;
  return Math.max(0.35, Math.min(0.97, 0.55 + keywordHits * 0.1 - approvalPenalty));
}

function aggregateEvidence(results: ExpertResult[]): EvidenceItem[] {
  return [...new Set(results.flatMap((result) => result.evidence))].map((evidence, index) => ({
    id: `ev-${index + 1}`,
    source: evidence.split(':')[0] ?? 'unknown',
    summary: evidence,
    domains: results.filter((result) => result.evidence.includes(evidence)).map((result) => result.domain),
    reliability: evidence.startsWith('policy:') ? 0.9 : evidence.startsWith('expert:') ? 0.82 : 0.7,
  }));
}

function resolveConflicts(results: ExpertResult[], approvals: ProtectedAction[]): ExpertConflict[] {
  const lowConfidence = results.filter((result) => result.confidence < 0.65).map((result) => result.domain);
  const conflicts: ExpertConflict[] = [];
  if (lowConfidence.length > 0) conflicts.push({ id: 'conf-low-confidence', domains: lowConfidence, severity: 'medium', summary: 'One or more experts returned limited confidence.', resolution: 'Escalate to accountable human owner and require additional evidence before automation.' });
  if (approvals.includes('race-start') && (approvals.includes('race-stop') || approvals.includes('scratch-horse'))) conflicts.push({ id: 'conf-operational-readiness', domains: results.map((r) => r.domain), severity: 'high', summary: 'Request contains competing readiness and restriction actions.', resolution: 'Prioritize safety/compliance hold, route to stewards, veterinarian, and race control for arbitration.' });
  return conflicts;
}

function buildConsensus(results: ExpertResult[], conflicts: ExpertConflict[]): ConsensusDecision {
  const averageConfidence = results.reduce((sum, result) => sum + result.confidence, 0) / Math.max(1, results.length);
  const penalty = conflicts.some((conflict) => conflict.severity === 'high') ? 0.25 : conflicts.length * 0.1;
  const agreementScore = Math.max(0, Number((averageConfidence - penalty).toFixed(2)));
  return {
    outcome: agreementScore >= 0.75 && conflicts.length === 0 ? 'consensus' : agreementScore >= 0.55 ? 'conditional-consensus' : 'human-arbitration-required',
    agreementScore,
    rationale: `Consensus is based on ${results.length} expert outputs, average confidence ${averageConfidence.toFixed(2)}, and ${conflicts.length} detected conflicts.`,
    dissentingDomains: results.filter((result) => result.confidence < averageConfidence - 0.12).map((result) => result.domain),
  };
}

function buildWorkflows(domains: ExpertDomain[], approvals: ProtectedAction[]): WorkflowIntegration[] {
  return [...new Set(domains.map((domain) => workflowByDomain[domain]))].map((target) => ({ target, action: `Open governed ${target} workflow task`, humanApprovalRequired: approvals.length > 0 || target === 'compliance' }));
}

function buildDigitalTwinUpdates(id: string, domains: ExpertDomain[], approvals: ProtectedAction[]): DigitalTwinUpdatePlan[] {
  return domains.map((domain) => ({ entityId: `domain:${domain}`, patch: { lastRecommendationId: id, routedAt: new Date(0).toISOString(), status: approvals.length > 0 ? 'awaiting-human-approval' : 'advisory' }, sourceRecommendationId: id, requiresApproval: approvals.length > 0 }));
}

function enforceGovernance(approvals: ProtectedAction[], approvalStore: ApprovalStore | undefined, id: string): GovernanceEnforcement {
  const protectedOnly = approvals.filter((action) => protectedActions.includes(action));
  const missingApprovals = protectedOnly.filter((action) => !approvalStore?.findApproved(action, id));
  return { automationAllowed: missingApprovals.length === 0, protectedActions: protectedOnly, missingApprovals, policy: 'human-in-the-loop', explanation: missingApprovals.length === 0 ? 'No protected action is blocked by governance.' : `Human approval is required for ${missingApprovals.join(', ')} before execution.` };
}

export async function routeUserRequest(request: string, id = `rec-${Date.now()}`, approvalStore?: ApprovalStore, auditLog = new ImmutableAuditLog()): Promise<StructuredRecommendation> {
  const domains = classifyRequest(request);
  auditLog.append({ id: `${id}-route`, type: 'ai-recommendation', actor: 'moe-router', timestamp: new Date().toISOString(), payload: { request, domains } });
  const expertResults = await Promise.all(domains.map(async (domain) => {
    const result = await experts[domain](request);
    auditLog.append({ id: `${id}-${domain}`, type: 'expert-call', actor: domain, timestamp: new Date().toISOString(), payload: result });
    return result;
  }));
  const requiredApprovals = [...new Set(expertResults.flatMap((result) => result.requiredApprovals))];
  const evidenceItems = aggregateEvidence(expertResults);
  const conflicts = resolveConflicts(expertResults, requiredApprovals);
  const consensus = buildConsensus(expertResults, conflicts);
  const governance = enforceGovernance(requiredApprovals, approvalStore, id);
  const confidence = Number(Math.min(consensus.agreementScore, ...expertResults.map((result) => result.confidence)).toFixed(2));
  const workflows = buildWorkflows(domains, requiredApprovals);
  const digitalTwinUpdates = buildDigitalTwinUpdates(id, domains, requiredApprovals);
  const status: RecommendationStatus = 'draft';
  const explanation = `TrackMind Nexus routed the request to ${domains.join(', ')}; aggregated ${evidenceItems.length} evidence items; resolved ${conflicts.length} conflicts; and ${governance.automationAllowed ? 'permits governed automation' : 'blocks automation pending human approval'}.`;
  const observability = { routedDomains: domains.length, expertCalls: expertResults.length, averageConfidence: Number((expertResults.reduce((sum, r) => sum + r.confidence, 0) / expertResults.length).toFixed(2)), evidenceItems: evidenceItems.length, conflicts: conflicts.length, protectedActions: requiredApprovals.length, traceId: id };
  return { id, request, domains, confidence, expertResults, evidence: evidenceItems.map((item) => item.summary), evidenceItems, requiredApprovals, status, conflicts, consensus, workflows, digitalTwinUpdates, governance, observability, explanation, auditTrail: auditLog.all() };
}
