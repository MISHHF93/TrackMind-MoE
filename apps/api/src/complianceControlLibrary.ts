import { AuditEvidenceCollectionVault, ImmutableAuditLog, type AuditLogEntry, type EvidenceItem } from './auditLog.js';
import { WorkflowOrchestrationEngine, type WorkflowDefinition, type WorkflowInstance } from './workflowEngine.js';
import type { Role } from '@trackmind/shared';

export type ComplianceFrameworkId = 'ISO-42001'|'ISO-27001'|'ISO-27701'|'ISO-31000'|'ISO-22301'|'SOC-2'|'PCI-DSS'|'HISA'|'ARCI'|'LOCAL-RACING-COMMISSION';
export type ControlStatus = 'draft'|'implemented'|'assessing'|'effective'|'deficient'|'retired';
export type AssessmentRating = 'effective'|'partially-effective'|'ineffective'|'not-assessed';
export type FindingSeverity = 'low'|'medium'|'high'|'critical';
export interface ComplianceFramework { id: ComplianceFrameworkId; name: string; placeholder: boolean; domains: string[]; authority: string; }
export interface ComplianceObligation { id: string; frameworkId: ComplianceFrameworkId; citation: string; summary: string; applicability: string; controlIds: string[]; }
export interface ControlOwner { id: string; displayName: string; role: Role; permissions: Array<'read'|'collect-evidence'|'assess'|'approve-action'|'admin'>; }
export interface ComplianceControl { id: string; frameworkIds: ComplianceFrameworkId[]; title: string; description: string; status: ControlStatus; ownerId: string; obligationIds: string[]; evidenceIds: string[]; assessmentIds: string[]; workflowInstanceIds: string[]; auditRecordIds: string[]; }
export interface ControlAssessment { id: string; controlId: string; assessedBy: string; assessedAt: string; rating: AssessmentRating; notes: string; evidenceIds: string[]; findingIds: string[]; }
export interface ComplianceFinding { id: string; controlId: string; severity: FindingSeverity; summary: string; status: 'open'|'accepted-risk'|'remediated'|'closed'; correctiveActionIds: string[]; }
export interface CorrectiveAction { id: string; findingId: string; ownerId: string; action: string; dueAt: string; status: 'open'|'in-progress'|'done'|'overdue'; workflowInstanceId?: string; }
export interface ReviewCycle { id: string; frameworkId: ComplianceFrameworkId; periodStart: string; periodEnd: string; controlIds: string[]; status: 'planned'|'in-review'|'ready-for-audit'|'closed'; readinessScore: number; }
export interface AuditReadinessScore { score: number; totalControls: number; effectiveControls: number; evidenceCoverage: number; openFindings: number; overdueActions: number; byFramework: Array<{ frameworkId: ComplianceFrameworkId; score: number; controls: number }> }

export const complianceFrameworkPlaceholders: ComplianceFramework[] = [
  ['ISO-42001','ISO 42001 AI management system','AI governance'], ['ISO-27001','ISO 27001 information security','security'], ['ISO-27701','ISO 27701 privacy information management','privacy'], ['ISO-31000','ISO 31000 risk management','risk'], ['ISO-22301','ISO 22301 business continuity','continuity'], ['SOC-2','SOC 2 trust services','trust'], ['PCI-DSS','PCI DSS payment security','payments'], ['HISA','HISA racing safety and integrity','racing integrity'], ['ARCI','ARCI model racing rules','racing rules'], ['LOCAL-RACING-COMMISSION','Local racing commission rules','jurisdictional rules'],
].map(([id,name,domain]) => ({ id: id as ComplianceFrameworkId, name, placeholder: true, domains: [domain], authority: 'placeholder-library' }));

export class ComplianceControlLibrary {
  readonly audit = new ImmutableAuditLog();
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

  constructor(private readonly tenantId = 'track-1') { this.workflows.register(complianceEvidenceWorkflow(tenantId)); }
  listFrameworks() { return [...this.frameworks.values()].map((v) => ({...v, domains:[...v.domains]})); }
  addOwner(owner: ControlOwner) { this.owners.set(owner.id, {...owner, permissions:[...owner.permissions]}); return this.owner(owner.id); }
  owner(id: string) { const owner = this.owners.get(id); if (!owner) throw new Error(`Unknown owner ${id}`); return {...owner, permissions:[...owner.permissions]}; }
  can(ownerId: string, permission: ControlOwner['permissions'][number]) { const o = this.owner(ownerId); return o.permissions.includes('admin') || o.permissions.includes(permission); }
  addObligation(obligation: ComplianceObligation) { this.obligations.set(obligation.id, {...obligation, controlIds:[...obligation.controlIds]}); return obligation; }
  createControl(control: Omit<ComplianceControl,'evidenceIds'|'assessmentIds'|'workflowInstanceIds'|'auditRecordIds'>, actor='compliance-system', now=new Date().toISOString()) {
    if (!this.owners.has(control.ownerId)) throw new Error(`Unknown owner ${control.ownerId}`);
    const full: ComplianceControl = {...control, evidenceIds:[], assessmentIds:[], workflowInstanceIds:[], auditRecordIds:[]};
    this.controls.set(full.id, full); const audit = this.auditControl(full.id, actor, now, 'control.created', full.frameworkIds); full.auditRecordIds.push(audit.id); return this.control(full.id);
  }
  updateStatus(controlId: string, status: ControlStatus, actor: string, now=new Date().toISOString()) { const c=this.mutableControl(controlId); c.status=status; c.auditRecordIds.push(this.auditControl(controlId, actor, now, 'control.status.updated', c.frameworkIds).id); return this.control(controlId); }
  collectEvidence(controlId: string, ownerId: string, input: { id: string; uri: string; description: string; content: unknown }, now=new Date().toISOString()) {
    if (!this.can(ownerId, 'collect-evidence')) throw new Error(`Owner ${ownerId} cannot collect evidence`); const c=this.mutableControl(controlId);
    const record = this.auditControl(controlId, ownerId, now, 'evidence.collected', c.frameworkIds, [input.id]);
    const evidence = this.evidenceVault.collect({ id: input.id, recordId: record.id, uri: input.uri, collectedBy: ownerId, collectedAt: now, description: input.description, content: input.content });
    c.evidenceIds.push(evidence.id); c.auditRecordIds.push(record.id); return { evidence, auditRecord: record };
  }
  startEvidenceWorkflow(controlId: string, actor: string, now=new Date().toISOString()): WorkflowInstance { const c=this.mutableControl(controlId); const wf=this.workflows.start('compliance-evidence-review', { tenantId:this.tenantId, priority:'normal', digitalTwinRefs:[`compliance:control:${controlId}`], payload:{ controlId, evidenceIds:c.evidenceIds } }, actor, now); c.workflowInstanceIds.push(wf.id); return wf; }
  assess(controlId: string, ownerId: string, rating: AssessmentRating, notes: string, now=new Date().toISOString()) { if (!this.can(ownerId,'assess')) throw new Error(`Owner ${ownerId} cannot assess controls`); const c=this.mutableControl(controlId); const assessment: ControlAssessment={ id:`assessment-${this.assessments.size+1}`, controlId, assessedBy:ownerId, assessedAt:now, rating, notes, evidenceIds:[...c.evidenceIds], findingIds:[] }; this.assessments.set(assessment.id, assessment); c.assessmentIds.push(assessment.id); c.status = rating === 'effective' ? 'effective' : 'deficient'; c.auditRecordIds.push(this.auditControl(controlId, ownerId, now, 'control.assessed', c.frameworkIds, c.evidenceIds).id); return assessment; }
  openFinding(controlId: string, severity: FindingSeverity, summary: string) { const finding: ComplianceFinding={ id:`finding-${this.findings.size+1}`, controlId, severity, summary, status:'open', correctiveActionIds:[]}; this.findings.set(finding.id,finding); return finding; }
  createCorrectiveAction(findingId: string, ownerId: string, action: string, dueAt: string) { const finding=this.findings.get(findingId); if(!finding) throw new Error(`Unknown finding ${findingId}`); const ca: CorrectiveAction={ id:`ca-${this.actions.size+1}`, findingId, ownerId, action, dueAt, status:'open'}; this.actions.set(ca.id,ca); finding.correctiveActionIds.push(ca.id); return ca; }
  createReviewCycle(cycle: Omit<ReviewCycle,'readinessScore'>) { const full={...cycle, readinessScore:this.readiness(cycle.controlIds).score}; this.cycles.set(full.id, full); return full; }
  readiness(controlIds=[...this.controls.keys()]): AuditReadinessScore { const controls=controlIds.map((id)=>this.mutableControl(id)); const total=controls.length || 1; const effective=controls.filter((c)=>c.status==='effective').length; const evidence=controls.filter((c)=>c.evidenceIds.length>0).length; const open=[...this.findings.values()].filter((f)=>controlIds.includes(f.controlId)&&f.status==='open').length; const overdue=[...this.actions.values()].filter((a)=>a.status==='overdue').length; const score=Math.max(0, Math.round((effective/total*55)+(evidence/total*35)-open*7-overdue*5)); return { score, totalControls: controls.length, effectiveControls: effective, evidenceCoverage: Math.round(evidence/total*100), openFindings: open, overdueActions: overdue, byFramework: this.listFrameworks().map((f)=>{ const fc=controls.filter((c)=>c.frameworkIds.includes(f.id)); return { frameworkId:f.id, controls:fc.length, score: fc.length ? Math.round(fc.filter((c)=>c.status==='effective').length/fc.length*100) : 0 }; }) }; }
  dashboard() { return { frameworks:this.listFrameworks(), controls:[...this.controls.values()], obligations:[...this.obligations.values()], owners:[...this.owners.values()], findings:[...this.findings.values()], correctiveActions:[...this.actions.values()], reviewCycles:[...this.cycles.values()], readiness:this.readiness() }; }
  control(id:string) { const c=this.mutableControl(id); return {...c, frameworkIds:[...c.frameworkIds], obligationIds:[...c.obligationIds], evidenceIds:[...c.evidenceIds], assessmentIds:[...c.assessmentIds], workflowInstanceIds:[...c.workflowInstanceIds], auditRecordIds:[...c.auditRecordIds]}; }
  private mutableControl(id:string) { const c=this.controls.get(id); if(!c) throw new Error(`Unknown control ${id}`); return c; }
  private auditControl(controlId:string, actor:string, timestamp:string, action:string, regulations:string[], evidenceIds:string[]=[]): AuditLogEntry { return this.audit.append({ id:`audit-compliance-${this.audit.all().length+1}`, type:'regulatory-activity', actor, timestamp, subjectId:controlId, tenantId:this.tenantId, severity:'info', regulations, evidenceIds, payload:{ action, controlId } }); }
}

export function complianceEvidenceWorkflow(tenantId: string): WorkflowDefinition { return { id:'compliance-evidence-review', name:'Compliance evidence collection and review', domain:'compliance', version:'1.0.0', bpmnProcessId:'Process_ComplianceEvidenceReview', startStepId:'collect', ownerRole:'compliance-officer', tenantId, steps:[{ id:'collect', name:'Collect evidence', type:'userTask', role:'compliance-officer', next:['review'], digitalTwin:{ refs:['compliance-control'], syncMode:'read' } }, { id:'review', name:'Owner review', type:'approvalTask', approvalRoles:['compliance-officer'], requiredApprovals:1, next:['ready'], digitalTwin:{ refs:['audit-records'], syncMode:'read-write', statePatch:{ auditReady:true } } }, { id:'ready', name:'Audit-ready evidence package', type:'endEvent' }] }; }

export function seededComplianceLibrary(tenantId='track-1') { const lib = new ComplianceControlLibrary(tenantId); lib.addOwner({ id:'owner-compliance', displayName:'Compliance Officer', role:'compliance-officer', permissions:['read','collect-evidence','assess','approve-action'] }); lib.addOwner({ id:'owner-auditor', displayName:'Read-only Auditor', role:'read-only-auditor', permissions:['read'] }); lib.addObligation({ id:'obl-ai-governance', frameworkId:'ISO-42001', citation:'placeholder-control-objective', summary:'Maintain accountable AI management controls and audit evidence.', applicability:'AI recommendations and governed workflows', controlIds:['ctrl-ai-evidence'] }); lib.createControl({ id:'ctrl-ai-evidence', title:'Governed AI evidence trail', description:'Links AI recommendations, approvals, audit records, workflows, and collected evidence for audit readiness.', frameworkIds:['ISO-42001','SOC-2','HISA','ARCI','LOCAL-RACING-COMMISSION'], status:'implemented', ownerId:'owner-compliance', obligationIds:['obl-ai-governance'] }, 'seed', '2026-06-13T00:00:00.000Z'); lib.collectEvidence('ctrl-ai-evidence','owner-compliance',{ id:'ev-ai-approval', uri:'audit://approvals/mock-approval-race-start', description:'Race-start AI recommendation and human approval packet.', content:{ approval:'mock-approval-race-start' } }, '2026-06-13T00:01:00.000Z'); lib.assess('ctrl-ai-evidence','owner-compliance','effective','Initial placeholder control has linked audit evidence.', '2026-06-13T00:02:00.000Z'); lib.createReviewCycle({ id:'cycle-2026-q2', frameworkId:'ISO-42001', periodStart:'2026-04-01', periodEnd:'2026-06-30', controlIds:['ctrl-ai-evidence'], status:'ready-for-audit' }); return lib; }
