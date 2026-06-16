import { createAIActAuditLogger, type AIActAuditLogger } from './auditLogger.js';
import { createTrustworthyOrchestrationPolicyEngine, type TrustworthyOrchestrationPolicyEngine } from './policyEngine.js';

export interface HazardMitigation {
  hazardId: string;
  hazard: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'rare' | 'possible' | 'likely';
  mitigations: string[];
  residualRisk: 'low' | 'medium' | 'high';
  owner: string;
}

export interface DatasetGovernanceRecord {
  datasetId: string;
  provenance: string[];
  biasChecks: Array<{ check: string; result: string; evidence: string[] }>;
  representativeness: string;
  limitations: string[];
}

export interface TechnicalDocumentationRecord {
  artifactId: string;
  title: string;
  type: 'architecture-diagram' | 'test-result' | 'readiness-statement' | 'model-card';
  uri: string;
  summary: string;
}

export class AIActComplianceReportingService {
  constructor(readonly policyEngine: TrustworthyOrchestrationPolicyEngine = createTrustworthyOrchestrationPolicyEngine(), readonly auditLogger: AIActAuditLogger = createAIActAuditLogger()) {}

  riskManagementSystem() {
    const hazards: HazardMitigation[] = [
      { hazardId: 'hazard-autonomous-race-start', hazard: 'AI recommendation could trigger race start without human approval.', severity: 'critical', likelihood: 'possible', mitigations: ['C1 code-level autonomous mutation denial', 'race_start approval_id required', '120 second approval timer'], residualRisk: 'low', owner: 'stewards' },
      { hazardId: 'hazard-vet-privacy-leak', hazard: 'Veterinary records exposed to unauthorized roles.', severity: 'high', likelihood: 'possible', mitigations: ['role-filtered equine view', 'audit access to veterinary records', 'least-privilege API policy'], residualRisk: 'low', owner: 'veterinarian' },
      { hazardId: 'hazard-uncertain-recommendation', hazard: 'Low-confidence recommendation presented as operationally ready.', severity: 'high', likelihood: 'likely', mitigations: ['C6 uncertainty escalation', 'confidence threshold', 'request more evidence workflow'], residualRisk: 'medium', owner: 'ai-governor' },
    ];
    return { article: 'AI Act Article 9', title: 'Risk Management System', hazards, mitigationMatrixGeneratedAt: '2026-06-14T18:00:00.000Z' };
  }

  dataGovernance() {
    const datasets: DatasetGovernanceRecord[] = [
      { datasetId: 'surface-readings-v5', provenance: ['sensor:surface-live-1', 'maintenance-log:far-turn', 'weather:main-track'], biasChecks: [{ check: 'surface-section coverage', result: 'far-turn overrepresented during wet conditions; stratified monitoring enabled', evidence: ['bias:surface-section-coverage'] }], representativeness: 'Covers dirt, turf, and synthetic sectors with race-day weather joins.', limitations: ['Synthetic track history shorter than dirt track history.'] },
      { datasetId: 'rulebook-rag-index', provenance: ['ARCI 2026', 'HISA safety guidance', 'local commission bulletins'], biasChecks: [{ check: 'jurisdiction freshness', result: 'local commission updates require monthly review', evidence: ['review:rulebook-index-monthly'] }], representativeness: 'Contains national and local racing authority references.', limitations: ['Advisory only; stewards issue official interpretation.'] },
    ];
    return { article: 'AI Act Article 10', title: 'Data Governance', datasets };
  }

  technicalDocumentation() {
    const artifacts: TechnicalDocumentationRecord[] = [
      { artifactId: 'arch-cqrs-event-hubs', title: 'Command -> Event -> Projection architecture', type: 'architecture-diagram', uri: 'docs/compliance/technical-documentation.md#architecture', summary: 'Documents Azure Event Hubs CQRS flow and projections.' },
      { artifactId: 'test-cqrs-event-architecture', title: 'CQRS integration tests', type: 'test-result', uri: 'apps/api/tests/cqrs-event-architecture.test.mjs', summary: 'Verifies approval-gated race start, hash chain, and projection rebuilds.' },
      { artifactId: 'test-apex-domain-services', title: 'HITL approval tests', type: 'test-result', uri: 'apps/api/tests/apex-domain-services.test.mjs', summary: 'Verifies dual-control approval and immutable audit/event emission.' },
      { artifactId: 'internal-readiness-statement', title: 'Internal compliance readiness statement', type: 'readiness-statement', uri: 'docs/compliance/technical-documentation.md#internal-readiness-statements', summary: 'Readiness statement only; no external certification claimed.' },
    ];
    return { title: 'Technical Documentation', artifacts };
  }

  automaticLogging() {
    return { article: 'AI Act Article 12', title: 'Automatic Logging', ...this.auditLogger.report() };
  }

  transparencyExplainability() {
    return { article: 'AI Act Article 13', title: 'Transparency and Explainability', records: this.auditLogger.report().transparencyRecords };
  }

  humanOversight() {
    return { article: 'AI Act Article 14', title: 'Human Oversight', hitlPlatform: 'APEX approval gateway + centralized approval service', overrideLogs: this.auditLogger.report().humanOversight, policyChecks: this.policyEngine.evaluate({ subjectId: 'race-7', action: 'race-start', actorId: 'ai-agent-1', actorType: 'ai-agent', roles: ['steward'], confidence: 0.91, attributes: { protectedAction: true, autonomousMutation: true } }) };
  }

  postMarketMonitoring() {
    return { article: 'AI Act Article 72', title: 'Post-Market Monitoring', ...this.auditLogger.report().postMarketMonitoring, feedbackLoop: { intake: 'steward/vet/operator feedback', triage: 'AI governance board', remediation: 'versioned reversible knowledge updates', incidentWorkflow: '/compliance/post-market-monitoring/incidents' } };
  }

  trustworthyOrchestration() {
    return { title: 'Trustworthy Orchestration Criteria', ...this.policyEngine.policyReport() };
  }

  regulatoryReport() {
    return {
      generatedAt: '2026-06-14T18:00:00.000Z',
      riskManagement: this.riskManagementSystem(),
      dataGovernance: this.dataGovernance(),
      technicalDocumentation: this.technicalDocumentation(),
      automaticLogging: this.automaticLogging(),
      transparencyExplainability: this.transparencyExplainability(),
      humanOversight: this.humanOversight(),
      postMarketMonitoring: this.postMarketMonitoring(),
      trustworthyOrchestration: this.trustworthyOrchestration(),
    };
  }
}

export function createAIActComplianceReportingService() {
  return new AIActComplianceReportingService();
}
