import type {
  StewardAdvisoryRecommendationDto,
  StewardDecisionWorkflowDto,
  StewardEvidenceReferenceDto,
  StewardInquiryRecordDto,
  StewardMutationResultDto,
  StewardOperationsAuditTrailDto,
  StewardOperationsKpiDashboardDto,
  StewardOperationsKpiDto,
  StewardOperationsWorkspaceDto,
  StewardRecommendationSupportDto,
  StewardReviewDto,
} from '@trackmind/shared';
import { stewardAdvisoryGuardrailStatement } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { Role } from '@trackmind/shared';
import {
  addStewardEvidence,
  addStewardRuleReference,
  canAccessStewardCenter,
  createStewardInquiry,
  exportAppealPackage,
  generateStewardTimeline,
  listStewardInquiries,
  openStewardInvestigation,
  organizeEvidenceForStewards,
  recordStewardObjection,
  requestStewardFinalApproval,
  saveDecisionDraft,
  summarizeEvidenceForStewards,
  type StewardCenterIntegrations,
  type StewardInquiry,
} from './stewarding.js';
import { CentralizedApprovalService } from './approvals.js';
import { AuditEvidenceCollectionVault, ImmutableAuditLog as AuditLog } from './auditLog.js';
import { InMemoryEventBus } from './eventBus.js';
import { investigationWorkflow, WorkflowOrchestrationEngine } from './workflowEngine.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface StewardOperationsDeps {
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
  integrations?: StewardCenterIntegrations;
}

export class StewardOperationsPlatform {
  private readonly inquiries = new Map<string, StewardInquiry>();
  private readonly reviews = new Map<string, StewardReviewDto[]>();
  private readonly auditChain: StewardOperationsWorkspaceDto['auditTrail'] = [];
  private readonly deps: StewardOperationsDeps;

  constructor(deps: StewardOperationsDeps = {}) {
    this.deps = deps;
  }

  workspace(now = new Date().toISOString()): StewardOperationsWorkspaceDto {
    const inquiries = [...this.inquiries.values()].map((inquiry) => this.toInquiryDto(inquiry, now));
    const allReviews = inquiries.flatMap((inquiry) => inquiry.reviews);
    const decisionWorkflows = inquiries.flatMap((inquiry) => inquiry.decisionWorkflows);
    const recommendationSupport = this.buildRecommendationSupport(inquiries);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.steward-operations.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      inquiries,
      reviews: allReviews,
      decisionWorkflows,
      recommendationSupport,
      dashboard: this.buildDashboard(inquiries, now),
      permissions: {
        canRead: true,
        canDraft: true,
        canFinalize: false,
        canExportAppeal: true,
      },
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  centerDto(now = new Date().toISOString()) {
    const workspace = this.workspace(now);
    return {
      inquiries: workspace.inquiries,
      permissions: workspace.permissions,
      mock: false as const,
    };
  }

  kpiDashboard(now = new Date().toISOString()): StewardOperationsKpiDashboardDto {
    return this.workspace(now).dashboard;
  }

  auditTrail(inquiryId?: string, now = new Date().toISOString()): StewardOperationsAuditTrailDto {
    const records = inquiryId
      ? this.auditChain.filter((record) => record.inquiryId === inquiryId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.steward-operations.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  getInquiry(inquiryId: string, now = new Date().toISOString()): StewardInquiryRecordDto | undefined {
    const inquiry = this.inquiries.get(inquiryId);
    return inquiry ? this.toInquiryDto(inquiry, now) : undefined;
  }

  getInquiries(): StewardInquiry[] {
    return [...this.inquiries.values()].map(clone);
  }

  openInquiry(input: Parameters<typeof createStewardInquiry>[0], actor = 'steward'): StewardMutationResultDto {
    const inquiry = createStewardInquiry(input, this.deps.integrations);
    this.inquiries.set(inquiry.id, inquiry);
    this.reviews.set(inquiry.id, []);
    return this.commit(inquiry.id, actor, 'steward-operations.inquiry.opened', `Opened steward inquiry ${inquiry.id}`);
  }

  recordObjection(inquiryId: string, objection: Parameters<typeof recordStewardObjection>[1], actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    recordStewardObjection(inquiry, objection, this.deps.integrations);
    return this.commit(inquiryId, actor, 'steward-operations.objection.recorded', `Recorded objection ${objection.id}`);
  }

  addEvidence(inquiryId: string, evidence: Parameters<typeof addStewardEvidence>[1], actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    addStewardEvidence(inquiry, evidence, this.deps.integrations);
    return this.commit(inquiryId, actor, 'steward-operations.evidence.added', `Added evidence ${evidence.id}`);
  }

  addRuleReference(inquiryId: string, rule: Parameters<typeof addStewardRuleReference>[1], actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    addStewardRuleReference(inquiry, rule, actor, new Date().toISOString(), this.deps.integrations);
    return this.commit(inquiryId, actor, 'steward-operations.rule.added', `Added rule reference ${rule.id}`);
  }

  openInvestigation(inquiryId: string, investigation: Parameters<typeof openStewardInvestigation>[1], actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    openStewardInvestigation(inquiry, investigation, this.deps.integrations);
    return this.commit(inquiryId, actor, 'steward-operations.investigation.opened', `Opened investigation ${investigation.id}`);
  }

  recordReview(inquiryId: string, input: Omit<StewardReviewDto, 'reviewId' | 'inquiryId' | 'auditId'>, actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    const auditId = id('audit-steward');
    const review: StewardReviewDto = {
      ...clone(input),
      reviewId: id('steward-review'),
      inquiryId,
      auditId,
    };
    const list = this.reviews.get(inquiryId) ?? [];
    list.push(review);
    this.reviews.set(inquiryId, list);
    if (review.reviewType === 'panel') inquiry.status = 'under-review';
    return this.commit(inquiryId, actor, 'steward-operations.review.recorded', `Recorded ${review.reviewType} review`, auditId);
  }

  organizeEvidence(inquiryId: string, actor = 'steward-ai'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    organizeEvidenceForStewards(inquiry, { actorId: actor, deps: this.deps.integrations });
    return this.commit(inquiryId, actor, 'steward-operations.evidence.organized', 'AI organized evidence for human steward review (advisory only)');
  }

  createAdvisoryRecommendation(inquiryId: string, actor = 'steward-ai'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    summarizeEvidenceForStewards(inquiry, actor);
    return this.commit(inquiryId, actor, 'steward-operations.recommendation.created', 'Created advisory AI recommendation; not an official ruling');
  }

  saveDraft(inquiryId: string, draft: Parameters<typeof saveDecisionDraft>[1], actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    saveDecisionDraft(inquiry, draft, this.deps.integrations);
    return this.commit(inquiryId, actor, 'steward-operations.decision-draft.saved', `Saved decision draft ${draft.id}`);
  }

  requestApproval(inquiryId: string, input: Parameters<typeof requestStewardFinalApproval>[1], actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    if (!this.deps.integrations?.approvals) throw new Error('Approval service integration required');
    const request = requestStewardFinalApproval(inquiry, input, this.deps.integrations);
    return this.commit(inquiryId, actor, 'steward-operations.approval.requested', `Requested approval ${request.id}`);
  }

  generateTimeline(inquiryId: string, actor = 'steward'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    generateStewardTimeline(inquiry, { actorId: actor, deps: this.deps.integrations });
    return this.commit(inquiryId, actor, 'steward-operations.timeline.generated', 'Generated steward timeline');
  }

  exportAppeal(inquiryId: string, actor = 'steward-clerk'): StewardMutationResultDto {
    const inquiry = this.requireInquiry(inquiryId);
    exportAppealPackage(inquiry, actor, this.deps.integrations);
    return this.commit(inquiryId, actor, 'steward-operations.appeal.exported', 'Exported appeal package');
  }

  canAccess(roles: Role[], action: 'read' | 'draft' | 'finalize' | 'appeal'): boolean {
    return canAccessStewardCenter(roles, action);
  }

  private toInquiryDto(inquiry: StewardInquiry, now: string): StewardInquiryRecordDto {
    const reviews = [...(this.reviews.get(inquiry.id) ?? [])];
    if (reviews.length === 0 && inquiry.investigations.length > 0) {
      reviews.push({
        reviewId: `review-seeded-${inquiry.id}`,
        inquiryId: inquiry.id,
        reviewedAt: inquiry.investigations[0]?.openedAt ?? inquiry.openedAt,
        reviewerId: inquiry.investigations[0]?.leadStewardId ?? 'steward-1',
        reviewerRole: 'steward',
        reviewType: 'panel',
        status: 'in-progress',
        findings: [inquiry.investigations[0]?.focus ?? 'Panel review in progress'],
        evidenceIds: inquiry.investigations[0]?.evidenceIds ?? [],
        ruleIds: inquiry.investigations[0]?.ruleIds ?? [],
        auditId: inquiry.auditRecords.at(-1)?.id ?? id('audit-steward'),
      });
    }
    const decisionWorkflows = this.buildDecisionWorkflows(inquiry);
    return {
      id: inquiry.id,
      raceId: inquiry.raceId,
      openedAt: inquiry.openedAt,
      status: inquiry.status,
      objections: inquiry.objections.map(clone),
      incidentsUnderReview: inquiry.incidentsUnderReview.map(clone),
      investigations: inquiry.investigations.map(clone),
      involvedHorses: inquiry.involvedHorses.map(clone),
      involvedJockeys: inquiry.involvedJockeys.map(clone),
      evidenceReferences: inquiry.evidenceReferences.map((evidence) => ({ ...clone(evidence), inquiryId: inquiry.id })) as StewardEvidenceReferenceDto[],
      ruleReferences: inquiry.ruleReferences.map(clone),
      decisionDrafts: inquiry.decisionDrafts.map(clone),
      evidenceOrganizations: inquiry.evidenceOrganizations.map(clone),
      timeline: inquiry.timeline.map(clone),
      finalRuling: inquiry.finalRuling ? { ...inquiry.finalRuling, officialResultsModified: false as const } : undefined,
      appealPackages: inquiry.appealPackages.map((pkg) => ({ id: pkg.id, contents: { auditRecordIds: pkg.contents.auditRecordIds, approvalRequestIds: pkg.contents.approvalRequestIds, guardrailStatement: pkg.contents.guardrailStatement } })),
      auditRecords: inquiry.auditRecords.map(clone),
      integrations: clone(inquiry.integrations),
      aiGuardrails: clone(inquiry.aiGuardrails),
      reviews,
      decisionWorkflows,
    };
  }

  private buildDecisionWorkflows(inquiry: StewardInquiry): StewardDecisionWorkflowDto[] {
    const workflows: StewardDecisionWorkflowDto[] = inquiry.investigations.map((investigation) => ({
      workflowId: investigation.id,
      inquiryId: inquiry.id,
      workflowType: 'investigation' as const,
      status: investigation.status === 'pending-approval' ? 'pending-approval' : investigation.status === 'closed' ? 'closed' : 'evidence-collection',
      currentStep: investigation.taskIds[0] ?? 'collect-evidence',
      requiredApprovers: ['steward', 'chief-steward'],
      approvalRequestId: investigation.approvalRequestId,
      workflowInstanceId: investigation.workflowInstanceId,
      evidenceIds: [...investigation.evidenceIds],
      auditIds: inquiry.auditRecords.filter((record) => record.subjectId === investigation.id).map((record) => record.id),
      eventTypes: inquiry.integrations.eventTypes.filter((event) => event.includes('investigation') || event.includes('evidence')),
    }));
    for (const approvalId of inquiry.integrations.approvalRequestIds) {
      workflows.push({
        workflowId: `approval-workflow-${approvalId}`,
        inquiryId: inquiry.id,
        workflowType: 'approval',
        status: inquiry.status === 'pending-final-approval' ? 'pending-approval' : inquiry.finalRuling ? 'approved' : 'open',
        currentStep: 'human-final-approval',
        requiredApprovers: ['steward', 'admin'],
        approvalRequestId: approvalId,
        workflowInstanceId: inquiry.integrations.workflowInstanceIds[0],
        evidenceIds: inquiry.evidenceReferences.map((evidence) => evidence.id),
        auditIds: inquiry.auditRecords.filter((record) => record.action === 'approval.requested').map((record) => record.id),
        eventTypes: inquiry.integrations.eventTypes.filter((event) => event.includes('approval')),
      });
    }
    if (inquiry.appealPackages.length > 0) {
      workflows.push({
        workflowId: inquiry.appealPackages.at(-1)!.id,
        inquiryId: inquiry.id,
        workflowType: 'appeal',
        status: 'appealed',
        currentStep: 'appeal-package-exported',
        requiredApprovers: ['steward', 'compliance-officer'],
        evidenceIds: inquiry.appealPackages.at(-1)!.contents.evidenceIds,
        auditIds: inquiry.appealPackages.at(-1)!.contents.auditRecordIds,
        eventTypes: inquiry.integrations.eventTypes.filter((event) => event.includes('appeal')),
      });
    }
    return workflows;
  }

  private buildRecommendationSupport(inquiries: StewardInquiryRecordDto[]): StewardRecommendationSupportDto {
    const recommendations: StewardAdvisoryRecommendationDto[] = [];
    for (const inquiry of inquiries) {
      for (const draft of inquiry.decisionDrafts) {
        recommendations.push({
          recommendationId: draft.id,
          inquiryId: inquiry.id,
          source: draft.aiGenerated ? 'ai-agent' : draft.authorRole === 'steward' ? 'human' : 'service',
          summary: draft.recommendation,
          rationale: draft.rationale,
          evidenceIds: [...draft.evidenceIds],
          ruleIds: [...draft.ruleIds],
          officialRuling: false,
          advisoryOnly: true,
          createdAt: inquiry.openedAt,
          auditId: inquiry.auditRecords.at(-1)?.id ?? id('audit-steward'),
        });
      }
      for (const org of inquiry.evidenceOrganizations) {
        recommendations.push({
          recommendationId: org.id,
          inquiryId: inquiry.id,
          source: 'ai-agent',
          summary: org.clusters.map((cluster) => cluster.summary).join(' '),
          rationale: org.limitations.join(' '),
          evidenceIds: org.clusters.flatMap((cluster) => cluster.evidenceIds),
          ruleIds: org.clusters.flatMap((cluster) => cluster.ruleIds),
          officialRuling: false,
          advisoryOnly: true,
          createdAt: org.generatedAt,
          auditId: inquiry.auditRecords.at(-1)?.id ?? id('audit-steward'),
        });
      }
    }
    return {
      advisoryOnly: true,
      mayIssueOfficialRuling: false,
      mayModifyOfficialResults: false,
      guardrailStatement: stewardAdvisoryGuardrailStatement,
      recommendations,
    };
  }

  private buildDashboard(inquiries: StewardInquiryRecordDto[], now: string): StewardOperationsKpiDashboardDto {
    const openInquiries = inquiries.filter((inquiry) => !['finalized', 'appealed'].includes(String(inquiry.status))).length;
    const pendingApprovals = inquiries.reduce((sum, inquiry) => sum + inquiry.integrations.approvalRequestIds.length, 0);
    const openInvestigations = inquiries.reduce((sum, inquiry) => sum + inquiry.investigations.filter((item) => item.status !== 'closed').length, 0);
    const advisoryRecommendations = inquiries.reduce((sum, inquiry) => sum + inquiry.decisionDrafts.length + inquiry.evidenceOrganizations.length, 0);
    const evidenceItemsUnderCustody = inquiries.reduce((sum, inquiry) => sum + inquiry.evidenceReferences.length, 0);
    const linkedAudits = inquiries.reduce((sum, inquiry) => sum + inquiry.auditRecords.length, 0);
    const totalEvidence = Math.max(1, evidenceItemsUnderCustody);
    const auditLinkageCoveragePct = Math.round((inquiries.filter((inquiry) => inquiry.evidenceReferences.every((evidence) => evidence.auditRecordId)).length / Math.max(1, inquiries.length)) * 100);
    const panels: StewardOperationsKpiDto[] = [
      kpi('steward-kpi-open-inquiries', 'Open inquiries', 'Steward inquiries awaiting review or final approval.', openInquiries, 'inquiries', 0, openInquiries > 0 ? 'watch' : 'nominal', [{ entityType: 'steward-operations', entityId: 'main-track' }], []),
      kpi('steward-kpi-pending-approvals', 'Pending approvals', 'Final steward decisions awaiting controlled approval.', pendingApprovals, 'approvals', 0, pendingApprovals > 0 ? 'watch' : 'nominal', [{ entityType: 'approval', entityId: 'steward-decision' }], []),
      kpi('steward-kpi-investigations', 'Open investigations', 'Active steward investigations with evidence collection or panel review.', openInvestigations, 'investigations', 0, openInvestigations > 0 ? 'watch' : 'nominal', [{ entityType: 'steward-inquiry', entityId: inquiries[0]?.id ?? 'none' }], []),
      kpi('steward-kpi-advisory-recs', 'Advisory recommendations', 'AI or human draft recommendations that remain advisory only.', advisoryRecommendations, 'recommendations', 0, 'nominal', [{ entityType: 'steward-operations', entityId: 'main-track' }], []),
      kpi('steward-kpi-audit-linkage', 'Audit linkage coverage', 'Percentage of inquiries with fully audit-linked evidence references.', auditLinkageCoveragePct, '%', 100, auditLinkageCoveragePct >= 95 ? 'nominal' : 'watch', [{ entityType: 'audit', entityId: 'steward-operations' }], []),
    ];
    return { openInquiries, pendingApprovals, openInvestigations, advisoryRecommendations, evidenceItemsUnderCustody, auditLinkageCoveragePct, panels };
  }

  private commit(inquiryId: string, actor: string, eventType: string, message: string, auditId = id('audit-steward')): StewardMutationResultDto {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const hash = `sha256:${JSON.stringify({ inquiryId, eventType, message, previousHash }).length.toString(16)}`;
    this.auditChain.push({ auditId, inquiryId, action: eventType, actor, timestamp: new Date().toISOString(), previousHash, hash, changeSummary: message });
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'regulatory-activity',
        actor,
        timestamp: new Date().toISOString(),
        subjectId: inquiryId,
        payload: { action: eventType, message },
        tenantId: this.deps.tenantId ?? 'trackmind',
        severity: 'info',
        regulations: ['HISA', 'ARCI'],
      });
    }
    return { accepted: true, inquiryId, auditId, eventType, message, mock: false };
  }

  private requireInquiry(inquiryId: string): StewardInquiry {
    const inquiry = this.inquiries.get(inquiryId);
    if (!inquiry) throw new Error(`Unknown steward inquiry ${inquiryId}`);
    return inquiry;
  }

  loadInquiry(inquiry: StewardInquiry): void {
    this.inquiries.set(inquiry.id, inquiry);
    if (!this.reviews.has(inquiry.id)) this.reviews.set(inquiry.id, []);
  }
}

function kpi(
  kpiId: string,
  name: string,
  description: string,
  value: number,
  unit: string,
  target: number,
  status: StewardOperationsKpiDto['status'],
  sourceEntities: StewardOperationsKpiDto['sourceEntities'],
  auditIds: string[],
): StewardOperationsKpiDto {
  return {
    kpiId,
    name,
    description,
    value,
    unit,
    target,
    status,
    trend: 'insufficient-history',
    sourceEntities,
    auditReference: { auditIds: [...auditIds], eventIds: [] },
  };
}

export function createStewardOperationsIntegrations(auditLog?: ImmutableAuditLog): StewardCenterIntegrations {
  const log = auditLog ?? new AuditLog();
  const eventBus = new InMemoryEventBus();
  const approvals = new CentralizedApprovalService({ auditLog: log, eventBus });
  const workflow = new WorkflowOrchestrationEngine({ auditLog: log, eventBus, approvalService: approvals });
  workflow.register(investigationWorkflow('track-1'));
  const evidenceVault = new AuditEvidenceCollectionVault();
  return { auditLog: log, eventBus, approvals, workflow, evidenceVault, observability: { recordSignal: () => undefined } };
}

export function createSeededStewardOperations(deps: StewardOperationsDeps = {}): StewardOperationsPlatform {
  const integrations = deps.integrations ?? createStewardOperationsIntegrations(deps.auditLog);
  const platform = new StewardOperationsPlatform({ ...deps, integrations });
  for (const inquiry of listStewardInquiries()) {
    platform.loadInquiry(inquiry);
    platform.recordReview(inquiry.id, {
      reviewedAt: '2026-06-13T21:09:00.000Z',
      reviewerId: 'steward-1',
      reviewerRole: 'steward',
      reviewType: 'evidence',
      status: 'complete',
      findings: ['Head-on replay reviewed; AI summary marked advisory-only'],
      evidenceIds: inquiry.evidenceReferences.map((evidence) => evidence.id),
      ruleIds: inquiry.ruleReferences.map((rule) => rule.id),
    }, 'steward-1');
  }
  platform.workspace();
  return platform;
}
