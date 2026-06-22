import type {
  DataEntryPipelineEmissionKind,
  DataEntryPipelineEmissionRecord,
  DataEntryPipelinePlan,
  DataEntryPipelineResult,
  DataEntryScope,
} from '@trackmind/shared';
import {
  assertDataEntryPipelineIntegrity,
  buildDataEntryPipelinePlan,
} from '@trackmind/shared';
import type { CentralizedApprovalService } from '../approvals.js';
import { isProtectedAction, type ProtectedAction } from '@trackmind/shared';
import { appendAudit, type AuditAppendTarget } from '../auditAdapter.js';
import type { UniversalEventBus } from '../eventBus.js';

export interface DataEntryPipelineDependencies {
  audit: AuditAppendTarget;
  eventBus?: UniversalEventBus;
  approvals?: CentralizedApprovalService;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function controlledActionForApproval(_plan: DataEntryPipelinePlan, values: Record<string, unknown>): ProtectedAction {
  const requested = String(values.requestedAction ?? values.action ?? '');
  if (isProtectedAction(requested)) return requested;
  return 'compliance-filing-approval';
}

export class DataEntryArtifactPipelineExecutor {
  constructor(private readonly deps: DataEntryPipelineDependencies) {}

  execute(
    plan: DataEntryPipelinePlan,
    scope: DataEntryScope,
    values: Record<string, unknown>,
    primaryAuditId: string,
  ): DataEntryPipelineResult {
    this.assertDependencies(plan);

    const emissions: DataEntryPipelineEmissionRecord[] = [];
    const lineageRefs: string[] = [primaryAuditId];
    const kpiSourceEventIds: string[] = [];
    const digitalTwinUpdateIds: string[] = [];
    const complianceEvidenceLinkIds: string[] = [];
    let artifactId: string | undefined;
    let approvalRequestId: string | undefined;
    let aiArtifactId: string | undefined;

    const record = (kind: DataEntryPipelineEmissionKind, id: string, extras: Partial<DataEntryPipelineEmissionRecord> = {}) => {
      emissions.push({ kind, id, ...extras });
      lineageRefs.push(id);
    };

    record('audit', primaryAuditId, { auditId: primaryAuditId });

    const eventId = nextId('event-de');
    appendAudit(this.deps.audit, {
      id: eventId,
      type: 'data-change',
      actor: scope.actorId,
      actorType: 'human',
      timestamp: new Date().toISOString(),
      action: plan.domainEventType,
      reason: String(values.reason ?? values.note ?? 'Data entry domain event'),
      actionClass: 'api',
      subjectId: plan.subjectId,
      correlationId: plan.correlationId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      sourceService: 'trackmind-data-entry-pipeline',
      payload: { entityKind: plan.entityKind, mode: plan.mode, values, auditRef: primaryAuditId },
    });
    record('domain-event', eventId, { eventId, auditId: eventId });
    void this.publishEvent(plan.domainEventType, scope, plan, values, primaryAuditId, eventId);

    artifactId = nextId('artifact-de');
    appendAudit(this.deps.audit, {
      id: artifactId,
      type: 'data-change',
      actor: scope.actorId,
      actorType: 'human',
      timestamp: new Date().toISOString(),
      action: 'artifact.registry.registered',
      reason: 'Operational data entry artifact',
      actionClass: 'service',
      subjectId: plan.subjectId,
      correlationId: plan.correlationId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      sourceService: 'trackmind-data-entry-pipeline',
      payload: {
        artifactId,
        artifactType: plan.artifactType,
        entityKind: plan.entityKind,
        values,
        auditRef: primaryAuditId,
        eventRef: eventId,
      },
    });
    record('operational-artifact', artifactId, { artifactId, auditId: artifactId });

    const lineageId = nextId('lineage-de');
    appendAudit(this.deps.audit, {
      id: lineageId,
      type: 'data-change',
      actor: scope.actorId,
      actorType: 'service',
      timestamp: new Date().toISOString(),
      action: 'lineage.data-entry.recorded',
      reason: 'Data entry lineage chain',
      actionClass: 'service',
      subjectId: plan.subjectId,
      correlationId: plan.correlationId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      sourceService: 'trackmind-data-entry-pipeline',
      payload: {
        lineageId,
        refs: [...new Set(lineageRefs)],
        artifactId,
        auditRef: primaryAuditId,
        eventRef: eventId,
      },
    });
    record('lineage', lineageId, { auditId: lineageId });

    if (plan.emissions.includes('kpi-source-event')) {
      for (const kpiKey of plan.kpiSourceKeys) {
        const kpiEventId = nextId('kpi-src');
        appendAudit(this.deps.audit, {
          id: kpiEventId,
          type: 'data-change',
          actor: scope.actorId,
          actorType: 'service',
          timestamp: new Date().toISOString(),
          action: 'kpi.source.event.recorded',
          reason: `KPI source event for ${kpiKey}`,
          actionClass: 'service',
          subjectId: plan.subjectId,
          correlationId: plan.correlationId,
          tenantId: scope.tenantId,
          racetrackId: scope.racetrackId,
          sourceService: 'trackmind-data-entry-pipeline',
          payload: { kpiKey, entityKind: plan.entityKind, artifactId, auditRef: primaryAuditId },
        });
        kpiSourceEventIds.push(kpiEventId);
        record('kpi-source-event', kpiEventId, { eventId: kpiEventId, kpiSourceKey: kpiKey });
      }
    }

    if (plan.emissions.includes('digital-twin-update') && plan.digitalTwinRefs.length > 0) {
      for (const twinRef of plan.digitalTwinRefs) {
        const twinUpdateId = nextId('twin-upd');
        appendAudit(this.deps.audit, {
          id: twinUpdateId,
          type: 'digital-twin-update',
          actor: scope.actorId,
          actorType: 'service',
          timestamp: new Date().toISOString(),
          action: 'digitalTwin.updated',
          reason: 'Data entry digital twin sync point',
          actionClass: 'service',
          subjectId: twinRef,
          correlationId: plan.correlationId,
          tenantId: scope.tenantId,
          racetrackId: scope.racetrackId,
          sourceService: 'trackmind-data-entry-pipeline',
          payload: { twinRef, entityKind: plan.entityKind, values, auditRef: primaryAuditId, artifactId },
        });
        digitalTwinUpdateIds.push(twinUpdateId);
        record('digital-twin-update', twinUpdateId, { auditId: twinUpdateId, digitalTwinRef: twinRef });
      }
    }

    if (plan.emissions.includes('compliance-evidence-link')) {
      const links = [...plan.complianceLinks];
      if (links.length === 0 && values.controlId) {
        links.push({ targetKind: 'control', targetId: String(values.controlId) });
      }
      for (const link of links) {
        const linkId = nextId('compliance-link');
        appendAudit(this.deps.audit, {
          id: linkId,
          type: 'data-change',
          actor: scope.actorId,
          actorType: 'human',
          timestamp: new Date().toISOString(),
          action: 'compliance.evidence.linked',
          reason: 'Compliance evidence link from data entry',
          actionClass: 'api',
          subjectId: link.targetId,
          correlationId: plan.correlationId,
          tenantId: scope.tenantId,
          racetrackId: scope.racetrackId,
          sourceService: 'trackmind-data-entry-pipeline',
          payload: { ...link, artifactId, auditRef: primaryAuditId, evidenceRefs: plan.evidenceRefs },
        });
        complianceEvidenceLinkIds.push(linkId);
        record('compliance-evidence-link', linkId, { complianceLinkId: linkId, auditId: linkId });
      }
      for (const evidenceRef of plan.evidenceRefs) {
        const evidenceLinkId = nextId('evidence-ref');
        appendAudit(this.deps.audit, {
          id: evidenceLinkId,
          type: 'data-change',
          actor: scope.actorId,
          actorType: 'human',
          timestamp: new Date().toISOString(),
          action: 'compliance.evidence.ref.linked',
          reason: 'Evidence URI linked from data entry',
          actionClass: 'api',
          subjectId: plan.subjectId,
          correlationId: plan.correlationId,
          tenantId: scope.tenantId,
          racetrackId: scope.racetrackId,
          sourceService: 'trackmind-data-entry-pipeline',
          payload: { evidenceRef, artifactId, auditRef: primaryAuditId },
        });
        complianceEvidenceLinkIds.push(evidenceLinkId);
        record('compliance-evidence-link', evidenceLinkId, { complianceLinkId: evidenceLinkId, auditId: evidenceLinkId });
      }
    }

    if (plan.emissions.includes('ai-readable-artifact') && plan.aiReadableAllowed) {
      aiArtifactId = nextId('ai-artifact');
      appendAudit(this.deps.audit, {
        id: aiArtifactId,
        type: 'data-change',
        actor: scope.actorId,
        actorType: 'service',
        timestamp: new Date().toISOString(),
        action: 'ai.artifact.data-entry.registered',
        reason: 'AI-readable operational artifact (advisory lineage only)',
        actionClass: 'service',
        subjectId: plan.subjectId,
        correlationId: plan.correlationId,
        tenantId: scope.tenantId,
        racetrackId: scope.racetrackId,
        sourceService: 'trackmind-data-entry-pipeline',
        payload: {
          artifactId,
          aiArtifactId,
          entityKind: plan.entityKind,
          advisoryOnly: true,
          executionAllowed: false,
          lineageRefs: [...new Set(lineageRefs)],
        },
      });
      record('ai-readable-artifact', aiArtifactId, { artifactId: aiArtifactId, auditId: aiArtifactId });
    }

    if (plan.emissions.includes('approval-request')) {
      if (!this.deps.approvals) {
        throw new Error('Approval service unavailable — cannot bypass approval pipeline');
      }
      const request = this.deps.approvals.createRequest({
        tenantId: scope.tenantId,
        racetrackId: scope.racetrackId,
        action: controlledActionForApproval(plan, values),
        target: plan.subjectId,
        requestedBy: scope.actorId,
        actorType: 'human',
        reason: String(values.reason ?? values.requestTitle ?? `Data entry approval for ${plan.entityKind}`),
        evidence: [primaryAuditId, artifactId, ...plan.evidenceRefs].filter(Boolean),
      });
      approvalRequestId = request.id;
      record('approval-request', request.id, { approvalRequestId: request.id, auditId: primaryAuditId });
    }

    const result: DataEntryPipelineResult = {
      schemaVersion: 'trackmind.data-entry-artifact-pipeline.v1',
      complete: true,
      bypassBlocked: true,
      emissions,
      lineageRefs: [...new Set(lineageRefs)],
      artifactId,
      approvalRequestId,
      kpiSourceEventIds,
      digitalTwinUpdateIds,
      complianceEvidenceLinkIds,
      aiArtifactId,
    };

    const integrity = assertDataEntryPipelineIntegrity(plan, result);
    if (!integrity.valid) {
      throw new Error(`Data entry artifact pipeline incomplete: ${integrity.errors.join('; ')}`);
    }

    return result;
  }

  private assertDependencies(plan: DataEntryPipelinePlan): void {
    if (plan.emissions.includes('approval-request') && !this.deps.approvals) {
      throw new Error('Approval pipeline dependency missing — submission blocked');
    }
  }

  private publishEvent(
    eventType: string,
    scope: DataEntryScope,
    plan: DataEntryPipelinePlan,
    values: Record<string, unknown>,
    auditRef: string,
    eventId: string,
  ): void {
    if (!this.deps.eventBus) return;
    void this.deps.eventBus.publish({
      type: eventType,
      payload: {
        entityKind: plan.entityKind,
        mode: plan.mode,
        subjectId: plan.subjectId,
        values,
        auditRef,
        artifactPipeline: true,
      },
      aggregateId: plan.subjectId,
      producer: 'trackmind-data-entry-pipeline',
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      correlationId: plan.correlationId,
      auditRef,
      actor: { id: scope.actorId, type: 'human' },
      subject: { id: plan.subjectId, type: plan.entityKind, tenantId: scope.tenantId },
      metadata: {
        tenantId: scope.tenantId,
        racetrackId: scope.racetrackId,
        team: 'data-entry',
        accountableRole: 'organization-admin',
        compliance: 'regulated',
        eventId,
      },
    });
  }
}

export function buildDataEntryPipelinePlanForSubmit(
  entityKind: Parameters<typeof buildDataEntryPipelinePlan>[0],
  mode: Parameters<typeof buildDataEntryPipelinePlan>[1],
  values: Record<string, unknown>,
  scope: DataEntryScope,
  recordId?: string,
): DataEntryPipelinePlan {
  return buildDataEntryPipelinePlan(entityKind, mode, values, scope, recordId);
}
