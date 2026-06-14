import type { ApprovalStatus, ProtectedAction, Role } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { UniversalEventBus } from './eventBus.js';
import type { WorkflowOrchestrationEngine } from './workflowEngine.js';

export interface HumanApprovalRecord {
  id: string;
  recommendationId: string;
  action: ProtectedAction | string;
  status: ApprovalStatus;
  approver?: string;
  timestamp?: string;
  reason?: string;
  evidence: string[];
  downstreamAction?: string;
  expiresAt?: string;
}

export interface AIRecommendationRecord {
  id: string;
  status: ApprovalStatus;
  requestedBy: string;
  createdAt: string;
  evidence: string[];
  downstreamAction?: string;
  requiredApprovals: string[];
  recommendation: unknown;
}

export class ApprovalStore {
  private recommendations = new Map<string, AIRecommendationRecord>();
  private approvals = new Map<string, HumanApprovalRecord>();

  saveRecommendation(record: AIRecommendationRecord): AIRecommendationRecord { this.recommendations.set(record.id, record); return record; }
  transitionRecommendation(id: string, status: ApprovalStatus): AIRecommendationRecord { const current = this.recommendations.get(id); if (!current) throw new Error(`Unknown recommendation ${id}`); const next = { ...current, status }; this.recommendations.set(id, next); return next; }
  saveApproval(record: HumanApprovalRecord): HumanApprovalRecord { if (record.status === 'approved' && (!record.approver || !record.reason || record.evidence.length === 0)) throw new Error('Approved records require approver, reason, and evidence'); this.approvals.set(record.id, record); return record; }
  findApproved(action: ProtectedAction | string, recommendationId: string, at = new Date()): HumanApprovalRecord | undefined { return [...this.approvals.values()].find((record) => { const notExpired = !record.expiresAt || new Date(record.expiresAt) > at; return record.action === action && record.recommendationId === recommendationId && record.status === 'approved' && notExpired; }); }
  allApprovals(): HumanApprovalRecord[] { return [...this.approvals.values()]; }
}

export type ControlledAction = ProtectedAction | 'race-cancellation' | 'veterinary-clearance' | 'steward-decision' | 'starting-gate-move' | 'race-distance-configuration' | 'race-office-scratch' | 'race-status-change' | 'race-office-configuration' | 'safety-critical-control';
export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'escalated';

export interface ApprovalStepRequirement { id: string; roles: Role[]; minimumApprovals: number; evidenceRequired: string[]; }
export interface EscalationRule { afterMinutes: number; escalateToRoles: Role[]; reason: string; }
export interface ApprovalPolicy { action: ControlledAction; chain: ApprovalStepRequirement[]; expiresInMinutes: number; escalationRules: EscalationRule[]; }
export interface ApprovalActor { id: string; roles: Role[]; human: boolean; delegatesFor?: string[]; }
export interface ApprovalDecisionRecord { stepId: string; actorId: string; roles: Role[]; decision: 'approved' | 'rejected'; reason: string; evidence: string[]; decidedAt: string; delegatedFor?: string; }
export interface ControlledActionRequest { id: string; tenantId: string; action: ControlledAction; target: string; requestedBy: string; actorType: 'human' | 'ai-agent' | 'service'; reason: string; evidence: string[]; createdAt: string; expiresAt: string; status: ApprovalRequestStatus; workflowInstanceId?: string; decisions: ApprovalDecisionRecord[]; escalatedToRoles: Role[]; }
export interface ApprovalToken { requestId: string; action: ControlledAction; target: string; tenantId: string; issuedAt: string; expiresAt: string; approvedBy: string[]; }

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const addMinutes = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
const clone = <T>(value: T): T => structuredClone(value);

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
    { action: 'payout', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'finance', roles: ['finance'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'payout approval pending' }] },
    { action: 'emergency-action', chain: [{ id: 'security', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 5, escalationRules: [{ afterMinutes: 2, escalateToRoles: ['admin'], reason: 'emergency action approval pending' }] },
    { action: 'official-results', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'finance', roles: ['finance'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'official results approval pending' }] },
    { action: 'modify-official-results', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'finance', roles: ['finance'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'compliance', roles: ['compliance-officer'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'official results modification approval pending' }] },
    { action: 'starting-gate-move', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 15, escalationRules: [{ afterMinutes: 8, escalateToRoles: ['admin'], reason: 'starting gate move approval pending' }] },
    { action: 'race-office-scratch', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'race scratch approval pending' }] },
    { action: 'scratch-horse', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 30, escalationRules: [{ afterMinutes: 15, escalateToRoles: ['admin'], reason: 'horse scratch approval pending' }] },
    { action: 'race-status-change', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'race status change approval pending' }] },
    { action: 'race-office-configuration', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 60, escalationRules: [{ afterMinutes: 30, escalateToRoles: ['admin'], reason: 'race office configuration approval pending' }] },
    { action: 'emergency-personnel-override', chain: [{ id: 'security', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'emergency-command', roles: ['admin'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 5, escalationRules: [{ afterMinutes: 2, escalateToRoles: ['admin'], reason: 'emergency personnel override approval pending' }] },
    { action: 'safety-critical-control', chain: [{ id: 'operations', roles: ['track-superintendent'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'safety-critical barn control approval pending' }] },
    { action: 'race-distance-configuration', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 20, escalationRules: [{ afterMinutes: 10, escalateToRoles: ['admin'], reason: 'race distance configuration approval pending' }] },
  ];
}

export class CentralizedApprovalService {
  private policies = new Map<ControlledAction, ApprovalPolicy>();
  private requests = new Map<string, ControlledActionRequest>();
  private delegations = new Map<string, { delegateId: string; roles: Role[]; expiresAt: string; reason: string }[]>();
  constructor(private readonly deps: { auditLog?: ImmutableAuditLog; eventBus?: UniversalEventBus; workflow?: WorkflowOrchestrationEngine } = {}, policies = defaultApprovalPolicies()) { for (const policy of policies) this.policies.set(policy.action, policy); }

  createRequest(input: Omit<ControlledActionRequest, 'id'|'createdAt'|'expiresAt'|'status'|'decisions'|'escalatedToRoles'> & { id?: string; now?: string }): ControlledActionRequest {
    const policy = this.policy(input.action); const now = input.now ?? new Date().toISOString();
    const request: ControlledActionRequest = { ...input, id: input.id ?? id('approval'), createdAt: now, expiresAt: addMinutes(now, policy.expiresInMinutes), status: 'pending', decisions: [], escalatedToRoles: [] };
    this.requests.set(request.id, request); this.audit('approval.requested', request.requestedBy, request); void this.publish('approval.requested', request); return clone(request);
  }

  delegate(principalId: string, delegateId: string, roles: Role[], expiresAt: string, reason: string): void { this.delegations.set(principalId, [...(this.delegations.get(principalId) ?? []), { delegateId, roles, expiresAt, reason }]); }

  decide(requestId: string, actor: ApprovalActor, decision: 'approved'|'rejected', reason: string, evidence: string[], now = new Date().toISOString()): ControlledActionRequest {
    const request = this.require(requestId); this.expire(request.id, now); if (request.status === 'expired') throw new Error('Approval request has expired');
    if (!actor.human) throw new Error('AI agents and services cannot approve controlled actions');
    const policy = this.policy(request.action); const openStep = policy.chain.find((step) => !this.stepSatisfied(request, step)); if (!openStep) throw new Error('Approval chain is already complete');
    const delegatedFor = this.delegatedPrincipal(actor.id, openStep.roles, now); const effectiveRoles = [...new Set([...actor.roles, ...(delegatedFor?.roles ?? [])])];
    if (!effectiveRoles.some((role) => openStep.roles.includes(role))) throw new Error(`Actor lacks required role for approval step ${openStep.id}`);
    for (const item of openStep.evidenceRequired) if (item === 'reason' ? !reason : !evidence.includes(item)) throw new Error(`Approval evidence missing: ${item}`);
    request.decisions.push({ stepId: openStep.id, actorId: actor.id, roles: effectiveRoles, decision, reason, evidence, decidedAt: now, delegatedFor: delegatedFor?.principalId });
    if (decision === 'rejected') request.status = 'rejected'; else if (policy.chain.every((step) => this.stepSatisfied(request, step))) request.status = 'approved';
    this.audit(`approval.${decision}`, actor.id, request); void this.publish(`approval.${decision}`, request); return clone(request);
  }

  authorizeExecution(input: { requestId: string; action: ControlledAction; target: string; tenantId: string; actor: ApprovalActor; now?: string }): ApprovalToken {
    const now = input.now ?? new Date().toISOString(); const request = this.expire(input.requestId, now);
    if (!input.actor.human) throw new Error('AI agents cannot execute controlled actions; execution requires an authorized human-controlled workflow');
    if (request.status !== 'approved') throw new Error(`Controlled action ${input.action} requires explicit authorized approval`);
    if (request.action !== input.action || request.target !== input.target || request.tenantId !== input.tenantId) throw new Error('Approval does not match controlled action execution request');
    const token = { requestId: request.id, action: request.action, target: request.target, tenantId: request.tenantId, issuedAt: now, expiresAt: request.expiresAt, approvedBy: request.decisions.filter((d) => d.decision === 'approved').map((d) => d.actorId) };
    this.audit('approval.execution-authorized', input.actor.id, { ...request, token }); void this.publish('approval.execution-authorized', token); return token;
  }

  assertAuthorized(token: ApprovalToken | undefined, action: ControlledAction, target: string, tenantId: string, now = new Date().toISOString()): void {
    if (!token) throw new Error(`Controlled action ${action} requires approval token`);
    if (token.action !== action || token.target !== target || token.tenantId !== tenantId) throw new Error('Approval token does not match controlled action');
    if (token.expiresAt <= now) throw new Error('Approval token has expired');
  }

  expire(requestId: string, now = new Date().toISOString()): ControlledActionRequest { const request = this.require(requestId); if (request.status === 'pending' && request.expiresAt <= now) { request.status = 'expired'; this.audit('approval.expired', 'system', request); void this.publish('approval.expired', request); } return clone(request); }
  evaluateEscalations(now = new Date().toISOString()): ControlledActionRequest[] { const changed: ControlledActionRequest[] = []; for (const request of this.requests.values()) { if (request.status !== 'pending') continue; for (const rule of this.policy(request.action).escalationRules) if (addMinutes(request.createdAt, rule.afterMinutes) <= now) request.escalatedToRoles = [...new Set([...request.escalatedToRoles, ...rule.escalateToRoles])]; if (request.escalatedToRoles.length) { request.status = 'escalated'; this.audit('approval.escalated', 'system', request); void this.publish('approval.escalated', request); changed.push(clone(request)); } } return changed; }
  getRequest(id: string): ControlledActionRequest { return clone(this.require(id)); }
  allRequests(): ControlledActionRequest[] { return [...this.requests.values()].map(clone); }

  private policy(action: ControlledAction): ApprovalPolicy { const policy = this.policies.get(action); if (!policy) throw new Error(`No approval policy registered for ${action}`); return policy; }
  private require(id: string): ControlledActionRequest { const request = this.requests.get(id); if (!request) throw new Error(`Unknown approval request ${id}`); return request; }
  private stepSatisfied(request: ControlledActionRequest, step: ApprovalStepRequirement): boolean { return new Set(request.decisions.filter((d) => d.stepId === step.id && d.decision === 'approved').map((d) => d.actorId)).size >= step.minimumApprovals; }
  private delegatedPrincipal(actorId: string, roles: Role[], now: string): { principalId: string; roles: Role[] } | undefined { for (const [principalId, entries] of this.delegations) { const hit = entries.find((entry) => entry.delegateId === actorId && entry.expiresAt > now && entry.roles.some((role) => roles.includes(role))); if (hit) return { principalId, roles: hit.roles }; } return undefined; }
  private audit(action: string, actor: string, payload: unknown): void { this.deps.auditLog?.append({ id: id('audit-approval'), type: 'approval', actor, timestamp: new Date().toISOString(), payload, severity: 'warning', regulations: ['HISA', 'ARCI'] }); }
  private async publish(type: string, payload: unknown): Promise<void> { await this.deps.eventBus?.publish({ type, payload, producer: 'centralized-approval-service', metadata: { compliance: 'regulated', team: 'platform-controls', accountableRole: 'compliance-officer' } }); }
}

export function controlledActionForPlatformBoundary(boundary: 'race-start'|'race-cancellation'|'steward-decision'|'veterinary-clearance'|'payout'|'emergency-action'|'official-results'): ControlledAction { return boundary; }
