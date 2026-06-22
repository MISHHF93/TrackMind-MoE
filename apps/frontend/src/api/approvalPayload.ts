import type { Role } from '@trackmind/shared';
import { buildApprovalControlledActionPayload } from '@trackmind/shared';
import type { AdapterResult } from './client';
import { getTenantContext } from '@/auth/session';

export interface ControlledActionBody {
  tenantId: string;
  racetrackId: string;
  action: string;
  target: string;
  reason: string;
  evidence: string[];
  actor: string;
  actorType: 'human';
  roles: Role[];
}

export interface ApprovalDecisionBody {
  actor: string;
  actorType: 'human';
  roles: Role[];
  reason: string;
  evidence: string[];
  human: true;
}

export interface ControlledActionInput {
  action: string;
  target: string;
  reason: string;
  evidence?: string[];
}

export function buildControlledActionBody(input: ControlledActionInput): ControlledActionBody {
  const session = getTenantContext();
  return buildApprovalControlledActionPayload(
    {
      tenantId: session.tenantId,
      racetrackId: session.racetrackId,
      actorId: `${session.role}-operator`,
      role: session.role,
    },
    {
      protectedAction: input.action,
      target: input.target,
      reason: input.reason,
      evidence: input.evidence,
    },
  );
}

export function buildApprovalDecisionBody(reason?: string): ApprovalDecisionBody {
  const session = getTenantContext();
  return {
    actor: `${session.role}-operator`,
    actorType: 'human',
    roles: [session.role],
    reason: reason?.trim() || 'Recorded from TrackMind approvals console',
    evidence: ['human-approval-record'],
    human: true,
  };
}

export function assertMutationOk<T>(result: AdapterResult<T>): T {
  if (result.status === 'error') {
    throw new Error(result.message ?? 'Backend request failed');
  }
  return result.data as T;
}
