import type { ApprovalToken } from '../approvals.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';

export interface RulebookQuery {
  question: string;
  jurisdiction?: string;
  evidenceRefs?: string[];
}

export interface PenaltyRecommendationInput {
  inquiryId: string;
  ruleIds: string[];
  recommendedPenalty: string;
  evidence: ApprovalEvidencePackage;
  context: ApexMutationContext;
}

export class StewardingService {
  private readonly penaltyDrafts = new Map<string, unknown>();

  constructor(private readonly approvals: ApexApprovalGateway) {}

  queryRulebook(query: RulebookQuery) {
    return {
      answer: 'Rulebook response is advisory only and must be reviewed by stewards before any official ruling.',
      citations: (query.evidenceRefs ?? ['rulebook://arci/interference']).map((ref) => ({ ref, quote: `Citation relevant to ${query.question.slice(0, 80)}` })),
      mayIssueOfficialRuling: false,
    };
  }

  async recommendPenalty(input: PenaltyRecommendationInput): Promise<ApprovalRequiredActionRecord> {
    return this.approvals.requestProtectedMutation({
      service: 'stewarding',
      operation: 'penalty_recommendation',
      action: 'steward-decision',
      target: input.inquiryId,
      payload: { ruleIds: input.ruleIds, recommendedPenalty: input.recommendedPenalty },
      context: input.context,
      evidence: input.evidence,
      execute: (_token: ApprovalToken) => {
        const result = { inquiryId: input.inquiryId, ruleIds: [...input.ruleIds], penalty: input.recommendedPenalty, official: true, approvedAt: input.context.now ?? new Date().toISOString() };
        this.penaltyDrafts.set(input.inquiryId, result);
        return result;
      },
    });
  }

  penalties() {
    return [...this.penaltyDrafts.values()];
  }
}

export function createStewardingService(gateway = new ApexApprovalGateway()) {
  return new StewardingService(gateway);
}
