import type { DataEntryEntityKind, DataEntryFormMode, Role } from '@trackmind/shared';
import { buildHorseDomainPayload } from '@trackmind/shared';

export function buildHorseSubmitPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  recordId?: string,
  role?: Role,
): Record<string, unknown> {
  return buildHorseDomainPayload(entityKind, mode, values, {
    actorId: String(values.actorId ?? values.actor ?? 'operator'),
    role: role ?? 'platform-super-admin',
    recordId,
  });
}

export const horseDataEntryEntityKinds = [
  'horse',
  'horse-ownership',
  'trainer-assignment',
  'stable-assignment',
  'race-eligibility',
  'transport-record',
  'workout-record',
  'retirement-record',
  'welfare-observation',
  'veterinary-observation',
] as const satisfies readonly DataEntryEntityKind[];

export function isHorseDataEntryEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (horseDataEntryEntityKinds as readonly string[]).includes(entityKind);
}
