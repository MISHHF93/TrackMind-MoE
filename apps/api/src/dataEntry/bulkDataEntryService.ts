import type { DataEntryScope } from '@trackmind/shared';
import {
  getBulkOperation,
  listBulkOperations,
  previewBulkOperation,
  selectBulkCommitRows,
  type BulkCommitResult,
  type BulkOperationId,
  type BulkPreviewResult,
  type BulkRowCommitResult,
  type BulkRowInput,
  type DataQualityReferenceCatalog,
  canAccessBulkOperation,
} from '@trackmind/shared';
import { appendAudit, type AuditAppendTarget } from '../auditAdapter.js';
import type { DataEntryService } from './dataEntryService.js';

function nextBatchAuditId(): string {
  return `audit-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class BulkDataEntryService {
  constructor(
    private readonly dataEntry: DataEntryService,
    private readonly audit: AuditAppendTarget,
  ) {}

  listOperations(scope: DataEntryScope) {
    return listBulkOperations()
      .filter((operation) => canAccessBulkOperation(operation.id, scope.role))
      .map((operation) => ({
        id: operation.id,
        label: operation.label,
        description: operation.description,
        maxRows: operation.maxRows,
        columns: operation.columns,
        entityKind: operation.entityKind,
        auditAction: operation.auditAction,
      }));
  }

  preview(operationId: BulkOperationId, rows: BulkRowInput[], scope: DataEntryScope, quality?: {
    references?: DataQualityReferenceCatalog;
    baseline?: Record<string, unknown>;
    staleReferenceMaxAgeHours?: number;
  }): BulkPreviewResult {
    return previewBulkOperation(operationId, rows, scope, quality);
  }

  commit(
    operationId: BulkOperationId,
    rows: BulkRowInput[],
    scope: DataEntryScope,
    options: { commitValidOnly?: boolean; rowIndices?: number[]; reason?: string; references?: DataQualityReferenceCatalog; baseline?: Record<string, unknown> } = {},
  ): BulkCommitResult {
    if (!canAccessBulkOperation(operationId, scope.role)) {
      throw new Error(`Role ${scope.role} cannot commit bulk operation ${operationId}`);
    }

    const operation = getBulkOperation(operationId);
    const preview = previewBulkOperation(operationId, rows, scope, {
      references: options.references,
      baseline: options.baseline,
    });
    const selected = selectBulkCommitRows(preview, options);
    const batchAuditId = nextBatchAuditId();
    const commitRows: BulkRowCommitResult[] = [];
    let acceptedCount = 0;
    let failedCount = 0;

    for (const previewRow of preview.rows) {
      if (!selected.some((row) => row.rowIndex === previewRow.rowIndex)) {
        commitRows.push({
          rowIndex: previewRow.rowIndex,
          accepted: false,
          errors: previewRow.valid ? ['Row not selected for commit'] : previewRow.errors,
          message: 'Skipped',
        });
        continue;
      }

      if (!previewRow.valid) {
        failedCount += 1;
        commitRows.push({
          rowIndex: previewRow.rowIndex,
          accepted: false,
          errors: previewRow.errors,
          message: 'Validation failed',
        });
        continue;
      }

      try {
        if (previewRow.entityKind === 'notification-target') {
          const auditId = `${batchAuditId}-row-${previewRow.rowIndex + 1}`;
          appendAudit(this.audit, {
            id: auditId,
            type: 'data-change',
            actor: scope.actorId,
            actorType: 'human',
            timestamp: new Date().toISOString(),
            action: 'notification.target.updated',
            reason: String(previewRow.normalizedValues.reason ?? options.reason ?? operation.auditAction),
            actionClass: 'api',
            subjectId: String(previewRow.normalizedValues.targetId ?? 'notification-target'),
            correlationId: batchAuditId,
            tenantId: scope.tenantId,
            racetrackId: scope.racetrackId,
            sourceService: 'trackmind-bulk-data-entry',
            payload: {
              operationId,
              rowIndex: previewRow.rowIndex,
              ...previewRow.normalizedValues,
            },
          });
          acceptedCount += 1;
          commitRows.push({
            rowIndex: previewRow.rowIndex,
            accepted: true,
            errors: [],
            auditId,
            message: 'Notification target recorded for routing update.',
          });
          continue;
        }

        const result = this.dataEntry.submit(
          previewRow.entityKind,
          previewRow.normalizedValues,
          scope,
          previewRow.mode,
          previewRow.normalizedValues.recordId ? String(previewRow.normalizedValues.recordId) : undefined,
          options.references ? { references: options.references, baseline: options.baseline } : undefined,
        );
        acceptedCount += 1;
        commitRows.push({
          rowIndex: previewRow.rowIndex,
          accepted: true,
          errors: [],
          auditId: result.auditId,
          recordId: result.recordId,
          message: result.message,
        });
      } catch (error) {
        failedCount += 1;
        commitRows.push({
          rowIndex: previewRow.rowIndex,
          accepted: false,
          errors: [error instanceof Error ? error.message : String(error)],
          message: 'Commit failed',
        });
      }
    }

    appendAudit(this.audit, {
      id: batchAuditId,
      type: 'data-change',
      actor: scope.actorId,
      actorType: 'human',
      timestamp: new Date().toISOString(),
      action: operation.auditAction,
      reason: options.reason ?? `Bulk ${operation.label} commit`,
      actionClass: 'api',
      subjectId: operationId,
      correlationId: batchAuditId,
      tenantId: scope.tenantId,
      racetrackId: scope.racetrackId,
      sourceService: 'trackmind-bulk-data-entry',
      payload: {
        operationId,
        totalRows: preview.totalRows,
        acceptedCount,
        failedCount,
        skippedCount: preview.totalRows - selected.length,
      },
    });

    const skippedCount = commitRows.filter((row) => row.message === 'Skipped').length;

    return {
      schemaVersion: 'trackmind.bulk-data-entry.v1',
      operationId,
      batchAuditId,
      totalRows: preview.totalRows,
      acceptedCount,
      failedCount,
      skippedCount,
      rows: commitRows,
      message: `Bulk ${operation.label}: ${acceptedCount} accepted, ${failedCount} failed, ${skippedCount} skipped.`,
    };
  }
}

export function createBulkDataEntryService(dataEntry: DataEntryService, audit: AuditAppendTarget): BulkDataEntryService {
  return new BulkDataEntryService(dataEntry, audit);
}
