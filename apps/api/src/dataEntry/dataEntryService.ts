import type {
  DataEntryDraftRecord,
  DataEntryEntityKind,
  DataEntryFormMode,
  DataEntryMutationResult,
  DataEntryScope,
  DataEntryValidationResult,
  DataQualityValidationContext,
  DataQualityValidationResult,
} from '@trackmind/shared';
import {
  buildDataEntryAuditMetadata,
  enrichPayloadWithScope,
  getDataEntryFormDefinition,
  listDataEntryFormDefinitions,
  resolveSubmitPath,
  validateDataEntryForm,
  validateDataEntryWithQuality,
  assertDataEntryTenantScope,
  filterVisibleFields,
  canAccessForm,
  buildDataEntryPipelinePlan,
  mergePipelineIntoMutationResult,
  canRoleAccessDataEntryEntity,
  type DataEntryDraftStatus,
} from '@trackmind/shared';
import {
  computeBaselineFingerprint,
  computeDraftExpiresAt,
  defaultDraftRetentionDays,
  detectDraftBaselineConflict,
  extractRecordVersion,
  isDraftExpired,
} from '@trackmind/shared';
import { appendAudit, type AuditAppendTarget } from '../auditAdapter.js';
import type { UniversalEventBus } from '../eventBus.js';
import type { CentralizedApprovalService } from '../approvals.js';
import {
  DataEntryArtifactPipelineExecutor,
  type DataEntryPipelineDependencies,
} from './dataEntryArtifactPipelineExecutor.js';

export interface DataEntryDraftStore {
  save(record: DataEntryDraftRecord): DataEntryDraftRecord;
  get(draftId: string, scope: Pick<DataEntryScope, 'tenantId' | 'actorId'>): DataEntryDraftRecord | undefined;
  delete(draftId: string, scope: Pick<DataEntryScope, 'tenantId' | 'actorId'>): boolean;
  list(entityKind: DataEntryEntityKind | undefined, scope: Pick<DataEntryScope, 'tenantId' | 'actorId'>): DataEntryDraftRecord[];
}

export class InMemoryDataEntryDraftStore implements DataEntryDraftStore {
  private drafts = new Map<string, DataEntryDraftRecord>();

  save(record: DataEntryDraftRecord): DataEntryDraftRecord {
    this.drafts.set(record.draftId, record);
    return record;
  }

  get(draftId: string, scope: Pick<DataEntryScope, 'tenantId' | 'actorId'>): DataEntryDraftRecord | undefined {
    const record = this.drafts.get(draftId);
    if (!record) return undefined;
    if (record.scope.tenantId !== scope.tenantId || record.scope.actorId !== scope.actorId) return undefined;
    return record;
  }

  delete(draftId: string, scope: Pick<DataEntryScope, 'tenantId' | 'actorId'>): boolean {
    const record = this.get(draftId, scope);
    if (!record) return false;
    return this.drafts.delete(draftId);
  }

  list(entityKind: DataEntryEntityKind | undefined, scope: Pick<DataEntryScope, 'tenantId' | 'actorId'>): DataEntryDraftRecord[] {
    return [...this.drafts.values()].filter((record) =>
      record.scope.tenantId === scope.tenantId
      && record.scope.actorId === scope.actorId
      && (!entityKind || record.entityKind === entityKind),
    );
  }
}

let draftCounter = 0;
function nextDraftId(): string {
  draftCounter += 1;
  return `draft-${Date.now()}-${draftCounter}`;
}

function nextAuditId(): string {
  return `audit-de-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class DataEntryService {
  private readonly pipeline: DataEntryArtifactPipelineExecutor;

  constructor(
    private readonly drafts: DataEntryDraftStore,
    private readonly audit: AuditAppendTarget,
    pipelineDeps?: Omit<DataEntryPipelineDependencies, 'audit'>,
  ) {
    this.pipeline = new DataEntryArtifactPipelineExecutor({
      audit: this.audit,
      ...pipelineDeps,
    });
  }

  listForms(scope: DataEntryScope) {
    return listDataEntryFormDefinitions()
      .filter((definition) => canAccessForm(definition, scope.role))
      .filter((definition) => canRoleAccessDataEntryEntity(scope.role, definition.entityKind, 'view'))
      .map((definition) => ({
        entityKind: definition.entityKind,
        displayName: definition.displayName,
        modes: definition.modes,
        draft: definition.draft,
        autosave: definition.autosave,
        auditAction: definition.auditAction,
        fields: filterVisibleFields(definition, scope.role),
      }));
  }

  getForm(entityKind: DataEntryEntityKind, mode: DataEntryFormMode, scope: DataEntryScope) {
    const definition = getDataEntryFormDefinition(entityKind, mode);
    if (!canAccessForm(definition, scope.role)) {
      throw new Error(`Role ${scope.role} cannot access ${entityKind} form`);
    }
    if (!canRoleAccessDataEntryEntity(scope.role, entityKind, mode === 'edit' ? 'edit' : 'create')) {
      throw new Error(`Role ${scope.role} cannot access ${entityKind} entity domain`);
    }
    return {
      ...definition,
      fields: filterVisibleFields(definition, scope.role),
      submitPath: resolveSubmitPath(definition, mode, {}),
    };
  }

  validate(
    entityKind: DataEntryEntityKind,
    values: Record<string, unknown>,
    scope: DataEntryScope,
    mode: DataEntryFormMode = 'create',
    quality?: Pick<DataQualityValidationContext, 'references' | 'baseline' | 'batchValues' | 'batchRowIndex' | 'staleReferenceMaxAgeHours'>,
  ): DataEntryValidationResult {
    const definition = getDataEntryFormDefinition(entityKind, mode);
    if (!canAccessForm(definition, scope.role)) {
      return { valid: false, errors: [`Role ${scope.role} cannot access ${entityKind} form`], normalizedValues: {} };
    }
    if (!canRoleAccessDataEntryEntity(scope.role, entityKind, mode === 'edit' ? 'edit' : 'create')) {
      return { valid: false, errors: [`Role ${scope.role} cannot access ${entityKind} entity domain`], normalizedValues: {} };
    }
    if (quality?.references || quality?.baseline || quality?.batchValues) {
      return this.validateWithQuality(entityKind, values, scope, mode, quality);
    }
    const scoped = enrichPayloadWithScope(scope, values);
    const scopeCheck = assertDataEntryTenantScope(scope, scoped);
    if (!scopeCheck.valid) {
      return { valid: false, errors: scopeCheck.errors, normalizedValues: {} };
    }
    return validateDataEntryForm(entityKind, scoped, { mode, role: scope.role });
  }

  validateWithQuality(
    entityKind: DataEntryEntityKind,
    values: Record<string, unknown>,
    scope: DataEntryScope,
    mode: DataEntryFormMode = 'create',
    quality: Pick<DataQualityValidationContext, 'references' | 'baseline' | 'batchValues' | 'batchRowIndex' | 'staleReferenceMaxAgeHours'> = {},
  ): DataQualityValidationResult {
    const definition = getDataEntryFormDefinition(entityKind, mode);
    if (!canAccessForm(definition, scope.role)) {
      return {
        schemaVersion: 'trackmind.data-quality-validation.v1',
        valid: false,
        errors: [`Role ${scope.role} cannot access ${entityKind} form`],
        issues: [],
        normalizedValues: {},
      };
    }
    return validateDataEntryWithQuality(entityKind, values, {
      scope,
      mode,
      role: scope.role,
      references: quality.references,
      baseline: quality.baseline,
      batchValues: quality.batchValues,
      batchRowIndex: quality.batchRowIndex,
      staleReferenceMaxAgeHours: quality.staleReferenceMaxAgeHours,
    });
  }

  saveDraft(input: {
    entityKind: DataEntryEntityKind;
    mode: DataEntryFormMode;
    values: Record<string, unknown>;
    scope: DataEntryScope;
    draftId?: string;
    recordId?: string;
    status?: DataEntryDraftStatus;
    baseline?: Record<string, unknown>;
    explicit?: boolean;
    currentBaselineFingerprint?: string;
    currentRecordVersion?: string;
    currentRecordUpdatedAt?: string;
  }): DataEntryDraftRecord {
    const definition = getDataEntryFormDefinition(input.entityKind, input.mode);
    if (!definition.draft.enabled) throw new Error(`Drafts disabled for ${input.entityKind}`);
    if (!canAccessForm(definition, input.scope.role)) throw new Error(`Role ${input.scope.role} cannot save drafts for ${input.entityKind}`);

    const now = new Date().toISOString();
    const existing = input.draftId ? this.drafts.get(input.draftId, input.scope) : undefined;
    const baseline = input.baseline ?? existing?.values ?? input.values;
    const baselineFingerprint = input.currentBaselineFingerprint ?? computeBaselineFingerprint(baseline);
    const version = extractRecordVersion(baseline);
    const conflict = existing
      ? detectDraftBaselineConflict(existing, baselineFingerprint, {
          baseRecordVersion: input.currentRecordVersion ?? version.baseRecordVersion,
          baseRecordUpdatedAt: input.currentRecordUpdatedAt ?? version.baseRecordUpdatedAt,
        })
      : { hasConflict: false };

    const retentionDays = definition.draft.retentionDays ?? defaultDraftRetentionDays(input.entityKind);
    const createdAt = existing?.createdAt ?? now;
    const record: DataEntryDraftRecord = {
      draftId: existing?.draftId ?? input.draftId ?? nextDraftId(),
      entityKind: input.entityKind,
      mode: input.mode,
      recordId: input.recordId ?? existing?.recordId,
      values: enrichPayloadWithScope(input.scope, input.values),
      scope: {
        tenantId: input.scope.tenantId,
        racetrackId: input.scope.racetrackId,
        actorId: input.scope.actorId,
        role: input.scope.role,
      },
      status: conflict.hasConflict ? 'conflict' : input.status ?? (input.explicit ? 'draft' : 'autosaved'),
      baselineFingerprint,
      baseRecordVersion: version.baseRecordVersion ?? input.currentRecordVersion,
      baseRecordUpdatedAt: version.baseRecordUpdatedAt ?? input.currentRecordUpdatedAt,
      autosaveCount: (existing?.autosaveCount ?? 0) + (input.explicit ? 0 : 1),
      conflictDetectedAt: conflict.hasConflict ? now : existing?.conflictDetectedAt,
      conflictReason: conflict.hasConflict ? conflict.reason : existing?.conflictReason,
      createdAt,
      updatedAt: now,
      expiresAt: computeDraftExpiresAt(createdAt, retentionDays),
    };
    return this.drafts.save(record);
  }

  listDrafts(
    entityKind: DataEntryEntityKind | undefined,
    scope: DataEntryScope,
    options: { includeExpired?: boolean; recordId?: string; mode?: DataEntryFormMode } = {},
  ): DataEntryDraftRecord[] {
    if (!options.includeExpired) {
      this.cleanupExpiredDrafts(scope);
    }
    return this.drafts.list(entityKind, scope).filter((draft) => {
      if (options.recordId && draft.recordId !== options.recordId) return false;
      if (options.mode && draft.mode !== options.mode) return false;
      if (!options.includeExpired && isDraftExpired(draft)) return false;
      return true;
    }).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  cleanupExpiredDrafts(scope: DataEntryScope): number {
    let removed = 0;
    for (const draft of this.drafts.list(undefined, scope)) {
      if (isDraftExpired(draft)) {
        if (this.drafts.delete(draft.draftId, scope)) removed += 1;
      }
    }
    return removed;
  }

  purgeDraftsForSession(input: {
    entityKind: DataEntryEntityKind;
    mode: DataEntryFormMode;
    recordId?: string;
    scope: DataEntryScope;
    draftId?: string;
  }): number {
    let removed = 0;
    for (const draft of this.listDrafts(input.entityKind, input.scope, {
      recordId: input.recordId,
      mode: input.mode,
      includeExpired: true,
    })) {
      if (input.draftId && draft.draftId !== input.draftId) continue;
      if (this.drafts.delete(draft.draftId, input.scope)) removed += 1;
    }
    return removed;
  }

  checkDraftConflict(
    draftId: string,
    scope: DataEntryScope,
    currentBaseline: Record<string, unknown>,
  ): { draft: DataEntryDraftRecord; conflict: ReturnType<typeof detectDraftBaselineConflict> } {
    const draft = this.loadDraft(draftId, scope);
    if (!draft) throw new Error(`Unknown draft ${draftId}`);
    const version = extractRecordVersion(currentBaseline);
    const conflict = detectDraftBaselineConflict(
      draft,
      computeBaselineFingerprint(currentBaseline),
      version,
    );
    return { draft, conflict };
  }

  restoreDraft(draftId: string, scope: DataEntryScope): DataEntryDraftRecord {
    const draft = this.loadDraft(draftId, scope);
    if (!draft) throw new Error(`Unknown draft ${draftId}`);
    if (isDraftExpired(draft)) throw new Error(`Draft ${draftId} expired`);
    const restored: DataEntryDraftRecord = {
      ...draft,
      status: 'restored',
      updatedAt: new Date().toISOString(),
    };
    return this.drafts.save(restored);
  }

  loadDraft(draftId: string, scope: DataEntryScope): DataEntryDraftRecord | undefined {
    return this.drafts.get(draftId, scope);
  }

  deleteDraft(draftId: string, scope: DataEntryScope): boolean {
    return this.drafts.delete(draftId, scope);
  }

  submit(
    entityKind: DataEntryEntityKind,
    values: Record<string, unknown>,
    scope: DataEntryScope,
    mode: DataEntryFormMode = 'create',
    recordId?: string,
    quality?: Pick<DataQualityValidationContext, 'references' | 'baseline' | 'batchValues' | 'batchRowIndex' | 'staleReferenceMaxAgeHours'>,
  ): DataEntryMutationResult {
    const definition = getDataEntryFormDefinition(entityKind, mode);
    if (!canAccessForm(definition, scope.role)) {
      throw new Error(`Role ${scope.role} cannot submit ${entityKind} form`);
    }
    if (!canRoleAccessDataEntryEntity(scope.role, entityKind, mode === 'edit' ? 'edit' : 'create')) {
      throw new Error(`Role ${scope.role} cannot submit ${entityKind} entity domain`);
    }

    const validation = this.validate(entityKind, values, scope, mode, quality);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    const auditId = nextAuditId();
    const auditMetadata = buildDataEntryAuditMetadata(definition, scope, mode, validation.normalizedValues, recordId);

    appendAudit(this.audit, {
      id: auditId,
      type: 'data-change',
      actor: scope.actorId,
      actorType: 'human',
      timestamp: auditMetadata.capturedAt,
      action: auditMetadata.action,
      reason: auditMetadata.reason,
      actionClass: 'api',
      subjectId: recordId ?? entityKind,
      correlationId: scope.requestId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      sourceService: 'trackmind-data-entry',
      payload: {
        entityKind,
        mode,
        values: validation.normalizedValues,
        submitPath: resolveSubmitPath(definition, mode, {
          recordId: recordId ?? '',
          horseId: String(validation.normalizedValues.horseId ?? ''),
          raceCardId: String(validation.normalizedValues.raceCardId ?? ''),
          entryId: String(validation.normalizedValues.entryId ?? ''),
        }),
        pipelineRequired: true,
      },
    });

    const pipelinePlan = buildDataEntryPipelinePlan(
      entityKind,
      mode,
      validation.normalizedValues,
      scope,
      recordId,
    );
    const pipelineResult = this.pipeline.execute(
      pipelinePlan,
      scope,
      validation.normalizedValues,
      auditId,
    );

    if (definition.draft.enabled) {
      this.purgeDraftsForSession({ entityKind, mode, recordId, scope });
    }

    return mergePipelineIntoMutationResult({
      accepted: true,
      entityKind,
      mode,
      recordId,
      auditId,
      eventId: pipelineResult.emissions.find((entry) => entry.kind === 'domain-event')?.eventId,
      approvalRequired: pipelinePlan.approvalRequired,
      approvalRequestId: pipelineResult.approvalRequestId,
      artifactId: pipelineResult.artifactId,
      lineageRefs: pipelineResult.lineageRefs,
      kpiSourceEventIds: pipelineResult.kpiSourceEventIds,
      digitalTwinUpdateIds: pipelineResult.digitalTwinUpdateIds,
      complianceEvidenceLinkIds: pipelineResult.complianceEvidenceLinkIds,
      aiArtifactId: pipelineResult.aiArtifactId,
      message: `${definition.displayName} recorded through artifact pipeline with audit, lineage, and downstream bindings.`,
      auditMetadata,
    }, pipelineResult);
  }
}

export function createDataEntryService(
  audit: AuditAppendTarget,
  pipelineDeps?: Omit<DataEntryPipelineDependencies, 'audit'>,
): DataEntryService {
  return new DataEntryService(new InMemoryDataEntryDraftStore(), audit, pipelineDeps);
}
