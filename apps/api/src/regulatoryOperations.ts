export type RegulatoryCaseType = 'objection' | 'inquiry' | 'race-review' | 'incident-investigation' | 'appeal' | 'compliance-review';
export type RegulatoryCaseStatus = 'opened' | 'triage' | 'investigating' | 'pending-ruling' | 'decided' | 'appealed' | 'closed';
export type EvidenceType = 'video' | 'photo' | 'sensor' | 'digital-twin' | 'document' | 'testimony' | 'knowledge-graph';
export type Authority = 'steward' | 'commission' | 'appeals-board' | 'compliance-officer';

export interface RegulatoryCase {
  id: string;
  type: RegulatoryCaseType;
  raceId?: string;
  title: string;
  openedBy: string;
  openedAt: string;
  status: RegulatoryCaseStatus;
  parties: string[];
  allegations: string[];
  tags?: string[];
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  type: EvidenceType;
  uri: string;
  collectedAt: string;
  collectedBy: string;
  hash: string;
  relatedTwinIds?: string[];
  timecode?: { start: string; end: string };
  metadata?: Record<string, unknown>;
}

export interface ChainOfCustodyEntry {
  evidenceId: string;
  actor: string;
  action: 'collected' | 'viewed' | 'annotated' | 'transferred' | 'sealed' | 'exported';
  timestamp: string;
  note?: string;
}

export interface RulebookSection {
  id: string;
  jurisdiction: string;
  section: string;
  title: string;
  text: string;
  effectiveDate: string;
  relatedConcepts: string[];
}

export interface KnowledgeGraphEdge {
  from: string;
  to: string;
  relationship: string;
  evidenceIds: string[];
}

export interface AiDecisionSupportRequest {
  caseId: string;
  question: string;
  evidenceIds: string[];
  ruleIds: string[];
  twinContextIds?: string[];
}

export interface AiDecisionSupportResult {
  caseId: string;
  recommendation: string;
  confidence: number;
  explanation: string[];
  evidenceIds: string[];
  ruleIds: string[];
  limitations: string[];
  officialRulingRequiresHumanAuthority: true;
  approvedForAutomaticRuling: false;
}

export interface OfficialDecision {
  id: string;
  caseId: string;
  authority: Authority;
  decidedBy: string;
  decidedAt: string;
  ruling: string;
  ruleIds: string[];
  evidenceIds: string[];
  aiAssistanceId?: string;
}

export class RegulatoryOperationsPlatform {
  private readonly cases = new Map<string, RegulatoryCase>();
  private readonly evidence = new Map<string, EvidenceItem>();
  private readonly custody: ChainOfCustodyEntry[] = [];
  private readonly rules = new Map<string, RulebookSection>();
  private readonly graphEdges: KnowledgeGraphEdge[] = [];
  private readonly decisions = new Map<string, OfficialDecision>();
  private readonly auditTrail: Array<{ id: string; actor: string; action: string; timestamp: string; subjectId: string; details: unknown }> = [];

  openCase(regulatoryCase: RegulatoryCase) {
    this.cases.set(regulatoryCase.id, { ...regulatoryCase, parties: [...regulatoryCase.parties], allegations: [...regulatoryCase.allegations], tags: [...(regulatoryCase.tags ?? [])] });
    this.audit(regulatoryCase.openedBy, 'case-opened', regulatoryCase.openedAt, regulatoryCase.id, { type: regulatoryCase.type });
    return this.caseById(regulatoryCase.id)!;
  }

  transitionCase(caseId: string, status: RegulatoryCaseStatus, actor: string, timestamp: string) {
    const found = this.requireCase(caseId);
    const updated = { ...found, status };
    this.cases.set(caseId, updated);
    this.audit(actor, 'case-transitioned', timestamp, caseId, { status });
    return { ...updated };
  }

  addEvidence(item: EvidenceItem, actor = item.collectedBy) {
    this.requireCase(item.caseId);
    const saved = { ...item, relatedTwinIds: [...(item.relatedTwinIds ?? [])], metadata: { ...(item.metadata ?? {}) }, timecode: item.timecode ? { ...item.timecode } : undefined };
    this.evidence.set(item.id, saved);
    this.recordCustody({ evidenceId: item.id, actor, action: 'collected', timestamp: item.collectedAt, note: item.hash });
    this.audit(actor, 'evidence-added', item.collectedAt, item.caseId, { evidenceId: item.id, type: item.type });
    return { ...saved, relatedTwinIds: [...(saved.relatedTwinIds ?? [])], metadata: { ...(saved.metadata ?? {}) } };
  }

  recordCustody(entry: ChainOfCustodyEntry) {
    this.custody.push({ ...entry });
    return { ...entry };
  }

  addRule(section: RulebookSection) {
    this.rules.set(section.id, { ...section, relatedConcepts: [...section.relatedConcepts] });
    return this.rules.get(section.id)!;
  }

  retrieveRules(query: string, jurisdiction?: string) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.rules.values()]
      .filter((rule) => !jurisdiction || rule.jurisdiction === jurisdiction)
      .map((rule) => ({ rule, score: terms.filter((term) => `${rule.section} ${rule.title} ${rule.text} ${rule.relatedConcepts.join(' ')}`.toLowerCase().includes(term)).length }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ rule }) => ({ ...rule, relatedConcepts: [...rule.relatedConcepts] }));
  }

  connectKnowledge(edge: KnowledgeGraphEdge) {
    this.graphEdges.push({ ...edge, evidenceIds: [...edge.evidenceIds] });
    return { ...edge, evidenceIds: [...edge.evidenceIds] };
  }

  explainableDecisionSupport(request: AiDecisionSupportRequest): AiDecisionSupportResult {
    this.requireCase(request.caseId);
    const evidence = request.evidenceIds.map((id) => this.evidence.get(id)).filter((item): item is EvidenceItem => Boolean(item));
    const rules = request.ruleIds.map((id) => this.rules.get(id)).filter((rule): rule is RulebookSection => Boolean(rule));
    const graphHits = this.graphEdges.filter((edge) => request.evidenceIds.some((id) => edge.evidenceIds.includes(id)) || request.twinContextIds?.includes(edge.from) || request.twinContextIds?.includes(edge.to));
    return {
      caseId: request.caseId,
      recommendation: evidence.length && rules.length ? 'human-review-ready' : 'collect-more-evidence',
      confidence: Math.min(0.95, Number((0.45 + evidence.length * 0.1 + rules.length * 0.1 + graphHits.length * 0.05).toFixed(2))),
      explanation: [`Evidence considered: ${evidence.map((item) => item.id).join(', ') || 'none'}`, `Rules considered: ${rules.map((rule) => rule.section).join(', ') || 'none'}`, `Knowledge graph links: ${graphHits.length}`],
      evidenceIds: evidence.map((item) => item.id),
      ruleIds: rules.map((rule) => rule.id),
      limitations: ['AI assistance is advisory only', 'Official rulings require authorized human decision makers'],
      officialRulingRequiresHumanAuthority: true,
      approvedForAutomaticRuling: false,
    };
  }

  recordOfficialDecision(decision: OfficialDecision) {
    this.requireCase(decision.caseId);
    if (!decision.decidedBy) throw new Error('Official decisions require an authorized human decision maker');
    const saved = { ...decision, ruleIds: [...decision.ruleIds], evidenceIds: [...decision.evidenceIds] };
    this.decisions.set(decision.id, saved);
    this.transitionCase(decision.caseId, decision.authority === 'appeals-board' ? 'closed' : 'decided', decision.decidedBy, decision.decidedAt);
    this.audit(decision.decidedBy, 'official-decision-recorded', decision.decidedAt, decision.caseId, { decisionId: decision.id, authority: decision.authority });
    return { ...saved, ruleIds: [...saved.ruleIds], evidenceIds: [...saved.evidenceIds] };
  }

  appealPackage(caseId: string) {
    const regulatoryCase = this.requireCase(caseId);
    const evidence = this.evidenceForCase(caseId);
    return { case: regulatoryCase, evidence, custody: this.custody.filter((entry) => evidence.some((item) => item.id === entry.evidenceId)).map((entry) => ({ ...entry })), decisions: [...this.decisions.values()].filter((decision) => decision.caseId === caseId).map((decision) => ({ ...decision, evidenceIds: [...decision.evidenceIds], ruleIds: [...decision.ruleIds] })), auditTrail: this.auditForCase(caseId) };
  }

  complianceReport() {
    const cases = [...this.cases.values()];
    const decided = cases.filter((item) => item.status === 'decided' || item.status === 'closed');
    return { totalCases: cases.length, openCases: cases.length - decided.length, decidedCases: decided.length, evidenceItems: this.evidence.size, custodyComplete: [...this.evidence.values()].every((item) => this.custody.some((entry) => entry.evidenceId === item.id && entry.action === 'collected')), humanAuthorityPreserved: [...this.decisions.values()].every((decision) => Boolean(decision.decidedBy)), auditEvents: this.auditTrail.length };
  }

  caseById(caseId: string) { const found = this.cases.get(caseId); return found ? { ...found, parties: [...found.parties], allegations: [...found.allegations], tags: [...(found.tags ?? [])] } : undefined; }
  evidenceForCase(caseId: string) { return [...this.evidence.values()].filter((item) => item.caseId === caseId).map((item) => ({ ...item, relatedTwinIds: [...(item.relatedTwinIds ?? [])], metadata: { ...(item.metadata ?? {}) } })); }
  auditForCase(caseId: string) { return this.auditTrail.filter((entry) => entry.subjectId === caseId).map((entry) => ({ ...entry })); }

  private requireCase(caseId: string) { const found = this.caseById(caseId); if (!found) throw new Error(`Unknown regulatory case: ${caseId}`); return found; }
  private audit(actor: string, action: string, timestamp: string, subjectId: string, details: unknown) { this.auditTrail.push({ id: `audit-${this.auditTrail.length + 1}`, actor, action, timestamp, subjectId, details }); }
}

export function regulatoryOperationsBlueprint() {
  return {
    capabilities: ['objections', 'inquiries', 'race-reviews', 'incident-investigations', 'evidence-management', 'rulebook-retrieval', 'decision-support', 'appeals', 'compliance-reporting', 'case-management'],
    integrations: ['video-evidence', 'digital-twins', 'regulatory-knowledge-graphs', 'workflow-automation', 'immutable-audit-trails', 'explainable-ai-assistance'],
    humanAuthority: 'AI never issues official rulings; stewards, commissions, and appeals boards retain final authority',
    controls: ['chain-of-custody', 'role-based-access', 'retention-policy', 'legal-hold', 'model-output-disclosure', 'conflict-of-interest-checks'],
  };
}
