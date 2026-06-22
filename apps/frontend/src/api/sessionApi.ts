import type { OperatorSessionDto } from '@trackmind/shared';
import { postJson, getJson, patchJson, deleteJson } from '@/api/client';

export async function createPlatformSession(body: {
  accessToken?: string;
  userId?: string;
  tenantId?: string;
  clientHint?: string;
}) {
  return postJson<OperatorSessionDto>('/platform/session', {
    ...body,
    clientHint: body.clientHint ?? (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'Web browser'),
  });
}

export async function fetchPlatformSession() {
  return getJson<OperatorSessionDto>('/platform/session');
}

export async function revokePlatformSession() {
  return deleteJson<{ accepted: boolean; message: string }>('/platform/session');
}

export async function patchPlatformActiveRole(activeRole: string) {
  return patchJson<OperatorSessionDto>('/platform/session/active-role', { activeRole });
}

export async function fetchNotificationPreferences() {
  return getJson<import('@trackmind/shared').NotificationPreferencesDto>('/platform/notification-preferences');
}

export async function patchNotificationPreferences(channels: Array<{ channel: string; enabled: boolean }>) {
  return patchJson<import('@trackmind/shared').NotificationPreferencesDto>('/platform/notification-preferences', { channels });
}
