import type { BulkOperationId, BulkPreviewResult, BulkCommitResult } from '@trackmind/shared';
import { parseBulkPaste } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commitBulkOperation, listBulkOperations, previewBulkOperation } from '@/api/bulkDataEntry';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { Button } from '@/design/components/button';
import { FormMessage } from '@/design/components/form-field';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { cn } from '@/lib/utils';

const defaultPasteHints: Partial<Record<BulkOperationId, string>> = {
  'horse-import': 'name,microchipId,foaled,sex,breed,color,reason\nStar Runner,982000123456789,2020-03-15,colt,TB,bay,Bulk horse import batch',
  'race-entries': 'raceCardId,horseId,trainerId,ownerId,programNumber,reason\nrc-race-7,horse-1,trainer-1,owner-1,4,Bulk race entry import',
  'trainer-assignments': 'horseId,trainerId,trainerName,effectiveFrom,reason\nhorse-1,trainer-1,Jane Smith,2026-06-22,Bulk trainer assignment',
  'jockey-assignments': 'raceCardId,entryId,jockeyId,weightLbs,reason\nrc-race-7,entry-1,jockey-1,118,Bulk jockey assignment',
  'status-updates': 'statusTarget,horseId,status,reason\npaddock,horse-1,complete,Race-day status bulk update',
  'inspection-scheduling': 'assetId,inspectionType,conditionRating,nextInspectionAt,notes,reason\nGRANDSTAND_HVAC_01,routine,85,2026-07-01T09:00,Scheduled walkthrough,Bulk inspection schedule',
  'notification-targets': 'targetKind,targetId,channel,enabled,reason\nrole,racing-secretary,in-app,true,Bulk notification target update',
  'kpi-thresholds': 'kpiId,warning,critical,targetDirection,description,reason\nkpi-readiness,80,65,above,Readiness score thresholds,Season threshold adjustment',
};

export function BulkDataEntryConsole({
  title = 'Bulk data entry',
  description = 'Paste CSV/TSV rows or a JSON array. Preview validates every row before commit; invalid rows can be skipped on partial apply.',
  operationIds,
  className,
}: {
  title?: string;
  description?: string;
  operationIds?: BulkOperationId[];
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [operationId, setOperationId] = useState<BulkOperationId | ''>('');
  const [pasteText, setPasteText] = useState('');
  const [batchReason, setBatchReason] = useState('');
  const [commitValidOnly, setCommitValidOnly] = useState(true);
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<BulkCommitResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const operationsQuery = useQuery({
    queryKey: ['bulk-data-entry', 'operations', session.role],
    queryFn: listBulkOperations,
  });

  const operations = useMemo(() => {
    const all = operationsQuery.data?.operations ?? [];
    if (!operationIds?.length) return all;
    const allowed = new Set(operationIds);
    return all.filter((operation) => allowed.has(operation.id));
  }, [operationsQuery.data, operationIds]);

  const selectedOperation = operations.find((operation) => operation.id === operationId) ?? operations[0];
  const activeOperationId = (operationId || selectedOperation?.id || '') as BulkOperationId;

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!activeOperationId) throw new Error('Select a bulk operation');
      let rows;
      try {
        rows = parseBulkPaste(activeOperationId, pasteText);
        setParseError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setParseError(message);
        throw error;
      }
      if (rows.length === 0) throw new Error('Paste at least one data row');
      return previewBulkOperation({ operationId: activeOperationId, rows });
    },
    onSuccess: (result) => {
      setPreview(result);
      setCommitResult(null);
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!activeOperationId || !preview) throw new Error('Run preview before commit');
      const rows = parseBulkPaste(activeOperationId, pasteText);
      return commitBulkOperation({
        operationId: activeOperationId,
        rows,
        commitValidOnly,
        reason: batchReason.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      setCommitResult(result);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const loadTemplate = useCallback(() => {
    if (!activeOperationId) return;
    setPasteText(defaultPasteHints[activeOperationId] ?? '');
    setPreview(null);
    setCommitResult(null);
    setParseError(null);
  }, [activeOperationId]);

  const previewRows = preview?.rows ?? [];
  const commitRows = commitResult?.rows ?? [];

  return (
    <SectionPanel title={title} description={description} className={cn(className)}>
      <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
        Scoped to tenant {session.tenantId} / {session.racetrackId}. Operations require role {session.role} and server-side permission checks. All commits write batch and row-level audit events.
      </div>

      {operationsQuery.isError ? (
        <FormMessage
          tone="error"
          message={operationsQuery.error instanceof Error ? operationsQuery.error.message : 'Failed to load bulk operations'}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Bulk operation type">
        {operations.map((operation) => (
          <Button
            key={operation.id}
            size="sm"
            role="tab"
            aria-selected={activeOperationId === operation.id}
            className="min-h-10 touch-manipulation"
            variant={activeOperationId === operation.id ? 'governance' : 'outline'}
            onClick={() => {
              setOperationId(operation.id);
              setPreview(null);
              setCommitResult(null);
              setParseError(null);
            }}
          >
            {operation.label}
          </Button>
        ))}
      </div>

      {selectedOperation ? (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {selectedOperation.description} — max {selectedOperation.maxRows} rows.
        </p>
      ) : null}

      {selectedOperation ? (
        <RecordTable
          className="mt-3"
          columns={[
            { key: 'column', label: 'Column' },
            { key: 'required', label: 'Required' },
            { key: 'example', label: 'Example' },
          ]}
          rows={selectedOperation.columns.map((column) => ({
            column: column.label,
            required: column.required ? 'yes' : 'optional',
            example: column.example ?? '—',
          }))}
          emptyLabel="No columns defined."
        />
      ) : null}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="min-h-10 touch-manipulation" onClick={loadTemplate} disabled={!activeOperationId}>
            Load template
          </Button>
          <label className="flex min-h-10 items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={commitValidOnly}
              onChange={(event) => setCommitValidOnly(event.target.checked)}
            />
            Commit valid rows only (partial apply)
          </label>
        </div>
        <label htmlFor="bulk-paste-data" className="grid gap-1 text-sm font-medium">
          Paste data
          <span className="text-xs font-normal text-[var(--muted-foreground)]">CSV with header row or JSON array — required</span>
          <textarea
            id="bulk-paste-data"
            className="min-h-[140px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            placeholder="Paste CSV with header row or JSON array of objects"
            value={pasteText}
            onChange={(event) => {
              setPasteText(event.target.value);
              setPreview(null);
              setCommitResult(null);
              setParseError(null);
            }}
          />
        </label>
        <label htmlFor="bulk-batch-reason" className="grid gap-1 text-sm font-medium">
          Batch audit reason
          <span className="text-xs font-normal text-[var(--muted-foreground)]">(optional)</span>
          <input
            id="bulk-batch-reason"
            className="min-h-11 w-full touch-manipulation rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            placeholder="Why this bulk change is being applied"
            value={batchReason}
            onChange={(event) => setBatchReason(event.target.value)}
          />
        </label>
      </div>

      {parseError ? <FormMessage tone="error" message={parseError} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="governance"
          className="min-h-11 touch-manipulation"
          disabled={!activeOperationId || !pasteText.trim() || previewMutation.isPending}
          onClick={() => void previewMutation.mutate()}
        >
          {previewMutation.isPending ? 'Validating…' : 'Preview'}
        </Button>
        <Button
          size="sm"
          className="min-h-11 touch-manipulation"
          disabled={!preview?.canCommit || commitMutation.isPending}
          onClick={() => void commitMutation.mutate()}
        >
          {commitMutation.isPending ? 'Committing…' : 'Commit valid rows'}
        </Button>
      </div>

      <div aria-live="polite" aria-atomic="true">
      {previewMutation.error ? (
        <FormMessage
          tone="error"
          message={previewMutation.error instanceof Error ? previewMutation.error.message : 'Preview failed'}
        />
      ) : null}

      {preview ? (
        <div className="mt-4 space-y-2">
          <FormMessage
            tone={preview.invalidCount > 0 ? 'error' : 'muted'}
            message={`${preview.message} (${preview.validCount} valid, ${preview.invalidCount} invalid)`}
          />
          <RecordTable
            columns={[
              { key: 'row', label: 'Row' },
              { key: 'status', label: 'Status' },
              { key: 'entity', label: 'Entity' },
              { key: 'errors', label: 'Errors' },
            ]}
            rows={previewRows.map((row) => ({
              row: String(row.rowIndex + 1),
              status: row.valid ? 'valid' : 'invalid',
              entity: String(row.entityKind),
              errors: row.errors.length ? row.errors.join('; ') : '—',
            }))}
            emptyLabel="No preview rows."
          />
        </div>
      ) : null}

      {commitMutation.error ? (
        <FormMessage
          tone="error"
          message={commitMutation.error instanceof Error ? commitMutation.error.message : 'Commit failed'}
        />
      ) : null}

      {commitResult ? (
        <div className="mt-4 space-y-2">
          <FormMessage
            tone={commitResult.failedCount > 0 ? 'error' : 'muted'}
            message={`${commitResult.message} Batch audit: ${commitResult.batchAuditId}`}
          />
          <RecordTable
            columns={[
              { key: 'row', label: 'Row' },
              { key: 'accepted', label: 'Accepted' },
              { key: 'audit', label: 'Audit ID' },
              { key: 'detail', label: 'Detail' },
            ]}
            rows={commitRows.map((row) => ({
              row: String(row.rowIndex + 1),
              accepted: row.accepted ? 'yes' : 'no',
              audit: String(row.auditId ?? '—'),
              detail: row.errors.length ? row.errors.join('; ') : String(row.message ?? '—'),
            }))}
            emptyLabel="No commit results."
          />
        </div>
      ) : null}
      </div>
    </SectionPanel>
  );
}
