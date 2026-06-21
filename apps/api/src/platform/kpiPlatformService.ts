import {
  computeKpiTrend,
  definitionFromArtifact,
  evaluateKpiStatus,
  type KPIArtifact,
  type KPIThresholdRule,
  type KpiDefinitionDto,
  type KpiDefinitionRegistryDto,
  type KpiMutationDraftResultDto,
  type KpiRegistryDto,
  type KpiRegistryEntryDto,
  type KpiSourceMappingDto,
  type KpiSourcesDto,
  type KpiThresholdListDto,
  type KpiThresholdRecordDto,
} from '@trackmind/shared';
import type { CentralizedApprovalService } from '../approvals.js';

const now = () => new Date().toISOString();

export interface KpiPlatformScope {
  tenantId: string;
  organizationId: string;
  racetrackId?: string;
}

export interface KpiDefinitionDraftInput {
  kpiId: string;
  domain: KpiDefinitionDto['domain'];
  name: string;
  description: string;
  metricType: KpiDefinitionDto['metricType'];
  unit: string;
  target: number;
  ownerRole: KpiDefinitionDto['ownerRole'];
  visibility: KpiDefinitionDto['visibility'];
  approvalSensitivity: KpiDefinitionDto['approvalSensitivity'];
  calculationMethod: string;
  refreshCadence: string;
  sourceEvents: string[];
  sourceEntities: KpiDefinitionDto['sourceEntities'];
  requestedBy: string;
  reason: string;
  evidence: string[];
}

export interface KpiThresholdDraftInput {
  kpiId: string;
  warning?: number;
  critical?: number;
  targetDirection: KPIThresholdRule['targetDirection'];
  description: string;
  requestedBy: string;
  reason: string;
  evidence: string[];
}

export class KpiPlatformService {
  private definitions = new Map<string, KpiDefinitionDto>();
  private thresholds = new Map<string, KpiThresholdRecordDto[]>();
  private pendingDrafts = new Map<string, { kind: 'definition' | 'threshold'; payload: unknown }>();

  constructor(initialArtifacts: KPIArtifact[] = []) {
    this.seedFromArtifacts(initialArtifacts);
  }

  seedFromArtifacts(artifacts: KPIArtifact[]): void {
    for (const artifact of artifacts) {
      this.definitions.set(artifact.kpiId, definitionFromArtifact(artifact));
      this.thresholds.set(artifact.kpiId, [{
        thresholdId: `threshold-${artifact.kpiId}-active`,
        kpiId: artifact.kpiId,
        tenantId: artifact.tenantId,
        racetrackId: artifact.racetrackId,
        warning: artifact.threshold.warning,
        critical: artifact.threshold.critical,
        targetDirection: artifact.threshold.targetDirection,
        description: artifact.threshold.description,
        effectiveFrom: artifact.createdAt,
        status: 'active',
        auditEventIds: [`audit-${artifact.kpiId}-threshold-seed`],
        createdAt: artifact.createdAt,
      }]);
    }
  }

  syncArtifacts(artifacts: KPIArtifact[]): KPIArtifact[] {
    return artifacts.map((artifact) => {
      const definition = this.definitions.get(artifact.kpiId);
      const activeThreshold = this.getActiveThreshold(artifact.kpiId);
      if (!definition && !activeThreshold) return artifact;
      const threshold = activeThreshold
        ? {
            warning: activeThreshold.warning,
            critical: activeThreshold.critical,
            targetDirection: activeThreshold.targetDirection,
            description: activeThreshold.description,
          }
        : artifact.threshold;
      const value = artifact.value;
      const status = evaluateKpiStatus(value, threshold, definition?.metricType ?? artifact.metricType, artifact.status);
      const trend = computeKpiTrend(artifact.historicalSnapshots, value);
      return {
        ...artifact,
        ...(definition ? {
          name: definition.name,
          description: definition.description,
          ownerRole: definition.ownerRole,
          visibility: definition.visibility,
          approvalSensitivity: definition.approvalSensitivity,
          calculationMethod: definition.calculationMethod,
          refreshCadence: definition.refreshCadence,
          sourceEvents: definition.sourceEvents,
          sourceEntities: definition.sourceEntities,
          version: definition.version,
          updatedAt: definition.updatedAt,
        } : {}),
        threshold,
        status,
        trend,
      };
    });
  }

  listDefinitions(scope?: Partial<KpiPlatformScope>): KpiDefinitionRegistryDto {
    const definitions = [...this.definitions.values()].filter((definition) => this.inScope(definition, scope));
    return { generatedAt: now(), definitions, mock: false };
  }

  getDefinition(kpiId: string): KpiDefinitionDto | undefined {
    return this.definitions.get(kpiId);
  }

  listThresholds(scope?: Partial<KpiPlatformScope>): KpiThresholdListDto {
    const thresholds = [...this.thresholds.values()]
      .flat()
      .filter((threshold) => this.inScope(threshold, scope));
    return { generatedAt: now(), thresholds, mock: false };
  }

  getActiveThreshold(kpiId: string): KpiThresholdRecordDto | undefined {
    return this.thresholds.get(kpiId)?.find((threshold) => threshold.status === 'active');
  }

  registry(scope: KpiPlatformScope, artifacts: KPIArtifact[]): KpiRegistryDto {
    const entries: KpiRegistryEntryDto[] = artifacts
      .filter((artifact) => this.inScope(artifact, scope))
      .map((artifact) => {
        const definition = this.definitions.get(artifact.kpiId);
        const active = this.getActiveThreshold(artifact.kpiId);
        const pending = this.thresholds.get(artifact.kpiId)?.some((threshold) => threshold.status === 'pending-approval');
        return {
          kpiId: artifact.kpiId,
          domain: artifact.domain,
          name: definition?.name ?? artifact.name,
          ownerRole: definition?.ownerRole ?? artifact.ownerRole,
          visibility: definition?.visibility ?? artifact.visibility,
          approvalSensitivity: definition?.approvalSensitivity ?? artifact.approvalSensitivity,
          sourceEventCount: (definition?.sourceEvents ?? artifact.sourceEvents).length,
          sourceEntityCount: (definition?.sourceEntities ?? artifact.sourceEntities).length,
          thresholdStatus: pending ? 'pending-approval' : active ? 'active' : 'none',
          lastCalculatedAt: artifact.lastCalculatedAt,
        };
      });
    return {
      generatedAt: now(),
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      racetrackId: scope.racetrackId,
      entries,
      mock: false,
    };
  }

  consolidatedSources(artifacts: KPIArtifact[]): KpiSourcesDto {
    const mappings: KpiSourceMappingDto[] = artifacts.map((artifact) => ({
      kpiId: artifact.kpiId,
      domain: artifact.domain,
      sourceEvents: [...artifact.sourceEvents],
      sourceEntities: [...artifact.sourceEntities],
      calculationMethod: artifact.calculationMethod,
      auditEventIds: [...(artifact.auditReference.auditEventIds ?? [])],
      eventIds: [...artifact.auditReference.eventIds],
      correlationId: artifact.auditReference.correlationId,
    }));
    const consolidatedEventRefs = [...new Set(mappings.flatMap((mapping) => mapping.sourceEvents))].sort();
    return { generatedAt: now(), mappings, consolidatedEventRefs, mock: false };
  }

  createDefinitionDraft(input: KpiDefinitionDraftInput, scope: KpiPlatformScope): KpiMutationDraftResultDto {
    const draftId = `kpi-def-draft-${input.kpiId}-${Date.now().toString(36)}`;
    const auditEventIds = [`audit-${draftId}`];
    const definition: KpiDefinitionDto = {
      kpiId: input.kpiId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      racetrackId: scope.racetrackId,
      domain: input.domain,
      name: input.name,
      description: input.description,
      metricType: input.metricType,
      unit: input.unit,
      target: input.target,
      ownerRole: input.ownerRole,
      visibility: input.visibility,
      approvalSensitivity: input.approvalSensitivity,
      calculationMethod: input.calculationMethod,
      refreshCadence: input.refreshCadence,
      sourceEvents: [...input.sourceEvents],
      sourceEntities: [...input.sourceEntities],
      modelReadable: input.visibility !== 'veterinary-restricted',
      version: 'draft',
      createdAt: now(),
      updatedAt: now(),
    };
    this.pendingDrafts.set(draftId, { kind: 'definition', payload: definition });
    return {
      accepted: true,
      draftId,
      kpiId: input.kpiId,
      eventType: 'kpi.definition.draft.created',
      approvalRequired: false,
      message: 'KPI definition draft recorded. Definitions remain draft-only until published through governed review.',
      auditEventIds,
      mock: false,
    };
  }

  createThresholdDraft(
    input: KpiThresholdDraftInput,
    scope: KpiPlatformScope,
    approvalService: CentralizedApprovalService,
  ): KpiMutationDraftResultDto {
    const definition = this.definitions.get(input.kpiId);
    if (!definition) throw new Error(`Unknown KPI definition ${input.kpiId}`);
    const draftId = `kpi-threshold-draft-${input.kpiId}-${Date.now().toString(36)}`;
    const auditEventIds = [`audit-${draftId}`];
    const approvalRequired = definition.approvalSensitivity === 'approval-required-for-threshold-change'
      || definition.approvalSensitivity === 'regulated-advisory-only'
      || definition.approvalSensitivity === 'approval-visible';
    let approvalId: string | undefined;
    if (approvalRequired) {
      const request = approvalService.createRequest({
        tenantId: scope.tenantId,
        racetrackId: scope.racetrackId ?? 'main-track',
        action: 'kpi-threshold-change',
        target: input.kpiId,
        requestedBy: input.requestedBy,
        actorType: 'human',
        reason: input.reason,
        evidence: input.evidence.length ? input.evidence : [`threshold-draft:${draftId}`],
      });
      approvalId = request.id;
    }
    const pending: KpiThresholdRecordDto = {
      thresholdId: draftId,
      kpiId: input.kpiId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      warning: input.warning,
      critical: input.critical,
      targetDirection: input.targetDirection,
      description: input.description,
      effectiveFrom: now(),
      status: approvalRequired ? 'pending-approval' : 'active',
      approvalId,
      auditEventIds,
      createdAt: now(),
    };
    const existing = this.thresholds.get(input.kpiId) ?? [];
    if (!approvalRequired) {
      for (const threshold of existing) {
        if (threshold.status === 'active') threshold.status = 'superseded';
      }
    }
    this.thresholds.set(input.kpiId, [...existing, pending]);
    this.pendingDrafts.set(draftId, { kind: 'threshold', payload: pending });
    return {
      accepted: true,
      draftId,
      kpiId: input.kpiId,
      eventType: 'kpi.threshold.draft.created',
      approvalId,
      approvalRequired,
      message: approvalRequired
        ? 'KPI threshold change draft accepted. Threshold remains pending until human approval is recorded.'
        : 'KPI threshold updated without approval gate for this sensitivity level.',
      auditEventIds,
      mock: false,
    };
  }

  applyApprovedThreshold(kpiId: string, approvalId: string): KpiThresholdRecordDto | undefined {
    const records = this.thresholds.get(kpiId);
    if (!records) return undefined;
    const pending = records.find((record) => record.approvalId === approvalId && record.status === 'pending-approval');
    if (!pending) return undefined;
    for (const record of records) {
      if (record.status === 'active') record.status = 'superseded';
    }
    pending.status = 'active';
    pending.effectiveFrom = now();
    pending.auditEventIds = [...pending.auditEventIds, `audit-${approvalId}-applied`];
    return pending;
  }

  publishDefinitionDraft(draftId: string): KpiDefinitionDto | undefined {
    const draft = this.pendingDrafts.get(draftId);
    if (!draft || draft.kind !== 'definition') return undefined;
    const definition = draft.payload as KpiDefinitionDto;
    definition.version = `1.0.${this.definitions.size + 1}`;
    definition.updatedAt = now();
    this.definitions.set(definition.kpiId, definition);
    this.pendingDrafts.delete(draftId);
    return definition;
  }

  private inScope(
    record: { tenantId: string; organizationId?: string; racetrackId?: string },
    scope?: Partial<KpiPlatformScope>,
  ): boolean {
    if (!scope) return true;
    if (scope.tenantId && record.tenantId !== scope.tenantId) return false;
    if (scope.organizationId && record.organizationId && record.organizationId !== scope.organizationId) return false;
    if (scope.racetrackId && record.racetrackId && record.racetrackId !== scope.racetrackId) return false;
    return true;
  }
}
