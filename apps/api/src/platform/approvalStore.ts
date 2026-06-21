import type { ApprovalDto } from '@trackmind/shared';
import { approvalPriorityFromAction } from '@trackmind/shared';
import {
  buildApprovalArtifact,
  canonicalApprovalRequest,
  defaultApprovalPolicies,
  type CentralizedApprovalService,
  type ControlledActionRequest,
} from '../approvals.js';
import { getApprovalRepository, type StoredApprovalRecord } from './approvalRepository.js';

const now = () => new Date().toISOString();

export class DurableApprovalStore {
  private store = getApprovalRepository();

  constructor(private approvalService: CentralizedApprovalService) {
    this.hydrateInto(approvalService);
    approvalService.setPersistenceHook((request) => this.persistRequest(request));
  }

  hydrateInto(service: CentralizedApprovalService): number {
    let loaded = 0;
    for (const record of this.store.list()) {
      if (record.request && typeof record.request === 'object') {
        service.loadRequest(record.request as ControlledActionRequest);
        loaded += 1;
      }
    }
    return loaded;
  }

  persistRequest(request: ControlledActionRequest, refs: { auditIds?: string[]; eventIds?: string[] } = {}): StoredApprovalRecord {
    const existing = this.store.get(request.id);
    const auditIds = [...new Set([...(existing?.auditIds ?? []), ...(refs.auditIds ?? [])])];
    const eventIds = [...new Set([...(existing?.eventIds ?? []), ...(refs.eventIds ?? [])])];
    const record: StoredApprovalRecord = {
      id: request.id,
      request: structuredClone(request),
      auditIds,
      eventIds,
      reminderSentAt: existing?.reminderSentAt,
      updatedAt: now(),
    };
    this.store.upsert(record);
    return record;
  }

  markReminderSent(id: string, sentAt = now()): boolean {
    const existing = this.store.get(id);
    if (!existing || existing.reminderSentAt) return false;
    this.store.upsert({ ...existing, reminderSentAt: sentAt, updatedAt: sentAt });
    return true;
  }

  toDto(request: ControlledActionRequest): ApprovalDto {
    const policy = defaultApprovalPolicies().find((candidate) => candidate.action === request.action);
    const canonical = canonicalApprovalRequest(request, { policy, policies: defaultApprovalPolicies(), correlationId: request.id });
    const artifact = buildApprovalArtifact(request, { policy, policies: defaultApprovalPolicies(), correlationId: request.id });
    const stored = this.store.get(request.id);
    const decisionRoles = [...new Set(request.decisions.flatMap((decision) => decision.roles))];
    const requiredRoles = [...new Set(canonical.steps.flatMap((step) => step.approverRoles))];
    return {
      id: request.id,
      approvalRequestId: request.id,
      action: request.action,
      target: request.target,
      tenantId: request.tenantId,
      racetrackId: request.racetrackId,
      requestedBy: request.requestedBy,
      status: request.status,
      canonicalStatus: canonical.status,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      evidence: [...request.evidence],
      mock: false,
      priority: approvalPriorityFromAction(request.action),
      approverRoles: [...new Set([...decisionRoles, ...request.escalatedToRoles])],
      requiredRoles,
      approvalPolicy: request.action,
      approvalSteps: canonical.steps,
      escalation: canonical.escalation,
      auditLinkage: {
        auditIds: stored?.auditIds ?? [],
        eventIds: stored?.eventIds ?? [],
        workflowInstanceId: request.workflowInstanceId,
        workflowTaskId: request.workflowTaskId,
        correlationId: request.id,
      },
      correlationId: request.id,
      workflowId: request.workflowInstanceId,
      auditIds: stored?.auditIds ?? [],
      eventIds: stored?.eventIds ?? [],
      history: artifact.approvals.map((decision) => ({
        id: `${request.id}:${decision.stepId}:${decision.decidedAt}`,
        actor: { id: decision.actorId, displayName: decision.actorId, role: decision.roles[0] ?? 'unknown', actorType: 'human' as const },
        decision: decision.decision,
        reason: decision.reason,
        evidence: [...decision.evidence],
        timestamp: decision.decidedAt,
      })),
    };
  }

  list(): ApprovalDto[] {
    const serviceIds = new Set(this.approvalService.allRequests().map((request) => request.id));
    const dtos = this.approvalService.allRequests().map((request) => this.toDto(request));
    for (const record of this.store.list()) {
      if (!serviceIds.has(record.id) && record.request && typeof record.request === 'object') {
        dtos.push(this.toDto(record.request as ControlledActionRequest));
      }
    }
    return dtos;
  }

  processExpirations(at = now()): number {
    let expired = 0;
    for (const request of this.approvalService.allRequests()) {
      if (request.status !== 'pending' && request.status !== 'escalated') continue;
      const before = request.status;
      this.approvalService.expire(request.id, at);
      const current = this.approvalService.getRequest(request.id);
      if (before !== current.status && current.status === 'expired') expired += 1;
    }
    return expired;
  }

  simulateRestart(serviceFactory: () => CentralizedApprovalService): CentralizedApprovalService {
    const replacement = serviceFactory();
    this.approvalService = replacement;
    replacement.setPersistenceHook((request) => this.persistRequest(request));
    this.hydrateInto(replacement);
    return replacement;
  }
}
