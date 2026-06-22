import type { ApprovalComposerResultDto, ApprovalComposeMode, ApprovalRiskLevel, ApprovalSourceDomain, Role } from '@trackmind/shared';
import {
  buildControlledActionFromComposer,
  validateApprovalComposer,
} from '@trackmind/shared';
import type { CentralizedApprovalService } from './approvals.js';
import type { ControlledActionRequest } from './approvals.js';

export interface ApprovalComposerScope {
  tenantId: string;
  racetrackId: string;
  actorId: string;
  actorType?: 'human' | 'ai-agent' | 'service';
  roles?: Role[];
}

export class ApprovalRequestComposerService {
  constructor(private readonly approvals: CentralizedApprovalService) {}

  compose(scope: ApprovalComposerScope, values: Record<string, unknown>): ApprovalComposerResultDto {
    const mode = (values.composeMode as ApprovalComposeMode | undefined) ?? 'quick';
    const validation = validateApprovalComposer(values, mode);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const controlled = buildControlledActionFromComposer(
      { ...scope, actorType: scope.actorType ?? 'human' },
      values,
      mode,
    );

    const request = this.approvals.createRequest({
      tenantId: controlled.tenantId,
      racetrackId: controlled.racetrackId,
      action: controlled.action,
      target: controlled.target,
      requestedBy: controlled.requestedBy,
      actorType: controlled.actorType,
      reason: controlled.reason,
      evidence: controlled.evidence,
      expiresAt: controlled.expiresAt,
    });

    return this.toResult(request, values);
  }

  private toResult(request: ControlledActionRequest, values: Record<string, unknown>): ApprovalComposerResultDto {
    const relatedEntityKind = values.relatedEntityKind ? String(values.relatedEntityKind) : undefined;
    const relatedEntityId = values.relatedEntityId ? String(values.relatedEntityId) : undefined;
    const relatedIncidentId = values.relatedIncidentId ? String(values.relatedIncidentId) : undefined;
    const relatedRecommendationId = values.relatedRecommendationId ? String(values.relatedRecommendationId) : undefined;

    return {
      accepted: true,
      approvalId: request.id,
      approvalRequestId: request.id,
      requestTitle: String(values.requestTitle ?? ''),
      sourceDomain: String(values.sourceDomain ?? 'administrative-change') as ApprovalSourceDomain,
      requestedAction: request.action,
      target: request.target,
      status: request.status,
      expiresAt: request.expiresAt,
      riskLevel: String(values.riskLevel ?? 'medium') as ApprovalRiskLevel,
      requestedApproverRole: String(values.requestedApproverRole ?? 'steward') as Role,
      relatedEntity: relatedEntityKind && relatedEntityId ? { kind: relatedEntityKind, id: relatedEntityId } : undefined,
      relatedIncidentId,
      relatedRecommendationId,
      auditLinkage: {
        auditIds: [`audit:approval:${request.id}`],
        eventIds: [`event:approval.requested:${request.id}`],
        correlationId: request.id,
        workflowInstanceId: request.workflowInstanceId,
        workflowTaskId: request.workflowTaskId,
      },
      message: 'Approval request composed and queued. Execution remains locked until authorized — no protected action was executed.',
      mock: false,
    };
  }
}
