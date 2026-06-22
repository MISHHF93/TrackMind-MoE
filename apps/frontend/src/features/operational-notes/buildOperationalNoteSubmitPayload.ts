import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { buildOperationalNoteEditPayload, buildOperationalNoteIntakePayload } from '@trackmind/shared';

export const operationalNoteDataEntryEntityKinds = ['operational-note'] as const satisfies readonly DataEntryEntityKind[];

export function isOperationalNoteDataEntryEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (operationalNoteDataEntryEntityKinds as readonly string[]).includes(entityKind);
}

export function buildOperationalNoteSubmitPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  actorId: string,
): Record<string, unknown> {
  if (entityKind !== 'operational-note') return values;
  if (mode === 'edit') return buildOperationalNoteEditPayload({ actorId }, values);
  const entryMode = (values.entryMode as 'flash' | 'full' | undefined) ?? 'flash';
  return { ...buildOperationalNoteIntakePayload({ actorId }, values, entryMode) };
}
