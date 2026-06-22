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
    if (method === 'POST' && path === '/compliance/evidence/intake') {
      const input = (body ?? {}) as Record<string, unknown>;
      try {
        const linkTargets = Array.isArray(input.linkTargets)
          ? input.linkTargets.map((entry) => {
              if (typeof entry !== 'object' || !entry) return null;
              const targetKind = String((entry as { targetKind?: string }).targetKind ?? '') as import('../complianceControlLibrary.js').ComplianceEvidenceLinkTargetKind;
              const targetId = String((entry as { targetId?: string }).targetId ?? '');
              if (!targetKind || !targetId) return null;
              return {
                targetKind,
                targetId,
                label: (entry as { label?: string }).label ? String((entry as { label?: string }).label) : undefined,
              };
            }).filter(Boolean) as import('../complianceControlLibrary.js').ComplianceEvidenceLinkTarget[]
          : undefined;
        const result = this.service.recordEvidenceIntake({
          title: String(input.title ?? ''),
          controlId: String(input.controlId ?? ''),
          frameworkIds: Array.isArray(input.frameworkIds) ? input.frameworkIds as ComplianceFrameworkId[] : input.frameworkIds ? [String(input.frameworkIds)] as ComplianceFrameworkId[] : undefined,
          policyCitation: input.policyCitation ? String(input.policyCitation) : undefined,
          domain: String(input.domain ?? 'governance') as import('../complianceControlLibrary.js').ComplianceEvidenceDomain,
          evidenceType: String(input.evidenceType ?? 'document') as import('../complianceControlLibrary.js').ComplianceEvidenceType,
          source: String(input.source ?? ''),
          notes: String(input.notes ?? ''),
          reviewStatus: String(input.reviewStatus ?? 'submitted') as import('../complianceControlLibrary.js').ComplianceEvidenceReviewStatus,
          approvalRequestId: input.approvalRequestId ? String(input.approvalRequestId) : undefined,
          auditRecordId: input.auditRecordId ? String(input.auditRecordId) : undefined,
          linkTargets,
          retentionPolicy: String(input.retentionPolicy ?? 'regulated-records-7y'),
          retainedUntil: input.retainedUntil ? String(input.retainedUntil) : undefined,
          legalHold: input.legalHold === true,
          uri: input.uri ? String(input.uri) : undefined,
          evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs.map(String) : undefined,
          startReviewWorkflow: input.startReviewWorkflow === true,
          reason: String(input.reason ?? 'Compliance evidence recorded'),
          entryMode: (input.entryMode ?? 'quick') as 'quick' | 'full',
          reportedBy: String(input.reportedBy ?? input.actorId ?? 'compliance-officer'),
        });
        return { status: 201, body: { ...result, mock: false } };
      } catch (error) {
        return { status: 400, body: { ok: false, error: { code: 'compliance_evidence_denied', message: (error as Error).message } } };
      }
    }
    if (method === 'POST' && path === '/compliance/evidence/metadata-patch') {
      const input = (body ?? {}) as Record<string, unknown>;
      try {
        const evidenceId = String(input.evidenceId ?? input.entityId ?? '');
        const result = this.service.patchEvidenceMetadata(
          evidenceId,
          {
            reviewStatus: input.reviewStatus ? String(input.reviewStatus) as import('../complianceControlLibrary.js').ComplianceEvidenceReviewStatus : undefined,
            notes: input.notes !== undefined ? String(input.notes) : undefined,
          },
          String(input.actorId ?? input.reportedBy ?? 'compliance-officer'),
          input.reason ? String(input.reason) : undefined,
        );
        return { status: 200, body: { ...result, mock: false } };
      } catch (error) {
        return { status: 400, body: { ok: false, error: { code: 'compliance_evidence_patch_denied', message: (error as Error).message } } };
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
