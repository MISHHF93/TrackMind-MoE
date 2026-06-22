import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { buildRaceCardDomainPayload, raceCardSubmitPathParams } from '@trackmind/shared';

export const raceCardDataEntryEntityKinds = [
  'race-card',
  'race-card-conditions',
  'race-card-classification',
  'race-card-purse',
  'race-card-entry',
  'race-card-entry-trainer',
  'race-card-post-position',
  'race-card-lifecycle',
  'jockey-assignment',
] as const satisfies readonly DataEntryEntityKind[];

export function isRaceCardDataEntryEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (raceCardDataEntryEntityKinds as readonly string[]).includes(entityKind);
}

export function buildRaceCardSubmitPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  recordId?: string,
): Record<string, unknown> {
  return buildRaceCardDomainPayload(entityKind, mode, values, {
    actorId: String(values.actorId ?? values.actor ?? 'operator'),
    role: 'racing-secretary',
    recordId,
  });
}

export const raceCardSubmitParams = raceCardSubmitPathParams;
