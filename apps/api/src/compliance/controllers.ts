import { createAIActComplianceReportingService, type AIActComplianceReportingService } from './reporting.js';

export interface ComplianceControllerResponse {
  status: number;
  body: unknown;
}

export class ComplianceReportingController {
  constructor(readonly service: AIActComplianceReportingService = createAIActComplianceReportingService()) {}

  handle(method: string, path: string): ComplianceControllerResponse | undefined {
    if (method !== 'GET') return undefined;
    if (path === '/compliance/risk-management') return { status: 200, body: this.service.riskManagementSystem() };
    if (path === '/compliance/data-governance') return { status: 200, body: this.service.dataGovernance() };
    if (path === '/compliance/technical-documentation') return { status: 200, body: this.service.technicalDocumentation() };
    if (path === '/compliance/automatic-logging') return { status: 200, body: this.service.automaticLogging() };
    if (path === '/compliance/transparency') return { status: 200, body: this.service.transparencyExplainability() };
    if (path === '/compliance/human-oversight') return { status: 200, body: this.service.humanOversight() };
    if (path === '/compliance/post-market-monitoring') return { status: 200, body: this.service.postMarketMonitoring() };
    if (path === '/compliance/trustworthy-orchestration') return { status: 200, body: this.service.trustworthyOrchestration() };
    if (path === '/compliance/regulatory-report') return { status: 200, body: this.service.regulatoryReport() };
    return undefined;
  }
}

export function createComplianceReportingController() {
  return new ComplianceReportingController();
}
