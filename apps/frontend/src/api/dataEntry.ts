import type {
  DataEntryDraftRecord,
  DataEntryDraftStatus,
  DataEntryEntityKind,
  DataEntryFormMode,
  DataEntryMutationResult,
  DataEntryValidationResult,
  DraftConflictResult,
} from '@trackmind/shared';
import { deleteJson, getJson, postJson } from './client';
import { assertMutationOk } from './approvalPayload';

export interface DataEntryFormListResponse {
  schemaVersion: string;
  forms: Array<{
    entityKind: DataEntryEntityKind;
    displayName: string;
    modes: DataEntryFormMode[];
    fields: unknown[];
  }>;
}

export interface DataEntryDraftListResponse {
  drafts: DataEntryDraftRecord[];
  total: number;
}

export async function listDataEntryForms(): Promise<DataEntryFormListResponse> {
  return assertMutationOk(await getJson<DataEntryFormListResponse>('/data-entry/forms'));
}

export async function getDataEntryForm(entityKind: DataEntryEntityKind, mode: DataEntryFormMode = 'create') {
  return assertMutationOk(await getJson<Record<string, unknown>>(`/data-entry/forms/${encodeURIComponent(entityKind)}?mode=${mode}`));
}

export async function validateDataEntryPayload(input: {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  values: Record<string, unknown>;
}): Promise<DataEntryValidationResult> {
  return assertMutationOk(await postJson<DataEntryValidationResult>('/data-entry/validate', input));
}

export async function saveDataEntryDraft(input: {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  values: Record<string, unknown>;
  draftId?: string;
  recordId?: string;
  status?: DataEntryDraftStatus;
  baseline?: Record<string, unknown>;
  explicit?: boolean;
  currentBaselineFingerprint?: string;
  currentRecordVersion?: string;
  currentRecordUpdatedAt?: string;
}): Promise<DataEntryDraftRecord> {
  return assertMutationOk(await postJson<DataEntryDraftRecord>('/data-entry/drafts', input));
}

export async function listDataEntryDrafts(input: {
  entityKind?: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  recordId?: string;
} = {}): Promise<DataEntryDraftListResponse> {
  const params = new URLSearchParams();
  if (input.entityKind) params.set('entityKind', input.entityKind);
  if (input.mode) params.set('mode', input.mode);
  if (input.recordId) params.set('recordId', input.recordId);
  const query = params.toString();
  return assertMutationOk(await getJson<DataEntryDraftListResponse>(`/data-entry/drafts${query ? `?${query}` : ''}`));
}

export async function loadDataEntryDraft(draftId: string): Promise<DataEntryDraftRecord> {
  return assertMutationOk(await getJson<DataEntryDraftRecord>(`/data-entry/drafts/${encodeURIComponent(draftId)}`));
}

export async function restoreDataEntryDraft(draftId: string): Promise<DataEntryDraftRecord> {
  return assertMutationOk(await postJson<DataEntryDraftRecord>(`/data-entry/drafts/${encodeURIComponent(draftId)}/restore`, {}));
}

export async function checkDataEntryDraftConflict(
  draftId: string,
  baseline: Record<string, unknown>,
): Promise<{ draft: DataEntryDraftRecord; conflict: DraftConflictResult }> {
  return assertMutationOk(await postJson<{ draft: DataEntryDraftRecord; conflict: DraftConflictResult }>(
    `/data-entry/drafts/${encodeURIComponent(draftId)}/conflict`,
    { baseline },
  ));
}

export async function deleteDataEntryDraft(draftId: string): Promise<void> {
  assertMutationOk(await deleteJson<{ ok: boolean }>(`/data-entry/drafts/${encodeURIComponent(draftId)}`));
}

export async function cleanupDataEntryDrafts(): Promise<{ removed: number }> {
  return assertMutationOk(await postJson<{ ok: boolean; removed: number }>('/data-entry/drafts/cleanup', {}));
}

export async function submitDataEntryForm(input: {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  values: Record<string, unknown>;
  recordId?: string;
}): Promise<DataEntryMutationResult> {
  return assertMutationOk(await postJson<DataEntryMutationResult>(`/data-entry/submit/${encodeURIComponent(input.entityKind)}`, input));
}
