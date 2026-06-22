import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { buildSecurityEventIntakePayload } from '@trackmind/shared';

export const securityEventDataEntryEntityKinds = ['security-event-entry'] as const satisfies readonly DataEntryEntityKind[];

export function isSecurityEventDataEntryEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (securityEventDataEntryEntityKinds as readonly string[]).includes(entityKind);
}

export function buildSecurityEventSubmitPayload(
  entityKind: DataEntryEntityKind,
  _mode: DataEntryFormMode,
  values: Record<string, unknown>,
  actorId: string,
): Record<string, unknown> {
  if (entityKind !== 'security-event-entry') return values;
  const entryMode = (values.entryMode as 'quick' | 'full' | undefined) ?? 'quick';
  return { ...buildSecurityEventIntakePayload({ actorId }, values, entryMode) };
}
