export const stewardOperationsSchemaVersion = 'trackmind.steward-operations.v1' as const;

export type StewardCaseStatus =
  | 'inquiry-open'
  | 'objection-filed'
  | 'under-review'
  | 'decision-drafting'
  | 'pending-final-approval'
  | 'finalized'
  | 'appealed';

export type StewardReviewType = 'panel' | 'evidence' | 'rule' | 'objection' | 'final';
export type StewardReviewStatus = 'scheduled' | 'in-progress' | 'complete' | 'deferred';
export type StewardDecisionWorkflowType = 'investigation' | 'approval' | 'ruling' | 'appeal';
export type StewardDecisionWorkflowStatus = 'open' | 'evidence-collection' | 'panel-review' | 'pending-approval' | 'approved' | 'closed' | 'appealed';
export type StewardEvidenceKind = 'video' | 'photo' | 'sensor' | 'chart' | 'radio' | 'witness' | 'ai-summary' | 'official-note';

export interface StewardReviewDto {
  reviewId: string;
  inquiryId: string;
  reviewedAt: string;
  reviewerId: string;
  reviewerRole: string;
  reviewType: StewardReviewType;
  status: StewardReviewStatus;
  findings: string[];
  evidenceIds: string[];
  ruleIds: string[];
  auditId: string;
}

export interface StewardEvidenceReferenceDto {
  id: string;
  inquiryId: string;
  kind: StewardEvidenceKind | string;
  uri: string;
  capturedAt: string;
  addedBy: string;
  description: string;
  hash: string;
  aiGenerated?: boolean;
  sourceSystem?: string;
  twinContextIds?: string[];
  tags?: string[];
  auditRecordId?: string;
  custody?: {
    custodyRecordIds: string[];
    legalHold: boolean;
    sealed: boolean;
    retentionPolicy: string;
    chainOfCustody: Array<{ actorId: string; action: string; at: string; note?: string }>;
  };
}

export interface StewardDecisionWorkflowDto {
  workflowId: string;
  inquiryId: string;
  workflowType: StewardDecisionWorkflowType;
  status: StewardDecisionWorkflowStatus;
  currentStep: string;
  requiredApprovers: string[];
  approvalRequestId?: string;
  workflowInstanceId?: string;
  evidenceIds: string[];
  auditIds: string[];
  eventTypes: string[];
}

export interface StewardAdvisoryRecommendationDto {
  recommendationId: string;
  inquiryId: string;
  source: 'ai-agent' | 'human' | 'service';
  summary: string;
  rationale: string;
  confidence?: number;
  evidenceIds: string[];
  ruleIds: string[];
  linkedEvidenceRefs?: string[];
  officialRuling: false;
  advisoryOnly: true;
  createdAt: string;
  auditId: string;
}

export interface StewardRecommendationSupportDto {
  advisoryOnly: true;
  mayIssueOfficialRuling: false;
  mayModifyOfficialResults: false;
  guardrailStatement: string;
  recommendations: StewardAdvisoryRecommendationDto[];
}

export interface StewardEvidenceListDto {
  inquiryId: string;
  evidenceReferences: StewardEvidenceReferenceDto[];
  mock: false;
}

export interface StewardIntegrationSnapshotDto {
  auditRecordIds: string[];
  eventTypes: string[];
  approvalRequestIds: string[];
  workflowInstanceIds: string[];
  evidenceVaultRecordIds: string[];
  digitalTwinRefs: string[];
}

export interface StewardInquiryRecordDto {
  id: string;
  raceId: string;
  openedAt: string;
  status: StewardCaseStatus | string;
  objections: Array<{ id: string; filedBy: string; allegation: string; status: string; filedAt?: string; horseId?: string; jockeyId?: string }>;
  incidentsUnderReview: Array<{ id: string; description: string; severity: string; status: string; openedAt?: string }>;
  investigations: Array<{ id: string; inquiryId?: string; openedAt: string; leadStewardId: string; status: string; focus: string; taskIds: string[]; evidenceIds: string[]; ruleIds: string[]; digitalTwinRefs: string[]; workflowInstanceId?: string; approvalRequestId?: string }>;
  involvedHorses: Array<{ horseId: string; name: string; programNumber: string; officialResultLocked: true; finishPosition?: number }>;
  involvedJockeys: Array<{ jockeyId: string; name: string; licenseId: string; horseId: string }>;
  evidenceReferences: StewardEvidenceReferenceDto[];
  ruleReferences: Array<{ id: string; jurisdiction: string; rulebook: string; section: string; citation: string; summary: string; effectiveDate?: string; auditRecordId?: string }>;
  decisionDrafts: Array<{ id: string; authorId: string; authorRole: string; recommendation: string; rationale: string; aiGenerated: boolean; officialRuling: false; evidenceIds: string[]; ruleIds: string[] }>;
  evidenceOrganizations: Array<{ id: string; generatedAt: string; generatedBy: string; aiGenerated: true; officialRuling: false; mayModifyOfficialResults: false; clusters: Array<{ id: string; title: string; evidenceIds: string[]; ruleIds: string[]; summary: string }>; missingEvidence: string[]; limitations: string[] }>;
  timeline: Array<{ sequence: number; at: string; source: string; subjectId: string; label: string; actorId?: string; evidenceIds: string[]; ruleIds: string[]; auditRecordId?: string }>;
  finalRuling?: { id: string; issuedBy: string; decision: string; officialResultsModified: false; approvalRequestId?: string };
  appealPackages: Array<{ id: string; contents: { auditRecordIds: string[]; approvalRequestIds?: string[]; guardrailStatement?: string } }>;
  auditRecords: Array<{ id: string; actorId: string; action: string; subjectId: string; hash: string; previousHash: string }>;
  integrations: StewardIntegrationSnapshotDto;
  aiGuardrails: { advisoryOnly: true; mayIssueOfficialRuling: false; mayModifyOfficialResults: false };
  reviews: StewardReviewDto[];
  decisionWorkflows: StewardDecisionWorkflowDto[];
}

export interface StewardOperationsKpiDto {
  kpiId: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  target: number;
  status: 'nominal' | 'watch' | 'warning' | 'critical' | 'blocked';
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  auditReference: { auditIds: string[]; eventIds: string[] };
}

export interface StewardOperationsKpiDashboardDto {
  openInquiries: number;
  pendingApprovals: number;
  openInvestigations: number;
  advisoryRecommendations: number;
  evidenceItemsUnderCustody: number;
  auditLinkageCoveragePct: number;
  panels: StewardOperationsKpiDto[];
}

export interface StewardOperationsWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof stewardOperationsSchemaVersion;
  tenantId: string;
  racetrackId: string;
  inquiries: StewardInquiryRecordDto[];
  reviews: StewardReviewDto[];
  decisionWorkflows: StewardDecisionWorkflowDto[];
  recommendationSupport: StewardRecommendationSupportDto;
  dashboard: StewardOperationsKpiDashboardDto;
  permissions: { canRead: boolean; canDraft: boolean; canFinalize: boolean; canExportAppeal: boolean };
  auditTrail: Array<{ auditId: string; inquiryId?: string; action: string; actor: string; timestamp: string; previousHash: string; hash: string; changeSummary: string }>;
  mock: false;
}

export interface StewardMutationResultDto {
  accepted: true;
  inquiryId: string;
  auditId: string;
  eventType: string;
  message: string;
  mock: false;
}

export interface IssueStewardFinalRulingRequestDto {
  id: string;
  issuedBy: string;
  issuedByRole: 'steward' | 'admin';
  issuedAt: string;
  decision: string;
  rationale: string;
  penalties: string[];
  evidenceIds: string[];
  ruleIds: string[];
  tenantId: string;
  racetrackId: string;
  approvalToken: {
    requestId: string;
    action: string;
    target: string;
    tenantId: string;
    racetrackId: string;
    issuedAt: string;
    expiresAt: string;
    approvedBy: string[];
    issuedTo?: string;
  };
  approvalRequestId?: string;
  actor?: string;
}

export interface StewardOperationsAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof stewardOperationsSchemaVersion;
  records: StewardOperationsWorkspaceDto['auditTrail'];
  mock: false;
}

export const stewardAdvisoryGuardrailStatement =
  'AI may summarize and organize evidence only; official rulings and official result changes require authorized human steward workflows.';
