import type { AccessRequestDto, OperatorPreferencesDto, OperatorPreferencesPatchDto, OperatorSessionSummaryDto } from '@trackmind/shared';
import { deleteJson, getJson, patchJson, postJson } from '@/api/client';

export async function listMyAccessRequests() {
  return getJson<AccessRequestDto[]>('/platform/access-requests?mine=true');
}

export async function createAccessRequest(requestedRole: string, justification?: string) {
  return postJson<AccessRequestDto>('/platform/access-requests', { requestedRole, justification });
}

export async function fetchOperatorPreferences() {
  return getJson<OperatorPreferencesDto>('/platform/operator-preferences');
}

export async function patchOperatorPreferences(patch: OperatorPreferencesPatchDto) {
  return patchJson<OperatorPreferencesDto>('/platform/operator-preferences', patch);
}

export async function listOperatorSessions() {
  return getJson<OperatorSessionSummaryDto[]>('/platform/sessions');
}

export async function revokeOperatorSessionById(sessionId: string) {
  return deleteJson<{ accepted: boolean; message: string }>(`/platform/sessions/${encodeURIComponent(sessionId)}`);
}

export async function revokeOtherOperatorSessions() {
  return deleteJson<{ accepted: boolean; message: string }>('/platform/sessions?scope=others');
}
