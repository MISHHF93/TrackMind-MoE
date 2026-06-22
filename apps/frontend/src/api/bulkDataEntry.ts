import type {
  BulkCommitResult,
  BulkOperationId,
  BulkPreviewResult,
  BulkRowInput,
} from '@trackmind/shared';
import { getJson, postJson } from './client';
import { assertMutationOk } from './approvalPayload';

export interface BulkOperationSummary {
  id: BulkOperationId;
  label: string;
  description: string;
  maxRows: number;
  columns: Array<{ key: string; label: string; required?: boolean; helpText?: string; example?: string }>;
  entityKind: string;
  auditAction: string;
}

export interface BulkOperationsListResponse {
  schemaVersion: string;
  operations: BulkOperationSummary[];
}

export async function listBulkOperations(): Promise<BulkOperationsListResponse> {
  return assertMutationOk(await getJson<BulkOperationsListResponse>('/data-entry/bulk/operations'));
}

export async function previewBulkOperation(input: {
  operationId: BulkOperationId;
  rows: BulkRowInput[];
}): Promise<BulkPreviewResult> {
  return assertMutationOk(await postJson<BulkPreviewResult>('/data-entry/bulk/preview', input));
}

export async function commitBulkOperation(input: {
  operationId: BulkOperationId;
  rows: BulkRowInput[];
  commitValidOnly?: boolean;
  rowIndices?: number[];
  reason?: string;
}): Promise<BulkCommitResult> {
  return assertMutationOk(await postJson<BulkCommitResult>('/data-entry/bulk/commit', input));
}
