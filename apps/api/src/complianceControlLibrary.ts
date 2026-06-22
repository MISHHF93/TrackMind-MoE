import { appendAudit, type AuditAppendTarget } from './auditAdapter.js';
import { AuditEvidenceCollectionVault, ImmutableAuditLog, type AuditLogEntry, type AuditRecordInput } from './auditLog.js';
import { type EventContract, type UniversalEventBus } from './eventBus.js';
import { WorkflowOrchestrationEngine, type WorkflowDefinition, type WorkflowInstance } from './workflowEngine.js';
import type { CanonicalEventRef, Role } from '@trackmind/shared';

export type ComplianceFrameworkId = 'ISO-42001'|'NIST-AI-RMF'|'ISO-27001'|'ISO-27701'|'ISO-25010'|'ISO-31000'|'ISO-22301'|'SOC-2'|'PCI-DSS'|'HISA'|'ARCI'|'LOCAL-RACING-COMMISSION';
export type ControlStatus = 'draft'|'implemented'|'assessing'|'effective'|'deficient'|'retired';
export type AssessmentRating = 'effective'|'partially-effective'|'ineffective'|'not-assessed';
export type FindingSeverity = 'low'|'medium'|'high'|'critical';
export type ReviewCadence = 'continuous'|'race-day'|'quarterly'|'annual'|'incident-driven';
export type HisaOperationalOversightCategory = 'racetrack-management'|'racing-office-operations'|'maintenance-facilities'|'safety'|'accreditation';
export type EvidenceSourceObjectType = 'control'|'workflow'|'audit-record'|'event'|'digital-twin'|'ai-recommendation'|'approval'|'racetrack-operation'|'kpi-definition';
export type ComplianceEvidenceReviewStatus = 'draft'|'submitted'|'pending-review'|'approved'|'rejected'|'archived';
export type ComplianceEvidenceType = 'document'|'screenshot'|'log-export'|'approval-record'|'audit-trail'|'sensor-capture'|'policy-attestation'|'workflow-artifact'|'other';
export type ComplianceEvidenceDomain = 'security-manager'|'operations'|'equine-welfare'|'facilities'|'finance-manager'|'governance'|'racing-integrity'|'ai-governance'|'regulatory';
export type ComplianceEvidenceLinkTargetKind = 'incident'|'approval'|'control'|'audit'|'kpi-definition'|'regulatory-workflow';
export interface ComplianceEvidenceLinkTarget { targetKind: ComplianceEvidenceLinkTargetKind; targetId: string; label?: string }
export interface ComplianceEvidenceRetention { retentionPolicy: string; retainedUntil?: string; legalHold?: boolean }
export interface ComplianceEvidenceRecord {
  id: string;
  title: string;
  controlId: string;
  frameworkIds: ComplianceFrameworkId[];
  policyCitation?: string;
  domain: ComplianceEvidenceDomain;
  evidenceType: ComplianceEvidenceType;
  source: string;
  notes: string;
  reviewStatus: ComplianceEvidenceReviewStatus;
  approvalRequestId?: string;
  auditRecordId: string;
  evidenceVaultId: string;
  uri: string;
  linkTargets: ComplianceEvidenceLinkTarget[];
  retention: ComplianceEvidenceRetention;
  collectedBy: string;
  collectedAt: string;
  workflowInstanceId?: string;
  evidencePackageId?: string;
}

export interface EvidenceSourceReference { objectType: EvidenceSourceObjectType; objectId: string; workflowInstanceId?: string; controlId?: string }
export interface EvidenceFrameworkMapping { frameworkId: ComplianceFrameworkId; citation: string; controlIds: string[]; relationship: 'primary'|'equivalent'|'supports'|'overlaps'|'localizes'; evidenceUse: 'reusable'|'supplemental' }
export interface EvidenceAccreditationReadiness { status: 'collecting'|'internal-review'|'ready-for-review'|'gap-remediation'; score: number; readinessOnly: true; externalCertificationClaimed: false; notes: string }

export const universalEvidenceFrameworkIds = ['ISO-42001','ISO-27001','ISO-27701','ISO-31000','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION'] as const satisfies readonly ComplianceFrameworkId[];
export const hisaOperationalOversightCategories = ['racetrack-management','racing-office-operations','maintenance-facilities','safety','accreditation'] as const satisfies readonly HisaOperationalOversightCategory[];

function uniqueStrings<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

export interface ComplianceFramework { id: ComplianceFrameworkId; name: string; placeholder: boolean; domains: string[]; authority: string; accreditationArtifact: string; }
export interface ComplianceObligation { id: string; frameworkId: ComplianceFrameworkId; citation: string; summary: string; applicability: string; controlIds: string[]; dueCadence: ReviewCadence; jurisdiction?: string; }
export interface ControlOwner { id: string; displayName: string; role: Role; permissions: Array<'read'|'collect-evidence'|'assess'|'approve-action'|'platform-super-admin'>; }
export interface ComplianceControl { id: string; frameworkIds: ComplianceFrameworkId[]; title: string; description: string; status: ControlStatus; ownerId: string; obligationIds: string[]; evidenceIds: string[]; assessmentIds: string[]; workflowInstanceIds: string[]; auditRecordIds: string[]; digitalTwinRefs: string[]; approvalRequestIds: string[]; eventIds: string[]; reviewCadence: ReviewCadence; hisaOperationalOversightCategories: HisaOperationalOversightCategory[]; }
export interface ControlAssessment { id: string; controlId: string; assessedBy: string; assessedAt: string; rating: AssessmentRating; notes: string; evidenceIds: string[]; findingIds: string[]; }
export interface ComplianceFinding { id: string; controlId: string; severity: FindingSeverity; summary: string; status: 'open'|'accepted-risk'|'remediated'|'closed'; correctiveActionIds: string[]; evidenceIds: string[]; auditRecordIds: string[]; }
export interface CorrectiveAction { id: string; findingId: string; ownerId: string; action: string; dueAt: string; status: 'open'|'in-progress'|'done'|'overdue'; workflowInstanceId?: string; approvalRequestId?: string; auditRecordIds: string[]; }
export interface ReviewCycle { id: string; frameworkId: ComplianceFrameworkId; periodStart: string; periodEnd: string; controlIds: string[]; status: 'planned'|'in-review'|'ready-for-internal-audit-prep'|'closed'; readinessScore: number; }
export interface FrameworkMapping { id: string; frameworkId: ComplianceFrameworkId; citation: string; mappedTo: Array<{ frameworkId: ComplianceFrameworkId; citation: string; relationship: 'equivalent'|'supports'|'overlaps'|'localizes' }>; racingCommissionRule?: string; controlIds: string[]; }
export interface EvidencePackage { id: string; evidenceId: string; title: string; tenantId: string; racetrackId: string; source: EvidenceSourceReference; controlIds: string[]; evidenceIds: string[]; auditRecordIds: string[]; auditRefs: string[]; workflowInstanceIds: string[]; approvalRequestIds: string[]; digitalTwinRefs: string[]; eventIds: string[]; eventRefs: string[]; aiRecommendationRefs: string[]; frameworkIds: ComplianceFrameworkId[]; frameworkMappings: EvidenceFrameworkMapping[]; controlOwnerId: string; reviewCadence: ReviewCadence; hisaOperationalOversightCategories: HisaOperationalOversightCategory[]; accreditationReadiness: EvidenceAccreditationReadiness; sealed: boolean; readiness: 'collecting'|'review'|'evidence-package-ready'; }
export interface AccreditationProgram { id: string; name: string; authority: string; frameworkIds: ComplianceFrameworkId[]; jurisdiction: string; status: 'not-started'|'collecting-evidence'|'internal-assessment'|'ready-for-internal-review'; requiredControlIds: string[]; evidencePackageIds: string[]; readinessScore: number; nextReviewAt: string; readinessOnly: true; externalCertificationClaimed: false; }
export interface ComplianceAuditEvent extends Pick<CanonicalEventRef, 'eventId' | 'eventType' | 'tenantId' | 'racetrackId' | 'actorId' | 'source' | 'timestamp' | 'version'> { id: string; type: 'compliance.control.created'|'compliance.evidence.collected'|'compliance.assessment.completed'|'compliance.finding.opened'|'compliance.corrective-action.created'|'compliance.corrective-action.updated'|'compliance.corrective-action.deleted'|'compliance.accreditation.readiness.updated'; occurredAt: string; frameworkIds: ComplianceFrameworkId[]; controlId?: string; auditRecordId: string; workflowInstanceId?: string; approvalRequestId?: string; }
export interface CompliancePolicyRegistryEntry { id: string; frameworkId: ComplianceFrameworkId; citation: string; summary: string; controlIds: string[]; dueCadence: ReviewCadence; jurisdiction?: string; mappedFrameworks: Array<{ frameworkId: ComplianceFrameworkId; citation: string; relationship: string }>; racingCommissionRule?: string; }
export interface AuditReadinessScore { score: number; totalControls: number; effectiveControls: number; evidenceCoverage: number; openFindings: number; overdueActions: number; byFramework: Array<{ frameworkId: ComplianceFrameworkId; score: number; controls: number }> }

export const complianceFrameworkPlaceholders: ComplianceFramework[] = [
  ['ISO-42001','ISO 42001 AI management system','AI governance','AI management system statement of applicability'],
  ['NIST-AI-RMF','NIST AI Risk Management Framework','AI risk management','AI RMF govern-map-measure-manage evidence index'],
  ['ISO-27001','ISO 27001 information security','security-manager','information security statement of applicability'],
  ['ISO-27701','ISO 27701 privacy information management','privacy','privacy control implementation statement'],
  ['ISO-25010','ISO 25010 software product quality','software quality','quality model assessment dossier'],
  ['ISO-31000','ISO 31000 risk management','risk','enterprise risk treatment register'],
  ['ISO-22301','ISO 22301 business continuity','continuity','business continuity exercise evidence'],
  ['SOC-2','SOC 2 trust services','trust','trust services control matrix'],
  ['PCI-DSS','PCI DSS payment security','payments','cardholder-data environment evidence package'],
  ['HISA','HISA racing safety and integrity','racing integrity','HISA safety and integrity filing packet'],
  ['ARCI','ARCI model racing rules','racing rules','ARCI rule conformance binder'],
  ['LOCAL-RACING-COMMISSION','Local racing commission rules','jurisdictional rules','commission-ready filing packet'],
].map(([id, name, domain, artifact]) => ({ id: id as ComplianceFrameworkId, name, placeholder: false, domains: [domain], authority: authorityFor(id as ComplianceFrameworkId), accreditationArtifact: artifact }));

export const complianceEventContracts: EventContract[] = [
  { type: 'compliance.control.created.v1', version: 1, description: 'Compliance control was created or baselined.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['controlId','frameworkIds','status'], compliance: 'regulated' },
  { type: 'compliance.evidence.collected.v1', version: 1, description: 'Audit evidence was collected and linked to a control.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['controlId','evidenceIds','auditRecordId'], compliance: 'regulated' },
  { type: 'compliance.assessment.completed.v1', version: 1, description: 'A control assessment was completed with evidence and findings.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['controlId','assessmentId','rating'], compliance: 'regulated' },
  { type: 'compliance.finding.opened.v1', version: 1, description: 'A compliance finding was opened for corrective action.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['findingId','controlId','severity'], compliance: 'regulated' },
  { type: 'compliance.corrective-action.created.v1', version: 1, description: 'A corrective action was opened and tied to workflow/approval governance.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['correctiveActionId','findingId','ownerId','dueAt'], compliance: 'regulated' },
  { type: 'compliance.corrective-action.updated.v1', version: 1, description: 'A corrective action was updated with audit linkage.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['correctiveActionId','status','ownerId'], compliance: 'regulated' },
  { type: 'compliance.corrective-action.deleted.v1', version: 1, description: 'A corrective action was removed from the active register.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['correctiveActionId','findingId'], compliance: 'regulated' },
  { type: 'compliance.accreditation.readiness.updated.v1', version: 1, description: 'Accreditation readiness changed for a framework/program.', owner: { service: 'compliance-control-library', team: 'governance-risk-compliance', accountableRole: 'compliance-officer' }, payloadFields: ['programId','frameworkIds','readinessScore'], compliance: 'regulated' },
];

export class ComplianceControlLibrary {
  private readonly internalAudit = new ImmutableAuditLog();
  readonly evidenceVault = new AuditEvidenceCollectionVault();
  readonly workflows = new WorkflowOrchestrationEngine();
  private frameworks = new Map(complianceFrameworkPlaceholders.map((f) => [f.id, f]));
  private owners = new Map<string, ControlOwner>();
  private obligations = new Map<string, ComplianceObligation>();
  private controls = new Map<string, ComplianceControl>();
  private assessments = new Map<string, ControlAssessment>();
  private findings = new Map<string, ComplianceFinding>();
  private actions = new Map<string, CorrectiveAction>();
  private cycles = new Map<string, ReviewCycle>();
  private mappings = new Map<string, FrameworkMapping>();
  private evidencePackages = new Map<string, EvidencePackage>();
  private evidenceRecords = new Map<string, ComplianceEvidenceRecord>();
  private accreditationPrograms = new Map<string, AccreditationProgram>();
  private auditReadinessEvents: ComplianceAuditEvent[] = [];

  constructor(private readonly tenantId = 'track-1', private readonly deps: { eventBus?: UniversalEventBus; audit?: AuditAppendTarget } = {}) {
    this.workflows.register(complianceEvidenceWorkflow(tenantId));
    this.workflows.register(complianceCorrectiveActionWorkflow(tenantId));
    this.workflows.register(accreditationReadinessWorkflow(tenantId));
    if (deps.eventBus) registerComplianceEventContracts(deps.eventBus);
  }

  get audit(): ImmutableAuditLog {
    return this.deps.audit?.ledger ?? this.internalAudit;
  }

  private appendComplianceAudit(record: AuditRecordInput): AuditLogEntry {
    if (this.deps.audit) {
      appendAudit(this.deps.audit, record);
      return this.deps.audit.ledger.all().find((entry) => entry.id === record.id) ?? this.deps.audit.ledger.all().at(-1)!;
    }
    return this.internalAudit.append(record);
  }

  listFrameworks() { return [...this.frameworks.values()].map((v) => ({ ...v, domains: [...v.domains] })); }
  addOwner(owner: ControlOwner) { this.owners.set(owner.id, { ...owner, permissions: [...owner.permissions] }); return this.owner(owner.id); }
  owner(id: string) { const owner = this.owners.get(id); if (!owner) throw new Error(`Unknown owner ${id}`); return { ...owner, permissions: [...owner.permissions] }; }
  can(ownerId: string, permission: ControlOwner['permissions'][number]) { const o = this.owner(ownerId); return o.permissions.includes('platform-super-admin') || o.permissions.includes(permission); }
  addObligation(obligation: ComplianceObligation) { this.obligations.set(obligation.id, { ...obligation, controlIds: [...obligation.controlIds] }); return { ...obligation, controlIds: [...obligation.controlIds] }; }
  addFrameworkMapping(mapping: FrameworkMapping) { this.mappings.set(mapping.id, structuredClone(mapping)); return structuredClone(mapping); }

  createControl(control: Omit<ComplianceControl,'evidenceIds'|'assessmentIds'|'workflowInstanceIds'|'auditRecordIds'|'approvalRequestIds'|'eventIds'|'reviewCadence'|'hisaOperationalOversightCategories'> & { digitalTwinRefs?: string[]; reviewCadence?: ReviewCadence; hisaOperationalOversightCategories?: HisaOperationalOversightCategory[] }, actor = 'compliance-system', now = new Date().toISOString()) {
    if (!this.owners.has(control.ownerId)) throw new Error(`Unknown owner ${control.ownerId}`);
    const full: ComplianceControl = { ...control, frameworkIds: uniqueStrings(control.frameworkIds as ComplianceFrameworkId[]), digitalTwinRefs: [...(control.digitalTwinRefs ?? [])], evidenceIds: [], assessmentIds: [], workflowInstanceIds: [], auditRecordIds: [], approvalRequestIds: [], eventIds: [], reviewCadence: control.reviewCadence ?? this.reviewCadenceForControls([control.id]), hisaOperationalOversightCategories: [...(control.hisaOperationalOversightCategories ?? this.hisaCategoriesForControls([control.id]))] };
    this.controls.set(full.id, full);
    const audit = this.auditControl(full.id, actor, now, 'control.created', full.frameworkIds);
    full.auditRecordIds.push(audit.id);
    this.recordReadinessEvent('compliance.control.created', now, full.frameworkIds, audit.id, full.id);
    void this.publish('compliance.control.created', { controlId: full.id, frameworkIds: full.frameworkIds, status: full.status }, full, audit, now);
    return this.control(full.id);
  }

  updateStatus(controlId: string, status: ControlStatus, actor: string, now = new Date().toISOString()) {
    const c = this.mutableControl(controlId);
    c.status = status;
    c.auditRecordIds.push(this.auditControl(controlId, actor, now, 'control.status.updated', c.frameworkIds).id);
    return this.control(controlId);
  }

  collectEvidence(controlId: string, ownerId: string, input: { id: string; uri: string; description: string; content: unknown }, now = new Date().toISOString()) {
    if (!this.can(ownerId, 'collect-evidence')) throw new Error(`Owner ${ownerId} cannot collect evidence`);
    const c = this.mutableControl(controlId);
    const record = this.auditControl(controlId, ownerId, now, 'evidence.collected', c.frameworkIds, [input.id]);
    const evidence = this.evidenceVault.collect({ id: input.id, recordId: record.id, uri: input.uri, collectedBy: ownerId, collectedAt: now, description: input.description, content: input.content });
    c.evidenceIds.push(evidence.id);
    c.auditRecordIds.push(record.id);
    this.recordReadinessEvent('compliance.evidence.collected', now, c.frameworkIds, record.id, controlId);
    void this.publish('compliance.evidence.collected', { controlId, evidenceIds: [evidence.id], auditRecordId: record.id }, c, record, now);
    return { evidence, auditRecord: record };
  }

  recordComplianceEvidenceIntake(
    ownerId: string,
    input: {
      title: string;
      controlId: string;
      frameworkIds?: ComplianceFrameworkId[];
      policyCitation?: string;
      domain: ComplianceEvidenceDomain;
      evidenceType: ComplianceEvidenceType;
      source: string;
      notes: string;
      reviewStatus: ComplianceEvidenceReviewStatus;
      approvalRequestId?: string;
      auditRecordId?: string;
      linkTargets?: ComplianceEvidenceLinkTarget[];
      retentionPolicy: string;
      retainedUntil?: string;
      legalHold?: boolean;
      uri?: string;
      evidenceRefs?: string[];
      startReviewWorkflow?: boolean;
      reason: string;
      entryMode: 'quick' | 'full';
    },
    now = new Date().toISOString(),
  ) {
    const resolvedOwnerId = this.resolveOwnerId(ownerId);
    if (!this.can(resolvedOwnerId, 'collect-evidence')) throw new Error(`Owner ${resolvedOwnerId} cannot collect evidence`);
    const control = this.mutableControl(input.controlId);
    const frameworkIds = uniqueStrings([...(input.frameworkIds ?? []), ...control.frameworkIds]) as ComplianceFrameworkId[];
    const evidenceId = `evidence-${this.evidenceRecords.size + 1}`;
    const uri = input.uri ?? input.evidenceRefs?.[0] ?? `evidence://compliance/${evidenceId}`;
    const linkTargets = [...(input.linkTargets ?? [])];
    if (!linkTargets.some((target) => target.targetKind === 'control' && target.targetId === input.controlId)) {
      linkTargets.unshift({ targetKind: 'control', targetId: input.controlId, label: control.title });
    }

    const collected = this.collectEvidence(input.controlId, resolvedOwnerId, {
      id: evidenceId,
      uri,
      description: input.title,
      content: {
        title: input.title,
        domain: input.domain,
        evidenceType: input.evidenceType,
        source: input.source,
        notes: input.notes,
        reviewStatus: input.reviewStatus,
        policyCitation: input.policyCitation,
        linkTargets,
        retentionPolicy: input.retentionPolicy,
        retainedUntil: input.retainedUntil,
        legalHold: input.legalHold ?? false,
        evidenceRefs: input.evidenceRefs ?? [],
        reason: input.reason,
        entryMode: input.entryMode,
      },
    }, now);

    let auditRecordId = collected.auditRecord.id;
    if (input.auditRecordId) {
      auditRecordId = input.auditRecordId;
      if (!control.auditRecordIds.includes(auditRecordId)) control.auditRecordIds.push(auditRecordId);
    }

    if (input.approvalRequestId && !control.approvalRequestIds.includes(input.approvalRequestId)) {
      control.approvalRequestIds.push(input.approvalRequestId);
    }

    const mappedSource = this.mapLinkTargetToSource(linkTargets[0] ?? { targetKind: 'control', targetId: input.controlId });
    const workflowInstanceIds: string[] = [];
    const approvalRequestIds = input.approvalRequestId ? [input.approvalRequestId] : [];
    const auditRecordIds = uniqueStrings([auditRecordId, ...linkTargets.filter((target) => target.targetKind === 'audit').map((target) => target.targetId)]);
    const eventIds = linkTargets.filter((target) => target.targetKind === 'incident').map((target) => target.targetId);

    let workflowInstanceId: string | undefined;
    if (input.startReviewWorkflow || input.reviewStatus === 'pending-review' || input.reviewStatus === 'submitted') {
      const workflow = this.startEvidenceWorkflow(input.controlId, resolvedOwnerId, now);
      workflowInstanceId = workflow.id;
      workflowInstanceIds.push(workflow.id);
    }

    for (const target of linkTargets) {
      if (target.targetKind === 'approval' && !approvalRequestIds.includes(target.targetId)) approvalRequestIds.push(target.targetId);
      if (target.targetKind === 'regulatory-workflow') workflowInstanceIds.push(target.targetId);
      if (target.targetKind === 'control' && target.targetId !== input.controlId && this.controls.has(target.targetId)) {
        const linkedControl = this.mutableControl(target.targetId);
        linkedControl.evidenceIds.push(evidenceId);
        linkedControl.auditRecordIds.push(auditRecordId);
      }
    }

    const evidencePackage = this.createEvidencePackage({
      id: `pkg-${evidenceId}`,
      title: input.title,
      source: mappedSource,
      controlIds: uniqueStrings([input.controlId, ...linkTargets.filter((target) => target.targetKind === 'control').map((target) => target.targetId)]),
      evidenceIds: [evidenceId],
      auditRecordIds,
      workflowInstanceIds,
      approvalRequestIds,
      digitalTwinRefs: linkTargets.filter((target) => target.targetKind === 'kpi-definition').map((target) => `kpi:${target.targetId}`),
      eventIds,
      frameworkIds,
      readiness: input.reviewStatus === 'approved' ? 'evidence-package-ready' : 'review',
      sealed: input.reviewStatus === 'approved',
    });

    const record: ComplianceEvidenceRecord = {
      id: evidenceId,
      title: input.title,
      controlId: input.controlId,
      frameworkIds,
      policyCitation: input.policyCitation,
      domain: input.domain,
      evidenceType: input.evidenceType,
      source: input.source,
      notes: input.notes,
      reviewStatus: input.reviewStatus,
      approvalRequestId: input.approvalRequestId,
      auditRecordId,
      evidenceVaultId: collected.evidence.id,
      uri,
      linkTargets,
      retention: {
        retentionPolicy: input.retentionPolicy,
        retainedUntil: input.retainedUntil,
        legalHold: input.legalHold ?? false,
      },
      collectedBy: resolvedOwnerId,
      collectedAt: now,
      workflowInstanceId,
      evidencePackageId: evidencePackage.id,
    };
    this.evidenceRecords.set(record.id, record);

    if (input.legalHold) {
      this.evidenceVault.placeLegalHold([collected.evidence.id], resolvedOwnerId, input.reason);
    }

    return {
      accepted: true,
      evidenceId: record.id,
      evidenceVaultId: collected.evidence.id,
      auditId: auditRecordId,
      auditRecordId,
      evidencePackageId: evidencePackage.id,
      workflowInstanceId,
      approvalRequestId: input.approvalRequestId,
      reviewStatus: input.reviewStatus,
      linkTargets,
      message: `Compliance evidence "${input.title}" recorded with ${linkTargets.length} link target(s) and audit linkage.`,
    };
  }

  listEvidenceRecords(): ComplianceEvidenceRecord[] {
    return [...this.evidenceRecords.values()].map((record) => structuredClone(record));
  }

  patchEvidenceMetadata(
    evidenceId: string,
    patch: Partial<Pick<ComplianceEvidenceRecord, 'reviewStatus' | 'notes'>>,
    actor: string,
    reason = 'Compliance evidence metadata patched',
    now = new Date().toISOString(),
  ): { evidenceId: string; auditId: string; patchedFields: string[]; message: string } {
    const record = this.evidenceRecords.get(evidenceId);
    if (!record) throw new Error(`Unknown evidence record ${evidenceId}`);

    const patchedFields: string[] = [];
    const previous: Record<string, unknown> = {};

    if (patch.reviewStatus !== undefined) {
      if (patch.reviewStatus === 'approved' || patch.reviewStatus === 'rejected') {
        throw new Error(`Review status "${patch.reviewStatus}" requires approval workflow`);
      }
      previous.reviewStatus = record.reviewStatus;
      record.reviewStatus = patch.reviewStatus;
      patchedFields.push('reviewStatus');
    }
    if (patch.notes !== undefined) {
      previous.notes = record.notes;
      record.notes = patch.notes;
      patchedFields.push('notes');
    }
    if (patchedFields.length === 0) throw new Error('No metadata fields to patch');

    const auditId = `audit-evidence-patch-${this.audit.all().length + 1}`;
    this.appendComplianceAudit({
      id: auditId,
      type: 'user-action',
      actor,
      timestamp: now,
      action: 'compliance.evidence.metadata-patched',
      reason,
      actionClass: 'api',
      subjectId: evidenceId,
      tenantId: this.tenantId,
      racetrackId: 'main-track',
      severity: 'info',
      payload: { evidenceId, patchedFields, previous },
      regulations: ['TrackPolicy'],
      evidenceIds: [evidenceId],
    });
    record.auditRecordId = auditId;

    return {
      evidenceId,
      auditId,
      patchedFields,
      message: `Evidence ${evidenceId} metadata updated (${patchedFields.join(', ')}).`,
    };
  }

  private mapLinkTargetToSource(target: ComplianceEvidenceLinkTarget): EvidenceSourceReference {
    switch (target.targetKind) {
      case 'approval':
        return { objectType: 'approval', objectId: target.targetId };
      case 'audit':
        return { objectType: 'audit-record', objectId: target.targetId };
      case 'incident':
        return { objectType: 'event', objectId: target.targetId };
      case 'kpi-definition':
        return { objectType: 'kpi-definition', objectId: target.targetId };
      case 'regulatory-workflow':
        return { objectType: 'workflow', objectId: target.targetId, workflowInstanceId: target.targetId };
      case 'control':
      default:
        return { objectType: 'control', objectId: target.targetId, controlId: target.targetId };
    }
  }

  startEvidenceWorkflow(controlId: string, actor: string, now = new Date().toISOString()): WorkflowInstance {
    const c = this.mutableControl(controlId);
    const wf = this.workflows.start('compliance-evidence-review', { tenantId: this.tenantId, priority: 'normal', digitalTwinRefs: [`compliance:control:${controlId}`], payload: { controlId, evidenceIds: c.evidenceIds } }, actor, now);
    c.workflowInstanceIds.push(wf.id);
    return wf;
  }

  startAccreditationWorkflow(programId: string, actor: string, now = new Date().toISOString()): WorkflowInstance {
    const program = this.accreditationPrograms.get(programId);
    if (!program) throw new Error(`Unknown accreditation program ${programId}`);
    return this.workflows.start('accreditation-readiness-review', { tenantId: this.tenantId, priority: 'high', digitalTwinRefs: [`compliance:accreditation:${programId}`], payload: { programId, frameworkIds: program.frameworkIds, evidencePackageIds: program.evidencePackageIds } }, actor, now);
  }

  assess(controlId: string, ownerId: string, rating: AssessmentRating, notes: string, now = new Date().toISOString()) {
    if (!this.can(ownerId, 'assess')) throw new Error(`Owner ${ownerId} cannot assess controls`);
    const c = this.mutableControl(controlId);
    const assessment: ControlAssessment = { id: `assessment-${this.assessments.size + 1}`, controlId, assessedBy: ownerId, assessedAt: now, rating, notes, evidenceIds: [...c.evidenceIds], findingIds: [] };
    this.assessments.set(assessment.id, assessment);
    c.assessmentIds.push(assessment.id);
    c.status = rating === 'effective' ? 'effective' : 'deficient';
    const audit = this.auditControl(controlId, ownerId, now, 'control.assessed', c.frameworkIds, c.evidenceIds);
    c.auditRecordIds.push(audit.id);
    this.recordReadinessEvent('compliance.assessment.completed', now, c.frameworkIds, audit.id, controlId);
    void this.publish('compliance.assessment.completed', { controlId, assessmentId: assessment.id, rating }, c, audit, now);
    return { ...assessment, evidenceIds: [...assessment.evidenceIds], findingIds: [...assessment.findingIds] };
  }

  openFinding(controlId: string, severity: FindingSeverity, summary: string, actor = 'compliance-system', now = new Date().toISOString()) {
    const c = this.mutableControl(controlId);
    const audit = this.auditControl(controlId, actor, now, 'finding.opened', c.frameworkIds, c.evidenceIds);
    const finding: ComplianceFinding = { id: `finding-${this.findings.size + 1}`, controlId, severity, summary, status: 'open', correctiveActionIds: [], evidenceIds: [...c.evidenceIds], auditRecordIds: [audit.id] };
    this.findings.set(finding.id, finding);
    c.auditRecordIds.push(audit.id);
    const latestAssessmentId = c.assessmentIds.at(-1);
    if (latestAssessmentId) this.assessments.get(latestAssessmentId)?.findingIds.push(finding.id);
    this.recordReadinessEvent('compliance.finding.opened', now, c.frameworkIds, audit.id, controlId);
    void this.publish('compliance.finding.opened', { findingId: finding.id, controlId, severity }, c, audit, now);
    return structuredClone(finding);
  }

  createCorrectiveAction(findingId: string, ownerId: string, action: string, dueAt: string, options: { startWorkflow?: boolean; approvalRequestId?: string; now?: string } = {}) {
    const finding = this.findings.get(findingId);
    if (!finding) throw new Error(`Unknown finding ${findingId}`);
    const now = options.now ?? new Date().toISOString();
    const c = this.mutableControl(finding.controlId);
    const audit = this.auditControl(finding.controlId, ownerId, now, 'corrective-action.created', c.frameworkIds, finding.evidenceIds);
    const ca: CorrectiveAction = { id: `ca-${this.actions.size + 1}`, findingId, ownerId, action, dueAt, status: 'open', approvalRequestId: options.approvalRequestId, auditRecordIds: [audit.id] };
    if (options.startWorkflow) {
      const wf = this.workflows.start('compliance-corrective-action', { tenantId: this.tenantId, priority: severityPriority(finding.severity), digitalTwinRefs: [`compliance:finding:${finding.id}`, `compliance:control:${finding.controlId}`], payload: { findingId, correctiveActionId: ca.id, dueAt } }, ownerId, now);
      ca.workflowInstanceId = wf.id;
      c.workflowInstanceIds.push(wf.id);
    }
    if (options.approvalRequestId) c.approvalRequestIds.push(options.approvalRequestId);
    this.actions.set(ca.id, ca);
    finding.correctiveActionIds.push(ca.id);
    c.auditRecordIds.push(audit.id);
    this.recordReadinessEvent('compliance.corrective-action.created', now, c.frameworkIds, audit.id, finding.controlId, ca.workflowInstanceId, options.approvalRequestId);
    void this.publish('compliance.corrective-action.created', { correctiveActionId: ca.id, findingId, ownerId, dueAt }, c, audit, now, ca.workflowInstanceId, options.approvalRequestId);
    return structuredClone(ca);
  }

  listCorrectiveActions(findingId?: string) {
    this.syncOverdueCorrectiveActions();
    return [...this.actions.values()]
      .filter((action) => !findingId || action.findingId === findingId)
      .map((action) => structuredClone(action));
  }

  getCorrectiveAction(id: string) {
    this.syncOverdueCorrectiveActions();
    const action = this.actions.get(id);
    if (!action) throw new Error(`Unknown corrective action ${id}`);
    return structuredClone(action);
  }

  closeCorrectiveAction(id: string, actor: string, now = new Date().toISOString()) {
    return this.updateCorrectiveAction(id, { status: 'done' }, actor, now);
  }

  updateCorrectiveAction(id: string, patch: Partial<Pick<CorrectiveAction, 'ownerId' | 'action' | 'dueAt' | 'status' | 'approvalRequestId'>>, actor: string, now = new Date().toISOString()) {
    const existing = this.actions.get(id);
    if (!existing) throw new Error(`Unknown corrective action ${id}`);
    if (patch.ownerId && !this.owners.has(patch.ownerId)) throw new Error(`Unknown owner ${patch.ownerId}`);
    const finding = this.findings.get(existing.findingId);
    if (!finding) throw new Error(`Unknown finding ${existing.findingId}`);
    const c = this.mutableControl(finding.controlId);
    const audit = this.auditControl(finding.controlId, actor, now, 'corrective-action.updated', c.frameworkIds, finding.evidenceIds);
    const updated: CorrectiveAction = {
      ...existing,
      ...patch,
      status: patch.status ?? existing.status,
      auditRecordIds: [...existing.auditRecordIds, audit.id],
    };
    if (patch.approvalRequestId) c.approvalRequestIds.push(patch.approvalRequestId);
    this.actions.set(id, updated);
    c.auditRecordIds.push(audit.id);
    if (updated.status === 'done') finding.status = 'remediated';
    this.recordReadinessEvent('compliance.corrective-action.updated', now, c.frameworkIds, audit.id, finding.controlId, updated.workflowInstanceId, updated.approvalRequestId);
    void this.publish('compliance.corrective-action.updated', { correctiveActionId: id, findingId: existing.findingId, status: updated.status, ownerId: updated.ownerId }, c, audit, now, updated.workflowInstanceId, updated.approvalRequestId);
    return structuredClone(updated);
  }

  deleteCorrectiveAction(id: string, actor: string, now = new Date().toISOString()) {
    const existing = this.actions.get(id);
    if (!existing) throw new Error(`Unknown corrective action ${id}`);
    const finding = this.findings.get(existing.findingId);
    if (!finding) throw new Error(`Unknown finding ${existing.findingId}`);
    const c = this.mutableControl(finding.controlId);
    const audit = this.auditControl(finding.controlId, actor, now, 'corrective-action.deleted', c.frameworkIds, finding.evidenceIds);
    finding.correctiveActionIds = finding.correctiveActionIds.filter((actionId) => actionId !== id);
    c.auditRecordIds.push(audit.id);
    this.actions.delete(id);
    this.recordReadinessEvent('compliance.corrective-action.deleted', now, c.frameworkIds, audit.id, finding.controlId, existing.workflowInstanceId, existing.approvalRequestId);
    void this.publish('compliance.corrective-action.deleted', { correctiveActionId: id, findingId: existing.findingId }, c, audit, now, existing.workflowInstanceId, existing.approvalRequestId);
    return { deleted: true, id, auditRecordId: audit.id };
  }

  policyRegistry(): CompliancePolicyRegistryEntry[] {
    const entries = new Map<string, CompliancePolicyRegistryEntry>();
    for (const obligation of this.obligations.values()) {
      const mapping = [...this.mappings.values()].find((item) => item.frameworkId === obligation.frameworkId && item.controlIds.some((controlId) => obligation.controlIds.includes(controlId)));
      entries.set(obligation.id, {
        id: obligation.id,
        frameworkId: obligation.frameworkId,
        citation: obligation.citation,
        summary: obligation.summary,
        controlIds: [...obligation.controlIds],
        dueCadence: obligation.dueCadence,
        jurisdiction: obligation.jurisdiction,
        mappedFrameworks: mapping?.mappedTo.map((target) => ({ ...target })) ?? [],
        racingCommissionRule: mapping?.racingCommissionRule,
      });
    }
    for (const mapping of this.mappings.values()) {
      if (entries.has(mapping.id)) continue;
      entries.set(mapping.id, {
        id: mapping.id,
        frameworkId: mapping.frameworkId,
        citation: mapping.citation,
        summary: `${mapping.frameworkId} framework mapping`,
        controlIds: [...mapping.controlIds],
        dueCadence: this.reviewCadenceForControls(mapping.controlIds),
        mappedFrameworks: mapping.mappedTo.map((target) => ({ ...target })),
        racingCommissionRule: mapping.racingCommissionRule,
      });
    }
    return [...entries.values()];
  }

  generateEvidencePacket(input: {
    id: string;
    title: string;
    controlIds: string[];
    sealed?: boolean;
    actor?: string;
    racetrackId?: string;
    frameworkIds?: ComplianceFrameworkId[];
    approvalRequestIds?: string[];
    now?: string;
  }) {
    const controls = input.controlIds.map((controlId) => this.control(controlId));
    const evidenceIds = controls.flatMap((control) => control.evidenceIds);
    const auditRecordIds = controls.flatMap((control) => control.auditRecordIds);
    const workflowInstanceIds = controls.flatMap((control) => control.workflowInstanceIds);
    const digitalTwinRefs = controls.flatMap((control) => control.digitalTwinRefs);
    const eventIds = controls.flatMap((control) => control.eventIds);
    const frameworkIds = uniqueStrings([...(input.frameworkIds ?? []), ...controls.flatMap((control) => control.frameworkIds)]) as ComplianceFrameworkId[];
    const readiness = this.readiness(input.controlIds);
    return this.createEvidencePackage({
      id: input.id,
      evidenceId: `evpkg-${input.id}`,
      title: input.title,
      tenantId: this.tenantId,
      racetrackId: input.racetrackId ?? this.tenantId,
      source: { objectType: 'control', objectId: input.controlIds[0] ?? input.id, controlId: input.controlIds[0] },
      controlIds: input.controlIds,
      evidenceIds,
      auditRecordIds,
      workflowInstanceIds,
      approvalRequestIds: input.approvalRequestIds ?? [],
      digitalTwinRefs,
      eventIds,
      frameworkIds,
      controlOwnerId: controls[0]?.ownerId ?? 'owner-compliance',
      reviewCadence: this.reviewCadenceForControls(input.controlIds),
      hisaOperationalOversightCategories: this.hisaCategoriesForControls(input.controlIds),
      accreditationReadiness: {
        status: input.sealed ? 'ready-for-review' : 'internal-review',
        score: readiness.score,
        readinessOnly: true,
        externalCertificationClaimed: false,
        notes: 'Generated evidence packet for internal review; no external certification is claimed.',
      },
      sealed: input.sealed ?? false,
      readiness: input.sealed ? 'evidence-package-ready' : 'review',
    });
  }

  createReviewCycle(cycle: Omit<ReviewCycle,'readinessScore'>) {
    const full = { ...cycle, controlIds: [...cycle.controlIds], readinessScore: this.readiness(cycle.controlIds).score };
    this.cycles.set(full.id, full);
    return structuredClone(full);
  }

  createEvidencePackage(pkg: Omit<EvidencePackage,'evidenceId'|'tenantId'|'racetrackId'|'source'|'auditRefs'|'eventRefs'|'aiRecommendationRefs'|'frameworkIds'|'frameworkMappings'|'controlOwnerId'|'reviewCadence'|'hisaOperationalOversightCategories'|'accreditationReadiness'|'sealed'|'readiness'> & Partial<Pick<EvidencePackage,'evidenceId'|'tenantId'|'racetrackId'|'source'|'auditRefs'|'eventRefs'|'aiRecommendationRefs'|'frameworkIds'|'frameworkMappings'|'controlOwnerId'|'reviewCadence'|'hisaOperationalOversightCategories'|'accreditationReadiness'|'sealed'|'readiness'>>) {
    const controlIds = [...pkg.controlIds];
    const frameworkIds = uniqueStrings([...(pkg.frameworkIds ?? []), ...controlIds.flatMap((controlId) => this.controls.get(controlId)?.frameworkIds ?? [])]) as ComplianceFrameworkId[];
    const source = pkg.source ?? { objectType: 'control' as const, objectId: controlIds[0] ?? pkg.id, controlId: controlIds[0] };
    const full: EvidencePackage = {
      ...pkg,
      evidenceId: pkg.evidenceId ?? pkg.id,
      tenantId: pkg.tenantId ?? this.tenantId,
      racetrackId: pkg.racetrackId ?? this.tenantId,
      source,
      controlIds,
      evidenceIds: [...pkg.evidenceIds],
      auditRecordIds: [...pkg.auditRecordIds],
      auditRefs: [...(pkg.auditRefs ?? pkg.auditRecordIds)],
      workflowInstanceIds: [...pkg.workflowInstanceIds],
      approvalRequestIds: [...pkg.approvalRequestIds],
      digitalTwinRefs: [...pkg.digitalTwinRefs],
      eventIds: [...pkg.eventIds],
      eventRefs: [...(pkg.eventRefs ?? pkg.eventIds)],
      aiRecommendationRefs: [...(pkg.aiRecommendationRefs ?? [])],
      frameworkIds,
      frameworkMappings: (pkg.frameworkMappings ?? this.evidenceFrameworkMappings(controlIds, frameworkIds)).map((mapping) => ({ ...mapping, controlIds: [...mapping.controlIds] })),
      controlOwnerId: pkg.controlOwnerId ?? this.controls.get(controlIds[0])?.ownerId ?? 'owner-compliance',
      reviewCadence: pkg.reviewCadence ?? this.reviewCadenceForControls(controlIds),
      hisaOperationalOversightCategories: [...(pkg.hisaOperationalOversightCategories ?? this.hisaCategoriesForControls(controlIds))],
      accreditationReadiness: pkg.accreditationReadiness ?? { status: pkg.readiness === 'evidence-package-ready' ? 'ready-for-review' : 'internal-review', score: this.readiness(controlIds).score, readinessOnly: true, externalCertificationClaimed: false, notes: 'Readiness and evidence packaging only; no external certification is claimed.' },
      sealed: pkg.sealed ?? false,
      readiness: pkg.readiness ?? 'collecting',
    };
    this.evidencePackages.set(full.id, full);
    return structuredClone(full);
  }

  createAccreditationProgram(program: Omit<AccreditationProgram,'readinessScore'|'readinessOnly'|'externalCertificationClaimed'> & { readinessScore?: number; readinessOnly?: true; externalCertificationClaimed?: false }) {
    const readinessScore = program.readinessScore ?? this.readiness(program.requiredControlIds).score;
    const full = { ...program, frameworkIds: [...program.frameworkIds], requiredControlIds: [...program.requiredControlIds], evidencePackageIds: [...program.evidencePackageIds], readinessScore, readinessOnly: true as const, externalCertificationClaimed: false as const };
    this.accreditationPrograms.set(full.id, full);
    const audit = this.appendComplianceAudit({ id: `audit-accreditation-${this.audit.all().length + 1}`, type: 'regulatory-activity', actor: 'compliance-system', timestamp: new Date().toISOString(), subjectId: full.id, tenantId: this.tenantId, severity: readinessScore >= 85 ? 'info' : 'warning', regulations: full.frameworkIds, action: 'accreditation.readiness.updated', actionClass: 'compliance', payload: { action: 'accreditation.readiness.updated', programId: full.id, readinessScore } });
    this.recordReadinessEvent('compliance.accreditation.readiness.updated', audit.timestamp, full.frameworkIds, audit.id);
    void this.publish('compliance.accreditation.readiness.updated', { programId: full.id, frameworkIds: full.frameworkIds, readinessScore }, undefined, audit, audit.timestamp);
    return structuredClone(full);
  }

  readiness(controlIds = [...this.controls.keys()]): AuditReadinessScore {
    const controls = controlIds.map((id) => this.mutableControl(id));
    const total = controls.length || 1;
    const effective = controls.filter((c) => c.status === 'effective').length;
    const evidence = controls.filter((c) => c.evidenceIds.length > 0).length;
    const open = [...this.findings.values()].filter((f) => controlIds.includes(f.controlId) && f.status === 'open').length;
    const overdue = [...this.actions.values()].filter((a) => a.status === 'overdue').length;
    const score = Math.max(0, Math.round((effective / total * 55) + (evidence / total * 35) - open * 7 - overdue * 5));
    return {
      score,
      totalControls: controls.length,
      effectiveControls: effective,
      evidenceCoverage: Math.round(evidence / total * 100),
      openFindings: open,
      overdueActions: overdue,
      byFramework: this.listFrameworks().map((f) => {
        const fc = controls.filter((c) => c.frameworkIds.includes(f.id));
        return { frameworkId: f.id, controls: fc.length, score: fc.length ? Math.round(fc.filter((c) => c.status === 'effective').length / fc.length * 100) : 0 };
      }),
    };
  }

  dashboard() {
    return {
      frameworks: this.listFrameworks(),
      controls: [...this.controls.values()].map((c) => this.control(c.id)),
      obligations: [...this.obligations.values()].map((item) => structuredClone(item)),
      owners: [...this.owners.values()].map((item) => structuredClone(item)),
      assessments: [...this.assessments.values()].map((item) => structuredClone(item)),
      findings: [...this.findings.values()].map((item) => structuredClone(item)),
      correctiveActions: [...this.actions.values()].map((item) => structuredClone(item)),
      reviewCycles: [...this.cycles.values()].map((item) => structuredClone(item)),
      frameworkMappings: [...this.mappings.values()].map((item) => structuredClone(item)),
      evidencePackages: [...this.evidencePackages.values()].map((item) => structuredClone(item)),
      evidenceRecords: this.listEvidenceRecords(),
      accreditationPrograms: [...this.accreditationPrograms.values()].map((item) => structuredClone(item)),
      auditReadinessEvents: this.auditReadinessEvents.map((item) => structuredClone(item)),
      integrations: { audit: true, workflow: true, approvals: true, events: Boolean(this.deps.eventBus) || this.auditReadinessEvents.length > 0, apiFacade: true, commandCenter: true, digitalTwin: true },
      readiness: this.readiness(),
    };
  }

  control(id: string) {
    const c = this.mutableControl(id);
    return { ...c, frameworkIds: [...c.frameworkIds], obligationIds: [...c.obligationIds], evidenceIds: [...c.evidenceIds], assessmentIds: [...c.assessmentIds], workflowInstanceIds: [...c.workflowInstanceIds], auditRecordIds: [...c.auditRecordIds], digitalTwinRefs: [...c.digitalTwinRefs], approvalRequestIds: [...c.approvalRequestIds], eventIds: [...c.eventIds], hisaOperationalOversightCategories: [...c.hisaOperationalOversightCategories] };
  }

  private mutableControl(id: string) { const c = this.controls.get(id); if (!c) throw new Error(`Unknown control ${id}`); return c; }
  private resolveOwnerId(actorId: string): string {
    if (this.owners.has(actorId) && this.can(actorId, 'collect-evidence')) return actorId;
    const fallback = [...this.owners.values()].find((owner) => owner.permissions.includes('collect-evidence'));
    if (fallback) return fallback.id;
    throw new Error(`Unknown owner ${actorId}`);
  }
  private syncOverdueCorrectiveActions(now = new Date().toISOString()) {
    const dueMs = Date.parse(now);
    for (const action of this.actions.values()) {
      if ((action.status === 'open' || action.status === 'in-progress') && Date.parse(action.dueAt) < dueMs) action.status = 'overdue';
    }
  }
  private auditControl(controlId: string, actor: string, timestamp: string, action: string, regulations: string[], evidenceIds: string[] = []): AuditLogEntry {
    return this.appendComplianceAudit({
      id: `audit-compliance-${this.audit.all().length + 1}`,
      type: 'regulatory-activity',
      actor,
      timestamp,
      subjectId: controlId,
      tenantId: this.tenantId,
      severity: 'info',
      regulations,
      evidenceIds,
      action,
      actionClass: 'compliance',
      payload: { action, controlId },
    });
  }
  private recordReadinessEvent(type: ComplianceAuditEvent['type'], occurredAt: string, frameworkIds: ComplianceFrameworkId[], auditRecordId: string, controlId?: string, workflowInstanceId?: string, approvalRequestId?: string) { const eventId = `compliance-event-${this.auditReadinessEvents.length + 1}`; this.auditReadinessEvents.push({ eventId, eventType: `${type}.v1` as CanonicalEventRef['eventType'], tenantId: this.tenantId, racetrackId: 'main-track', actorId: 'compliance-control-library', source: 'compliance-control-library', timestamp: occurredAt, version: 1, id: eventId, type, occurredAt, frameworkIds: [...frameworkIds], controlId, auditRecordId, workflowInstanceId, approvalRequestId }); }
  private reviewCadenceForControls(controlIds: string[]): ReviewCadence {
    const cadences = controlIds.flatMap((controlId) => [...this.obligations.values()].filter((obligation) => obligation.controlIds.includes(controlId)).map((obligation) => obligation.dueCadence));
    if (cadences.includes('continuous')) return 'continuous';
    return cadences[0] ?? 'quarterly';
  }
  private hisaCategoriesForControls(controlIds: string[]): HisaOperationalOversightCategory[] {
    const text = controlIds.map((controlId) => `${controlId} ${this.controls.get(controlId)?.title ?? ''} ${this.controls.get(controlId)?.description ?? ''}`).join(' ').toLowerCase();
    const categories = new Set<HisaOperationalOversightCategory>();
    if (/race-office|office|commission|filing|rulebook|steward/.test(text)) categories.add('racing-office-operations');
    if (/maintenance|facility|facilities|surface|track|gate/.test(text)) categories.add('maintenance-facilities');
    if (/safety|integrity|equine|veterinary|emergency|risk/.test(text)) categories.add('safety');
    if (/accreditation|evidence|audit|governance|management|compliance/.test(text)) categories.add('accreditation');
    categories.add('racetrack-management');
    return categories.size ? [...categories] : [...hisaOperationalOversightCategories];
  }
  private evidenceFrameworkMappings(controlIds: string[], frameworkIds: ComplianceFrameworkId[]): EvidenceFrameworkMapping[] {
    return frameworkIds.map((frameworkId) => {
      const obligation = [...this.obligations.values()].find((item) => item.frameworkId === frameworkId && item.controlIds.some((controlId) => controlIds.includes(controlId)));
      const mapping = [...this.mappings.values()].find((item) => item.frameworkId === frameworkId && item.controlIds.some((controlId) => controlIds.includes(controlId)));
      return {
        frameworkId,
        citation: obligation?.citation ?? mapping?.citation ?? this.frameworks.get(frameworkId)?.name ?? frameworkId,
        controlIds: uniqueStrings([...(obligation?.controlIds ?? []), ...(mapping?.controlIds ?? []), ...controlIds]),
        relationship: mapping ? 'supports' : 'primary',
        evidenceUse: 'reusable',
      };
    });
  }
  private async publish(type: ComplianceAuditEvent['type'], payload: Record<string, unknown>, control: ComplianceControl | undefined, audit: AuditLogEntry, occurredAt: string, workflowInstanceId?: string, approvalRequestId?: string) {
    const eventType = `${type}.v1` as CanonicalEventRef['eventType'];
    const event = await this.deps.eventBus?.publish({ type: eventType, payload: { ...payload, tenantId: this.tenantId, racetrackId: 'main-track' }, tenantId: this.tenantId, racetrackId: 'main-track', actor: { id: 'compliance-control-library', type: 'service' }, subject: { id: control?.id ?? audit.subjectId ?? audit.id, type: 'compliance-control', tenantId: this.tenantId }, evidence: [audit.id], auditRef: audit.id, occurredAt, producer: 'compliance-control-library', aggregateId: control?.id ?? audit.subjectId, correlationId: audit.correlationId ?? audit.id, metadata: { compliance: 'regulated', team: 'governance-risk-compliance', accountableRole: 'compliance-officer', auditRecordId: audit.id } });
    if (event && control) {
      control.eventIds.push(event.eventId);
      const readinessEvent = this.auditReadinessEvents.at(-1);
      if (readinessEvent) readinessEvent.eventId = event.eventId;
    }
    if (workflowInstanceId) {
      const readinessEvent = this.auditReadinessEvents.at(-1);
      if (readinessEvent) readinessEvent.workflowInstanceId = workflowInstanceId;
    }
    if (approvalRequestId) {
      const readinessEvent = this.auditReadinessEvents.at(-1);
      if (readinessEvent) readinessEvent.approvalRequestId = approvalRequestId;
    }
  }
}

export function complianceEvidenceWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'compliance-evidence-review', name: 'Compliance evidence collection and review', domain: 'compliance', version: '1.0.0', bpmnProcessId: 'Process_ComplianceEvidenceReview', startStepId: 'collect', ownerRole: 'compliance-officer', tenantId, triggerEvents: ['compliance.evidence.collected'], steps: [
    { id: 'collect', name: 'Collect evidence', type: 'userTask', role: 'compliance-officer', next: ['review'], digitalTwin: { refs: ['compliance-control'], syncMode: 'read' }, sla: { minutes: 1440, escalationRole: 'compliance-director', severity: 'warning' } },
    { id: 'review', name: 'Owner review', type: 'approvalTask', approvalRoles: ['compliance-officer'], requiredApprovals: 1, next: ['ready'], digitalTwin: { refs: ['audit-records'], syncMode: 'read', statePatch: { internalReviewReady: true } }, sla: { minutes: 720, escalationRole: 'compliance-director', severity: 'breach' } },
    { id: 'ready', name: 'Internal-review evidence package', type: 'endEvent' },
  ] };
}

export function complianceCorrectiveActionWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'compliance-corrective-action', name: 'Compliance corrective action and approval', domain: 'compliance', version: '1.0.0', bpmnProcessId: 'Process_ComplianceCorrectiveAction', startStepId: 'triage', ownerRole: 'compliance-officer', tenantId, triggerEvents: ['compliance.finding.opened'], steps: [
    { id: 'triage', name: 'Triage finding and assign action-owner metadata', type: 'userTask', role: 'compliance-officer', sla: { minutes: 240, escalationRole: 'compliance-director', severity: 'breach' }, next: ['remediate'], digitalTwin: { refs: ['compliance-finding'], syncMode: 'read', statePatch: { findingTriaged: true } } },
    { id: 'remediate', name: 'Complete corrective action evidence', type: 'userTask', role: 'control-owner', sla: { minutes: 4320, escalationRole: 'compliance-officer', severity: 'warning' }, next: ['approve'] },
    { id: 'approve', name: 'Approve corrective action closure metadata', type: 'approvalTask', approvalRoles: ['compliance-officer'], requiredApprovals: 1, next: ['closed'], digitalTwin: { refs: ['compliance-control','audit-records'], syncMode: 'read', statePatch: { remediationApproved: true } } },
    { id: 'closed', name: 'Corrective action closed', type: 'endEvent' },
  ] };
}

export function accreditationReadinessWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'accreditation-readiness-review', name: 'Internal accreditation readiness review', domain: 'compliance', version: '1.0.0', bpmnProcessId: 'Process_AccreditationReadinessReview', startStepId: 'scope', ownerRole: 'compliance-officer', tenantId, triggerEvents: ['compliance.accreditation.readiness.updated'], steps: [
    { id: 'scope', name: 'Scope internal filing-package requirements', type: 'userTask', role: 'compliance-officer', sla: { minutes: 1440, escalationRole: 'compliance-director', severity: 'warning' }, next: ['evidence-package'] },
    { id: 'evidence-package', name: 'Verify sealed evidence packages', type: 'userTask', role: 'read-only-auditor', sla: { minutes: 2880, escalationRole: 'compliance-officer', severity: 'warning' }, next: ['filing-approval'], digitalTwin: { refs: ['compliance-accreditation'], syncMode: 'read' } },
    { id: 'filing-approval', name: 'Approve internal filing package review', type: 'approvalTask', approvalRoles: ['compliance-officer'], requiredApprovals: 1, sla: { minutes: 720, escalationRole: 'compliance-director', severity: 'critical' }, next: ['ready'], digitalTwin: { refs: ['approval','audit-records'], syncMode: 'read', statePatch: { internalFilingReviewReady: true } } },
    { id: 'ready', name: 'Evidence package prepared for human review', type: 'endEvent' },
  ] };
}

export function registerComplianceEventContracts(bus: UniversalEventBus): void { for (const contract of complianceEventContracts) bus.registerEvent(contract); }

export function seededComplianceLibrary(tenantId = 'track-1', options: { audit?: AuditAppendTarget } = {}) {
  const lib = new ComplianceControlLibrary(tenantId, options);
  lib.addOwner({ id: 'owner-compliance', displayName: 'Compliance Officer', role: 'compliance-officer', permissions: ['read','collect-evidence','assess','approve-action'] });
  lib.addOwner({ id: 'owner-auditor', displayName: 'Read-only Auditor', role: 'read-only-auditor', permissions: ['read'] });
  lib.addOwner({ id: 'owner-security', displayName: 'Security Control Owner', role: 'security-manager', permissions: ['read','collect-evidence','assess'] });
  lib.addOwner({ id: 'owner-track', displayName: 'Track Superintendent', role: 'facilities-manager', permissions: ['read','collect-evidence','assess'] });
  lib.addOwner({ id: 'owner-finance', displayName: 'Finance Control Owner', role: 'finance-manager', permissions: ['read','collect-evidence','assess'] });

  const obligations: ComplianceObligation[] = [
    { id: 'obl-ai-governance', frameworkId: 'ISO-42001', citation: 'AI management system controls', summary: 'Maintain accountable AI management controls and audit evidence.', applicability: 'AI recommendations and governed workflows', controlIds: ['ctrl-ai-evidence'], dueCadence: 'continuous' },
    { id: 'obl-nist-ai-rmf', frameworkId: 'NIST-AI-RMF', citation: 'Govern, Map, Measure, Manage', summary: 'Link AI recommendation evidence to NIST AI RMF governance, context mapping, measurement, and risk management activities.', applicability: 'AI recommendations, model governance, and human oversight evidence', controlIds: ['ctrl-ai-evidence','ctrl-racing-safety-integrity'], dueCadence: 'continuous' },
    { id: 'obl-security-logging', frameworkId: 'ISO-27001', citation: 'Information security monitoring and logging', summary: 'Protect regulated operations with immutable security audit trails.', applicability: 'identity, event, approval, and API access logs', controlIds: ['ctrl-security-audit'], dueCadence: 'continuous' },
    { id: 'obl-privacy-minimization', frameworkId: 'ISO-27701', citation: 'Privacy information management', summary: 'Mask and minimize sensitive identity, credential, visitor, and veterinary data.', applicability: 'security, barn, equine, ticketing, and audit surfaces', controlIds: ['ctrl-privacy-minimization'], dueCadence: 'continuous' },
    { id: 'obl-quality-reliability', frameworkId: 'ISO-25010', citation: 'Product quality model', summary: 'Demonstrate reliability, usability, maintainability, and safety-state coverage.', applicability: 'command center, API facade, mock/live adapters, tests', controlIds: ['ctrl-software-quality'], dueCadence: 'quarterly' },
    { id: 'obl-risk-register', frameworkId: 'ISO-31000', citation: 'Risk treatment and monitoring', summary: 'Track enterprise and race-day risk decisions through assessments and corrective actions.', applicability: 'risk register, findings, operational alerts', controlIds: ['ctrl-risk-treatment'], dueCadence: 'quarterly' },
    { id: 'obl-continuity', frameworkId: 'ISO-22301', citation: 'Business continuity exercises', summary: 'Keep emergency, offline, degraded, and recovery procedures testable and evidenced.', applicability: 'emergency operations and platform degraded mode', controlIds: ['ctrl-continuity-exercises'], dueCadence: 'annual' },
    { id: 'obl-trust-services', frameworkId: 'SOC-2', citation: 'Security, availability, confidentiality, processing integrity, privacy', summary: 'Maintain SOC 2-style trust-service controls across events, approvals, audit, and platform health.', applicability: 'platform-wide trust services', controlIds: ['ctrl-trust-services'], dueCadence: 'quarterly' },
    { id: 'obl-payment-security', frameworkId: 'PCI-DSS', citation: 'Cardholder-data environment controls', summary: 'Protect ticketing/payment boundaries and require controlled payout/payment evidence.', applicability: 'ticketing, finance, payout, and payment integrations', controlIds: ['ctrl-payment-security'], dueCadence: 'quarterly' },
    { id: 'obl-hisa-safety', frameworkId: 'HISA', citation: 'Racetrack safety and integrity obligations', summary: 'Link veterinary, surface, stewarding, and equine welfare evidence to HISA readiness.', applicability: 'race-day safety and integrity operations', controlIds: ['ctrl-racing-safety-integrity'], dueCadence: 'race-day', jurisdiction: 'US' },
    { id: 'obl-arci-rules', frameworkId: 'ARCI', citation: 'Model racing rule conformance', summary: 'Maintain rulebook citations, steward decisions, evidence custody, and appeal packets.', applicability: 'stewarding and regulatory case management', controlIds: ['ctrl-rulebook-custody'], dueCadence: 'incident-driven' },
    { id: 'obl-local-commission', frameworkId: 'LOCAL-RACING-COMMISSION', citation: 'Local commission filing and retention rules', summary: 'Package jurisdictional filings with audit, approval, evidence, and commission rule mappings.', applicability: 'local racing commission submissions', controlIds: ['ctrl-commission-filing'], dueCadence: 'race-day', jurisdiction: 'configured-racing-commission' },
  ];
  obligations.forEach((obligation) => lib.addObligation(obligation));

  const controls: Array<Omit<ComplianceControl,'evidenceIds'|'assessmentIds'|'workflowInstanceIds'|'auditRecordIds'|'approvalRequestIds'|'eventIds'|'reviewCadence'|'hisaOperationalOversightCategories'> & { reviewCadence?: ReviewCadence; hisaOperationalOversightCategories?: HisaOperationalOversightCategory[]; evidence: { id: string; uri: string; description: string; content: unknown }; rating: AssessmentRating; notes: string }> = [
    { id: 'ctrl-ai-evidence', title: 'Governed AI evidence trail', description: 'Links AI recommendations, approvals, audit records, workflows, and collected evidence for audit readiness.', frameworkIds: standardizeControlFrameworks(['NIST-AI-RMF','SOC-2','HISA','ARCI','LOCAL-RACING-COMMISSION']), status: 'implemented', ownerId: 'owner-compliance', obligationIds: ['obl-ai-governance','obl-nist-ai-rmf'], digitalTwinRefs: ['ai-agent:surface-ops','workflow:ai-review'], hisaOperationalOversightCategories: ['racetrack-management','racing-office-operations','safety','accreditation'], evidence: { id: 'ev-ai-approval', uri: 'audit://approvals/mock-approval-race-start', description: 'Race-start AI recommendation and human approval packet.', content: { approval: 'mock-approval-race-start' } }, rating: 'effective', notes: 'AI control has linked recommendation, approval, workflow, and audit evidence.' },
    { id: 'ctrl-security-audit', title: 'Immutable security audit logging', description: 'Security and access-control events are recorded with hash-chain audit evidence and event lineage.', frameworkIds: standardizeControlFrameworks(['ISO-27001','SOC-2']), status: 'implemented', ownerId: 'owner-security', obligationIds: ['obl-security-logging'], digitalTwinRefs: ['facility:restricted-zone','camera:clubhouse'], evidence: { id: 'ev-security-audit', uri: 'audit://security/access-control', description: 'Security event export with restricted-zone audit records.', content: { audit: 'security-access' } }, rating: 'effective', notes: 'Security evidence covers access events, incidents, and immutable audit records.' },
    { id: 'ctrl-privacy-minimization', title: 'Sensitive data minimization and masking', description: 'PII, credentials, visitor logs, and veterinary details are masked in regulated workspaces.', frameworkIds: standardizeControlFrameworks(['ISO-27701','SOC-2','LOCAL-RACING-COMMISSION']), status: 'implemented', ownerId: 'owner-security', obligationIds: ['obl-privacy-minimization'], digitalTwinRefs: ['security:visitor-log','equine:horse-1'], evidence: { id: 'ev-privacy-masking', uri: 'audit://security/masking', description: 'Credential and legal-name masking evidence from dashboard and API contracts.', content: { masked: true } }, rating: 'effective', notes: 'Privacy controls demonstrate masking in security and regulated operational workspaces.' },
    { id: 'ctrl-software-quality', title: 'Command center software quality controls', description: 'Frontend safety states, role-aware navigation, backend adapter contracts, and tests demonstrate ISO 25010 quality attributes.', frameworkIds: standardizeControlFrameworks(['ISO-25010','SOC-2']), status: 'implemented', ownerId: 'owner-compliance', obligationIds: ['obl-quality-reliability'], digitalTwinRefs: ['workflow:platform-health'], evidence: { id: 'ev-frontend-quality', uri: 'test://apps/frontend/tests/frontend-contracts.test.mjs', description: 'Frontend contract coverage for loading, empty, error, degraded, permission, and approval-gated states.', content: { test: 'frontend-contracts' } }, rating: 'effective', notes: 'Frontend and API tests cover quality, usability, reliability, and safety-state behavior.' },
    { id: 'ctrl-risk-treatment', title: 'Risk treatment and corrective action register', description: 'Risk assessments, findings, corrective actions, and overdue status drive audit readiness scoring.', frameworkIds: standardizeControlFrameworks(['ISO-31000','SOC-2','HISA']), status: 'implemented', ownerId: 'owner-compliance', obligationIds: ['obl-risk-register'], digitalTwinRefs: ['incident:credential','workflow:corrective-action'], hisaOperationalOversightCategories: ['racetrack-management','safety','accreditation'], evidence: { id: 'ev-risk-register', uri: 'risk://enterprise/register', description: 'Risk register entry linked to compliance findings and remediation workflow.', content: { risk: 'race-day-platform' } }, rating: 'partially-effective', notes: 'Risk register is wired; recurring refresh automation is tracked as corrective action.' },
    { id: 'ctrl-continuity-exercises', title: 'Business continuity and emergency exercise evidence', description: 'Emergency plans, drills, offline banners, degraded service posture, and recovery workflows are evidenced.', frameworkIds: standardizeControlFrameworks(['ISO-22301','SOC-2','LOCAL-RACING-COMMISSION']), status: 'implemented', ownerId: 'owner-track', obligationIds: ['obl-continuity'], digitalTwinRefs: ['emergency:plan-fire','workflow:emergency-response'], hisaOperationalOversightCategories: ['racetrack-management','maintenance-facilities','safety','accreditation'], evidence: { id: 'ev-continuity-drill', uri: 'emergency://drills/weather-1', description: 'Emergency drill and degraded-mode evidence package.', content: { drill: 'weather-1' } }, rating: 'effective', notes: 'Continuity evidence links emergency plans, command roles, drills, and degraded frontend posture.' },
    { id: 'ctrl-trust-services', title: 'SOC 2 trust service operations', description: 'Availability, processing integrity, confidentiality, and privacy signals are monitored through platform health.', frameworkIds: standardizeControlFrameworks(['SOC-2','ISO-27001','ISO-27701']), status: 'implemented', ownerId: 'owner-compliance', obligationIds: ['obl-trust-services'], digitalTwinRefs: ['platform:health','event-bus:governance'], evidence: { id: 'ev-soc2-platform-health', uri: 'platform://health/soc2', description: 'Platform health, audit, approval, event bus, AI governance, and twin telemetry.', content: { health: 'degraded-safe' } }, rating: 'effective', notes: 'Trust services are represented by platform health, event governance, audit validity, and approval metrics.' },
    { id: 'ctrl-payment-security', title: 'Payment and payout security boundary', description: 'PCI DSS payment controls map ticketing and finance boundaries to approval/audit evidence.', frameworkIds: standardizeControlFrameworks(['PCI-DSS','SOC-2','ISO-27001']), status: 'implemented', ownerId: 'owner-finance', obligationIds: ['obl-payment-security'], digitalTwinRefs: ['workflow:payout','approval:finance'], evidence: { id: 'ev-pci-payout', uri: 'finance://payout/approval-boundary', description: 'Payout and payment boundary approval evidence.', content: { payout: 'approval-required' } }, rating: 'effective', notes: 'Payment boundary is approval-aware and references audit evidence for payout controls.' },
    { id: 'ctrl-racing-safety-integrity', title: 'Racing safety and integrity evidence', description: 'HISA obligations map surface, veterinary, equine welfare, steward, and emergency evidence into one readiness view.', frameworkIds: standardizeControlFrameworks(['NIST-AI-RMF','HISA','ISO-42001','ISO-31000','LOCAL-RACING-COMMISSION']), status: 'implemented', ownerId: 'owner-track', obligationIds: ['obl-hisa-safety','obl-nist-ai-rmf'], digitalTwinRefs: ['surface:far-turn','equine:horse-1','race:race-7'], hisaOperationalOversightCategories: [...hisaOperationalOversightCategories], evidence: { id: 'ev-hisa-readiness', uri: 'hisa://safety-integrity/race-7', description: 'Race-day safety and integrity evidence across surface, veterinary, and stewarding.', content: { race: 'race-7' } }, rating: 'effective', notes: 'HISA readiness connects racing safety domains and human-governed AI recommendations.' },
    { id: 'ctrl-rulebook-custody', title: 'Rulebook citation and evidence custody', description: 'ARCI mappings connect rulebook retrieval, steward decisions, evidence chain-of-custody, and appeal packets.', frameworkIds: standardizeControlFrameworks(['ARCI','HISA','LOCAL-RACING-COMMISSION']), status: 'implemented', ownerId: 'owner-compliance', obligationIds: ['obl-arci-rules'], digitalTwinRefs: ['incident:race-review','workflow:steward-investigation'], hisaOperationalOversightCategories: ['racing-office-operations','safety','accreditation'], evidence: { id: 'ev-arci-custody', uri: 'regulatory://appeal-package/race-7', description: 'Rulebook and chain-of-custody evidence for steward review.', content: { appealPackage: 'race-7' } }, rating: 'effective', notes: 'ARCI evidence preserves human steward authority and chain of custody.' },
    { id: 'ctrl-commission-filing', title: 'Local racing commission filing package', description: 'Jurisdiction-specific filing packet assembles controls, evidence, approvals, events, and audit records for commission review.', frameworkIds: standardizeControlFrameworks(['LOCAL-RACING-COMMISSION','HISA','ARCI','ISO-22301']), status: 'implemented', ownerId: 'owner-compliance', obligationIds: ['obl-local-commission'], digitalTwinRefs: ['commission:configured','workflow:accreditation-readiness'], hisaOperationalOversightCategories: ['racetrack-management','racing-office-operations','accreditation'], evidence: { id: 'ev-commission-filing', uri: 'commission://filing/readiness', description: 'Local commission filing packet evidence with approvals and audit records.', content: { commission: 'configured' } }, rating: 'effective', notes: 'Commission filing packet is ready for authorized human approval and export.' },
  ];

  for (const control of controls) {
    const { evidence, rating, notes, ...definition } = control;
    lib.createControl(definition, 'seed', '2026-06-13T00:00:00.000Z');
    lib.collectEvidence(definition.id, definition.ownerId, evidence, '2026-06-13T00:01:00.000Z');
    lib.startEvidenceWorkflow(definition.id, definition.ownerId, '2026-06-13T00:01:30.000Z');
    lib.assess(definition.id, definition.ownerId, rating, notes, '2026-06-13T00:02:00.000Z');
  }

  const finding = lib.openFinding('ctrl-risk-treatment', 'medium', 'Automate recurring evidence refresh from audit, workflow, event, approval, and Digital Twin sources.', 'owner-compliance', '2026-06-13T00:03:00.000Z');
  lib.createCorrectiveAction(finding.id, 'owner-compliance', 'Implement scheduled evidence refresh and accreditation readiness delta review.', '2026-07-15', { startWorkflow: true, approvalRequestId: 'approval-compliance-filing-1', now: '2026-06-13T00:04:00.000Z' });

  lib.addFrameworkMapping({ id: 'map-ai-governance', frameworkId: 'ISO-42001', citation: 'AI management accountability', mappedTo: [{ frameworkId: 'NIST-AI-RMF', citation: 'govern/map/measure/manage AI risk evidence', relationship: 'supports' }, { frameworkId: 'SOC-2', citation: 'CC1/CC2 governance and communication', relationship: 'supports' }, { frameworkId: 'HISA', citation: 'human safety and integrity oversight', relationship: 'supports' }, { frameworkId: 'LOCAL-RACING-COMMISSION', citation: 'AI advisory-only commission filing', relationship: 'localizes' }], racingCommissionRule: 'local-ai-human-authority', controlIds: ['ctrl-ai-evidence'] });
  lib.addFrameworkMapping({ id: 'map-ai-rmf', frameworkId: 'NIST-AI-RMF', citation: 'Govern, Map, Measure, Manage', mappedTo: [{ frameworkId: 'ISO-42001', citation: 'AI management system controls', relationship: 'supports' }, { frameworkId: 'ISO-31000', citation: 'risk treatment and monitoring', relationship: 'supports' }, { frameworkId: 'HISA', citation: 'AI-supported race-day safety oversight', relationship: 'overlaps' }], racingCommissionRule: 'local-ai-human-authority', controlIds: ['ctrl-ai-evidence','ctrl-racing-safety-integrity'] });
  lib.addFrameworkMapping({ id: 'map-security-privacy', frameworkId: 'ISO-27001', citation: 'security logging and access control', mappedTo: [{ frameworkId: 'ISO-27701', citation: 'privacy information management', relationship: 'overlaps' }, { frameworkId: 'SOC-2', citation: 'security/confidentiality/privacy', relationship: 'equivalent' }, { frameworkId: 'PCI-DSS', citation: 'payment environment logging', relationship: 'supports' }], controlIds: ['ctrl-security-audit','ctrl-privacy-minimization','ctrl-payment-security'] });
  lib.addFrameworkMapping({ id: 'map-racing-integrity', frameworkId: 'HISA', citation: 'racetrack safety and integrity', mappedTo: [{ frameworkId: 'ARCI', citation: 'model racing rules and stewarding evidence', relationship: 'overlaps' }, { frameworkId: 'LOCAL-RACING-COMMISSION', citation: 'jurisdictional race-day filings', relationship: 'localizes' }, { frameworkId: 'ISO-31000', citation: 'risk treatment', relationship: 'supports' }], racingCommissionRule: 'configured-commission-safety-filing', controlIds: ['ctrl-racing-safety-integrity','ctrl-rulebook-custody','ctrl-commission-filing'] });

  const allControlIds = controls.map((control) => control.id);
  const dashboard = lib.dashboard();
  lib.createEvidencePackage({ id: 'pkg-accreditation-2026-q2', evidenceId: 'evpkg-integrated-readiness-2026-q2', title: 'Q2 universal AI management and racing governance readiness package', tenantId, racetrackId: tenantId, source: { objectType: 'racetrack-operation', objectId: 'race-day-readiness-q2', workflowInstanceId: 'accreditation-readiness-review-1', controlId: 'ctrl-ai-evidence' }, controlIds: allControlIds, evidenceIds: dashboard.controls.flatMap((control) => control.evidenceIds), auditRecordIds: dashboard.controls.flatMap((control) => control.auditRecordIds), workflowInstanceIds: dashboard.controls.flatMap((control) => control.workflowInstanceIds), approvalRequestIds: ['approval-compliance-filing-1'], digitalTwinRefs: dashboard.controls.flatMap((control) => control.digitalTwinRefs), eventIds: dashboard.controls.flatMap((control) => control.eventIds), aiRecommendationRefs: ['rec-race-start-readiness','rec-surface-maintenance-watch'], frameworkIds: ['ISO-42001','NIST-AI-RMF','ISO-27001','ISO-27701','ISO-25010','ISO-31000','ISO-22301','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION'], controlOwnerId: 'owner-compliance', reviewCadence: 'continuous', hisaOperationalOversightCategories: [...hisaOperationalOversightCategories], accreditationReadiness: { status: 'ready-for-review', score: dashboard.readiness.score, readinessOnly: true, externalCertificationClaimed: false, notes: 'Integrated readiness package reuses evidence across frameworks and local racing rules; it does not claim external certification.' }, sealed: true, readiness: 'evidence-package-ready' });
  lib.createReviewCycle({ id: 'cycle-2026-q2', frameworkId: 'ISO-42001', periodStart: '2026-04-01', periodEnd: '2026-06-30', controlIds: allControlIds, status: 'ready-for-internal-audit-prep' });
  lib.createAccreditationProgram({ id: 'program-integrated-accreditation-2026', name: 'Integrated ISO/SOC/PCI/racing accreditation readiness', authority: 'TrackMind Compliance Board (internal readiness)', frameworkIds: ['ISO-42001','NIST-AI-RMF','ISO-27001','ISO-27701','ISO-25010','ISO-31000','ISO-22301','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION'], jurisdiction: 'local-regulatory-placeholder', status: 'ready-for-internal-review', requiredControlIds: allControlIds, evidencePackageIds: ['pkg-accreditation-2026-q2'], nextReviewAt: '2026-07-15' });
  return lib;
}

function standardizeControlFrameworks(frameworkIds: ComplianceFrameworkId[]): ComplianceFrameworkId[] {
  return uniqueStrings<ComplianceFrameworkId>([...universalEvidenceFrameworkIds, ...frameworkIds]);
}

function authorityFor(id: ComplianceFrameworkId): string {
  if (id.startsWith('ISO-')) return 'International Organization for Standardization';
  if (id === 'NIST-AI-RMF') return 'National Institute of Standards and Technology';
  if (id === 'SOC-2') return 'AICPA Trust Services Criteria';
  if (id === 'PCI-DSS') return 'PCI Security Standards Council';
  if (id === 'HISA') return 'Horseracing Integrity and Safety Authority';
  if (id === 'ARCI') return 'Association of Racing Commissioners International';
  return 'Configured local racing commission';
}

function severityPriority(severity: FindingSeverity): 'low'|'normal'|'high'|'critical' {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'normal';
  return 'low';
}
