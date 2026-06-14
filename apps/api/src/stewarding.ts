import type { Role } from '@trackmind/shared';
import { CentralizedApprovalService, type ApprovalToken, type ControlledActionRequest } from './approvals.js';
import { AuditEvidenceCollectionVault, ImmutableAuditLog } from './auditLog.js';
import { InMemoryEventBus, type UniversalEventBus } from './eventBus.js';
import { investigationWorkflow, WorkflowOrchestrationEngine, type WorkflowInstance } from './workflowEngine.js';

export type StewardCaseStatus = 'inquiry-open' | 'objection-filed' | 'under-review' | 'decision-drafting' | 'pending-final-approval' | 'finalized' | 'appealed';
export type StewardEvidenceKind = 'video' | 'photo' | 'sensor' | 'chart' | 'radio' | 'witness' | 'ai-summary' | 'official-note';
export type StewardAuditAction =
  | 'case.opened'
  | 'objection.recorded'
  | 'investigation.opened'
  | 'evidence.added'
  | 'evidence.sealed'
  | 'rule.added'
  | 'ai.summary.created'
  | 'ai.evidence.organized'
  | 'decision.draft.saved'
  | 'approval.requested'
  | 'workflow.started'
  | 'timeline.generated'
  | 'final-ruling.recorded'
  | 'appeal-package.exported'
  | 'access.denied';

export interface StewardObjection { id: string; filedBy: string; filedAt: string; horseId?: string; jockeyId?: string; allegation: string; status: 'filed' | 'accepted-for-review' | 'dismissed' | 'upheld'; }
export interface StewardIncidentUnderReview { id: string; raceId: string; openedAt: string; severity: 'minor' | 'major' | 'critical'; description: string; status: 'open' | 'reviewing' | 'resolved'; }
export interface InvolvedHorse { horseId: string; name: string; programNumber: string; finishPosition?: number; officialResultLocked: true; }
export interface InvolvedJockey { jockeyId: string; name: string; licenseId: string; horseId: string; }
export interface StewardEvidenceCustody { custodyRecordIds: string[]; legalHold: boolean; sealed: boolean; retentionPolicy: string; chainOfCustody: Array<{ actorId: string; action: 'collected' | 'accessed' | 'annotated' | 'sealed' | 'exported'; at: string; note?: string }>; }
export interface StewardEvidenceReference { id: string; kind: StewardEvidenceKind; uri: string; capturedAt: string; addedBy: string; description: string; hash: string; aiGenerated?: boolean; sourceSystem?: string; twinContextIds?: string[]; tags?: string[]; eventId?: string; auditRecordId?: string; custody?: StewardEvidenceCustody; }
export interface StewardRuleReference { id: string; jurisdiction: string; rulebook: string; section: string; citation: string; summary: string; effectiveDate?: string; sourceUri?: string; auditRecordId?: string; }
export interface StewardDecisionDraft { id: string; authorId: string; authorRole: Role | 'ai-agent'; createdAt: string; recommendation: string; rationale: string; evidenceIds: string[]; ruleIds: string[]; aiGenerated: boolean; officialRuling: false; }
export interface StewardFinalRuling { id: string; issuedBy: string; issuedByRole: Role; issuedAt: string; decision: string; rationale: string; penalties: string[]; officialResultsModified: false; evidenceIds: string[]; ruleIds: string[]; approvalRequestId?: string; }
export interface StewardTimelineEntry { sequence: number; at: string; source: 'objection' | 'incident' | 'evidence' | 'rule' | 'ai-organization' | 'draft' | 'final-ruling' | 'appeal-package' | 'audit'; subjectId: string; label: string; actorId?: string; evidenceIds: string[]; ruleIds: string[]; eventId?: string; auditRecordId?: string; }
export interface StewardEvidenceOrganization { id: string; generatedAt: string; generatedBy: string; aiGenerated: true; officialRuling: false; mayModifyOfficialResults: false; clusters: Array<{ id: string; title: string; evidenceIds: string[]; ruleIds: string[]; summary: string }>; timeline: StewardTimelineEntry[]; missingEvidence: string[]; limitations: string[]; }
export interface StewardInvestigation { id: string; inquiryId: string; openedAt: string; leadStewardId: string; status: 'open' | 'evidence-collection' | 'panel-review' | 'pending-approval' | 'closed'; focus: string; taskIds: string[]; evidenceIds: string[]; ruleIds: string[]; digitalTwinRefs: string[]; workflowInstanceId?: string; approvalRequestId?: string; }
export interface StewardAppealPackage {
  id: string;
  generatedAt: string;
  generatedBy: string;
  inquiryId: string;
  contents: {
    evidenceIds: string[];
    evidenceHashes: string[];
    ruleIds: string[];
    draftIds: string[];
    aiOrganizationIds: string[];
    finalRulingId?: string;
    auditRecordIds: string[];
    timeline: StewardTimelineEntry[];
    custodyRecordIds: string[];
    workflowInstanceIds: string[];
    approvalRequestIds: string[];
    eventTypes: string[];
    guardrailStatement: string;
  };
}
export interface StewardAuditRecord { id: string; at: string; actorId: string; actorRole: Role | 'ai-agent' | 'system'; action: StewardAuditAction; subjectId: string; evidenceIds: string[]; ruleIds: string[]; previousHash: string; hash: string; }
export interface StewardIntegrationSnapshot { auditRecordIds: string[]; eventTypes: string[]; approvalRequestIds: string[]; workflowInstanceIds: string[]; evidenceVaultRecordIds: string[]; digitalTwinRefs: string[]; observabilitySignals: Array<{ name: string; at: string; severity: 'info' | 'warning' | 'critical'; traceId: string }>; }

export interface StewardInquiry {
  id: string; raceId: string; openedAt: string; status: StewardCaseStatus; objections: StewardObjection[]; incidentsUnderReview: StewardIncidentUnderReview[]; investigations: StewardInvestigation[]; involvedHorses: InvolvedHorse[]; involvedJockeys: InvolvedJockey[]; evidenceReferences: StewardEvidenceReference[]; ruleReferences: StewardRuleReference[]; decisionDrafts: StewardDecisionDraft[]; evidenceOrganizations: StewardEvidenceOrganization[]; timeline: StewardTimelineEntry[]; finalRuling?: StewardFinalRuling; appealPackages: StewardAppealPackage[]; auditRecords: StewardAuditRecord[]; integrations: StewardIntegrationSnapshot; aiGuardrails: { advisoryOnly: true; mayIssueOfficialRuling: false; mayModifyOfficialResults: false };
}

export interface StewardCenterIntegrations {
  auditLog?: Pick<ImmutableAuditLog, 'append'>;
  eventBus?: Pick<UniversalEventBus, 'publish'>;
  approvals?: Pick<CentralizedApprovalService, 'createRequest' | 'assertAuthorized'>;
  workflow?: Pick<WorkflowOrchestrationEngine, 'start'>;
  evidenceVault?: Pick<AuditEvidenceCollectionVault, 'collect'>;
  observability?: { recordSignal?: (signal: { name: string; severity: 'info' | 'warning' | 'critical'; traceId: string; attributes: Record<string, unknown>; timestamp: string }) => void };
}

const finalRulingRoles: Role[] = ['steward', 'admin'];
const guardrailStatement = 'AI may summarize and organize evidence only; official rulings and official result changes require authorized human steward workflows.';
function digest(value: string) { let hash = 0; for (const ch of value) hash = Math.imul(31, hash) + ch.charCodeAt(0) | 0; return `sha256:${(hash >>> 0).toString(16).padStart(8, '0')}`; }
function signal(inquiry: StewardInquiry, name: string, severity: 'info' | 'warning' | 'critical', at: string) { const item = { name, at, severity, traceId: `trace-steward-${inquiry.id}` }; inquiry.integrations.observabilitySignals.push(item); return item; }
function mirror(inquiry: StewardInquiry, entry: StewardAuditRecord, deps?: StewardCenterIntegrations) {
  inquiry.integrations.auditRecordIds.push(entry.id);
  deps?.auditLog?.append({ id: `steward:${entry.id}`, type: 'regulatory-activity', actor: entry.actorId, timestamp: entry.at, payload: { action: entry.action, inquiryId: inquiry.id, subjectId: entry.subjectId }, subjectId: inquiry.id, correlationId: `steward:${inquiry.id}`, severity: entry.action === 'access.denied' ? 'critical' : 'warning', regulations: ['HISA', 'ARCI'], evidenceIds: entry.evidenceIds });
  deps?.observability?.recordSignal?.({ name: `steward.${entry.action}`, severity: entry.action === 'access.denied' ? 'critical' : 'info', traceId: `trace-steward-${inquiry.id}`, attributes: { inquiryId: inquiry.id, subjectId: entry.subjectId }, timestamp: entry.at });
}
function publish(inquiry: StewardInquiry, type: string, payload: Record<string, unknown>, at: string, deps?: StewardCenterIntegrations) {
  inquiry.integrations.eventTypes.push(type);
  signal(inquiry, type, 'info', at);
  void deps?.eventBus?.publish({ type, occurredAt: at, payload: { inquiryId: inquiry.id, raceId: inquiry.raceId, ...payload }, producer: 'steward-center', aggregateId: inquiry.id, correlationId: `steward:${inquiry.id}`, metadata: { compliance: 'regulated', team: 'stewarding', accountableRole: 'chief-steward', description: 'Steward Center regulated workflow event' } });
}
function audit(inquiry: StewardInquiry, record: Omit<StewardAuditRecord, 'id' | 'previousHash' | 'hash'>, deps?: StewardCenterIntegrations) {
  const previousHash = inquiry.auditRecords.at(-1)?.hash ?? 'genesis';
  const id = `audit-${inquiry.auditRecords.length + 1}`;
  const hash = digest(`${previousHash}:${id}:${record.action}:${record.actorId}:${record.subjectId}:${record.evidenceIds.join(',')}:${record.ruleIds.join(',')}`);
  const entry = { id, previousHash, hash, ...record };
  inquiry.auditRecords.push(entry);
  mirror(inquiry, entry, deps);
  return entry;
}
function requireKnownEvidenceAndRules(inquiry: StewardInquiry, evidenceIds: string[], ruleIds: string[]) {
  const evidence = new Set(inquiry.evidenceReferences.map((item) => item.id));
  const rules = new Set(inquiry.ruleReferences.map((rule) => rule.id));
  const missingEvidence = evidenceIds.filter((id) => !evidence.has(id));
  const missingRules = ruleIds.filter((id) => !rules.has(id));
  if (missingEvidence.length || missingRules.length) throw new Error(`Unknown steward evidence or rule references: ${[...missingEvidence, ...missingRules].join(', ')}`);
}
function assertAiEvidenceOnly(draft: Omit<StewardDecisionDraft, 'officialRuling'>) {
  if (draft.authorRole !== 'ai-agent') return;
  const text = `${draft.recommendation} ${draft.rationale}`.toLowerCase();
  if (!draft.aiGenerated || /uphold|dismiss|disqualif|penalt|ruling|official result|finish order/.test(text)) throw new Error('AI may only summarize or organize steward evidence; official findings require human stewards');
}

export function createStewardInquiry(input: { id: string; raceId: string; openedAt: string; openedBy: string; involvedHorses: InvolvedHorse[]; involvedJockeys: InvolvedJockey[]; evidenceReferences?: StewardEvidenceReference[]; ruleReferences?: StewardRuleReference[]; incidentsUnderReview?: StewardIncidentUnderReview[]; objections?: StewardObjection[] }, deps?: StewardCenterIntegrations): StewardInquiry {
  const evidenceReferences = (input.evidenceReferences ?? []).map((evidence) => ({
    ...evidence,
    twinContextIds: [...(evidence.twinContextIds ?? [])],
    tags: [...(evidence.tags ?? [])],
    custody: evidence.custody ? {
      ...evidence.custody,
      custodyRecordIds: [...evidence.custody.custodyRecordIds],
      chainOfCustody: evidence.custody.chainOfCustody.map((step) => ({ ...step })),
    } : {
      custodyRecordIds: [`custody-${evidence.id}-1`],
      legalHold: true,
      sealed: false,
      retentionPolicy: 'steward-inquiry-legal-hold',
      chainOfCustody: [{ actorId: evidence.addedBy, action: 'collected' as const, at: evidence.capturedAt, note: evidence.hash }],
    },
  }));
  const inquiry: StewardInquiry = { id: input.id, raceId: input.raceId, openedAt: input.openedAt, status: 'inquiry-open', objections: input.objections ?? [], incidentsUnderReview: input.incidentsUnderReview ?? [], investigations: [], involvedHorses: input.involvedHorses, involvedJockeys: input.involvedJockeys, evidenceReferences, ruleReferences: input.ruleReferences ?? [], decisionDrafts: [], evidenceOrganizations: [], timeline: [], appealPackages: [], auditRecords: [], integrations: { auditRecordIds: [], eventTypes: [], approvalRequestIds: [], workflowInstanceIds: [], evidenceVaultRecordIds: [], digitalTwinRefs: [...new Set(evidenceReferences.flatMap((item) => item.twinContextIds ?? []))], observabilitySignals: [] }, aiGuardrails: { advisoryOnly: true, mayIssueOfficialRuling: false, mayModifyOfficialResults: false } };
  audit(inquiry, { at: input.openedAt, actorId: input.openedBy, actorRole: 'steward', action: 'case.opened', subjectId: input.id, evidenceIds: inquiry.evidenceReferences.map((e) => e.id), ruleIds: inquiry.ruleReferences.map((r) => r.id) }, deps);
  publish(inquiry, 'steward.inquiry.opened', { evidenceIds: inquiry.evidenceReferences.map((e) => e.id), ruleIds: inquiry.ruleReferences.map((r) => r.id) }, input.openedAt, deps);
  return inquiry;
}

export function recordStewardObjection(inquiry: StewardInquiry, objection: StewardObjection, deps?: StewardCenterIntegrations): StewardObjection {
  inquiry.objections.push({ ...objection });
  inquiry.status = 'objection-filed';
  audit(inquiry, { at: objection.filedAt, actorId: objection.filedBy, actorRole: 'steward', action: 'objection.recorded', subjectId: objection.id, evidenceIds: [], ruleIds: [] }, deps);
  publish(inquiry, 'steward.objection.recorded', { objectionId: objection.id, horseId: objection.horseId, jockeyId: objection.jockeyId }, objection.filedAt, deps);
  return { ...objection };
}

export function openStewardInvestigation(inquiry: StewardInquiry, input: Omit<StewardInvestigation, 'inquiryId' | 'workflowInstanceId'> & { workflowDefinitionId?: string; tenantId?: string }, deps?: StewardCenterIntegrations): StewardInvestigation {
  requireKnownEvidenceAndRules(inquiry, input.evidenceIds, input.ruleIds);
  let workflowInstance: WorkflowInstance | undefined;
  if (deps?.workflow && input.workflowDefinitionId) {
    workflowInstance = deps.workflow.start(input.workflowDefinitionId, { tenantId: input.tenantId ?? 'track-1', priority: input.status === 'open' ? 'high' : 'normal', digitalTwinRefs: input.digitalTwinRefs, payload: { inquiryId: inquiry.id, raceId: inquiry.raceId, focus: input.focus } }, input.leadStewardId, input.openedAt);
    inquiry.integrations.workflowInstanceIds.push(workflowInstance.id);
  }
  inquiry.integrations.digitalTwinRefs = [...new Set([...inquiry.integrations.digitalTwinRefs, ...input.digitalTwinRefs])];
  const investigation: StewardInvestigation = { ...input, inquiryId: inquiry.id, workflowInstanceId: workflowInstance?.id };
  inquiry.investigations.push(investigation);
  inquiry.status = 'under-review';
  audit(inquiry, { at: input.openedAt, actorId: input.leadStewardId, actorRole: 'steward', action: 'investigation.opened', subjectId: input.id, evidenceIds: input.evidenceIds, ruleIds: input.ruleIds }, deps);
  if (workflowInstance) audit(inquiry, { at: input.openedAt, actorId: input.leadStewardId, actorRole: 'steward', action: 'workflow.started', subjectId: workflowInstance.id, evidenceIds: input.evidenceIds, ruleIds: input.ruleIds }, deps);
  publish(inquiry, 'steward.investigation.opened', { investigationId: input.id, workflowInstanceId: workflowInstance?.id, digitalTwinRefs: input.digitalTwinRefs }, input.openedAt, deps);
  return { ...investigation, taskIds: [...investigation.taskIds], evidenceIds: [...investigation.evidenceIds], ruleIds: [...investigation.ruleIds], digitalTwinRefs: [...investigation.digitalTwinRefs] };
}

export function addStewardEvidence(inquiry: StewardInquiry, evidenceInput: Omit<StewardEvidenceReference, 'hash'> & { hash?: string; content?: unknown }, deps?: StewardCenterIntegrations): StewardEvidenceReference {
  const { content, ...withoutContent } = evidenceInput;
  const hash = evidenceInput.hash ?? digest(JSON.stringify(content ?? withoutContent));
  const custody: StewardEvidenceCustody = withoutContent.custody ?? { custodyRecordIds: [`custody-${withoutContent.id}-1`], legalHold: true, sealed: false, retentionPolicy: 'steward-inquiry-legal-hold', chainOfCustody: [{ actorId: withoutContent.addedBy, action: 'collected', at: withoutContent.capturedAt, note: hash }] };
  const evidence: StewardEvidenceReference = { ...withoutContent, hash, custody, twinContextIds: [...(withoutContent.twinContextIds ?? [])], tags: [...(withoutContent.tags ?? [])] };
  inquiry.evidenceReferences.push(evidence);
  inquiry.integrations.digitalTwinRefs = [...new Set([...inquiry.integrations.digitalTwinRefs, ...(evidence.twinContextIds ?? [])])];
  const vaulted = deps?.evidenceVault?.collect({ id: evidence.id, recordId: inquiry.id, uri: evidence.uri, collectedBy: evidence.addedBy, collectedAt: evidence.capturedAt, description: evidence.description, legalHold: evidence.custody?.legalHold, content: content ?? evidence });
  if (vaulted) inquiry.integrations.evidenceVaultRecordIds.push(vaulted.id);
  const entry = audit(inquiry, { at: evidence.capturedAt, actorId: evidence.addedBy, actorRole: evidence.aiGenerated ? 'ai-agent' : 'steward', action: 'evidence.added', subjectId: evidence.id, evidenceIds: [evidence.id], ruleIds: [] }, deps);
  evidence.auditRecordId = entry.id;
  publish(inquiry, 'steward.evidence.added', { evidenceId: evidence.id, kind: evidence.kind, hash: evidence.hash, twinContextIds: evidence.twinContextIds ?? [] }, evidence.capturedAt, deps);
  return { ...evidence, custody: evidence.custody ? { ...evidence.custody, custodyRecordIds: [...evidence.custody.custodyRecordIds], chainOfCustody: evidence.custody.chainOfCustody.map((step) => ({ ...step })) } : undefined };
}

export function addStewardRuleReference(inquiry: StewardInquiry, rule: StewardRuleReference, actorId = 'steward-clerk', at = new Date().toISOString(), deps?: StewardCenterIntegrations): StewardRuleReference {
  inquiry.ruleReferences.push({ ...rule });
  const entry = audit(inquiry, { at, actorId, actorRole: 'steward', action: 'rule.added', subjectId: rule.id, evidenceIds: [], ruleIds: [rule.id] }, deps);
  const saved = inquiry.ruleReferences[inquiry.ruleReferences.length - 1];
  saved.auditRecordId = entry.id;
  publish(inquiry, 'steward.rule.added', { ruleId: rule.id, jurisdiction: rule.jurisdiction, section: rule.section }, at, deps);
  return { ...saved };
}

export function generateStewardTimeline(inquiry: StewardInquiry, options: { actorId?: string; at?: string; deps?: StewardCenterIntegrations } = {}): StewardTimelineEntry[] {
  const entries: Array<Omit<StewardTimelineEntry, 'sequence'>> = [
    ...inquiry.objections.map((item) => ({ at: item.filedAt, source: 'objection' as const, subjectId: item.id, label: item.allegation, actorId: item.filedBy, evidenceIds: [], ruleIds: [] })),
    ...inquiry.incidentsUnderReview.map((item) => ({ at: item.openedAt, source: 'incident' as const, subjectId: item.id, label: item.description, evidenceIds: [], ruleIds: [] })),
    ...inquiry.evidenceReferences.map((item) => ({ at: item.capturedAt, source: 'evidence' as const, subjectId: item.id, label: `${item.kind}: ${item.description}`, actorId: item.addedBy, evidenceIds: [item.id], ruleIds: [], eventId: item.eventId, auditRecordId: item.auditRecordId })),
    ...inquiry.ruleReferences.map((item) => ({ at: item.effectiveDate ?? inquiry.openedAt, source: 'rule' as const, subjectId: item.id, label: `${item.jurisdiction} ${item.section}: ${item.citation}`, evidenceIds: [], ruleIds: [item.id], auditRecordId: item.auditRecordId })),
    ...inquiry.evidenceOrganizations.map((item) => ({ at: item.generatedAt, source: 'ai-organization' as const, subjectId: item.id, label: 'AI organized evidence for human review', actorId: item.generatedBy, evidenceIds: item.clusters.flatMap((cluster) => cluster.evidenceIds), ruleIds: item.clusters.flatMap((cluster) => cluster.ruleIds) })),
    ...inquiry.decisionDrafts.map((item) => ({ at: item.createdAt, source: 'draft' as const, subjectId: item.id, label: item.recommendation, actorId: item.authorId, evidenceIds: item.evidenceIds, ruleIds: item.ruleIds })),
    ...(inquiry.finalRuling ? [{ at: inquiry.finalRuling.issuedAt, source: 'final-ruling' as const, subjectId: inquiry.finalRuling.id, label: inquiry.finalRuling.decision, actorId: inquiry.finalRuling.issuedBy, evidenceIds: inquiry.finalRuling.evidenceIds, ruleIds: inquiry.finalRuling.ruleIds }] : []),
    ...inquiry.appealPackages.map((item) => ({ at: item.generatedAt, source: 'appeal-package' as const, subjectId: item.id, label: 'Appeal package exported', actorId: item.generatedBy, evidenceIds: item.contents.evidenceIds, ruleIds: item.contents.ruleIds })),
    ...inquiry.auditRecords.map((item) => ({ at: item.at, source: 'audit' as const, subjectId: item.subjectId, label: item.action, actorId: item.actorId, evidenceIds: item.evidenceIds, ruleIds: item.ruleIds, auditRecordId: item.id })),
  ];
  const timeline = entries.sort((a, b) => a.at.localeCompare(b.at)).map((entry, index) => ({ sequence: index + 1, ...entry }));
  inquiry.timeline = timeline.map((entry) => ({ ...entry, evidenceIds: [...entry.evidenceIds], ruleIds: [...entry.ruleIds] }));
  if (options.actorId) {
    const at = options.at ?? new Date().toISOString();
    audit(inquiry, { at, actorId: options.actorId, actorRole: 'steward', action: 'timeline.generated', subjectId: inquiry.id, evidenceIds: inquiry.evidenceReferences.map((e) => e.id), ruleIds: inquiry.ruleReferences.map((r) => r.id) }, options.deps);
    publish(inquiry, 'steward.timeline.generated', { timelineEntries: timeline.length }, at, options.deps);
  }
  return timeline;
}

export function organizeEvidenceForStewards(inquiry: StewardInquiry, input: { actorId?: string; generatedAt?: string; missingEvidence?: string[]; deps?: StewardCenterIntegrations } = {}): StewardEvidenceOrganization {
  const actorId = input.actorId ?? 'steward-ai';
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const byKind = new Map<StewardEvidenceKind, StewardEvidenceReference[]>();
  for (const evidence of inquiry.evidenceReferences) byKind.set(evidence.kind, [...(byKind.get(evidence.kind) ?? []), evidence]);
  const clusters = [...byKind.entries()].map(([kind, evidence], index) => ({ id: `cluster-${index + 1}`, title: `${kind} evidence`, evidenceIds: evidence.map((item) => item.id), ruleIds: inquiry.ruleReferences.map((rule) => rule.id), summary: `${evidence.length} ${kind} item(s) organized for steward review with rule references attached.` }));
  const organization: StewardEvidenceOrganization = { id: `ai-org-${inquiry.evidenceOrganizations.length + 1}`, generatedAt, generatedBy: actorId, aiGenerated: true, officialRuling: false, mayModifyOfficialResults: false, clusters, timeline: generateStewardTimeline(inquiry), missingEvidence: input.missingEvidence ?? [], limitations: ['AI did not decide the objection, issue a ruling, assess penalties, or modify official results.', 'Human stewards must review source evidence, rule citations, custody, and approvals before any official decision.'] };
  inquiry.evidenceOrganizations.push(organization);
  inquiry.status = inquiry.status === 'inquiry-open' ? 'under-review' : inquiry.status;
  audit(inquiry, { at: generatedAt, actorId, actorRole: 'ai-agent', action: 'ai.evidence.organized', subjectId: organization.id, evidenceIds: inquiry.evidenceReferences.map((e) => e.id), ruleIds: inquiry.ruleReferences.map((r) => r.id) }, input.deps);
  publish(inquiry, 'steward.ai.evidence.organized', { organizationId: organization.id, officialRuling: false, mayModifyOfficialResults: false }, generatedAt, input.deps);
  return { ...organization, clusters: organization.clusters.map((cluster) => ({ ...cluster, evidenceIds: [...cluster.evidenceIds], ruleIds: [...cluster.ruleIds] })), timeline: organization.timeline.map((entry) => ({ ...entry, evidenceIds: [...entry.evidenceIds], ruleIds: [...entry.ruleIds] })), missingEvidence: [...organization.missingEvidence], limitations: [...organization.limitations] };
}

export function summarizeEvidenceForStewards(inquiry: StewardInquiry, actorId = 'steward-ai'): StewardDecisionDraft {
  const organization = organizeEvidenceForStewards(inquiry, { actorId });
  const draft: StewardDecisionDraft = { id: `draft-ai-${inquiry.decisionDrafts.length + 1}`, authorId: actorId, authorRole: 'ai-agent', createdAt: organization.generatedAt, recommendation: `Evidence organization only: review ${inquiry.evidenceReferences.length} evidence items and ${inquiry.ruleReferences.length} rules before any human ruling.`, rationale: organization.clusters.map((cluster) => `${cluster.title}: ${cluster.evidenceIds.join(', ')}`).join('; '), evidenceIds: inquiry.evidenceReferences.map((e) => e.id), ruleIds: inquiry.ruleReferences.map((r) => r.id), aiGenerated: true, officialRuling: false };
  inquiry.decisionDrafts.push(draft);
  audit(inquiry, { at: draft.createdAt, actorId, actorRole: 'ai-agent', action: 'ai.summary.created', subjectId: draft.id, evidenceIds: draft.evidenceIds, ruleIds: draft.ruleIds });
  return draft;
}

export function saveDecisionDraft(inquiry: StewardInquiry, draft: Omit<StewardDecisionDraft, 'officialRuling'>, deps?: StewardCenterIntegrations): StewardDecisionDraft {
  assertAiEvidenceOnly(draft);
  requireKnownEvidenceAndRules(inquiry, draft.evidenceIds, draft.ruleIds);
  const saved = { ...draft, evidenceIds: [...draft.evidenceIds], ruleIds: [...draft.ruleIds], officialRuling: false as const };
  inquiry.decisionDrafts.push(saved);
  inquiry.status = 'decision-drafting';
  audit(inquiry, { at: saved.createdAt, actorId: saved.authorId, actorRole: saved.authorRole, action: 'decision.draft.saved', subjectId: saved.id, evidenceIds: saved.evidenceIds, ruleIds: saved.ruleIds }, deps);
  publish(inquiry, 'steward.decision-draft.saved', { draftId: saved.id, aiGenerated: saved.aiGenerated, officialRuling: false }, saved.createdAt, deps);
  return saved;
}

export function requestStewardFinalApproval(inquiry: StewardInquiry, input: { tenantId: string; requestedBy: string; actorType: 'human' | 'ai-agent' | 'service'; reason: string; evidence: string[]; now?: string; workflowInstanceId?: string; id?: string }, deps: StewardCenterIntegrations): ControlledActionRequest {
  const now = input.now ?? new Date().toISOString();
  const request = deps.approvals?.createRequest({ id: input.id, tenantId: input.tenantId, action: 'steward-decision', target: inquiry.id, requestedBy: input.requestedBy, actorType: input.actorType, reason: input.reason, evidence: input.evidence, workflowInstanceId: input.workflowInstanceId, now });
  if (!request) throw new Error('Steward final approval requires centralized approval service integration');
  inquiry.status = 'pending-final-approval';
  inquiry.integrations.approvalRequestIds.push(request.id);
  audit(inquiry, { at: now, actorId: input.requestedBy, actorRole: input.actorType === 'ai-agent' ? 'ai-agent' : 'steward', action: 'approval.requested', subjectId: request.id, evidenceIds: input.evidence, ruleIds: [] }, deps);
  publish(inquiry, 'steward.approval.requested', { approvalRequestId: request.id, workflowInstanceId: input.workflowInstanceId }, now, deps);
  return request;
}

export function issueFinalRuling(inquiry: StewardInquiry, ruling: StewardFinalRuling, options: { approvalToken?: ApprovalToken; approvalService?: Pick<CentralizedApprovalService, 'assertAuthorized'>; tenantId?: string; now?: string; deps?: StewardCenterIntegrations } = {}): StewardFinalRuling {
  if (!finalRulingRoles.includes(ruling.issuedByRole) || String(ruling.issuedByRole) === 'ai-agent') {
    audit(inquiry, { at: ruling.issuedAt, actorId: ruling.issuedBy, actorRole: ruling.issuedByRole, action: 'access.denied', subjectId: inquiry.id, evidenceIds: ruling.evidenceIds, ruleIds: ruling.ruleIds }, options.deps);
    throw new Error('official steward rulings require an authorized human steward role');
  }
  if (ruling.officialResultsModified !== false) throw new Error('steward center may not modify official results');
  requireKnownEvidenceAndRules(inquiry, ruling.evidenceIds, ruling.ruleIds);
  if (options.approvalService) options.approvalService.assertAuthorized(options.approvalToken, 'steward-decision', inquiry.id, options.tenantId ?? 'track-1', options.now ?? ruling.issuedAt);
  inquiry.finalRuling = { ...ruling, evidenceIds: [...ruling.evidenceIds], ruleIds: [...ruling.ruleIds], officialResultsModified: false };
  inquiry.status = 'finalized';
  audit(inquiry, { at: ruling.issuedAt, actorId: ruling.issuedBy, actorRole: ruling.issuedByRole, action: 'final-ruling.recorded', subjectId: ruling.id, evidenceIds: ruling.evidenceIds, ruleIds: ruling.ruleIds }, options.deps);
  publish(inquiry, 'steward.final-ruling.recorded', { rulingId: ruling.id, approvalRequestId: ruling.approvalRequestId, officialResultsModified: false }, ruling.issuedAt, options.deps);
  return inquiry.finalRuling;
}

export function exportAppealPackage(inquiry: StewardInquiry, generatedBy = 'steward-clerk', deps?: StewardCenterIntegrations): StewardAppealPackage {
  const generatedAt = new Date().toISOString();
  const timeline = generateStewardTimeline(inquiry);
  const pkg: StewardAppealPackage = { id: `appeal-${inquiry.appealPackages.length + 1}`, generatedAt, generatedBy, inquiryId: inquiry.id, contents: { evidenceIds: inquiry.evidenceReferences.map((e) => e.id), evidenceHashes: inquiry.evidenceReferences.map((e) => e.hash), ruleIds: inquiry.ruleReferences.map((r) => r.id), draftIds: inquiry.decisionDrafts.map((d) => d.id), aiOrganizationIds: inquiry.evidenceOrganizations.map((org) => org.id), finalRulingId: inquiry.finalRuling?.id, auditRecordIds: inquiry.auditRecords.map((a) => a.id), timeline, custodyRecordIds: inquiry.evidenceReferences.flatMap((e) => e.custody?.custodyRecordIds ?? []), workflowInstanceIds: [...inquiry.integrations.workflowInstanceIds], approvalRequestIds: [...inquiry.integrations.approvalRequestIds], eventTypes: [...inquiry.integrations.eventTypes], guardrailStatement } };
  inquiry.appealPackages.push(pkg);
  inquiry.status = inquiry.finalRuling ? 'appealed' : inquiry.status;
  audit(inquiry, { at: pkg.generatedAt, actorId: generatedBy, actorRole: 'steward', action: 'appeal-package.exported', subjectId: pkg.id, evidenceIds: pkg.contents.evidenceIds, ruleIds: pkg.contents.ruleIds }, deps);
  publish(inquiry, 'steward.appeal-package.exported', { appealPackageId: pkg.id, auditRecordIds: pkg.contents.auditRecordIds }, pkg.generatedAt, deps);
  pkg.contents.auditRecordIds = inquiry.auditRecords.map((a) => a.id);
  return pkg;
}

export function validateStewardAuditTrail(inquiry: StewardInquiry) {
  const missing = inquiry.auditRecords.filter((r) => !r.actorId || !r.action || !r.subjectId || !r.hash || !r.previousHash);
  const custodyGaps = inquiry.evidenceReferences.filter((e) => !e.custody?.chainOfCustody.length || !e.hash);
  return { complete: missing.length === 0 && custodyGaps.length === 0, recordCount: inquiry.auditRecords.length, missingRecordIds: missing.map((r) => r.id), custodyGapEvidenceIds: custodyGaps.map((e) => e.id) };
}
export function canAccessStewardCenter(roles: Role[], action: 'read' | 'draft' | 'finalize' | 'appeal') { if (roles.includes('admin')) return true; if (action === 'read') return roles.some((r) => ['steward', 'compliance-officer', 'read-only-auditor'].includes(r)); if (action === 'draft' || action === 'appeal') return roles.includes('steward') || roles.includes('compliance-officer'); return roles.includes('steward'); }
export function listStewardInquiries(): StewardInquiry[] {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const workflow = new WorkflowOrchestrationEngine({ auditLog, eventBus, approvalService: approvals });
  workflow.register(investigationWorkflow('track-1'));
  const evidenceVault = new AuditEvidenceCollectionVault();
  const deps: StewardCenterIntegrations = {
    auditLog,
    eventBus,
    approvals,
    workflow,
    evidenceVault,
    observability: { recordSignal: (record) => signalSeededStewardObservation(record) },
  };

  const inquiry = createStewardInquiry({
    id: 'inq-race-7-1',
    raceId: 'race-7',
    openedAt: '2026-06-13T21:04:00.000Z',
    openedBy: 'steward-1',
    involvedHorses: [{ horseId: 'horse-4', name: 'Rail Runner', programNumber: '4', finishPosition: 2, officialResultLocked: true }, { horseId: 'horse-7', name: 'Outside Lane', programNumber: '7', finishPosition: 1, officialResultLocked: true }],
    involvedJockeys: [{ jockeyId: 'jockey-4', name: 'Sam Rivera', licenseId: 'LIC-4', horseId: 'horse-4' }, { jockeyId: 'jockey-7', name: 'Lee Morgan', licenseId: 'LIC-7', horseId: 'horse-7' }],
    incidentsUnderReview: [{ id: 'incident-r7-stretch', raceId: 'race-7', openedAt: '2026-06-13T21:04:00.000Z', severity: 'major', description: 'Possible stretch interference', status: 'reviewing' }],
  }, deps);
  recordStewardObjection(inquiry, { id: 'obj-1', filedBy: 'trainer-4', filedAt: '2026-06-13T21:05:00.000Z', horseId: 'horse-4', jockeyId: 'jockey-4', allegation: 'Horse 7 drifted inward in upper stretch.', status: 'accepted-for-review' }, deps);
  addStewardEvidence(inquiry, { id: 'ev-headon', kind: 'video', uri: 's3://stewards/race-7/headon.mp4', capturedAt: '2026-06-13T21:03:30.000Z', addedBy: 'video-review', description: 'Head-on replay entering stretch', hash: 'sha256:headon', sourceSystem: 'video-evidence', twinContextIds: ['twin:race-7', 'twin:horse-7'], content: { camera: 'head-on', raceId: 'race-7' } }, deps);
  addStewardRuleReference(inquiry, { id: 'rule-interference', jurisdiction: 'NY', rulebook: 'Racing Rules', section: '4035.2', citation: 'Interference and careless riding', summary: 'Stewards determine whether interference altered placing.', effectiveDate: '2026-01-01' }, 'steward-clerk', '2026-06-13T21:05:30.000Z', deps);
  addStewardEvidence(inquiry, { id: 'ev-ai-summary', kind: 'ai-summary', uri: 'audit://ai-summary/1', capturedAt: '2026-06-13T21:06:00.000Z', addedBy: 'steward-ai', description: 'AI grouped replay angles, witness notes, and twin references for steward review only.', aiGenerated: true, sourceSystem: 'steward-ai-organizer', twinContextIds: ['twin:race-7'], tags: ['advisory-only'], content: { advisoryOnly: true, officialRuling: false, mayModifyOfficialResults: false } }, deps);
  const investigation = openStewardInvestigation(inquiry, { id: 'investigation-r7-stretch', openedAt: '2026-06-13T21:07:00.000Z', leadStewardId: 'steward-1', status: 'evidence-collection', focus: 'Stretch interference objection and official result lock validation', taskIds: ['collect-evidence', 'panel-review', 'approval-request'], evidenceIds: ['ev-headon', 'ev-ai-summary'], ruleIds: ['rule-interference'], digitalTwinRefs: ['twin:race-7', 'twin:horse-4', 'twin:horse-7'], approvalRequestId: 'approval-steward-decision-r7', workflowDefinitionId: 'steward-investigation', tenantId: 'track-1' }, deps);
  organizeEvidenceForStewards(inquiry, { actorId: 'steward-ai', generatedAt: '2026-06-13T21:08:00.000Z', missingEvidence: ['pan replay angle pending chain-of-custody seal'], deps });
  saveDecisionDraft(inquiry, { id: 'draft-human-1', authorId: 'steward-2', authorRole: 'steward', createdAt: '2026-06-13T21:12:00.000Z', recommendation: 'Panel draft pending final steward approval', rationale: 'Human stewards reviewed video, rule references, and locked official result state.', evidenceIds: ['ev-headon', 'ev-ai-summary'], ruleIds: ['rule-interference'], aiGenerated: false }, deps);
  const approval = requestStewardFinalApproval(inquiry, { id: 'approval-steward-decision-r7', tenantId: 'track-1', requestedBy: 'workflow-engine', actorType: 'service', reason: 'Human steward final ruling package is ready for controlled approval', evidence: ['ev-headon', 'ev-ai-summary'], workflowInstanceId: investigation.workflowInstanceId, now: '2026-06-13T21:13:00.000Z' }, deps);
  inquiry.investigations = inquiry.investigations.map((item) => item.id === investigation.id ? { ...item, approvalRequestId: approval.id } : item);
  generateStewardTimeline(inquiry, { actorId: 'steward-1', at: '2026-06-13T21:14:00.000Z', deps });
  exportAppealPackage(inquiry, 'steward-clerk', deps);
  return [inquiry];
}

function signalSeededStewardObservation(_record: { name: string; severity: 'info' | 'warning' | 'critical'; traceId: string; attributes: Record<string, unknown>; timestamp: string }) {
  // The seeded API facade records observability on the inquiry snapshot; no external sink is needed for mock/live fixtures.
}
