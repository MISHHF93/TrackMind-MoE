import { protectedActions, type ProtectedAction } from '@trackmind/shared';
import type { ApprovalStore } from './approvals.js';

export interface GovernanceDecision {
  allowed: boolean;
  action: string;
  reason?: string;
  approvalId?: string;
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
