import type { StewardAdvisoryRecommendationDto, StewardEvidenceReferenceDto, StewardRecommendationSupportDto } from '@trackmind/shared';
import { stewardAdvisoryGuardrailStatement } from '@trackmind/shared';
import type { StewardEvidenceKind } from '../stewarding.js';
import type { ApprovalToken } from '../approvals.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';
import type { StewardOperationsPlatform } from '../stewardOperationsPlatform.js';

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

export interface StewardEvidenceUploadInput {
  inquiryId: string;
  evidence: Omit<StewardEvidenceReferenceDto, 'inquiryId' | 'hash'> & { hash?: string; content?: unknown };
  actor?: string;
}

export class StewardingService {
  private readonly penaltyDrafts = new Map<string, unknown>();

  constructor(
    private readonly approvals: ApexApprovalGateway,
    private readonly stewardOps?: StewardOperationsPlatform,
  ) {}

  queryRulebook(query: RulebookQuery) {
    return {
      answer: 'Rulebook response is advisory only and must be reviewed by stewards before any official ruling.',
      citations: (query.evidenceRefs ?? ['rulebook://arci/interference']).map((ref) => ({ ref, quote: `Citation relevant to ${query.question.slice(0, 80)}` })),
      mayIssueOfficialRuling: false,
    };
  }

  listEvidenceReferences(inquiryId: string): StewardEvidenceReferenceDto[] {
    if (!this.stewardOps) throw new Error('Steward evidence API requires steward operations integration');
    return this.stewardOps.listEvidence(inquiryId);
  }

  getEvidenceReference(inquiryId: string, evidenceId: string): StewardEvidenceReferenceDto | undefined {
    if (!this.stewardOps) throw new Error('Steward evidence API requires steward operations integration');
    return this.stewardOps.getEvidence(inquiryId, evidenceId);
  }

  uploadEvidenceReference(input: StewardEvidenceUploadInput) {
    if (!this.stewardOps) throw new Error('Steward evidence upload requires steward operations integration');
    const { evidence, inquiryId, actor = 'steward' } = input;
    return this.stewardOps.addEvidence(inquiryId, {
      id: evidence.id,
      kind: evidence.kind as StewardEvidenceKind,
      uri: evidence.uri,
      capturedAt: evidence.capturedAt,
      addedBy: evidence.addedBy ?? actor,
      description: evidence.description,
      hash: evidence.hash,
      aiGenerated: evidence.aiGenerated,
      sourceSystem: evidence.sourceSystem,
      twinContextIds: evidence.twinContextIds,
      tags: evidence.tags,
      content: (input.evidence as { content?: unknown }).content,
    } as import('../stewarding.js').StewardEvidenceReference & { content?: unknown }, actor);
  }

  getDecisionSupport(inquiryId: string): StewardRecommendationSupportDto {
    if (!this.stewardOps) {
      return {
        advisoryOnly: true,
        mayIssueOfficialRuling: false,
        mayModifyOfficialResults: false,
        guardrailStatement: stewardAdvisoryGuardrailStatement,
        recommendations: [],
      };
    }
    return this.stewardOps.decisionSupport(inquiryId);
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

export function createStewardingService(gateway = new ApexApprovalGateway(), stewardOps?: StewardOperationsPlatform) {
  return new StewardingService(gateway, stewardOps);
}
