import type { DataEntryEntityKind, DataEntryFormMode, Role } from '@trackmind/shared';
import {
  buildVeterinaryObservationPayload,
  buildWelfareObservationPayload,
  type EquineObservationEntryMode,
} from '@trackmind/shared';

export function buildEquineObservationSubmitPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  role: Role,
): Record<string, unknown> {
  const scope = {
    actorId: String(values.actorId ?? values.actor ?? values.observedBy ?? 'operator'),
    role,
  };
  const entryMode = (values.entryMode as EquineObservationEntryMode | undefined) ?? 'quick';

  if (entityKind === 'veterinary-observation') {
    return buildVeterinaryObservationPayload(scope, values, entryMode);
  }
  if (entityKind === 'welfare-observation') {
    return buildWelfareObservationPayload(scope, values, entryMode);
  }
  return values;
}
