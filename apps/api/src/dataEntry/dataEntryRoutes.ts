import type { Role } from '@trackmind/shared';
import { isBulkOperationId, isDataEntryEntityKind, normalizeRole, type DataQualityReferenceCatalog, type DataQualityValidationContext } from '@trackmind/shared';
import type { BulkDataEntryService } from './bulkDataEntryService.js';
import type { DataEntryService } from './dataEntryService.js';

export interface DataEntryRequestContext {
  tenantId: string;
  racetrackId: string;
  organizationId?: string;
  actorId: string;
  role: Role;
  requestId: string;
}

export function dataEntryScopeFromHeaders(headers: Record<string, string | undefined>, requestId: string): DataEntryRequestContext {
  const roleHeader = headers['x-trackmind-role'] ?? 'read-only-auditor';
  return {
    tenantId: headers['x-trackmind-tenant-id'] ?? 'trackmind',
    racetrackId: headers['x-trackmind-racetrack-id'] ?? 'main-track',
    organizationId: headers['x-trackmind-organization-id'],
    actorId: headers['x-trackmind-actor-id'] ?? `${roleHeader}-operator`,
    role: normalizeRole(roleHeader) ?? 'read-only-auditor',
    requestId,
  };
}

export function handleDataEntryRoute(
  service: DataEntryService,
  bulkService: BulkDataEntryService | undefined,
  method: string,
  path: string,
  body: unknown,
  scope: DataEntryRequestContext,
  searchParams?: URLSearchParams,
): { status: number; body: unknown } | undefined {
  if (method === 'GET' && path === '/data-entry/forms') {
    return { status: 200, body: { forms: service.listForms(scope), schemaVersion: 'trackmind.data-entry.v1' } };
  }

  if (bulkService) {
    if (method === 'GET' && path === '/data-entry/bulk/operations') {
      return { status: 200, body: { operations: bulkService.listOperations(scope), schemaVersion: 'trackmind.bulk-data-entry.v1' } };
    }
    if (method === 'POST' && path === '/data-entry/bulk/preview') {
      const input = (body ?? {}) as Record<string, unknown>;
      const operationId = String(input.operationId ?? '');
      if (!isBulkOperationId(operationId)) {
        return { status: 400, body: { ok: false, error: { code: 'unknown_operation', message: `Unknown bulk operation ${operationId}` } } };
      }
      try {
        const rows = Array.isArray(input.rows) ? input.rows as Array<{ rowIndex?: number; values?: Record<string, unknown> }> : [];
        const normalized = rows.map((row, rowIndex) => ({
          rowIndex: typeof row.rowIndex === 'number' ? row.rowIndex : rowIndex,
          values: (row.values ?? row) as Record<string, unknown>,
        }));
        const result = bulkService.preview(operationId, normalized, scope, {
          references: input.references as DataQualityReferenceCatalog | undefined,
          baseline: (input.baseline ?? {}) as Record<string, unknown>,
          staleReferenceMaxAgeHours: typeof input.staleReferenceMaxAgeHours === 'number' ? input.staleReferenceMaxAgeHours : undefined,
        });
        return { status: result.canCommit ? 200 : 422, body: result };
      } catch (error) {
        return { status: 403, body: { ok: false, error: { code: 'bulk_preview_denied', message: error instanceof Error ? error.message : String(error) } } };
      }
    }
    if (method === 'POST' && path === '/data-entry/bulk/commit') {
      const input = (body ?? {}) as Record<string, unknown>;
      const operationId = String(input.operationId ?? '');
      if (!isBulkOperationId(operationId)) {
        return { status: 400, body: { ok: false, error: { code: 'unknown_operation', message: `Unknown bulk operation ${operationId}` } } };
      }
      try {
        const rows = Array.isArray(input.rows) ? input.rows as Array<{ rowIndex?: number; values?: Record<string, unknown> }> : [];
        const normalized = rows.map((row, rowIndex) => ({
          rowIndex: typeof row.rowIndex === 'number' ? row.rowIndex : rowIndex,
          values: (row.values ?? row) as Record<string, unknown>,
        }));
        const result = bulkService.commit(operationId, normalized, scope, {
          commitValidOnly: input.commitValidOnly !== false,
          rowIndices: Array.isArray(input.rowIndices) ? input.rowIndices.map((index) => Number(index)) : undefined,
          reason: input.reason ? String(input.reason) : undefined,
          references: input.references as DataQualityReferenceCatalog | undefined,
          baseline: (input.baseline ?? {}) as Record<string, unknown>,
        });
        return { status: 202, body: result };
      } catch (error) {
        return { status: 400, body: { ok: false, error: { code: 'bulk_commit_denied', message: error instanceof Error ? error.message : String(error) } } };
      }
    }
  }

  const formMatch = path.match(/^\/data-entry\/forms\/([^/]+)$/);
  if (method === 'GET' && formMatch) {
    const entityKind = decodeURIComponent(formMatch[1]);
    if (!isDataEntryEntityKind(entityKind)) {
      return { status: 404, body: { ok: false, error: { code: 'unknown_entity', message: `Unknown entity kind ${entityKind}` } } };
    }
    const mode = typeof body === 'object' && body !== null && 'mode' in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).mode) as 'create' | 'edit'
      : 'create';
    try {
      return { status: 200, body: service.getForm(entityKind, mode === 'edit' ? 'edit' : 'create', scope) };
    } catch (error) {
      return { status: 403, body: { ok: false, error: { code: 'forbidden', message: error instanceof Error ? error.message : String(error) } } };
    }
  }

  if (method === 'POST' && path === '/data-entry/validate') {
    const input = (body ?? {}) as Record<string, unknown>;
    const entityKind = String(input.entityKind ?? '');
    if (!isDataEntryEntityKind(entityKind)) {
      return { status: 400, body: { ok: false, error: { code: 'unknown_entity', message: `Unknown entity kind ${entityKind}` } } };
    }
    const mode = input.mode === 'edit' ? 'edit' : 'create';
    const values = (input.values ?? {}) as Record<string, unknown>;
    const references = input.references as DataQualityValidationContext['references'] | undefined;
    const baseline = (input.baseline ?? {}) as Record<string, unknown>;
    const result = references || Object.keys(baseline).length > 0
      ? service.validateWithQuality(entityKind, values, scope, mode, {
          references,
          baseline: Object.keys(baseline).length > 0 ? baseline : undefined,
        })
      : service.validate(entityKind, values, scope, mode);
    return { status: result.valid ? 200 : 422, body: result };
  }

  if (method === 'POST' && path === '/data-entry/quality-validate') {
    const input = (body ?? {}) as Record<string, unknown>;
    const entityKind = String(input.entityKind ?? '');
    if (!isDataEntryEntityKind(entityKind)) {
      return { status: 400, body: { ok: false, error: { code: 'unknown_entity', message: `Unknown entity kind ${entityKind}` } } };
    }
    const mode = input.mode === 'edit' ? 'edit' : 'create';
    const values = (input.values ?? {}) as Record<string, unknown>;
    const result = service.validateWithQuality(entityKind, values, scope, mode, {
      references: input.references as DataQualityValidationContext['references'] | undefined,
      baseline: (input.baseline ?? {}) as Record<string, unknown>,
      batchValues: Array.isArray(input.batchValues) ? input.batchValues as Record<string, unknown>[] : undefined,
      batchRowIndex: typeof input.batchRowIndex === 'number' ? input.batchRowIndex : undefined,
      staleReferenceMaxAgeHours: typeof input.staleReferenceMaxAgeHours === 'number' ? input.staleReferenceMaxAgeHours : undefined,
    });
    return { status: result.valid ? 200 : 422, body: result };
  }

  if (method === 'POST' && path === '/data-entry/drafts') {
    const input = (body ?? {}) as Record<string, unknown>;
    const entityKind = String(input.entityKind ?? '');
    if (!isDataEntryEntityKind(entityKind)) {
      return { status: 400, body: { ok: false, error: { code: 'unknown_entity', message: `Unknown entity kind ${entityKind}` } } };
    }
    try {
      const draft = service.saveDraft({
        entityKind,
        mode: input.mode === 'edit' ? 'edit' : 'create',
        values: (input.values ?? {}) as Record<string, unknown>,
        scope,
        draftId: input.draftId ? String(input.draftId) : undefined,
        recordId: input.recordId ? String(input.recordId) : undefined,
        status: input.status === 'draft' || input.status === 'autosaved' || input.status === 'restored' || input.status === 'conflict'
          ? input.status
          : undefined,
        baseline: (input.baseline ?? {}) as Record<string, unknown>,
        explicit: input.explicit === true,
        currentBaselineFingerprint: input.currentBaselineFingerprint ? String(input.currentBaselineFingerprint) : undefined,
        currentRecordVersion: input.currentRecordVersion ? String(input.currentRecordVersion) : undefined,
        currentRecordUpdatedAt: input.currentRecordUpdatedAt ? String(input.currentRecordUpdatedAt) : undefined,
      });
      return { status: 201, body: draft };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'draft_denied', message: error instanceof Error ? error.message : String(error) } } };
    }
  }

  if (method === 'GET' && path === '/data-entry/drafts') {
    const entityKindParam = searchParams?.get('entityKind') ?? undefined;
    const entityKind = entityKindParam && isDataEntryEntityKind(entityKindParam) ? entityKindParam : undefined;
    const drafts = service.listDrafts(entityKind, scope, {
      recordId: searchParams?.get('recordId') ?? undefined,
      mode: searchParams?.get('mode') === 'edit' ? 'edit' : 'create',
    });
    return { status: 200, body: { drafts, total: drafts.length } };
  }

  if (method === 'POST' && path === '/data-entry/drafts/cleanup') {
    const removed = service.cleanupExpiredDrafts(scope);
    return { status: 200, body: { ok: true, removed } };
  }

  const draftMatch = path.match(/^\/data-entry\/drafts\/([^/]+)(?:\/(restore|conflict))?$/);
  if (method === 'GET' && draftMatch && !draftMatch[2]) {
    const draft = service.loadDraft(decodeURIComponent(draftMatch[1]), scope);
    return draft
      ? { status: 200, body: draft }
      : { status: 404, body: { ok: false, error: { code: 'draft_not_found', message: 'Draft not found' } } };
  }
  if (method === 'POST' && draftMatch?.[2] === 'restore') {
    try {
      const draft = service.restoreDraft(decodeURIComponent(draftMatch[1]), scope);
      return { status: 200, body: draft };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'draft_restore_denied', message: error instanceof Error ? error.message : String(error) } } };
    }
  }
  if (method === 'POST' && draftMatch?.[2] === 'conflict') {
    const input = (body ?? {}) as Record<string, unknown>;
    try {
      const result = service.checkDraftConflict(
        decodeURIComponent(draftMatch[1]),
        scope,
        (input.baseline ?? input.currentBaseline ?? {}) as Record<string, unknown>,
      );
      return { status: 200, body: result };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'draft_conflict_check_failed', message: error instanceof Error ? error.message : String(error) } } };
    }
  }
  if (method === 'DELETE' && draftMatch && !draftMatch[2]) {
    const deleted = service.deleteDraft(decodeURIComponent(draftMatch[1]), scope);
    return deleted
      ? { status: 204, body: { ok: true } }
      : { status: 404, body: { ok: false, error: { code: 'draft_not_found', message: 'Draft not found' } } };
  }

  const submitMatch = path.match(/^\/data-entry\/submit\/([^/]+)$/);
  if (method === 'POST' && submitMatch) {
    const entityKind = decodeURIComponent(submitMatch[1]);
    if (!isDataEntryEntityKind(entityKind)) {
      return { status: 400, body: { ok: false, error: { code: 'unknown_entity', message: `Unknown entity kind ${entityKind}` } } };
    }
    const input = (body ?? {}) as Record<string, unknown>;
    const mode = input.mode === 'edit' ? 'edit' : 'create';
    try {
      const result = service.submit(
        entityKind,
        (input.values ?? input) as Record<string, unknown>,
        scope,
        mode,
        input.recordId ? String(input.recordId) : undefined,
      );
      return { status: 202, body: result };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'submit_denied', message: error instanceof Error ? error.message : String(error) } } };
    }
  }

  return undefined;
}
