import type {
  EntityPickerKind,
  EntityPickerKindsResponse,
  EntityPickerSearchResponse,
} from '@trackmind/shared';
import { getJson } from './client';
import { assertMutationOk } from './approvalPayload';

export async function listEntityPickerKinds(): Promise<EntityPickerKindsResponse> {
  return assertMutationOk(await getJson<EntityPickerKindsResponse>('/entity-picker/kinds'));
}

export async function searchEntityPicker(input: {
  kind: EntityPickerKind;
  query?: string;
  limit?: number;
}): Promise<EntityPickerSearchResponse> {
  const params = new URLSearchParams();
  params.set('kind', input.kind);
  if (input.query) params.set('q', input.query);
  if (input.limit != null) params.set('limit', String(input.limit));
  return assertMutationOk(await getJson<EntityPickerSearchResponse>(`/entity-picker/search?${params.toString()}`));
}
