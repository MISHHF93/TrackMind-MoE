import type {
  DataEntryEntityKind,
  DataEntryFormMode,
  DataQualityReferenceCatalog,
  DataQualityValidationResult,
} from '@trackmind/shared';
import { postJson } from './client';
import { assertMutationOk } from './approvalPayload';

export async function validateDataQuality(input: {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  values: Record<string, unknown>;
  references?: DataQualityReferenceCatalog;
  baseline?: Record<string, unknown>;
  batchValues?: Record<string, unknown>[];
  batchRowIndex?: number;
  staleReferenceMaxAgeHours?: number;
}): Promise<DataQualityValidationResult> {
  return assertMutationOk(await postJson<DataQualityValidationResult>('/data-entry/quality-validate', input));
}

export async function validateDataEntryWithReferences(input: {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  values: Record<string, unknown>;
  references?: DataQualityReferenceCatalog;
  baseline?: Record<string, unknown>;
}): Promise<DataQualityValidationResult> {
  return assertMutationOk(await postJson<DataQualityValidationResult>('/data-entry/validate', input));
}
