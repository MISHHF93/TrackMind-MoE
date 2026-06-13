import type { ApprovalStatus, ProtectedAction } from '@trackmind/shared';

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

  saveRecommendation(record: AIRecommendationRecord): AIRecommendationRecord {
    this.recommendations.set(record.id, record);
    return record;
  }

  transitionRecommendation(id: string, status: ApprovalStatus): AIRecommendationRecord {
    const current = this.recommendations.get(id);
    if (!current) throw new Error(`Unknown recommendation ${id}`);
    const next = { ...current, status };
    this.recommendations.set(id, next);
    return next;
  }

  saveApproval(record: HumanApprovalRecord): HumanApprovalRecord {
    if (record.status === 'approved' && (!record.approver || !record.reason || record.evidence.length === 0)) {
      throw new Error('Approved records require approver, reason, and evidence');
    }
    this.approvals.set(record.id, record);
    return record;
  }

  findApproved(action: ProtectedAction | string, recommendationId: string, at = new Date()): HumanApprovalRecord | undefined {
    return [...this.approvals.values()].find((record) => {
      const notExpired = !record.expiresAt || new Date(record.expiresAt) > at;
      return record.action === action && record.recommendationId === recommendationId && record.status === 'approved' && notExpired;
    });
  }

  allApprovals(): HumanApprovalRecord[] {
    return [...this.approvals.values()];
  }
}
