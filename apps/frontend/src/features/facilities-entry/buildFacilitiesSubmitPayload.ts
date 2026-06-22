import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { buildFacilitiesIncidentPayload, buildFacilitiesInspectionPayload, buildFacilitiesMaintenancePayload } from '@trackmind/shared';
import type { FacilitiesEntryMode } from '@trackmind/shared';

export const facilitiesDataEntryEntityKinds = ['facilities-inspection', 'facilities-maintenance', 'facilities-incident'] as const satisfies readonly DataEntryEntityKind[];

export function isFacilitiesDataEntryEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (facilitiesDataEntryEntityKinds as readonly string[]).includes(entityKind);
}

export function buildFacilitiesSubmitPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  actorId: string,
): Record<string, unknown> {
  const scope = { actorId };
  const entryMode = (values.entryMode as FacilitiesEntryMode | undefined) ?? 'quick';

  if (entityKind === 'facilities-inspection') {
    return buildFacilitiesInspectionPayload(scope, values, entryMode);
  }
  if (entityKind === 'facilities-maintenance') {
    return buildFacilitiesMaintenancePayload(scope, values, entryMode);
  }
  if (entityKind === 'facilities-incident') {
    return buildFacilitiesIncidentPayload(scope, values);
  }
  return values;
}
