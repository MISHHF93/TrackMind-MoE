import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { buildUnifiedIncidentDomainPayload } from '@trackmind/shared';

export const incidentDataEntryEntityKinds = ['unified-incident', 'incident', 'security-incident', 'facilities-incident'] as const satisfies readonly DataEntryEntityKind[];

export function isIncidentDataEntryEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (incidentDataEntryEntityKinds as readonly string[]).includes(entityKind);
}

export function buildIncidentSubmitPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return buildUnifiedIncidentDomainPayload(entityKind, mode, values);
}
