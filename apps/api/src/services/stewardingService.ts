import type { StewardEvidenceReferenceDto, StewardMutationResultDto, StewardRecommendationSupportDto } from '@trackmind/shared';
import { stewardAdvisoryGuardrailStatement } from '@trackmind/shared';
import type { ApprovalToken } from '../approvals.js';
import {
  addStewardEvidence,
  getStewardEvidenceReference,
  issueFinalRuling as recordStewardFinalRuling,
  listStewardEvidenceReferences,
  type StewardCenterIntegrations,
  type StewardEvidenceKind,
  type StewardEvidenceReference,
  type StewardFinalRuling,
  type StewardInquiry,
} from '../stewarding.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';

export interface StewardOperationsContext {
  requireInquiry(inquiryId: string): StewardInquiry;
  commit(inquiryId: string, actor: string, eventType: string, message: string, auditId?: string): StewardMutationResultDto;
  decisionSupport?(inquiryId: string): StewardRecommendationSupportDto;
  integrations?: StewardCenterIntegrations;
  tenantId?: string;
  racetrackId?: string;
}

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

export interface StewardFinalRulingInput {
  inquiryId: string;
  ruling: Omit<StewardFinalRuling, 'officialResultsModified'>;
  actor?: string;
  approvalToken?: ApprovalToken;
  tenantId?: string;
  racetrackId?: string;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class StewardingService {
  private readonly penaltyDrafts = new Map<string, unknown>();

  constructor(
    private readonly approvals: ApexApprovalGateway,
    private readonly operations?: StewardOperationsContext,
  ) {}

  queryRulebook(query: RulebookQuery) {
    return {
      answer: 'Rulebook response is advisory only and must be reviewed by stewards before any official ruling.',
      citations: (query.evidenceRefs ?? ['rulebook://arci/interference']).map((ref) => ({ ref, quote: `Citation relevant to ${query.question.slice(0, 80)}` })),
      mayIssueOfficialRuling: false,
    };
  }

  listEvidenceReferences(inquiryId: string): StewardEvidenceReferenceDto[] {
    const inquiry = this.requireOperations().requireInquiry(inquiryId);
    return listStewardEvidenceReferences(inquiry).map((evidence) => ({ ...clone(evidence), inquiryId })) as StewardEvidenceReferenceDto[];
  }

  getEvidenceReference(inquiryId: string, evidenceId: string): StewardEvidenceReferenceDto | undefined {
    const inquiry = this.requireOperations().requireInquiry(inquiryId);
    const evidence = getStewardEvidenceReference(inquiry, evidenceId);
    return evidence ? { ...clone(evidence), inquiryId } as StewardEvidenceReferenceDto : undefined;
  }

  uploadEvidenceReference(input: StewardEvidenceUploadInput): StewardMutationResultDto {
    const operations = this.requireOperations();
    const { evidence, inquiryId, actor = 'steward' } = input;
    const inquiry = operations.requireInquiry(inquiryId);
    addStewardEvidence(inquiry, {
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
    } as StewardEvidenceReference & { content?: unknown }, operations.integrations);
    return operations.commit(inquiryId, actor, 'steward-operations.evidence.added', `Added evidence ${evidence.id}`);
  }

  issueFinalRuling(input: StewardFinalRulingInput): StewardMutationResultDto {
    const operations = this.requireOperations();
    const actor = input.actor ?? 'steward';
    const inquiry = operations.requireInquiry(input.inquiryId);
    recordStewardFinalRuling(inquiry, { ...input.ruling, officialResultsModified: false }, {
      approvalService: operations.integrations?.approvals,
      approvalToken: input.approvalToken,
      tenantId: input.tenantId ?? operations.tenantId,
      racetrackId: input.racetrackId ?? operations.racetrackId,
      deps: operations.integrations,
    });
    return operations.commit(
      input.inquiryId,
      actor,
      'steward-operations.final-ruling.recorded',
      `Recorded final ruling ${input.ruling.id} without official result mutation`,
    );
  }

  getDecisionSupport(inquiryId: string): StewardRecommendationSupportDto {
    if (this.operations?.decisionSupport) return this.operations.decisionSupport(inquiryId);
    return {
      advisoryOnly: true,
      mayIssueOfficialRuling: false,
      mayModifyOfficialResults: false,
      guardrailStatement: stewardAdvisoryGuardrailStatement,
      recommendations: [],
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

  private requireOperations(): StewardOperationsContext {
    if (!this.operations) throw new Error('Stewarding service requires steward operations platform integration');
    return this.operations;
  }
}

export function createStewardingService(gateway = new ApexApprovalGateway(), operations?: StewardOperationsContext) {
  return new StewardingService(gateway, operations);
}
