import { CentralizedApprovalService, type ApprovalActor, type ApprovalDecisionRecord, type ApprovalPolicy, type ApprovalToken, type ControlledAction, type ControlledActionRequest } from '../approvals.js';
import { ImmutableAuditLog, type AuditLogEntry } from '../auditLog.js';
import { UniversalEventBus, type RaceDayEvent } from '../eventBus.js';

export type ApexServiceName = 'safety' | 'stewarding' | 'equine-intelligence' | 'security' | 'finance';
export type ApexMutationStatus = 'approval_required' | 'approved' | 'rejected' | 'expired' | 'executed';

export interface ApprovalEvidencePackage {
  confidence: number;
  rationale: string;
  alternativeOptions: string[];
  evidenceLinks: string[];
}

export interface ApprovalRequiredActionRecord {
  approvalRequired: true;
  approvalRequestId: string;
  service: ApexServiceName;
  operation: string;
  action: ControlledAction;
  target: string;
  status: ApexMutationStatus;
  evidence: ApprovalEvidencePackage;
  approvalTimeoutSeconds: 120;
  requiredRoles: string[];
  createdAt: string;
  expiresAt: string;
  auditRefs: string[];
  eventRefs: string[];
}

export interface ApexMutationContext {
  tenantId: string;
  racetrackId: string;
  actor: string;
  actorType?: ControlledActionRequest['actorType'];
  roles?: string[];
  now?: string;
}

export interface ProtectedMutationInput<TPayload = unknown, TResult = unknown> {
  service: ApexServiceName;
  operation: string;
  action: ControlledAction;
  target: string;
  payload: TPayload;
  context: ApexMutationContext;
  evidence: ApprovalEvidencePackage;
  execute: (token: ApprovalToken) => Promise<TResult> | TResult;
}

export interface ApprovalDecisionInput {
  approvalRequestId: string;
  actor: ApprovalActor;
  reason: string;
  evidence: string[];
  now?: string;
}

interface PendingMutation<TResult = unknown> {
  record: ApprovalRequiredActionRecord;
  execute: (token: ApprovalToken) => Promise<TResult> | TResult;
  context: ApexMutationContext;
}

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const addSeconds = (iso: string, seconds: number) => new Date(Date.parse(iso) + seconds * 1000).toISOString();
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

function twoMinuteApprovalPolicies(): ApprovalPolicy[] {
  const evidence = ['human-approval-record', 'reason'];
  return [
    { action: 'race-start', chain: [{ id: 'race-office', roles: ['racing-secretary'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin'], reason: 'race start cannot wait longer than 120 seconds' }] },
    { action: 'race-stop', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'emergency-command', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin'], reason: 'race stop cannot wait longer than 120 seconds' }] },
    { action: 'scratch-horse', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin'], reason: 'horse scratch dual-control approval cannot wait longer than 120 seconds' }] },
    { action: 'race-office-scratch', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin'], reason: 'horse scratch dual-control approval cannot wait longer than 120 seconds' }] },
    { action: 'medication-decision', chain: [{ id: 'veterinary', roles: ['veterinarian'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin'], reason: 'medication approval cannot wait longer than 120 seconds' }] },
    { action: 'steward-decision', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin', 'compliance-officer'], reason: 'steward decision approval cannot wait longer than 120 seconds' }] },
    { action: 'emergency-action', chain: [{ id: 'security', roles: ['security'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin'], reason: 'emergency approval cannot wait longer than 120 seconds' }] },
    { action: 'payout', chain: [{ id: 'stewards', roles: ['steward'], minimumApprovals: 1, evidenceRequired: evidence }, { id: 'finance', roles: ['finance'], minimumApprovals: 1, evidenceRequired: evidence }], expiresInMinutes: 2, escalationRules: [{ afterMinutes: 1, escalateToRoles: ['admin'], reason: 'financial payout approval cannot wait longer than 120 seconds' }] },
  ];
}

function requiredRoles(policy: ApprovalPolicy): string[] {
  return [...new Set(policy.chain.flatMap((step) => step.roles))];
}

export class ApexApprovalGateway {
  readonly auditLog: ImmutableAuditLog;
  readonly eventBus: UniversalEventBus;
  readonly approvals: CentralizedApprovalService;
  private readonly policies = new Map<ControlledAction, ApprovalPolicy>();
  private readonly pending = new Map<string, PendingMutation>();
  private readonly records = new Map<string, ApprovalRequiredActionRecord>();

  constructor(deps: { auditLog?: ImmutableAuditLog; eventBus?: UniversalEventBus; approvals?: CentralizedApprovalService; policies?: ApprovalPolicy[] } = {}) {
    this.auditLog = deps.auditLog ?? new ImmutableAuditLog();
    this.eventBus = deps.eventBus ?? new UniversalEventBus();
    const policies = deps.policies ?? twoMinuteApprovalPolicies();
    for (const policy of policies) this.policies.set(policy.action, policy);
    this.approvals = deps.approvals ?? new CentralizedApprovalService({ auditLog: this.auditLog, eventBus: this.eventBus }, policies);
  }

  async requestProtectedMutation<TPayload, TResult>(input: ProtectedMutationInput<TPayload, TResult>): Promise<ApprovalRequiredActionRecord> {
    const policy = this.requirePolicy(input.action);
    const createdAt = input.context.now ?? new Date().toISOString();
    const request = this.approvals.createRequest({
      tenantId: input.context.tenantId,
      racetrackId: input.context.racetrackId,
      action: input.action,
      target: input.target,
      requestedBy: input.context.actor,
      actorType: input.context.actorType ?? 'human',
      reason: input.evidence.rationale,
      evidence: this.evidenceList(input.evidence),
      now: createdAt,
    });
    const audit = this.audit('approval.evidence-presented', input.context.actor, input.service, input.operation, input.target, input.evidence, input.context, 'warning', request.id);
    const event = await this.publish(`${input.service}.${input.operation}.approval_required`, input.service, input.target, { request, evidence: input.evidence, payload: input.payload }, input.context, audit.id, request.id);
    const record: ApprovalRequiredActionRecord = {
      approvalRequired: true,
      approvalRequestId: request.id,
      service: input.service,
      operation: input.operation,
      action: input.action,
      target: input.target,
      status: 'approval_required',
      evidence: clone(input.evidence),
      approvalTimeoutSeconds: 120,
      requiredRoles: requiredRoles(policy),
      createdAt,
      expiresAt: addSeconds(createdAt, 120),
      auditRefs: [audit.id],
      eventRefs: [event.id],
    };
    this.records.set(record.approvalRequestId, clone(record));
    this.pending.set(record.approvalRequestId, { record, execute: input.execute, context: input.context });
    return clone(record);
  }

  async approve<TResult = unknown>(input: ApprovalDecisionInput): Promise<{ request: ControlledActionRequest; record: ApprovalRequiredActionRecord; executed: boolean; result?: TResult; audit: AuditLogEntry }> {
    const pending = this.requirePending<TResult>(input.approvalRequestId);
    const decided = this.approvals.decide(input.approvalRequestId, input.actor, 'approved', input.reason, input.evidence, input.now);
    const audit = this.audit('approval.approved', input.actor.id, pending.record.service, pending.record.operation, pending.record.target, pending.record.evidence, pending.context, 'critical', input.approvalRequestId, decided.decisions);
    pending.record.auditRefs.push(audit.id);
    pending.record.status = decided.status === 'approved' ? 'approved' : 'approval_required';
    this.records.set(input.approvalRequestId, clone(pending.record));
    if (decided.status !== 'approved') return { request: decided, record: clone(pending.record), executed: false, audit };
    const token = this.approvals.authorizeExecution({ requestId: input.approvalRequestId, action: pending.record.action, target: pending.record.target, tenantId: pending.context.tenantId, racetrackId: pending.context.racetrackId, actor: input.actor, now: input.now });
    const result = await pending.execute(token);
    pending.record.status = 'executed';
    const event = await this.publish(`${pending.record.service}.${pending.record.operation}.executed`, pending.record.service, pending.record.target, { approvalRequestId: input.approvalRequestId, token, result }, pending.context, audit.id, input.approvalRequestId);
    pending.record.eventRefs.push(event.id);
    this.records.set(input.approvalRequestId, clone(pending.record));
    this.pending.delete(input.approvalRequestId);
    return { request: decided, record: clone(pending.record), executed: true, result: clone(result) as TResult, audit };
  }

  async reject(input: ApprovalDecisionInput): Promise<{ request: ControlledActionRequest; record: ApprovalRequiredActionRecord; audit: AuditLogEntry }> {
    const pending = this.requirePending(input.approvalRequestId);
    const decided = this.approvals.decide(input.approvalRequestId, input.actor, 'rejected', input.reason, input.evidence, input.now);
    pending.record.status = 'rejected';
    const audit = this.audit('approval.rejected', input.actor.id, pending.record.service, pending.record.operation, pending.record.target, pending.record.evidence, pending.context, 'warning', input.approvalRequestId, decided.decisions);
    pending.record.auditRefs.push(audit.id);
    await this.publish(`${pending.record.service}.${pending.record.operation}.rejected`, pending.record.service, pending.record.target, { approvalRequestId: input.approvalRequestId, reason: input.reason }, pending.context, audit.id, input.approvalRequestId);
    this.records.set(input.approvalRequestId, clone(pending.record));
    this.pending.delete(input.approvalRequestId);
    return { request: decided, record: clone(pending.record), audit };
  }

  expire(approvalRequestId: string, now = new Date().toISOString()): ApprovalRequiredActionRecord {
    const request = this.approvals.expire(approvalRequestId, now);
    const record = this.records.get(approvalRequestId);
    if (!record) throw new Error(`Unknown approval request ${approvalRequestId}`);
    if (request.status === 'expired') {
      record.status = 'expired';
      this.records.set(approvalRequestId, clone(record));
      this.pending.delete(approvalRequestId);
    }
    return clone(record);
  }

  approvalRecords(): ApprovalRequiredActionRecord[] {
    return [...this.records.values()].map(clone);
  }

  approvalRequest(id: string): ControlledActionRequest {
    return this.approvals.getRequest(id);
  }

  private requirePolicy(action: ControlledAction): ApprovalPolicy {
    const policy = this.policies.get(action);
    if (!policy) throw new Error(`No APEX approval policy registered for ${action}`);
    return policy;
  }

  private requirePending<TResult>(id: string): PendingMutation<TResult> {
    const pending = this.pending.get(id) as PendingMutation<TResult> | undefined;
    if (!pending) throw new Error(`No pending protected mutation for approval request ${id}`);
    return pending;
  }

  private evidenceList(evidence: ApprovalEvidencePackage): string[] {
    return ['human-approval-record', `confidence:${evidence.confidence}`, `rationale:${evidence.rationale}`, ...evidence.alternativeOptions.map((option) => `alternative:${option}`), ...evidence.evidenceLinks];
  }

  private audit(action: string, actor: string, service: ApexServiceName, operation: string, target: string, evidence: ApprovalEvidencePackage, context: ApexMutationContext, severity: 'info' | 'warning' | 'critical', approvalRef?: string, approvals?: ApprovalDecisionRecord[]): AuditLogEntry {
    return this.auditLog.append({
      id: id(`audit-${service}`),
      type: 'approval',
      actor,
      actorType: actor === 'system' ? 'system' : 'human',
      timestamp: context.now ?? new Date().toISOString(),
      action,
      actionClass: 'approval',
      target,
      decision: action.endsWith('approved') ? 'approved' : action.endsWith('rejected') ? 'rejected' : 'observed',
      sourceService: `${service}-service`,
      payload: { service, operation, target, evidence, approvalRef, approvals },
      subjectId: target,
      tenantId: context.tenantId,
      racetrackId: context.racetrackId,
      correlationId: approvalRef,
      severity,
      regulations: ['HISA', 'ARCI', 'SOC-2'],
      evidenceIds: this.evidenceList(evidence),
    });
  }

  private async publish(type: string, service: ApexServiceName, target: string, payload: unknown, context: ApexMutationContext, auditRef: string, approvalRef: string): Promise<RaceDayEvent> {
    return this.eventBus.publish({
      type,
      payload,
      aggregateId: target,
      producer: `${service}-service`,
      tenantId: context.tenantId,
      racetrackId: context.racetrackId,
      actor: { id: context.actor, type: context.actorType ?? 'human' },
      subject: { id: target, type: 'approval-target', tenantId: context.tenantId },
      evidence: [auditRef],
      auditRef,
      approvalRef,
      metadata: { compliance: 'regulated', team: 'apex-domain-services', accountableRole: 'human-approver' },
    });
  }
}

export function createApexApprovalGateway() {
  return new ApexApprovalGateway();
}
