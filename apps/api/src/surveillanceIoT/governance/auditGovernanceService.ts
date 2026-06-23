import type {
  SurveillanceIoTGovernanceAuditRecordDto,
  SurveillanceIoTGovernanceWorkspaceDto,
  SurveillanceIoTModuleLayer,
} from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SurveillanceIoTWorkspaceDto } from '@trackmind/shared';
import type { SurveillanceAdapterRegistry } from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';
import { auditIds } from '../types.js';

export class AuditGovernanceService {
  private readonly auditTrail: SurveillanceIoTGovernanceAuditRecordDto[] = [];

  record(
    ctx: SurveillanceIoTModuleContext,
    layer: SurveillanceIoTModuleLayer,
    action: string,
    subjectId: string,
    evidence: string[] = [],
  ): SurveillanceIoTGovernanceAuditRecordDto {
    const envelope = auditIds(ctx.now, `${layer}:${action}:${subjectId}`);
    const entry: SurveillanceIoTGovernanceAuditRecordDto = {
      auditId: envelope.auditId,
      action,
      layer,
      actorId: ctx.actor.id,
      subjectId,
      timestamp: ctx.now,
      evidence,
    };
    this.auditTrail.unshift(entry);
    if (this.auditTrail.length > 200) this.auditTrail.pop();
    return entry;
  }

  buildGovernanceWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
  ): SurveillanceIoTGovernanceWorkspaceDto {
    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      auditTrail: [...this.auditTrail],
      retentionPolicies: workspace.retentionPolicies,
      adapterCompliance: adapterRegistry.list().map((adapter) => ({
        adapterId: adapter.adapterId,
        connectorId: adapter.connectorId,
        contractKind: adapter.contractKind,
        contractId: adapter.contractId,
        status: adapter.status,
        integrationReadiness: adapter.integrationReadiness,
        operationalStatus: adapter.operationalStatus,
        activeIntegrationClaimed: adapter.activeIntegrationClaimed,
        lastSyncAt: adapter.lastSyncAt,
      })),
      mock: false,
    };
  }

  auditForSubject(subjectId: string): SurveillanceIoTGovernanceAuditRecordDto[] {
    return this.auditTrail.filter((entry) => entry.subjectId === subjectId);
  }
}
