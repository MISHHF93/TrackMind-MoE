import { normalizeApprovalStatus, normalizeProtectedActionIntent, type ApprovalStatus, type ApprovalViewStatusDto, type ApprovalWorkflowStatus, type CanonicalApprovalRequest, type CanonicalApprovalStep, type ProtectedAction, type Role } from '@trackmind/shared';
import { approvalPriorityFromAction } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { UniversalEventBus } from './eventBus.js';
import type { WorkflowOrchestrationEngine } from './workflowEngine.js';
import { notificationFramework } from './platform/notificationFramework.js';

export interface HumanApprovalRecord {
  id: string;
  recommendationId: string;
  action: ProtectedAction | string;
  status: ApprovalStatus;
  approver?: string;
  approverActorType?: 'human' | 'ai-agent' | 'service' | 'system';
  approverRoles?: string[];
  timestamp?: string;
  reason?: string;
  evidence: string[];
  downstreamAction?: string;
  expiresAt?: string;
}

export interface AIRecommendationRecord {
  id: string;
  status: ApprovalStatus;
  tenantId?: string;
  requestedBy: string;
  createdAt: string;
  evidence: string[];
  downstreamAction?: string;
  requiredApprovals: string[];
  recommendation: unknown;
  affectedAssets?: string[];
  riskLevel?: string;
  approvalRequestIds?: string[];
  workflowRecordIds?: string[];
  auditIds?: string[];
  eventIds?: string[];
}

export class ApprovalStore {
  private recommendations = new Map<string, AIRecommendationRecord>();
  private approvals = new Map<string, HumanApprovalRecord>();

  saveRecommendation(record: AIRecommendationRecord): AIRecommendationRecord { this.recommendations.set(record.id, { ...record, evidence: [...record.evidence], requiredApprovals: [...record.requiredApprovals], affectedAssets: [...(record.affectedAssets ?? [])], approvalRequestIds: [...(record.approvalRequestIds ?? [])], workflowRecordIds: [...(record.workflowRecordIds ?? [])], auditIds: [...(record.auditIds ?? [])], eventIds: [...(record.eventIds ?? [])] }); return record; }
  transitionRecommendation(id: string, status: ApprovalStatus): AIRecommendationRecord { const current = this.recommendations.get(id); if (!current) throw new Error(`Unknown recommendation ${id}`); const next = { ...current, status }; this.recommendations.set(id, next); return next; }
  saveApproval(record: HumanApprovalRecord): HumanApprovalRecord { if (record.status === 'approved') { if (!record.approver || !record.reason || record.evidence.length === 0) throw new Error('Approved records require approver, reason, and evidence'); if (record.approverActorType && record.approverActorType !== 'human') throw new Error('AI agents and services cannot approve protected actions'); if (isNonHumanActorId(record.approver)) throw new Error('AI agents and services cannot approve protected actions'); } this.approvals.set(record.id, { ...record, evidence: [...record.evidence], approverRoles: [...(record.approverRoles ?? [])] }); return record; }
  findApproved(action: ProtectedAction | string, recommendationId: string, at = new Date()): HumanApprovalRecord | undefined { const normalizedAction = normalizeAction(action); return [...this.approvals.values()].find((record) => { const notExpired = !record.expiresAt || new Date(record.expiresAt) > at; return normalizeAction(record.action) === normalizedAction && record.recommendationId === recommendationId && record.status === 'approved' && notExpired; }); }
  getRecommendation(id: string): AIRecommendationRecord | undefined { const record = this.recommendations.get(id); return record ? { ...record, evidence: [...record.evidence], requiredApprovals: [...record.requiredApprovals], affectedAssets: [...(record.affectedAssets ?? [])], approvalRequestIds: [...(record.approvalRequestIds ?? [])], workflowRecordIds: [...(record.workflowRecordIds ?? [])], auditIds: [...(record.auditIds ?? [])], eventIds: [...(record.eventIds ?? [])] } : undefined; }
  allRecommendations(): AIRecommendationRecord[] { return [...this.recommendations.values()].map((record) => ({ ...record, evidence: [...record.evidence], requiredApprovals: [...record.requiredApprovals], affectedAssets: [...(record.affectedAssets ?? [])], approvalRequestIds: [...(record.approvalRequestIds ?? [])], workflowRecordIds: [...(record.workflowRecordIds ?? [])], auditIds: [...(record.auditIds ?? [])], eventIds: [...(record.eventIds ?? [])] })); }
  allApprovals(): HumanApprovalRecord[] { return [...this.approvals.values()]; }
}

export type ControlledAction = ProtectedAction;
export type ApprovalRequestStatus = Extract<ApprovalWorkflowStatus, 'pending' | 'approved' | 'rejected' | 'expired' | 'escalated'>;

export interface ApprovalStepRequirement { id: string; roles: Role[]; minimumApprovals: number; evidenceRequired: string[]; }
export interface EscalationRule { afterMinutes: number; escalateToRoles: Role[]; reason: string; }
export interface ApprovalPolicy { action: ControlledAction; chain: ApprovalStepRequirement[]; expiresInMinutes: number; escalationRules: EscalationRule[]; }
export interface ApprovalActor { id: string; roles: Role[]; human: boolean; delegatesFor?: string[]; }
export interface ApprovalDecisionRecord { stepId: string; actorId: string; roles: Role[]; decision: 'approved' | 'rejected'; reason: string; evidence: string[]; decidedAt: string; delegatedFor?: string; }
export interface ControlledActionRequest { id: string; tenantId: string; racetrackId: string; action: ControlledAction; target: string; requestedBy: string; actorType: 'human' | 'ai-agent' | 'service'; reason: string; evidence: string[]; createdAt: string; expiresAt: string; status: ApprovalRequestStatus; workflowInstanceId?: string; workflowTaskId?: string; decisions: ApprovalDecisionRecord[]; escalatedToRoles: Role[]; }
export interface ApprovalToken { requestId: string; action: ControlledAction; target: string; tenantId: string; racetrackId: string; issuedAt: string; expiresAt: string; approvedBy: string[]; issuedTo?: string; issuedToRoles?: Role[]; }
export interface ApprovalDelegationRecord { principalId: string; delegateId: string; roles: Role[]; expiresAt: string; reason: string; createdAt: string; revokedAt?: string; }
export type ApprovalArtifactStatus = ApprovalRequestStatus;
export interface ApprovalArtifactStep {
  id: string;
  requiredApprovers: Role[];
  minimumApprovals: number;
  evidenceRequired: string[];
  status: ApprovalArtifactStatus;
  approvals: number;
}
export interface ApprovalArtifact {
  schemaVersion: 'trackmind.approval-artifact.v1';
  id: string;
  artifactType: 'approval';
  approvalType: ControlledAction;
  action: ControlledAction;
  target: string;
  tenantId: string;
  racetrackId: string;
  status: ApprovalArtifactStatus;
  sourceStatus: ApprovalRequestStatus | ApprovalStatus | string;
  requestedBy: string;
  actorType: ControlledActionRequest['actorType'];
  reason: string;
  evidence: string[];
  requiredApprovers: Role[];
  approvals: ApprovalDecisionRecord[];
  approvalSteps: ApprovalArtifactStep[];
  createdAt: string;
  expiresAt?: string;
  expiry?: { expiresAt: string; expired: boolean };
  escalation?: { escalatedToRoles: Role[]; rules: EscalationRule[] };
  workflowInstanceId?: string;
  workflowTaskId?: string;
  correlationId: string;
  auditRefs: string[];
  eventRefs: string[];
  mutationPolicy: { localMutationAllowed: false; writeModel: 'server-authoritative'; updatePath: '/api/v1/approvals' };
  generatedAt: string;
}

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const addMinutes = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
const clone = <T>(value: T): T => structuredClone(value);
const terminalStatuses: ApprovalRequestStatus[] = ['approved', 'rejected', 'expired'];
const normalizeAction = (action: ProtectedAction | string) => normalizeProtectedActionIntent(action);
const approvalPrincipal = (decision: ApprovalDecisionRecord) => decision.delegatedFor ?? decision.actorId;
function isNonHumanActorId(actorId: string | undefined): boolean { return Boolean(actorId && (/^(ai|bot|service|system)(-|:|$)/i.test(actorId) || /(-|:)(ai|bot|service)$/i.test(actorId))); }
export function normalizeApprovalArtifactStatus(status: ApprovalRequestStatus | ApprovalStatus | string): ApprovalArtifactStatus {
  const normalized = normalizeApprovalStatus(status);
  return normalized === 'draft' || normalized === 'overridden' || normalized === 'cancelled' ? 'pending' : normalized;
}

export function canonicalApprovalRequest(request: ControlledActionRequest, options: { policy?: ApprovalPolicy; policies?: ApprovalPolicy[]; auditRefs?: string[]; eventRefs?: string[]; correlationId?: string } = {}): CanonicalApprovalRequest {
  const policy = options.policy ?? (options.policies ?? defaultApprovalPolicies()).find((candidate) => candidate.action === request.action);
  const steps: CanonicalApprovalStep[] = (policy?.chain ?? []).map((step) => {
    const decisions = request.decisions.filter((decision) => decision.stepId === step.id);
    const approvedCount = new Set(decisions.filter((decision) => decision.decision === 'approved').map(approvalPrincipal)).size;
    const rejected = decisions.some((decision) => decision.decision === 'rejected');
    return {
      id: step.id,
      approverRoles: [...step.roles],
      minimumApprovals: step.minimumApprovals,
      evidenceRequired: [...step.evidenceRequired],
      status: rejected ? 'rejected' : approvedCount >= step.minimumApprovals ? 'approved' : normalizeApprovalStatus(request.status),
      decisions: decisions.map((decision) => ({
        stepId: decision.stepId,
        actor: { id: decision.actorId, actorType: 'human', roles: [...decision.roles] },
        decision: decision.decision,
        reason: decision.reason,
        evidence: [...decision.evidence],
        decidedAt: decision.decidedAt,
        delegatedFor: decision.delegatedFor,
      })),
    };
  });
  return {
    approvalRequestId: request.id,
    tenantId: request.tenantId,
    racetrackId: request.racetrackId,
    action: request.action,
    target: request.target,
    requestedBy: { id: request.requestedBy, actorType: request.actorType, roles: [] },
    status: normalizeApprovalStatus(request.status),
    reason: request.reason,
    evidence: [...request.evidence],
    steps,
    escalation: (policy?.escalationRules ?? []).map((rule) => ({ afterMinutes: rule.afterMinutes, approverRoles: [...rule.escalateToRoles], reason: rule.reason })),
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    auditLinkage: { auditIds: [...(options.auditRefs ?? [])], eventIds: [...(options.eventRefs ?? [])], workflowInstanceId: request.workflowInstanceId, workflowTaskId: request.workflowTaskId, correlationId: options.correlationId ?? request.id },
  };
}

export function defaultApprovalPolicies(): ApprovalPolicy[] {
  const evidence = ['human-approval-record', 'reason'];
  return [
    { action: 'race-start', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 15, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'race start approval SLA exceeded' }] },
    { action: 'race-cancellation', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'cancellation approval SLA exceeded' }] },
    { action: 'race-stop', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'emergency-command', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 5, escalationRules: [{ afterMinutes: 2, escalateToRoles: ['admin'], reason: 'race stop approval SLA exceeded' }] },
    { action: 'steward-decision', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 60, escalationRules: [{ afterMinutes: 30, escalateToRoles: ['compliance-officer'], reason: 'steward decision pending' }] },
    { action: 'veterinary-clearance', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'vet clearance pending' }] },
    { action: 'steward-ruling', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 60, escalationRules: [{ afterMinutes: 30, escalateToRoles: ['compliance-officer'], reason: 'steward ruling pending' }] },
    { action: 'clear-vet-flag', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'vet flag clearance pending' }] },
    { action: 'medication-decision', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['compliance-officer'], reason: 'medication decision approval pending' }] },
    { action: 'payout', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'finance', roles: ['finance'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'payout approval pending' }] },
    { action: 'emergency-action', chain: [{ id: 'security', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 5, escalationRules: [{ afterMinutes: 2, escalateToRoles: ['admin'], reason: 'emergency action approval pending' }] },
    { action: 'official-results', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'finance', roles: ['finance'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'official results approval pending' }] },
    { action: 'modify-official-results', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'finance', roles: ['finance'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'compliance', roles: ['compliance-officer'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'official results modification approval pending' }] },
    { action: 'starting-gate-move', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 15, escalationRules: [{ afterMinutes: 8, escalateToRoles: ['admin'], reason: 'starting gate move approval pending' }] },
    { action: 'race-office-scratch', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'race scratch approval pending' }] },
    { action: 'scratch-horse', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'horse scratch approval pending' }] },
    { action: 'race-status-change', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'race status change approval pending' }] },
    { action: 'race-office-configuration', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 60, escalationRules: [{ afterMinutes: 30, escalateToRoles: ['admin'], reason: 'race office configuration approval pending' }] },
    { action: 'facility-maintenance-execution', chain: [{ id: 'facilities', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'operations-command', roles: ['admin'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 45, escalationRules: [{ afterMinutes: 20, escalateToRoles: ['admin'], reason: 'facility maintenance execution approval pending' }] },
    { action: 'emergency-personnel-override', chain: [{ id: 'security', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'emergency-command', roles: ['admin'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 5, escalationRules: [{ afterMinutes: 2, escalateToRoles: ['admin'], reason: 'emergency personnel override approval pending' }] },
    { action: 'disciplinary-decision', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'compliance', roles: ['compliance-officer'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 60, escalationRules: [{ afterMinutes: 30, escalateToRoles: ['admin'], reason: 'disciplinary decision approval pending' }] },
    { action: 'safety-critical-control', chain: [{ id: 'operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'safety-critical barn control approval pending' }] },
    { action: 'race-distance-configuration', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'race distance configuration approval pending' }] },
    { action: 'surface-irrigation', chain: [{ id: 'surface-operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'surface irrigation approval pending' }] },
    { action: 'surface-harrowing', chain: [{ id: 'surface-operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'surface harrowing approval pending' }] },
    { action: 'surface-rolling', chain: [{ id: 'surface-operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'surface rolling approval pending' }] },
    { action: 'surface-track-closure-recommendation', chain: [{ id: 'surface-operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 15, escalationRules: [{ afterMinutes: 8, escalateToRoles: ['admin'], reason: 'surface closure recommendation approval pending' }] },
    { action: 'track-closure', chain: [{ id: 'surface-operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'security', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 10, escalationRules: [{ afterMinutes: 5, escalateToRoles: ['admin'], reason: 'track closure approval pending' }] },
    { action: 'track-reopen', chain: [{ id: 'surface-operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 15, escalationRules: [{ afterMinutes: 8, escalateToRoles: ['admin'], reason: 'track reopen approval pending' }] },
    { action: 'compliance-filing-approval', chain: [{ id: 'compliance', roles: ['compliance-officer'], minimumApprovals: 1, evidenceRequired: ['human-approval-record','reason','audit-readiness-package'] }], expiresInMinutes: 240, escalationRules: [{ afterMinutes: 120, escalateToRoles: ['admin'], reason: 'compliance filing approval pending' }] },
  ];
}

export function buildApprovalArtifact(request: ControlledActionRequest, options: { policy?: ApprovalPolicy; policies?: ApprovalPolicy[]; racetrackId?: string; correlationId?: string; auditRefs?: string[]; eventRefs?: string[]; generatedAt?: string } = {}): ApprovalArtifact {
  const policy = options.policy ?? (options.policies ?? defaultApprovalPolicies()).find((candidate) => candidate.action === request.action);
  const canonical = canonicalApprovalRequest(request, { policy, policies: options.policies, auditRefs: options.auditRefs, eventRefs: options.eventRefs, correlationId: options.correlationId });
  const approvalSteps = (policy?.chain ?? []).map((step) => {
    const approvals = new Set(request.decisions.filter((decision) => decision.stepId === step.id && decision.decision === 'approved').map(approvalPrincipal)).size;
    const rejected = request.decisions.some((decision) => decision.stepId === step.id && decision.decision === 'rejected');
    return {
      id: step.id,
      requiredApprovers: [...step.roles],
      minimumApprovals: step.minimumApprovals,
      evidenceRequired: [...step.evidenceRequired],
      status: rejected ? 'rejected' : approvals >= step.minimumApprovals ? 'approved' : normalizeApprovalArtifactStatus(request.status),
      approvals,
    } satisfies ApprovalArtifactStep;
  });
  const artifact: ApprovalArtifact = {
    schemaVersion: 'trackmind.approval-artifact.v1',
    id: `approval-artifact:${request.id}`,
    artifactType: 'approval',
    approvalType: request.action,
    action: request.action,
    target: request.target,
    tenantId: request.tenantId,
    racetrackId: options.racetrackId ?? request.racetrackId,
    status: normalizeApprovalArtifactStatus(canonical.status),
    sourceStatus: request.status,
    requestedBy: request.requestedBy,
    actorType: request.actorType,
    reason: request.reason,
    evidence: [...request.evidence],
    requiredApprovers: [...new Set(canonical.steps.flatMap((step) => step.approverRoles))],
    approvals: request.decisions.map((decision) => ({ ...decision, roles: [...decision.roles], evidence: [...decision.evidence] })),
    approvalSteps,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    expiry: { expiresAt: request.expiresAt, expired: request.status === 'expired' },
    escalation: policy || request.escalatedToRoles.length ? { escalatedToRoles: [...request.escalatedToRoles], rules: canonical.escalation.map((rule) => ({ afterMinutes: rule.afterMinutes, escalateToRoles: [...rule.approverRoles], reason: rule.reason })) } : undefined,
    workflowInstanceId: canonical.auditLinkage.workflowInstanceId,
    workflowTaskId: canonical.auditLinkage.workflowTaskId,
    correlationId: canonical.auditLinkage.correlationId,
    auditRefs: [...canonical.auditLinkage.auditIds],
    eventRefs: [...canonical.auditLinkage.eventIds],
    mutationPolicy: { localMutationAllowed: false, writeModel: 'server-authoritative', updatePath: '/api/v1/approvals' },
    generatedAt: options.generatedAt ?? new Date().toISOString(),
  };
  return clone(artifact);
}

export class CentralizedApprovalService {
  private policies = new Map<ControlledAction, ApprovalPolicy>();
  private requests = new Map<string, ControlledActionRequest>();
  private delegations = new Map<string, ApprovalDelegationRecord[]>();
  constructor(private readonly deps: { auditLog?: ImmutableAuditLog; eventBus?: UniversalEventBus; workflow?: WorkflowOrchestrationEngine } = {}, policies = defaultApprovalPolicies()) { for (const policy of policies) this.policies.set(policy.action, policy); }

  createRequest(input: Omit<ControlledActionRequest, 'id'|'createdAt'|'expiresAt'|'status'|'decisions'|'escalatedToRoles'> & { id?: string; now?: string }): ControlledActionRequest {
    const policy = this.policy(input.action); const now = input.now ?? new Date().toISOString();
    if (!input.racetrackId) throw new Error('Controlled action approval requests require racetrackId');
    const request: ControlledActionRequest = { ...input, id: input.id ?? id('approval'), createdAt: now, expiresAt: addMinutes(now, policy.expiresInMinutes), status: 'pending', decisions: [], escalatedToRoles: [] };
    this.requests.set(request.id, request); const auditRef = this.audit('approval.requested', request.requestedBy, request, now); void this.publish('approval.requested', { ...request, auditRef }); this.notifyWorkflow('approval.requested', request, now);
    notificationFramework.publishOperational({ category: 'approval', title: `Approval requested: ${request.action}`, message: request.reason, targetRoles: [...new Set(policy.chain.flatMap((step) => step.roles))], severity: 'warning', priority: approvalPriorityFromAction(request.action) });
    return clone(request);
  }

  delegate(principalId: string, delegateId: string, roles: Role[], expiresAt: string, reason: string, now = new Date().toISOString()): ApprovalDelegationRecord { if (isNonHumanActorId(principalId) || isNonHumanActorId(delegateId)) throw new Error('AI agents and services cannot receive approval delegation'); if (roles.length === 0) throw new Error('Approval delegation requires at least one role'); const record = { principalId, delegateId, roles: [...new Set(roles)], expiresAt, reason, createdAt: now }; this.delegations.set(principalId, [...(this.delegations.get(principalId) ?? []), record]); const auditRef = this.audit('approval.delegated', principalId, record, now); void this.publish('approval.delegated', { ...record, auditRef }); return clone(record); }

  decide(requestId: string, actor: ApprovalActor, decision: 'approved'|'rejected', reason: string, evidence: string[], now = new Date().toISOString()): ControlledActionRequest {
    const request = this.require(requestId); this.expire(request.id, now); if (terminalStatuses.includes(request.status)) throw new Error(`Approval request is ${request.status}`);
    if (!actor.human || isNonHumanActorId(actor.id)) throw new Error('AI agents and services cannot approve controlled actions');
    const policy = this.policy(request.action); const openStep = policy.chain.find((step) => !this.stepSatisfied(request, step)); if (!openStep) throw new Error('Approval chain is already complete');
    const delegatedFor = this.delegatedPrincipal(actor.id, openStep.roles, now); const effectiveRoles = [...new Set([...actor.roles, ...(delegatedFor?.roles ?? [])])];
    const allowedRoles = [...new Set([...openStep.roles, ...(request.status === 'escalated' ? request.escalatedToRoles : [])])];
    if (!effectiveRoles.some((role) => allowedRoles.includes(role))) throw new Error(`Actor lacks required role for approval step ${openStep.id}`);
    const principalId = delegatedFor?.principalId ?? actor.id;
    if (request.decisions.some((item) => item.stepId === openStep.id && approvalPrincipal(item) === principalId)) throw new Error(`Actor has already recorded approval for step ${openStep.id}`);
    for (const item of openStep.evidenceRequired) if (item === 'reason' ? !reason : !evidence.includes(item)) throw new Error(`Approval evidence missing: ${item}`);
    request.decisions.push({ stepId: openStep.id, actorId: actor.id, roles: effectiveRoles, decision, reason, evidence, decidedAt: now, delegatedFor: delegatedFor?.principalId });
    if (decision === 'rejected') request.status = 'rejected'; else if (policy.chain.every((step) => this.stepSatisfied(request, step))) request.status = 'approved';
    const auditRef = this.audit(`approval.${decision}`, actor.id, request, now); void this.publish(`approval.${decision}`, { ...request, auditRef }); this.notifyWorkflow(`approval.${decision}`, request, now);
    notificationFramework.publishOperational({ category: 'approval', title: `Approval ${decision}: ${request.action}`, message: reason, targetRoles: [...new Set(policy.chain.flatMap((step) => step.roles))], severity: decision === 'rejected' ? 'critical' : 'info', priority: approvalPriorityFromAction(request.action) });
    return clone(request);
  }

  authorizeExecution(input: { requestId: string; action: ControlledAction; target: string; tenantId: string; racetrackId: string; actor: ApprovalActor; now?: string }): ApprovalToken {
    const now = input.now ?? new Date().toISOString(); const request = this.expire(input.requestId, now);
    if (!input.actor.human || isNonHumanActorId(input.actor.id)) throw new Error('AI agents cannot execute controlled actions; execution requires an authorized human-controlled workflow');
    if (request.status !== 'approved') throw new Error(`Controlled action ${input.action} requires explicit authorized approval`);
    if (request.action !== input.action || request.target !== input.target || request.tenantId !== input.tenantId || request.racetrackId !== input.racetrackId) throw new Error('Approval does not match controlled action execution request');
    const token = { requestId: request.id, action: request.action, target: request.target, tenantId: request.tenantId, racetrackId: request.racetrackId, issuedAt: now, expiresAt: request.expiresAt, approvedBy: request.decisions.filter((d) => d.decision === 'approved').map((d) => d.actorId), issuedTo: input.actor.id, issuedToRoles: [...input.actor.roles] };
    const auditRef = this.audit('approval.execution-authorized', input.actor.id, { ...request, token }, now); void this.publish('approval.execution-authorized', { ...token, tenantId: request.tenantId, auditRef, approvalRef: request.id }); this.notifyWorkflow('approval.execution-authorized', request, now); return token;
  }

  assertAuthorized(token: ApprovalToken | undefined, action: ControlledAction, target: string, tenantId: string, racetrackId?: string, now = new Date().toISOString()): void {
    if (!token) throw new Error(`Controlled action ${action} requires approval token`);
    if (token.action !== action || token.target !== target || token.tenantId !== tenantId) throw new Error('Approval token does not match controlled action');
    if (racetrackId && token.racetrackId !== racetrackId) throw new Error('Approval token does not match racetrack scope');
    const request = this.requests.get(token.requestId);
    if (!request || request.status !== 'approved') throw new Error('Approval token does not reference an approved request');
    if (request.action !== token.action || request.target !== token.target || request.tenantId !== token.tenantId || request.racetrackId !== token.racetrackId) throw new Error('Approval token does not match stored approval request');
    if (token.expiresAt <= now) throw new Error('Approval token has expired');
    if (token.issuedTo && isNonHumanActorId(token.issuedTo)) throw new Error('Approval token was not issued to an authorized human actor');
  }

  expire(requestId: string, now = new Date().toISOString()): ControlledActionRequest { const request = this.require(requestId); if (['pending', 'escalated'].includes(request.status) && request.expiresAt <= now) { request.status = 'expired'; const auditRef = this.audit('approval.expired', 'system', request, now); void this.publish('approval.expired', { ...request, auditRef }); this.notifyWorkflow('approval.expired', request, now); } return clone(request); }
  evaluateEscalations(now = new Date().toISOString()): ControlledActionRequest[] { const changed: ControlledActionRequest[] = []; for (const request of this.requests.values()) { if (request.status !== 'pending') continue; this.expire(request.id, now); if (request.status !== 'pending') continue; const before = request.escalatedToRoles.length; const policy = this.policy(request.action); for (const rule of policy.escalationRules) if (addMinutes(request.createdAt, rule.afterMinutes) <= now) request.escalatedToRoles = [...new Set([...request.escalatedToRoles, ...rule.escalateToRoles])]; if (request.escalatedToRoles.length > before) { request.status = 'escalated'; const auditRef = this.audit('approval.escalated', 'system', request, now); void this.publish('approval.escalated', { ...request, auditRef }); this.notifyWorkflow('approval.escalated', request, now); notificationFramework.publishOperational({ category: 'approval', title: `Approval escalated: ${request.action}`, message: policy.escalationRules.map((item) => item.reason).join('; '), targetRoles: request.escalatedToRoles, severity: 'critical', priority: 'critical' }); changed.push(clone(request)); } } return changed; }
  getRequest(id: string): ControlledActionRequest { return clone(this.require(id)); }
  hasRequest(id: string): boolean { return this.requests.has(id); }
  allRequests(): ControlledActionRequest[] { return [...this.requests.values()].map(clone); }

  private policy(action: ControlledAction): ApprovalPolicy { const policy = this.policies.get(action); if (!policy) throw new Error(`No approval policy registered for ${action}`); return policy; }
  private require(id: string): ControlledActionRequest { const request = this.requests.get(id); if (!request) throw new Error(`Unknown approval request ${id}`); return request; }
  private stepSatisfied(request: ControlledActionRequest, step: ApprovalStepRequirement): boolean { return new Set(request.decisions.filter((d) => d.stepId === step.id && d.decision === 'approved').map(approvalPrincipal)).size >= step.minimumApprovals; }
  private delegatedPrincipal(actorId: string, roles: Role[], now: string): { principalId: string; roles: Role[] } | undefined { for (const [principalId, entries] of this.delegations) { const hit = entries.find((entry) => entry.delegateId === actorId && !entry.revokedAt && entry.expiresAt > now && entry.roles.some((role) => roles.includes(role))); if (hit) return { principalId, roles: hit.roles }; } return undefined; }
  private audit(action: string, actor: string, payload: unknown, timestamp = new Date().toISOString()): string | undefined { const scoped = payload && typeof payload === 'object' ? payload as Partial<ControlledActionRequest> & Partial<ApprovalToken> : {}; return this.deps.auditLog?.append({ id: id('audit-approval'), type: 'approval', actor, actorType: scoped.actorType ?? (actor === 'system' ? 'system' : isNonHumanActorId(actor) ? 'service' : 'human'), timestamp, action, actionClass: 'approval', payload, subjectId: scoped.target, target: scoped.target, tenantId: scoped.tenantId, racetrackId: scoped.racetrackId, workflowId: scoped.workflowInstanceId, correlationId: scoped.id ?? scoped.requestId, severity: action === 'approval.execution-authorized' ? 'critical' : 'warning', regulations: ['HISA', 'ARCI'], evidenceIds: Array.isArray(scoped.evidence) ? scoped.evidence : [] }).id; }
  private async publish(type: string, payload: unknown): Promise<void> { const scoped = payload && typeof payload === 'object' ? payload as Partial<ControlledActionRequest> & Partial<ApprovalDelegationRecord> & Partial<ApprovalToken> & { auditRef?: string; approvalRef?: string } : {}; await this.deps.eventBus?.publish({ type, payload, aggregateId: scoped.target ?? scoped.requestId ?? scoped.principalId, correlationId: scoped.id ?? scoped.requestId, producer: 'centralized-approval-service', tenantId: scoped.tenantId, racetrackId: scoped.racetrackId, actor: { id: 'centralized-approval-service', type: 'service' }, subject: scoped.target ? { id: scoped.target, type: 'approval-target', tenantId: scoped.tenantId ?? 'unknown-tenant' } : undefined, evidence: Array.isArray((scoped as Partial<ControlledActionRequest>).evidence) ? (scoped as Partial<ControlledActionRequest>).evidence as string[] : [], auditRef: scoped.auditRef, approvalRef: scoped.approvalRef ?? scoped.id ?? scoped.requestId, metadata: { tenantId: scoped.tenantId, racetrackId: scoped.racetrackId, auditRef: scoped.auditRef, approvalRef: scoped.approvalRef ?? scoped.id ?? scoped.requestId, compliance: 'regulated', team: 'platform-controls', accountableRole: 'compliance-officer' } }); }
  private notifyWorkflow(type: string, request: ControlledActionRequest, now: string): void { if (!request.workflowInstanceId) return; this.deps.workflow?.emit({ type, tenantId: request.tenantId, instanceId: request.workflowInstanceId, payload: { approvalRequestId: request.id, action: request.action, target: request.target, status: request.status, decisions: request.decisions, workflowTaskId: request.workflowTaskId } }, now); }
}

export function controlledActionForPlatformBoundary(boundary: 'race-start'|'race-cancellation'|'steward-decision'|'veterinary-clearance'|'payout'|'emergency-action'|'official-results'): ControlledAction { return boundary; }
