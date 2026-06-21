import { approvalPriorityFromAction } from '@trackmind/shared';
import {
  buildApprovalArtifact,
  canonicalApprovalRequest,
  defaultApprovalPolicies,
  type CentralizedApprovalService,
  type ControlledActionRequest,
} from '../approvals.js';
import { notificationFramework } from './notificationFramework.js';
import type { DurableApprovalStore } from './approvalStore.js';

export interface ApprovalEscalationCycleResult {
  evaluatedAt: string;
  escalated: string[];
  expired: string[];
  remindersSent: string[];
}

const defaultReminderLeadMinutes = 5;

function pendingRequests(service: CentralizedApprovalService, now: string): ControlledActionRequest[] {
  return service.allRequests().filter((request) => request.status === 'pending' || request.status === 'escalated');
}

function minutesUntil(iso: string, now: string): number {
  return (Date.parse(iso) - Date.parse(now)) / 60_000;
}

export function runApprovalEscalationCycle(deps: {
  approvalService: CentralizedApprovalService;
  durableStore: DurableApprovalStore;
  now?: string;
  reminderLeadMinutes?: number;
}): ApprovalEscalationCycleResult {
  const evaluatedAt = deps.now ?? new Date().toISOString();
  const reminderLead = deps.reminderLeadMinutes ?? defaultReminderLeadMinutes;
  const beforePending = new Set(pendingRequests(deps.approvalService, evaluatedAt).map((request) => request.id));

  for (const request of deps.approvalService.allRequests()) {
    if (request.status === 'pending' || request.status === 'escalated') {
      deps.approvalService.expire(request.id, evaluatedAt);
    }
  }

  const expired = deps.approvalService.allRequests()
    .filter((request) => beforePending.has(request.id) && request.status === 'expired')
    .map((request) => request.id);

  const escalated = deps.approvalService.evaluateEscalations(evaluatedAt).map((request) => request.id);
  const remindersSent: string[] = [];

  for (const request of pendingRequests(deps.approvalService, evaluatedAt)) {
    const remaining = minutesUntil(request.expiresAt, evaluatedAt);
    if (remaining <= 0 || remaining > reminderLead) continue;
    if (deps.durableStore.markReminderSent(request.id, evaluatedAt)) {
      remindersSent.push(request.id);
      const policy = defaultApprovalPolicies().find((candidate) => candidate.action === request.action);
      const roles = [...new Set([
        ...(policy?.chain.flatMap((step) => step.roles) ?? []),
        ...request.escalatedToRoles,
      ])];
      notificationFramework.publishOperational({
        category: 'approval',
        title: `Approval reminder: ${request.action}`,
        message: `Approval for ${request.target} expires in ${Math.max(1, Math.ceil(remaining))} minute(s). Reason: ${request.reason}`,
        targetRoles: roles.length > 0 ? roles : ['admin'],
        severity: remaining <= 2 ? 'critical' : 'warning',
        priority: approvalPriorityFromAction(request.action),
        correlationId: request.id,
      });
    }
  }

  for (const request of deps.approvalService.allRequests()) {
    deps.durableStore.persistRequest(request);
  }

  return { evaluatedAt, escalated, expired, remindersSent };
}

export function approvalEscalationSimulationReport(request: ControlledActionRequest, auditRef?: string) {
  const policy = defaultApprovalPolicies().find((candidate) => candidate.action === request.action);
  const canonical = canonicalApprovalRequest(request, {
    policy,
    policies: defaultApprovalPolicies(),
    auditRefs: auditRef ? [auditRef] : [],
    correlationId: request.id,
  });
  const artifact = buildApprovalArtifact(request, {
    policy,
    policies: defaultApprovalPolicies(),
    auditRefs: auditRef ? [auditRef] : [],
    correlationId: request.id,
  });
  return { canonical, artifact };
}
