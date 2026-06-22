import { createAIActComplianceReportingService, type AIActComplianceReportingService } from './reporting.js';
import { createCompliancePlatformService, type CompliancePlatformService } from './compliancePlatformService.js';
import type { ComplianceFrameworkId, CorrectiveAction } from '../complianceControlLibrary.js';

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

export class CompliancePlatformController {
  constructor(readonly service: CompliancePlatformService = createCompliancePlatformService()) {}

  handle(method: string, path: string, body?: unknown, searchParams?: URLSearchParams): ComplianceControllerResponse | undefined {
    if (method === 'GET' && path === '/compliance/dashboard') {
      return { status: 200, body: this.service.dashboard() };
    }
    if (method === 'GET' && path === '/compliance/policy-registry') {
      return { status: 200, body: { policies: this.service.policyRegistry(), mock: false } };
    }
    if (method === 'GET' && path === '/compliance/corrective-actions') {
      const findingId = searchParams?.get('findingId') ?? undefined;
      return { status: 200, body: { correctiveActions: this.service.listCorrectiveActions(findingId), mock: false } };
    }
    const correctiveActionMatch = path.match(/^\/compliance\/corrective-actions\/([^/]+)$/);
    if (method === 'GET' && correctiveActionMatch) {
      try {
        return { status: 200, body: this.service.getCorrectiveAction(decodeURIComponent(correctiveActionMatch[1])) };
      } catch (error) {
        return { status: 404, body: { ok: false, error: { message: (error as Error).message } } };
      }
    }
    if (method === 'POST' && path === '/compliance/corrective-actions') {
      const input = (body ?? {}) as Record<string, unknown>;
      try {
        const created = this.service.createCorrectiveAction({
          findingId: String(input.findingId ?? ''),
          ownerId: String(input.ownerId ?? 'owner-compliance'),
          action: String(input.action ?? ''),
          dueAt: String(input.dueAt ?? ''),
          startWorkflow: Boolean(input.startWorkflow),
          approvalRequestId: input.approvalRequestId ? String(input.approvalRequestId) : undefined,
          actor: input.actor ? String(input.actor) : undefined,
        });
        return { status: 201, body: created };
      } catch (error) {
        return { status: 400, body: { ok: false, error: { message: (error as Error).message } } };
      }
    }
    const correctiveActionCloseMatch = path.match(/^\/compliance\/corrective-actions\/([^/]+)\/close$/);
    if (method === 'POST' && correctiveActionCloseMatch) {
      const input = (body ?? {}) as Record<string, unknown>;
      try {
        const closed = this.service.closeCorrectiveAction(
          decodeURIComponent(correctiveActionCloseMatch[1]),
          String(input.actor ?? 'compliance-officer'),
        );
        return { status: 200, body: closed };
      } catch (error) {
        return { status: 400, body: { ok: false, error: { message: (error as Error).message } } };
      }
    }
    const correctiveActionUpdateMatch = path.match(/^\/compliance\/corrective-actions\/([^/]+)\/updates$/);
    if (method === 'POST' && correctiveActionUpdateMatch) {
      const input = (body ?? {}) as Record<string, unknown>;
      try {
        const updated = this.service.updateCorrectiveAction(
          decodeURIComponent(correctiveActionUpdateMatch[1]),
          {
            ownerId: input.ownerId ? String(input.ownerId) : undefined,
            action: input.action ? String(input.action) : undefined,
            dueAt: input.dueAt ? String(input.dueAt) : undefined,
            status: input.status as CorrectiveAction['status'] | undefined,
            approvalRequestId: input.approvalRequestId ? String(input.approvalRequestId) : undefined,
          },
          String(input.actor ?? 'compliance-officer'),
        );
        return { status: 200, body: updated };
      } catch (error) {
        return { status: 400, body: { ok: false, error: { message: (error as Error).message } } };
      }
    }
    const correctiveActionDeleteMatch = path.match(/^\/compliance\/corrective-actions\/([^/]+)\/delete$/);
    if (method === 'POST' && correctiveActionDeleteMatch) {
      const input = (body ?? {}) as Record<string, unknown>;
      try {
        return { status: 200, body: this.service.deleteCorrectiveAction(decodeURIComponent(correctiveActionDeleteMatch[1]), String(input.actor ?? 'compliance-officer')) };
      } catch (error) {
        return { status: 404, body: { ok: false, error: { message: (error as Error).message } } };
      }
    }
    if (method === 'POST' && path === '/compliance/evidence-packets/generate') {
      const input = (body ?? {}) as Record<string, unknown>;
      try {
        const controlIds = Array.isArray(input.controlIds) ? input.controlIds.map(String) : [];
        const generated = this.service.generateEvidencePacket({
          id: String(input.id ?? `pkg-${Date.now().toString(36)}`),
          title: String(input.title ?? 'Compliance evidence packet'),
          controlIds,
          sealed: Boolean(input.sealed),
          frameworkIds: Array.isArray(input.frameworkIds) ? input.frameworkIds as ComplianceFrameworkId[] : undefined,
          approvalRequestIds: Array.isArray(input.approvalRequestIds) ? input.approvalRequestIds.map(String) : undefined,
          racetrackId: input.racetrackId ? String(input.racetrackId) : undefined,
        });
        return { status: 201, body: generated };
      } catch (error) {
        return { status: 400, body: { ok: false, error: { message: (error as Error).message } } };
      }
    }
    return undefined;
  }
}

export function createComplianceReportingController() {
  return new ComplianceReportingController();
}

export function createCompliancePlatformController(service?: CompliancePlatformService) {
  return new CompliancePlatformController(service);
}
